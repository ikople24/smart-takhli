// lib/flood-relief/notify.ts (server-only)
// แจ้ง LINE ของโมดูลศูนย์ช่วยเหลือน้ำท่วม — **ที่เดียว** (README § LINE) ห้าม copy ไปเรียก linePush เองที่อื่น
// ทุกฟังก์ชัน fire-and-forget: คืนทันที ล้มแค่ log — การส่งคำขอของผู้ประสบภัยต้องไม่ล้มเพราะ LINE
// ⚠️ โควตา LINE OA 300 ข้อความ/เดือน นับตามจำนวนผู้รับ × ครั้ง — แจ้งกลุ่มครั้งละ 1 ข้อความเท่านั้น

import { lineNotifyAdminGroup } from "@/lib/lineMessaging";
import { formatNewRequestText, type NewRequestSummary } from "./notifyText";

/** ลิงก์เปิดคำขอในแดชบอร์ด — ต้องตั้ง NEXT_PUBLIC_SITE_URL (ไม่เชื่อ Host header เพราะปลอมได้) */
function dashboardUrl(ticket: string): string | null {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  return base.startsWith("https://") ? `${base}/admin/flood-relief?ticket=${encodeURIComponent(ticket)}` : null;
}

export function notifyNewRequest(r: NewRequestSummary): void {
  const text = formatNewRequestText(r, dashboardUrl(r.ticket));
  lineNotifyAdminGroup([{ type: "text", text }]).catch((err) =>
    console.error("[flood-relief] LINE group notify failed:", err)
  );
}
