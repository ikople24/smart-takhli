import type { NextApiRequest, NextApiResponse } from "next";
import type { Weekday } from "@/types/garbage";
import { assignments as assignmentsCol, routes as routesCol } from "@/lib/garbage/db";
import { assignmentInputSchema } from "@/lib/garbage/validators";
import { findOverlap } from "@/lib/garbage/overlap";
import { BASELINE_EFFECTIVE_FROM } from "@/lib/garbage/constants";
import { formatRange } from "@/lib/garbage/time";
import { logAuditEvent } from "@/lib/auditLogger";
import { requireGarbageAdmin, type GarbageAdminResult } from "../_auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "รองรับเฉพาะ POST" });
  }

  let auth: GarbageAdminResult;
  try {
    auth = await requireGarbageAdmin(req);
  } catch (err) {
    console.error("[garbage/assignments] auth", err);
    return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  }
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const parsed = assignmentInputSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
  }
  const input = parsed.data;
  // zod การันตี 0–6 แล้ว แต่ชนิดที่ได้คือ number ซึ่งกว้างกว่า Weekday ของ Assignment
  // — แคบชนิดที่ขอบทางเข้าเพียงจุดเดียว (แบบเดียวกับ weekdayOf ใน lib/garbage/time.ts)
  // เพื่อให้ตัวกรองของ Mongo ตรวจชนิดได้จริง ไม่ต้องหว่าน cast ในทุกคิวรี
  const weekday: Weekday = input.weekday as Weekday;

  try {
    const [aCol, rCol] = await Promise.all([assignmentsCol(), routesCol()]);

    // สายต้องมีจริงและยัง active
    if (input.routeCode) {
      const route = await rCol.findOne({ code: input.routeCode, active: true });
      if (!route) return res.status(400).json({ error: `ไม่พบสาย ${input.routeCode} หรือสายถูกปิดใช้งาน` });
      for (const st of input.stopTimes) {
        if (!route.stops.some((s) => s.seq === st.seq)) {
          return res.status(400).json({ error: `สาย ${input.routeCode} ไม่มีจุดลำดับที่ ${st.seq}` });
        }
      }
    }

    // ตรวจคีย์ธรรมชาติซ้ำก่อนเขียน — ไม่พึ่ง unique index อย่างเดียว
    // เพราะ ensureIndexes() ไม่มีใครเรียก index จึงมีเฉพาะ DB ที่เคยรัน seed script
    // (DB ใหม่/staging/dump เก่า จะไม่มี แล้ว 11000 ก็จะไม่เกิด = ไม่มีตัวกัน)
    const dup = await aCol.findOne({
      weekday,
      truckNumber: input.truckNumber,
      shiftNo: input.shiftNo,
    });
    if (dup) {
      return res.status(409).json({
        error: `มีงานของรถ ${input.truckNumber} รอบ ${input.shiftNo} ในวันนี้อยู่แล้ว — ให้แก้งานเดิมแทนการเพิ่มใหม่`,
      });
    }

    // กฎข้ามเอกสาร: รถคันเดียวกันในวันเดียวกัน เวลาห้ามทับ
    const siblings = await aCol
      .find({ weekday, truckNumber: input.truckNumber })
      .toArray();
    const clash = findOverlap(siblings, input);
    if (clash) {
      return res.status(400).json({
        error: `รถ ${input.truckNumber} มีงานรอบ ${clash.shiftNo} เวลา ${formatRange(clash.startMin, clash.endMin)} อยู่แล้ว เวลาทับกัน`,
      });
    }

    const now = new Date();
    const doc = {
      ...input,
      effectiveFrom: BASELINE_EFFECTIVE_FROM,
      effectiveTo: null,
      createdAt: now,
      updatedAt: now,
    };

    let insertedId;
    try {
      const result = await aCol.insertOne(doc as never);
      insertedId = result.insertedId;
    } catch (err) {
      // unique index natural_key ชน = มีงานรถคันนี้ รอบนี้ ในวันนี้อยู่แล้ว
      if ((err as { code?: number }).code === 11000) {
        return res.status(409).json({
          error: `มีงานของรถ ${input.truckNumber} รอบ ${input.shiftNo} ในวันนี้อยู่แล้ว — ให้แก้งานเดิมแทนการเพิ่มใหม่`,
        });
      }
      throw err;
    }

    await logAuditEvent({
      actorClerkId: auth.userId,
      action: "garbage_assignment_created",
      resourceType: "garbage_assignment",
      resourceId: String(insertedId),
      after: doc,
      description: `เพิ่มงานรถ ${input.truckNumber} รอบ ${input.shiftNo} วัน ${input.weekday}`,
    });

    return res.status(201).json({ _id: String(insertedId) });
  } catch (err) {
    console.error("[garbage/assignments] POST", err);
    return res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
  }
}
