// ชื่อไทยและลำดับหมวดสำหรับเล่มพิมพ์ — ค่าที่ไม่รู้จักต้องไม่ทำให้เล่มพัง

const DOC_TYPE_LABEL: Record<string, string> = {
  PARCEL: "โฉนดที่ดิน",
  CONSTRUCTION: "สิ่งปลูกสร้าง",
  NS3A: "น.ส.3ก",
};

const CHANGE_TYPE_LABEL: Record<string, string> = {
  TRANSFER: "โอนกรรมสิทธิ์",
  TRANSFER_PARTIAL: "ให้เฉพาะส่วน",
  MERGE: "รวมโฉนด",
  NEW: "เอกสารสิทธิเกิดใหม่",
  SPLIT: "แบ่งแยกในนามเดิม",
  SPLIT_PUBLIC: "แบ่งหักเป็นที่สาธารณประโยชน์",
  BOUNDARY_CHANGE: "สอบเขตโฉนดที่ดิน",
  RETIRED: "ยกเลิกเอกสารสิทธิ",
  OWNER_CORRECTION: "แก้ชื่อเจ้าของ",
  ENCUMBRANCE: "จำนอง/ไถ่ถอน (ไม่กระทบภาษี)",
  NOTE: "หมายเหตุสารบัญ (ไม่กระทบภาษี)",
  ADMIN: "ใบแทน (ไม่กระทบภาษี)",
};

// ลำดับในเล่ม — ห้ามสลับโดยไม่คุยกับฝ่ายแผนที่ภาษี (เจ้าหน้าที่จำลำดับกองกระดาษ)
const DOC_TYPE_ORDER = ["PARCEL", "CONSTRUCTION", "NS3A"];
const CHANGE_TYPE_ORDER = [
  "TRANSFER", "TRANSFER_PARTIAL", "MERGE", "NEW", "SPLIT", "SPLIT_PUBLIC",
  "BOUNDARY_CHANGE", "RETIRED", "OWNER_CORRECTION",
  "ENCUMBRANCE", "NOTE", "ADMIN",
];

const THAI_MONTH_FULL = [
  "", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export function docTypeLabel(v: string | null | undefined): string {
  if (!v) return "-";
  return DOC_TYPE_LABEL[v] ?? v;
}

export function changeTypeLabel(v: string | null | undefined): string {
  if (!v) return "-";
  return CHANGE_TYPE_LABEL[v] ?? v;
}

export function docTypeRank(v: string | null | undefined): number {
  const i = DOC_TYPE_ORDER.indexOf(String(v));
  return i < 0 ? 99 : i;
}

export function changeTypeRank(v: string | null | undefined): number {
  const i = CHANGE_TYPE_ORDER.indexOf(String(v));
  return i < 0 ? 99 : i;
}

/** "2569-01" → "มกราคม 2569" · รูปแบบผิดคืนค่าเดิม (period มาจาก batch ที่คนกรอก) */
export function periodLabel(period: string | null | undefined): string {
  if (!period) return "-";
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const month = THAI_MONTH_FULL[Number(m[2])];
  return month ? `${month} ${m[1]}` : period;
}
