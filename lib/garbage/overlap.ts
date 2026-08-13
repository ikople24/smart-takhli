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
 * candidate ที่ยังไม่มี _id (ตอนสร้างงานใหม่) ถือว่าไม่ตรงกับใคร จึงตรวจครบทุกตัว
 *
 * **ผู้เรียกไม่ต้อง pre-filter ตาม weekday/truckNumber มาก่อน** — ฟังก์ชันกรองเองแล้ว
 * ส่งงานทั้งวันหรือทั้งสัปดาห์เข้ามาได้ตรง ๆ (การ "ช่วย" กรองมาก่อนไม่ผิด แต่ไม่จำเป็น
 * และถ้ากรองผิดด้านจะกลายเป็นตรวจไม่เจอการทับ)
 */
export function findOverlap<T extends OverlapCandidate>(
  existing: T[],
  candidate: OverlapCandidate
): T | null {
  // เก็บใส่ const ก่อน guard เพื่อให้ TypeScript คง narrowing ไว้ถึงในคลอสเชอร์ข้างล่างโดยไม่ต้อง cast
  // (เคยใช้ `as number` ตรงนั้น ซึ่งอันตราย: ถ้าใครย้าย/ลบ guard นี้ออก โค้ดจะยังคอมไพล์ผ่าน
  //  แล้ว null ถูกบังคับเป็น 0 → วันหยุดกลายเป็นงานที่ทับทุกอย่างตั้งแต่เที่ยงคืน)
  const cStart = candidate.startMin;
  const cEnd = candidate.endMin;
  if (cStart == null || cEnd == null) return null;
  const candId = candidate._id == null ? null : String(candidate._id);

  const hits = existing.flatMap((a) => {
    const aStart = a.startMin;
    const aEnd = a.endMin;
    if (aStart == null || aEnd == null) return [];
    if (a.weekday !== candidate.weekday) return [];
    if (a.truckNumber !== candidate.truckNumber) return [];
    if (candId != null && a._id != null && String(a._id) === candId) return [];
    // ทับกันเมื่อช่วงเวลาซ้อนกันจริง — ประชิดพอดี (aEnd === cStart) ไม่นับ
    if (!(aStart < cEnd && cStart < aEnd)) return [];
    return [{ row: a, start: aStart }];
  });

  if (hits.length === 0) return null;
  // เวลาเริ่มเท่ากันให้ตัวที่มาก่อนในลิสต์ชนะ (เทียบด้วย < ไม่ใช่ <=)
  return hits.reduce((best, h) => (h.start < best.start ? h : best)).row;
}
