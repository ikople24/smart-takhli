# เล่มพิมพ์บัญชีคุมนิติกรรมรายเดือน (m10 print) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หน้า `/admin/m10/print?period=YYYY-MM` ที่เรนเดอร์ "เล่มรายเดือน" (ใบปกบัญชีคุม + ใบคั่นหมวด + แผ่นงานรายแปลง) พร้อมสั่งพิมพ์ด้วย print CSS เพื่อให้เจ้าหน้าที่ใช้เป็นตัวตั้งคีย์เข้า LTAX Online

**Architecture:** ตรรกะทั้งหมดอยู่ใน pure lib (`lib/m10-ingest/print/`) ที่รับแถวข้อมูลแล้วคืนโครงเล่มสำเร็จ · repository ดึงข้อมูลจาก Mongo แล้ว API ประกอบเล่มฝั่ง server · React component เรนเดอร์ล้วนไม่คำนวณซ้ำ · การพิมพ์ใช้ `window.print()` + `@media print` ไม่มี dependency ใหม่

**Tech Stack:** Next.js 15 Pages Router · TypeScript strict · Mongoose (models เป็น CommonJS) · vitest · Tailwind v4 + DaisyUI

**สเปค:** `docs/superpowers/specs/2026-09-21-m10-print-monthly-book-design.md`

---

## โครงไฟล์

| ไฟล์ | รับผิดชอบ |
|---|---|
| `lib/m10-ingest/print/labels.ts` | ชื่อไทยของ docType/changeType · ลำดับหมวดคงที่ · ชื่อเดือนไทยเต็ม |
| `lib/m10-ingest/print/buildSheet.ts` | 1 transaction → 1 แผ่นงาน (ประกอบจาก helper เดิมของ worklist) |
| `lib/m10-ingest/print/buildBook.ts` | หลายแถว → เล่มทั้งเล่ม (ใบปก + หมวด + ลำดับหน้า) |
| `lib/m10-ingest/worklist/buildWorklistItem.ts` | **แก้:** export `identifyFields`, `ownerFields`, `OWNER_FIELD_COLS` เพื่อ reuse |
| `lib/m10-ingest/repository/index.ts` | **แก้:** เพิ่ม `listPrintRows(period)` |
| `lib/m10-ingest/repository/print.test.ts` | เทสต์ `listPrintRows` ด้วย mongodb-memory-server |
| `pages/api/m10-ingest/print.js` | GET endpoint + gate เดิม + audit log |
| `components/m10/print/CoverSheet.jsx` | ใบปกบัญชีคุม |
| `components/m10/print/SectionDivider.jsx` | ใบคั่นหมวด |
| `components/m10/print/WorkSheet.jsx` | แผ่นงานรายแปลง |
| `components/m10/print/PrintBook.jsx` | ประกอบสามอย่างข้างบนเป็นเล่ม |
| `pages/admin/m10/print.jsx` | หน้าเปล่า + toolbar (ซ่อนตอนพิมพ์) |
| `styles/globals.css` | **แก้:** เพิ่มบล็อก `@media print` prefix `.m10p-` |
| `components/m10/SummaryPanel.jsx` | **แก้:** ปุ่ม "พิมพ์เล่ม" ต่อแถวเดือน |
| `docs/modules/m10-ingest.md` | **แก้:** บันทึกส่วนใหม่ |

**ลำดับงาน:** Task 1 → 9 ตามลำดับ (Task 2 ต้องรอ Task 1 เพราะใช้ labels, Task 3 ต้องรอ Task 2)

---

## Task 1: labels.ts — ชื่อไทยและลำดับหมวด

**Files:**
- Create: `lib/m10-ingest/print/labels.ts`
- Test: `lib/m10-ingest/print/labels.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ต้องแดง**

```ts
// lib/m10-ingest/print/labels.test.ts
import { describe, it, expect } from "vitest";
import { docTypeLabel, changeTypeLabel, docTypeRank, changeTypeRank, periodLabel } from "./labels";

describe("labels", () => {
  it("แปลง docType เป็นชื่อไทย", () => {
    expect(docTypeLabel("PARCEL")).toBe("โฉนดที่ดิน");
    expect(docTypeLabel("CONSTRUCTION")).toBe("สิ่งปลูกสร้าง");
    expect(docTypeLabel("NS3A")).toBe("น.ส.3ก");
  });

  it("แปลง changeType เป็นชื่อไทย และกำกับว่าไม่กระทบภาษี", () => {
    expect(changeTypeLabel("TRANSFER")).toBe("โอนกรรมสิทธิ์");
    expect(changeTypeLabel("SPLIT_PUBLIC")).toBe("แบ่งหักเป็นที่สาธารณประโยชน์");
    expect(changeTypeLabel("ENCUMBRANCE")).toBe("จำนอง/ไถ่ถอน (ไม่กระทบภาษี)");
  });

  it("ค่าที่ไม่รู้จักคืนค่าเดิม ไม่ throw (ข้อมูลกรมที่ดินอาจมีของใหม่)", () => {
    expect(docTypeLabel("WEIRD")).toBe("WEIRD");
    expect(changeTypeLabel("WEIRD")).toBe("WEIRD");
    expect(docTypeLabel(null)).toBe("-");
  });

  it("ลำดับหมวดคงที่ ของไม่รู้จักไปท้ายสุด", () => {
    expect(docTypeRank("PARCEL")).toBeLessThan(docTypeRank("CONSTRUCTION"));
    expect(docTypeRank("CONSTRUCTION")).toBeLessThan(docTypeRank("NS3A"));
    expect(docTypeRank("WEIRD")).toBe(99);
    expect(changeTypeRank("TRANSFER")).toBeLessThan(changeTypeRank("MERGE"));
    expect(changeTypeRank("OWNER_CORRECTION")).toBeLessThan(changeTypeRank("ENCUMBRANCE"));
    expect(changeTypeRank("WEIRD")).toBe(99);
  });

  it("periodLabel เป็นชื่อเดือนเต็ม + พ.ศ.", () => {
    expect(periodLabel("2569-01")).toBe("มกราคม 2569");
    expect(periodLabel("2569-12")).toBe("ธันวาคม 2569");
    expect(periodLabel("mangled")).toBe("mangled");
    expect(periodLabel("")).toBe("-");
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าแดง**

Run: `npx vitest run lib/m10-ingest/print/labels.test.ts`
Expected: FAIL — `Failed to resolve import "../labels"`

- [ ] **Step 3: เขียน labels.ts**

```ts
// lib/m10-ingest/print/labels.ts
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
```

- [ ] **Step 4: รันให้เขียว**

Run: `npx vitest run lib/m10-ingest/print/labels.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/print/labels.ts lib/m10-ingest/print/labels.test.ts
git commit -m "feat(m10-print): labels ชื่อไทยและลำดับหมวดของเล่มพิมพ์"
```

---

## Task 2: export helper ของ worklist เพื่อ reuse

**ทำไม:** `identifyFields()` มี logic แปลง `UTM_MAP2` เป็นเลขโรมัน + pad `UTM_MAP4` 2 หลัก และ `ownerFields()` มี logic ตัดเลขบัตรให้เหลือเฉพาะตัวเลข ถ้าไม่ export จะต้องเขียนซ้ำในเล่มพิมพ์ = แตกต่างกันเมื่อแก้ที่เดียว

**Files:**
- Modify: `lib/m10-ingest/worklist/buildWorklistItem.ts` (3 บรรทัด — เติมคำว่า `export`)
- Test: `lib/m10-ingest/worklist/buildWorklistItem.test.ts` (ไฟล์มีอยู่แล้ว — เพิ่มเทสต์ท้ายไฟล์)

- [ ] **Step 1: เขียนเทสต์ที่ต้องแดง — ต่อท้ายไฟล์เทสต์เดิม**

```ts
// เพิ่มท้าย lib/m10-ingest/worklist/buildWorklistItem.test.ts
import { identifyFields, ownerFields, OWNER_FIELD_COLS } from "./buildWorklistItem";

describe("helper ที่เล่มพิมพ์ reuse", () => {
  const raw: Record<string, string> = {
    UTM_MAP1: "5039", UTM_MAP2: "2", UTM_MAP3: "4682", UTM_MAP4: "7", UTM_SCALE: "1000",
    "ที่ดิน": "84", "ห.สำรวจ": "13725",
    "13 หลัก": "1-2345-67890-12-3", "คำนำหน้า": "นางสาว", "ชื่อ": "ก", "นามสกุล": "ข",
    OWN_TAMBOL: "ตาคลี",
  };

  it("identifyFields แปลง UTM_MAP2 เป็นเลขโรมันและ pad UTM_MAP4 สองหลัก", () => {
    const f = identifyFields(raw, { rai: 0, ngan: 2, wa: 24, sqm: 896 });
    const byLabel = Object.fromEntries(f.map((x) => [x.label, x.value]));
    expect(byLabel["แผนที่ระวางภูมิประเทศ"]).toBe("II");
    expect(byLabel["แผ่นที่ระวางUTM"]).toBe("07");
    expect(byLabel["เลขที่ดิน"]).toBe("84");
    expect(byLabel["หน้าสำรวจ"]).toBe("13725");
    expect(byLabel["เนื้อที่: ตร.ว."]).toBe("24.00");
  });

  it("identifyFields ทำงานได้กับ area เป็น null (นิติกรรมที่ไม่มีเนื้อที่)", () => {
    const f = identifyFields(raw, null);
    const byLabel = Object.fromEntries(f.map((x) => [x.label, x.value]));
    expect(byLabel["เนื้อที่: ไร่"]).toBe("");
    expect(byLabel["ระวาง"]).toBe("5039");
  });

  it("ownerFields ตัดเลขบัตรให้เหลือเฉพาะตัวเลข", () => {
    const f = ownerFields(raw, OWNER_FIELD_COLS);
    const byLabel = Object.fromEntries(f.map((x) => [x.label, x.value]));
    expect(byLabel["เลขประจำตัวประชาชน"]).toBe("1234567890123");
    expect(byLabel["ตำบล"]).toBe("ตาคลี");
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าแดง**

Run: `npx vitest run lib/m10-ingest/worklist/buildWorklistItem.test.ts`
Expected: FAIL — `identifyFields is not exported` (หรือ `is not a function`)

- [ ] **Step 3: เติม export 3 จุดใน `buildWorklistItem.ts`**

เปลี่ยน 3 บรรทัดนี้ (เติมคำว่า `export` ข้างหน้า ไม่แก้เนื้อในฟังก์ชัน):

```ts
// เดิม: const OWNER_FIELD_COLS: { label: string; col: string }[] = [
export const OWNER_FIELD_COLS: { label: string; col: string }[] = [

// เดิม: function ownerFields(raw: Record<string, string>, cols: { label: string; col: string }[]): WorklistField[] {
export function ownerFields(raw: Record<string, string>, cols: { label: string; col: string }[]): WorklistField[] {

// เดิม: function identifyFields(raw: Record<string, string>, area: WorklistTxnInput["area"]): WorklistField[] {
export function identifyFields(raw: Record<string, string>, area: WorklistTxnInput["area"]): WorklistField[] {
```

- [ ] **Step 4: รันให้เขียว ทั้งไฟล์ (เทสต์เดิมต้องไม่พัง)**

Run: `npx vitest run lib/m10-ingest/worklist/buildWorklistItem.test.ts`
Expected: PASS — เทสต์เดิมทุกตัว + 3 ตัวใหม่

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/worklist/buildWorklistItem.ts lib/m10-ingest/worklist/buildWorklistItem.test.ts
git commit -m "refactor(m10): export identifyFields/ownerFields ให้เล่มพิมพ์ reuse ไม่เขียน logic ซ้ำ"
```

---

## Task 3: buildSheet.ts — 1 transaction → 1 แผ่นงาน

**Files:**
- Create: `lib/m10-ingest/print/buildSheet.ts`
- Test: `lib/m10-ingest/print/buildSheet.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ต้องแดง**

```ts
// lib/m10-ingest/print/buildSheet.test.ts
import { describe, it, expect } from "vitest";
import { buildSheet, type PrintTxnRow } from "./buildSheet";

const baseRaw: Record<string, string> = {
  UTM_MAP1: "5039", UTM_MAP2: "2", UTM_MAP3: "4682", UTM_MAP4: "7", UTM_SCALE: "1000",
  "ที่ดิน": "84", "ห.สำรวจ": "13725",
  "13 หลัก": "1-2345-67890-12-3", "คำนำหน้า": "นางสาว", "ชื่อ": "วรารีย์", "นามสกุล": "ชาลีรัตน์",
  OWN_HSE_NO: "99/1", OWN_TAMBOL: "ตาคลี", OWN_AMPHUR: "ตาคลี", OWN_PROVINCE: "นครสวรรค์", OWN_TEL: "0812345678",
};

function row(over: Partial<PrintTxnRow> = {}): PrintTxnRow {
  return {
    txnId: "t1",
    docType: "PARCEL",
    changeType: "TRANSFER",
    rawStatus: "ขาย",
    taxRelevant: true,
    reviewStatus: "confirmed",
    ltaxStatus: null,
    txnDate: new Date("2026-01-05T00:00:00.000Z"),
    deedNo: "31635",
    recordKey: "5039|2|4682|07|1000|84",
    area: { rai: 0, ngan: 2, wa: 24, sqm: 896 },
    regAmount: null,
    payloadRaw: baseRaw,
    parcelCode: null,
    oldOwnerName: null,
    ...over,
  };
}

describe("buildSheet", () => {
  it("หัวแผ่นใช้ rawStatus ดิบจากกรมที่ดิน ไม่ใช่ชื่อหมวด", () => {
    const s = buildSheet(row({ rawStatus: "ขายตามคำสั่งศาล" }), { seqInSection: 1, sectionTotal: 19, sheetNo: 1 });
    expect(s.rawStatus).toBe("ขายตามคำสั่งศาล");
    expect(s.docTypeLabel).toBe("โฉนดที่ดิน");
    expect(s.seqInSection).toBe(1);
    expect(s.sectionTotal).toBe(19);
    expect(s.sheetNo).toBe(1);
  });

  it("เลข 13 หลักมาจาก payloadRaw และเป็นเลขล้วน", () => {
    const s = buildSheet(row(), { seqInSection: 1, sectionTotal: 1, sheetNo: 1 });
    const byLabel = Object.fromEntries(s.owner.map((f) => [f.label, f.value]));
    expect(byLabel["เลขประจำตัวประชาชน"]).toBe("1234567890123");
  });

  it("parcelCode ว่างขึ้นป้าย 'ยังไม่จับคู่'", () => {
    expect(buildSheet(row({ parcelCode: null }), { seqInSection: 1, sectionTotal: 1, sheetNo: 1 }).parcelCode)
      .toBe("ยังไม่จับคู่");
    expect(buildSheet(row({ parcelCode: "01-0012-0034" }), { seqInSection: 1, sectionTotal: 1, sheetNo: 1 }).parcelCode)
      .toBe("01-0012-0034");
  });

  it("นิติกรรมที่มีสคริปต์ได้ steps · นิติกรรมอื่นได้กล่องว่าง", () => {
    const withSteps = buildSheet(row({ changeType: "TRANSFER" }), { seqInSection: 1, sectionTotal: 1, sheetNo: 1 });
    expect(Array.isArray(withSteps.steps)).toBe(true);
    expect(withSteps.steps!.length).toBeGreaterThan(0);
    expect(withSteps.blankResultBox).toBe(false);

    for (const ct of ["MERGE", "NEW", "SPLIT", "SPLIT_PUBLIC", "RETIRED"]) {
      const s = buildSheet(row({ changeType: ct }), { seqInSection: 1, sectionTotal: 1, sheetNo: 1 });
      expect(s.steps).toBeNull();
      expect(s.blankResultBox).toBe(true);
      // ข้อมูลยืนยันแปลงต้องมีให้ครบแม้ไม่มีสคริปต์
      expect(s.identify.length).toBeGreaterThan(0);
    }
  });

  it("ป้ายสถานะยืนยัน", () => {
    const opt = { seqInSection: 1, sectionTotal: 1, sheetNo: 1 };
    expect(buildSheet(row({ reviewStatus: "confirmed" }), opt).reviewLabel).toBe("ยืนยันแล้ว");
    expect(buildSheet(row({ reviewStatus: "pending" }), opt).reviewLabel).toBe("รอยืนยัน");
    expect(buildSheet(row({ reviewStatus: "auto" }), opt).reviewLabel).toBe("รอยืนยัน");
  });

  it("วันที่เป็น Asia/Bangkok ไม่เลื่อนวันแม้เซิร์ฟเวอร์รัน UTC", () => {
    // 2026-01-05T17:30Z = 6 ม.ค. 2569 เวลาไทย
    const s = buildSheet(row({ txnDate: new Date("2026-01-05T17:30:00.000Z") }), { seqInSection: 1, sectionTotal: 1, sheetNo: 1 });
    expect(s.txnDateLabel).toBe("6 ม.ค. 2569");
  });

  it("เจ้าของเดิมพิมพ์เฉพาะเมื่อมีข้อมูล ราคาจดทะเบียนเป็น null ไม่พิมพ์", () => {
    const opt = { seqInSection: 1, sectionTotal: 1, sheetNo: 1 };
    expect(buildSheet(row({ oldOwnerName: null }), opt).previousOwner).toBeNull();
    expect(buildSheet(row({ oldOwnerName: "นายเก่า ใจดี" }), opt).previousOwner).toBe("นายเก่า ใจดี");
    expect(buildSheet(row({ regAmount: null }), opt).regAmountLabel).toBeNull();
    expect(buildSheet(row({ regAmount: 1250000 }), opt).regAmountLabel).toBe("1,250,000 บาท");
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าแดง**

Run: `npx vitest run lib/m10-ingest/print/buildSheet.test.ts`
Expected: FAIL — `Failed to resolve import "../buildSheet"`

- [ ] **Step 3: เขียน buildSheet.ts**

```ts
// lib/m10-ingest/print/buildSheet.ts
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
  /** PARCEL_COD จาก m10_records (effective = override ?? auto) */
  parcelCode: string | null;
  oldOwnerName: string | null;
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
  owner: WorklistField[];
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

export function buildSheet(row: PrintTxnRow, pos: SheetPosition): PrintSheet {
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
    owner: ownerFields(row.payloadRaw, OWNER_FIELD_COLS),
    previousOwner: row.oldOwnerName || null,
    regAmountLabel: moneyLabel(row.regAmount),
    steps,
    blankResultBox: steps === null,
  };
}
```

- [ ] **Step 4: รันให้เขียว**

Run: `TZ=UTC npx vitest run lib/m10-ingest/print/buildSheet.test.ts`
Expected: PASS — 7 tests (รันด้วย `TZ=UTC` เพื่อพิสูจน์ว่าวันที่ไม่เลื่อน)

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/print/buildSheet.ts lib/m10-ingest/print/buildSheet.test.ts
git commit -m "feat(m10-print): buildSheet — 1 transaction เป็น 1 แผ่นงาน reuse helper ของ worklist"
```

---

## Task 4: buildBook.ts — ประกอบเล่มทั้งเล่ม

**Files:**
- Create: `lib/m10-ingest/print/buildBook.ts`
- Test: `lib/m10-ingest/print/buildBook.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ต้องแดง**

```ts
// lib/m10-ingest/print/buildBook.test.ts
import { describe, it, expect } from "vitest";
import { buildBook } from "./buildBook";
import type { PrintTxnRow } from "./buildSheet";

const raw: Record<string, string> = {
  UTM_MAP1: "5039", UTM_MAP2: "2", UTM_MAP3: "4682", UTM_MAP4: "7", UTM_SCALE: "1000",
  "ที่ดิน": "84", "ห.สำรวจ": "13725", "13 หลัก": "1234567890123",
  "คำนำหน้า": "นาย", "ชื่อ": "ก", "นามสกุล": "ข",
};

function row(over: Partial<PrintTxnRow> = {}): PrintTxnRow {
  return {
    txnId: Math.random().toString(36).slice(2),
    docType: "PARCEL", changeType: "TRANSFER", rawStatus: "ขาย",
    taxRelevant: true, reviewStatus: "confirmed", ltaxStatus: null,
    txnDate: new Date("2026-01-10T00:00:00.000Z"),
    deedNo: "1", recordKey: "k1",
    area: { rai: 0, ngan: 2, wa: 24, sqm: 896 },
    regAmount: null, payloadRaw: raw, parcelCode: null, oldOwnerName: null,
    ...over,
  };
}

describe("buildBook", () => {
  it("แยกหมวดตาม docType แล้ว changeType ตามลำดับคงที่", () => {
    const book = buildBook(
      [
        row({ docType: "NS3A", changeType: "TRANSFER" }),
        row({ docType: "PARCEL", changeType: "MERGE", rawStatus: "ให้ รวมสองโฉนด" }),
        row({ docType: "PARCEL", changeType: "TRANSFER" }),
        row({ docType: "CONSTRUCTION", changeType: "TRANSFER" }),
      ],
      { period: "2569-01" }
    );
    expect(book.sections.map((s) => `${s.docType}/${s.changeType}`)).toEqual([
      "PARCEL/TRANSFER", "PARCEL/MERGE", "CONSTRUCTION/TRANSFER", "NS3A/TRANSFER",
    ]);
    expect(book.periodLabel).toBe("มกราคม 2569");
  });

  it("หมวดที่ไม่มีรายการไม่โผล่ (ไม่มีใบคั่นหน้าเปล่า)", () => {
    const book = buildBook([row({ changeType: "TRANSFER" })], { period: "2569-01" });
    expect(book.sections).toHaveLength(1);
  });

  it("รายการที่ไม่กระทบภาษีขึ้นบัญชีคุมแต่ไม่มีแผ่นงาน", () => {
    const book = buildBook(
      [
        row({ changeType: "TRANSFER", taxRelevant: true }),
        row({ changeType: "ENCUMBRANCE", rawStatus: "จำนอง", taxRelevant: false }),
        row({ changeType: "NOTE", rawStatus: "หมายเหตุสารบัญ", taxRelevant: false }),
      ],
      { period: "2569-01" }
    );
    expect(book.sections).toHaveLength(1);
    expect(book.sections[0].changeType).toBe("TRANSFER");
    expect(book.cover.rows).toHaveLength(3);
    expect(book.cover.totals).toEqual({ all: 3, taxRelevant: 1, nonTaxRelevant: 2, sheets: 1 });
  });

  it("ยอดบนใบปกตรงกับจำนวนแผ่นงานจริงในเล่ม", () => {
    const rows = [
      ...Array.from({ length: 5 }, () => row({ changeType: "TRANSFER" })),
      ...Array.from({ length: 3 }, () => row({ changeType: "MERGE", rawStatus: "ให้ รวมสองโฉนด" })),
      ...Array.from({ length: 2 }, () => row({ changeType: "ENCUMBRANCE", rawStatus: "จำนอง", taxRelevant: false })),
    ];
    const book = buildBook(rows, { period: "2569-01" });
    const sheetCount = book.sections.reduce((a, s) => a + s.sheets.length, 0);
    expect(sheetCount).toBe(8);
    expect(book.cover.totals.sheets).toBe(8);
    expect(book.cover.totals.all).toBe(10);
  });

  it("บัญชีคุมนับ 1 แถวต่อ (ชนิดเอกสาร × rawStatus) และนับคีย์แล้ว/ค้างคีย์", () => {
    const book = buildBook(
      [
        row({ rawStatus: "ขาย", ltaxStatus: "keyed" }),
        row({ rawStatus: "ขาย", ltaxStatus: null }),
        row({ rawStatus: "โอนมรดก", ltaxStatus: "skipped" }),
      ],
      { period: "2569-01" }
    );
    const sale = book.cover.rows.find((r) => r.rawStatus === "ขาย")!;
    expect(sale.count).toBe(2);
    expect(sale.keyed).toBe(1);
    expect(sale.pendingKey).toBe(1);
    const inherit = book.cover.rows.find((r) => r.rawStatus === "โอนมรดก")!;
    expect(inherit.count).toBe(1);
    expect(inherit.keyed).toBe(0);
    expect(inherit.pendingKey).toBe(0); // skipped ไม่ใช่ค้างคีย์
  });

  it("เรียงแผ่นในหมวดตามวันที่ แล้ว tie-break ด้วยเลขโฉนด → ผลคงที่ พิมพ์ซ้ำได้เหมือนเดิม", () => {
    const rows = [
      row({ deedNo: "300", txnDate: new Date("2026-01-20T00:00:00.000Z") }),
      row({ deedNo: "200", txnDate: new Date("2026-01-05T00:00:00.000Z") }),
      row({ deedNo: "100", txnDate: new Date("2026-01-05T00:00:00.000Z") }),
    ];
    const a = buildBook(rows, { period: "2569-01" });
    const b = buildBook([...rows].reverse(), { period: "2569-01" });
    const order = (bk: ReturnType<typeof buildBook>) => bk.sections[0].sheets.map((s) => s.deedNo);
    expect(order(a)).toEqual(["100", "200", "300"]);
    expect(order(b)).toEqual(["100", "200", "300"]);
  });

  it("ลำดับหน้าเดินต่อเนื่องข้ามหมวด และลำดับในหมวดเริ่มที่ 1", () => {
    const book = buildBook(
      [
        row({ changeType: "TRANSFER", deedNo: "1" }),
        row({ changeType: "TRANSFER", deedNo: "2" }),
        row({ changeType: "MERGE", rawStatus: "ให้ รวมสองโฉนด", deedNo: "3" }),
      ],
      { period: "2569-01" }
    );
    expect(book.sections[0].sheets.map((s) => [s.seqInSection, s.sectionTotal, s.sheetNo]))
      .toEqual([[1, 2, 1], [2, 2, 2]]);
    expect(book.sections[1].sheets.map((s) => [s.seqInSection, s.sectionTotal, s.sheetNo]))
      .toEqual([[1, 1, 3]]);
  });

  it("ไม่มีรายการเลย → เล่มว่างแต่ไม่ throw", () => {
    const book = buildBook([], { period: "2569-01" });
    expect(book.sections).toHaveLength(0);
    expect(book.cover.rows).toHaveLength(0);
    expect(book.cover.totals).toEqual({ all: 0, taxRelevant: 0, nonTaxRelevant: 0, sheets: 0 });
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าแดง**

Run: `npx vitest run lib/m10-ingest/print/buildBook.test.ts`
Expected: FAIL — `Failed to resolve import "../buildBook"`

- [ ] **Step 3: เขียน buildBook.ts**

```ts
// lib/m10-ingest/print/buildBook.ts
// หลายแถว → เล่มพิมพ์ทั้งเล่ม (ใบปก + หมวด + ลำดับหน้า) · pure ไม่แตะ DB
import { buildSheet, type PrintSheet, type PrintTxnRow } from "./buildSheet";
import { changeTypeLabel, changeTypeRank, docTypeLabel, docTypeRank, periodLabel } from "./labels";

export interface PrintCoverRow {
  docType: string;
  docTypeLabel: string;
  rawStatus: string;
  changeType: string;
  changeTypeLabel: string;
  taxRelevant: boolean;
  count: number;
  keyed: number;
  pendingKey: number;
}

export interface PrintTotals {
  all: number;
  taxRelevant: number;
  nonTaxRelevant: number;
  sheets: number;
}

export interface PrintSection {
  docType: string;
  docTypeLabel: string;
  changeType: string;
  changeTypeLabel: string;
  count: number;
  sheets: PrintSheet[];
}

export interface PrintBookData {
  period: string;
  periodLabel: string;
  cover: { rows: PrintCoverRow[]; totals: PrintTotals };
  sections: PrintSection[];
}

/** เรียงแผ่นในหมวด: วันที่ → เลขโฉนด → recordKey (ผลคงที่ พิมพ์ซ้ำได้เหมือนเดิม) */
function compareRows(a: PrintTxnRow, b: PrintTxnRow): number {
  const ta = new Date(a.txnDate).getTime();
  const tb = new Date(b.txnDate).getTime();
  if (ta !== tb) return ta - tb;
  const da = a.deedNo ?? "";
  const db = b.deedNo ?? "";
  if (da !== db) return da < db ? -1 : 1;
  const ka = a.recordKey ?? "";
  const kb = b.recordKey ?? "";
  return ka === kb ? 0 : ka < kb ? -1 : 1;
}

function isPendingKey(row: PrintTxnRow): boolean {
  if (!row.taxRelevant) return false;
  return row.ltaxStatus !== "keyed" && row.ltaxStatus !== "skipped";
}

export function buildBook(rows: PrintTxnRow[], opts: { period: string }): PrintBookData {
  // ---- ใบปก: 1 แถวต่อ (docType × rawStatus) ----
  const coverMap = new Map<string, PrintCoverRow>();
  for (const r of rows) {
    const key = `${r.docType} ${r.rawStatus}`;
    const cur = coverMap.get(key);
    if (cur) {
      cur.count += 1;
      if (r.ltaxStatus === "keyed") cur.keyed += 1;
      if (isPendingKey(r)) cur.pendingKey += 1;
      continue;
    }
    coverMap.set(key, {
      docType: r.docType,
      docTypeLabel: docTypeLabel(r.docType),
      rawStatus: r.rawStatus || "-",
      changeType: r.changeType,
      changeTypeLabel: changeTypeLabel(r.changeType),
      taxRelevant: r.taxRelevant,
      count: 1,
      keyed: r.ltaxStatus === "keyed" ? 1 : 0,
      pendingKey: isPendingKey(r) ? 1 : 0,
    });
  }
  const coverRows = [...coverMap.values()].sort((a, b) =>
    docTypeRank(a.docType) - docTypeRank(b.docType) ||
    changeTypeRank(a.changeType) - changeTypeRank(b.changeType) ||
    (a.rawStatus === b.rawStatus ? 0 : a.rawStatus < b.rawStatus ? -1 : 1)
  );

  // ---- หมวด/แผ่นงาน: เฉพาะรายการที่กระทบภาษี ----
  const groups = new Map<string, PrintTxnRow[]>();
  for (const r of rows) {
    if (!r.taxRelevant) continue;
    const key = `${r.docType} ${r.changeType}`;
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  const orderedKeys = [...groups.keys()].sort((a, b) => {
    const [ad, ac] = a.split(" ");
    const [bd, bc] = b.split(" ");
    return docTypeRank(ad) - docTypeRank(bd) || changeTypeRank(ac) - changeTypeRank(bc);
  });

  let sheetNo = 0;
  const sections: PrintSection[] = orderedKeys.map((key) => {
    const [docType, changeType] = key.split(" ");
    const list = [...groups.get(key)!].sort(compareRows);
    const sheets = list.map((r, i) =>
      buildSheet(r, { seqInSection: i + 1, sectionTotal: list.length, sheetNo: ++sheetNo })
    );
    return {
      docType,
      docTypeLabel: docTypeLabel(docType),
      changeType,
      changeTypeLabel: changeTypeLabel(changeType),
      count: sheets.length,
      sheets,
    };
  });

  const taxRelevant = rows.filter((r) => r.taxRelevant).length;
  return {
    period: opts.period,
    periodLabel: periodLabel(opts.period),
    cover: {
      rows: coverRows,
      totals: {
        all: rows.length,
        taxRelevant,
        nonTaxRelevant: rows.length - taxRelevant,
        sheets: sheetNo,
      },
    },
    sections,
  };
}
```

- [ ] **Step 4: รันให้เขียว**

Run: `TZ=UTC npx vitest run lib/m10-ingest/print/`
Expected: PASS — labels 5 + buildSheet 7 + buildBook 8 = 20 tests

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/print/buildBook.ts lib/m10-ingest/print/buildBook.test.ts
git commit -m "feat(m10-print): buildBook ประกอบเล่ม (ใบปก + หมวด + ลำดับหน้า)"
```

---

## Task 5: repository — `listPrintRows(period)`

**Files:**
- Modify: `lib/m10-ingest/repository/index.ts` (เพิ่ม import type ที่หัวไฟล์ + ฟังก์ชันท้ายไฟล์)
- Test: `lib/m10-ingest/repository/print.test.ts`

ชั้น repository ของโมดูลนี้ **มีเทสต์** (ดู `repository/worklist.test.ts` ใช้ mongodb-memory-server)
ทำตาม pattern เดิม

- [ ] **Step 1: เขียนเทสต์ที่ต้องแดง**

```ts
// lib/m10-ingest/repository/print.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createBatch, insertTransactionDedup, confirmTransaction, listPrintRows } from "./index";
import type { NormalizedTxn } from "../types";

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });

function txn(over: Partial<NormalizedTxn> = {}): NormalizedTxn {
  return {
    docType: "PARCEL", recordKey: "K1", deedNo: "31635", rawStatus: "ขาย",
    changeType: "TRANSFER", taxRelevant: true, reviewStatus: "pending",
    txnDate: "2026-01-05", regAmount: null,
    owner: { title: "นางสาว", name: "วรารีย์", surname: "ชาลีรัตน์", fullName: "นางสาว วรารีย์ ชาลีรัตน์", idHash: "h" },
    area: { rai: 0, ngan: 2, wa: 24, sqm: 896 },
    payloadRaw: { "โฉนด": "31635", "คำนำหน้า": "นางสาว", "ชื่อ": "วรารีย์", "นามสกุล": "ชาลีรัตน์", "13 หลัก": "1609700018248", OWN_TAMBOL: "ตาคลี" },
    ...over,
  };
}

describe("listPrintRows", () => {
  it("งวดที่ไม่มี batch คืนว่างและ batchCount 0 (ให้ API ตอบ 404 ได้)", async () => {
    const out = await listPrintRows("2569-01");
    expect(out.batchCount).toBe(0);
    expect(out.rows).toHaveLength(0);
  });

  it("คืนทุก txn ของงวดนั้น ไม่กรองตาม reviewStatus (พิมพ์ได้ทันทีหลังอัปโหลด)", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    await insertTransactionDedup(b._id, txn({ recordKey: "K2", deedNo: "2", rawStatus: "จำนอง", changeType: "ENCUMBRANCE", taxRelevant: false, reviewStatus: "auto" }));
    const out = await listPrintRows("2569-01");
    expect(out.batchCount).toBe(1);
    expect(out.rows).toHaveLength(2);
    expect(out.rows.map((r) => r.reviewStatus).sort()).toEqual(["auto", "pending"]);
    // ต้องส่ง payloadRaw มาเต็ม เพราะเลข 13 หลักอยู่ในนี้เท่านั้น
    expect(out.rows[0].payloadRaw["13 หลัก"]).toBe("1609700018248");
  });

  it("ไม่เอา txn ของงวดอื่นมาปน", async () => {
    const a = await createBatch({ fileHash: "hA", period: "2569-01", files: [], counts: {} });
    const c = await createBatch({ fileHash: "hC", period: "2569-02", files: [], counts: {} });
    await insertTransactionDedup(a._id, txn());
    await insertTransactionDedup(c._id, txn({ recordKey: "K9", deedNo: "9" }));
    expect((await listPrintRows("2569-01")).rows).toHaveLength(1);
    expect((await listPrintRows("2569-02")).rows).toHaveLength(1);
  });

  it("นับ batchCount ทุก batch ของงวดเดียวกัน (กรณี re-import)", async () => {
    const b1 = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    const b2 = await createBatch({ fileHash: "h2", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b1._id, txn());
    await insertTransactionDedup(b2._id, txn({ recordKey: "K2", deedNo: "2" }));
    const out = await listPrintRows("2569-01");
    expect(out.batchCount).toBe(2);
    expect(out.rows).toHaveLength(2);
  });

  it("parcelCode มาจาก m10_records ที่ recordKey ตรงกัน (ไม่มี record → null)", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    const t = await insertTransactionDedup(b._id, txn());
    // ยังไม่ confirm → ยังไม่มี record → parcelCode null
    expect((await listPrintRows("2569-01")).rows[0].parcelCode).toBeNull();
    // confirm แล้ว record เกิด (แต่ยังไม่มี basemap ให้จับคู่ → parcelCode ยัง null)
    await confirmTransaction(t.doc._id, "officer");
    const rows = (await listPrintRows("2569-01")).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].reviewStatus).toBe("confirmed");
  });

  it("เจ้าของเดิมมาจากประวัติที่ยืนยันแล้วก่อนต้นงวด", async () => {
    // งวดเก่า: โอนให้ 'นายเก่า' แล้ว confirm → เป็นเจ้าของตั้งต้น
    const old = await createBatch({ fileHash: "hOld", period: "2568-12", files: [], counts: {} });
    const t0 = await insertTransactionDedup(old._id, txn({
      txnDate: "2025-12-10",
      owner: { title: "นาย", name: "เก่า", surname: "ใจดี", fullName: "นาย เก่า ใจดี", idHash: "h0" },
    }));
    await confirmTransaction(t0.doc._id, "officer");
    // งวดใหม่: โอนแปลงเดิมต่อ
    const cur = await createBatch({ fileHash: "hCur", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(cur._id, txn({ txnDate: "2026-01-05" }));
    const rows = (await listPrintRows("2569-01")).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].oldOwnerName).toBe("นาย เก่า ใจดี");
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าแดง**

Run: `npx vitest run lib/m10-ingest/repository/print.test.ts`
Expected: FAIL — `listPrintRows is not a function` (หรือ import error)

- [ ] **Step 3: เพิ่ม import type ที่หัวไฟล์ `lib/m10-ingest/repository/index.ts`**

เติมบรรทัดนี้ต่อจาก import ของ `buildWorklistItem` (บรรทัด ~3):

```ts
import type { PrintTxnRow } from "../print/buildSheet";
```

- [ ] **Step 4: เพิ่มฟังก์ชันท้าย `lib/m10-ingest/repository/index.ts`**

```ts
// ---- เล่มพิมพ์รายเดือน ----
// เจ้าของเดิม: replay ครั้งเดียวที่ต้นงวด (ไม่ใช่ต่อรายการเหมือน getWorklistItem ที่เรียก
// asOfMaterialize ทุกครั้ง — 60+ แผ่นจะช้ามาก) ข้อแลกเปลี่ยน: แปลงที่มี 2 นิติกรรมใน
// เดือนเดียวกันจะเห็นเจ้าของ ณ ต้นเดือน ไม่ใช่เจ้าของก่อนนิติกรรมนั้นทันที
export async function listPrintRows(period: string): Promise<{
  rows: PrintTxnRow[];
  batchCount: number;
}> {
  const batches = await M10ImportBatch.find({ period }).select("_id").lean();
  if (batches.length === 0) return { rows: [], batchCount: 0 };
  const batchIds = batches.map((b: { _id: unknown }) => b._id);

  const txns = await M10Transaction.find({ batchId: { $in: batchIds } })
    .sort({ txnDate: 1, createdAt: 1 })
    .lean();
  if (txns.length === 0) return { rows: [], batchCount: batches.length };

  // parcelCode effective ต่อ recordKey (override ของ จนท. ชนะ auto)
  const recordKeys = [...new Set(txns.map((t: { recordKey?: string }) => t.recordKey).filter(Boolean))] as string[];
  const records = await M10Record.find({ recordKey: { $in: recordKeys } })
    .select("recordKey parcelCode reconcileOverride.parcelCode")
    .lean();
  const codeByKey = new Map<string, string | null>();
  for (const r of records) {
    codeByKey.set(r.recordKey, r.reconcileOverride?.parcelCode ?? r.parcelCode ?? null);
  }

  // เจ้าของเดิม ณ ต้นงวด — replay ครั้งเดียว
  const firstTxnTime = Math.min(...txns.map((t: { txnDate: Date }) => new Date(t.txnDate).getTime()));
  const asOf = await asOfMaterialize(new Date(firstTxnTime - 1));
  const ownerByKey = new Map<string, string>();
  for (const rec of asOf) {
    const name = rec.owners?.[0]?.fullName;
    if (rec.recordKey && name) ownerByKey.set(rec.recordKey, name);
  }

  const rows: PrintTxnRow[] = txns.map((t: Record<string, unknown>) => {
    const recordKey = (t.recordKey as string) ?? null;
    return {
      txnId: String(t._id),
      docType: (t.docType as string) ?? "",
      changeType: (t.changeType as string) ?? "",
      rawStatus: (t.rawStatus as string) ?? "",
      taxRelevant: t.taxRelevant === true,
      reviewStatus: (t.reviewStatus as string) ?? "",
      ltaxStatus: (t.ltaxStatus as string) ?? null,
      txnDate: t.txnDate as Date,
      deedNo: (t.deedNo as string) ?? null,
      recordKey,
      area: (t.area as PrintTxnRow["area"]) ?? null,
      regAmount: (t.regAmount as number) ?? null,
      payloadRaw: (t.payloadRaw as Record<string, string>) ?? {},
      parcelCode: recordKey ? codeByKey.get(recordKey) ?? null : null,
      oldOwnerName: recordKey ? ownerByKey.get(recordKey) ?? null : null,
    };
  });

  return { rows, batchCount: batches.length };
}
```

- [ ] **Step 5: รันให้เขียว**

Run: `npx vitest run lib/m10-ingest/repository/print.test.ts`
Expected: PASS — 6 tests (รอบแรกอาจช้าเพราะ mongodb-memory-server ดาวน์โหลด binary)

- [ ] **Step 6: ยืนยันกับข้อมูลจริงในฐาน (นอกเหนือจากเทสต์)**

```bash
cat > /tmp/m10-print-check.mjs <<'EOF'
import { createRequire } from 'node:module';
const require = createRequire(process.cwd() + '/package.json');
const { register } = require('tsx/esm/api');
register();
const repo = await import(process.cwd() + '/lib/m10-ingest/repository/index.ts');
const { buildBook } = await import(process.cwd() + '/lib/m10-ingest/print/buildBook.ts');
const { rows, batchCount } = await repo.listPrintRows('2569-01');
const book = buildBook(rows, { period: '2569-01' });
console.log('batchCount =', batchCount, '· rows =', rows.length);
console.log('totals =', book.cover.totals);
for (const s of book.sections) console.log(` ${s.docTypeLabel} / ${s.changeTypeLabel} = ${s.count}`);
console.log('parcelCode ที่จับคู่ได้ =', rows.filter(r => r.parcelCode).length);
console.log('เจ้าของเดิมที่หาได้ =', rows.filter(r => r.oldOwnerName).length);
process.exit(0);
EOF
node --env-file=.env.local /tmp/m10-print-check.mjs
rm /tmp/m10-print-check.mjs
```

Expected (งวด 2569-01 ตามฐานวันที่เขียนแผน):
```
batchCount = 1 · rows = 87
totals = { all: 87, taxRelevant: 63, nonTaxRelevant: 24, sheets: 63 }
 โฉนดที่ดิน / โอนกรรมสิทธิ์ = 19
 โฉนดที่ดิน / ให้เฉพาะส่วน = 1
 โฉนดที่ดิน / รวมโฉนด = 10
 โฉนดที่ดิน / เอกสารสิทธิเกิดใหม่ = 10
 โฉนดที่ดิน / แบ่งแยกในนามเดิม = 5
 โฉนดที่ดิน / แบ่งหักเป็นที่สาธารณประโยชน์ = 3
 โฉนดที่ดิน / สอบเขตโฉนดที่ดิน = 2
 โฉนดที่ดิน / แก้ชื่อเจ้าของ = 1
 สิ่งปลูกสร้าง / โอนกรรมสิทธิ์ = 8
 น.ส.3ก / โอนกรรมสิทธิ์ = 2
 น.ส.3ก / ยกเลิกเอกสารสิทธิ = 2
```
ถ้าตัวเลขไม่ตรง **หยุดแล้วหาสาเหตุก่อนไปต่อ** — แปลว่า query หรือการจัดหมวดผิด

- [ ] **Step 7: Commit**

```bash
git add lib/m10-ingest/repository/index.ts lib/m10-ingest/repository/print.test.ts
git commit -m "feat(m10-print): listPrintRows + เทสต์ (ทุก reviewStatus, parcelCode effective, เจ้าของเดิม)"
```

---

## Task 6: API endpoint + audit log

**Files:**
- Create: `pages/api/m10-ingest/print.js`

- [ ] **Step 1: เขียน handler**

```js
// pages/api/m10-ingest/print.js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "./_auth";
import { logAuditEvent } from "@/lib/auditLogger";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const period = String(req.query.period || "");
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return res.status(400).json({ error: "period ต้องเป็นรูปแบบ YYYY-MM เช่น 2569-01" });
  }

  await dbConnect();
  const { listPrintRows } = await import("@/lib/m10-ingest/repository/index");
  const { buildBook } = await import("@/lib/m10-ingest/print/buildBook");

  const { rows, batchCount } = await listPrintRows(period);
  if (batchCount === 0) {
    return res.status(404).json({ error: `ยังไม่มีข้อมูลนำเข้าของงวด ${period}` });
  }

  const book = buildBook(rows, { period });

  // เอกสารชุดนี้พิมพ์เลขบัตร 13 หลักเต็ม — บันทึกทุกครั้งที่มีการเปิด/สั่งพิมพ์
  await logAuditEvent({
    actorClerkId: auth.userId,
    actorName: auth.name || "",
    action: "data_exported",
    resourceType: "system",
    resourceId: `m10-print:${period}`,
    description: `พิมพ์เล่มบัญชีคุมนิติกรรม งวด ${book.periodLabel}`,
    meta: {
      module: "m10-print",
      period,
      sheets: book.cover.totals.sheets,
      rows: book.cover.totals.all,
    },
  });

  return res.status(200).json({
    ...book,
    batchCount,
    printedAt: new Date().toISOString(),
    printedBy: auth.name || "",
  });
}
```

- [ ] **Step 2: ตรวจว่า `logAuditEvent` รับพารามิเตอร์ตรงตามนี้**

Run: `sed -n '40,75p' lib/auditLogger.ts`
Expected: เห็น interface `AuditParams` ที่มี field `actorClerkId`, `actorName`, `action`, `resourceType`, `resourceId`, `description`, `meta`
**ถ้าชื่อ field ไม่ตรง ให้แก้ให้ตรงกับของจริง** (ห้ามเดา — ผิดแล้ว audit จะ throw แล้วทำให้พิมพ์ไม่ได้)

- [ ] **Step 3: ยืนยันว่า route ไม่ชนกับ dynamic slug ที่มีอยู่**

Run: `find pages/api/m10-ingest -maxdepth 1 -type f -o -maxdepth 1 -type d | sort`
Expected: ไม่มีไฟล์/โฟลเดอร์ชื่อ `[...]` ระดับเดียวกับ `print.js` (บทเรียนเดิม: dynamic slug ชนกันทำ dev server ล้มทั้งตัว)

- [ ] **Step 4: ทดสอบด้วย dev server**

```bash
rm -rf .next && npm run dev
```
เปิดเบราว์เซอร์ที่ `http://localhost:3000/api/m10-ingest/print?period=2569-01` (ต้องล็อกอินแอดมินอยู่)
Expected: JSON ที่มี `periodLabel: "มกราคม 2569"`, `cover.totals.sheets: 63`, `sections` 11 ก้อน
ลอง `?period=abc` → 400 · `?period=2570-01` → 404

- [ ] **Step 5: Commit**

```bash
git add pages/api/m10-ingest/print.js
git commit -m "feat(m10-print): API GET /api/m10-ingest/print + audit log ทุกครั้งที่สั่งพิมพ์"
```

---

## Task 7: components ของเล่ม

**Files:**
- Create: `components/m10/print/CoverSheet.jsx`
- Create: `components/m10/print/SectionDivider.jsx`
- Create: `components/m10/print/WorkSheet.jsx`
- Create: `components/m10/print/PrintBook.jsx`

component ทั้งหมด **รับ props แล้วเรนเดอร์** ห้ามคำนวณยอด/ลำดับซ้ำ (API คำนวณมาแล้ว)

- [ ] **Step 1: `CoverSheet.jsx`**

```jsx
// components/m10/print/CoverSheet.jsx
// ใบปก = บัญชีคุมนิติกรรมรายเดือน
export default function CoverSheet({ book }) {
  const { cover, periodLabel, batchCount, printedAt, printedBy } = book;
  const printedLabel = printedAt
    ? new Date(printedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "long", timeStyle: "short" })
    : "-";

  return (
    <section className="m10p-cover">
      <header className="m10p-head">
        <h1>เทศบาลเมืองตาคลี</h1>
        <h2>บัญชีคุมนิติกรรมที่ดินและสิ่งปลูกสร้าง</h2>
        <h3>ประจำเดือน {periodLabel}</h3>
        <p className="m10p-meta">
          งวดข้อมูล {book.period} · นำเข้า {batchCount} ครั้ง · พิมพ์เมื่อ {printedLabel}
          {printedBy ? ` · โดย ${printedBy}` : ""}
        </p>
      </header>

      <table className="m10p-table">
        <thead>
          <tr>
            <th>ชนิดเอกสาร</th>
            <th>นิติกรรม</th>
            <th>หมวด</th>
            <th>กระทบภาษี</th>
            <th className="m10p-num">จำนวน</th>
            <th className="m10p-num">คีย์แล้ว</th>
            <th className="m10p-num">ค้างคีย์</th>
          </tr>
        </thead>
        <tbody>
          {cover.rows.map((r, i) => (
            <tr key={`${r.docType}-${r.rawStatus}-${i}`}>
              <td>{r.docTypeLabel}</td>
              <td>{r.rawStatus}</td>
              <td>{r.changeTypeLabel}</td>
              <td className="m10p-center">{r.taxRelevant ? "✓" : "—"}</td>
              <td className="m10p-num">{r.count}</td>
              <td className="m10p-num">{r.taxRelevant ? r.keyed : "—"}</td>
              <td className="m10p-num">{r.taxRelevant ? r.pendingKey : "—"}</td>
            </tr>
          ))}
          {cover.rows.length === 0 && (
            <tr><td colSpan={7} className="m10p-center">ไม่มีรายการในงวดนี้</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={4}>รวม</th>
            <th className="m10p-num">{cover.totals.all}</th>
            <th colSpan={2} className="m10p-num">
              กระทบภาษี {cover.totals.taxRelevant} · ไม่กระทบ {cover.totals.nonTaxRelevant}
            </th>
          </tr>
          <tr>
            <th colSpan={7}>จำนวนแผ่นงานในเล่ม {cover.totals.sheets} แผ่น</th>
          </tr>
        </tfoot>
      </table>

      <div className="m10p-signs">
        <div><span className="m10p-line" />ผู้จัดทำ</div>
        <div><span className="m10p-line" />หัวหน้าฝ่ายแผนที่ภาษีและทะเบียนทรัพย์สิน</div>
        <div><span className="m10p-line" />ผู้อำนวยการกองคลัง</div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: `SectionDivider.jsx`**

```jsx
// components/m10/print/SectionDivider.jsx
// ใบคั่นหมวด — ตัวใหญ่ให้เห็นตอนแยกกองกระดาษ
export default function SectionDivider({ section, firstSheetNo, lastSheetNo }) {
  return (
    <section className="m10p-divider">
      <p className="m10p-divider-doc">{section.docTypeLabel}</p>
      <h2 className="m10p-divider-title">{section.changeTypeLabel}</h2>
      <p className="m10p-divider-count">{section.count} รายการ</p>
      <p className="m10p-divider-range">แผ่นที่ {firstSheetNo}–{lastSheetNo} ของเล่ม</p>
    </section>
  );
}
```

- [ ] **Step 3: `WorkSheet.jsx`**

```jsx
// components/m10/print/WorkSheet.jsx
// แผ่นงานรายแปลง 5 บล็อก
function FieldRows({ fields }) {
  return (
    <dl className="m10p-fields">
      {fields.map((f, i) => (
        <div key={i} className="m10p-field">
          <dt>{f.label}</dt>
          <dd>{f.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function WorkSheet({ sheet, sectionLabel }) {
  return (
    <section className="m10p-sheet">
      <header className="m10p-sheet-head">
        <div>
          <strong className="m10p-sheet-status">{sheet.rawStatus}</strong>
          <span className="m10p-sheet-sub">
            {sheet.docTypeLabel} · {sectionLabel} · จดทะเบียน {sheet.txnDateLabel}
          </span>
        </div>
        <div className="m10p-sheet-seq">
          <span>{sheet.seqInSection}/{sheet.sectionTotal} ในหมวด</span>
          <span>แผ่นที่ {sheet.sheetNo}</span>
          <span className="m10p-badge">{sheet.reviewLabel}</span>
        </div>
      </header>

      <h4>ข้อมูลยืนยันแปลง</h4>
      <div className="m10p-keyvals">
        <div className="m10p-field"><dt>เลขโฉนด</dt><dd>{sheet.deedNo}</dd></div>
        <div className="m10p-field"><dt>รหัสแปลง (PARCEL_COD)</dt><dd>{sheet.parcelCode}</dd></div>
      </div>
      <FieldRows fields={sheet.identify} />

      <h4>เจ้าของ</h4>
      <FieldRows fields={sheet.owner} />
      {sheet.previousOwner && (
        <p className="m10p-note">เจ้าของเดิมที่ต้องลบออกจาก LTAX: <strong>{sheet.previousOwner}</strong></p>
      )}
      {sheet.regAmountLabel && <p className="m10p-note">ราคาจดทะเบียน: {sheet.regAmountLabel}</p>}

      <h4>{sheet.blankResultBox ? "ผลการดำเนินการ" : "ขั้นตอนคีย์ LTAX"}</h4>
      {sheet.blankResultBox ? (
        <div className="m10p-blank" />
      ) : (
        <ol className="m10p-steps">
          {sheet.steps.map((s, i) =>
            s.copyable
              ? <li key={i} className="m10p-step-field"><span>{s.label}</span><b>{s.value || "—"}</b></li>
              : <li key={i} className="m10p-step-note">{s.label}</li>
          )}
        </ol>
      )}

      <footer className="m10p-sheet-foot">
        <span>☐ คีย์ LTAX แล้ว</span>
        <span>ผู้คีย์ <span className="m10p-line-sm" /></span>
        <span>วันที่ <span className="m10p-line-sm" /></span>
        <span>หมายเหตุ <span className="m10p-line-sm" /></span>
        <em>เอกสารใช้ในราชการ — มีข้อมูลส่วนบุคคล</em>
      </footer>
    </section>
  );
}
```

- [ ] **Step 4: `PrintBook.jsx`**

```jsx
// components/m10/print/PrintBook.jsx
import CoverSheet from "./CoverSheet";
import SectionDivider from "./SectionDivider";
import WorkSheet from "./WorkSheet";

export default function PrintBook({ book }) {
  return (
    <div className="m10p-book">
      <CoverSheet book={book} />
      {book.sections.map((section) => (
        <div key={`${section.docType}-${section.changeType}`}>
          <SectionDivider
            section={section}
            firstSheetNo={section.sheets[0]?.sheetNo ?? 0}
            lastSheetNo={section.sheets[section.sheets.length - 1]?.sheetNo ?? 0}
          />
          {section.sheets.map((sheet) => (
            <WorkSheet key={sheet.txnId} sheet={sheet} sectionLabel={section.changeTypeLabel} />
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add components/m10/print
git commit -m "feat(m10-print): component ใบปก/ใบคั่น/แผ่นงาน/เล่ม (เรนเดอร์ล้วน)"
```

---

## Task 8: หน้า print + print CSS

**Files:**
- Create: `pages/admin/m10/print.jsx`
- Modify: `styles/globals.css` (เพิ่มท้ายไฟล์)

- [ ] **Step 1: เขียนหน้า `pages/admin/m10/print.jsx`**

```jsx
// pages/admin/m10/print.jsx
// หน้าเล่มพิมพ์ — ไม่ใช้ LayoutAdmin เพราะ sidebar/nav จะติดไปในกระดาษ
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import PrintBook from "@/components/m10/print/PrintBook";

export default function M10PrintPage() {
  const router = useRouter();
  const { period, compact } = router.query;
  const [book, setBook] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const isCompact = compact === "1";

  useEffect(() => {
    if (!router.isReady) return;
    if (!period) { setError("ไม่ได้ระบุงวด (period)"); setLoading(false); return; }
    (async () => {
      setLoading(true); setError("");
      try {
        const res = await fetch(`/api/m10-ingest/print?period=${encodeURIComponent(period)}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "โหลดข้อมูลล้มเหลว");
        setBook(d);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [router.isReady, period]);

  function toggleCompact() {
    router.replace({ pathname: router.pathname, query: { period, ...(isCompact ? {} : { compact: "1" }) } });
  }

  return (
    <div className={isCompact ? "m10p-root m10p-compact" : "m10p-root"}>
      <div className="m10p-toolbar">
        <button className="btn btn-primary btn-sm" onClick={() => window.print()} disabled={!book}>
          พิมพ์
        </button>
        <button className="btn btn-sm" onClick={toggleCompact} disabled={!book}>
          {isCompact ? "กลับเป็น 1 รายการ/หน้า" : "ประหยัดกระดาษ (2 รายการ/หน้า)"}
        </button>
        <a className="btn btn-ghost btn-sm" href="/admin/m10?tab=summary">กลับหน้าสรุป</a>
        {book && (
          <span className="m10p-toolbar-info">
            {book.periodLabel} · {book.cover.totals.sheets} แผ่นงาน · {book.sections.length} หมวด
          </span>
        )}
      </div>

      {loading && <p className="m10p-msg">กำลังโหลด…</p>}
      {error && <p className="m10p-msg m10p-error">{error}</p>}
      {book && <PrintBook book={book} />}
    </div>
  );
}
```

- [ ] **Step 2: เพิ่ม print CSS ท้าย `styles/globals.css`**

```css
/* ── เล่มพิมพ์บัญชีคุมนิติกรรม ม.10 (prefix .m10p-) ─────────────────────
   ห้ามพึ่งสีพื้นหลัง: เครื่องพิมพ์ปิด background graphics เป็นค่าเริ่มต้น → ใช้เส้นขอบ */
.m10p-root { background: #fff; color: #000; padding: 16px; }
.m10p-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
.m10p-toolbar-info { font-size: 13px; opacity: 0.7; }
.m10p-msg { padding: 24px; }
.m10p-error { color: #b91c1c; }

.m10p-cover, .m10p-divider, .m10p-sheet {
  border: 1px solid #000; padding: 14px; margin-bottom: 16px; font-size: 11pt; line-height: 1.5;
}
.m10p-head { text-align: center; margin-bottom: 12px; }
.m10p-head h1 { font-size: 16pt; font-weight: 700; }
.m10p-head h2 { font-size: 13pt; }
.m10p-head h3 { font-size: 12pt; margin-top: 4px; }
.m10p-meta { font-size: 10pt; margin-top: 6px; }

.m10p-table { width: 100%; border-collapse: collapse; }
.m10p-table th, .m10p-table td { border: 1px solid #000; padding: 4px 6px; font-size: 10pt; }
.m10p-num { text-align: right; font-variant-numeric: tabular-nums; }
.m10p-center { text-align: center; }

.m10p-signs { display: flex; justify-content: space-between; gap: 16px; margin-top: 48px; text-align: center; font-size: 10pt; }
.m10p-line { display: block; border-bottom: 1px dotted #000; height: 1px; margin-bottom: 4px; }
.m10p-line-sm { display: inline-block; border-bottom: 1px dotted #000; width: 90px; }

.m10p-divider { text-align: center; padding: 40px 14px; }
.m10p-divider-doc { font-size: 12pt; }
.m10p-divider-title { font-size: 22pt; font-weight: 700; margin: 8px 0; }
.m10p-divider-count { font-size: 14pt; }
.m10p-divider-range { font-size: 10pt; margin-top: 8px; }

.m10p-sheet h4 { font-size: 11pt; font-weight: 700; border-bottom: 1px solid #000; margin: 10px 0 6px; }
.m10p-sheet-head { display: flex; justify-content: space-between; gap: 12px; }
.m10p-sheet-status { font-size: 14pt; display: block; }
.m10p-sheet-sub { font-size: 10pt; }
.m10p-sheet-seq { text-align: right; font-size: 10pt; display: flex; flex-direction: column; }
.m10p-badge { border: 1px solid #000; padding: 0 4px; display: inline-block; margin-top: 2px; }

.m10p-fields, .m10p-keyvals { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px 16px; }
.m10p-field { display: flex; gap: 6px; font-size: 10pt; border-bottom: 1px dotted #999; }
.m10p-field dt { min-width: 130px; }
.m10p-field dd { font-weight: 600; }
.m10p-note { font-size: 10pt; margin-top: 4px; }
.m10p-steps { font-size: 10pt; padding-left: 4px; }
.m10p-step-note { font-weight: 600; margin-top: 4px; list-style: none; }
.m10p-step-field { display: flex; gap: 8px; list-style: none; border-bottom: 1px dotted #999; }
.m10p-step-field span { min-width: 160px; }
.m10p-blank { border: 1px solid #000; height: 110px; }
.m10p-sheet-foot { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; font-size: 9pt; margin-top: 10px; border-top: 1px solid #000; padding-top: 6px; }
.m10p-sheet-foot em { margin-left: auto; }

@media print {
  @page { size: A4 portrait; margin: 12mm; }
  .m10p-toolbar, .m10p-msg { display: none !important; }
  .m10p-root { padding: 0; }
  .m10p-cover, .m10p-divider, .m10p-sheet { border: none; margin: 0; break-after: page; }
  .m10p-cover, .m10p-divider, .m10p-sheet { break-inside: avoid; }
  /* หัวตารางบัญชีคุมซ้ำทุกหน้าเมื่อตารางยาวข้ามหน้า */
  .m10p-table thead { display: table-header-group; }
  /* ประหยัดกระดาษ: แผ่นที่ไม่มีสคริปต์ขั้นตอนอยู่ได้ 2 รายการ/หน้า */
  .m10p-compact .m10p-sheet { break-after: auto; padding-bottom: 8px; border-bottom: 1px dashed #000; }
  .m10p-compact .m10p-divider { break-after: page; }
}
```

- [ ] **Step 3: ตรวจว่า route ไม่ชนกับหน้าเดิม**

Run: `ls pages/admin/m10* pages/admin/m10/`
Expected: `pages/admin/m10.jsx`, `pages/admin/m10/basemap.jsx`, `pages/admin/m10/print.jsx` — ไม่มี dynamic slug

- [ ] **Step 4: ดูผลจริงในเบราว์เซอร์**

```bash
rm -rf .next && npm run dev
```
เปิด `http://localhost:3000/admin/m10/print?period=2569-01`
ตรวจ: ใบปกมีตาราง 11 แถวขึ้นไป · มีใบคั่น 11 ใบ · แผ่นงาน 63 แผ่น · แผ่นของรวมโฉนด/เกิดใหม่/แบ่งแยก/แบ่งหัก/ยกเลิก มีกล่องว่าง ไม่มีสคริปต์ · แผ่นของโอน/ให้เฉพาะส่วน/สอบเขต/แก้ชื่อ มีสคริปต์
กด **Ctrl/Cmd+P** แล้วดูพรีวิว: toolbar ต้องหาย · แต่ละแผ่นขึ้นหน้าใหม่ · ไม่มีเนื้อหาถูกตัดครึ่ง
กด "ประหยัดกระดาษ" แล้วดูพรีวิวอีกครั้ง: จำนวนหน้าต้องลดลง

- [ ] **Step 5: Commit**

```bash
git add pages/admin/m10/print.jsx styles/globals.css
git commit -m "feat(m10-print): หน้า /admin/m10/print + print CSS A4 (ไม่ใช้ LayoutAdmin)"
```

---

## Task 9: ปุ่มเข้าถึงจากแท็บสรุป + เอกสารโมดูล

**Files:**
- Modify: `components/m10/SummaryPanel.jsx`
- Modify: `docs/modules/m10-ingest.md`

- [ ] **Step 1: เพิ่มคอลัมน์ปุ่มใน `SummaryPanel.jsx`**

เพิ่ม `<th>` ท้ายแถวหัวตาราง (หลัง `<th className="text-right">รอรอบหน้า</th>`):

```jsx
                <th></th>
```

เพิ่ม `<td>` ท้ายแถวข้อมูล (หลัง `<td className="text-right tabular-nums opacity-70">{r.deferred || "-"}</td>`):

```jsx
                  <td>
                    <a
                      className="btn btn-xs btn-outline"
                      href={`/admin/m10/print?period=${encodeURIComponent(r.period)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      พิมพ์เล่ม
                    </a>
                  </td>
```

แก้ `colSpan` ของแถว "ยังไม่มีข้อมูลนำเข้า" จาก `7` เป็น `8`:

```jsx
              {rows.length === 0 && <tr><td colSpan={8} className="text-center opacity-60">ยังไม่มีข้อมูลนำเข้า</td></tr>}
```

- [ ] **Step 2: เพิ่มส่วนใหม่ท้าย `docs/modules/m10-ingest.md`**

```markdown
## เล่มพิมพ์บัญชีคุมนิติกรรมรายเดือน (2026-09-21)
- หน้า `/admin/m10/print?period=YYYY-MM` (`?compact=1` = 2 รายการ/หน้า) — **ไม่ใช้ `LayoutAdmin`**
  เพราะ chrome จะติดไปในกระดาษ · สิทธิ์ได้ตาม prefix ของ `/admin/m10` ไม่ต้อง migration
- เล่ม = ใบปกบัญชีคุม → ใบคั่นหมวด → แผ่นงานรายแปลง · **ชั้นบนแยกตาม `docType`** (โฉนด →
  สิ่งปลูกสร้าง → น.ส.3ก) ชั้นในแยกตาม `changeType` ตามลำดับคงที่ใน `print/labels.ts`
- **แผ่นงานมีเฉพาะรายการ `taxRelevant`** · ที่ไม่กระทบภาษี (จำนอง/หมายเหตุ/ใบแทน) ขึ้นเฉพาะใบปก
- **พิมพ์ได้ทันทีไม่ต้องรอคิวยืนยัน** — ทุกแผ่นมีป้าย "ยืนยันแล้ว/รอยืนยัน" จาก `reviewStatus`
- ชื่อนิติกรรมรายรายการใช้ **`rawStatus` ดิบจากกรมที่ดิน** (ไม่ใช่ชื่อหมวด) ตามที่เจ้าหน้าที่ใช้รายงาน
- logic ล้วนอยู่ `lib/m10-ingest/print/` (`labels` · `buildSheet` · `buildBook`) มีเทสต์ครบ —
  **ห้ามคำนวณยอด/ลำดับซ้ำใน component**
- reuse `identifyFields`/`ownerFields`/`OWNER_FIELD_COLS` + `buildWorklistItem` ของ worklist
  (จึง export เพิ่มใน `buildWorklistItem.ts`) — 4 นิติกรรมที่มีสคริปต์ได้ขั้นตอน ที่เหลือได้กล่องว่าง
- `listPrintRows(period)` replay `asOfMaterialize` **ครั้งเดียวที่ต้นงวด** เพื่อหาเจ้าของเดิม
  (ต่างจาก `getWorklistItem` ที่ replay ต่อรายการ) → แปลงที่มี 2 นิติกรรมในเดือนเดียวจะเห็นเจ้าของ
  ณ ต้นเดือน ไม่ใช่เจ้าของก่อนนิติกรรมนั้นทันที
- **เลขบัตร 13 หลักพิมพ์เต็มเฉพาะเอกสารชุดนี้** (ตัดสินใจโดยเจ้าของงาน) ที่อื่นคงกติกาเดิม ·
  ทุกครั้งที่เรียก API จะลง audit log `action: data_exported`, `resourceType: system`
- print CSS อยู่ท้าย `styles/globals.css` prefix `.m10p-` · **ห้ามใช้สีพื้นหลัง** เพราะเครื่องพิมพ์
  ปิด background graphics เป็นค่าเริ่มต้น

Spec: `docs/superpowers/specs/2026-09-21-m10-print-monthly-book-design.md` ·
Plan: `docs/superpowers/plans/2026-09-21-m10-print-monthly-book.md`
```

- [ ] **Step 3: ตรวจว่าปุ่มโผล่และเปิดได้**

เปิด `http://localhost:3000/admin/m10?tab=summary`
Expected: ตารางมีคอลัมน์ท้ายสุดเป็นปุ่ม "พิมพ์เล่ม" · กดแล้วเปิดแท็บใหม่ไปหน้าเล่ม

- [ ] **Step 4: Commit**

```bash
git add components/m10/SummaryPanel.jsx docs/modules/m10-ingest.md
git commit -m "feat(m10-print): ปุ่มพิมพ์เล่มในแท็บสรุป + เอกสารโมดูล"
```

---

## Task 10: ตรวจทั้งระบบก่อนส่งมอบ

- [ ] **Step 1: เทสต์ทั้งหมดต้องผ่าน (รันด้วย TZ=UTC)**

Run: `TZ=UTC npm test`
Expected: เทสต์เดิมทุกตัวผ่าน + 20 ตัวใหม่ของ `print/` + 3 ตัวใหม่ของ `buildWorklistItem`
**ยอมให้ FAIL ได้เฉพาะ 2 ไฟล์เดิม** `lib/m10-ingest/ingest.test.ts` และ `lib/m10-ingest/adapters/zip.test.ts`
ที่ต้องมี `public/60070001_60010000.zip` (ไฟล์ PII ที่ gitignore ไว้ ไม่มีในเครื่อง) — ถ้าไฟล์อื่น fail ต้องแก้

- [ ] **Step 2: build ต้องผ่าน**

```bash
pkill -f "next dev" || true
rm -rf .next
npx next build
```
Expected: exit 0 และเห็น `/admin/m10/print` กับ `/api/m10-ingest/print` ในผลบิลด์

- [ ] **Step 3: ของเดิมต้องไม่พัง — ไล่ด้วยมือ**

```bash
rm -rf .next && npm run dev
```
เปิดทีละแท็บที่ `/admin/m10`: สรุปรายเดือน · นำเข้าข้อมูล · คิวยืนยัน · ทะเบียน (as-of) ·
จับคู่ basemap (เข้า focus mode + ลอง [แก้รูปแปลง]) · รหัสแปลงใหม่ · Worklist → LTAX (กด "เริ่มคีย์"
แล้วดูว่าสคริปต์กับปุ่มคัดลอกยังทำงาน) · แล้วเปิด `/admin/m10/basemap`
Expected: ทุกหน้าทำงานเหมือนเดิม ไม่มี error ใน console

- [ ] **Step 4: ทดสอบพิมพ์จริง 1 รอบ**

พิมพ์ออกกระดาษจริง (หรือ Save as PDF แล้วเปิดดูทุกหน้า) ที่ `?period=2569-01`
ตรวจ: ไม่มีแผ่นไหนเนื้อหาถูกตัดครึ่ง · หัวตารางใบปกซ้ำเมื่อข้ามหน้า · เส้นขอบตารางเห็นชัด
(ไม่ใช่พื้นเทาที่หายไป) · เลข 13 หลักครบ 13 ตัว · ช่องลงนามไม่ล้นหน้า
**ถ้า page-break เพี้ยน** ปรับเฉพาะบล็อก `@media print` ใน `globals.css` ห้ามแก้ logic

- [ ] **Step 5: Commit งานแก้ที่เกิดจากการตรวจ (ถ้ามี) แล้วสรุป**

```bash
git add -A
git commit -m "fix(m10-print): ปรับ page-break ตามผลพิมพ์จริง"
git log --oneline -10
```

---

## Self-review ของแผนนี้

**ครอบสเปคครบไหม** — §4 โครงเล่ม → Task 4 (จัดหมวด/ลำดับ) + Task 7 (component) · §5 ที่มาฟิลด์ → Task 2–3 ·
§6 ไฟล์/สัญญา API → Task 5–8 · §7 print CSS → Task 8 · §8 เทสต์ 10 เคส → Task 1/3/4/5 (labels 5 + sheet 7 + book 8 + repository 6) ·
§9 ของเดิมไม่พัง → Task 10 Step 3 · §6 audit → Task 6 · เอกสารโมดูล → Task 9

**เทสต์ที่สเปคขอครบทุกข้อ:** จัดหมวด (T4) · ยอดใบปกตรงแผ่นงาน (T4) · ไม่กระทบภาษีไม่มีแผ่นงาน (T4) ·
เลข 13 หลักเลขล้วนจาก payloadRaw (T2+T3) · parcelCode override ก่อน auto (T5 + T3 ป้ายยังไม่จับคู่) ·
steps/กล่องว่าง (T3) · ป้ายรอยืนยัน (T3) · วันที่ Bangkok (T3) · การเรียงคงที่ (T4) · UTM โรมัน/pad (T2)

**ชื่อที่ใช้ตรงกันทุก task:** `PrintTxnRow` (นิยาม T3 ใช้ T4/T5) · `PrintSheet`/`SheetPosition` (T3) ·
`PrintBookData`/`PrintSection`/`PrintCoverRow`/`PrintTotals` (T4) · `buildSheet(row, pos)` ·
`buildBook(rows, { period })` · `listPrintRows(period) → { rows, batchCount }` ·
`docTypeLabel`/`changeTypeLabel`/`docTypeRank`/`changeTypeRank`/`periodLabel` (T1) ·
class CSS `.m10p-*` ตรงกันระหว่าง T7 (component) กับ T8 (CSS)

**จุดที่ต้องระวังตอนทำ:** `logAuditEvent` ต้องยืนยันชื่อ field จริงก่อน (T6 Step 2) — เดาผิดแล้วพิมพ์ไม่ได้ ·
`buildWorklistItem` รับ `changeType` แค่ 4 ค่า ห้ามเรียกกับนิติกรรมอื่น (T3 มี type guard `hasSteps`) ·
`listPrintRows` ต้อง import type จาก `../print/buildSheet` ไม่ใช่ประกาศซ้ำ (T5 Step 3)
