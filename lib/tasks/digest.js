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
 * เขียนให้คนทั่วไปอ่านรู้เรื่อง (2026-11-10): ไม่ใช้คำ "SLA", ไม่โชว์กองที่ระบบเดา (ทุกกองรับได้ — PR #174),
 * บอกประเภทปัญหา + ชุมชน + ลิงก์กดรับงาน
 * @param {object[]} items รายการจาก loadPoolItems
 * @param {{ unclaimedAlertDays?: number, footer?: string, siteUrl?: string }} opts siteUrl = https://… (ไม่มี → ไม่ใส่ลิงก์)
 * @returns {string | null} null = ไม่มีเรื่องค้างเกินเกณฑ์ (ไม่ต้องส่ง)
 */
export function buildStaleLineText(items, { unclaimedAlertDays = 4, footer = "", siteUrl = "" } = {}) {
  const list = Array.isArray(items) ? items : [];
  const stale = list.filter((i) => i?.isStale).sort((a, b) => (b.daysUnclaimed ?? 0) - (a.daysUnclaimed ?? 0));
  if (!stale.length) return null;
  const overdue = stale.filter((i) => i?.isUrgent).length;
  const base = String(siteUrl || "").replace(/\/+$/, "");
  const link = base.startsWith("https://") ? `${base}/admin/task-pool` : null;

  // ประเภทกว้าง ๆ ไม่บอกว่าเรื่องอะไร → ใช้รายละเอียดย่อแทน
  const VAGUE = /^(อื่นๆ|ขอความอนุเคราะห์|ร้องเรียนร้องทุกข์|ติดต่อหน่วยงาน)/;
  const short = (t, n = 40) => {
    const v = String(t || "").replace(/\s+/g, " ").trim();
    return v.length > n ? `${v.slice(0, n).trim()}…` : v;
  };
  const what = (i) => {
    const problems = Array.isArray(i.problems) ? i.problems.filter((p) => p && !VAGUE.test(p)) : [];
    if (problems.length) return problems.join(", ");
    return short(i.title) || i.category || "ไม่ระบุประเภท";
  };
  const items_ = stale.slice(0, STALE_LINE_MAX_LINES).flatMap((i, n) => [
    `${n + 1}) ${i.code ?? String(i._id ?? "").slice(-6)} — รอ ${i.daysUnclaimed} วัน`,
    `    ${what(i)}${i.community ? ` · ชุมชน${i.community}` : ""}`,
  ]);

  const lines = [
    "📋 เรื่องร้องเรียนที่ยังไม่มีเจ้าหน้าที่รับ",
    `รวม ${stale.length} เรื่อง (รอเกิน ${unclaimedAlertDays} วัน)`,
    overdue ? (overdue === stale.length ? "⚠️ ทุกเรื่องเลยกำหนดแก้ไขแล้ว" : `⚠️ เลยกำหนดแก้ไขแล้ว ${overdue} เรื่อง`) : null,
    "",
    "รอนานที่สุด:",
    ...items_,
    stale.length > STALE_LINE_MAX_LINES ? `…และอีก ${stale.length - STALE_LINE_MAX_LINES} เรื่อง` : null,
    "",
    "👉 เจ้าหน้าที่ทุกกองกด \"รับงาน\" ได้เลย",
    link ? link : 'ที่เมนู "กองงานรอรับ"',
    "รับแล้วเรื่องจะย้ายเข้ากองของผู้รับ · รับผิดเรื่องกด \"คืนงาน\" ในหน้างาน",
    footer ? "" : null,
    footer || null,
  ];
  return lines.filter((l) => l !== null).join("\n");
}
