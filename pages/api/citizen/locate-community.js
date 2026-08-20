// GET /api/citizen/locate-community?lat=..&lng=..
// หาว่าพิกัดอยู่ใน polygon ชุมชนไหน — อ่านจาก collection geojsonfeatures
// (ของแอปพี่น้อง appId app_b — **อ่านอย่างเดียว ห้ามเขียน/ห้ามสร้าง index**)
// วิธีเดียวกับ scripts/map-garbage-communities.mjs: $geoIntersects ตรง ๆ
// (22 polygon สแกนทั้ง collection ได้ ไม่ต้องมี geo index)
import dbConnect from "@/lib/dbConnect";
import GeoJSONFeature from "@/models/GeoJSONFeature";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ success: false, message: "invalid coordinates" });
  }

  try {
    await dbConnect();
    const feature = await GeoJSONFeature.findOne({
      active: true,
      geometry: {
        $geoIntersects: { $geometry: { type: "Point", coordinates: [lng, lat] } },
      },
    })
      .select({ name: 1 })
      .lean();

    return res.status(200).json({ success: true, community: feature?.name ?? null });
  } catch (error) {
    console.error("locate-community error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
