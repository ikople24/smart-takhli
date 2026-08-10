// pages/api/submittedreports/submit-report.js
// Flow เมื่อ user ส่งเรื่องร้องเรียนใหม่:
//  1. บันทึก MongoDB → ได้ complaintId
//  2. return 201 ทันที (user เห็น success dialog เร็ว)
//  3. fire-and-forget (parallel):
//     a. in-app Notification สำหรับ admin ทุกคนใน appId นี้
//     b. LINE push แจ้งกลุ่มเจ้าหน้าที่ (LINE_ADMIN_GROUP_ID / ตั้งผ่านหน้า superadmin)

import dbConnect from "@/lib/dbConnect";
import SubmittedReport from "@/models/SubmittedReport";
import Notification from "@/models/Notification";
import mongoose from "mongoose";
import getNextSequence from "@/lib/getNextSequence";
import { lineNotifyAdminGroup, formatNewComplaintMessage, buildMessages } from "@/lib/lineMessaging";

const APP_ID = process.env.NEXT_PUBLIC_APP_ID || "";

// schema ย่อสำหรับ inline query (หลีกเลี่ยง model conflict ระหว่าง handlers)
const UserSchema = new mongoose.Schema(
  { clerkId: String, appId: String, role: String, isArchived: Boolean, isActive: Boolean },
  { collection: "users" }
);
const User = mongoose.models.User || mongoose.model("User", UserSchema);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    await dbConnect();

    const complaintId = await getNextSequence("complaintId");
    const newReport = await SubmittedReport.create({
      ...req.body,
      complaintId,
    });

    // LINE ใช้ภาพแรก — เรียงให้ภาพล่าสุดที่ user เลือก/เปลี่ยนอยู่ index 0
    // (DB ยังเก็บลำดับเดิมตามที่ส่งมา)
    const reportData = newReport.toObject();
    const orderedImages = Array.isArray(reportData.images)
      ? [...reportData.images].filter(Boolean).reverse()
      : [];
    const firstImage = orderedImages[0] || null;

    // ✅ Return 201 ทันที — user ไม่ต้องรอ downstream jobs
    res.status(201).json({ success: true, data: newReport, complaintId });

    // ── Fire-and-forget: ทำต่อหลัง response ส่งไปแล้ว ──────────────────────

    const displayName = reportData.isConfidential ? "ไม่เปิดเผย" : (reportData.fullName || "ไม่ระบุ");

    await Promise.allSettled([

      // a) in-app Notification — สร้างให้ admin/officer ทุกคนใน appId นี้
      (async () => {
        try {
          const admins = await User.find({
            appId: APP_ID,
            isArchived: { $ne: true },
          }).select("clerkId").lean();

          if (!admins.length) return;

          const category = reportData.category || "ทั่วไป";
          const community = reportData.community ? ` (${reportData.community})` : "";

          await Notification.insertMany(
            admins.map((u) => ({
              userId: u.clerkId,
              type: "admin_alert",
              title: `📢 เรื่องร้องเรียนใหม่ #${complaintId}`,
              message: `${displayName} แจ้งปัญหา${community}: ${category}`,
              actionUrl: `/admin/manage-complaints`,
              relatedId: String(newReport._id),
              relatedType: "complaint",
              priority: "high",
            })),
            { ordered: false }  // ถ้า 1 ตัว fail ยังใส่ตัวอื่นต่อ
          );
        } catch (err) {
          console.error("[Notification] Failed to create admin notifications:", err);
        }
      })(),

      // b) LINE push แจ้งกลุ่มเจ้าหน้าที่ — เรื่องลับไม่ส่งชื่อ/เบอร์/รายละเอียด
      lineNotifyAdminGroup(
        buildMessages(
          formatNewComplaintMessage({
            complaintId: reportData.complaintId,
            fullName: displayName,
            phone: reportData.isConfidential ? undefined : reportData.phone,
            category: reportData.category,
            problems: reportData.problems,
            detail: reportData.isConfidential ? undefined : reportData.detail,
            community: reportData.community,
            location: reportData.location,
            createdAt: reportData.createdAt,
          }),
          firstImage
        )
      ),

    ]);

  } catch (error) {
    console.error("[submit-report] Error:", error);
    // ส่ง error เฉพาะเมื่อ res ยังไม่ถูก sent
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
}
