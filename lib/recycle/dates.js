// วันที่ตามเวลาไทย — เก็บ depositDate เป็นสตริง YYYY-MM-DD (Asia/Bangkok)
// เพื่อเลี่ยง bug วันเพี้ยนระหว่าง UTC กับเวลาไทย

export function getBangkokYMD(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isYMD(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2026-11-18" → "18 พ.ย. 2569" */
export function formatThaiDate(ymd) {
  if (!isYMD(ymd)) return ymd || "-";
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${TH_MONTHS_SHORT[m - 1]} ${y + 543}`;
}

/** Date → "09:14" เวลาไทย */
export function formatThaiTime(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}
