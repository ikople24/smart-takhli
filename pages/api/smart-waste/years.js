import dbConnect from "@/lib/dbConnect";
import WasteDaily from "@/models/smart-waste/WasteDaily";
import { requireWasteAdmin } from "./_auth";

// รายการปีงบที่มีข้อมูลจริง — YearPills ฝั่งหน้าใช้แทนช่วง hardcode
// (พนักงานคีย์ย้อนหลังก่อนปี 2568 ได้ เช่น 2566-2567 ปีเหล่านั้นต้องเลือกดูได้)
export default async function handler(req, res) {
  const auth = await requireWasteAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await dbConnect();
    // ใช้ index { fiscalYear: 1, recordDate: 1 } — distinct บน field แรกของ index
    const years = await WasteDaily.distinct("fiscalYear");
    return res.status(200).json({
      years: years.filter((year) => Number.isInteger(year)).sort((a, b) => b - a),
    });
  } catch (error) {
    console.error("[smart-waste/years]", error);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
}
