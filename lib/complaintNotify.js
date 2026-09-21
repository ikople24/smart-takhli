// lib/complaintNotify.js
// แจ้งเตือนเมื่อสถานะเรื่องร้องเรียนเปลี่ยน — ที่เดียวสำหรับ
//   • pages/api/submittedreports/update-status.js (หน้า manage-complaints / flow เดิม)
//   • pages/api/tasks/[assignmentId].ts (ปิดเรื่องจากหน้าจอ 3 งานเจ้าหน้าที่)
// ห้าม copy logic นี้ไปที่อื่น — ข้อความ/นโยบายความเป็นส่วนตัว (ไม่ใส่ชื่อผู้แจ้งในการ์ดฝั่งประชาชน) ต้องเปลี่ยนที่เดียว
//
// พฤติกรรมคงเดิมจาก update-status.js (2026-08): ส่งการ์ดสถานะให้ผู้แจ้งที่ผูก LINE ไว้ (ปิดงาน = แนบรูปผลงาน +
// วิธีแก้ไข + แถบดาว) และเมื่อปิดงานแจ้งกลุ่ม LINE เจ้าหน้าที่ — ทั้งหมด fire-and-forget ไม่ block response
import mongoose from "mongoose";
import {
  linePush,
  lineNotifyAdminGroup,
  formatStatusMessage,
  formatClosedMessage,
  buildMessages,
} from "@/lib/lineMessaging";
import { findLineRating } from "@/lib/satisfaction/record";

export const CLOSED_STATUS = "ดำเนินการเสร็จสิ้น";

// schema ย่อ inline สำหรับ lookup ชื่อ officer (ธรรมเนียม repo — เลี่ยง model conflict ระหว่าง handlers)
const UserNameSchema = new mongoose.Schema({ name: String }, { collection: "users", strict: false });
const User = () => mongoose.models.User || mongoose.model("User", UserNameSchema);

const firstHttps = (list) => (Array.isArray(list) ? (list.find((u) => u?.startsWith("https://")) ?? null) : null);

/**
 * @param {{
 *   existing: object,               // เอกสารเรื่อง "ก่อน" อัปเดต (lean): lineUserId, images, category, community, fullName, isConfidential, _id
 *   updated: object,                // เอกสารหลังอัปเดต: complaintId (รหัส TKC), updatedAt
 *   status: string,                 // สถานะใหม่
 *   closingAssignment?: object|null // assignment ล่าสุด (lean) — ใช้เมื่อปิดงาน: solutionImages, solution, note, userId
 * }} p
 * คืนทันที (งานส่งทำเบื้องหลัง) — ผู้เรียกไม่ต้อง await
 */
export function notifyComplaintStatusChanged({ existing, updated, status, closingAssignment = null }) {
  if (!existing) return;
  const complaintCode = updated?.complaintId || String(existing._id);

  // ผู้แจ้งที่ผูก LINE กับเรื่องนี้
  if (existing.lineUserId) {
    (async () => {
      // ปิดงาน: ใช้รูปผลงานหลังแก้ไข + แนบรายละเอียดการแก้ไขจาก assignment · สถานะอื่น: ใช้รูปตอนแจ้งตามเดิม
      const solutionImage = status === CLOSED_STATUS ? firstHttps(closingAssignment?.solutionImages) : null;
      const complaintImage = firstHttps(existing.images);

      // เคยให้คะแนนไว้แล้วหรือยัง — เคยแล้วการ์ดจะโชว์คะแนนเดิมแทนปุ่ม (อ่านพลาดต้องไม่ทำให้ส่งไม่ได้)
      const existingRating =
        status === CLOSED_STATUS
          ? await findLineRating({ complaintObjectId: existing._id, lineUserId: existing.lineUserId }).catch((err) => {
              console.error("[LINE] findLineRating failed:", err);
              return null;
            })
          : null;

      await linePush(
        existing.lineUserId,
        buildMessages(
          formatStatusMessage({
            // ไม่ใส่ชื่อผู้แจ้ง — การ์ดฝั่งประชาชนใช้นโยบายเดียวกับเว็บ /status
            // (การผูก lineUserId เป็น first-come จากการพิมพ์เลขเรื่องที่ไล่เดาได้ ปลายทางจึงไม่การันตีว่าเป็นเจ้าของเรื่องจริง)
            complaintId: complaintCode,
            category: existing.category,
            status,
            updatedAt: updated?.updatedAt,
            ...(status === CLOSED_STATUS
              ? {
                  solution: closingAssignment?.solution,
                  note: closingAssignment?.note,
                  // แถบดาวรับเฉพาะเลขเรื่องรูปแบบ TKC-xxxx — ไม่มีเลขเรื่องก็ไม่ต้องแนบแถบดาว
                  ...(updated?.complaintId
                    ? { rating: { complaintCode: updated.complaintId, current: existingRating?.rating ?? null } }
                    : {}),
                }
              : {}),
          }),
          solutionImage ?? complaintImage
        )
      );
    })().catch((err) => console.error("[LINE] Push failed:", err));
  }

  // แจ้งกลุ่ม LINE เจ้าหน้าที่เมื่อปิดงาน
  if (status === CLOSED_STATUS) {
    (async () => {
      try {
        let officerName = "เจ้าหน้าที่";
        if (closingAssignment?.userId) {
          const officer = await User().findById(closingAssignment.userId).select("name").lean();
          if (officer?.name) officerName = officer.name;
        }
        await lineNotifyAdminGroup([
          formatClosedMessage({
            complaintId: complaintCode,
            community: existing.community || "-",
            fullName: existing.isConfidential ? "ไม่เปิดเผย" : existing.fullName || "ไม่ระบุ",
            officerName,
            closedAt: updated?.updatedAt,
          }),
        ]);
      } catch (err) {
        console.error("[LINE] close notify failed:", err);
      }
    })();
  }
}
