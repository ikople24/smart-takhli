import dbConnect from "@/lib/dbConnect";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import { isValidCitizenId } from "@/lib/smart-school/citizenId";
import { maskName } from "@/lib/smart-school/mask";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function toMasked(applicant) {
  const latest = await SchoolApplication.findOne({ applicantRef: applicant._id })
    .sort({ surveyYear: -1 })
    .select("surveyYear")
    .lean();
  return {
    ref: String(applicant._id),
    maskedName: maskName(applicant.name),
    lastYear: latest?.surveyYear || null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  try {
    await dbConnect();
    const { citizenId, name } = req.body || {};

    // โหมด 1: ค้นด้วยเลขบัตรตรง ๆ
    if (citizenId) {
      if (!isValidCitizenId(citizenId)) {
        return res.status(400).json({ message: "เลขบัตรประชาชนไม่ถูกต้อง" });
      }
      const applicant = await SchoolApplicant.findOne({ citizenId }).lean();
      if (!applicant) return res.status(200).json({ found: false });
      return res.status(200).json({ found: true, result: await toMasked(applicant) });
    }

    // โหมด 2: ค้นด้วยชื่อ — เฉพาะ record ที่ยังไม่ถูกผูกเลขบัตร
    // (record ที่ผูกเลขแล้วต้องเข้าถึงด้วยเลขตรงเท่านั้น — ปิดช่อง claim ของคนอื่น)
    if (name && String(name).trim().length >= 2) {
      const applicants = await SchoolApplicant.find({
        $or: [{ citizenId: { $exists: false } }, { citizenId: null }],
        name: { $regex: escapeRegex(String(name).trim()), $options: "i" },
      })
        .limit(5)
        .lean();
      const results = await Promise.all(applicants.map(toMasked));
      return res.status(200).json({ found: results.length > 0, results });
    }

    return res.status(400).json({ message: "ต้องระบุ citizenId หรือ name (≥2 ตัวอักษร)" });
  } catch (err) {
    console.error("❌ smart-school lookup error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
