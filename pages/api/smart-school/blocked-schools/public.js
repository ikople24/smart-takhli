import dbConnect from "@/lib/dbConnect";
import BlockedSchool from "@/models/smart-school/BlockedSchool";

// public: รายชื่อโรงเรียนไม่ผ่านเกณฑ์ (name+reason) ให้ฟอร์มเตือน
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });
  try {
    await dbConnect();
    const items = await BlockedSchool.find({}).select("name reason -_id").lean();
    return res.status(200).json({ items });
  } catch (err) {
    console.error("❌ smart-school blocked-schools public error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
