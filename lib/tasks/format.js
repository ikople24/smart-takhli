// lib/tasks/format.js
// ตัวช่วยวันที่ของโมดูลงานเจ้าหน้าที่ — logic ล้วน
// เซิร์ฟเวอร์ (Railway) รัน UTC: การนับ "วัน"/"เดือน" ทุกอย่างต้องอิง Asia/Bangkok
// ห้ามใช้ toLocaleDateString โดยไม่ใส่ timeZone (บทเรียน LINE OA เพี้ยน 7 ชม.)

export const BANGKOK_TZ = "Asia/Bangkok";
export const DAY_MS = 24 * 60 * 60 * 1000;

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// en-CA ให้รูปแบบ YYYY-MM-DD ตรง ๆ — สร้างครั้งเดียว (Intl formatter สร้างแพง)
const bangkokYmd = new Intl.DateTimeFormat("en-CA", {
  timeZone: BANGKOK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** @returns {Date | null} */
export function toDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ส่วนประกอบวันที่ตามเวลาไทย {y,m,d} (m = 1–12) หรือ null */
function bangkokParts(value) {
  const d = toDate(value);
  if (!d) return null;
  const [y, m, day] = bangkokYmd.format(d).split("-").map(Number);
  return { y, m, d: day };
}

/** 'YYYY-MM-DD' ตามเวลาไทย */
export function bangkokDateKey(value) {
  const p = bangkokParts(value);
  return p ? `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}` : null;
}

/** 'YYYY-MM' ตามเวลาไทย — ใช้กับ "เสร็จเดือนนี้" */
export function bangkokMonthKey(value) {
  const p = bangkokParts(value);
  return p ? `${p.y}-${String(p.m).padStart(2, "0")}` : null;
}

/**
 * จำนวนวันตามปฏิทินไทยจาก a → b (b ก่อน a = ติดลบ) — ใช้กับ "ค้าง N วัน", "ครบกำหนดใน N วัน"
 * 23:00 → 01:00 วันถัดไป = 1 วัน (คนอ่านมองเป็น "เมื่อวาน")
 */
export function calendarDaysBetween(a, b) {
  const pa = bangkokParts(a);
  const pb = bangkokParts(b);
  if (!pa || !pb) return null;
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / DAY_MS);
}

/** จำนวนวันเต็ม (floor ของ ms) — คงความหมายเดิมของ daysAssigned / resolutionDays */
export function daysBetween(a, b) {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return null;
  return Math.floor((db.getTime() - da.getTime()) / DAY_MS);
}

/** '13 ส.ค.' */
export function formatThaiShortDate(value) {
  const p = bangkokParts(value);
  return p ? `${p.d} ${THAI_MONTHS_SHORT[p.m - 1]}` : "";
}

/** '13 ส.ค. 2569' */
export function formatThaiDate(value) {
  const p = bangkokParts(value);
  return p ? `${p.d} ${THAI_MONTHS_SHORT[p.m - 1]} ${p.y + 543}` : "";
}

/** 'วันนี้' / 'เมื่อวาน' / 'N วันที่แล้ว' — ค่าเพี้ยน '-' */
export function relativeDaysLabel(days) {
  if (days === null || days === undefined || !Number.isFinite(Number(days))) return "-";
  const n = Math.floor(Number(days));
  if (n <= 0) return "วันนี้";
  if (n === 1) return "เมื่อวาน";
  return `${n} วันที่แล้ว`;
}

/** หัวเรื่องจากรายละเอียดที่ประชาชนพิมพ์ — บรรทัดแรกที่ไม่ว่าง ตัดที่ max ตัวอักษรพร้อม … */
export function summarizeText(value, max = 90) {
  if (typeof value !== "string") return "";
  const firstLine = value.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  return firstLine.length <= max ? firstLine : `${firstLine.slice(0, max)}…`;
}
