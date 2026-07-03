import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import { requireSchoolAdmin } from "./_auth";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  const auth = await requireSchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  try {
    await dbConnect();
    const _id = req.body?._id || req.query?._id;
    if (!_id) return res.status(400).json({ message: "Missing _id" });
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "_id ไม่ถูกต้อง" });
    }

    const application = await SchoolApplication.findByIdAndDelete(_id);
    if (!application) return res.status(404).json({ message: "Record not found" });

    const remaining = await SchoolApplication.countDocuments({
      applicantRef: application.applicantRef,
    });
    let applicantDeleted = false;
    if (remaining === 0) {
      await SchoolApplicant.findByIdAndDelete(application.applicantRef);
      applicantDeleted = true;
    }

    return res.status(200).json({ message: "Deleted", applicantDeleted });
  } catch (err) {
    console.error("❌ smart-school delete error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
