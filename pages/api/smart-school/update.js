import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import { householdKeyOf } from "@/lib/smart-school/scholarshipLevels";
import { notifySchoolEvent } from "@/lib/smart-school/notify";
import { requireSchoolAdmin } from "./_auth";
import { resolveCitizenIdChange, applyCitizenIdChange } from "./_citizenId";

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  const auth = await requireSchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  try {
    await dbConnect();
    const {
      _id, prefix, name, phone,
      educationLevel, schoolName, gradeLevel, gpa,
      address, actualAddress, housingStatus, householdMembers, annualIncome,
      incomeSource, familyStatus, receivedScholarship, takhliScholarshipHistory,
      note, imageUrl, location,
      schoolEligibility, residencyOverOneYear, eligibilityChecklist,
      citizenId,
    } = req.body || {};

    if (!_id) return res.status(400).json({ message: "Missing _id" });
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "_id ไม่ถูกต้อง" });
    }

    const application = await SchoolApplication.findById(_id);
    if (!application) return res.status(404).json({ message: "Record not found" });
    const applicant = await SchoolApplicant.findById(application.applicantRef);
    if (!applicant) return res.status(404).json({ message: "Applicant not found" });

    // เลขบัตร: ตรวจ checksum + เช็คซ้ำก่อนแตะฟิลด์อื่น — พังแล้วพังทั้งก้อน ไม่บันทึกครึ่งเดียว
    // (undefined = client ไม่ได้ส่งมา = ไม่แตะเลขเดิม)
    const citizenResolved = await resolveCitizenIdChange(applicant._id, citizenId);
    if (!citizenResolved.ok) {
      return res.status(citizenResolved.status).json({
        message: citizenResolved.message,
        duplicateOf: citizenResolved.duplicateOf,
      });
    }

    if (prefix !== undefined) applicant.prefix = prefix;
    if (name) applicant.name = name;
    if (phone !== undefined) applicant.phone = phone;

    // --- ข้อมูลใบสมัคร ---
    const imageKey = (arr) => JSON.stringify([...(arr || [])].sort());
    const before = imageKey(application.imageUrl);
    const assign = {
      educationLevel, schoolName, gradeLevel,
      address, actualAddress, housingStatus, note,
    };
    for (const [k, v] of Object.entries(assign)) {
      if (v !== undefined) application[k] = v;
    }
    if (gpa !== undefined) {
      if (gpa === null || gpa === "") {
        application.gpa = null;
      } else {
        const g = parseFloat(gpa);
        application.gpa = Number.isNaN(g) ? null : Math.min(4, Math.max(0, g));
      }
    }
    if (householdMembers !== undefined) application.householdMembers = parseInt(householdMembers) || 1;
    if (annualIncome !== undefined) application.annualIncome = Math.max(0, parseInt(annualIncome) || 0);
    if (schoolEligibility === "ok" || schoolEligibility === "block") application.schoolEligibility = schoolEligibility;
    if (residencyOverOneYear === true || residencyOverOneYear === false || residencyOverOneYear === null) {
      application.residencyOverOneYear = residencyOverOneYear;
    }
    if (eligibilityChecklist && typeof eligibilityChecklist === "object") {
      application.eligibilityChecklist = {
        residencyVerified: !!eligibilityChecklist.residencyVerified,
        schoolVerified: !!eligibilityChecklist.schoolVerified,
        documentsVerified: !!eligibilityChecklist.documentsVerified,
      };
    }
    if (address !== undefined) application.householdKey = householdKeyOf(address);
    if (Array.isArray(incomeSource)) application.incomeSource = incomeSource;
    if (Array.isArray(familyStatus)) application.familyStatus = familyStatus;
    if (Array.isArray(receivedScholarship)) application.receivedScholarship = receivedScholarship;
    if (Array.isArray(takhliScholarshipHistory)) application.takhliScholarshipHistory = takhliScholarshipHistory;
    if (Array.isArray(imageUrl)) application.imageUrl = imageUrl.slice(0, 3);
    if (location?.lat) application.location = { lat: location.lat, lng: location.lng };

    // validate ทั้งคู่ก่อนค่อยเขียน DB — กันเคสเขียนไปแล้วบางส่วนแต่ตัวที่เหลือ validate ไม่ผ่าน
    await applicant.validate();
    await application.validate();
    // เลขบัตร apply ก่อน save อื่น — ถ้าแพ้ race (E11000) จะยังไม่มีอะไรถูกบันทึก
    await applyCitizenIdChange(applicant._id, citizenResolved);
    await applicant.save();
    await application.save();

    const imagesChanged = imageKey(application.imageUrl) !== before;
    if (imagesChanged) {
      await notifySchoolEvent("school.images_changed", {
        applicationId: application.applicationId,
        surveyYear: application.surveyYear,
        name: `${applicant.prefix || ""} ${applicant.name}`.trim(),
        educationLevel: application.educationLevel,
        phone: applicant.phone,
        address: application.address,
        note: `แก้ไขรูปโดย ${auth.name || "แอดมิน"}`,
        image: application.imageUrl,
        location: application.location,
      });
    }

    return res.status(200).json({ message: "Updated successfully", imagesChanged });
  } catch (err) {
    if (err?.code === 11000) {
      // แพ้ race ผูกเลขบัตร — unique index กันไว้ชั้นสุดท้าย
      // (ตีความ 11000 เป็นเลขบัตรได้ เพราะ handler นี้ไม่แตะฟิลด์ unique อื่น: applicationId/applicantRef/surveyYear ไม่ถูกแก้ที่นี่)
      return res.status(409).json({ message: "เลขบัตรนี้ถูกใช้กับผู้สมัครคนอื่นแล้ว" });
    }
    console.error("❌ smart-school update error:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: "ข้อมูลไม่ผ่านการตรวจสอบของระบบ" });
    }
    return res.status(500).json({ message: "Server error" });
  }
}
