import type { NextApiRequest, NextApiResponse } from "next";
import { assignments as assignmentsCol, routes as routesCol } from "@/lib/garbage/db";
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
    const before = await rCol.findOne({ code: rawCode });
    if (!before) return res.status(404).json({ error: `ไม่พบสาย ${rawCode}` });

    // prevSeq ทุกตัวต้องมีอยู่จริงในสายเดิม — กันฟอร์มที่ค้างอยู่บนข้อมูลเก่า
    const existingSeqs = new Set(before.stops.map((s) => s.seq));
    for (const s of input.stops) {
      if (s.prevSeq != null && !existingSeqs.has(s.prevSeq)) {
        return res.status(409).json({
          error: "ข้อมูลสายเปลี่ยนไปแล้วระหว่างที่เปิดฟอร์มอยู่ — ปิดแล้วเปิดใหม่เพื่อโหลดข้อมูลล่าสุด",
        });
      }
    }

    const nextStops = assignSeq(input.stops);
    const seqMap = buildSeqMap(input.stops);

    // ลำดับสำคัญ: เขียนเวลาของงานก่อน แล้วจึงเขียนรายการจุดของสาย
    // ถ้าขั้นที่สองล้ม งานจะอ้าง seq ที่ยังไม่มีในสาย → หน้าเว็บแสดง "—" (ไม่มีเวลา)
    // ซึ่งปลอดภัยกว่าการเขียนสายก่อนแล้วล้ม เพราะนั่นจะทำให้แสดงเวลาผิดที่ดูเหมือนถูก
    const affected = await aCol.find({ routeCode: rawCode }).toArray();
    const timeChanges = affected
      .map((a) => ({ _id: a._id, next: remapStopTimes(seqMap, a.stopTimes) }))
      .filter((c, i) => JSON.stringify(c.next) !== JSON.stringify(affected[i].stopTimes));

    if (timeChanges.length > 0) {
      await aCol.bulkWrite(
        timeChanges.map((c) => ({
          updateOne: {
            filter: { _id: c._id },
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
      meta: { affectedAssignments: timeChanges.length },
    });

    return res.status(200).json({ updated: true, affectedAssignments: timeChanges.length });
  } catch (err) {
    console.error("[garbage/routes/[code]] PUT", err);
    return res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
  }
}
