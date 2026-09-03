// lib/tasks/kpi.js
// KPI strip หน้า "งานของฉัน" — คำนวณจากรายการที่ผ่าน deriveAssignment แล้ว (logic ล้วน)
// คีย์เดิมของ my-kpi (total/completed/pending/overdue/completionRate/avgResolutionDays) คงไว้ให้หน้าเก่าใช้ต่อได้
import { bangkokMonthKey } from "./format";

/**
 * @param {Array<object>} items ผลจาก deriveAssignment (ต้องมี isCompleted/isOverdue/isDueSoon/needsCoordination/isBlocked/completedAt/resolutionDays/completedLate)
 * @param {{ now?: Date | string | number }} [opts]
 */
export function computeKpi(items = [], { now = new Date() } = {}) {
  const list = Array.isArray(items) ? items : [];
  const thisMonth = bangkokMonthKey(now);

  let completed = 0;
  let overdue = 0;
  let dueSoon = 0;
  let coordinating = 0;
  let blocked = 0;
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
    completedThisMonth,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    onTimeRate: onTimeKnown > 0 ? Math.round((onTime / onTimeKnown) * 100) : null,
    avgResolutionDays: avg === null ? null : Math.round(avg),
    // ความพึงพอใจของเจ้าหน้าที่คนนี้ — รอ lib/satisfaction/readStats.js (PR #145) เข้า main ก่อน
    // ห้ามคำนวณ $avg ดิบเองที่นี่ (กติกา "1 ผู้แจ้ง = 1 เสียง")
    satisfaction: null,
  };
}
