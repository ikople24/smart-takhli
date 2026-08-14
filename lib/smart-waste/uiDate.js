// date helpers เฉพาะฝั่ง UI ของ smart-waste — logic ปีงบ/วันที่หลักอยู่ fiscalYear.js
// ที่นี่มีเฉพาะของที่ API ไม่ใช้ (label ไทยของฟอร์ม, การเลื่อนวันหลังบันทึก, key ของ draft)

import { fiscalYearOf, THAI_MONTH_ABBR } from './fiscalYear';

// ปีงบแรกที่มีข้อมูลจริง (ไฟล์ Excel เก่าเริ่มปีงบ 2568)
export const FIRST_FISCAL_YEAR = 2568;

// บวก/ลบวันบน string 'YYYY-MM-DD' — คิดแบบ UTC ล้วนเพื่อไม่ให้ timezone ของ
// เครื่องผู้ใช้เลื่อนวัน (ปัญหาเดียวกับที่ทำให้ recordDate เป็น string ทั้งระบบ)
export function addDays(recordDate, days) {
  const [year, month, day] = recordDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function thaiDateLabel(recordDate) {
  const [year, month, day] = recordDate.split('-').map(Number);
  return `${day} ${THAI_MONTH_ABBR[month - 1]} ${year + 543}`;
}

// วันที่ฟอร์มควรไปต่อหลังบันทึกสำเร็จ — เลื่อนไปวันถัดไปตอนกรอกย้อนหลัง
// แต่ไม่เกินวันนี้ (server ปฏิเสธวันอนาคตอยู่แล้ว อย่าพาผู้ใช้ไปเจอ error นั้น)
export function nextEntryDate(savedDate, today) {
  return savedDate < today ? addDays(savedDate, 1) : today;
}

// ปีงบสำหรับ YearPills — ใหม่ → เก่า ถึงปีแรกที่มีข้อมูล
export function listFiscalYears(today) {
  const current = fiscalYearOf(today);
  const years = [];
  for (let year = current; year >= FIRST_FISCAL_YEAR; year -= 1) years.push(year);
  return years;
}

// รวมปีงบที่มีข้อมูลจริงใน DB เข้ากับช่วงมาตรฐานของ listFiscalYears — พนักงาน
// คีย์ย้อนหลังก่อนปี FIRST_FISCAL_YEAR ได้ (เช่น 2566) ปีเหล่านั้นต้องโผล่ใน YearPills
// กรองปีอนาคต/ค่าขยะทิ้ง: ปีที่เกินปีงบปัจจุบันไม่มีทางมีข้อมูลจริง (server กันวันอนาคต)
// และ 2500 คือขอบล่างที่ API summary ยอมรับ — pill ที่กดแล้ว error ห้ามสร้าง
export function mergeFiscalYears(dataYears, today) {
  const current = fiscalYearOf(today);
  const years = new Set(listFiscalYears(today));
  for (const year of dataYears || []) {
    if (Number.isInteger(year) && year >= 2500 && year <= current) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

export function draftKey(recordDate) {
  return `smart-waste-draft-${recordDate}`;
}
