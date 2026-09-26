// lib/flood-relief/time.ts
// ป้ายเวลาของหน้าสถานะ/บล็อกหน้าแรก — อิง Asia/Bangkok เสมอ (logic ล้วน)

const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false });
const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });
const dayMonth = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });

function toDate(v: Date | string | number | null | undefined): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "08:32 น." */
export function thaiClock(v: Date | string | number | null | undefined): string {
  const d = toDate(v);
  return d ? `${clock.format(d)} น.` : "";
}

/** "วันนี้ 08:32 น." · "เมื่อวาน 21:05 น." · "24 ก.ย. 08:32 น." */
export function thaiWhen(v: Date | string | number | null | undefined, now: Date = new Date()): string {
  const d = toDate(v);
  if (!d) return "";
  const day = ymd.format(d);
  if (day === ymd.format(now)) return `วันนี้ ${thaiClock(d)}`;
  if (day === ymd.format(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return `เมื่อวาน ${thaiClock(d)}`;
  return `${dayMonth.format(d)} ${thaiClock(d)}`;
}
