// ตัวเลือกระดับชั้นตามระดับการศึกษา — ใช้ทั้งฟอร์มสำรวจ (โหมดเต็ม) และฟอร์มแก้ไขฝั่ง admin
// ไม่ import mongoose — client component import ไฟล์นี้ได้ปลอดภัย (ดูเหตุผลใน lib/smart-school/familyStatusOptions.js)
// key ต้องตรงกับ chip "ระดับการศึกษา" ใน InfoStep และ select ใน ApplicationEditModal
// ค่ามาตรฐานใช้แบบสั้น (ป.6 / ม.5) — ข้อมูลเก่าเป็นข้อความอิสระ (เช่น "มัธยมศึกษาปีที่ 5") ไม่ได้ย้ายมาตรฐาน
// picker จะโชว์ค่าเดิมที่ไม่ตรงรายการเป็นตัวเลือกเพิ่ม เพื่อไม่ให้ข้อมูลหาย

export const GRADE_LEVELS = {
  "อนุบาล": ["อ.1", "อ.2", "อ.3"],
  "ประถม": ["ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6"],
  "มัธยมต้น": ["ม.1", "ม.2", "ม.3"],
  "มัธยมปลาย": ["ม.4", "ม.5", "ม.6"],
  "ปวช": ["ปวช.1", "ปวช.2", "ปวช.3"],
  "ปวส": ["ปวส.1", "ปวส.2"],
  "ปริญญาตรี": ["ปี 1", "ปี 2", "ปี 3", "ปี 4", "ปี 5"], // บางหลักสูตร 5 ปี (ครุศาสตร์/สถาปัตย์ ฯลฯ)
};

// ระดับชั้นที่เลือกได้ของระดับการศึกษานั้น — ว่าง = ยังไม่เลือกระดับ / ไม่รู้จัก
export function gradesForLevel(level) {
  return GRADE_LEVELS[String(level || "").trim()] || [];
}

// รายการตัวเลือกที่ควรโชว์ — ถ้าค่าปัจจุบันไม่อยู่ในมาตรฐาน (ข้อมูลเก่า) ให้ต่อท้ายไว้ ไม่ให้หาย
export function gradeOptionsWithCurrent(level, current) {
  const grades = gradesForLevel(level);
  const cur = String(current || "").trim();
  return cur && !grades.includes(cur) ? [...grades, cur] : grades;
}
