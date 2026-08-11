import dbConnect from "@/lib/dbConnect";
import WasteDaily from "@/models/smart-waste/WasteDaily";
import { isValidRecordDate } from "@/lib/smart-waste/fiscalYear";
import { requireWasteAdmin } from "../_auth";

export default async function handler(req, res) {
  const auth = await requireWasteAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { from, to } = req.query;
  if (!isValidRecordDate(from) || !isValidRecordDate(to)) {
    return res.status(400).json({ message: "ต้องระบุ from และ to เป็น YYYY-MM-DD" });
  }
  if (from > to) {
    return res.status(400).json({ message: "from ต้องไม่เกิน to" });
  }

  // กันคิวรีทั้ง collection ด้วย from=0001-01-01&to=9999-12-31
  const spanDays = Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000
  );
  if (spanDays > 400) {
    return res.status(400).json({ message: "ขอข้อมูลได้ครั้งละไม่เกิน 400 วัน" });
  }

  try {
    await dbConnect();
    // recordDate เป็น string YYYY-MM-DD จึงเทียบด้วย $gte/$lte ตรง ๆ ได้
    // (เรียงตามตัวอักษร = เรียงตามเวลา)
    const records = await WasteDaily.find({ recordDate: { $gte: from, $lte: to } })
      .sort({ recordDate: 1 })
      .lean();

    return res.status(200).json({
      records: records.map((record) => ({
        recordDate: record.recordDate,
        fiscalYear: record.fiscalYear,
        entries: record.entries,
        groupTotals: record.groupTotals,
        totalKg: record.totalKg,
        note: record.note || "",
        updatedByName: record.updatedByName || "",
        updatedAt: record.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[smart-waste/daily]", error);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
}
