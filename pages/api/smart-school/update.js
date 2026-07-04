import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import { householdKeyOf } from "@/lib/smart-school/scholarshipLevels";
import { notifySchoolEvent } from "@/lib/smart-school/notify";
import { requireSchoolAdmin } from "./_auth";

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
    } = req.body || {};

    if (!_id) return res.status(400).json({ message: "Missing _id" });
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "_id ไม่ถูกต้อง" });
    }

    const application = await SchoolApplication.findById(_id);
    if (!application) return res.status(404).json({ message: "Record not found" });
    const applicant = await SchoolApplicant.findById(application.applicantRef);
    if (!applicant) return res.status(404).json({ message: "Applicant not found" });

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

    // validate ใบสมัครก่อนค่อยบันทึกทั้งคู่ — กันเคสบันทึกบุคคลไปแล้วแต่ใบสมัคร validate ไม่ผ่าน
    await application.validate();
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
    console.error("❌ smart-school update error:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: "ข้อมูลไม่ผ่านการตรวจสอบของระบบ" });
    }
    return res.status(500).json({ message: "Server error" });
  }
}
