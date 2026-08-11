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
}
