// lib/tasks/digest.js
// สรุปเรื่องค้างไม่มีคนรับรายกอง → แจ้งเตือนในระบบ (กระดิ่ง) ถึงหัวหน้ากอง — logic ล้วน
// ใช้โดย cron pages/api/cron/tasks/stale-digest.ts ตอนเช้า — กระดิ่ง + LINE กลุ่มเจ้าหน้าที่วันละครั้ง
// (เปิด LINE รายวันอีกครั้ง 2026-11-09 หลังอัปเกรด LINE OA เป็น Starter 15,000 ข้อความ/เดือน — เดิม 300 ไม่พอ)
import { departmentShort, normalizeDepartment, UNASSIGNED_DEPARTMENT } from "./departments";
import { isDepartmentHead } from "./roles";

export const UNASSIGNED_DIGEST_KEY = "__unassigned__";
export const STALE_DIGEST_URL = "/admin/task-pool?stale=1";

/**
 * @param {object[]} items รายการจาก loadPoolItems (มี isStale/isUrgent/daysUnclaimed/department)
 * @param {{ unclaimedAlertDays?: number, dateKey: string }} opts dateKey = YYYY-MM-DD ไทย (กันส่งซ้ำวันเดียวกัน)
 */
export function buildStaleDigest(items, { unclaimedAlertDays = 4, dateKey } = {}) {
  const groups = new Map();
  for (const it of (Array.isArray(items) ? items : []).filter((i) => i?.isStale)) {
    const key = it.department || null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  return [...groups]
    .map(([department, list]) => {
      const days = list.map((i) => i.daysUnclaimed).filter((d) => Number.isFinite(d));
      const maxDays = days.length ? Math.max(...days) : null;
      const urgentCount = list.filter((i) => i.isUrgent).length;
      const label = department ? departmentShort(department) : UNASSIGNED_DEPARTMENT;
      return {
        department,
        count: list.length,
        maxDays,
        urgentCount,
        title: `เรื่องค้างไม่มีคนรับ ${list.length} เรื่อง — ${label}`,
        message: `ค้างเกิน ${unclaimedAlertDays} วัน · ค้างนานสุด ${maxDays ?? 0} วัน${urgentCount ? ` · เลย SLA ${urgentCount} เรื่อง` : ""} — กรุณามอบหมายหรือรับงานที่กองงานรอรับ`,
        relatedId: `stale-digest:${dateKey}:${department ?? UNASSIGNED_DIGEST_KEY}`,
        actionUrl: STALE_DIGEST_URL,
      };
    })
    .sort((a, b) => b.count - a.count);
}

const usable = (u) => !!u && u.isActive !== false && u.isArchived !== true && String(u.clerkId ?? "").trim().length > 0;

/**
 * clerkId ของผู้รับแจ้ง: หัวหน้าของกองนั้น → ถ้าไม่มี (หรือยังไม่ระบุกอง) = หัวหน้าทุกกอง + superadmin (role ใน Mongo)
 */
export function digestRecipients(users, department = null) {
  const list = Array.isArray(users) ? users : [];
  const target = department ? (normalizeDepartment(department) ?? department) : null;
  let picked = target ? list.filter((u) => usable(u) && isDepartmentHead(u) && normalizeDepartment(u.department) === target) : [];
  if (!picked.length) picked = list.filter((u) => usable(u) && (isDepartmentHead(u) || u.role === "superadmin"));
  return [...new Set(picked.map((u) => String(u.clerkId).trim()))];
}

/**
 * ผู้รับแจ้ง "ขอโอนงาน" (กรณีรับผิด — นโยบาย 2026-11-09): แอดมินกลาง = superadmin ทุกคน + หัวหน้าของกองนั้น
 * กองนั้นไม่มีหัวหน้า / ไม่ระบุกอง → หัวหน้าทุกกอง + superadmin (เหมือน digestRecipients)
 */
export function transferRequestRecipients(users, department = null) {
  const list = Array.isArray(users) ? users : [];
  const heads = digestRecipients(list, department);
  const supers = list.filter((u) => usable(u) && u.role === "superadmin").map((u) => String(u.clerkId).trim());
  return [...new Set([...heads, ...supers])];
}

export const STALE_LINE_MAX_LINES = 6;

/**
 * ข้อความ LINE กลุ่ม "เรื่องค้างไม่มีคนรับ" — ใช้ร่วมระหว่างปุ่มแจ้งเตือน (pool-alert) และ cron ตอนเช้า
 * @param {object[]} items รายการจาก loadPoolItems
 * @param {{ unclaimedAlertDays?: number, footer?: string }} opts
 * @returns {string | null} null = ไม่มีเรื่องค้างเกินเกณฑ์ (ไม่ต้องส่ง)
 */
export function buildStaleLineText(items, { unclaimedAlertDays = 4, footer = "" } = {}) {
  const list = Array.isArray(items) ? items : [];
  const stale = list.filter((i) => i?.isStale).sort((a, b) => (b.daysUnclaimed ?? 0) - (a.daysUnclaimed ?? 0));
  if (!stale.length) return null;
  const urgent = list.filter((i) => i?.isUrgent).length;
  const lines = [
    `📥 กองงานรอรับ — ค้างไม่มีคนรับเกิน ${unclaimedAlertDays} วัน ${stale.length} เรื่อง${urgent ? ` (เลย SLA ${urgent})` : ""}`,
    ...stale
      .slice(0, STALE_LINE_MAX_LINES)
      .map(
        (i) =>
          `• ${i.code ?? String(i._id ?? "").slice(-6)} ค้าง ${i.daysUnclaimed} วัน · ${i.category || "-"} · ${i.community || "-"}${
            i.department ? ` → ${departmentShort(i.department)}` : " → ยังไม่ระบุกอง"
          }`
      ),
    stale.length > STALE_LINE_MAX_LINES ? `…และอีก ${stale.length - STALE_LINE_MAX_LINES} เรื่อง` : null,
    footer || null,
  ];
  return lines.filter(Boolean).join("\n");
}
