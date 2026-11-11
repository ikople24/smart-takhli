// lib/tasks/kpi.js
// KPI strip หน้า "งานของฉัน" — คำนวณจากรายการที่ผ่าน deriveAssignment แล้ว (logic ล้วน)
// คีย์เดิมของ my-kpi (total/completed/pending/overdue/completionRate/avgResolutionDays) คงไว้ให้หน้าเก่าใช้ต่อได้
import { bangkokMonthKey, bangkokDateKey, toDate } from "./format";
import { DEFAULT_TASK_SETTINGS } from "./settings";

/**
 * @param {Array<object>} items ผลจาก deriveAssignment (ต้องมี isCompleted/isOverdue/isDueSoon/needsCoordination/isBlocked/completedAt/resolutionDays/completedLate)
 *        + claimMs (ms จากประชาชนแจ้ง → กดรับ) สำหรับ "รับเรื่องภายใน 24 ชม."
 * @param {{ now?: Date | string | number, settings?: { unclaimedAlertHours?: number, claimKpiFrom?: string } }} [opts]
 */
export function computeKpi(items = [], { now = new Date(), settings } = {}) {
  const list = Array.isArray(items) ? items : [];
  const thisMonth = bangkokMonthKey(now);
  const claimLimitHours = settings?.unclaimedAlertHours ?? DEFAULT_TASK_SETTINGS.unclaimedAlertHours;

  // รับเรื่องภายในเกณฑ์ (มติประชุม 10/11/69) — นับเฉพาะผู้รับผิดชอบหลัก (ผู้ประสานงานเข้ามาทีหลังโดยตั้งใจ)
  // ตัดสินด้วย claimMs (ไม่ปัดเศษ) เกณฑ์เดียวกับ deriveUnclaimed#isStale: ≤ 24 ชม. พอดี = ทัน · เกินแม้วินาทีเดียว = ช้า
  const claimLimitMs = claimLimitHours * 60 * 60 * 1000;
  // นับเฉพาะเรื่องที่แจ้งตั้งแต่วันเริ่มใช้กติกา (settings.claimKpiFrom) — วันแจ้ง = assignedAt − claimMs
  const kpiFrom = settings?.claimKpiFrom ?? DEFAULT_TASK_SETTINGS.claimKpiFrom;
  let claimedCount = 0;
  let claimedWithin = 0;
  for (const it of list) {
    if (it?.role === "coordinator" || !Number.isFinite(it?.claimMs)) continue;
    if (kpiFrom) {
      const assigned = toDate(it.assignedAt);
      const filedKey = assigned ? bangkokDateKey(new Date(assigned.getTime() - it.claimMs)) : null;
      if (!filedKey || filedKey < kpiFrom) continue;
    }
    claimedCount += 1;
    if (it.claimMs <= claimLimitMs) claimedWithin += 1;
  }

  let completed = 0;
  let overdue = 0;
  let dueSoon = 0;
  let coordinating = 0;
  let blocked = 0;
  let siteIssue = 0;
  let completedThisMonth = 0;
  let onTime = 0;
  let onTimeKnown = 0;
  const resolutionDays = [];

  for (const it of list) {
    if (it?.isCompleted) {
      completed += 1;
      if (it.completedAt && bangkokMonthKey(it.completedAt) === thisMonth) completedThisMonth += 1;
      // เรื่องที่ปิดด้วย status โดยไม่รู้เวลาเสร็จ (completedLate null) ไม่เข้าตัวหาร
      if (it.completedLate === true || it.completedLate === false) {
        onTimeKnown += 1;
        if (it.completedLate === false) onTime += 1;
      }
      if (Number.isFinite(it.resolutionDays)) resolutionDays.push(it.resolutionDays);
      continue;
    }
    if (it?.isOverdue) overdue += 1;
    if (it?.isDueSoon) dueSoon += 1;
    if (it?.needsCoordination) coordinating += 1;
    if (it?.isBlocked) blocked += 1;
    if (it?.isBlocked && it?.isSiteIssue) siteIssue += 1;
  }

  const total = list.length;
  const pending = total - completed;
  const avg = resolutionDays.length ? resolutionDays.reduce((s, v) => s + v, 0) / resolutionDays.length : null;

  return {
    total,
    completed,
    pending,
    inProgress: pending, // ชื่อตาม README (KPI strip "กำลังดำเนินการ")
    overdue,
    dueSoon,
    coordinating,
    blocked,
    siteIssue,
    completedThisMonth,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    onTimeRate: onTimeKnown > 0 ? Math.round((onTime / onTimeKnown) * 100) : null,
    avgResolutionDays: avg === null ? null : Math.round(avg),
    /** % เรื่องที่กดรับภายใน unclaimedAlertHours (24 ชม.) — null เมื่อไม่มีข้อมูลเวลาแจ้ง */
    claimedWithin24hRate: claimedCount > 0 ? Math.round((claimedWithin / claimedCount) * 100) : null,
    /** จำนวนเรื่องที่ใช้คิด claimedWithin24hRate (ตัวหาร) */
    claimedCount,
    // ความพึงพอใจของเจ้าหน้าที่คนนี้ — รอ lib/satisfaction/readStats.js (PR #145) เข้า main ก่อน
    // ห้ามคำนวณ $avg ดิบเองที่นี่ (กติกา "1 ผู้แจ้ง = 1 เสียง")
    satisfaction: null,
  };
}
