type WorklistChangeType = "TRANSFER" | "OWNER_CORRECTION" | "BOUNDARY_CHANGE";

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
  action: "REPLACE_OWNER" | "CORRECT_OWNER" | "UPDATE_AREA";
  search: { deedNo: string | null; oldOwnerName: string | null };
  identify: WorklistField[]; // ข้อมูลยืนยันแปลง: เลขที่ดิน/ระวาง/หน้าสำรวจ/เนื้อที่ (เช็คให้ตรงก่อนแก้)
  steps: WorklistField[];
}

// label -> คอลัมน์ payloadRaw (ลำดับเป็น default ที่ปรับได้ — ดู ASSUMPTION ใน spec §5)
const OWNER_FIELD_COLS: { label: string; col: string }[] = [
  { label: "คำนำหน้า", col: "คำนำหน้า" },
  { label: "ชื่อ", col: "ชื่อ" },
  { label: "นามสกุล", col: "นามสกุล" },
  { label: "เลขบัตรประชาชน (13 หลัก)", col: "13 หลัก" },
  { label: "บ้านเลขที่", col: "OWN_HSE_NO" },
  { label: "หมู่", col: "OWN_MOO" },
  { label: "ซอย", col: "OWN_SOI" },
  { label: "หมู่บ้าน", col: "OWN_VILLAGE" },
  { label: "ถนน", col: "OWN_ROAD" },
  { label: "ตำบล", col: "OWN_TAMBOL" },
  { label: "อำเภอ", col: "OWN_AMPHUR" },
  { label: "จังหวัด", col: "OWN_PROVINCE" },
];

// ชื่อ-นามสกุลล้วน (สำหรับ OWNER_CORRECTION)
const NAME_FIELD_COLS = OWNER_FIELD_COLS.slice(0, 4);

const note = (label: string): WorklistField => ({ label, value: "", copyable: false });
const field = (label: string, value: string): WorklistField => ({ label, value, copyable: true });

function ownerFields(raw: Record<string, string>, cols: { label: string; col: string }[]): WorklistField[] {
  return cols.map((c) => field(c.label, raw[c.col] ?? ""));
}

// ข้อมูลยืนยันแปลง — ดึงจาก payloadRaw + area; ช่วยค้น/เช็คให้ตรงแปลงใน LTAX
function identifyFields(raw: Record<string, string>, area: WorklistTxnInput["area"]): WorklistField[] {
  const ravang = [raw["UTM_MAP1"], raw["UTM_MAP2"], raw["UTM_MAP3"], raw["UTM_MAP4"]]
    .map((v) => (v ?? "").trim()).filter(Boolean).join(" ");
  const areaText = area ? `${area.rai}-${area.ngan}-${area.wa}` : "";
  return [
    field("เลขที่ดิน", raw["ที่ดิน"] ?? ""),
    field("ระวาง", ravang),
    field("มาตราส่วน", raw["UTM_SCALE"] ?? ""),
    field("หน้าสำรวจ", raw["ห.สำรวจ"] ?? ""),
    field("เนื้อที่ (ไร่-งาน-วา)", areaText),
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
        note("กด [เพิ่มเจ้าของกรรมสิทธิ์] แล้วกรอกเจ้าของใหม่:"),
        ...ownerFields(raw, OWNER_FIELD_COLS),
        note(`ลบเจ้าของเดิม: ${oldOwnerName ?? "(ดูรายชื่อในจอ LTAX)"}`),
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
