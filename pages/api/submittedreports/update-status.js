// /pages/api/submittedreports/update-status.js
import dbConnect from "@/lib/dbConnect";
import SubmittedReport from "@/models/SubmittedReport";
import Assignment from "@/models/Assignment";
import mongoose from "mongoose";
import { logAuditEvent } from "@/lib/auditLogger";
import {
  linePush,
  lineNotifyAdminGroup,
  formatStatusMessage,
  formatClosedMessage,
  buildMessages,
} from "@/lib/lineMessaging";
import { getAuth } from "@clerk/nextjs/server";

// สถานะที่ถือว่า "ปิดงาน" — ตรงกับปุ่มปิดเรื่องใน manage-complaints.jsx
const CLOSED_STATUS = "ดำเนินการเสร็จสิ้น";

// schema ย่อ inline สำหรับ lookup ชื่อ officer (เลี่ยง model conflict ระหว่าง handlers)
const UserNameSchema = new mongoose.Schema({ name: String }, { collection: "users", strict: false });
const User = mongoose.models.User || mongoose.model("User", UserNameSchema);

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "PUT") {
    const { complaintId, status } = req.body;
    const { userId } = getAuth(req);

    try {
      // ดึงสถานะเดิมก่อน update เพื่อส่งใน audit log
      const existing = await SubmittedReport.findById(complaintId).lean();
      const oldStatus = existing?.status || "";

      // Guard: ปิดเรื่องไม่ได้ถ้ายังไม่ได้รับมอบหมาย (ตรงกับ UI ที่ซ่อนปุ่ม "ปิดเรื่อง"
      // จนกว่าจะรับเรื่อง) — ปิดช่องโหว่กรณียิง API ตรงโดยข้าม UI. query ครั้งเดียว
      // แล้ว reuse ตอนดึงชื่อ officer ในบล็อกแจ้งเตือนด้านล่าง
      let closingAssignment = null;
      if (status === CLOSED_STATUS) {
        closingAssignment = await Assignment.findOne({ complaintId })
          .sort({ assignedAt: -1 })
          .lean();
        if (!closingAssignment) {
          return res.status(400).json({ message: "ปิดเรื่องไม่ได้: เรื่องนี้ยังไม่ได้รับมอบหมาย" });
        }
      }

      const updated = await SubmittedReport.findOneAndUpdate(
        { _id: complaintId },
        // Ensure close time is recorded when status changes.
        { status, updatedAt: new Date() },
        { new: true }
      );

      if (!updated) return res.status(404).json({ message: "ไม่พบข้อมูล" });

      // Audit log (fire-and-forget)
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

      // LINE push notification — ถ้า user เคยติดต่อผ่าน LINE Bot มาก่อน
      if (existing?.lineUserId) {
        // ปิดงาน: ใช้รูปผลงานหลังแก้ไข + แนบรายละเอียดการแก้ไขจาก assignment
        // สถานะอื่น: ใช้รูปตอนแจ้งตามเดิม
        const solutionImage =
          status === CLOSED_STATUS && Array.isArray(closingAssignment?.solutionImages)
            ? (closingAssignment.solutionImages.find((u) => u?.startsWith("https://")) ?? null)
            : null;
        const complaintImage = Array.isArray(existing.images)
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
              ...(status === CLOSED_STATUS
                ? { solution: closingAssignment?.solution, note: closingAssignment?.note }
                : {}),
            }),
            solutionImage ?? complaintImage
          )
        ).catch((err) => console.error("[LINE] Push failed:", err));
      }

      // แจ้งกลุ่ม LINE เจ้าหน้าที่เมื่อปิดงาน — fire-and-forget (ไม่ block response)
      if (status === CLOSED_STATUS) {
        (async () => {
          try {
            let officerName = "เจ้าหน้าที่";
            // reuse assignment ที่ guard ดึงไว้แล้ว (status นี้การันตีว่ามี assignment)
            if (closingAssignment?.userId) {
              const officer = await User.findById(closingAssignment.userId).select("name").lean();
              if (officer?.name) officerName = officer.name;
            }

            await lineNotifyAdminGroup([
              formatClosedMessage({
                complaintId: updated.complaintId || String(complaintId),
                community: existing?.community || "-",
                fullName: existing?.isConfidential ? "ไม่เปิดเผย" : (existing?.fullName || "ไม่ระบุ"),
                officerName,
                closedAt: updated.updatedAt,
              }),
            ]);
          } catch (err) {
            console.error("[LINE] close notify failed:", err);
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