// lib/tasks/release.js
// "คืนงานเข้ากองงานรอรับ" (2026-11-10) — คนที่กดรับผิดเรื่องคืนเองได้ ไม่ต้องรอหัวหน้าโอน
// คืนได้เฉพาะงานที่ "ยังไม่ได้เริ่มทำ": ไม่ปิด, ยังอยู่ขั้นรับเรื่อง, ไม่มีผลการแก้ไข/ภาพ/ประสานงาน/รอวัสดุ
// งานที่เริ่มทำแล้วต้องใช้ "ขอโอนงาน" (หัวหน้า/superadmin โอน) — กันประวัติการทำงานหาย
// คืนงาน = ลบ assignment (กองงานรอรับ = เรื่องที่ไม่มี assignment — lib/tasks/loadPool.js) + คืนกองเดิมถ้าตอนรับย้ายกองไว้

/**
 * @param {{ assignment: object, isOwner?: boolean, isSuperAdmin?: boolean }} p
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function releaseCheck({ assignment, isOwner = false, isSuperAdmin = false } = {}) {
  const a = assignment;
  if (!a) return { ok: false, reason: "ไม่พบงานนี้" };
  if (!isOwner && !isSuperAdmin) return { ok: false, reason: "คืนงานได้เฉพาะงานของตัวเอง" };
  if (a.completedAt) return { ok: false, reason: "งานนี้ปิดแล้ว" };
  const stage = a.stage || "received";
  const started =
    stage !== "received" ||
    (Array.isArray(a.solution) && a.solution.length > 0) ||
    (Array.isArray(a.solutionImages) && a.solutionImages.length > 0) ||
    !!String(a.coordination?.agencyName ?? "").trim() ||
    !!a.blocked?.isBlocked;
  if (started) return { ok: false, reason: 'งานนี้เริ่มดำเนินการแล้ว — ใช้ "ขอโอนงาน" ให้หัวหน้ากอง/แอดมินกลางโอนแทน' };
  return { ok: true };
}

/**
 * กองที่ต้องคืนให้เรื่อง หลังคืนงาน — ดูจาก audit "complaint_department_set" ล่าสุดที่เกิดตั้งแต่รับงานนี้
 * คืนเฉพาะเมื่อกองปัจจุบันยังเป็นกองที่ถูกย้ายเข้า (ถ้ามีคนเปลี่ยนกองเองหลังจากนั้น ไม่แตะ)
 * @param {{ currentDepartment?: string|null, moves?: Array<{ before?: { department?: string }, after?: { department?: string } }> }} p
 *   moves เรียงใหม่ → เก่า
 * @returns {{ restore: false } | { restore: true, department: string }} department "" = กลับเป็น "ยังไม่ระบุ" (ให้ระบบเดาจากหมวด)
 */
export function departmentToRestore({ currentDepartment = null, moves = [] } = {}) {
  const latest = Array.isArray(moves) ? moves[0] : null;
  if (!latest) return { restore: false };
  const movedTo = String(latest.after?.department ?? "");
  if (!movedTo || movedTo !== String(currentDepartment ?? "")) return { restore: false };
  return { restore: true, department: String(latest.before?.department ?? "") };
}
