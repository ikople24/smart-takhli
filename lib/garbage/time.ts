import type { Minutes, Weekday } from "@/types/garbage";

export const BANGKOK_TZ = "Asia/Bangkok";

const TIME_RE = /^(\d{1,2})[:.](\d{2})(?:\s*น\.?)?$/u;

/**
 * แปลงเวลาไทยเป็นนาทีจากเที่ยงคืน
 * รับทั้ง "4:00 น." (JSON เดิม) และ "4.00น." (โปสเตอร์)
 * ถือว่าเป็นระบบ 24 ชั่วโมงเสมอ — 12.30 น. คือเที่ยงครึ่ง ไม่ใช่เที่ยงคืนครึ่ง
 */
export function parseThaiTime(input: string | null | undefined): Minutes | null {
  if (input == null) return null;
  const m = TIME_RE.exec(String(input).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "ชม.นาที" ไม่มีหน่วย — ใช้ร่วมกันใน formatThaiTime / formatRange; คืน null เมื่อนอกช่วง 0–1439 หรือไม่ใช่จำนวนเต็ม */
function hhmm(min: Minutes): string | null {
  if (!Number.isInteger(min) || min < 0 || min > 1439) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}.${String(m).padStart(2, "0")}`;
}

/** 560 → "9.20 น." ให้เป็นจุดตามรูปแบบโปสเตอร์ของเทศบาล — นอกช่วง 0–1439 คืนค่าว่าง */
export function formatThaiTime(min: Minutes | null | undefined): string {
  if (min == null) return "";
  const s = hhmm(min);
  return s == null ? "" : `${s} น.`;
}

/** 240, 560 → "4.00 – 9.20 น." — ฝั่งใดฝั่งหนึ่งไม่ถูกต้องคืนค่าว่าง */
export function formatRange(startMin: Minutes | null, endMin: Minutes | null): string {
  if (startMin == null || endMin == null) return "";
  const a = hhmm(startMin);
  const b = hhmm(endMin);
  if (a == null || b == null) return "";
  return `${a} – ${b} น.`;
}

/**
 * นาทีที่เหลือ → คำที่อ่านรู้เรื่อง: 12 → "อีก 12 นาที" · 300 → "อีก 5 ชม." · 320 → "อีก 5 ชม. 20 นาที"
 * เกิน 60 นาทีต้องแปลงเป็นชั่วโมง ไม่งั้นชาวบ้านต้องหารเอง ("อีก 300 นาที" ไม่มีใครอ่านออกว่า 5 ชั่วโมง)
 * 0 หรือติดลบ = รถผ่านไปแล้ว คืนค่าว่างให้ผู้เรียกเลือกข้อความเอง (แต่ละที่พูดไม่เหมือนกัน)
 */
export function formatEta(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min) || min <= 0) return "";
  const m = Math.round(min);
  if (m < 60) return `อีก ${m} นาที`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `อีก ${h} ชม.` : `อีก ${h} ชม. ${rest} นาที`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BANGKOK_OFFSET_MS = 7 * 3600_000;

/**
 * เลื่อนเวลา +7 ชม. เพื่ออ่านส่วนประกอบด้วย getUTC* แทน Intl —
 * กรุงเทพฯ เป็น UTC+7 คงที่ ไม่มี DST จึงไม่ขึ้นกับ TZ/locale ของเซิร์ฟเวอร์
 */
function toBangkok(d: Date): Date {
  return new Date(d.getTime() + BANGKOK_OFFSET_MS);
}

/** "2026-08-12" | Date → 0..6 ตามเวลาไทย — input ไม่ถูกต้องจะโยน error (ไม่คืนค่าอื่นนอก Weekday) */
export function weekdayOf(input: string | Date): Weekday {
  let d: Date;
  if (typeof input === "string") {
    if (!DATE_RE.test(input)) throw new Error("รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD");
    d = new Date(`${input}T00:00:00+07:00`);
  } else {
    d = input;
  }
  if (Number.isNaN(d.getTime())) throw new Error("รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD");
  return toBangkok(d).getUTCDay() as Weekday;
}

/** จัดรูปแบบ Date เป็น "YYYY-MM-DD" ตามเวลาไทย */
function formatDateBangkok(d: Date): string {
  const b = toBangkok(d);
  const mm = String(b.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(b.getUTCDate()).padStart(2, "0");
  return `${b.getUTCFullYear()}-${mm}-${dd}`;
}

/** วันที่ปัจจุบันแบบไทยในรูปแบบ "YYYY-MM-DD" */
export function todayInBangkok(): string {
  return formatDateBangkok(new Date());
}

/**
 * อ่านพารามิเตอร์วันที่จาก query — คืน null เมื่อรูปแบบผิดหรือไม่มีวันนั้นจริงในปฏิทิน
 * ไม่ส่งมา (undefined) = วันนี้ตามเวลาไทย; ส่งเป็น array เอาตัวแรก
 */
export function resolveDateParam(raw: string | string[] | undefined): string | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s == null) return todayInBangkok();
  if (!DATE_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return null;
  // round-trip กันวันที่ไม่มีจริง เช่น "2026-02-30" — engine บางตัว roll over เป็น 02 มี.ค. แทนที่จะ invalid
  return formatDateBangkok(d) === s ? s : null;
}

/** เวลาปัจจุบันแบบไทยเป็นนาทีจากเที่ยงคืน */
export function minutesNowInBangkok(now: Date = new Date()): Minutes {
  const d = toBangkok(now);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

const DAY_MS = 86_400_000;

/**
 * "2026-08-12" → 7 วันของสัปดาห์นั้น เรียงอาทิตย์→เสาร์ (index = เลขวันในสัปดาห์ 0..6)
 * กรุงเทพฯ ไม่มี DST จึงบวกวันด้วยมิลลิวินาทีคงที่ได้ปลอดภัย
 */
export function weekDatesOf(date: string): string[] {
  const weekday = weekdayOf(date); // โยน error เองถ้ารูปแบบผิด
  const base = new Date(`${date}T00:00:00+07:00`);
  const sunday = base.getTime() - weekday * DAY_MS;
  return Array.from({ length: 7 }, (_, i) => formatDateBangkok(new Date(sunday + i * DAY_MS)));
}
