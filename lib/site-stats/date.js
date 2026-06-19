// วันที่เขต Asia/Bangkok สำหรับ site-stats
// หมายเหตุ: ซ้ำกับ getBangkokYMD ใน lib/pm25Sync.js — รวมเป็น util กลางในเฟส 6/7
export function getBangkokYMD(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
