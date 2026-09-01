// /pages/api/submittedreports/update-status.js
import dbConnect from "@/lib/dbConnect";
import SubmittedReport from "@/models/SubmittedReport";
import Assignment from "@/models/Assignment";
import { logAuditEvent } from "@/lib/auditLogger";
import { getAuth } from "@clerk/nextjs/server";
// การแจ้งเตือน LINE (ผู้แจ้ง + กลุ่มเจ้าหน้าที่) อยู่ที่เดียวใน lib/complaintNotify.js — ใช้ร่วมกับหน้าจอ 3 งานเจ้าหน้าที่
import { notifyComplaintStatusChanged, CLOSED_STATUS } from "@/lib/complaintNotify";

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

      // แจ้งเตือน LINE ผู้แจ้ง (ถ้าผูกไว้) + กลุ่มเจ้าหน้าที่เมื่อปิดงาน — fire-and-forget (ไม่ block response)
      notifyComplaintStatusChanged({ existing, updated, status, closingAssignment });

      res.status(200).json(updated);
    } catch (err) {
      res.status(500).json({ message: "เกิดข้อผิดพลาด", error: err.message });
    }
  } else {
    res.status(405).json({ message: "Method Not Allowed" });
  }
}