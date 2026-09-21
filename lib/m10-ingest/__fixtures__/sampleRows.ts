import type { ChangeType } from "../types";

// 21 สถานะจริงจาก parcel_60070001_60010000.csv (ม.ค. 2569) — ขับ completeness test
export const REAL_PARCEL_STATUSES: { status: string; changeType: ChangeType; taxRelevant: boolean }[] = [
  { status: "สอบเขตโฉนดที่ดิน", changeType: "BOUNDARY_CHANGE", taxRelevant: true },
  { status: "ไถ่ถอนจากจำนอง", changeType: "ENCUMBRANCE", taxRelevant: false },
  { status: "ขาย", changeType: "TRANSFER", taxRelevant: true },
  { status: "หมายเหตุสารบัญ", changeType: "NOTE", taxRelevant: false },
  { status: "แบ่งแยกในนามเดิม", changeType: "SPLIT", taxRelevant: true },
  { status: "ใบแทน", changeType: "ADMIN", taxRelevant: false },
  { status: "จำนอง", changeType: "ENCUMBRANCE", taxRelevant: false },
  { status: "ให้", changeType: "TRANSFER", taxRelevant: true },
  { status: "โอนมรดก", changeType: "TRANSFER", taxRelevant: true },
  { status: "ขึ้นเงินจากจำนอง ครั้งที่หนึ่ง", changeType: "ENCUMBRANCE", taxRelevant: false },
  { status: "ไถ่ถอนจากจำนอง รวมสองโฉนด", changeType: "MERGE", taxRelevant: true },
  { status: "ลงชื่อคู่สมรส รวมสองโฉนด", changeType: "MERGE", taxRelevant: true },
  { status: "แบ่งหักเป็นที่สาธารณประโยชน์", changeType: "SPLIT_PUBLIC", taxRelevant: true },
  { status: "แก้ชื่อ (ราชการให้เปลี่ยนชื่อ)", changeType: "OWNER_CORRECTION", taxRelevant: true },
  { status: "เอกสารสิทธิที่เกิดใหม่ - ปรับปรุง ระหว่างเดือน", changeType: "NEW", taxRelevant: true },
  { status: "จำนองลำดับที่สอง", changeType: "ENCUMBRANCE", taxRelevant: false },
  { status: "จำนองเพิ่มหลักทรัพย์", changeType: "ENCUMBRANCE", taxRelevant: false },
  { status: "ระงับจำนอง (ศาลขายบังคับจำนอง)", changeType: "ENCUMBRANCE", taxRelevant: false },
  { status: "ขายตามคำสั่งศาล", changeType: "TRANSFER", taxRelevant: true },
  { status: "ให้ รวมสองโฉนด", changeType: "MERGE", taxRelevant: true },
  { status: "ให้เฉพาะส่วน (ระหว่างภาระจำยอม)", changeType: "TRANSFER_PARTIAL", taxRelevant: true },
];

export const NS3A_EXTRA_STATUSES = [
  { status: "เอกสารสิทธิที่ยกเลิกระหว่างเดือน", changeType: "RETIRED" as ChangeType, taxRelevant: true },
];

// แถว parcel ดิบ 1 แถว (คอลัมน์จริง) — จงใจใส่ความสกปรก: trailing space ในคีย์/ค่า, UTM_MAP4 ไม่ pad, REG_AMT มี space
export const DIRTY_PARCEL_ROW: Record<string, string> = {
  "PARCEL_NO": "31635",
  "UTM_MAP1": "5039",
  "UTM_MAP2": "2",
  "UTM_MAP3": "4682",
  "UTM_MAP4": "7",            // ไม่ pad → ต้องเป็น "07"
  "UTM_SCALE": "1000",
  "LAND_NO": "84",
  "RAI": "0", "NGAN": "2", "WA": "24", "SUBWA": "0",
  "OWN_TITLE": "นางสาว", "OWN_FNAME": "วรารีย์", "OWN_LNAME": "ชาลีรัตน์",
  "OWN_PERS_ID": "1 6097 00018 24 8",
  "REG_CODE ": "ขาย ", // trailing space ในคีย์และค่า
  "REG_DATE": "5/1/2569",
  " REG_AMT ": " ฿304,000.00 ",
};
