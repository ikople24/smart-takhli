import dbConnect from "@/lib/dbConnect";
import BlockedSchool from "@/models/smart-school/BlockedSchool";
import { normalizeSchool } from "@/lib/smart-school/scholarshipLevels";
import { requireSchoolAdmin } from "../_auth";

export default async function handler(req, res) {
  const auth = await requireSchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });
  try {
    await dbConnect();

    if (req.method === "GET") {
      const items = await BlockedSchool.find({}).sort({ name: 1 }).lean();
      return res.status(200).json({ items });
    }
    if (req.method === "PUT") {
      const { name, reason, note } = req.body || {};
      const clean = normalizeSchool(name);
      if (!clean) return res.status(400).json({ message: "ต้องระบุชื่อโรงเรียน" });
      const r = ["private", "out-of-district", "other"].includes(reason) ? reason : "private";
      const doc = await BlockedSchool.findOneAndUpdate(
        { name: clean },
        { name: clean, reason: r, note: note || "" },
        { new: true, upsert: true }
      );
      return res.status(200).json({ item: doc });
    }
    if (req.method === "DELETE") {
      const name = normalizeSchool(req.body?.name || req.query?.name);
      if (!name) return res.status(400).json({ message: "ต้องระบุชื่อ" });
      await BlockedSchool.deleteOne({ name });
      return res.status(200).json({ message: "ลบแล้ว" });
    }
    return res.status(405).json({ message: "Method Not Allowed" });
  } catch (err) {
    console.error("❌ smart-school blocked-schools error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
