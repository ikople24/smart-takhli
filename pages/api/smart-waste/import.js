import fs from "node:fs";
import formidable from "formidable";
import * as XLSX from "xlsx";
import dbConnect from "@/lib/dbConnect";
import WasteDaily from "@/models/smart-waste/WasteDaily";
import { importWorkbook } from "@/lib/smart-waste/importWorkbook";
import { requireWasteSuperadmin } from "./_auth";

// formidable ต้องอ่าน stream เอง — ปิด bodyParser ของ Next
// (pattern เดียวกับ pages/api/upload.js)
export const config = { api: { bodyParser: false } };

const MAX_FILE_SIZE = 10 * 1024 * 1024; // ไฟล์จริงราว 850KB — 10MB เผื่อไว้มากพอ

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // เขียนทับข้อมูลได้ทีละ ~370 วัน จึงจำกัดเฉพาะ superadmin
  const auth = await requireWasteSuperadmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  const dryRun = req.query.dryRun === "1";
  let filepath = null;

  try {
    const form = formidable({ maxFileSize: MAX_FILE_SIZE });
    const [, files] = await form.parse(req);
    const file = files.file?.[0];
    if (!file) return res.status(400).json({ message: "ไม่พบไฟล์ที่อัปโหลด" });
    filepath = file.filepath;

    const workbook = XLSX.read(fs.readFileSync(filepath), { type: "buffer" });
    const { fiscalYear, records, verification } = importWorkbook(workbook);

    // ยอดไม่ตรงต้นฉบับ = ไม่เขียนอะไรเลยทั้ง batch
    if (!verification.ok) {
      return res.status(422).json({
        message: "ยอดที่อ่านได้ไม่ตรงกับแถว 'รวม' ในไฟล์ — ยังไม่บันทึกข้อมูลใด ๆ",
        fiscalYear,
        verification,
      });
    }

    if (dryRun) {
      return res.status(200).json({ dryRun: true, fiscalYear, verification });
    }

    await dbConnect();
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
      { ordered: false }
    );

    return res.status(200).json({
      fiscalYear,
      verification,
      inserted: result.upsertedCount,
      updated: result.modifiedCount,
    });
  } catch (error) {
    console.error("[smart-waste/import]", error);
    return res.status(400).json({ message: error.message || "นำเข้าไฟล์ไม่สำเร็จ" });
  } finally {
    // formidable เขียนไฟล์ลง temp — ลบทิ้งไม่ให้ค้าง
    if (filepath) fs.promises.unlink(filepath).catch(() => {});
  }
}
