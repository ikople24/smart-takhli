import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import SchoolApplication, { APPLICATION_STATUSES } from "@/models/smart-school/SchoolApplication";
import { levelBucket, bucketInfo } from "@/lib/smart-school/scholarshipLevels";
import { requireSchoolAdmin } from "./_auth";

export default async function handler(req, res) {
  if (req.method !== "PUT") return res.status(405).json({ message: "Method Not Allowed" });
  const auth = await requireSchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });
  try {
    await dbConnect();
    const { _id, status } = req.body || {};
    if (!_id || !mongoose.Types.ObjectId.isValid(_id) || !APPLICATION_STATUSES.includes(status)) {
      return res.status(400).json({ message: "ต้องระบุ _id และ status ที่ถูกต้อง" });
    }
    const application = await SchoolApplication.findById(_id);
    if (!application) return res.status(404).json({ message: "Record not found" });
    application.status = status;
    application.statusUpdatedBy = auth.name || "แอดมิน";
    application.statusUpdatedAt = new Date();
    application.scholarshipAmount =
      status === "ได้รับทุน" ? bucketInfo(levelBucket(application.educationLevel))?.amount || 0 : null;
    await application.save();
    return res.status(200).json({ message: "Status updated", status: application.status, scholarshipAmount: application.scholarshipAmount });
  } catch (err) {
    console.error("❌ smart-school status error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
