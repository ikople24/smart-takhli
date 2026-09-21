// lib/tasks/departments.js
// ทะเบียน "กอง" ของเทศบาลเมืองตาคลี — logic ล้วน
//
// ทำไมไม่ใช้ model Organization ตามที่ README เสนอ: collection `organizations` มีแค่เอกสารเดียวคือตัวเทศบาล
// (ใช้กับหน้า /admin/settings/organizations ที่เก็บที่อยู่/โทร/เว็บ) ส่วน "กอง" จริง ๆ อยู่ใน users.department
// เป็นข้อความอิสระที่สะกดไม่ตรงกัน (สำนักปลัดฯ / สำนักปลัดเทศบาล, ป้องกันฯ / งานป้องกันและบรรเทาสาธารณภัย)
// ไฟล์นี้จึงเป็นแหล่งความจริงของชื่อกองมาตรฐาน + alias สำหรับ normalize + กองที่น่าจะรับผิดชอบตามประเภทเรื่อง

export const UNASSIGNED_DEPARTMENT = "ยังไม่ระบุกอง";

/** @type {ReadonlyArray<{ name: string, short: string, aliases: string[] }>} */
export const DEPARTMENTS = Object.freeze([
  { name: "สำนักปลัดเทศบาล", short: "สำนักปลัดฯ", aliases: ["สำนักปลัดฯ", "สำนักปลัด"] },
  { name: "กองช่าง", short: "กองช่าง", aliases: ["ช่าง", "โยธา"] },
  { name: "กองสาธารณสุขและสิ่งแวดล้อม", short: "กองสาธารณสุขฯ", aliases: ["กองสาธารณสุขฯ", "สาธารณสุข"] },
  { name: "กองการประปา", short: "กองการประปา", aliases: ["กองประปา", "ประปา"] },
  { name: "งานป้องกันและบรรเทาสาธารณภัย", short: "งานป้องกันฯ", aliases: ["ป้องกันฯ", "ป้องกัน", "บรรเทาสาธารณภัย", "ดับเพลิง"] },
  { name: "กองคลัง", short: "กองคลัง", aliases: ["คลัง"] },
  { name: "กองการศึกษา", short: "กองการศึกษา", aliases: ["การศึกษา"] },
  { name: "กองสวัสดิการสังคม", short: "กองสวัสดิการฯ", aliases: ["สวัสดิการ"] },
  { name: "กองยุทธศาสตร์และงบประมาณ", short: "กองยุทธศาสตร์ฯ", aliases: ["ยุทธศาสตร์", "วิเคราะห์นโยบาย"] },
]);

const text = (v) => String(v ?? "").trim();

/** ค่าที่พิมพ์ในโปรไฟล์/ฟอร์ม → ชื่อกองมาตรฐาน · ไม่รู้จัก → null (ไม่เดา) */
export function normalizeDepartment(value) {
  const t = text(value);
  if (!t) return null;
  const exact = DEPARTMENTS.find((d) => d.name === t || d.short === t);
  if (exact) return exact.name;
  const byAlias = DEPARTMENTS.find((d) => d.aliases.some((a) => t.includes(a)));
  return byAlias ? byAlias.name : null;
}

/** ชื่อย่อสำหรับหัวคอลัมน์/ป้าย — ไม่รู้จักคืนตามที่ส่งมา */
export function departmentShort(name) {
  const t = text(name);
  return DEPARTMENTS.find((d) => d.name === t)?.short ?? t;
}

// ประเภทเรื่องใน menu_list → กอง (ค่าเสนอแนะ — ไม่บันทึกทับ complaint.department ที่เจ้าหน้าที่คัดแยกเอง)
const CATEGORY_DEPARTMENT = {
  "ไฟส่องสว่าง": "กองช่าง",
  "ไฟฟ้าส่องสว่าง": "กองช่าง",
  "ถนน/ทางเท้า": "กองช่าง",
  "น้ำประปา": "กองการประปา",
  "ขยะมูลฝอย": "กองสาธารณสุขและสิ่งแวดล้อม",
  "สัตว์เลี้ยง": "กองสาธารณสุขและสิ่งแวดล้อม",
};

// คำในชื่อประเภทที่ยังพอเดากองได้ (เช็คภัยพิบัติก่อน เพราะ "ไฟไหม้" มีคำว่า "ไฟ")
const CATEGORY_KEYWORDS = [
  [/ไฟไหม้|เพลิง|น้ำท่วม|สาธารณภัย|วาตภัย/, "งานป้องกันและบรรเทาสาธารณภัย"],
  [/ประปา/, "กองการประปา"],
  [/ไฟ|ถนน|ทางเท้า|โคม|สะพาน|ท่อระบายน้ำ|โยธา/, "กองช่าง"],
  [/ขยะ|สัตว์|สิ่งปฏิกูล|ยุง|กลิ่น|อนามัย/, "กองสาธารณสุขและสิ่งแวดล้อม"],
];

/** กองที่น่าจะรับผิดชอบตามประเภทเรื่อง — ตัดสินไม่ได้ (อื่นๆ / ว่าง) → null = ต้องคัดแยก */
export function defaultDepartmentForCategory(category) {
  const t = text(category);
  if (!t) return null;
  if (CATEGORY_DEPARTMENT[t]) return CATEGORY_DEPARTMENT[t];
  const hit = CATEGORY_KEYWORDS.find(([re]) => re.test(t));
  return hit ? hit[1] : null;
}
