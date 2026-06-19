// pages/api/submittedreports/submit-report.js
// Flow เมื่อ user ส่งเรื่องร้องเรียนใหม่:
//  1. บันทึก MongoDB → ได้ complaintId
//  2. return 201 ทันที (user เห็น success dialog เร็ว)
//  3. fire-and-forget (parallel):
//     a. n8n webhook (railway.app) — ส่ง payload พร้อมภาพล่าสุดก่อน
//     b. in-app Notification สำหรับ admin ทุกคนใน appId นี้
//     c. LINE multicast แจ้งเจ้าหน้าที่ (ถ้าตั้ง LINE_ADMIN_USER_IDS)

import dbConnect from "@/lib/dbConnect";
import SubmittedReport from "@/models/SubmittedReport";
import Notification from "@/models/Notification";
import mongoose from "mongoose";
import getNextSequence from "@/lib/getNextSequence";
import { lineMulticast, formatNewComplaintMessage, buildMessages } from "@/lib/lineMessaging";

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

    // n8n อ่าน images[0] — เรียงให้ภาพล่าสุดที่ user เลือก/เปลี่ยนอยู่ index 0
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
    const webhookPayload = { ...reportData, images: orderedImages };

    await Promise.allSettled([

      // a) n8n webhook
      fetch("https://primary-production-a1769.up.railway.app/webhook/submit-tk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      }).then(async (r) => {
        if (!r.ok) {
          const txt = await r.text();
          console.error("🚨 n8n webhook failed:", r.status, txt);
        }
      }),

      // b) in-app Notification — สร้างให้ admin/officer ทุกคนใน appId นี้
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

      // c) LINE multicast แจ้งเจ้าหน้าที่ที่ follow LINE OA แล้ว
      (async () => {
        const adminUserIds = (process.env.LINE_ADMIN_USER_IDS || "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
        if (!adminUserIds.length) return;

        await lineMulticast(
          adminUserIds,
          buildMessages(
            formatNewComplaintMessage({
              complaintId: reportData.complaintId,
              fullName: displayName,
              category: reportData.category,
              detail: reportData.isConfidential ? undefined : reportData.detail,
              community: reportData.community,
              createdAt: reportData.createdAt,
            }),
            firstImage
          )
        );
      })(),

    ]);

  } catch (error) {
    console.error("[submit-report] Error:", error);
    // ส่ง error เฉพาะเมื่อ res ยังไม่ถูก sent
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
}
