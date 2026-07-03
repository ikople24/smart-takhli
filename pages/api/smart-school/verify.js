import dbConnect from "@/lib/dbConnect";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import { isValidCitizenId } from "@/lib/smart-school/citizenId";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  await dbConnect();
  const { citizenId, applicantRef } = req.body || {};

  if (!isValidCitizenId(citizenId || "")) {
    return res.status(400).json({ message: "เลขบัตรประชาชนไม่ถูกต้อง" });
  }

  let applicant;
  if (applicantRef) {
    // เส้นทาง B: มาจากการค้นชื่อ — ผูกเลขบัตรให้ record เก่า
    applicant = await SchoolApplicant.findById(applicantRef);
    if (!applicant) return res.status(404).json({ message: "ไม่พบข้อมูล" });
    if (applicant.citizenId && applicant.citizenId !== citizenId) {
      return res.status(403).json({
        message: "รายการนี้ถูกผูกเลขบัตรแล้ว กรุณาค้นด้วยเลขบัตรของท่านโดยตรง",
      });
    }
    const dup = await SchoolApplicant.findOne({
      citizenId,
      _id: { $ne: applicant._id },
    }).lean();
    if (dup) {
      return res.status(409).json({
        message: "เลขบัตรนี้ถูกใช้กับรายการอื่นแล้ว หากข้อมูลไม่ถูกต้องกรุณาติดต่อเจ้าหน้าที่",
      });
    }
    if (!applicant.citizenId) {
      applicant.citizenId = citizenId;
      await applicant.save();
    }
  } else {
    // เส้นทาง A: เลขบัตรตรงกับ record ที่ผูกแล้ว (การรู้เลขเต็ม = ผ่านการยืนยัน)
    applicant = await SchoolApplicant.findOne({ citizenId });
    if (!applicant) return res.status(404).json({ message: "ไม่พบข้อมูล" });
  }

  const latest = await SchoolApplication.findOne({ applicantRef: applicant._id })
    .sort({ surveyYear: -1 })
    .lean();

  return res.status(200).json({
    applicant: {
      ref: String(applicant._id),
      prefix: applicant.prefix,
      name: applicant.name,
      phone: applicant.phone,
      citizenId: applicant.citizenId,
    },
    application: latest, // ข้อมูลเต็มปีล่าสุดสำหรับ prefill (ผ่านการยืนยันแล้ว)
  });
}
