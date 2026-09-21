// 1 transaction → 1 แผ่นงาน · ประกอบจาก helper เดิมของ worklist ห้ามเขียน logic ฟิลด์ซ้ำ
import {
  buildWorklistItem,
  identifyFields,
  ownerFields,
  OWNER_FIELD_COLS,
  type WorklistField,
} from "../worklist/buildWorklistItem";
import { docTypeLabel } from "./labels";
// format วันที่แบบ Asia/Bangkok — m10 ไม่มี helper ของตัวเอง และเซิร์ฟเวอร์รัน UTC
import { formatThaiDate } from "@/lib/tasks/format";

/** นิติกรรมที่มีสคริปต์ขั้นตอนคีย์ LTAX แล้ว (ตรงกับ WORKLIST_CHANGE_TYPES ใน repository) */
const CHANGE_TYPES_WITH_STEPS = ["TRANSFER", "TRANSFER_PARTIAL", "OWNER_CORRECTION", "BOUNDARY_CHANGE"] as const;
type StepChangeType = (typeof CHANGE_TYPES_WITH_STEPS)[number];

export interface PrintTxnRow {
  txnId: string;
  docType: string;
  changeType: string;
  rawStatus: string;
  taxRelevant: boolean;
  reviewStatus: string;
  ltaxStatus: string | null;
  txnDate: Date;
  deedNo: string | null;
  recordKey: string | null;
  area: { rai: number; ngan: number; wa: number; sqm: number } | null;
  regAmount: number | null;
  payloadRaw: Record<string, string>;
  /** แถวเจ้าของร่วมคนที่ 2 เป็นต้นไป — ไฟล์กรมที่ดินแยกเป็นคนละแถวต่อเจ้าของ 1 คน */
  coOwnerRows: Record<string, string>[];
  /** PARCEL_COD จาก m10_records (effective = override ?? auto) */
  parcelCode: string | null;
  oldOwnerName: string | null;
}

export interface PrintOwnerBlock {
  /** ลำดับเจ้าของตามไฟล์ (OWN_LINE_NO) — ว่างได้ถ้าไฟล์ไม่ระบุ */
  lineNo: string;
  fields: WorklistField[];
}

export interface PrintSheet {
  txnId: string;
  seqInSection: number;
  sectionTotal: number;
  sheetNo: number;
  rawStatus: string;
  docTypeLabel: string;
  txnDateLabel: string;
  reviewLabel: string;
  deedNo: string;
  parcelCode: string;
  identify: WorklistField[];
  /** เจ้าของทุกคนของนิติกรรมนี้ เรียงตามลำดับในไฟล์ (คนแรกคือเจ้าของหลักของรายการ) */
  owners: PrintOwnerBlock[];
  hasCoOwners: boolean;
  previousOwner: string | null;
  regAmountLabel: string | null;
  steps: WorklistField[] | null;
  blankResultBox: boolean;
}

export interface SheetPosition {
  seqInSection: number;
  sectionTotal: number;
  sheetNo: number;
}

function hasSteps(changeType: string): changeType is StepChangeType {
  return (CHANGE_TYPES_WITH_STEPS as readonly string[]).includes(changeType);
}

function moneyLabel(v: number | null): string | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  // จัดกลุ่มหลักพันแบบ en-US เพื่อผลลัพธ์คงที่ทุกเครื่อง (th-TH บาง ICU ใช้เลขไทย)
  return `${new Intl.NumberFormat("en-US").format(v)} บาท`;
}

/** เรียงตาม OWN_LINE_NO แบบตัวเลข (แถวที่ไม่มีเลขไปท้ายสุด) — ผลคงที่ พิมพ์ซ้ำได้เหมือนเดิม */
function ownerBlocks(row: PrintTxnRow): PrintOwnerBlock[] {
  const rows = [row.payloadRaw, ...(row.coOwnerRows ?? [])];
  return rows
    .map((raw) => ({ lineNo: (raw?.OWN_LINE_NO ?? "").trim(), fields: ownerFields(raw ?? {}, OWNER_FIELD_COLS) }))
    .sort((a, b) => {
      const na = a.lineNo === "" ? Number.MAX_SAFE_INTEGER : Number(a.lineNo);
      const nb = b.lineNo === "" ? Number.MAX_SAFE_INTEGER : Number(b.lineNo);
      if (Number.isNaN(na) || Number.isNaN(nb)) return 0;
      return na - nb;
    });
}

export function buildSheet(row: PrintTxnRow, pos: SheetPosition): PrintSheet {
  const owners = ownerBlocks(row);
  const steps = hasSteps(row.changeType)
    ? buildWorklistItem(
        {
          _id: row.txnId,
          recordKey: row.recordKey ?? "",
          deedNo: row.deedNo,
          changeType: row.changeType,
          txnDate: row.txnDate,
          area: row.area,
          payloadRaw: row.payloadRaw,
        },
        row.oldOwnerName,
        ""
      ).steps
    : null;

  return {
    txnId: row.txnId,
    seqInSection: pos.seqInSection,
    sectionTotal: pos.sectionTotal,
    sheetNo: pos.sheetNo,
    rawStatus: row.rawStatus || "-",
    docTypeLabel: docTypeLabel(row.docType),
    txnDateLabel: formatThaiDate(row.txnDate) || "-",
    reviewLabel: row.reviewStatus === "confirmed" ? "ยืนยันแล้ว" : "รอยืนยัน",
    deedNo: row.deedNo || "-",
    parcelCode: row.parcelCode || "ยังไม่จับคู่",
    identify: identifyFields(row.payloadRaw, row.area),
    owners,
    hasCoOwners: owners.length > 1,
    previousOwner: row.oldOwnerName || null,
    regAmountLabel: moneyLabel(row.regAmount),
    steps,
    blankResultBox: steps === null,
  };
}
