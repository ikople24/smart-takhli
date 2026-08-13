import type { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import type { Weekday } from "@/types/garbage";
import { assignments as assignmentsCol, routes as routesCol } from "@/lib/garbage/db";
import { assignmentInputSchema } from "@/lib/garbage/validators";
import { findOverlap } from "@/lib/garbage/overlap";
import { BASELINE_EFFECTIVE_FROM } from "@/lib/garbage/constants";
import { formatRange } from "@/lib/garbage/time";
import { logAuditEvent } from "@/lib/auditLogger";
import { requireGarbageAdmin, type GarbageAdminResult } from "../_auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT" && req.method !== "DELETE") {
    res.setHeader("Allow", "PUT, DELETE");
    return res.status(405).json({ error: "รองรับเฉพาะ PUT และ DELETE" });
  }

  let auth: GarbageAdminResult;
  try {
    auth = await requireGarbageAdmin(req);
  } catch (err) {
    console.error("[garbage/assignments/[id]] auth", err);
    return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  }
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!rawId || !ObjectId.isValid(rawId)) {
    return res.status(400).json({ error: "รหัสงานไม่ถูกต้อง" });
  }
  const _id = new ObjectId(rawId);

  try {
    const aCol = await assignmentsCol();
    const before = await aCol.findOne({ _id } as never);
    if (!before) return res.status(404).json({ error: "ไม่พบงานที่ระบุ" });

    if (req.method === "DELETE") {
      await aCol.deleteOne({ _id } as never);
      await logAuditEvent({
        actorClerkId: auth.userId,
        action: "garbage_assignment_deleted",
        resourceType: "garbage_assignment",
        resourceId: rawId,
        before,
        description: `ลบงานรถ ${before.truckNumber} รอบ ${before.shiftNo} วัน ${before.weekday}`,
      });
      return res.status(200).json({ deleted: true });
    }

    const parsed = assignmentInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
    }
    const input = parsed.data;
    // แคบชนิดที่ขอบทางเข้าเหมือน POST — zod การันตี 0–6 แต่ชนิดที่ได้กว้างกว่า Weekday
    const weekday: Weekday = input.weekday as Weekday;

    if (input.routeCode) {
      const rCol = await routesCol();
      const route = await rCol.findOne({ code: input.routeCode, active: true });
      if (!route) return res.status(400).json({ error: `ไม่พบสาย ${input.routeCode} หรือสายถูกปิดใช้งาน` });
      for (const st of input.stopTimes) {
        if (!route.stops.some((s) => s.seq === st.seq)) {
          return res.status(400).json({ error: `สาย ${input.routeCode} ไม่มีจุดลำดับที่ ${st.seq}` });
        }
      }
    }

    // คีย์ธรรมชาติซ้ำกับ "งานอื่น" หรือไม่ (ตัวเองไม่นับ) — ไม่พึ่ง unique index อย่างเดียว
    const dup = await aCol.findOne({
      weekday,
      truckNumber: input.truckNumber,
      shiftNo: input.shiftNo,
      _id: { $ne: _id },
    } as never);
    if (dup) {
      return res.status(409).json({
        error: `มีงานของรถ ${input.truckNumber} รอบ ${input.shiftNo} ในวันนี้อยู่แล้ว`,
      });
    }

    const siblings = await aCol
      .find({ weekday, truckNumber: input.truckNumber })
      .toArray();
    const clash = findOverlap(siblings, { ...input, _id });
    if (clash) {
      return res.status(400).json({
        error: `รถ ${input.truckNumber} มีงานรอบ ${clash.shiftNo} เวลา ${formatRange(clash.startMin, clash.endMin)} อยู่แล้ว เวลาทับกัน`,
      });
    }

    // ประกอบเป็น object เดียวแล้วใช้ทั้งตอนเขียนและตอนบันทึก audit
    // — audit จะได้ตรงกับสิ่งที่เขียนลงจริง (รวมฟิลด์ที่เซิร์ฟเวอร์เติมเอง) เหมือนฝั่ง POST
    const changes = {
      ...input,
      weekday, // ทับด้วยค่าที่แคบชนิดแล้ว — ค่าเท่ากับ input.weekday ทุกประการ
      effectiveFrom: BASELINE_EFFECTIVE_FROM,
      effectiveTo: null,
      updatedAt: new Date(),
    };

    try {
      await aCol.updateOne({ _id } as never, { $set: changes });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        return res.status(409).json({
          error: `มีงานของรถ ${input.truckNumber} รอบ ${input.shiftNo} ในวันนี้อยู่แล้ว`,
        });
      }
      throw err;
    }

    await logAuditEvent({
      actorClerkId: auth.userId,
      action: "garbage_assignment_updated",
      resourceType: "garbage_assignment",
      resourceId: rawId,
      before,
      after: changes,
      description: `แก้งานรถ ${input.truckNumber} รอบ ${input.shiftNo} วัน ${input.weekday}`,
    });

    return res.status(200).json({ updated: true });
  } catch (err) {
    console.error("[garbage/assignments/[id]]", req.method, err);
    return res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
  }
}
