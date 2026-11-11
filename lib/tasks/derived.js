// lib/tasks/derived.js
// derived fields ของงานเจ้าหน้าที่ (README § Derived fields) — logic ล้วน ไม่มี I/O
// API (my-kpi / pool) เรียกฟังก์ชันนี้ต่อรายการ แล้วส่งผลลัพธ์ให้ UI ใช้ตรง ๆ — ห้ามคำนวณซ้ำฝั่ง client
//
// นิยาม "วัน" ที่แสดงให้คนอ่าน (ค้าง N วัน / เกินกำหนด N วัน / ครบกำหนดใน N วัน) = วันตามปฏิทินไทย
// เส้นตาย = สิ้นวันตามเวลาไทยของวันครบกำหนด (ครบ 10:00 แต่ตอนนี้ 12:00 ยังนับ "ครบกำหนดวันนี้")
// ส่วน daysAssigned / resolutionDays ยังเป็น floor(ms/วัน) ตามความหมายเดิมของ my-kpi

import { DEFAULT_TASK_SETTINGS, resolveSla } from "./settings";
import { workTypeOf } from "./workTypes";
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
const HOUR_MS = 60 * 60 * 1000;

/** ชั่วโมงเต็มระหว่างสองเวลา (floor, ≥ 0) — null เมื่อขาดค่าใดค่าหนึ่ง */
function hoursBetween(from, to) {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return null;
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / HOUR_MS));
}

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
 * SLA ตาม "ชนิดงาน" (settings.js#resolveSla) — ส่ง complaint (problems/detail/workType/category) มาด้วยเสมอ
 * ส่งแค่ category แบบเดิมก็ยังใช้ได้ (ตรวจชนิดงานจากหมวดอย่างเดียว)
 * @returns {{ dueDate: Date | null, basis: 'stored'|'complaint'|'assignment'|null, slaDays: number, workType: string }}
 */
export function dueDateFor({ storedDueDate, complaintCreatedAt, assignedAt, category, complaint, settings = DEFAULT_TASK_SETTINGS } = {}) {
  const c = complaint ? { ...complaint, category: complaint.category ?? category } : { category };
  const { slaDays, workType } = resolveSla(c, settings);
  const stored = toDate(storedDueDate);
  if (stored) return { dueDate: stored, basis: "stored", slaDays, workType };
  const created = toDate(complaintCreatedAt ?? complaint?.createdAt);
  if (created) return { dueDate: addDays(created, slaDays), basis: "complaint", slaDays, workType };
  const assigned = toDate(assignedAt);
  if (assigned) return { dueDate: addDays(assigned, slaDays), basis: "assignment", slaDays, workType };
  return { dueDate: null, basis: null, slaDays, workType };
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

  const { dueDate: rawDue, basis, slaDays, workType } = dueDateFor({
    storedDueDate: a.dueDate,
    complaintCreatedAt: c.createdAt,
    assignedAt: a.assignedAt,
    complaint: c,
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
  // เวลาจากประชาชนแจ้ง → กดรับ (ชม.เต็ม) — KPI "รับเรื่องภายใน 24 ชม." (มติประชุม 10/11/69)
  const claimHours = hoursBetween(c.createdAt, a.assignedAt);

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
    workType,
    workTypeLabel: workTypeOf(workType)?.label ?? "",
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
    claimHours,
    stage,
    role,
    severity,
    alertKinds,
  };
}

/**
 * derived fields ของเรื่องที่ยังไม่มีคนรับ (กองงานรอรับ)
 * นับเป็นชั่วโมง (มติประชุม 10/11/69 ต้องรับภายใน 24 ชม.) — daysUnclaimed (วันตามปฏิทินไทย) คงไว้ใช้แสดงผล/เรียงลำดับ
 * agingTone: neutral (รอน้อย) → due (≥ unclaimedWarnHours) → overdue (> unclaimedAlertHours = isStale)
 * isUrgent: เลย SLA ทั้งที่ยังไม่มีเจ้าของ → ปุ่ม "รับงานด่วน"
 */
export function deriveUnclaimed({ complaint, settings = DEFAULT_TASK_SETTINGS, now = new Date() } = {}) {
  const c = complaint ?? {};
  const nowD = toDate(now) ?? new Date();
  const createdAt = toDate(c.createdAt);
  const daysUnclaimed = createdAt ? Math.max(0, calendarDaysBetween(createdAt, nowD)) : null;
  const hoursUnclaimed = hoursBetween(createdAt, nowD);
  const warnHours = settings?.unclaimedWarnHours ?? DEFAULT_TASK_SETTINGS.unclaimedWarnHours;
  const alertHours = settings?.unclaimedAlertHours ?? DEFAULT_TASK_SETTINGS.unclaimedAlertHours;
  const isStale = hoursUnclaimed !== null && hoursUnclaimed > alertHours;
  const agingTone = hoursUnclaimed === null ? "neutral" : isStale ? "overdue" : hoursUnclaimed >= warnHours ? "due" : "neutral";

  const { dueDate, slaDays, workType } = dueDateFor({ complaintCreatedAt: createdAt, complaint: c, settings });
  const daysToDue = dueDate ? calendarDaysBetween(nowD, dueDate) : null;
  const isUrgent = daysToDue !== null && daysToDue < 0;

  return {
    daysUnclaimed,
    hoursUnclaimed,
    isStale,
    agingTone,
    slaDays,
    workType,
    workTypeLabel: workTypeOf(workType)?.label ?? "",
    dueDate: dueDate ? dueDate.toISOString() : null,
    daysToDue,
    isUrgent,
  };
}
