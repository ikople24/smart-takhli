// ประวัติทุนเทศบาลแบบ self-report — ใช้ทั้งฟอร์มสำรวจ (โหมดเต็ม) และฟอร์มแก้ไขฝั่ง admin
// ไม่ import mongoose — client component import ได้ปลอดภัย (ดู lib/smart-school/familyStatusOptions.js)
//
// ทำไมต้องมีช่องนี้: ระบบมีข้อมูลใบสมัครแค่ปี 2568 เป็นต้นมา คนที่ได้ทุนปี 2565–2567
// จะไม่มีใบในระบบ → `isRenewal` (คำนวณจาก "มีใบปีก่อนไหม") เป็น false ทั้งที่เป็นรายเก่าจริง
// ช่องนี้จึงเป็น "ช่องเดียว" ที่ยืนยันได้ว่าเป็นรายเก่า/รายใหม่จริง
//
// ค่าตรงกับข้อมูลเดิมเป๊ะ (ของจริงมีแค่ 5 ค่านี้: ไม่เคย 161 · 2567:70 · 2566:38 · 2568:20 · 2565:12)
// → ไม่ต้อง migrate ข้อมูลเก่า และ checkbox เดิมฝั่ง admin ยังติ๊กตรงเหมือนเดิม

export const TAKHLI_NEVER = "ไม่เคยได้รับทุนการศึกษา";
export const TAKHLI_YEARS = [2565, 2566, 2567, 2568];
export const takhliYearValue = (y) => `เคยได้รับทุนการศึกษา ปีงบประมาณ ${y}`;

// ลำดับตัวเลือกที่โชว์ (ปีก่อน แล้วค่อย "ไม่เคย")
export const TAKHLI_SCHOLARSHIP_OPTIONS = [
  ...TAKHLI_YEARS.map(takhliYearValue),
  TAKHLI_NEVER,
];

// ⚠️ "ไม่เคยได้รับทุนการศึกษา" มี "เคยได้รับ" เป็น substring — ต้องใช้ startsWith ไม่ใช่ includes
const isReceivedValue = (v) => String(v || "").startsWith("เคยได้รับ");

// แจ้งว่าเคยได้ทุน (ติ๊กปีใดปีหนึ่ง) = รายเก่า แม้ระบบไม่มีใบปีก่อน
export function claimsTakhliScholarship(list) {
  return (list || []).some(isReceivedValue);
}

// ยืนยันเองว่าไม่เคยได้ = รายใหม่จริง
export function saysNeverReceived(list) {
  return (list || []).includes(TAKHLI_NEVER);
}

// ปีที่แจ้งว่าเคยได้ เช่น ["2567","2568"] — ใช้โชว์ใน tooltip
export function takhliClaimedYears(list) {
  return (list || [])
    .filter(isReceivedValue)
    .map((v) => (String(v).match(/25\d\d/) || [])[0])
    .filter(Boolean);
}

// สรุปสถานะรายเก่า/ใหม่ของใบหนึ่ง — รวมข้อเท็จจริงจากระบบ + คำแจ้งของผู้กรอก
// คืน { kind: 'old' | 'new' | 'unknown', reason: string }
export function renewalStatus({ isRenewal, takhliScholarshipHistory } = {}) {
  const years = takhliClaimedYears(takhliScholarshipHistory);
  if (isRenewal || years.length > 0) {
    const reasons = [];
    if (isRenewal) reasons.push("มีใบปีก่อนในระบบ");
    if (years.length) reasons.push(`แจ้งว่าเคยได้ทุน ปี ${years.join(", ")}`);
    return { kind: "old", reason: reasons.join(" · ") };
  }
  if (saysNeverReceived(takhliScholarshipHistory)) {
    return { kind: "new", reason: "ยืนยันเองว่าไม่เคยได้รับทุน" };
  }
  return { kind: "unknown", reason: "ยังไม่ได้ระบุประวัติทุน — ระบบไม่มีข้อมูลก่อนปี 2568 จึงยังสรุปไม่ได้" };
}
