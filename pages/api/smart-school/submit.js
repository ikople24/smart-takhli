import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import BlockedSchool from "@/models/smart-school/BlockedSchool";
import { getFiscalYearBE } from "@/lib/smart-school/fiscalYear";
import { nextApplicationId } from "@/lib/smart-school/applicationId";
import { notifySchoolEvent } from "@/lib/smart-school/notify";
import { normalizeSchool, householdKeyOf } from "@/lib/smart-school/scholarshipLevels";

// เทียบ schoolName กับ blocklist → 'block' ถ้าตรง ไม่งั้น 'ok'
async function evalSchool(schoolName) {
  const clean = normalizeSchool(schoolName);
  if (!clean) return "ok";
  const blocked = await BlockedSchool.findOne({ name: clean }).lean();
  return blocked ? "block" : "ok";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  try {
    await dbConnect();
    const {
      ref, prefix, fullName, phone, educationLevel, schoolName,
      address, note, housingStatus, householdMembers, annualIncome,
      residencyOverOneYear, image, location,
    } = req.body || {};

    if (!fullName || !Array.isArray(image) || image.length === 0 || !location?.lat) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["fullName", "image", "location.lat"],
      });
    }

    // หา/สร้างทะเบียนบุคคล — รายเก่าอ้างด้วย ref (จาก lookup), รายใหม่สร้างใหม่
    let applicant = null;
    if (ref && mongoose.Types.ObjectId.isValid(ref)) {
      applicant = await SchoolApplicant.findById(ref);
    }
    const isKnownApplicant = !!applicant;
    if (isKnownApplicant) {
      applicant.prefix = prefix || applicant.prefix;
      applicant.name = fullName;
      applicant.phone = phone || applicant.phone;
      await applicant.save();
    } else {
      applicant = await SchoolApplicant.create({
        prefix: prefix || "",
        name: fullName,
        phone: phone || "",
      });
    }

    const surveyYear = getFiscalYearBE();
    const isRenewal =
      isKnownApplicant &&
      !!(await SchoolApplication.exists({
        applicantRef: applicant._id,
        surveyYear: { $lt: surveyYear },
      }));

    const schoolEligibility = await evalSchool(schoolName);
    const fields = {
      educationLevel: educationLevel || "",
      schoolName: normalizeSchool(schoolName),
      address: address || "",
      note: note || "",
      housingStatus: housingStatus || "ไม่ระบุ",
      householdMembers: Math.max(1, parseInt(householdMembers) || 1),
      annualIncome: Math.max(0, parseInt(annualIncome) || 0),
      residencyOverOneYear:
        residencyOverOneYear === true || residencyOverOneYear === false ? residencyOverOneYear : null,
      schoolEligibility,
      householdKey: householdKeyOf(address),
      imageUrl: image.slice(0, 3),
      location: { lat: location.lat, lng: location.lng },
      status: "รับคำร้อง",
      statusUpdatedBy: "",
      statusUpdatedAt: null,
      scholarshipAmount: null,
      isRenewal,
    };

    let application = await SchoolApplication.findOne({
      applicantRef: applicant._id,
      surveyYear,
    });
    if (application) {
      Object.assign(application, fields);
      await application.save();
    } else {
      try {
        application = await SchoolApplication.create({
          applicantRef: applicant._id,
          surveyYear,
          applicationId: await nextApplicationId(surveyYear),
          ...fields,
        });
      } catch (err) {
        if (err.code === 11000) {
          application = await SchoolApplication.findOne({ applicantRef: applicant._id, surveyYear });
          Object.assign(application, fields);
          await application.save();
        } else {
          throw err;
        }
      }
    }

    await notifySchoolEvent(isRenewal ? "school.renewal_updated" : "school.submitted", {
      applicationId: application.applicationId,
      surveyYear,
      name: `${prefix || ""} ${fullName}`.trim(),
      educationLevel: educationLevel || "",
      phone: phone || "",
      address: address || "",
      note: note || "",
      image: image.slice(0, 3),
      location,
    });

    return res.status(200).json({
      message: "Success",
      id: application._id,
      applicationId: application.applicationId,
      isRenewal,
    });
  } catch (err) {
    console.error("❌ smart-school submit error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
