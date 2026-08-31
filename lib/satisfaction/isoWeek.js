// lib/satisfaction/isoWeek.js
// แบ่งถังรายสัปดาห์ ISO ตามเวลา Asia/Bangkok — logic ล้วน ห้ามมี I/O
// ไม่พึ่ง TZ ของเครื่อง: เลื่อน timestamp +7 ชม. แล้วใช้ UTC getters ทั้งหมด
// (Bangkok ไม่มี DST จึงเลื่อนคงที่ได้ — เซิร์ฟเวอร์ production รัน UTC, เครื่อง dev เป็น Bangkok)

export const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * คืน { year, week, label } ของสัปดาห์ ISO (จันทร์–อาทิตย์) ที่วันนั้นตามเวลา Bangkok อยู่
 * year คือ ISO week-year: 2027-01-03 อยู่สัปดาห์ 53 ของปี 2026 · 2025-12-29 อยู่สัปดาห์ 1 ของปี 2026
 * @param {Date|string|number} date
 */
export function isoWeekKey(date) {
  const t = date instanceof Date ? date.getTime() : new Date(date).getTime();
  // "วันตาม Bangkok" แทนด้วย UTC midnight เพื่อให้ getUTC* ใช้ได้ทุก TZ
  const d = new Date(t + BANGKOK_OFFSET_MS);
  d.setUTCHours(0, 0, 0, 0);
  // กติกา ISO: ปีของสัปดาห์ = ปีของวันพฤหัสในสัปดาห์นั้น
  const day = d.getUTCDay() || 7; // อาทิตย์ = 7 ให้จันทร์เป็นวันแรก
  d.setUTCDate(d.getUTCDate() + 4 - day); // เลื่อนไปวันพฤหัสของสัปดาห์เดียวกัน
  const year = d.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  const label = `${year}-W${week < 10 ? `0${week}` : week}`;
  return { year, week, label };
}
