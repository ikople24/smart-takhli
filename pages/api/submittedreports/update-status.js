// /pages/api/submittedreports/update-status.js
import dbConnect from "@/lib/dbConnect";
import SubmittedReport from "@/models/SubmittedReport";
import { n8n } from "@/lib/n8nWebhook";
import { logAuditEvent } from "@/lib/auditLogger";
import { linePush, formatStatusMessage, buildMessages } from "@/lib/lineMessaging";
import { getAuth } from "@clerk/nextjs/server";

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

      res.status(200).json(updated);
    } catch (err) {
      res.status(500).json({ message: "เกิดข้อผิดพลาด", error: err.message });
    }
  } else {
    res.status(405).json({ message: "Method Not Allowed" });
  }
}