# LTAX Worklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an assisted "worklist" that turns confirmed ม.10 ownership changes (TRANSFER / OWNER_CORRECTION / BOUNDARY_CHANGE) into a guided, copy-per-field keying script so an officer can key them into LTAX Online by hand — plus refactor the three existing `/admin/m10-*` pages into one tabbed page `/admin/m10`.

**Architecture:** A pure function `buildWorklistItem()` maps a confirmed `M10Transaction` to an ordered, data-driven keying script (fields pulled from `payloadRaw`). Keying status lives on `M10Transaction` (`ltaxStatus/ltaxKeyedBy/ltaxKeyedAt/ltaxNote`) — idempotent, no new collection. Clerk-guarded API under `pages/api/m10-ingest/worklist/`. UI is a tab inside a new `/admin/m10` page (DaisyUI `tabs-lift`) that also hosts the existing ingest/review/records panels.

**Tech Stack:** TypeScript + Vitest (data layer), mongoose + mongodb-memory-server (repository tests), Next.js Pages Router (API + pages), DaisyUI/Tailwind (UI), Clerk (auth).

**Source of truth:** `docs/superpowers/specs/2026-06-28-ltax-worklist-design.md`. Read it first.

**Builds on (already done & committed on branch `new-m10`):** the `m10-ingest` module — `models/m10-ingest/*`, `lib/m10-ingest/repository/index.ts` (exports `confirmTransaction`, `asOfMaterialize`, models), the three pages `pages/admin/m10-{ingest,review,records}.jsx`, API `pages/api/m10-ingest/*`, auth `pages/api/m10-ingest/_auth.js#requireM10Admin(req, requiredPage)`. 75 vitest tests currently pass; `npm test`, `npx tsc --noEmit`, `npm run lint` are all clean.

**Conventions (CLAUDE.md):** Mongo env `MONGO_URI`; mongoose `models.X || model(...)` guard; ESLint treats `@typescript-eslint/no-explicit-any` and `no-require-imports` as **errors** — avoid `any` annotations and ES-`require` in `.ts` (use the existing `require` for the CJS models inside repository with `// eslint-disable-next-line @typescript-eslint/no-require-imports` as already done). Thai is the default UI language.

**Locked decisions (from spec):** scope = TRANSFER + OWNER_CORRECTION + BOUNDARY_CHANGE only; one page `/admin/m10` + tabs (delete the 3 old routes); keying status on the transaction; LTAX **field order is an unverified ASSUMPTION** → keep `steps` data-driven and assert field-set (not index) in tests; raw national ID leaves DB only via the single-item focus endpoint, never logged.

---

## File Structure

```
lib/m10-ingest/worklist/
  buildWorklistItem.ts            # pure: txn (+prevOwner) -> WorklistItem (data-driven step templates)
  buildWorklistItem.test.ts
  __fixtures__/parcelPayload.ts   # a real-shaped payloadRaw owner row for tests
models/m10-ingest/
  M10Transaction.js               # MODIFY: + ltaxStatus/ltaxKeyedBy/ltaxKeyedAt/ltaxNote + index
lib/m10-ingest/repository/
  index.ts                        # MODIFY: + listWorklistPending, getWorklistItem, markKeyed, markSkip
  worklist.test.ts                # repository tests (mongodb-memory-server)
pages/api/m10-ingest/worklist/
  index.js                        # GET list (no raw id)
  [id]/index.js                   # GET one item (buildWorklistItem; raw id here)
  [id]/keyed.js                   # POST mark keyed
  [id]/skip.js                    # POST mark skipped (+note)
components/m10/
  IngestPanel.jsx                 # extracted from pages/admin/m10-ingest.jsx
  ReviewPanel.jsx                 # extracted from pages/admin/m10-review.jsx
  RecordsPanel.jsx                # extracted from pages/admin/m10-records.jsx
  WorklistPanel.jsx               # new: list + focus guided keying
pages/admin/
  m10.jsx                         # new: tabs-lift hosting the 4 panels (?tab= deep-link)
  m10-ingest.jsx / m10-review.jsx / m10-records.jsx   # DELETE (moved into tabs)
lib/permissions.ts                # MODIFY: 3 entries -> 1 (/admin/m10)
components/LayoutAdmin.tsx         # MODIFY: nav 3 -> 1 under "แผนที่ภาษี"
scripts/grant-m10-permission.js    # MODIFY: pull 3 old paths, add /admin/m10
docs/modules/m10-ingest.md         # UPDATE: tabs + worklist
```

---

# PHASE 1 — Worklist data layer

## Task 1: Add LTAX keying fields to `M10Transaction`

**Files:** Modify `models/m10-ingest/M10Transaction.js`

- [ ] **Step 1: Add the fields + index**

In `models/m10-ingest/M10Transaction.js`, add these fields to the schema (after the `reviewedBy: String, reviewedAt: Date,` line):
```js
  ltaxStatus: { type: String, enum: ["pending", "keyed", "skipped"], default: "pending", index: true },
  ltaxKeyedBy: String,
  ltaxKeyedAt: Date,
  ltaxNote: String,
```
And after the existing `TransactionSchema.index(...)` line add:
```js
TransactionSchema.index({ ltaxStatus: 1, changeType: 1 });
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no new errors.

- [ ] **Step 3: Commit**

```bash
git add models/m10-ingest/M10Transaction.js
git commit -m "feat(ltax-worklist): add ltaxStatus/keyed fields to M10Transaction"
```

---

## Task 2: `buildWorklistItem` pure function

**Files:** Create `lib/m10-ingest/worklist/buildWorklistItem.ts`, `lib/m10-ingest/worklist/__fixtures__/parcelPayload.ts`, `lib/m10-ingest/worklist/buildWorklistItem.test.ts`

- [ ] **Step 1: Create the fixture**

Create `lib/m10-ingest/worklist/__fixtures__/parcelPayload.ts`:
```ts
// payloadRaw (คอลัมน์จริงของ parcel CSV, หลัง trim) ของเจ้าของ 1 ราย — ใช้ทดสอบ buildWorklistItem
export const PARCEL_PAYLOAD: Record<string, string> = {
  "โฉนด": "31635",
  "ที่ดิน": "84",
  "คำนำหน้า": "นางสาว",
  "ชื่อ": "วรารีย์",
  "นามสกุล": "ชาลีรัตน์",
  "13 หลัก": "1 6097 00018 24 8",
  "OWN_HSE_NO": "29/5",
  "OWN_MOO": "",
  "OWN_SOI": "ทวีชัย 12",
  "OWN_VILLAGE": "",
  "OWN_ROAD": "",
  "OWN_TAMBOL": "ตาคลี",
  "OWN_AMPHUR": "ตาคลี",
  "OWN_PROVINCE": "นครสวรรค์",
};
```

- [ ] **Step 2: Write the failing test (assert field SET, not index — order is an assumption)**

Create `lib/m10-ingest/worklist/buildWorklistItem.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildWorklistItem, type WorklistTxnInput } from "./buildWorklistItem";
import { PARCEL_PAYLOAD } from "./__fixtures__/parcelPayload";

function txn(over: Partial<WorklistTxnInput> = {}): WorklistTxnInput {
  return {
    _id: "txn1",
    recordKey: "5039|2|4682|07|1000|84",
    deedNo: "31635",
    changeType: "TRANSFER",
    txnDate: new Date("2026-01-05"),
    area: { rai: 0, ngan: 2, wa: 24, sqm: 896 },
    payloadRaw: PARCEL_PAYLOAD,
    ...over,
  };
}

// helper: ดึงค่า step ตาม label (เทสไม่ผูกกับลำดับ)
function val(steps: { label: string; value: string }[], label: string) {
  return steps.find((s) => s.label === label)?.value;
}

describe("buildWorklistItem", () => {
  it("TRANSFER -> REPLACE_OWNER with new owner + raw id + address from payloadRaw", () => {
    const item = buildWorklistItem(txn(), "นาย ก ข", "2569-01");
    expect(item.changeType).toBe("TRANSFER");
    expect(item.action).toBe("REPLACE_OWNER");
    expect(item.search).toEqual({ deedNo: "31635", oldOwnerName: "นาย ก ข" });
    expect(val(item.steps, "ชื่อ")).toBe("วรารีย์");
    expect(val(item.steps, "นามสกุล")).toBe("ชาลีรัตน์");
    expect(val(item.steps, "เลขบัตรประชาชน (13 หลัก)")).toBe("1 6097 00018 24 8");
    expect(val(item.steps, "ตำบล")).toBe("ตาคลี");
    // มี step ลบเจ้าของเดิม
    expect(item.steps.some((s) => s.label.includes("ลบเจ้าของเดิม"))).toBe(true);
    // copy ได้เฉพาะช่องค่า ไม่ใช่ instruction
    expect(item.steps.find((s) => s.label === "ชื่อ")?.copyable).toBe(true);
  });

  it("oldOwnerName null when no prevOwner", () => {
    const item = buildWorklistItem(txn(), null, "2569-01");
    expect(item.search.oldOwnerName).toBeNull();
  });

  it("OWNER_CORRECTION -> CORRECT_OWNER (no remove-old step)", () => {
    const item = buildWorklistItem(txn({ changeType: "OWNER_CORRECTION" }), null, "2569-01");
    expect(item.action).toBe("CORRECT_OWNER");
    expect(val(item.steps, "ชื่อ")).toBe("วรารีย์");
    expect(item.steps.some((s) => s.label.includes("ลบเจ้าของเดิม"))).toBe(false);
  });

  it("BOUNDARY_CHANGE -> UPDATE_AREA with rai/ngan/wa", () => {
    const item = buildWorklistItem(txn({ changeType: "BOUNDARY_CHANGE" }), null, "2569-01");
    expect(item.action).toBe("UPDATE_AREA");
    expect(val(item.steps, "ไร่")).toBe("0");
    expect(val(item.steps, "งาน")).toBe("2");
    expect(val(item.steps, "วา")).toBe("24");
    // ไม่มีช่องเจ้าของในงานแก้เนื้อที่
    expect(val(item.steps, "เลขบัตรประชาชน (13 หลัก)")).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- buildWorklistItem`
Expected: FAIL — cannot find module `./buildWorklistItem`.

- [ ] **Step 4: Write the implementation (data-driven templates)**

Create `lib/m10-ingest/worklist/buildWorklistItem.ts`:
```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- buildWorklistItem`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/m10-ingest/worklist/
git commit -m "feat(ltax-worklist): buildWorklistItem pure fn (data-driven step templates)"
```

---

## Task 3: Repository — list / get / markKeyed / markSkip

**Files:** Modify `lib/m10-ingest/repository/index.ts`; Create `lib/m10-ingest/repository/worklist.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/m10-ingest/repository/worklist.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  createBatch, insertTransactionDedup, confirmTransaction,
  listWorklistPending, getWorklistItem, markKeyed, markSkip,
} from "./index";
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
    payloadRaw: { "โฉนด": "31635", "คำนำหน้า": "นางสาว", "ชื่อ": "วรารีย์", "นามสกุล": "ชาลีรัตน์", "13 หลัก": "1609700018248", "OWN_TAMBOL": "ตาคลี" },
    ...over,
  };
}

describe("worklist repository", () => {
  it("listWorklistPending returns only confirmed eligible pending txns", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const t1 = await insertTransactionDedup(b._id, txn());                                   // TRANSFER -> eligible
    await insertTransactionDedup(b._id, txn({ recordKey: "K2", rawStatus: "จำนอง", changeType: "ENCUMBRANCE", reviewStatus: "auto" })); // not eligible
    // before confirm: nothing pending in worklist
    expect(await listWorklistPending({})).toHaveLength(0);
    await confirmTransaction(t1.doc._id, "o");
    const pending = await listWorklistPending({});
    expect(pending).toHaveLength(1);
    expect(pending[0].changeType).toBe("TRANSFER");
  });

  it("markKeyed removes it from pending and records who/when", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const t = await insertTransactionDedup(b._id, txn());
    await confirmTransaction(t.doc._id, "o");
    await markKeyed(t.doc._id, "officer1");
    expect(await listWorklistPending({})).toHaveLength(0);
    const doc = await mongoose.connection.db!.collection("m10_transactions").findOne({ _id: t.doc._id });
    expect(doc?.ltaxStatus).toBe("keyed");
    expect(doc?.ltaxKeyedBy).toBe("officer1");
  });

  it("markSkip stores note", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const t = await insertTransactionDedup(b._id, txn());
    await confirmTransaction(t.doc._id, "o");
    await markSkip(t.doc._id, "officer1", "ข้อมูลไม่ครบ");
    const doc = await mongoose.connection.db!.collection("m10_transactions").findOne({ _id: t.doc._id });
    expect(doc?.ltaxStatus).toBe("skipped");
    expect(doc?.ltaxNote).toBe("ข้อมูลไม่ครบ");
    expect(await listWorklistPending({})).toHaveLength(0);
  });

  it("getWorklistItem builds the keying script and resolves oldOwnerName from prior confirmed txn", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    // prior owner on same parcel (earlier date)
    const t0 = await insertTransactionDedup(b._id, txn({ rawStatus: "โอนมรดก", txnDate: "2025-12-01", owner: { title: "นาย", name: "เก่า", surname: "ก", fullName: "นาย เก่า ก", idHash: "h0" } }));
    await confirmTransaction(t0.doc._id, "o");
    const t1 = await insertTransactionDedup(b._id, txn());
    await confirmTransaction(t1.doc._id, "o");

    const item = await getWorklistItem(t1.doc._id);
    expect(item.changeType).toBe("TRANSFER");
    expect(item.search.deedNo).toBe("31635");
    expect(item.search.oldOwnerName).toBe("นาย เก่า ก"); // จาก as-of ก่อนวันที่ของ t1
    expect(item.steps.find((s) => s.label === "ชื่อ")?.value).toBe("วรารีย์");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- repository/worklist`
Expected: FAIL — `listWorklistPending` is not exported.

- [ ] **Step 3: Add the functions to `lib/m10-ingest/repository/index.ts`**

Add near the top (after the existing `import` lines), an import of the pure builder:
```ts
import { buildWorklistItem, type WorklistItem } from "../worklist/buildWorklistItem";
```

Append these exports at the end of the file (before the final `export { M10ImportBatch, ... }` line is fine; just keep them above it):
```ts
const WORKLIST_CHANGE_TYPES = ["TRANSFER", "OWNER_CORRECTION", "BOUNDARY_CHANGE"];

export interface WorklistListRow {
  _id: string; recordKey: string; deedNo: string | null;
  changeType: string; txnDate: Date; ownerFullName: string;
}

// รายการ txn ที่ confirmed + เข้าเกณฑ์ + ยังไม่คีย์ (list ไม่ส่งเลขบัตรดิบ)
export async function listWorklistPending(filter: { period?: string; changeType?: string }): Promise<WorklistListRow[]> {
  const q: Record<string, unknown> = {
    reviewStatus: "confirmed",
    ltaxStatus: "pending",
    changeType: filter.changeType && WORKLIST_CHANGE_TYPES.includes(filter.changeType)
      ? filter.changeType
      : { $in: WORKLIST_CHANGE_TYPES },
  };
  if (filter.period) {
    const batches = await M10ImportBatch.find({ period: filter.period }).select("_id").lean();
    q.batchId = { $in: batches.map((b: { _id: unknown }) => b._id) };
  }
  const rows = await M10Transaction.find(q)
    .sort({ txnDate: 1, createdAt: 1 })
    .select("recordKey deedNo changeType txnDate owner.fullName")
    .limit(1000).lean();
  return rows.map((r: Record<string, unknown>) => ({
    _id: String((r as { _id: unknown })._id),
    recordKey: r.recordKey as string,
    deedNo: (r.deedNo as string) ?? null,
    changeType: r.changeType as string,
    txnDate: r.txnDate as Date,
    ownerFullName: (r as { owner?: { fullName?: string } }).owner?.fullName ?? "",
  }));
}

// สร้างสคริปต์คีย์ของ txn เดียว (focus mode) — ส่งเลขบัตร/ที่อยู่ดิบ
export async function getWorklistItem(txnId: Types.ObjectId | string): Promise<WorklistItem> {
  const doc = await M10Transaction.findById(txnId).lean();
  if (!doc) throw new Error("transaction not found");
  const batch = await M10ImportBatch.findById(doc.batchId).select("period").lean();
  // เจ้าของก่อนหน้า: replay confirmed txn ถึงก่อนวันที่ของ txn นี้ แล้วหา recordKey เดียวกัน
  const before = new Date(new Date(doc.txnDate).getTime() - 1);
  const asOf = await asOfMaterialize(before);
  const prior = asOf.find((r) => r.recordKey === doc.recordKey);
  const oldOwnerName = prior?.owners?.[0]?.fullName ?? null;
  return buildWorklistItem(
    {
      _id: String(doc._id),
      recordKey: doc.recordKey,
      deedNo: doc.deedNo ?? null,
      changeType: doc.changeType,
      txnDate: doc.txnDate,
      area: doc.area ?? null,
      payloadRaw: doc.payloadRaw ?? {},
    },
    oldOwnerName,
    batch?.period ?? ""
  );
}

export async function markKeyed(txnId: Types.ObjectId | string, by: string) {
  await M10Transaction.updateOne({ _id: txnId }, { $set: { ltaxStatus: "keyed", ltaxKeyedBy: by, ltaxKeyedAt: new Date() } });
}
export async function markSkip(txnId: Types.ObjectId | string, by: string, note: string) {
  await M10Transaction.updateOne({ _id: txnId }, { $set: { ltaxStatus: "skipped", ltaxKeyedBy: by, ltaxKeyedAt: new Date(), ltaxNote: note } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- repository/worklist`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run full suite + tsc + lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass; lint clean (no `any` annotations introduced — note the `Record<string, unknown>` casts above avoid `any`).

- [ ] **Step 6: Commit**

```bash
git add lib/m10-ingest/repository/index.ts lib/m10-ingest/repository/worklist.test.ts
git commit -m "feat(ltax-worklist): repository list/get/markKeyed/markSkip"
```

---

# PHASE 2 — API

## Task 4: Worklist API endpoints

**Files:** Create `pages/api/m10-ingest/worklist/index.js`, `pages/api/m10-ingest/worklist/[id]/index.js`, `pages/api/m10-ingest/worklist/[id]/keyed.js`, `pages/api/m10-ingest/worklist/[id]/skip.js`

All guarded by `requireM10Admin(req, "/admin/m10")`. (Note: `[id]/index.js` — use the folder form so the dynamic route and its sub-routes don't clash.)

- [ ] **Step 1: list endpoint** `pages/api/m10-ingest/worklist/index.js`:
```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  await dbConnect();
  const { listWorklistPending } = await import("@/lib/m10-ingest/repository/index");
  const items = await listWorklistPending({
    period: req.query.period || undefined,
    changeType: req.query.changeType || undefined,
  });
  return res.status(200).json({ items });
}
```

- [ ] **Step 2: focus item endpoint** `pages/api/m10-ingest/worklist/[id]/index.js`:
```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../../_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  await dbConnect();
  const { getWorklistItem } = await import("@/lib/m10-ingest/repository/index");
  try {
    const item = await getWorklistItem(req.query.id);
    return res.status(200).json(item); // มีเลขบัตรดิบ — อย่า console.log ก้อนนี้
  } catch (e) {
    return res.status(404).json({ error: e?.message || "ไม่พบรายการ" });
  }
}
```

- [ ] **Step 3: keyed endpoint** `pages/api/m10-ingest/worklist/[id]/keyed.js`:
```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../../_auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  await dbConnect();
  const { markKeyed } = await import("@/lib/m10-ingest/repository/index");
  await markKeyed(req.query.id, auth.name || auth.userId);
  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 4: skip endpoint** `pages/api/m10-ingest/worklist/[id]/skip.js`:
```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../../_auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  await dbConnect();
  const { markSkip } = await import("@/lib/m10-ingest/repository/index");
  const note = (req.body && req.body.note) || "";
  await markSkip(req.query.id, auth.name || auth.userId, note);
  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.
```bash
git add pages/api/m10-ingest/worklist/
git commit -m "feat(ltax-worklist): worklist API (list/item/keyed/skip)"
```

---

# PHASE 3 — Tabs refactor + Worklist UI + permissions

## Task 5: Extract existing pages into panels + new `/admin/m10` tabs page

**Files:** Create `components/m10/IngestPanel.jsx`, `ReviewPanel.jsx`, `RecordsPanel.jsx`; Create `pages/admin/m10.jsx`; Delete `pages/admin/m10-ingest.jsx`, `pages/admin/m10-review.jsx`, `pages/admin/m10-records.jsx`

Each panel = the existing page body **minus** the `<Head>` and the outer fragment, exported as a component. The `/admin/m10` page renders one `<Head>` and the tab bar.

- [ ] **Step 1: Create `components/m10/IngestPanel.jsx`**

Copy the body of the current `pages/admin/m10-ingest.jsx` into a component (remove `import Head`, remove `<Head>...</Head>`, rename the function, return the inner `<div>` directly):
```jsx
import { useState } from "react";

export default function IngestPanel() {
  const [file, setFile] = useState(null);
  const [period, setPeriod] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleUpload(e) {
    e.preventDefault();
    setError(""); setResult(null);
    if (!file) { setError("กรุณาเลือกไฟล์ ZIP"); return; }
    if (!/^\d{4}-\d{2}$/.test(period)) { setError("period ต้องเป็นรูปแบบ พ.ศ.-เดือน เช่น 2569-01"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("period", period);
      const res = await fetch("/api/m10-ingest/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "อัปโหลดล้มเหลว");
      setResult(data);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold mb-4">นำเข้าข้อมูลมาตรา 10 (รายเดือน)</h2>
      <form onSubmit={handleUpload} className="card bg-base-100 shadow p-4 space-y-4">
        <div>
          <label className="label"><span className="label-text">เดือน (พ.ศ.-เดือน)</span></label>
          <input className="input input-bordered w-40" placeholder="2569-01" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <div>
          <label className="label"><span className="label-text">ไฟล์ ZIP จากกรมที่ดิน</span></label>
          <input type="file" accept=".zip" className="file-input file-input-bordered w-full" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? "กำลังประมวลผล..." : "อัปโหลดและประมวลผล"}</button>
      </form>
      {error && <div className="alert alert-error mt-4">{error}</div>}
      {result && result.skipped && (
        <div className="alert alert-info mt-4">เดือนนี้ (ไฟล์นี้) นำเข้าแล้ว — ไม่มีการเปลี่ยนแปลง</div>
      )}
      {result && !result.skipped && (
        <div className="mt-4 space-y-3">
          <div className="stats shadow w-full">
            <div className="stat"><div className="stat-title">Transactions</div><div className="stat-value text-primary">{result.counts.transactions}</div></div>
            <div className="stat"><div className="stat-title">Geometry matched</div><div className="stat-value">{result.counts.geometryMatched}</div></div>
            <div className="stat"><div className="stat-title">Quarantine</div><div className="stat-value text-warning">{result.counts.rejects}</div></div>
          </div>
          <p className="text-sm opacity-70">รายการที่กระทบกรรมสิทธิ์รอการยืนยันที่แท็บ &quot;คิวยืนยัน&quot;</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/m10/ReviewPanel.jsx`**

Same extraction from `pages/admin/m10-review.jsx` (drop Head/fragment, rename, return inner `<div>`):
```jsx
import { useEffect, useState, useCallback } from "react";

export default function ReviewPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/m10-ingest/transactions?reviewStatus=pending");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดข้อมูลล้มเหลว");
      setItems(data.items);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(id, action) {
    const res = await fetch(`/api/m10-ingest/transactions/${id}/${action}`, { method: "POST" });
    if (res.ok) setItems((prev) => prev.filter((x) => x._id !== id));
    else { const d = await res.json(); setError(d.error || "ทำรายการไม่สำเร็จ"); }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">คิวยืนยันการเปลี่ยนแปลง (รอดำเนินการ {items.length})</h2>
      {error && <div className="alert alert-error mb-3">{error}</div>}
      {loading ? <span className="loading loading-spinner" /> : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead><tr><th>วันที่</th><th>ประเภท</th><th>สถานะเดิม</th><th>โฉนด</th><th>recordKey</th><th>เจ้าของ</th><th>เนื้อที่ (ตร.ม.)</th><th></th></tr></thead>
            <tbody>
              {items.map((t) => (
                <tr key={t._id}>
                  <td>{t.txnDate?.slice(0, 10)}</td>
                  <td><span className="badge">{t.changeType}</span></td>
                  <td>{t.rawStatus}</td>
                  <td>{t.deedNo || "-"}</td>
                  <td className="font-mono text-xs">{t.recordKey || "-"}</td>
                  <td>{t.owner?.fullName}</td>
                  <td>{t.area?.sqm ?? "-"}</td>
                  <td className="flex gap-2">
                    <button className="btn btn-xs btn-success" onClick={() => act(t._id, "confirm")}>ยืนยัน</button>
                    <button className="btn btn-xs btn-error" onClick={() => act(t._id, "reject")}>ปฏิเสธ</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={8} className="text-center opacity-60">ไม่มีรายการรอยืนยัน</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `components/m10/RecordsPanel.jsx`**

Same extraction from `pages/admin/m10-records.jsx`:
```jsx
import { useEffect, useState, useCallback } from "react";

export default function RecordsPanel() {
  const [asOf, setAsOf] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (cutoff) => {
    setLoading(true); setError("");
    try {
      const qs = cutoff ? `?asOf=${cutoff}` : "";
      const res = await fetch(`/api/m10-ingest/records${qs}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "โหลดข้อมูลล้มเหลว");
      setData(d);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(""); }, [load]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">ทะเบียนกรรมสิทธิ์ (as-of)</h2>
      <div className="flex gap-2 items-end mb-4 flex-wrap">
        <div>
          <label className="label"><span className="label-text">ดู ณ วันที่ (ว่าง = ปัจจุบัน)</span></label>
          <input type="date" className="input input-bordered" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={() => load(asOf)}>ดูสถานะ</button>
        <button className="btn" onClick={() => { setAsOf(""); load(""); }}>ปัจจุบัน</button>
      </div>
      {error && <div className="alert alert-error mb-3">{error}</div>}
      {loading ? <span className="loading loading-spinner" /> : data && (
        <>
          <p className="mb-2 text-sm opacity-70">สถานะ ณ {data.asOf} · {data.count} รายการ</p>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead><tr><th>recordKey</th><th>โฉนด</th><th>เจ้าของ</th><th>เนื้อที่ (ตร.ม.)</th><th>เปลี่ยนแปลงล่าสุด</th><th>geom</th><th>สถานะ</th></tr></thead>
              <tbody>
                {data.records.map((r) => (
                  <tr key={r.recordKey}>
                    <td className="font-mono text-xs">{r.recordKey}</td>
                    <td>{r.deedNo || "-"}</td>
                    <td>{r.owners?.[0]?.fullName}</td>
                    <td>{r.area?.sqm ?? "-"}</td>
                    <td>{r.lastChangeType} ({String(r.lastTxnDate).slice(0, 10)})</td>
                    <td>{r.hasGeometry ? "✓" : "-"}</td>
                    <td><span className={`badge ${r.status === "retired" ? "badge-ghost" : "badge-success"}`}>{r.status}</span></td>
                  </tr>
                ))}
                {data.records.length === 0 && <tr><td colSpan={7} className="text-center opacity-60">ไม่มีทะเบียน ณ วันที่นี้</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create the tabs page** `pages/admin/m10.jsx` (WorklistPanel added in Task 7; import it now so the tab exists):
```jsx
import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import IngestPanel from "@/components/m10/IngestPanel";
import ReviewPanel from "@/components/m10/ReviewPanel";
import RecordsPanel from "@/components/m10/RecordsPanel";
import WorklistPanel from "@/components/m10/WorklistPanel";

const TABS = [
  { key: "ingest", label: "นำเข้าข้อมูล", Panel: IngestPanel },
  { key: "review", label: "คิวยืนยัน", Panel: ReviewPanel },
  { key: "records", label: "ทะเบียน (as-of)", Panel: RecordsPanel },
  { key: "worklist", label: "Worklist → LTAX", Panel: WorklistPanel },
];

export default function M10Page() {
  const router = useRouter();
  const initial = TABS.some((t) => t.key === router.query.tab) ? String(router.query.tab) : "ingest";
  const [tab, setTab] = useState(initial);
  const Active = TABS.find((t) => t.key === tab)?.Panel ?? IngestPanel;

  function go(key) {
    setTab(key);
    router.replace({ query: { ...router.query, tab: key } }, undefined, { shallow: true });
  }

  return (
    <>
      <Head><title>แผนที่ภาษี (ม.10)</title></Head>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">แผนที่ภาษี — งาน ม.10</h1>
        <div role="tablist" className="tabs tabs-lift mb-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              className={`tab ${tab === t.key ? "tab-active" : ""}`}
              onClick={() => go(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Active />
      </div>
    </>
  );
}
```

- [ ] **Step 5: Delete the old route pages**

```bash
git rm pages/admin/m10-ingest.jsx pages/admin/m10-review.jsx pages/admin/m10-records.jsx
```

- [ ] **Step 6: Create a placeholder `WorklistPanel` so the page compiles** (real UI in Task 7)

Create `components/m10/WorklistPanel.jsx`:
```jsx
export default function WorklistPanel() {
  return <div className="opacity-60">Worklist (อยู่ระหว่างพัฒนาในขั้นถัดไป)</div>;
}
```

- [ ] **Step 7: Verify + commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean (no broken imports; the 3 deleted routes are gone).
```bash
git add components/m10/ pages/admin/m10.jsx
git commit -m "refactor(m10): merge 3 admin pages into /admin/m10 tabs + panels"
```

---

## Task 6: Consolidate permissions to a single `/admin/m10`

**Files:** Modify `lib/permissions.ts`, `components/LayoutAdmin.tsx`, `scripts/grant-m10-permission.js`

- [ ] **Step 1: `ALL_PAGES`** — in `lib/permissions.ts`, replace the three entries (`/admin/m10-ingest`, `/admin/m10-review`, `/admin/m10-records`) with one:
```ts
  {
    path: '/admin/m10',
    label: 'แผนที่ภาษี (ม.10)',
    icon: '🗺️',
    description: 'นำเข้า/ยืนยัน/ทะเบียน ม.10 และ worklist คีย์เข้า LTAX',
    category: 'management'
  },
```

- [ ] **Step 2: `DEFAULT_PERMISSIONS.admin`** — in `lib/permissions.ts`, replace the three lines `'/admin/m10-ingest'`, `'/admin/m10-review'`, `'/admin/m10-records'` in the `admin:` array with a single `'/admin/m10',`. (`superadmin` is `ALL_PAGES.map(p => p.path)` — updates automatically.)

- [ ] **Step 3: `navigationItems`** — in `components/LayoutAdmin.tsx`, replace the three `ม.10 …` lines (in the `'จัดการ'` group) with one:
```ts
  { label: 'แผนที่ภาษี (ม.10)', href: '/admin/m10',                     icon: '🗺️', group: 'จัดการ' },
```

- [ ] **Step 4: migration script** — replace the body of `scripts/grant-m10-permission.js` so it both removes the old paths and adds the new one:
```js
// รัน: node --env-file=.env.local scripts/grant-m10-permission.js
const mongoose = require("mongoose");
const OLD = ["/admin/m10-ingest", "/admin/m10-review", "/admin/m10-records"];
const NEW = "/admin/m10";

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.connection.collection("users");
  const appId = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
  await User.updateMany(
    { appId, allowedPages: { $exists: true, $ne: [] } },
    { $pull: { allowedPages: { $in: OLD } } }
  );
  const res = await User.updateMany(
    { appId, allowedPages: { $exists: true, $ne: [] } },
    { $addToSet: { allowedPages: NEW } }
  );
  console.log("migrated users:", res.modifiedCount);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Verify + commit** (do NOT run the migration here)

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.
```bash
git add lib/permissions.ts components/LayoutAdmin.tsx scripts/grant-m10-permission.js
git commit -m "refactor(m10): consolidate 3 page permissions into /admin/m10"
```

---

## Task 7: WorklistPanel UI (list + guided focus + copy)

**Files:** Overwrite `components/m10/WorklistPanel.jsx`

- [ ] **Step 1: Implement the panel** `components/m10/WorklistPanel.jsx`:
```jsx
import { useEffect, useState, useCallback } from "react";

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* ignore */ }
  }
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-48 text-sm text-base-content/60 shrink-0">{label}</span>
      <span className="font-medium flex-1 break-all">{value || <span className="opacity-40">—</span>}</span>
      {value && (
        <button className="btn btn-xs" onClick={copy}>{copied ? "คัดลอกแล้ว" : "คัดลอก"}</button>
      )}
    </div>
  );
}

export default function WorklistPanel() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queue, setQueue] = useState(null); // string[] of txn ids in focus session
  const [pos, setPos] = useState(0);
  const [item, setItem] = useState(null);   // current WorklistItem
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/m10-ingest/worklist");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "โหลดข้อมูลล้มเหลว");
      setItems(d.items); setSelected(new Set());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadItem = useCallback(async (id) => {
    setError(""); setNote("");
    const res = await fetch(`/api/m10-ingest/worklist/${id}`);
    const d = await res.json();
    if (!res.ok) { setError(d.error || "โหลดรายการไม่สำเร็จ"); return; }
    setItem(d);
  }, []);

  function toggle(id) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function start() {
    const ids = items.filter((i) => selected.has(i._id)).map((i) => i._id);
    if (ids.length === 0) return;
    setQueue(ids); setPos(0); loadItem(ids[0]);
  }
  async function advance(action) {
    const id = queue[pos];
    await fetch(`/api/m10-ingest/worklist/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const next = pos + 1;
    if (next >= queue.length) { setQueue(null); setItem(null); await load(); return; }
    setPos(next); loadItem(queue[next]);
  }

  // ── Focus mode ──
  if (queue && item) {
    return (
      <div className="max-w-2xl">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-bold">คีย์เข้า LTAX</h2>
          <span className="badge badge-neutral">{pos + 1}/{queue.length}</span>
        </div>
        {error && <div className="alert alert-error mb-3">{error}</div>}
        <div className="card bg-base-100 shadow p-4 space-y-3">
          <div className="flex gap-2 items-center">
            <span className="badge badge-primary">{item.changeType}</span>
            <span className="text-sm">recordKey <span className="font-mono">{item.recordKey}</span></span>
          </div>
          <div className="bg-base-200 rounded p-3">
            <p className="text-sm font-semibold mb-1">ค้นหาใน LTAX ด้วย:</p>
            <CopyField label="เลขโฉนด" value={item.search.deedNo || ""} />
            <CopyField label="หรือชื่อเจ้าของเดิม" value={item.search.oldOwnerName || ""} />
          </div>
          <div className="divider my-1" />
          {item.steps.map((s, i) => (
            s.copyable
              ? <CopyField key={i} label={s.label} value={s.value} />
              : <p key={i} className="text-sm font-semibold mt-2">{s.label}</p>
          ))}
          <div className="divider my-1" />
          <input className="input input-bordered input-sm w-full" placeholder="หมายเหตุ (ใส่เมื่อข้าม)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn btn-success flex-1" onClick={() => advance("keyed")}>คีย์แล้ว ✓ ถัดไป</button>
            <button className="btn btn-ghost" onClick={() => advance("skip")}>ข้าม</button>
          </div>
        </div>
      </div>
    );
  }

  // ── List mode ──
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Worklist → LTAX (ค้างคีย์ {items.length})</h2>
        <button className="btn btn-primary" disabled={selected.size === 0} onClick={start}>
          เริ่มคีย์ ({selected.size})
        </button>
      </div>
      {error && <div className="alert alert-error mb-3">{error}</div>}
      {loading ? <span className="loading loading-spinner" /> : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead><tr><th></th><th>วันที่</th><th>ประเภท</th><th>โฉนด</th><th>recordKey</th><th>เจ้าของใหม่</th></tr></thead>
            <tbody>
              {items.map((t) => (
                <tr key={t._id}>
                  <td><input type="checkbox" className="checkbox checkbox-sm" checked={selected.has(t._id)} onChange={() => toggle(t._id)} /></td>
                  <td>{String(t.txnDate).slice(0, 10)}</td>
                  <td><span className="badge">{t.changeType}</span></td>
                  <td>{t.deedNo || "-"}</td>
                  <td className="font-mono text-xs">{t.recordKey}</td>
                  <td>{t.ownerFullName}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="text-center opacity-60">ไม่มีรายการค้างคีย์</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.
```bash
git add components/m10/WorklistPanel.jsx
git commit -m "feat(ltax-worklist): WorklistPanel UI (list + guided focus + copy)"
```

- [ ] **Step 3: Manual end-to-end (dev server)**

Start `npm run dev`, log in as admin, open `/admin/m10`:
- Tabs switch; `?tab=worklist` deep-links to the worklist tab.
- Upload `public/60070001_60010000.zip` (period `2569-01`) in นำเข้า; confirm a few TRANSFER rows in คิวยืนยัน.
- Worklist tab lists the confirmed transfers; select some → "เริ่มคีย์" → focus shows search keys + owner fields with copy buttons → "คีย์แล้ว ✓" advances and the item leaves the pending list.

---

## Task 8: Update module docs

**Files:** Modify `docs/modules/m10-ingest.md`

- [ ] **Step 1: Add a worklist + tabs section**

Append to `docs/modules/m10-ingest.md`:
```markdown

## Worklist → LTAX (rev. 2026-06-28)
- หน้า admin รวมเป็น `/admin/m10` แบบ tabs: นำเข้า · คิวยืนยัน · ทะเบียน · **Worklist → LTAX** (panels ที่ `components/m10/`)
- worklist = txn ที่ `reviewStatus=confirmed` && changeType ∈ {TRANSFER, OWNER_CORRECTION, BOUNDARY_CHANGE} && `ltaxStatus=pending`
- `lib/m10-ingest/worklist/buildWorklistItem.ts` (pure) → สคริปต์คีย์ตามลำดับ LTAX (ดึงเจ้าของดิบจาก payloadRaw); **ลำดับ field เป็น assumption ปรับได้** (ดู spec §5)
- API `pages/api/m10-ingest/worklist/*` (gate `/admin/m10`); เลขบัตรดิบส่งเฉพาะ focus endpoint, ไม่ log
- สถานะคีย์เก็บบน M10Transaction (`ltaxStatus/ltaxKeyedBy/ltaxKeyedAt/ltaxNote`)
- **ยังไม่รองรับ:** SPLIT/MERGE/NEW (ต้อง Parcel Code + basemap), RETIRED, RPA

Spec: `docs/superpowers/specs/2026-06-28-ltax-worklist-design.md`
```

- [ ] **Step 2: Commit**

```bash
git add docs/modules/m10-ingest.md
git commit -m "docs(ltax-worklist): module doc update (tabs + worklist)"
```

---

## Final verification

- [ ] `npm test` — all pass (existing 75 + buildWorklistItem 4 + worklist repository 4).
- [ ] `npx tsc --noEmit` — no new errors.
- [ ] `npm run lint` — clean (no `any`/require in new `.ts`).
- [ ] Manual: `/admin/m10` tabs work; worklist list → focus → copy → keyed/skip updates status and removes from pending; re-opening worklist does not show keyed items (idempotent).
- [ ] Sidebar shows a single "แผนที่ภาษี (ม.10)" entry; the old `/admin/m10-ingest|review|records` URLs 404 (intended).
- [ ] PII review: no `console.log` of `payloadRaw` / `getWorklistItem` result / national ID anywhere in `pages/api/m10-ingest/worklist/**`.

---

## Spec coverage map (self-review)

| Spec section | Task(s) |
|---|---|
| §1 scope (3 changeTypes, no Parcel Code) | 2 (only those 3 handled) |
| §2 LTAX domain (TRANSFER=add+remove owner) | 2 (TRANSFER steps) |
| §3 IA tabs + delete old routes + 1 permission | 5, 6 |
| §4 data model (ltax* fields + index) | 1 |
| §5 buildWorklistItem (data-driven, order=assumption) | 2 |
| §6 guided UI (list + focus + copy + keyed/skip) | 7 |
| §7 API + PII (gate /admin/m10, raw id focus-only, no log) | 4, Final verification |
| §8 Parcel Code (deferred) | — (correctly out of scope) |
| §9 testing (unit + repository + PII review) | 2, 3, Final verification |

**Out of scope (correctly absent):** SPLIT/MERGE/NEW + Parcel Code engine, RETIRED, RPA/auto-fill, basemap matching.
