import dbConnect from "@/lib/dbConnect";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import { isValidCitizenId } from "@/lib/smart-school/citizenId";
import { getFiscalYearBE } from "@/lib/smart-school/fiscalYear";
import { nextApplicationId } from "@/lib/smart-school/applicationId";
import { notifySchoolEvent } from "@/lib/smart-school/notify";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    await dbConnect();
    const {
      citizenId, prefix, fullName, phone, educationLevel,
      address, note, housingStatus, householdMembers, annualIncome,
      image, location,
    } = req.body || {};

    if (!isValidCitizenId(citizenId || "")) {
      return res.status(400).json({ message: "เลขบัตรประชาชนไม่ถูกต้อง" });
    }
    if (!fullName || !Array.isArray(image) || image.length === 0 || !location?.lat) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["fullName", "image", "location.lat"],
      });
    }

    // หา/สร้างทะเบียนบุคคล + อัปเดตข้อมูลติดต่อล่าสุด
    let applicant = await SchoolApplicant.findOne({ citizenId });
    const isNewApplicant = !applicant;
    if (isNewApplicant) {
      applicant = await SchoolApplicant.create({
        citizenId,
        prefix: prefix || "",
        name: fullName,
        phone: phone || "",
      });
    } else {
      applicant.prefix = prefix || applicant.prefix;
      applicant.name = fullName;
      applicant.phone = phone || applicant.phone;
      await applicant.save();
    }

    const surveyYear = getFiscalYearBE();
    const isRenewal =
      !isNewApplicant &&
      !!(await SchoolApplication.exists({
        applicantRef: applicant._id,
        surveyYear: { $lt: surveyYear },
      }));

    const fields = {
      educationLevel: educationLevel || "",
      address: address || "",
      note: note || "",
      housingStatus: housingStatus || "ไม่ระบุ",
      householdMembers: parseInt(householdMembers) || 1,
      annualIncome: parseInt(annualIncome) || 0,
      imageUrl: image.slice(0, 3),
      location: { lat: location.lat, lng: location.lng },
      status: "รับคำร้อง",
      statusUpdatedBy: "",
      statusUpdatedAt: null,
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
      application = await SchoolApplication.create({
        applicantRef: applicant._id,
        surveyYear,
        applicationId: await nextApplicationId(surveyYear),
        ...fields,
      });
    }

    await notifySchoolEvent(
      isRenewal ? "school.renewal_updated" : "school.submitted",
      {
        applicationId: application.applicationId,
        surveyYear,
        name: `${prefix || ""} ${fullName}`.trim(),
        educationLevel: educationLevel || "",
        phone: phone || "",
        address: address || "",
        note: note || "",
        image: image.slice(0, 3),
        location,
      }
    );

    return res.status(200).json({
      message: "Success",
      id: application._id,
      applicationId: application.applicationId,
      isRenewal,
    });
  } catch (err) {
    console.error("❌ smart-school submit error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
}
