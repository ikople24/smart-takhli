// lib/tasks/holidays.js
// วันหยุดราชการไทยที่ "วันที่ตายตัว" ทุกปี — logic ล้วน (ใช้กับปุ่มเติมวันหยุดในหน้า /admin/superadmin/task-settings)
// ไม่รวม: วันหยุดทางจันทรคติ (มาฆบูชา วิสาขบูชา อาสาฬหบูชา เข้าพรรษา) · วันหยุดชดเชย · วันหยุดพิเศษตามมติ ครม.
// → เจ้าหน้าที่ต้องเพิ่มเองทุกปี (วันเปลี่ยนทุกปี เดาด้วยสูตรไม่ได้)

import { isValidDateKey } from "./businessDays";

/** [เดือน (1–12), วัน, ชื่อ] */
export const FIXED_THAI_HOLIDAYS = Object.freeze([
  [1, 1, "วันขึ้นปีใหม่"],
  [4, 6, "วันจักรี"],
  [4, 13, "วันสงกรานต์"],
  [4, 14, "วันสงกรานต์"],
  [4, 15, "วันสงกรานต์"],
  [5, 4, "วันฉัตรมงคล"],
  [6, 3, "วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี"],
  [7, 28, "วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว"],
  [8, 12, "วันแม่แห่งชาติ"],
  [10, 13, "วันนวมินทรมหาราช"],
  [10, 23, "วันปิยมหาราช"],
  [12, 5, "วันพ่อแห่งชาติ"],
  [12, 10, "วันรัฐธรรมนูญ"],
  [12, 31, "วันสิ้นปี"],
]);

/** พ.ศ. → ค.ศ. */
export const beToCe = (beYear) => Number(beYear) - 543;

/**
 * วันหยุดวันที่ตายตัวของปี พ.ศ. ที่เลือก
 * @param {number} beYear ปี พ.ศ. (เช่น 2570)
 * @returns {Array<{ date: string, name: string }>} เรียงตามวันที่ · ปีเพี้ยน → []
 */
export function fixedHolidaysForBeYear(beYear) {
  const ce = beToCe(beYear);
  if (!Number.isInteger(ce) || ce < 1900 || ce > 2200) return [];
  return FIXED_THAI_HOLIDAYS.map(([m, d, name]) => ({
    date: `${ce}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    name,
  }));
}

/**
 * ทำความสะอาดรายการวันหยุด: รูปแบบวันที่ต้องถูก · ชื่อตัดช่องว่าง (ยาวไม่เกิน 100) · วันซ้ำ = แถวหลังทับ · เรียงตามวันที่
 * @param {unknown} raw
 * @returns {Array<{ date: string, name: string }>}
 */
export function normalizeHolidays(raw) {
  const byDate = new Map();
  for (const row of Array.isArray(raw) ? raw : []) {
    const date = String((typeof row === "string" ? row : row?.date) ?? "").trim();
    if (!isValidDateKey(date)) continue;
    const name = String((typeof row === "string" ? "" : row?.name) ?? "").trim().slice(0, 100);
    byDate.set(date, name);
  }
  return [...byDate]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, name]) => ({ date, name }));
}

/**
 * รวมวันหยุดชุดใหม่เข้ากับของเดิม — วันที่มีอยู่แล้วคงชื่อเดิม (ไม่ทับที่เจ้าหน้าที่ตั้งเอง)
 * @returns {{ holidays: Array<{ date: string, name: string }>, added: number }}
 */
export function mergeHolidays(current, extra) {
  const base = normalizeHolidays(current);
  const have = new Set(base.map((h) => h.date));
  const toAdd = normalizeHolidays(extra).filter((h) => !have.has(h.date));
  return { holidays: normalizeHolidays([...base, ...toAdd]), added: toAdd.length };
}
