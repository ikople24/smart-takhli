// lib/tasks/digest.js
// สรุปเรื่องค้างไม่มีคนรับรายกอง → แจ้งเตือนในระบบ (กระดิ่ง) ถึงหัวหน้ากอง — logic ล้วน
// ใช้โดย cron pages/api/cron/tasks/stale-digest.ts ตอนเช้า · ไม่ส่ง LINE รายวัน (โควตา 300/เดือน — กลุ่ม 11 คน × 30 วันหมดพอดี)
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
