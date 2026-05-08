/**
 * วันที่ยืม/คืนใน Smart Health — อิงเวลาไทย (Asia/Bangkok) และแสดงเป็นปฏิทินไทย (พ.ศ.)
 * ตัวอย่างสตริงที่บันทึก: "08/05/2569 11:11:30"
 */

export const TH_TIMEZONE = "Asia/Bangkok";

export function formatDateLendThai(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("th-TH", {
    timeZone: TH_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * รับค่าจาก datetime-local (YYYY-MM-DDTHH:mm) — ตีความเป็น "เวลาในไทย"
 * ไม่พึ่ง timezone ของเซิร์ฟเวอร์
 */
export function parseBorrowDateTimeInput(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/
  );
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const d = parseInt(m[3], 10);
    const hh = parseInt(m[4], 10);
    const mi = parseInt(m[5], 10);
    const ss = m[6] != null ? parseInt(m[6], 10) : 0;
    if ([y, mo, d, hh, mi, ss].some((n) => !Number.isFinite(n))) return null;
    const utcMs = Date.UTC(y, mo - 1, d, hh - 7, mi, ss);
    const dt = new Date(utcMs);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * แปลงสตริงที่บันทึกไว้ (วันเวลาตามที่แสดงในไทย) กลับเป็น Date (จุดเวลา UTC ที่ถูกต้อง)
 */
export function parseThaiDateLendString(str) {
  if (!str || typeof str !== "string") return null;
  const trimmed = str.trim();
  const spaceIdx = trimmed.indexOf(" ");
  const datePart = spaceIdx >= 0 ? trimmed.slice(0, spaceIdx) : trimmed;
  const timePart = spaceIdx >= 0 ? trimmed.slice(spaceIdx + 1).trim() : "";
  const parts = datePart.split("/");
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const yBE = parseInt(parts[2], 10);
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(yBE))
    return null;
  const yCE = yBE - 543;
  let hh = 0;
  let mm = 0;
  let ss = 0;
  if (timePart) {
    const tp = timePart.split(":");
    hh = parseInt(tp[0], 10) || 0;
    mm = parseInt(tp[1], 10) || 0;
    ss = parseInt(tp[2], 10) || 0;
  }
  const utcMs = Date.UTC(yCE, m - 1, d, hh - 7, mm, ss);
  const dt = new Date(utcMs);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** ค่าให้ input datetime-local = ชั่วโมง:นาทีตามเวลาไทย (ไม่พึ่ง timezone เครื่องผู้ใช้) */
export function toDatetimeLocalValue(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const y = get("year");
  let mo = get("month");
  let day = get("day");
  let h = get("hour");
  let mi = get("minute");
  mo = String(mo).padStart(2, "0");
  day = String(day).padStart(2, "0");
  h = String(h).padStart(2, "0");
  mi = String(mi).padStart(2, "0");
  return `${y}-${mo}-${day}T${h}:${mi}`;
}
