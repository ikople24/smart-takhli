// lib/flood-relief/notify.ts (server-only)
// แจ้ง LINE ของโมดูลศูนย์ช่วยเหลือน้ำท่วม — **ที่เดียว** (README § LINE) ห้าม copy ไปเรียก linePush เองที่อื่น
// ทุกฟังก์ชัน fire-and-forget: คืนทันที ล้มแค่ log — การส่งคำขอของผู้ประสบภัยต้องไม่ล้มเพราะ LINE
// ⚠️ โควตา LINE OA 300 ข้อความ/เดือน นับตามจำนวนผู้รับ × ครั้ง — แจ้งกลุ่มครั้งละ 1 ข้อความเท่านั้น

import { lineNotifyAdminGroup, linePush } from "@/lib/lineMessaging";
import {
  formatNewRequestFlex,
  formatReporterStatusText,
  formatTeamAssignFlex,
  type NewRequestSummary,
  type TeamAssignSummary,
} from "./notifyText";

/** ลิงก์เปิดคำขอในแดชบอร์ด — ต้องตั้ง NEXT_PUBLIC_SITE_URL (ไม่เชื่อ Host header เพราะปลอมได้) */
function dashboardUrl(ticket: string): string | null {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  return base.startsWith("https://") ? `${base}/admin/flood-relief?ticket=${encodeURIComponent(ticket)}` : null;
}

export function notifyNewRequest(r: NewRequestSummary): void {
  // บล็อกพิเศษ (Flex) เข้ากลุ่มเจ้าหน้าที่ smart-takhli เดิม (getAdminGroupId) — ไม่มีกลุ่มศูนย์ฯ แยก
  lineNotifyAdminGroup([formatNewRequestFlex(r, dashboardUrl(r.ticket))]).catch((err) =>
    console.error("[flood-relief] LINE group notify failed:", err)
  );
}

/** แจ้งทีมที่ถูกมอบหมายเข้ากลุ่ม LINE ของทีม — ทีมยังไม่ตั้ง lineGroupId = ข้าม */
export function notifyTeamAssigned(lineGroupId: string | null | undefined, r: TeamAssignSummary): void {
  if (!lineGroupId) return;
  linePush(lineGroupId, [formatTeamAssignFlex(r)]).catch((err) =>
    console.error("[flood-relief] LINE team notify failed:", err)
  );
}

/** แจ้งผู้แจ้งที่เชื่อม LINE ไว้ เฉพาะ ออกเดินทาง / ถึงจุด / เสร็จสิ้น */
export function notifyReporterStatus(lineUserId: string | null | undefined, ticket: string, status: string): void {
  if (!lineUserId) return;
  const text = formatReporterStatusText(ticket, status);
  if (!text) return;
  linePush(lineUserId, [{ type: "text", text }]).catch((err) =>
    console.error("[flood-relief] LINE reporter notify failed:", err)
  );
}
