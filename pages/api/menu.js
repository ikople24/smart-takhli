// GET /api/menu — เมนูหมวดแจ้งเรื่องบนหน้าแรก/wizard (collection menu_list)
// เดิม proxy ไป BACKEND_API_URL ภายนอก ซึ่งอ่าน Mongo ก้อนเดียวกันอยู่แล้ว —
// เปลี่ยนมาอ่านตรงจากต้นฉบับ (2026-08-20) ตัดจุดล่มของ backend ภายนอกออก
// คืน array ตรง ๆ ตาม shape เดิมที่ useMenuStore คาดหวัง
import dbConnect from "@/lib/dbConnect";
import MenuMain from "@/models/MenuMain";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    await dbConnect();
    const menu = await MenuMain.find({}).lean();
    return res.status(200).json(menu);
  } catch (err) {
    console.error("❌ /api/menu error:", err);
    return res.status(500).json({ error: "Failed to fetch menu" });
  }
}
