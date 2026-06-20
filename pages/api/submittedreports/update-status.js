// /pages/api/submittedreports/update-status.js
import dbConnect from "@/lib/dbConnect";
import SubmittedReport from "@/models/SubmittedReport";
import Assignment from "@/models/Assignment";
import mongoose from "mongoose";
import { n8n } from "@/lib/n8nWebhook";
import { logAuditEvent } from "@/lib/auditLogger";
import { linePush, formatStatusMessage, buildMessages } from "@/lib/lineMessaging";
import { getAuth } from "@clerk/nextjs/server";

// สถานะที่ถือว่า "ปิดงาน" — ตรงกับปุ่มปิดเรื่องใน manage-complaints.jsx
const CLOSED_STATUS = "ดำเนินการเสร็จสิ้น";
// webhook แจ้งกลุ่ม Telegram เมื่อปิดงาน (n8n "Api All" → node close-tk)
const CLOSE_WEBHOOK_URL = "https://primary-production-a1769.up.railway.app/webhook/close-tk";

// schema ย่อ inline สำหรับ lookup ชื่อ officer (เลี่ยง model conflict ระหว่าง handlers)
const UserNameSchema = new mongoose.Schema({ name: String }, { collection: "users", strict: false });
const User = mongoose.models.User || mongoose.model("User", UserNameSchema);

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "PUT") {
    const { complaintId, status } = req.body;
    const { userId } = getAuth(req);

    try {
      // ดึงสถานะเดิมก่อน update เพื่อส่งใน audit log และ n8n
      const existing = await SubmittedReport.findById(complaintId).lean();
      const oldStatus = existing?.status || "";

      const updated = await SubmittedReport.findOneAndUpdate(
        { _id: complaintId },
        // Ensure close time is recorded when status changes.
        { status, updatedAt: new Date() },
        { new: true }
      );

      if (!updated) return res.status(404).json({ message: "ไม่พบข้อมูล" });

      // Audit log + n8n (fire-and-forget)
      if (userId) {
        logAuditEvent({
          actorClerkId: userId,
          actorName: "admin",
          action: "complaint_status_changed",
          resourceType: "complaint",
          resourceId: String(complaintId),
          description: `สถานะเรื่องร้องเรียนเปลี่ยนจาก "${oldStatus}" เป็น "${status}"`,
          before: { status: oldStatus },
          after: { status },
        });
      }

      n8n.complaintStatusChanged({
        complaintId: String(complaintId),
        fullName: existing?.fullName || "",
        oldStatus,
        newStatus: status,
        changedBy: userId || "admin",
      });

      // LINE push notification — ถ้า user เคยติดต่อผ่าน LINE Bot มาก่อน
      if (existing?.lineUserId) {
        // ใช้ภาพแรกใน array ของ DB (images[0])
        const firstImage = Array.isArray(existing.images)
          ? (existing.images.find((u) => u?.startsWith("https://")) ?? null)
          : null;

        linePush(
          existing.lineUserId,
          buildMessages(
            formatStatusMessage({
              complaintId: updated.complaintId || String(complaintId),
              fullName: existing.isConfidential ? "ไม่เปิดเผย" : (existing.fullName || ""),
              category: existing.category,
              status,
              updatedAt: updated.updatedAt,
            }),
            firstImage
          )
        ).catch((err) => console.error("[LINE] Push failed:", err));
      }

      // แจ้งกลุ่ม Telegram เมื่อปิดงาน — fire-and-forget (ไม่ block response, ไม่โยน error ถ้า n8n ล่ม)
      if (status === CLOSED_STATUS) {
        (async () => {
          try {
            let officerName = "เจ้าหน้าที่";
            const assignment = await Assignment.findOne({ complaintId })
              .sort({ assignedAt: -1 })
              .lean();
            if (assignment?.userId) {
              const officer = await User.findById(assignment.userId).select("name").lean();
              if (officer?.name) officerName = officer.name;
            }

            const r = await fetch(CLOSE_WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                complaintId: updated.complaintId || String(complaintId),
                community: existing?.community || "-",
                fullName: existing?.isConfidential ? "ไม่เปิดเผย" : (existing?.fullName || "ไม่ระบุ"),
                officerName,
              }),
            });
            if (!r.ok) console.error("🚨 close-tk webhook failed:", r.status, await r.text());
          } catch (err) {
            console.error("[close-tk] notify failed:", err);
          }
        })();
      }

      res.status(200).json(updated);
    } catch (err) {
      res.status(500).json({ message: "เกิดข้อผิดพลาด", error: err.message });
    }
  } else {
    res.status(405).json({ message: "Method Not Allowed" });
  }
}