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
};

// ไม่เจอ → null → caller quarantine (reason="unknown_status") ห้ามเดา
export function classifyStatus(status: string): Classification | null {
  return STATUS_MAP[status.trim()] ?? null;
}
