// lib/tasks/derived.js
// derived fields ของงานเจ้าหน้าที่ (README § Derived fields) — logic ล้วน ไม่มี I/O
// API (my-kpi / pool) เรียกฟังก์ชันนี้ต่อรายการ แล้วส่งผลลัพธ์ให้ UI ใช้ตรง ๆ — ห้ามคำนวณซ้ำฝั่ง client
//
// นิยาม "วัน" ที่แสดงให้คนอ่าน (ค้าง N วัน / เกินกำหนด N วัน / ครบกำหนดใน N วัน) = วันตามปฏิทินไทย
// เส้นตาย = สิ้นวันตามเวลาไทยของวันครบกำหนด (ครบ 10:00 แต่ตอนนี้ 12:00 ยังนับ "ครบกำหนดวันนี้")
// ส่วน daysAssigned / resolutionDays ยังเป็น floor(ms/วัน) ตามความหมายเดิมของ my-kpi

import { DEFAULT_TASK_SETTINGS, slaDaysFor } from "./settings";
import { toDate, calendarDaysBetween, daysBetween, DAY_MS } from "./format";
import { isClosedStatus, normalizeStage } from "./status";

/** ลำดับความรุนแรง — ใช้เลือกสีแถบซ้าย / เรียงลำดับ */
export const SEVERITY_ORDER = Object.freeze(["overdue", "due_soon", "coordinating", "blocked", "normal", "done"]);

export function severityOf({ isCompleted, isOverdue, isDueSoon, needsCoordination, isBlocked } = {}) {
  if (isCompleted) return "done";
  if (isOverdue) return "overdue";
  if (isDueSoon) return "due_soon";
  if (needsCoordination) return "coordinating";
  if (isBlocked) return "blocked";
  return "normal";
}

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

function latestDate(...values) {
  let best = null;
  for (const v of values) {
    const d = toDate(v);
    if (d && (!best || d.getTime() > best.getTime())) best = d;
  }
  return best;
}

/**
 * วันครบกำหนด: ค่าที่บันทึกบน assignment → วันที่ประชาชนแจ้ง + SLA → วันที่รับงาน + SLA
 * (SLA นับจากวันแจ้ง เพราะเป็นคำมั่นต่อประชาชน — เรื่องที่ค้างไม่มีคนรับหลายวันจึงมาถึงมือพร้อมเวลาที่เหลือน้อย ตั้งใจให้เป็นแบบนั้น)
 * @returns {{ dueDate: Date | null, basis: 'stored'|'complaint'|'assignment'|null, slaDays: number }}
 */
export function dueDateFor({ storedDueDate, complaintCreatedAt, assignedAt, category, settings = DEFAULT_TASK_SETTINGS } = {}) {
  const slaDays = slaDaysFor(category, settings);
  const stored = toDate(storedDueDate);
  if (stored) return { dueDate: stored, basis: "stored", slaDays };
  const created = toDate(complaintCreatedAt);
  if (created) return { dueDate: addDays(created, slaDays), basis: "complaint", slaDays };
  const assigned = toDate(assignedAt);
  if (assigned) return { dueDate: addDays(assigned, slaDays), basis: "assignment", slaDays };
  return { dueDate: null, basis: null, slaDays };
}

/** เลื่อนวันครบกำหนดด้วยเวลาที่พัก SLA: ช่วงที่จบแล้ว (slaPausedMs) + ช่วงที่ยังพักอยู่ (slaPausedAt → now) */
export function effectiveDueDate(dueDate, { slaPausedAt, slaPausedMs = 0, now = new Date() } = {}) {
  const due = toDate(dueDate);
  if (!due) return null;
  const pausedAt = toDate(slaPausedAt);
  const nowD = toDate(now) ?? new Date();
  const openPause = pausedAt ? Math.max(0, nowD.getTime() - pausedAt.getTime()) : 0;
  const closedPause = Number.isFinite(Number(slaPausedMs)) ? Math.max(0, Number(slaPausedMs)) : 0;
  return new Date(due.getTime() + closedPause + openPause);
}

/**
 * derived fields ของ assignment หนึ่งรายการ
 * @param {{ assignment?: object, complaint?: object, settings?: object, now?: Date | string | number }} p
 */
export function deriveAssignment({ assignment, complaint, settings = DEFAULT_TASK_SETTINGS, now = new Date() } = {}) {
  const a = assignment ?? {};
  const c = complaint ?? {};
  const nowD = toDate(now) ?? new Date();
  const warnBeforeDays = settings?.warnBeforeDays ?? DEFAULT_TASK_SETTINGS.warnBeforeDays;

  const completedAt = toDate(a.completedAt);
  // เรื่องอาจถูกปิดจากหน้า manage-complaints (เปลี่ยน status) โดย assignment ไม่มี completedAt
  const isCompleted = !!completedAt || isClosedStatus(c.status);

  const { dueDate: rawDue, basis, slaDays } = dueDateFor({
    storedDueDate: a.dueDate,
    complaintCreatedAt: c.createdAt,
    assignedAt: a.assignedAt,
    category: c.category,
    settings,
  });
  const pausedAt = toDate(a.slaPausedAt);
  const isPaused = !isCompleted && !!pausedAt;
  // งานที่เสร็จแล้วคิดช่วงพักถึงตอนเสร็จ ไม่ใช่ตอนนี้ (ไม่งั้นวันครบกำหนดของงานเก่าเลื่อนเรื่อย ๆ)
  const refNow = isCompleted && completedAt ? completedAt : nowD;
  const dueDate = effectiveDueDate(rawDue, { slaPausedAt: pausedAt, slaPausedMs: a.slaPausedMs, now: refNow });

  const daysToDue = dueDate ? calendarDaysBetween(nowD, dueDate) : null;
  const isOverdue = !isCompleted && !isPaused && daysToDue !== null && daysToDue < 0;
  const overdueDays = isOverdue ? -daysToDue : 0;
  const isDueSoon = !isCompleted && !isPaused && !isOverdue && daysToDue !== null && daysToDue <= warnBeforeDays;

  // ประสานหน่วยงานภายนอก
  const coord = a.coordination ?? {};
  const agencyName = String(coord.agencyName ?? "").trim();
  const needsCoordination = !isCompleted && agencyName.length > 0;
  const followUps = Array.isArray(coord.followUps) ? coord.followUps : [];
  const lastFollowUpAt = latestDate(...followUps.map((f) => f?.at));
  const waitFrom = lastFollowUpAt ?? toDate(coord.sentAt);
  const coordinationWaitDays = needsCoordination && waitFrom ? calendarDaysBetween(waitFrom, nowD) : null;
  const nextFollowUpAt = toDate(coord.nextFollowUpAt);
  const followUpDue = needsCoordination && !!nextFollowUpAt && calendarDaysBetween(nowD, nextFollowUpAt) <= 0;

  // รอวัสดุ / งบประมาณ (พัก SLA)
  const blocked = a.blocked ?? {};
  const isBlocked = !isCompleted && blocked.isBlocked === true;
  const blockedSince = toDate(blocked.since) ?? pausedAt;
  const blockedDays = isBlocked && blockedSince ? calendarDaysBetween(blockedSince, nowD) : null;

  // ความสดของงาน — ใช้เตือน "ต้องอัปเดตความคืบหน้าวันนี้"
  const timeline = Array.isArray(a.timeline) ? a.timeline : [];
  const lastActivityAt = latestDate(a.updatedAt, a.assignedAt, completedAt, ...timeline.map((t) => t?.at));
  const daysSinceUpdate = lastActivityAt ? calendarDaysBetween(lastActivityAt, nowD) : null;

  const daysAssigned = daysBetween(a.assignedAt, nowD);
  const resolutionDays = completedAt ? daysBetween(a.assignedAt, completedAt) : null;
  const completedLate = completedAt && dueDate ? calendarDaysBetween(dueDate, completedAt) > 0 : null;

  const stage = normalizeStage(a.stage, { completed: isCompleted });
  const role = a.role === "coordinator" ? "coordinator" : "assignee";
  const severity = severityOf({ isCompleted, isOverdue, isDueSoon, needsCoordination, isBlocked });

  // เรื่องเดียวมีได้หลายป้าย (เกินกำหนด + ต้องประสาน) — การ์ดเตือนหน้าจอ 1 กรองด้วยชุดนี้
  const alertKinds = [];
  if (!isCompleted) {
    if (isOverdue) alertKinds.push("overdue");
    if (isDueSoon) alertKinds.push("due_soon");
    if (needsCoordination) alertKinds.push("coordinating");
    if (isBlocked) alertKinds.push("blocked");
  }

  return {
    slaDays,
    dueDate: dueDate ? dueDate.toISOString() : null,
    dueBasis: basis,
    daysToDue,
    isCompleted,
    isPaused,
    isOverdue,
    overdueDays,
    isDueSoon,
    needsCoordination,
    agencyName: agencyName || null,
    coordinationWaitDays,
    followUpDue,
    isBlocked,
    blockedDays,
    lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
    daysSinceUpdate,
    daysAssigned,
    resolutionDays,
    completedLate,
    stage,
    role,
    severity,
    alertKinds,
  };
}

/**
 * derived fields ของเรื่องที่ยังไม่มีคนรับ (กองงานรอรับ)
 * agingTone: neutral (ค้างน้อย) → due (≥ unclaimedWarnDays) → overdue (> unclaimedAlertDays = isStale)
 * isUrgent: เลย SLA ทั้งที่ยังไม่มีเจ้าของ → ปุ่ม "รับงานด่วน"
 */
export function deriveUnclaimed({ complaint, settings = DEFAULT_TASK_SETTINGS, now = new Date() } = {}) {
  const c = complaint ?? {};
  const nowD = toDate(now) ?? new Date();
  const createdAt = toDate(c.createdAt);
  const daysUnclaimed = createdAt ? Math.max(0, calendarDaysBetween(createdAt, nowD)) : null;
  const warnDays = settings?.unclaimedWarnDays ?? DEFAULT_TASK_SETTINGS.unclaimedWarnDays;
  const alertDays = settings?.unclaimedAlertDays ?? DEFAULT_TASK_SETTINGS.unclaimedAlertDays;
  const isStale = daysUnclaimed !== null && daysUnclaimed > alertDays;
  const agingTone = daysUnclaimed === null ? "neutral" : isStale ? "overdue" : daysUnclaimed >= warnDays ? "due" : "neutral";

  const { dueDate, slaDays } = dueDateFor({ complaintCreatedAt: createdAt, category: c.category, settings });
  const daysToDue = dueDate ? calendarDaysBetween(nowD, dueDate) : null;
  const isUrgent = daysToDue !== null && daysToDue < 0;

  return {
    daysUnclaimed,
    isStale,
    agingTone,
    slaDays,
    dueDate: dueDate ? dueDate.toISOString() : null,
    daysToDue,
    isUrgent,
  };
}
