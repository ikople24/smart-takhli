import { z } from "zod";
import dbConnect from "@/lib/dbConnect";
import WasteDaily from "@/models/smart-waste/WasteDaily";
import WasteType from "@/models/smart-waste/WasteType";
import {
  computeTotals,
  findHighValueEntries,
  normalizeEntries,
} from "@/lib/smart-waste/aggregate";
import { bangkokToday, fiscalYearOf, isValidRecordDate } from "@/lib/smart-waste/fiscalYear";
import { logAuditEvent } from "@/lib/auditLogger";
import { requireWasteAdmin } from "../_auth";

const BodySchema = z.object({
  entries: z
    .array(
      z.object({
        typeKey: z.string().min(1),
        kg: z.coerce.number().min(0),
      })
    )
    .default([]),
  note: z.string().max(500).default(""),
});

export default async function handler(req, res) {
  const auth = await requireWasteAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  const { date } = req.query;
  if (!isValidRecordDate(date)) {
    return res.status(400).json({ message: `วันที่ไม่ถูกรูปแบบ "${date}"` });
  }

  try {
    await dbConnect();
    return await routeRequest(req, res, auth, date);
  } catch (error) {
    console.error("[smart-waste/daily/[date]]", error);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
}

async function routeRequest(req, res, auth, date) {
  if (req.method === "GET") {
    const record = await WasteDaily.findOne({ recordDate: date }).lean();
    if (!record) {
      // ยังไม่มีข้อมูลของวันนี้ — ไม่ใช่ error ฝั่ง client ใช้เปิดฟอร์มเปล่า
      return res.status(200).json({ record: null });
    }
    return res.status(200).json({
      record: {
        recordDate: record.recordDate,
        fiscalYear: record.fiscalYear,
        entries: record.entries,
        groupTotals: record.groupTotals,
        totalKg: record.totalKg,
        note: record.note || "",
        updatedByName: record.updatedByName || "",
        updatedAt: record.updatedAt,
      },
    });
  }

  if (req.method === "PUT") {
    if (date > bangkokToday()) {
      return res.status(400).json({ message: "บันทึกวันในอนาคตไม่ได้" });
    }

    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกรูปแบบ", issues: parsed.error.issues });
    }

    const before = await WasteDaily.findOne({ recordDate: date }).lean();

    // ประเภทที่ปิดใช้งานแล้ว "กรอกเพิ่มใหม่" ไม่ได้ แต่วันที่เคยมีมันอยู่ต้องยังแก้ได้
    // ไม่งั้นพอปิดประเภทหนึ่ง วันเก่าทุกวันที่มีประเภทนั้นจะบันทึกไม่ผ่านเลย
    const existingKeys = new Set((before?.entries || []).map((entry) => entry.typeKey));
    const allTypes = await WasteType.find().lean();
    const typeByKey = new Map(
      allTypes
        .filter((type) => type.active !== false || existingKeys.has(type.key))
        .map((type) => [type.key, type])
    );

    let entries;
    try {
      entries = normalizeEntries(parsed.data.entries, typeByKey);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    // ไม่เชื่อยอดที่ client ส่งมา — คำนวณใหม่จาก entries เสมอ
    const { groupTotals, totalKg } = computeTotals(entries);

    // ไม่มีรายการเหลือ = ล้างข้อมูลของวันนั้น ไม่ใช่บันทึกวันที่ยอด 0
    // (ถ้าเก็บไว้ วันนั้นจะถูกนับเป็น "วันที่บันทึกแล้ว" แล้วไปกดค่าเฉลี่ยต่อวันให้ต่ำผิดจริง)
    if (entries.length === 0) {
      if (before) {
        await WasteDaily.deleteOne({ recordDate: date });
        // ทางนี้เป็นทางที่ "ทำลายข้อมูล" มากที่สุดของ endpoint นี้ — ต้องมี audit trail
        // ยิ่งกว่าการแก้ตัวเลขธรรมดาเสียอีก ห้าม return ก่อนบันทึก log
        await logAuditEvent({
          actorClerkId: auth.userId,
          actorName: auth.name,
          action: "waste_daily_updated",
          resourceType: "system",
          resourceId: date,
          before: { totalKg: before.totalKg, entries: before.entries },
          after: { totalKg: 0, entries: [] },
          description: `ล้างข้อมูลขยะรีไซเคิลวันที่ ${date} (เดิม ${before.totalKg} กก.)`,
          meta: { module: "smart-waste", recordDate: date, deleted: true },
        });
      }
      return res.status(200).json({ record: null, deleted: Boolean(before), warnings: [] });
    }

    await WasteDaily.updateOne(
      { recordDate: date },
      {
        $set: {
          fiscalYear: fiscalYearOf(date),
          entries,
          groupTotals,
          totalKg,
          note: parsed.data.note,
          updatedByClerkId: auth.userId,
          updatedByName: auth.name,
        },
        $setOnInsert: {
          recordDate: date,
          createdByClerkId: auth.userId,
          createdByName: auth.name,
        },
      },
      { upsert: true, runValidators: true }
    );

    // log เฉพาะการ "แก้ของเดิม" — การบันทึกวันใหม่เป็นงานปกติ ไม่ต้องมี audit trail
    if (before) {
      await logAuditEvent({
        actorClerkId: auth.userId,
        actorName: auth.name,
        action: "waste_daily_updated",
        resourceType: "system",
        resourceId: date,
        before: { totalKg: before.totalKg, entries: before.entries },
        after: { totalKg, entries },
        description: `แก้ไขข้อมูลขยะรีไซเคิลวันที่ ${date} (${before.totalKg} → ${totalKg} กก.)`,
        meta: { module: "smart-waste", recordDate: date },
      });
    }

    return res.status(200).json({
      record: { recordDate: date, entries, groupTotals, totalKg },
      created: !before,
      // ตัวเลขสูงผิดปกติ — บันทึกให้แล้ว แต่ส่งกลับให้ UI เตือนผู้กรอกได้
      warnings: findHighValueEntries(entries),
    });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
