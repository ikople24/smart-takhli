// lib/tasks/roles.js
// กฎสิทธิ์ของโมดูลงานเจ้าหน้าที่ — logic ล้วน
// นโยบาย (ตกลง 2026-09-01): admin ธรรมดา "รับงาน" จากกองเองได้ แต่ **โอน/มอบหมายได้เฉพาะหัวหน้ากอง/superadmin**
// เจ้าของงานที่ไม่ใช่หัวหน้าทำได้แค่ "ขอโอนงาน" (แจ้งหัวหน้า) — กันโอนกันมั่วและกันเรื่องค้างไม่มีเจ้าภาพ
import { normalizeDepartment } from "./departments";

/** ตำแหน่งที่ถือว่าเป็นหัวหน้ากอง เมื่อ superadmin ยังไม่ได้ติ๊ก isDepartmentHead ให้ (fallback) */
export const HEAD_POSITION_RE = /ผู้อำนวยการ|หัวหน้า|ผอ\.|ปลัด/;

/** ติ๊กจาก superadmin (users.isDepartmentHead) มาก่อนเสมอ — ไม่มีค่า → ดูจากตำแหน่ง */
export function isDepartmentHead(user) {
  if (!user) return false;
  if (typeof user.isDepartmentHead === "boolean") return user.isDepartmentHead;
  return HEAD_POSITION_RE.test(String(user.position ?? ""));
}

const isUsable = (u) => !!u && u.isActive !== false && u.isArchived !== true;

/** หัวหน้าของกองที่ระบุ (ทน alias ชื่อกอง) · department = null → หัวหน้าทุกกอง */
export function headsOf(users, department = null) {
  const target = department ? (normalizeDepartment(department) ?? department) : null;
  return (Array.isArray(users) ? users : []).filter(
    (u) => isUsable(u) && isDepartmentHead(u) && (target === null || normalizeDepartment(u.department) === target)
  );
}

/**
 * สิทธิ์ต่อ "งานหนึ่งเรื่อง"
 * - canAssign: มอบหมายงานจากกองให้คนอื่น (หัวหน้า/superadmin)
 * - canTransfer: ย้ายงานที่มีเจ้าของแล้ว — superadmin ทุกเรื่อง · หัวหน้าเฉพาะงานในกองตัวเอง (ไม่รู้กองของงาน/ของตัวเอง = อนุญาต)
 * - canRequestTransfer: เจ้าของงานที่โอนเองไม่ได้ → ขอให้หัวหน้าโอน
 * @param {{ isSuperAdmin?: boolean, user?: object, taskDepartment?: string|null, isOwner?: boolean }} p
 */
export function taskPermissions({ isSuperAdmin = false, user, taskDepartment = null, isOwner = false } = {}) {
  const isHead = isDepartmentHead(user);
  const ownDept = normalizeDepartment(user?.department);
  const canAssign = isSuperAdmin || isHead;
  const canTransfer = isSuperAdmin || (isHead && (!taskDepartment || !ownDept || ownDept === taskDepartment));
  return { isHead, canAssign, canTransfer, canRequestTransfer: isOwner && !canTransfer };
}
