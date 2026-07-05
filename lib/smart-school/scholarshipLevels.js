// lib/smart-school/scholarshipLevels.js
// ค่าคงที่ระดับทุน/โควตา/จำนวนเงิน (ปี 2569) + helper แม็ป/normalize
// แก้ปีถัดไปที่ไฟล์นี้ที่เดียว

// กลุ่มระดับทุน (bucket) เรียงจากเล็กไปใหญ่
export const SCHOLARSHIP_LEVELS = [
  { key: "อนุบาล",      label: "อนุบาล",         quota: 35, amount: 2000, levels: ["อนุบาล"] },
  { key: "ประถม",       label: "ประถม",          quota: 80, amount: 2000, levels: ["ประถม"] },
  { key: "ม.ต้น",       label: "ม.ต้น",          quota: 50, amount: 3000, levels: ["มัธยมต้น", "ม.ต้น"] },
  { key: "ม.ปลาย/ปวช.", label: "ม.ปลาย/ปวช.",    quota: 20, amount: 5000, levels: ["มัธยมปลาย", "ม.ปลาย", "ปวช", "ปวช."] },
  { key: "ป.ตรี/ปวส.",  label: "ป.ตรี/ปวส.",     quota: 10, amount: 8000, levels: ["ปริญญาตรี", "ป.ตรี", "ปวส", "ปวส."] },
];

// educationLevel (จากฟอร์ม) → key ของ bucket; ไม่รู้จัก = null
export function levelBucket(educationLevel) {
  const v = String(educationLevel || "").trim();
  const found = SCHOLARSHIP_LEVELS.find((b) => b.levels.includes(v));
  return found ? found.key : null;
}

export function bucketInfo(key) {
  return SCHOLARSHIP_LEVELS.find((b) => b.key === key) || null;
}

// normalize ชื่อสถานศึกษาเพื่อเทียบ blocklist (ตัดช่องว่างซ้ำ/หัวท้าย)
export function normalizeSchool(name) {
  return String(name || "").replace(/\s+/g, " ").trim();
}

// คีย์ครัวเรือนจากที่อยู่ (ตัดช่องว่าง/อักขระ, lowercase); ว่าง = null (ไม่จัดกลุ่ม)
export function householdKeyOf(address) {
  const k = String(address || "").replace(/\s+/g, "").toLowerCase();
  return k.length >= 6 ? k : null; // สั้นเกินไม่น่าเชื่อถือ
}
