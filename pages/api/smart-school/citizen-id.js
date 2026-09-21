import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import { maskCitizenId } from "@/lib/smart-school/citizenId";
import { resolveCitizenIdChange, applyCitizenIdChange } from "./_citizenId";
import { requireSchoolAdmin } from "./_auth";

// PUT { applicantRef, citizenId } — citizenId: เลข 13 หลัก = ผูก, null = ล้าง
// ตอบกลับเฉพาะเลขมาสก์ — เลขเต็มไม่ออกจากเซิร์ฟเวอร์ (PDPA, ดู spec 2026-07-15)
export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  const auth = await requireSchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  try {
    await dbConnect();
    const { applicantRef, citizenId } = req.body || {};
    if (!applicantRef || !mongoose.Types.ObjectId.isValid(applicantRef)) {
      return res.status(400).json({ message: "applicantRef ไม่ถูกต้อง" });
    }
    if (citizenId === undefined) {
      // กันเคสลืมส่งฟิลด์แล้วกลายเป็นล้างเลขโดยไม่ตั้งใจ — ต้องส่ง null ชัด ๆ ถึงจะล้าง
      return res.status(400).json({ message: "ต้องส่ง citizenId (ส่ง null เพื่อล้างเลข)" });
    }
    const applicant = await SchoolApplicant.findById(applicantRef).lean();
    if (!applicant) return res.status(404).json({ message: "Applicant not found" });

    const resolved = await resolveCitizenIdChange(applicant._id, citizenId);
    if (!resolved.ok) {
      return res
        .status(resolved.status)
        .json({ message: resolved.message, duplicateOf: resolved.duplicateOf });
    }
    await applyCitizenIdChange(applicant._id, resolved);

    return res.status(200).json({
      citizenIdMasked: resolved.action === "set" ? maskCitizenId(resolved.citizenId) : null,
    });
  } catch (err) {
    if (err?.code === 11000) {
      // race กับ request อื่น — unique index กันไว้ชั้นสุดท้าย
      return res.status(409).json({ message: "เลขนี้ถูกใช้กับผู้สมัครคนอื่นแล้ว" });
    }
    console.error("❌ smart-school citizen-id error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
