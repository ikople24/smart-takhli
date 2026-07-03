// lib/smart-school/fiscalYear.js
// ปีงบประมาณไทย (พ.ศ.): ต.ค.–ก.ย. — ตั้งแต่ 1 ต.ค. นับเป็นปีงบถัดไป
// คำนวณตามเวลา Asia/Bangkok เสมอ (server production รัน UTC)

export function getFiscalYearBE(date = new Date()) {
  const bkk = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
  );
  const beYear = bkk.getFullYear() + 543;
  return bkk.getMonth() >= 9 ? beYear + 1 : beYear; // getMonth() === 9 คือตุลาคม
}
