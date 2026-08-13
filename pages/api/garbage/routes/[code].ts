import type { NextApiRequest, NextApiResponse } from "next";
import type { RouteStop } from "@/types/garbage";
import { assignments as assignmentsCol, getDb, routes as routesCol } from "@/lib/garbage/db";
import { routeUpdateSchema } from "@/lib/garbage/validators";
import { assignSeq, buildSeqMap, remapStopTimes } from "@/lib/garbage/stopEditing";
import { logAuditEvent } from "@/lib/auditLogger";
import { requireGarbageAdmin, type GarbageAdminResult } from "../_auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "รองรับเฉพาะ PUT" });
  }

  let auth: GarbageAdminResult;
  try {
    auth = await requireGarbageAdmin(req);
  } catch (err) {
    console.error("[garbage/routes/[code]] auth", err);
    return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  }
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const rawCode = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
  if (!rawCode || !/^R\d+$/u.test(rawCode)) {
    return res.status(400).json({ error: "รหัสสายไม่ถูกต้อง" });
  }

  const parsed = routeUpdateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
  }
  const input = parsed.data;

  try {
    const [rCol, aCol] = await Promise.all([routesCol(), assignmentsCol()]);
    // active: true ให้ตรงกับ GET /routes และการตรวจสายของ POST/PUT assignments
    const before = await rCol.findOne({ code: rawCode, active: true });
    if (!before) return res.status(404).json({ error: `ไม่พบสาย ${rawCode} หรือสายถูกปิดใช้งาน` });

    // optimistic lock — กันฟอร์มที่โหลดค้างไว้เขียนทับงานของคนที่บันทึกไปก่อน
    // จำเป็นเพราะการ "สลับลำดับจุดล้วน" ไม่เปลี่ยนเซตของ seq เลย การตรวจ prevSeq ข้างล่างจึงจับไม่ได้
    // แล้วผลลัพธ์จะกลายเป็น seqMap แบบ identity (ไม่ย้ายเวลาสักจุด) แต่ทับ route.stops ด้วยลำดับเก่า
    // → เวลาทุกจุดไปติดผิดจุดแบบเงียบ ๆ ซึ่งไม่ใช่เจตนาของใครสักคน
    // เอกสารเก่าที่ยังไม่มี updatedAt ให้ผ่านไปได้ ไม่งั้นจะแก้สายนั้นไม่ได้เลยตลอดกาล
    const beforeUpdatedAt = before.updatedAt instanceof Date ? before.updatedAt.getTime() : null;
    if (beforeUpdatedAt != null) {
      const sentUpdatedAt = new Date(input.updatedAt).getTime();
      if (!Number.isFinite(sentUpdatedAt) || sentUpdatedAt !== beforeUpdatedAt) {
        return res.status(409).json({
          error: "ข้อมูลสายเปลี่ยนไปแล้วระหว่างที่เปิดฟอร์มอยู่ — ปิดแล้วเปิดใหม่เพื่อโหลดข้อมูลล่าสุด",
        });
      }
    }

    // prevSeq ทุกตัวต้องมีอยู่จริงในสายเดิม — กันฟอร์มที่ค้างอยู่บนข้อมูลเก่า
    const existingSeqs = new Set(before.stops.map((s) => s.seq));
    for (const s of input.stops) {
      if (s.prevSeq != null && !existingSeqs.has(s.prevSeq)) {
        return res.status(409).json({
          error: "ข้อมูลสายเปลี่ยนไปแล้วระหว่างที่เปิดฟอร์มอยู่ — ปิดแล้วเปิดใหม่เพื่อโหลดข้อมูลล่าสุด",
        });
      }
    }

    // ชื่อชุมชนต้องเป็นชื่อจริงจาก geojsonfeatures — พิมพ์ผิดแล้วจะค้นไม่เจอตลอดไป
    const wanted = [
      ...new Set(input.stops.map((s) => s.communityName).filter((n): n is string => !!n)),
    ];
    if (wanted.length > 0) {
      const db = await getDb();
      const found = await db
        .collection("geojsonfeatures")
        .find({ active: true, name: { $in: wanted } })
        .project({ name: 1 })
        .toArray();
      const ok = new Set(found.map((f) => String(f.name)));
      const bad = wanted.filter((w) => !ok.has(w));
      if (bad.length > 0) {
        return res.status(400).json({ error: `ไม่รู้จักชุมชน: ${bad.join(", ")}` });
      }
    }

    // assignSeq คืนจุดตามลำดับที่ส่งมา ดัชนี i จึงตรงกับ input.stops[i] เสมอ
    // communitySource ตั้งเป็น "manual" เมื่อมีชื่อชุมชน — การกดบันทึกคือการยืนยันของเจ้าหน้าที่
    // (client ส่ง communitySource มาเองไม่ได้ เพราะ stopDraftSchema เป็น .strict())
    const nextStops: RouteStop[] = assignSeq(input.stops).map((s, i) => ({
      ...s,
      communityName: input.stops[i].communityName ?? null,
      communitySource: input.stops[i].communityName ? "manual" : null,
    }));
    const seqMap = buildSeqMap(input.stops);

    // ลำดับสำคัญ: เขียนเวลาของงานก่อน แล้วจึงเขียนรายการจุดของสาย
    // ถ้าขั้นที่สองล้ม งานจะอ้าง seq ที่ยังไม่มีในสาย → หน้าเว็บแสดง "—" (ไม่มีเวลา)
    // ซึ่งปลอดภัยกว่าการเขียนสายก่อนแล้วล้ม เพราะนั่นจะทำให้แสดงเวลาผิดที่ดูเหมือนถูก
    const affected = await aCol.find({ routeCode: rawCode }).toArray();
    const remapped = affected.map((a) => ({ doc: a, next: remapStopTimes(seqMap, a.stopTimes) }));
    const timeChanges = remapped.filter(
      (r) => JSON.stringify(r.next) !== JSON.stringify(r.doc.stopTimes)
    );

    // เดิมที่นี่คำนวณคำเตือน "เวลาเรียงย้อนหลังการสลับจุด" — ถอดออกใน M7 พร้อมกับกฎใน
    // assignmentSchema เพราะ seq เป็นเลขรายการ ไม่ใช่ลำดับวิ่ง เวลาย้อนตาม seq จึงเป็นเรื่องปกติ
    // (ถ้าปล่อยไว้จะเตือนแทบทุกครั้งกับตารางจริง จนคำเตือนหมดความหมาย)
    // **คงคีย์ warnings ไว้ในผลลัพธ์** เพราะ RouteManagerModal อ่านค่านี้อยู่ — และเผื่อคำเตือนอื่นในอนาคต
    const warnings: string[] = [];

    if (timeChanges.length > 0) {
      await aCol.bulkWrite(
        timeChanges.map((c) => ({
          updateOne: {
            filter: { _id: c.doc._id },
            update: { $set: { stopTimes: c.next, updatedAt: new Date() } },
          },
        })) as never
      );
    }

    await rCol.updateOne(
      { code: rawCode },
      {
        $set: {
          name: input.name,
          needsVerification: input.needsVerification,
          stops: nextStops,
          updatedAt: new Date(),
        },
      }
    );

    await logAuditEvent({
      actorClerkId: auth.userId,
      action: "garbage_route_updated",
      resourceType: "garbage_route",
      resourceId: rawCode,
      before: { name: before.name, stops: before.stops, needsVerification: before.needsVerification ?? false },
      after: { name: input.name, stops: nextStops, needsVerification: input.needsVerification },
      description: `แก้สาย ${rawCode} (${before.stops.length} → ${nextStops.length} จุด, กระทบ ${timeChanges.length} งาน)`,
      meta: { affectedAssignments: timeChanges.length, warnings },
    });

    return res
      .status(200)
      .json({ updated: true, affectedAssignments: timeChanges.length, warnings });
  } catch (err) {
    console.error("[garbage/routes/[code]] PUT", err);
    return res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
  }
}
