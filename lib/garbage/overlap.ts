import type { Minutes } from "@/types/garbage";

/** ข้อมูลเท่าที่การตรวจเวลาทับต้องใช้ — รับได้ทั้งเอกสารจาก DB และข้อมูลจากฟอร์ม */
export interface OverlapCandidate {
  _id?: unknown;
  weekday: number;
  truckNumber: number;
  shiftNo: number;
  startMin: Minutes | null;
  endMin: Minutes | null;
}

/**
 * หางานของรถคันเดียวกันในวันเดียวกันที่เวลาทับกับ candidate
 * คืนตัวที่เวลาเริ่มก่อนสุด หรือ null ถ้าไม่ทับ
 *
 * ประชิดพอดีไม่ถือว่าทับ (จบ 300 แล้วเริ่ม 300 ได้) เพราะรอบต่อเนื่องกันเป็นเรื่องปกติในตารางจริง
 * งานที่ไม่มีเวลา (วันหยุด) ข้ามทั้งสองฝั่ง — ไม่มีเวลาก็ไม่มีอะไรให้ทับ
 * ข้ามเอกสารที่ _id เท่ากับ candidate เพื่อให้แก้งานเดิมได้โดยไม่ชนตัวเอง
 */
export function findOverlap<T extends OverlapCandidate>(
  existing: T[],
  candidate: OverlapCandidate
): T | null {
  if (candidate.startMin == null || candidate.endMin == null) return null;
  const candId = candidate._id == null ? null : String(candidate._id);

  const hits = existing.filter((a) => {
    if (a.startMin == null || a.endMin == null) return false;
    if (a.weekday !== candidate.weekday) return false;
    if (a.truckNumber !== candidate.truckNumber) return false;
    if (candId != null && a._id != null && String(a._id) === candId) return false;
    // ทับกันเมื่อช่วงเวลาซ้อนกันจริง — ประชิดพอดี (a.endMin === candidate.startMin) ไม่นับ
    return a.startMin < (candidate.endMin as number) && (candidate.startMin as number) < a.endMin;
  });

  if (hits.length === 0) return null;
  return hits.reduce((best, a) => ((a.startMin as number) < (best.startMin as number) ? a : best));
}
