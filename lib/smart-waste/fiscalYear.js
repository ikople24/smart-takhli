// ปีงบประมาณไทย = 1 ต.ค. ถึง 30 ก.ย. ของปีถัดไป และนับเป็น พ.ศ.
// ตัวอย่าง: ปีงบ 2569 = 1 ต.ค. 2025 (พ.ศ. 2568) ถึง 30 ก.ย. 2026 (พ.ศ. 2569)
//
// วันที่ในระบบเก็บเป็น string 'YYYY-MM-DD' แบบ ค.ศ. เสมอ (ตาม pattern ของ
// models/smart-papar/WaterQualityDaily.js) — เลี่ยงปัญหา timezone shift ที่ทำให้
// วันที่ 1 กลายเป็นวันที่ 31 ของเดือนก่อนเมื่อเซิร์ฟเวอร์อยู่ UTC

export const THAI_MONTH_ABBR = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

// จำนวนวันของเดือน — day 0 ของเดือนถัดไปคือวันสุดท้ายของเดือนนี้
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export function isValidRecordDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

// 'YYYY-MM-DD' (ค.ศ.) → ปีงบประมาณ (พ.ศ.)
export function fiscalYearOf(recordDate) {
  if (!isValidRecordDate(recordDate)) {
    throw new Error(`fiscalYearOf: วันที่ไม่ถูกรูปแบบ "${recordDate}"`);
  }
  const [year, month] = recordDate.split('-').map(Number);
  const buddhistYear = year + 543;
  return month >= 10 ? buddhistYear + 1 : buddhistYear;
}

// ปีงบ (พ.ศ.) → ช่วงวันที่ ค.ศ. แบบ inclusive ทั้งสองฝั่ง
export function fiscalYearRange(fiscalYear) {
  const endYear = fiscalYear - 543; // ปีปฏิทินของเดือน ม.ค.–ก.ย.
  return { start: `${endYear - 1}-10-01`, end: `${endYear}-09-30` };
}

// ปีงบ (พ.ศ.) → 12 เดือนเรียงตามปีงบ (ต.ค. → ก.ย.)
export function fiscalMonths(fiscalYear) {
  const endYear = fiscalYear - 543;
  return Array.from({ length: 12 }, (_, index) => {
    const monthIndex = (9 + index) % 12; // 9 = ต.ค.
    const month = monthIndex + 1;
    const year = index < 3 ? endYear - 1 : endYear;
    const beShort = String((year + 543) % 100).padStart(2, '0');
    return {
      key: `${year}-${String(month).padStart(2, '0')}`,
      sheetName: `${THAI_MONTH_ABBR[monthIndex]}${beShort}`,
      label: `${THAI_MONTH_ABBR[monthIndex]} ${beShort}`,
      year,
      month,
      daysInMonth: daysInMonth(year, month),
    };
  });
}

// ชื่อชีตไทยในไฟล์เดิม (เช่น 'ต.ค.68') → เดือน/ปี ค.ศ./ปีงบ
// เลข 2 หลักท้ายชื่อชีตคือ พ.ศ. สองหลักท้าย จึงตีความเป็นช่วง 2500–2599
// (ข้อมูลจริงอยู่แถว ๆ 2560–2580 — ถ้าระบบยังใช้อยู่ถึง พ.ศ. 2600 ต้องแก้ตรงนี้)
export function parseSheetName(sheetName) {
  const match = String(sheetName).trim().match(/^(.+?)(\d{2})$/);
  if (!match) {
    throw new Error(`parseSheetName: ชื่อชีตไม่ถูกรูปแบบ "${sheetName}"`);
  }
  const [, monthAbbr, beShort] = match;
  const monthIndex = THAI_MONTH_ABBR.indexOf(monthAbbr);
  if (monthIndex < 0) {
    throw new Error(`parseSheetName: ไม่รู้จักเดือน "${monthAbbr}" ในชีต "${sheetName}"`);
  }
  const month = monthIndex + 1;
  const beYear = 2500 + Number(beShort);
  return {
    month,
    year: beYear - 543,
    beYear,
    fiscalYear: month >= 10 ? beYear + 1 : beYear,
  };
}

// วันนี้ตามเวลากรุงเทพ ในรูป 'YYYY-MM-DD'
// locale 'en-CA' ให้รูปแบบ YYYY-MM-DD พอดี ไม่ต้องประกอบเอง
export function bangkokToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
