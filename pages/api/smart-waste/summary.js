import dbConnect from "@/lib/dbConnect";
import WasteDaily from "@/models/smart-waste/WasteDaily";
import WasteType from "@/models/smart-waste/WasteType";
import { emptyGroupTotals, round2 } from "@/lib/smart-waste/aggregate";
import { fiscalMonths, fiscalYearRange } from "@/lib/smart-waste/fiscalYear";
import { requireWasteAdmin } from "./_auth";

// ปีงบหนึ่งมีอย่างมาก 366 เอกสาร × ~10 entries — ดึงมารวมใน JS ตรง ๆ เร็วกว่าและ
// อ่านง่ายกว่า aggregation pipeline ที่ต้อง $unwind + $group สองชั้น
// และได้ใช้ round2 ตัวเดียวกับที่อื่น ไม่ต้องเขียนสูตรซ้ำใน pipeline
export default async function handler(req, res) {
  const auth = await requireWasteAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const fiscalYear = Number(req.query.fiscalYear);
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2500 || fiscalYear > 2600) {
    return res.status(400).json({ message: "ต้องระบุ fiscalYear เป็นปี พ.ศ." });
  }

  await dbConnect();
  const { start, end } = fiscalYearRange(fiscalYear);
  const [records, types] = await Promise.all([
    WasteDaily.find({ recordDate: { $gte: start, $lte: end } })
      .sort({ recordDate: 1 })
      .lean(),
    WasteType.find().sort({ order: 1 }).lean(),
  ]);

  const months = fiscalMonths(fiscalYear).map((month) => ({
    ...month,
    totalKg: 0,
    recordedDays: 0,
    groupTotals: emptyGroupTotals(),
    typeTotals: {},
  }));
  const monthByKey = new Map(months.map((month) => [month.key, month]));

  const yearGroupTotals = emptyGroupTotals();
  const yearTypeTotals = {};
  let yearTotalKg = 0;

  for (const record of records) {
    const month = monthByKey.get(record.recordDate.slice(0, 7));
    if (!month) continue; // กันข้อมูลหลุดช่วง (ไม่ควรเกิด แต่ไม่ทำให้พังทั้งหน้า)
    month.recordedDays += 1;
    for (const entry of record.entries) {
      month.groupTotals[entry.group] = round2(month.groupTotals[entry.group] + entry.kg);
      month.typeTotals[entry.typeKey] = round2((month.typeTotals[entry.typeKey] || 0) + entry.kg);
      yearGroupTotals[entry.group] = round2(yearGroupTotals[entry.group] + entry.kg);
      yearTypeTotals[entry.typeKey] = round2((yearTypeTotals[entry.typeKey] || 0) + entry.kg);
      month.totalKg = round2(month.totalKg + entry.kg);
      yearTotalKg = round2(yearTotalKg + entry.kg);
    }
  }

  const totalDays = months.reduce((sum, month) => sum + month.daysInMonth, 0);
  const recordedDays = months.reduce((sum, month) => sum + month.recordedDays, 0);

  return res.status(200).json({
    fiscalYear,
    range: { start, end },
    months: months.map((month) => ({
      ...month,
      avgKgPerDay: month.daysInMonth ? round2(month.totalKg / month.daysInMonth) : 0,
    })),
    groupTotals: yearGroupTotals,
    typeTotals: yearTypeTotals,
    totalKg: yearTotalKg,
    totalDays,
    recordedDays,
    // เฉลี่ยต่อ "วันที่มีการบันทึก" — ปีที่กรอกยังไม่ครบจะได้ไม่ถูกหารด้วย 365 จนดูต่ำผิดจริง
    avgKgPerRecordedDay: recordedDays ? round2(yearTotalKg / recordedDays) : 0,
    highlightedTypes: types
      .filter((type) => type.isHighlighted)
      .map((type) => ({
        key: type.key,
        label: type.label,
        totalKg: yearTypeTotals[type.key] || 0,
      })),
  });
}
