// pages/api/education/all.js
import dbConnect from "@/lib/dbConnect";
import EducationRegister from "@/models/EducationRegisterModel";

export default async function handler(req, res) {
  await dbConnect();
  const data = await EducationRegister.find(
    {},
    { prefix: 1, name: 1, location: 1, educationLevel: 1, phone: 1, address: 1, note: 1, imageUrl: 1 }
  );
  res.status(200).json(data);
}