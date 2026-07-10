import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import StreetLightPole from "@/models/smart-light/StreetLightPole";
import { requireSmartLightAdmin } from "../../_auth";
import { SURVEY_STATUS_VALUES } from "@/lib/smart-light/constants";

// POST /api/smart-light/poles/:id/survey — บันทึกสภาพจากการสำรวจหน้างาน
// push เข้า surveys[] + อัปเดตสถานะปัจจุบัน/รูปล่าสุด/ผู้สำรวจล่าสุด
export default async function handler(req, res) {
  const auth = await requireSmartLightAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  await dbConnect();

  const { id } = req.query;
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json({ success: false, message: "รหัสอ้างอิงไม่ถูกต้อง" });
  }

  try {
    const { status, photoUrl, note } = req.body || {};
    if (!SURVEY_STATUS_VALUES.includes(String(status))) {
      return res
        .status(400)
        .json({ success: false, message: "สถานะต้องเป็น ปกติ/ชำรุด/ดับ เท่านั้น" });
    }

    const entry = {
      status: String(status),
      photoUrl: String(photoUrl || ""),
      note: String(note || ""),
      surveyedAt: new Date(),
      surveyedBy: auth.name || "",
      surveyedByClerkId: auth.userId,
    };

    const set = {
      status: entry.status,
      lastSurveyedAt: entry.surveyedAt,
      lastSurveyedBy: entry.surveyedBy,
    };
    if (entry.photoUrl) set.photoUrl = entry.photoUrl; // ไม่มีรูปใหม่ → คงรูปเดิมไว้

    const doc = await StreetLightPole.findByIdAndUpdate(
      id,
      { $push: { surveys: entry }, $set: set },
      { new: true }
    ).lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลเสาไฟ" });
    }
    return res.status(200).json({ success: true, data: doc });
  } catch (error) {
    console.error("smart-light survey POST error:", error);
    return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
  }
}
