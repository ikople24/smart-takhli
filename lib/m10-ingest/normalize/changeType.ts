import type { ChangeType } from "../types";

interface Classification { changeType: ChangeType; taxRelevant: boolean; }

export const STATUS_MAP: Record<string, Classification> = {
  "ขาย": { changeType: "TRANSFER", taxRelevant: true },
  "ขายตามคำสั่งศาล": { changeType: "TRANSFER", taxRelevant: true },
  "โอนมรดก": { changeType: "TRANSFER", taxRelevant: true },
  "ให้": { changeType: "TRANSFER", taxRelevant: true },
  "ให้เฉพาะส่วน (ระหว่างภาระจำยอม)": { changeType: "TRANSFER_PARTIAL", taxRelevant: true },
  "ไถ่ถอนจากจำนอง รวมสองโฉนด": { changeType: "MERGE", taxRelevant: true },
  "ลงชื่อคู่สมรส รวมสองโฉนด": { changeType: "MERGE", taxRelevant: true },
  "ให้ รวมสองโฉนด": { changeType: "MERGE", taxRelevant: true },
  "เอกสารสิทธิที่เกิดใหม่ - ปรับปรุง ระหว่างเดือน": { changeType: "NEW", taxRelevant: true },
  "แบ่งแยกในนามเดิม": { changeType: "SPLIT", taxRelevant: true },
  "แบ่งหักเป็นที่สาธารณประโยชน์": { changeType: "SPLIT_PUBLIC", taxRelevant: true },
  "สอบเขตโฉนดที่ดิน": { changeType: "BOUNDARY_CHANGE", taxRelevant: true },
  "แก้ชื่อ (ราชการให้เปลี่ยนชื่อ)": { changeType: "OWNER_CORRECTION", taxRelevant: true },
  "จำนอง": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "ไถ่ถอนจากจำนอง": { changeType: "ENCUMBRANCE", taxRelevant: false },
  // variants ที่เจอจริง — เพิ่มแบบ explicit (ไม่ใช้ regex เดา)
  "ขึ้นเงินจากจำนอง": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "ขึ้นเงินจากจำนอง ครั้งที่หนึ่ง": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "ขึ้นเงินจากจำนอง ครั้งที่สอง": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "ขึ้นเงินจากจำนอง ครั้งที่สาม": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "จำนองเพิ่มหลักทรัพย์": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "จำนองลำดับที่สอง": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "ระงับจำนอง (ศาลขายบังคับจำนอง)": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "หมายเหตุสารบัญ": { changeType: "NOTE", taxRelevant: false },
  "ใบแทน": { changeType: "ADMIN", taxRelevant: false },
  "เอกสารสิทธิที่ยกเลิกระหว่างเดือน": { changeType: "RETIRED", taxRelevant: true },

  // เพิ่มจากไฟล์งวด 2569-02 (ยืนยันการจัดหมวดกับเจ้าของงาน 2026-09-21)
  "โอนมรดกเฉพาะส่วน": { changeType: "TRANSFER_PARTIAL", taxRelevant: true },
  "ให้เฉพาะส่วน": { changeType: "TRANSFER_PARTIAL", taxRelevant: true },
  // ผู้จัดการมรดก = เปลี่ยนชื่อผู้ถือในทะเบียน ไม่ใช่โอนกรรมสิทธิ์ (เจ้าของงานชี้ 2026-09-21)
  "ผู้จัดการมรดก": { changeType: "OWNER_CORRECTION", taxRelevant: true },
  "ผู้จัดการมรดกเฉพาะส่วน": { changeType: "OWNER_CORRECTION", taxRelevant: true },
  // ไถ่จากขายฝาก = กรรมสิทธิ์กลับไปผู้ขายฝาก → ต้องคีย์เปลี่ยนเจ้าของใน LTAX
  "ไถ่จากขายฝาก": { changeType: "TRANSFER", taxRelevant: true },
  "ขาย รวมสองโฉนด": { changeType: "MERGE", taxRelevant: true },
  "จำนอง รวมสองโฉนด": { changeType: "MERGE", taxRelevant: true },
  "แบ่งกรรมสิทธิ์รวม": { changeType: "SPLIT", taxRelevant: true },
  "เลิกสิทธิเก็บกิน": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "แก้ไขหนี้อันจำนองเป็นประกัน": { changeType: "ENCUMBRANCE", taxRelevant: false },
};

// ---- กฎกลุ่ม (ใช้ต่อเมื่อไม่เจอชื่อตรงตัวใน STATUS_MAP) ----
// กรมที่ดินเขียนจำนวนโฉนดที่ถูกรวมเป็นคำไทยซึ่งเปลี่ยนทุกเดือน (สอง/สาม/สี่/ห้า/เก้า/สิบ/สิบหก...)
// ถ้าไล่ใส่ทีละชื่อจะไม่มีวันจบ — ลงท้ายด้วย "รวม...โฉนด" คือการรวมแปลงเสมอ ไม่ว่านิติกรรมต้นทาง
// จะเป็นขาย จำนอง หรือไถ่ถอน (สอดคล้องกับรายการที่ใส่มือไว้เดิมทุกตัวที่ลงท้ายแบบนี้ = MERGE)
const MERGE_SUFFIX = /รวม\S*โฉนด$/;

// วงเล็บต่อท้ายเป็นคำขยายเงื่อนไข ไม่เปลี่ยนชนิดนิติกรรม เช่น "โอนมรดก (ระหว่างจำนอง)" = โอนมรดก
const TRAILING_PAREN = /\s*\([^)]*\)$/;

// ไม่เจอทั้งชื่อตรงตัวและกฎกลุ่ม → null → caller quarantine (reason="unknown_status") ห้ามเดา
export function classifyStatus(status: string): Classification | null {
  const s = status.trim();

  const direct = STATUS_MAP[s];
  if (direct) return direct;

  if (MERGE_SUFFIX.test(s)) return { changeType: "MERGE", taxRelevant: true };

  const base = s.replace(TRAILING_PAREN, "").trim();
  if (base !== s) {
    const byBase = STATUS_MAP[base];
    if (byBase) return byBase;
  }

  return null;
}
