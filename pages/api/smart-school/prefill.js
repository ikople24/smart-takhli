import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  try {
    await dbConnect();
    const { ref } = req.body || {};
    if (!ref || !mongoose.Types.ObjectId.isValid(ref)) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }
    const applicant = await SchoolApplicant.findById(ref).lean();
    if (!applicant) return res.status(404).json({ message: "ไม่พบข้อมูล" });
    const application = await SchoolApplication.findOne({ applicantRef: applicant._id })
      .sort({ surveyYear: -1 })
      .select("surveyYear educationLevel schoolName address note housingStatus householdMembers annualIncome residencyOverOneYear location -_id")
      .lean();
    return res.status(200).json({
      applicant: {
        ref: String(applicant._id),
        prefix: applicant.prefix,
        name: applicant.name,
        phone: applicant.phone,
      },
      application,
    });
  } catch (err) {
    console.error("❌ smart-school prefill error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
