import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import { requireSchoolAdmin } from "./_auth";

// บันทึกลำดับจัดสรรทุนที่เจ้าหน้าที่จัดเอง (ต้องตรงกับเอกสารราชการ)
export default async function handler(req, res) {
  if (req.method !== "PUT") return res.status(405).json({ message: "Method Not Allowed" });
  const auth = await requireSchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });
  try {
    await dbConnect();
    const { _id, rank } = req.body || {};
    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "ต้องระบุ _id ที่ถูกต้อง" });
    }
    // rank: null/'' = ล้างลำดับ, หรือจำนวนเต็ม ≥ 1
    let value = null;
    if (rank !== null && rank !== undefined && rank !== "") {
      const n = Number(rank);
      if (!Number.isInteger(n) || n < 1) {
        return res.status(400).json({ message: "ลำดับต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป" });
      }
      value = n;
    }
    const application = await SchoolApplication.findById(_id);
    if (!application) return res.status(404).json({ message: "Record not found" });
    application.scholarshipRank = value;
    await application.save();
    return res.status(200).json({ message: "Rank updated", scholarshipRank: application.scholarshipRank });
  } catch (err) {
    console.error("❌ smart-school rank error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
