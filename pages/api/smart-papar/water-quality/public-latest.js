import dbConnect from "@/lib/dbConnect";
import WaterQualityDaily from "@/models/smart-papar/WaterQualityDaily";

// Public endpoint สำหรับหน้าแรก: คืน "ข้อมูลล่าสุด" แบบย่อ
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    await dbConnect();

    // ดึง 7 วันล่าสุดในคิวรีเดียว — แถวแรกคือค่าล่าสุด (คง shape ของ data เดิมไว้
    // เพื่อผู้ใช้เดิมของ endpoint; recent เป็น field เพิ่มสำหรับ sparkline หน้าแรกโฉมใหม่)
    const rows = await WaterQualityDaily.find({})
      .sort({ recordDate: -1, createdAt: -1 })
      .limit(7)
      .select({ recordDate: 1, tap: 1 })
      .lean();

    if (rows.length === 0) {
      return res.status(200).json({ success: true, data: null });
    }

    const latest = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        recordDate: latest.recordDate,
        tapTurbidityNtu: latest.tap?.turbidityNtu ?? null,
        // เรียงเก่า → ใหม่ ให้จุดขวาสุดของ sparkline คือค่าล่าสุด
        recent: rows
          .slice()
          .reverse()
          .map((r) => ({ recordDate: r.recordDate, ntu: r.tap?.turbidityNtu ?? null })),
      },
    });
  } catch (error) {
    console.error("smart-papar public-latest error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}


