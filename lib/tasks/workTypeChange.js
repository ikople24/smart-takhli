// lib/tasks/workTypeChange.js
// เจ้าหน้าที่เปลี่ยน "ชนิดงาน" ของเรื่อง (PATCH /api/tasks/[assignmentId] action work_type) — logic ล้วน ไม่มี I/O
// ทำไม: ประชาชนเลือกหมวดผิดบ่อย (กิ่งไม้ใต้ "ไฟส่องสว่าง") และชนิดงานตามมติประชุม (ฝาท่อเหล็ก/ปูน, ตัดหญ้า, ดูดโคลน)
// ไม่มีในฟอร์มสาธารณะ — คนหน้างานรู้ชนิดจริง เลือกแล้ววันครบกำหนดต้องตามชนิดใหม่
// คำนวณวันครบกำหนดผ่าน dueDateFor/resolveSla ตัวเดียวกับตอนรับงาน (ห้ามคิดสูตรซ้ำ)

import { WORK_TYPES, workTypeOf, detectWorkType } from "./workTypes";
import { DEFAULT_TASK_SETTINGS, resolveSla } from "./settings";
import { dueDateFor } from "./derived";
import { normalizeDepartment } from "./departments";
import { plainDoc } from "./format";

/**
 * ตัวเลือกชนิดงานพร้อม SLA ที่ใช้จริงกับเรื่องนี้ (รวมค่าตั้ง slaByWorkType / slaByCategory ของงานทั่วไป)
 * @param {object | null | undefined} complaint
 * @param {object} [settings]
 * @returns {Array<{ key: string, label: string, slaDays: number }>}
 */
export function workTypeOptionsFor(complaint, settings = DEFAULT_TASK_SETTINGS) {
  const c = plainDoc(complaint) ?? {};
  return WORK_TYPES.map(({ key, label }) => ({ key, label, slaDays: resolveSla({ ...c, workType: key }, settings).slaDays }));
}

/** manual = เจ้าหน้าที่เลือกไว้ (complaint.workType เป็น key ในทะเบียน) · auto = ระบบเดา */
export function workTypeSourceOf(complaint) {
  return workTypeOf(plainDoc(complaint)?.workType) ? "manual" : "auto";
}

/**
 * ผลของการเปลี่ยนชนิดงาน — ไม่ย้ายกองให้อัตโนมัติ แค่ "แนะนำ" กองปกติของชนิดนั้น (ให้คนกดขอโอนงานเอง)
 * @param {{ complaint?: object, currentDepartment?: string | null, newKey?: string, settings?: object, assignedAt?: Date | string | null }} p
 * @returns {{ ok: true, workType: string, label: string, slaDays: number, newDueDate: Date | null, suggestedDepartment: string | null }
 *          | { ok: false, reason: string }}
 */
export function workTypeChange({ complaint, currentDepartment = null, newKey, settings = DEFAULT_TASK_SETTINGS, assignedAt = null } = {}) {
  const key = String(newKey ?? "").trim();
  const entry = workTypeOf(key);
  if (!entry) return { ok: false, reason: "ชนิดงานไม่ถูกต้อง" };
  const c = plainDoc(complaint) ?? {};
  if (detectWorkType(c) === key) return { ok: false, reason: "ชนิดงานเดิม" };

  const { dueDate, slaDays } = dueDateFor({
    complaint: { ...c, workType: key },
    complaintCreatedAt: c.createdAt,
    assignedAt,
    settings,
  });
  const current = normalizeDepartment(currentDepartment);
  const suggestedDepartment = entry.department && entry.department !== current ? entry.department : null;
  return { ok: true, workType: key, label: entry.label, slaDays, newDueDate: dueDate, suggestedDepartment };
}
