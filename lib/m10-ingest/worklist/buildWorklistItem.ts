type WorklistChangeType = "TRANSFER" | "TRANSFER_PARTIAL" | "OWNER_CORRECTION" | "BOUNDARY_CHANGE";

export interface WorklistTxnInput {
  _id: string;
  recordKey: string;
  deedNo: string | null;
  changeType: WorklistChangeType;
  txnDate: Date;
  area: { rai: number; ngan: number; wa: number; sqm: number } | null;
  payloadRaw: Record<string, string>;
}

export interface WorklistField { label: string; value: string; copyable: boolean }

export interface WorklistItem {
  txnId: string;
  recordKey: string;
  deedNo: string | null;
  period: string;
  changeType: WorklistChangeType;
  action: "REPLACE_OWNER" | "ADD_OWNER" | "CORRECT_OWNER" | "UPDATE_AREA";
  search: { deedNo: string | null; oldOwnerName: string | null };
  identify: WorklistField[]; // ข้อมูลยืนยันแปลง: เลขที่ดิน/ระวาง/หน้าสำรวจ/เนื้อที่ (เช็คให้ตรงก่อนแก้)
  steps: WorklistField[];
}

// label -> คอลัมน์ payloadRaw — เรียง + ตั้งชื่อตรงฟอร์ม LTAX "เพิ่มข้อมูลเจ้าของทรัพย์สิน"
// (รหัสไปรษณีย์ไม่มีในข้อมูล ม.10 → เจ้าหน้าที่กรอกเอง)
const OWNER_FIELD_COLS: { label: string; col: string }[] = [
  { label: "เลขประจำตัวประชาชน", col: "13 หลัก" },
  { label: "คำนำหน้าชื่อ", col: "คำนำหน้า" },
  { label: "ชื่อ", col: "ชื่อ" },
  { label: "นามสกุล", col: "นามสกุล" },
  { label: "บ้านเลขที่", col: "OWN_HSE_NO" },
  { label: "หมู่ที่/ชุมชน", col: "OWN_MOO" },
  { label: "ซอย", col: "OWN_SOI" },
  { label: "ถนน", col: "OWN_ROAD" },
  { label: "ตำบล", col: "OWN_TAMBOL" },
  { label: "อำเภอ", col: "OWN_AMPHUR" },
  { label: "จังหวัด", col: "OWN_PROVINCE" },
  { label: "โทรศัพท์", col: "OWN_TEL" },
];

// ชื่อ-นามสกุล-เลขบัตร (สำหรับ OWNER_CORRECTION)
const NAME_FIELD_COLS: { label: string; col: string }[] = [
  { label: "คำนำหน้าชื่อ", col: "คำนำหน้า" },
  { label: "ชื่อ", col: "ชื่อ" },
  { label: "นามสกุล", col: "นามสกุล" },
  { label: "เลขประจำตัวประชาชน", col: "13 หลัก" },
];

const note = (label: string): WorklistField => ({ label, value: "", copyable: false });
const field = (label: string, value: string): WorklistField => ({ label, value, copyable: true });

const ROMAN: Record<string, string> = { "1": "I", "2": "II", "3": "III", "4": "IV" };
const pad2 = (v: string): string => { const t = (v ?? "").trim(); return t ? t.padStart(2, "0") : ""; };
const digitsOnly = (v: string): string => (v ?? "").replace(/\D/g, "");

function ownerFields(raw: Record<string, string>, cols: { label: string; col: string }[]): WorklistField[] {
  return cols.map((c) => {
    const v = raw[c.col] ?? "";
    // เลขบัตรใน LTAX เป็นเลขล้วน (ไม่มีเว้นวรรค/ขีด)
    return field(c.label, c.col === "13 หลัก" ? digitsOnly(v) : v);
  });
}

// ข้อมูลยืนยันแปลง — ตรง label หน้า LTAX "แก้ไขข้อมูลที่ดิน" 1:1 (ระวางแยกช่อง, UTM2→โรมัน, UTM4 pad2, เนื้อที่ 3 ช่อง)
function identifyFields(raw: Record<string, string>, area: WorklistTxnInput["area"]): WorklistField[] {
  const u2 = (raw["UTM_MAP2"] ?? "").trim();
  return [
    field("ระวาง", raw["UTM_MAP1"] ?? ""),
    field("แผนที่ระวางภูมิประเทศ", ROMAN[u2] ?? u2),
    field("ระวางUTM", raw["UTM_MAP3"] ?? ""),
    field("แผ่นที่ระวางUTM", pad2(raw["UTM_MAP4"] ?? "")),
    field("มาตราส่วน", raw["UTM_SCALE"] ?? ""),
    field("เลขที่ดิน", raw["ที่ดิน"] ?? ""),
    field("หน้าสำรวจ", raw["ห.สำรวจ"] ?? ""),
    field("เนื้อที่: ไร่", String(area?.rai ?? "")),
    field("เนื้อที่: งาน", String(area?.ngan ?? "")),
    field("เนื้อที่: ตร.ว.", area ? area.wa.toFixed(2) : ""),
  ];
}

export function buildWorklistItem(
  txn: WorklistTxnInput,
  oldOwnerName: string | null,
  period: string
): WorklistItem {
  const raw = txn.payloadRaw;
  const base = {
    txnId: txn._id,
    recordKey: txn.recordKey,
    deedNo: txn.deedNo,
    period,
    changeType: txn.changeType,
    search: { deedNo: txn.deedNo, oldOwnerName },
    identify: identifyFields(raw, txn.area),
  };

  if (txn.changeType === "TRANSFER") {
    return {
      ...base,
      action: "REPLACE_OWNER",
      steps: [
        note(`ค้นหาเลขโฉนด ${txn.deedNo ?? "(ดูชื่อเจ้าของเดิม)"} แล้วเปิดเอกสาร`),
        note("กด [เพิ่มเจ้าของกรรมสิทธิ์] → ค้นบุคคลจากเลขบัตร/ชื่อ ถ้ามีให้เลือก ถ้าไม่มีบันทึกใหม่ด้วยข้อมูลนี้:"),
        ...ownerFields(raw, OWNER_FIELD_COLS),
        note(`ลบเจ้าของเดิม: ${oldOwnerName ?? "(ดูรายชื่อในจอ LTAX)"}`),
        note("กด [บันทึก]"),
      ],
    };
  }

  if (txn.changeType === "TRANSFER_PARTIAL") {
    // ให้เฉพาะส่วน = เพิ่มเจ้าของร่วม (ไม่ลบเจ้าของเดิม)
    return {
      ...base,
      action: "ADD_OWNER",
      steps: [
        note(`ค้นหาเลขโฉนด ${txn.deedNo ?? "(ดูชื่อเจ้าของเดิม)"} แล้วเปิดเอกสาร`),
        note("กด [เพิ่มเจ้าของกรรมสิทธิ์] เป็นเจ้าของร่วม (เจ้าของเดิมคงอยู่) → ค้นบุคคลจากเลขบัตร/ชื่อ ถ้าไม่มีบันทึกใหม่:"),
        ...ownerFields(raw, OWNER_FIELD_COLS),
        note("กด [บันทึก]"),
      ],
    };
  }

  if (txn.changeType === "OWNER_CORRECTION") {
    return {
      ...base,
      action: "CORRECT_OWNER",
      steps: [
        note(`ค้นหาเลขโฉนด ${txn.deedNo ?? "(ดูชื่อเจ้าของ)"} แล้วเปิดเอกสาร`),
        note("แก้ชื่อเจ้าของให้ตรงตามนี้:"),
        ...ownerFields(raw, NAME_FIELD_COLS),
        note("กด [บันทึก]"),
      ],
    };
  }

  // BOUNDARY_CHANGE
  const area = txn.area;
  return {
    ...base,
    action: "UPDATE_AREA",
    steps: [
      note(`ค้นหาเลขโฉนด ${txn.deedNo ?? ""} แล้วเปิดเอกสาร`),
      note("แก้เนื้อที่ให้ตรงตามนี้:"),
      field("ไร่", String(area?.rai ?? "")),
      field("งาน", String(area?.ngan ?? "")),
      field("วา", String(area?.wa ?? "")),
      note("กด [บันทึก]"),
    ],
  };
}
