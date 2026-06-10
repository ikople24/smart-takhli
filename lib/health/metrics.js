// ฟังก์ชันคำนวณ/จัดหมวดค่าสุขภาพที่ใช้ร่วมกันหลายโมดูล
// (โรงเรียนผู้สูงอายุ, สุขภาพพนักงาน) — แหล่งเดียว ห้าม re-export ซ้ำที่อื่น

/** แปลงค่าจากฟอร์ม/ชีต/DB เป็นตัวเลข (รองรับ string) — ใช้ร่วมกับ computeBMI และจุดอื่นที่ต้องการความสม่ำเสมอ */
export function coerceMeasurementNumber(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  // handle "120/80" style by taking first number only when caller wants it explicitly
  const cleaned = s.replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function computeBMI(weightKg, heightCmOrM) {
  const w = coerceMeasurementNumber(weightKg);
  const hRaw = coerceMeasurementNumber(heightCmOrM);
  if (!w || !hRaw) return null;
  const hM = hRaw > 3 ? hRaw / 100 : hRaw;
  if (hM <= 0) return null;
  const bmi = w / (hM * hM);
  return Number.isFinite(bmi) ? bmi : null;
}

export function bmiCategoryThai(bmi) {
  if (bmi === null || bmi === undefined) return "unknown";
  if (bmi < 18.5) return "underweight";
  if (bmi < 23) return "normal";
  if (bmi < 25) return "overweight";
  if (bmi < 30) return "obese1";
  return "obese2";
}

export function bpCategory(sys, dia) {
  const s = coerceMeasurementNumber(sys);
  const d = coerceMeasurementNumber(dia);
  if (!s || !d) return "unknown";
  // Hypotension (low BP)
  if (s < 90 || d < 60) return "low";
  if (s < 120 && d < 80) return "normal";
  if (s >= 140 || d >= 90) return "high";
  // includes elevated + stage1
  return "risk";
}
