// lib/citizen/status/handlingKpi.js
// KPI ความเร็วการจัดการเรื่องของเจ้าหน้าที่ ฝั่งประชาชน — พอร์ตจากการ์ดเดิม
// components/complaints/CardOfficail.js (calculateProcessingTime + getTimeDiff)
// เกณฑ์/การปัดเวลาต้องตรงของเดิมเป๊ะ เพื่อให้ป้ายที่ประชาชนเคยเห็นไม่เปลี่ยนความหมาย

const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;

// ป้ายความเร็ว: คืน { text, tone } — tone เป็นชื่อกลางให้ UI เลือกสีเอง
// (fast → เขียว, good → น้ำเงิน, ok → เหลือง, slow → ส้ม, late → แดง)
export function handlingSpeed(assignedAt, completedAt) {
  if (!assignedAt || !completedAt) return null;
  const diff = Math.abs(new Date(completedAt) - new Date(assignedAt));
  if (Number.isNaN(diff)) return null;
  const hours = Math.ceil(diff / HOUR);
  const days = Math.ceil(diff / DAY);
  if (hours <= 24) return { text: "ภายใน 24 ชม", tone: "fast" };
  if (days <= 2) return { text: "ภายใน 2 วัน", tone: "good" };
  if (days <= 7) return { text: "ภายใน 7 วัน", tone: "ok" };
  if (days <= 15) return { text: "ภายใน 15 วัน", tone: "slow" };
  return { text: "เกิน 15 วัน", tone: "late" };
}

// เวลาที่ใช้จริงแบบอ่านง่าย เช่น "45 นาที" / "3 ชม. 20 นาที" / "2 วัน 5 ชม."
export function handlingDuration(assignedAt, completedAt) {
  if (!assignedAt || !completedAt) return null;
  const diff = Math.abs(new Date(completedAt) - new Date(assignedAt));
  if (Number.isNaN(diff)) return null;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / HOUR);
  const days = Math.floor(diff / DAY);
  if (minutes < 60) return `${minutes} นาที`;
  if (hours < 24) {
    const m = minutes % 60;
    return m > 0 ? `${hours} ชม. ${m} นาที` : `${hours} ชั่วโมง`;
  }
  const h = hours % 24;
  return h > 0 ? `${days} วัน ${h} ชม.` : `${days} วัน`;
}
