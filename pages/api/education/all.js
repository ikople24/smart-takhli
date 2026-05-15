// pages/api/education/all.js
import dbConnect from "@/lib/dbConnect";
import EducationRegister from "@/models/EducationRegisterModel";
import { requireAuth } from "@/lib/requireAuth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const auth = await requireAuth(req, res, ["admin", "superadmin"]);
  if (!auth) return;

  try {
    await dbConnect();

    const data = await EducationRegister.find(
      {},
      {
        applicantId: 1,
        prefix: 1,
        name: 1,
        location: 1,
        educationLevel: 1,
        phone: 1,
        address: 1,
        actualAddress: 1,
        note: 1,
        annualIncome: 1,
        incomeSource: 1,
        householdMembers: 1,
        housingStatus: 1,
        familyStatus: 1,
        receivedScholarship: 1,
        takhliScholarshipHistory: 1,
        schoolName: 1,
        gradeLevel: 1,
        gpa: 1,
        imageUrl: 1,
        createdAt: 1,
        updatedAt: 1,
      }
    );

    return res.status(200).json(data);
  } catch (err) {
    console.error("education/all error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch education data" });
  }
}
