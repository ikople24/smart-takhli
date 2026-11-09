// lib/complaints/fiscalYear.js
// ตัดสถิติเรื่องร้องเรียนตามปีงบประมาณไทย (1 ต.ค. – 30 ก.ย., นับเป็น พ.ศ.) — ใช้ในหน้า /admin/manage-complaints
// ปีงบของเรื่อง = ปีงบของวันที่แจ้ง (createdAt) ตามเวลากรุงเทพ — สอดคล้องกับเลข TKC-<ปีงบ 2 หลัก>xxxx (lib/getNextSequence.js)
// "ค้างข้ามปี" = แจ้งก่อนปีงบที่เลือก และยังไม่ "ดำเนินการเสร็จสิ้น"

export const DONE_STATUS = "ดำเนินการเสร็จสิ้น";
const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** วันที่ (Date | string | number) → ปีงบประมาณ พ.ศ. หรือ null ถ้าวันที่ใช้ไม่ได้ */
export function fiscalYearOf(value) {
  if (value == null || value === "") return null;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;
  const bkk = new Date(t + BKK_OFFSET_MS);
  return bkk.getUTCFullYear() + 543 + (bkk.getUTCMonth() >= 9 ? 1 : 0);
}

export function currentFiscalYear(now = new Date()) {
  return fiscalYearOf(now);
}

/** ปีงบ (พ.ศ.) → ข้อความช่วงวันที่ เช่น "1 ต.ค. 69 – 30 ก.ย. 70" */
export function fiscalYearLabel(fiscalYear) {
  const end = fiscalYear % 100;
  const start = (fiscalYear - 1) % 100;
  const pad = (n) => String(n).padStart(2, "0");
  return `1 ต.ค. ${pad(start)} – 30 ก.ย. ${pad(end)}`;
}

/** ปีงบทั้งหมดที่มีเรื่อง + ปีปัจจุบันเสมอ เรียงใหม่ → เก่า */
export function availableFiscalYears(complaints, now = new Date()) {
  const years = new Set([currentFiscalYear(now)]);
  for (const c of complaints || []) {
    const fy = fiscalYearOf(c?.createdAt);
    if (fy) years.add(fy);
  }
  return [...years].sort((a, b) => b - a);
}

/**
 * แบ่งเรื่องตามปีงบที่เลือก
 * - fiscalYear === "all" → inYear = ทุกเรื่อง, carryOver = []
 * - inYear = เรื่องที่แจ้งในปีงบนั้น
 * - carryOver = เรื่องที่แจ้งก่อนปีงบนั้นและยังไม่เสร็จ (เรื่องไม่มีวันที่แจ้งไม่นับ)
 * - carryOverByYear = { [ปีงบ]: จำนวน } ของ carryOver
 */
export function splitByFiscalYear(complaints, fiscalYear) {
  const list = Array.isArray(complaints) ? complaints : [];
  if (fiscalYear === "all") return { inYear: list, carryOver: [], carryOverByYear: {} };
  const inYear = [];
  const carryOver = [];
  const carryOverByYear = {};
  for (const c of list) {
    const fy = fiscalYearOf(c?.createdAt);
    if (fy === fiscalYear) {
      inYear.push(c);
    } else if (fy && fy < fiscalYear && c.status !== DONE_STATUS) {
      carryOver.push(c);
      carryOverByYear[fy] = (carryOverByYear[fy] || 0) + 1;
    }
  }
  return { inYear, carryOver, carryOverByYear };
}
