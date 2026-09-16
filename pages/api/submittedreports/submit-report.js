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
import { consentForPayload, ACCEPTED_AT_MAX_SKEW_MS } from "@/lib/citizen/report/consent";
import { KNOWN_CONSENT_VERSIONS } from "@/lib/citizen/report/consentContent";

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

    // ข้อมูลยินยอมที่เพี้ยนต้องไม่ทำให้เรื่องร้องเรียนทั้งเรื่องบันทึกไม่สำเร็จ
    // (client มี guard แล้ว แต่ endpoint นี้เป็นทางเขียนสาธารณะ ต้องกันฝั่งเซิร์ฟเวอร์ด้วย)
    const { consent: rawConsent, ...rest } = req.body || {};

    // consentForPayload คุมแค่ "รูปร่าง" ของข้อมูล ส่วน consent log (validateConsentLog) คุมอีก 2 ชั้น คือ
    // เลขฉบับต้องเป็นฉบับที่เซิร์ฟเวอร์รู้จัก และเวลาต้องไม่ห่างจากเวลาเซิร์ฟเวอร์เกิน ACCEPTED_AT_MAX_SKEW_MS
    // ถ้าไม่บังคับกติกาเดียวกันตรงนี้ เครื่องที่นาฬิกาเพี้ยนจะได้แถวใน report_consent_logs ที่ถูก
    // แต่ได้ฟิลด์ consent บนตัวเรื่องร้องเรียนที่ผิด — ทั้งที่ฟิลด์นี้คือค่าที่เจ้าหน้าที่เปิดดูจริง
    //
    // ตัดสินแล้วว่า: เวลาเพี้ยน = "หนีบ" ให้เป็นเวลาเซิร์ฟเวอร์ ไม่ใช่ทิ้งทั้งก้อน เพราะการยอมรับเกิดขึ้นจริง
    // เสียแค่ความแม่นของเวลา (ตรงกับที่ validateConsentLog ทำกับ log) · ส่วนเลขฉบับที่ไม่รู้จัก = ทิ้งทั้งก้อน
    // เพราะบอกไม่ได้ว่าผู้ใช้เห็นเอกสารฉบับไหน หลักฐานที่อ่านแล้วเข้าใจผิดแย่กว่าไม่มีหลักฐาน
    // (ฝั่งเบราว์เซอร์ไม่แตะ — ค่าที่เก็บในเครื่องยังเป็นของเดิม)
    let consent = consentForPayload(rawConsent);
    if (consent && !KNOWN_CONSENT_VERSIONS.includes(consent.version)) consent = null;
    if (consent) {
      const nowMs = Date.now();
      const acceptedMs = new Date(consent.acceptedAt).getTime(); // consentForPayload การันตีแล้วว่า parse ได้
      if (Math.abs(acceptedMs - nowMs) > ACCEPTED_AT_MAX_SKEW_MS) {
        consent = { ...consent, acceptedAt: new Date(nowMs).toISOString() };
      }
    }

    const newReport = await SubmittedReport.create({
      ...rest,
      ...(consent ? { consent } : {}),
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
