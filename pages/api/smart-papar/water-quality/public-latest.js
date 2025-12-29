import dbConnect from "@/lib/dbConnect";
import WaterQualityDaily from "@/models/smart-papar/WaterQualityDaily";

// Public endpoint สำหรับหน้าแรก: คืน "ข้อมูลล่าสุด" แบบย่อ
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    await dbConnect();

    const latest = await WaterQualityDaily.findOne({})
      .sort({ recordDate: -1, createdAt: -1 })
      .select({ recordDate: 1, tap: 1 })
      .lean();

    if (!latest) {
      return res.status(200).json({ success: true, data: null });
    }

    return res.status(200).json({
      success: true,
      data: {
        recordDate: latest.recordDate,
        tapTurbidityNtu: latest.tap?.turbidityNtu ?? null,
      },
    });
  } catch (error) {
    console.error("smart-papar public-latest error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}


