import fs from "node:fs";
import formidable from "formidable";
import * as XLSX from "xlsx";
import dbConnect from "@/lib/dbConnect";
import WasteDaily from "@/models/smart-waste/WasteDaily";
import WasteType from "@/models/smart-waste/WasteType";
import { importWorkbook } from "@/lib/smart-waste/importWorkbook";
import { ensureWasteTypesSeeded } from "@/lib/smart-waste/seedTypes";
import { logAuditEvent } from "@/lib/auditLogger";
import { requireWasteSuperadmin } from "./_auth";

// formidable ต้องอ่าน stream เอง — ปิด bodyParser ของ Next
// (pattern เดียวกับ pages/api/upload.js)
export const config = { api: { bodyParser: false } };

const MAX_FILE_SIZE = 10 * 1024 * 1024; // ไฟล์จริงราว 850KB — 10MB เผื่อไว้มากพอ
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default async function handler(req, res) {
  // ตรวจสิทธิ์ก่อนเสมอ ให้ลำดับเหมือน endpoint อื่นทั้งโมดูล
  // เขียนทับข้อมูลได้ทีละ ~370 วัน จึงจำกัดเฉพาะ superadmin
  const auth = await requireWasteSuperadmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const dryRun = req.query.dryRun === "1";
  let uploaded = [];

  try {
    // maxFiles: 1 — part ที่เกินมาจะถูกเขียนลง temp เหมือนกัน ถ้าไม่จำกัดก็ไม่มีใครลบ
    const form = formidable({
      maxFileSize: MAX_FILE_SIZE,
      maxFiles: 1,
      allowedMimeTypes: [XLSX_MIME],
    });
    const [, files] = await form.parse(req);
    uploaded = Object.values(files).flat().filter(Boolean);

    const file = files.file?.[0];
    if (!file) return res.status(400).json({ message: "ไม่พบไฟล์ที่อัปโหลด" });

    const workbook = XLSX.read(fs.readFileSync(file.filepath), { type: "buffer" });
    const { fiscalYear, records, verification } = importWorkbook(workbook);

    // ยอดไม่ตรงต้นฉบับ = ไม่เขียนอะไรเลยทั้ง batch
    if (!verification.ok) {
      return res.status(422).json({
        message: "ยอดที่อ่านได้ไม่ตรงกับแถว 'รวม' ในไฟล์ — ยังไม่บันทึกข้อมูลใด ๆ",
        fiscalYear,
        verification,
      });
    }

    await dbConnect();
    // ไฟล์อาจถูกอัปโหลดก่อนที่ใครจะเปิดหน้าจัดการประเภทขยะสักครั้ง
    await ensureWasteTypesSeeded();

    // ทุก typeKey ในไฟล์ต้องมีอยู่จริงใน master — ไม่งั้นไฟล์ที่ส่งออกจะมีน้ำหนัก
    // ที่ไม่มีคอลัมน์รองรับ แล้วยอดในชีตจะบวกไม่ตรงกันเองตอนส่งให้หน่วยงานภายนอก
    const knownKeys = new Set(
      (await WasteType.find().select("key").lean()).map((type) => type.key)
    );
    const missingKeys = [
      ...new Set(records.flatMap((record) => record.entries.map((e) => e.typeKey))),
    ].filter((key) => !knownKeys.has(key));
    if (missingKeys.length > 0) {
      return res.status(409).json({
        message: `มีประเภทขยะในไฟล์ที่ไม่มีในระบบ: ${missingKeys.join(", ")} — เพิ่มประเภทก่อนนำเข้า`,
        fiscalYear,
        missingKeys,
      });
    }

    // วันที่มีข้อมูลอยู่แล้วและยอดจะเปลี่ยน — ให้ superadmin เห็นก่อนว่ากำลังจะทับอะไร
    const existing = await WasteDaily.find({
      recordDate: { $in: records.map((record) => record.recordDate) },
    })
      .select("recordDate totalKg")
      .lean();
    const existingByDate = new Map(existing.map((doc) => [doc.recordDate, doc.totalKg]));
    const willOverwrite = records
      .filter(
        (record) =>
          existingByDate.has(record.recordDate) &&
          existingByDate.get(record.recordDate) !== record.totalKg
      )
      .map((record) => ({
        recordDate: record.recordDate,
        from: existingByDate.get(record.recordDate),
        to: record.totalKg,
      }));

    if (dryRun) {
      return res.status(200).json({
        dryRun: true,
        fiscalYear,
        verification,
        existingDays: existing.length,
        willOverwrite,
      });
    }

    const result = await WasteDaily.bulkWrite(
      records.map((record) => ({
        updateOne: {
          filter: { recordDate: record.recordDate },
          update: {
            $set: {
              fiscalYear: record.fiscalYear,
              entries: record.entries,
              groupTotals: record.groupTotals,
              totalKg: record.totalKg,
              updatedByClerkId: auth.userId,
              updatedByName: auth.name,
            },
            $setOnInsert: {
              recordDate: record.recordDate,
              createdByClerkId: auth.userId,
              createdByName: auth.name,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false, runValidators: true }
    );

    // การนำเข้าคือการเขียนทับครั้งใหญ่ที่สุดในระบบ — ต้องมีร่องรอยว่าใครทำเมื่อไร ทับอะไรไป
    await logAuditEvent({
      actorClerkId: auth.userId,
      actorName: auth.name,
      action: "waste_daily_updated",
      resourceType: "system",
      resourceId: String(fiscalYear),
      before: { overwrittenDays: willOverwrite },
      after: { totalKg: verification.totalKg, recordCount: records.length },
      description:
        `นำเข้าไฟล์ Excel ปีงบ ${fiscalYear} — ${records.length} วัน ` +
        `รวม ${verification.totalKg} กก. (ทับข้อมูลเดิม ${willOverwrite.length} วัน)`,
      meta: {
        module: "smart-waste",
        fiscalYear,
        inserted: result.upsertedCount,
        updated: result.modifiedCount,
      },
    });

    return res.status(200).json({
      fiscalYear,
      verification,
      inserted: result.upsertedCount,
      updated: result.modifiedCount,
      overwritten: willOverwrite.length,
    });
  } catch (error) {
    console.error("[smart-waste/import]", error);
    // แยกให้ชัด: ปัญหาที่ตัวไฟล์/คำขอ = 400 · ปัญหาฝั่งเซิร์ฟเวอร์ = 500
    // (ของเดิมตอบ 400 ให้ทุกกรณี ทำให้ Mongo ล่มถูกรายงานว่าเป็นความผิดของผู้ใช้)
    const isClientError =
      typeof error?.message === "string" &&
      (error.message.startsWith("importWorkbook:") ||
        error.message.startsWith("parseSheetName:") ||
        Boolean(error?.httpCode));
    if (isClientError) {
      return res.status(400).json({ message: error.message || "ไฟล์ไม่ถูกต้อง" });
    }
    return res.status(500).json({ message: "นำเข้าไฟล์ไม่สำเร็จที่ฝั่งเซิร์ฟเวอร์" });
  } finally {
    // formidable เขียนไฟล์ลง temp — ลบทุกไฟล์ที่รับมา ไม่ใช่แค่ตัวแรก
    await Promise.all(
      uploaded.map((item) => fs.promises.unlink(item.filepath).catch(() => {}))
    );
  }
}
