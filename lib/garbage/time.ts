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

/** 560 → "9.20 น." ให้เป็นจุดตามรูปแบบโปสเตอร์ของเทศบาล */
export function formatThaiTime(min: Minutes | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}.${String(m).padStart(2, "0")} น.`;
}

/** 240, 560 → "4.00 – 9.20 น." */
export function formatRange(startMin: Minutes | null, endMin: Minutes | null): string {
  if (startMin == null || endMin == null) return "";
  const a = formatThaiTime(startMin).replace(" น.", "");
  return `${a} – ${formatThaiTime(endMin)}`;
}

/** แยกส่วนของวันที่ตามโซนเวลาไทย ไม่ขึ้นกับ TZ ของเซิร์ฟเวอร์ */
function bangkokParts(d: Date): { y: number; m: number; d: number; weekday: Weekday } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const map: Record<string, Weekday> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    weekday: map[parts.weekday as string],
  };
}

/** "2026-08-12" | Date → 0..6 ตามเวลาไทย */
export function weekdayOf(input: string | Date): Weekday {
  const d = typeof input === "string" ? new Date(`${input}T00:00:00+07:00`) : input;
  return bangkokParts(d).weekday;
}

/** วันที่ปัจจุบันแบบไทยในรูปแบบ "YYYY-MM-DD" */
export function todayInBangkok(): string {
  const p = bangkokParts(new Date());
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** เวลาปัจจุบันแบบไทยเป็นนาทีจากเที่ยงคืน */
export function minutesNowInBangkok(now: Date = new Date()): Minutes {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGKOK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = fmt.format(now).split(":").map(Number);
  return (h % 24) * 60 + m;
}
