import dbConnect from "@/lib/dbConnect";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import { maskName } from "@/lib/smart-school/mask";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  try {
    await dbConnect();
    const { name } = req.body || {};
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ message: "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร" });
    }
    const applicants = await SchoolApplicant.find({
      name: { $regex: escapeRegex(String(name).trim()), $options: "i" },
    })
      .limit(10)
      .lean();

    const results = await Promise.all(
      applicants.map(async (a) => {
        const latest = await SchoolApplication.findOne({ applicantRef: a._id })
          .sort({ surveyYear: -1 })
          .select("surveyYear educationLevel address")
          .lean();
        return {
          ref: String(a._id),
          maskedName: maskName(a.name),
          level: latest?.educationLevel || "",
          lastYear: latest?.surveyYear || null,
        };
      })
    );
    return res.status(200).json({ found: results.length > 0, results });
  } catch (err) {
    console.error("❌ smart-school lookup error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
