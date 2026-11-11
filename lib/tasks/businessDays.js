// lib/tasks/businessDays.js
// นับ "วันทำการ" ของกำหนดปิดเรื่อง — logic ล้วน ไม่มี I/O (เทสต์ด้วย vitest รวมทั้ง TZ=UTC)
//
// ข้อตกลงของเจ้าของระบบ (11/11/69):
//   · กำหนดปิดเรื่องตามชนิดงาน (ไฟฟ้า 3 · กิ่งไม้ 15 · ปะถนน 30 …) นับเป็น "วันทำการ" = จันทร์–ศุกร์ ไม่รวมวันหยุดราชการ
//     ตามเวลาไทย เริ่มนับจากวันที่ประชาชนแจ้ง (วันแจ้งไม่นับ · แจ้งวันหยุด = เริ่มนับจากวันทำการถัดไป)
//   · เกณฑ์ "กดรับเรื่องภายใน 24 ชม." ยังเป็นนาฬิกาจริง 24 ชม. (ไม่ข้ามวันหยุด) — ไม่เกี่ยวกับไฟล์นี้
// วันหยุดมาจาก task_settings.holidays (ตั้งที่ /admin/superadmin/task-settings) — ไม่มีวันหยุด = นับแค่จันทร์–ศุกร์
//
// ทุกอย่างคิดบน "dateKey" 'YYYY-MM-DD' ตามเวลาไทย แล้วแปลงเป็น Date.UTC ของวันนั้นเพื่อหาวันในสัปดาห์
// → ไม่ขึ้นกับ timezone ของเครื่อง (เซิร์ฟเวอร์ Railway รัน UTC)
// ประเทศไทยไม่มี DST: สิ้นวันไทย = 23:59:59.999 (UTC+7) ตายตัว

import { bangkokDateKey, DAY_MS } from "./format";

/** วิธีนับกำหนดปิดเรื่อง — ตายตัว (ไม่ให้ตั้งค่า) เขียนไว้ให้ค้นเจอ/อ้างในเอกสาร */
export const SLA_COUNT_MODE = "business";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'YYYY-MM-DD' → ms ของ 00:00 UTC วันนั้น (null = รูปแบบผิด/วันที่ไม่มีจริง เช่น 2026-02-30) */
function keyToUtcMs(key) {
  const m = typeof key === "string" ? KEY_RE.exec(key) : null;
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return ms;
}

function utcMsToKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** รูปแบบ 'YYYY-MM-DD' และเป็นวันที่มีจริง */
export function isValidDateKey(key) {
  return keyToUtcMs(key) !== null;
}

/** จันทร์–ศุกร์ (ms = 00:00 UTC ของ dateKey) */
const isWeekdayMs = (ms) => {
  const wd = new Date(ms).getUTCDay();
  return wd >= 1 && wd <= 5;
};

// แคช Set ต่ออาร์เรย์ของ settings.holidays — deriveAssignment ถูกเรียกต่อรายการ ไม่อยากสร้าง Set ใหม่ทุกครั้ง
const setCache = new WeakMap();

/**
 * วันหยุดในรูปแบบไหนก็ได้ → Set ของ dateKey
 * รับ Set · อาร์เรย์ของ 'YYYY-MM-DD' · อาร์เรย์ของ { date } (รูปแบบ task_settings.holidays) · null
 * @returns {Set<string>}
 */
export function toHolidaySet(holidays) {
  if (holidays instanceof Set) return holidays;
  if (!Array.isArray(holidays)) return new Set();
  const cached = setCache.get(holidays);
  if (cached) return cached;
  const set = new Set();
  for (const h of holidays) {
    const key = typeof h === "string" ? h : h?.date;
    if (isValidDateKey(key)) set.add(key);
  }
  setCache.set(holidays, set);
  return set;
}

/**
 * วันทำการหรือไม่ (จันทร์–ศุกร์ตามปฏิทิน และไม่อยู่ในวันหยุด)
 * @param {string} dateKey 'YYYY-MM-DD' (วันที่ไทย)
 * @param {Set<string> | Array<string | { date: string }>} [holidays]
 */
export function isBusinessDay(dateKey, holidays) {
  const ms = keyToUtcMs(dateKey);
  if (ms === null) return false;
  return isWeekdayMs(ms) && !toHolidaySet(holidays).has(dateKey);
}

/** สิ้นวันตามเวลาไทยของ dateKey (23:59:59.999 +07:00) */
export function endOfBangkokDay(dateKey) {
  const ms = keyToUtcMs(dateKey);
  return ms === null ? null : new Date(ms + DAY_MS - 1 - BANGKOK_OFFSET_MS);
}

/**
 * เส้นตาย = สิ้นวัน (เวลาไทย) ของวันทำการที่ n หลังวันแจ้ง
 * วันแจ้งเองไม่นับ · แจ้งเสาร์/อาทิตย์/วันหยุด → วันทำการถัดไปคือวันที่ 1
 * ตัวอย่าง: แจ้งศุกร์ SLA 3 → จันทร์(1) อังคาร(2) พุธ(3) → ครบสิ้นวันพุธ
 * n ≤ 0 → สิ้นวันแจ้ง
 * @param {Date | string | number} start
 * @param {number} n
 * @param {Set<string> | Array<string | { date: string }>} [holidays]
 * @returns {Date | null}
 */
export function addBusinessDays(start, n, holidays) {
  const startKey = bangkokDateKey(start);
  if (!startKey) return null;
  const target = Math.max(0, Math.floor(Number(n) || 0));
  const set = toHolidaySet(holidays);
  let ms = keyToUtcMs(startKey);
  let counted = 0;
  // กันลูปไม่จบถ้ารายการวันหยุดเพี้ยน (ทั้งปีเป็นวันหยุด) — วันทำการจริงไม่มีทางห่างกันเกินนี้
  const maxSteps = target * 7 + 400;
  for (let step = 0; counted < target && step < maxSteps; step += 1) {
    ms += DAY_MS;
    if (isWeekdayMs(ms) && !set.has(utcMsToKey(ms))) counted += 1;
  }
  return endOfBangkokDay(utcMsToKey(ms));
}

// นับจำนวนวันจันทร์–ศุกร์ใน dayIndex ก่อน n (สูตรสัปดาห์เต็ม × 5 + เศษ ไม่ต้องวนทีละวัน) — dayIndex = ms/DAY_MS (0 = 1970-01-01 วันพฤหัส)
// เลื่อน index ด้วยพหุคูณของ 7 ให้เป็นบวกเสมอ (วันที่ก่อน 1970 ก็ใช้ได้)
const INDEX_SHIFT = 7 * 100000;
function weekdaysBefore(n) {
  const k = n + INDEX_SHIFT;
  const full = Math.floor(k / 7);
  let count = full * 5;
  for (let j = 0; j < k % 7; j += 1) {
    const wd = (j + 4) % 7; // วันในสัปดาห์ของ index (full*7 + j) − INDEX_SHIFT (INDEX_SHIFT หาร 7 ลงตัว)
    if (wd >= 1 && wd <= 5) count += 1;
  }
  return count;
}

/** วันทำการใน (aKey, bKey] — aMs ≤ bMs */
function businessDaysInRange(aMs, bMs, set) {
  const ai = Math.round(aMs / DAY_MS);
  const bi = Math.round(bMs / DAY_MS);
  let count = weekdaysBefore(bi + 1) - weekdaysBefore(ai + 1);
  for (const key of set) {
    const ms = keyToUtcMs(key);
    if (ms !== null && ms > aMs && ms <= bMs && isWeekdayMs(ms)) count -= 1;
  }
  return count;
}

/**
 * จำนวนวันทำการจากวันไทยของ from → วันไทยของ to (นับวันใน (from, to]) — to ก่อน from = ติดลบ
 * คู่กับ format.js#calendarDaysBetween แต่ข้ามเสาร์/อาทิตย์/วันหยุด · ศุกร์ → จันทร์ = 1
 * @returns {number | null}
 */
export function businessDaysBetween(from, to, holidays) {
  const a = keyToUtcMs(bangkokDateKey(from));
  const b = keyToUtcMs(bangkokDateKey(to));
  if (a === null || b === null) return null;
  const set = toHolidaySet(holidays);
  return a <= b ? businessDaysInRange(a, b, set) : -businessDaysInRange(b, a, set);
}

/**
 * "เหลือกี่วันทำการถึงกำหนด" แบบที่ UI แสดง (daysToDue)
 * · วันไทยของ now ≤ วันครบกำหนด → ≥ 0 (0 = ครบกำหนดวันนี้ · เสาร์ก่อนครบจันทร์ = 1)
 * · เลยวันครบกำหนดแล้ว → ≤ -1 เสมอ (ครบศุกร์ ตอนนี้เสาร์ = -1 ไม่ใช่ 0 — เส้นตายผ่านไปแล้วต้องนับว่าเกิน)
 * @returns {number | null}
 */
export function businessDaysToDue(now, due, holidays) {
  const nowKey = bangkokDateKey(now);
  const dueKey = bangkokDateKey(due);
  if (!nowKey || !dueKey) return null;
  if (nowKey <= dueKey) return businessDaysBetween(now, due, holidays);
  return -Math.max(1, businessDaysBetween(due, now, holidays));
}
