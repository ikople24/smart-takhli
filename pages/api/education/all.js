// pages/api/education/all.js
import dbConnect from "@/lib/dbConnect";
import EducationRegister from "@/models/EducationRegisterModel";

export default async function handler(req, res) {
  await dbConnect();
  const data = await EducationRegister.find(
    {},
    { applicantId: 1, prefix: 1, name: 1, location: 1, educationLevel: 1, phone: 1, address: 1, note: 1, annualIncome: 1, incomeSource: 1, householdMembers: 1, housingStatus: 1, receivedScholarship: 1, imageUrl: 1, createdAt: 1, updatedAt: 1 }
  );
  
  console.log('API /all - Sample data with household info:', data.find(item => item.householdMembers || item.housingStatus));
  
  res.status(200).json(data);
}