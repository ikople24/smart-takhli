// lib/tasks/derived.js
// derived fields ของงานเจ้าหน้าที่ (README § Derived fields) — logic ล้วน ไม่มี I/O
// API (my-kpi / pool) เรียกฟังก์ชันนี้ต่อรายการ แล้วส่งผลลัพธ์ให้ UI ใช้ตรง ๆ — ห้ามคำนวณซ้ำฝั่ง client
//
// กำหนดปิดเรื่อง (slaDays) นับเป็น "วันทำการ" จ.–ศ. ไม่รวมวันหยุดราชการ (settings.holidays) — lib/tasks/businessDays.js
// → dueDate · daysToDue · overdueDays · isDueSoon (warnBeforeDays) · isUrgent นับวันทำการทั้งหมด
// เส้นตาย = สิ้นวันตามเวลาไทยของวันครบกำหนด (dueDate ที่คำนวณใหม่คือ 23:59:59.999 ไทย · ค่าเก่าที่บันทึกเป็นเวลาอื่น
//   ก็ตัดสินด้วย "วันไทย" เหมือนกัน — ครบ 10:00 แต่ตอนนี้ 12:00 ยังนับ "ครบกำหนดวันนี้")
// ช่วงพัก SLA เลื่อนเส้นตายเป็น "วันทำการ" (effectiveDueDate) แล้วยึดสิ้นวันไทย — พัก 1 นาทีไม่เลื่อน · พักข้ามเสาร์อาทิตย์ไม่ได้วันฟรี
// เกณฑ์ "รับเรื่องภายใน 24 ชม." (claimMs / isStale) เป็นนาฬิกาจริง ไม่ข้ามวันหยุด — ตั้งใจ
// วันอื่นที่แสดงให้คนอ่าน (ค้าง N วัน / รอตอบกลับ N วัน / ไม่อัปเดต N วัน) ยังเป็นวันตามปฏิทินไทย
// ส่วน daysAssigned / resolutionDays ยังเป็น floor(ms/วัน) ตามความหมายเดิมของ my-kpi

import { DEFAULT_TASK_SETTINGS, resolveSla } from "./settings";
import { workTypeOf } from "./workTypes";
import { toDate, calendarDaysBetween, daysBetween, plainDoc, bangkokDateKey } from "./format";
import { addBusinessDays, businessDaysToDue, closedPauseBusinessDays, pauseBusinessDays, shiftDueByBusinessDays } from "./businessDays";
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

export const HOUR_MS = 60 * 60 * 1000;

/** ms ระหว่างสองเวลา (≥ 0) — null เมื่อขาดค่าใดค่าหนึ่ง · ใช้ตัดสินเกณฑ์ (ไม่ปัดเศษ) */
function msBetween(from, to) {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return null;
  return Math.max(0, b.getTime() - a.getTime());
}

/** ชั่วโมงเต็ม (floor) — สำหรับแสดงผลเท่านั้น ห้ามใช้ตัดสินเกณฑ์ */
const floorHours = (ms) => (ms === null ? null : Math.floor(ms / HOUR_MS));

function latestDate(...values) {
  let best = null;
  for (const v of values) {
    const d = toDate(v);
    if (d && (!best || d.getTime() > best.getTime())) best = d;
  }
  return best;
}

/**
 * วันครบกำหนด: ค่าที่บันทึกบน assignment → วันที่ประชาชนแจ้ง + SLA วันทำการ → วันที่รับงาน + SLA วันทำการ
 * (สิ้นวันไทยของวันทำการที่ slaDays หลังวันแจ้ง ข้ามวันหยุดใน settings.holidays — businessDays.js#addBusinessDays)
 * (SLA นับจากวันแจ้ง เพราะเป็นคำมั่นต่อประชาชน — เรื่องที่ค้างไม่มีคนรับหลายวันจึงมาถึงมือพร้อมเวลาที่เหลือน้อย ตั้งใจให้เป็นแบบนั้น)
 * SLA ตาม "ชนิดงาน" (settings.js#resolveSla) — ส่ง complaint (problems/detail/workType/category) มาด้วยเสมอ
 * ส่งแค่ category แบบเดิมก็ยังใช้ได้ (ตรวจชนิดงานจากหมวดอย่างเดียว)
 * @returns {{ dueDate: Date | null, basis: 'stored'|'complaint'|'assignment'|null, slaDays: number, workType: string }}
 */
export function dueDateFor({ storedDueDate, complaintCreatedAt, assignedAt, category, complaint: rawComplaint, settings = DEFAULT_TASK_SETTINGS } = {}) {
  const complaint = plainDoc(rawComplaint);
  const c = complaint ? { ...complaint, category: complaint.category ?? category } : { category };
  const { slaDays, workType } = resolveSla(c, settings);
  const stored = toDate(storedDueDate);
  if (stored) return { dueDate: stored, basis: "stored", slaDays, workType };
  const created = toDate(complaintCreatedAt ?? complaint?.createdAt);
  const holidays = settings?.holidays;
  if (created) return { dueDate: addBusinessDays(created, slaDays, holidays), basis: "complaint", slaDays, workType };
  const assigned = toDate(assignedAt);
  if (assigned) return { dueDate: addBusinessDays(assigned, slaDays, holidays), basis: "assignment", slaDays, workType };
  return { dueDate: null, basis: null, slaDays, workType };
}

/**
 * เลื่อนวันครบกำหนดด้วยช่วงพัก SLA เป็น "วันทำการ":
 * ช่วงที่จบแล้ว (slaPausedBusinessDays — ข้อมูลเก่าไม่มี ใช้ floor(slaPausedMs/วัน)) + ช่วงที่ยังพักอยู่ (pauseBusinessDays(slaPausedAt, now))
 * รวม 0 = คืนค่าเดิม · มากกว่า 0 = เลื่อนออกตามวันทำการแล้วยึดสิ้นวันไทย (businessDays.js#shiftDueByBusinessDays)
 * งานที่เสร็จแล้วส่ง now = completedAt (ช่วงพักคิดถึงตอนเสร็จ)
 */
export function effectiveDueDate(dueDate, { slaPausedAt, slaPausedMs = 0, slaPausedBusinessDays = null, now = new Date(), holidays } = {}) {
  const due = toDate(dueDate);
  if (!due) return null;
  const pausedAt = toDate(slaPausedAt);
  const nowD = toDate(now) ?? new Date();
  const openDays = pausedAt ? pauseBusinessDays(pausedAt, nowD, holidays) : 0;
  const closedDays = closedPauseBusinessDays({ slaPausedBusinessDays, slaPausedMs });
  return shiftDueByBusinessDays(due, closedDays + openDays, holidays);
}

/**
 * derived fields ของ assignment หนึ่งรายการ
 * @param {{ assignment?: object, complaint?: object, settings?: object, now?: Date | string | number }} p
 */
export function deriveAssignment({ assignment, complaint, settings = DEFAULT_TASK_SETTINGS, now = new Date() } = {}) {
  const a = plainDoc(assignment) ?? {};
  const c = plainDoc(complaint) ?? {};
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
  const dueDate = effectiveDueDate(rawDue, {
    slaPausedAt: pausedAt,
    slaPausedMs: a.slaPausedMs,
    slaPausedBusinessDays: a.slaPausedBusinessDays,
    now: refNow,
    holidays: settings?.holidays,
  });

  const holidays = settings?.holidays;
  // วันทำการ — เลยวันครบกำหนดแล้วติดลบอย่างน้อย 1 เสมอ (ครบศุกร์ ตอนนี้เสาร์ = เกิน 1 วันทำการ)
  const daysToDue = dueDate ? businessDaysToDue(nowD, dueDate, holidays) : null;
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
  // เสร็จหลังวันครบกำหนด (วันไทย) = ช้า — เทียบ dateKey ตรง ๆ ('YYYY-MM-DD' เรียงตามตัวอักษรได้)
  const completedLate = completedAt && dueDate ? bangkokDateKey(completedAt) > bangkokDateKey(dueDate) : null;
  // เวลาจากประชาชนแจ้ง → กดรับ — KPI "รับเรื่องภายใน 24 ชม." (มติประชุม 10/11/69) ตัดสินด้วย claimMs, claimHours ไว้แสดงผล
  // นับจากวันแจ้งเสมอ: เรื่องที่ถูก "คืนงาน" แล้วมีคนรับใหม่ ก็นับจากวันแจ้งเดิม (คำมั่นต่อประชาชน — ตั้งใจ)
  const claimMs = msBetween(c.createdAt, a.assignedAt);
  const claimHours = floorHours(claimMs);

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
    claimMs,
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
  const c = plainDoc(complaint) ?? {};
  const nowD = toDate(now) ?? new Date();
  const createdAt = toDate(c.createdAt);
  const daysUnclaimed = createdAt ? Math.max(0, calendarDaysBetween(createdAt, nowD)) : null;
  const waitMs = msBetween(createdAt, nowD);
  const hoursUnclaimed = floorHours(waitMs); // แสดงผลเท่านั้น
  const warnHours = settings?.unclaimedWarnHours ?? DEFAULT_TASK_SETTINGS.unclaimedWarnHours;
  const alertHours = settings?.unclaimedAlertHours ?? DEFAULT_TASK_SETTINGS.unclaimedAlertHours;
  // ตัดสินด้วย ms ไม่ปัดเศษ: 24 ชม. พอดี = ยังทัน · 24 ชม. 1 วินาที = ค้าง
  const isStale = waitMs !== null && waitMs > alertHours * HOUR_MS;
  const agingTone = waitMs === null ? "neutral" : isStale ? "overdue" : waitMs >= warnHours * HOUR_MS ? "due" : "neutral";

  const { dueDate, slaDays, workType } = dueDateFor({ complaintCreatedAt: createdAt, complaint: c, settings });
  const daysToDue = dueDate ? businessDaysToDue(nowD, dueDate, settings?.holidays) : null;
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
