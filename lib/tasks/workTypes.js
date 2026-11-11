// lib/tasks/workTypes.js
// ทะเบียน "ชนิดงาน" + SLA ตามชนิดงาน (มติประชุม 10/11/69) — logic ล้วน ไม่มี I/O
//
// ทำไมแยกจากหมวดใหญ่: ประชาชนมักเลือกหมวดผิด (กิ่งไม้ใต้ "ไฟส่องสว่าง") ระบบจึงตรวจชนิดงานจาก
// ประเภทย่อย (problems) → ข้อความ (detail) → หมวด หรือค่าที่เจ้าหน้าที่เลือกเอง (complaint.workType)
// ชื่อกองต้องตรงกับ lib/tasks/departments.js · กฎต้นไม้ใช้ TREE_WORK_RE ตัวเดียวกัน

import { TREE_WORK_RE } from "./departments.js";

const w = (key, label, slaDays, department, progressEveryDays = null) =>
  Object.freeze({ key, label, slaDays, department, progressEveryDays });

export const WORK_TYPES = Object.freeze([
  w("road_patch", "ปะถนน (ยางมะตอย)", 30, "กองช่าง", 7),
  w("drain_sludge", "ดูดโคลน/ลอกท่อระบายน้ำ", 30, null),
  w("manhole_steel", "ฝาท่อเหล็ก", 15, "กองสาธารณสุขและสิ่งแวดล้อม"),
  w("manhole_concrete", "ฝาท่อปูน", 15, "กองช่าง"),
  w("tree", "กิ่งไม้/ต้นไม้", 15, "งานป้องกันและบรรเทาสาธารณภัย"),
  w("grass", "ตัดหญ้า/วัชพืช", 15, null),
  w("nuisance", "เหตุรำคาญ (กลิ่น/เสียง/ควัน)", 15, "กองสาธารณสุขและสิ่งแวดล้อม"),
  w("general", "งานทั่วไป (ขยะ ไฟฟ้า ประปา และอื่น ๆ)", 3, null),
]);

const text = (v) => String(v ?? "").trim();

export function workTypeOf(key) {
  return WORK_TYPES.find((t) => t.key === key) ?? null;
}

/** ชนิดงานของเรื่อง — คืน key เสมอ (ไม่เข้าข่ายใด = general) */
export function detectWorkType(complaint) {
  const c = complaint ?? {};
  if (workTypeOf(c.workType)) return c.workType;
  const problems = Array.isArray(c.problems) ? c.problems.map(text) : [];
  const detail = text(c.detail);
  const category = text(c.category);
  const anyProblem = (re) => problems.some((p) => re.test(p));

  if (problems.includes("ผิวจราจรเป็นหลุม") || (category === "ถนน/ทางเท้า" && /หลุม|ยางมะตอย|ปะถนน/.test(detail))) return "road_patch";
  if (problems.includes("รางระบายน้ำอุดตัน") || /ดูดโคลน|ลอกท่อ|ลอกราง/.test(detail)) return "drain_sludge";
  if (anyProblem(/ฝาท่อ/) || /ฝาท่อ/.test(detail)) return /ปูน|คอนกรีต/.test(detail) ? "manhole_concrete" : "manhole_steel";
  if (anyProblem(/กิ่งไม้|ต้นไม้/) || TREE_WORK_RE.test(detail)) return "tree";
  if (/หญ้า|วัชพืช/.test(detail) || anyProblem(/หญ้า|วัชพืช/)) return "grass";
  if (anyProblem(/กลิ่นรบกวน|เสียง.*รบกวน|ควัน/) || category === "สัตว์เลี้ยง") return "nuisance";
  return "general";
}

/** SLA (วัน) ของเรื่อง — ค่าตั้งใน settings.slaByWorkType ชนะค่ามาตรฐานของทะเบียน */
export function slaDaysForComplaint(complaint, settings) {
  const key = detectWorkType(complaint);
  const rows = Array.isArray(settings?.slaByWorkType) ? settings.slaByWorkType : [];
  const row = rows.find((r) => r?.workType === key);
  if (row && Number.isInteger(row.slaDays) && row.slaDays >= 1) return row.slaDays;
  return workTypeOf(key).slaDays;
}

export function workTypeOptions() {
  return WORK_TYPES.map(({ key, label, slaDays }) => ({ key, label, slaDays }));
}
