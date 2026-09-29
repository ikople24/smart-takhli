# m10 ค้นหานิติกรรมข้ามเดือน — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มแท็บ "ค้นหา" ใน `/admin/m10` ที่ค้นนิติกรรมข้ามทุกงวดด้วยเลขโฉนด/เลขที่ดิน/ชื่อเจ้าของ/รหัสแปลง LTAX แล้วคลิกดูรายละเอียดเต็มได้ สำหรับตรวจสอบย้อนหลัง

**Architecture:** เพิ่มฟังก์ชัน query 2 ตัวใน `lib/m10-ingest/repository/index.ts` (ที่เดียวกับ query อื่นของโมดูลตามธรรมเนียมเดิม) + helper บริสุทธิ์ 1 ตัวในโฟลเดอร์ใหม่ `lib/m10-ingest/search/` (ตามแบบที่ `print/`, `worklist/`, `parcelcode/` แยก pure logic ออกจาก repository) + API 2 endpoint (list ไม่ส่งเลขบัตร / detail ส่งเต็มเฉพาะรายการที่คลิก ตามแบบ focus endpoint ของ worklist) + panel ใหม่ 1 ตัว

**Tech Stack:** Next.js 15 Pages Router · TypeScript · Mongoose · vitest + mongodb-memory-server · React 19 · Tailwind v4 + DaisyUI

**Spec:** `docs/superpowers/specs/2026-09-29-m10-cross-month-search-design.md`

---

### Task 1: helper escape regex (pure)

คำค้นมาจากผู้ใช้ตรง ๆ ถ้าใส่ `.` หรือ `*` แล้วเอาไปทำ `RegExp` ดิบ จะ match มั่วหรือ throw — ต้อง escape ก่อนเสมอ

**Files:**
- Create: `lib/m10-ingest/search/escapeRegex.ts`
- Test: `lib/m10-ingest/search/escapeRegex.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ต้องแดงก่อน**

สร้าง `lib/m10-ingest/search/escapeRegex.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { escapeRegex } from "./escapeRegex";

describe("escapeRegex", () => {
  it("ข้อความปกติไม่ถูกแก้", () => {
    expect(escapeRegex("81145")).toBe("81145");
    expect(escapeRegex("สมชาย")).toBe("สมชาย");
  });

  it("อักขระพิเศษของ regex ถูก escape", () => {
    expect(escapeRegex("01A001/002")).toBe("01A001/002");
    expect(escapeRegex("a.b")).toBe("a\\.b");
    expect(escapeRegex("a*b")).toBe("a\\*b");
    expect(escapeRegex("a+b?c")).toBe("a\\+b\\?c");
    expect(escapeRegex("(x)[y]{z}")).toBe("\\(x\\)\\[y\\]\\{z\\}");
  });

  it("ผลลัพธ์เอาไปสร้าง RegExp แล้ว match แบบตัวอักษรตรง ๆ", () => {
    const re = new RegExp(escapeRegex("a.b"), "i");
    expect(re.test("a.b")).toBe(true);
    expect(re.test("axb")).toBe(false);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าแดง**

Run: `npx vitest run lib/m10-ingest/search/escapeRegex.test.ts`
Expected: FAIL — `Failed to resolve import "./escapeRegex"`

- [ ] **Step 3: เขียน implementation ให้น้อยที่สุด**

สร้าง `lib/m10-ingest/search/escapeRegex.ts`:

```ts
// คำค้นมาจากผู้ใช้ → ต้อง escape ก่อนสร้าง RegExp เสมอ ไม่งั้น "." "*" จะ match มั่ว
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run lib/m10-ingest/search/escapeRegex.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: commit**

```bash
git add lib/m10-ingest/search/escapeRegex.ts lib/m10-ingest/search/escapeRegex.test.ts
git commit -m "feat(m10): helper escape regex สำหรับคำค้นจากผู้ใช้"
```

---

### Task 2: searchM10Transactions — query ข้ามงวด

**Files:**
- Modify: `lib/m10-ingest/repository/index.ts` (เพิ่ม import บรรทัดบนสุด + เพิ่มฟังก์ชันท้ายไฟล์)
- Test: `lib/m10-ingest/repository/search.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ต้องแดงก่อน**

สร้าง `lib/m10-ingest/repository/search.test.ts` (โครง setup ลอกจาก `print.test.ts` ในโฟลเดอร์เดียวกัน):

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createBatch, insertTransactionDedup, searchM10Transactions, M10Record } from "./index";
import type { NormalizedTxn } from "../types";

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });

function txn(over: Partial<NormalizedTxn> = {}): NormalizedTxn {
  return {
    docType: "PARCEL", recordKey: "K1", deedNo: "81145", rawStatus: "ขาย",
    changeType: "TRANSFER", taxRelevant: true, reviewStatus: "pending",
    txnDate: "2026-01-05", regAmount: null,
    owner: { title: "นางสาว", name: "วรารีย์", surname: "ชาลีรัตน์", fullName: "นางสาว วรารีย์ ชาลีรัตน์", idHash: "h" },
    area: { rai: 0, ngan: 0, wa: 53.6, sqm: 214.4 },
    payloadRaw: { PARCEL_NO: "81145", LAND_NO: "1100", OWN_PERS_ID: "1609700018248" },
    ...over,
  };
}

describe("searchM10Transactions", () => {
  it("ค้นด้วยเลขโฉนด", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    await insertTransactionDedup(b._id, txn({ recordKey: "K2", deedNo: "99999", payloadRaw: { LAND_NO: "2200" } }));

    const out = await searchM10Transactions("81145");
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].deedNo).toBe("81145");
    expect(out.rows[0].period).toBe("2569-01");
    expect(out.hasMore).toBe(false);
  });

  it("ค้นด้วยเลขที่ดิน (payloadRaw.LAND_NO)", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    const out = await searchM10Transactions("1100");
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].deedNo).toBe("81145");
  });

  it("ค้นด้วยชื่อเจ้าของบางส่วน", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    const out = await searchM10Transactions("วรารีย์");
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].ownerName).toBe("นางสาว วรารีย์ ชาลีรัตน์");
  });

  it("ค้นด้วย parcelCode (join จาก m10_records)", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    await M10Record.create({ recordKey: "K1", parcelCode: "01A001" });

    const out = await searchM10Transactions("01A001");
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].recordKey).toBe("K1");
    expect(out.rows[0].parcelCode).toBe("01A001");
  });

  it("parcelCode ที่ จนท. แก้ (reconcileOverride) ชนะค่า auto", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    await M10Record.create({ recordKey: "K1", parcelCode: "01A001", reconcileOverride: { parcelCode: "02B120", status: "resolved" } });

    const out = await searchM10Transactions("81145");
    expect(out.rows[0].parcelCode).toBe("02B120");
    const byOverride = await searchM10Transactions("02B120");
    expect(byOverride.rows).toHaveLength(1);
  });

  it("ผลลัพธ์ข้ามงวดมารวมกัน เรียงวันที่ใหม่→เก่า", async () => {
    const jan = await createBatch({ fileHash: "hJan", period: "2569-01", files: [], counts: {} });
    const feb = await createBatch({ fileHash: "hFeb", period: "2569-02", files: [], counts: {} });
    await insertTransactionDedup(jan._id, txn({ txnDate: "2026-01-05" }));
    await insertTransactionDedup(feb._id, txn({ txnDate: "2026-02-09", rawStatus: "ให้" }));

    const out = await searchM10Transactions("81145");
    expect(out.rows).toHaveLength(2);
    expect(out.rows.map((r) => r.period)).toEqual(["2569-02", "2569-01"]);
  });

  it("ไม่กรองตาม reviewStatus — เห็นทั้ง confirmed/rejected/auto", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn({ reviewStatus: "rejected", rawStatus: "ขาย" }));
    await insertTransactionDedup(b._id, txn({ reviewStatus: "auto", rawStatus: "จำนอง", taxRelevant: false }));

    const out = await searchM10Transactions("81145");
    expect(out.rows).toHaveLength(2);
    expect(out.rows.map((r) => r.reviewStatus).sort()).toEqual(["auto", "rejected"]);
  });

  it("แบ่งหน้าด้วย skip/limit และบอก hasMore", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    for (let i = 0; i < 3; i++) {
      await insertTransactionDedup(b._id, txn({ recordKey: `K${i}`, txnDate: `2026-01-0${i + 1}` }));
    }
    const p1 = await searchM10Transactions("81145", { limit: 2 });
    expect(p1.rows).toHaveLength(2);
    expect(p1.hasMore).toBe(true);

    const p2 = await searchM10Transactions("81145", { skip: 2, limit: 2 });
    expect(p2.rows).toHaveLength(1);
    expect(p2.hasMore).toBe(false);
  });

  it("ไม่พบ → คืน array ว่าง ไม่ throw", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    const out = await searchM10Transactions("ไม่มีคำนี้");
    expect(out.rows).toEqual([]);
    expect(out.hasMore).toBe(false);
  });

  it("คำค้นที่มีอักขระ regex พิเศษไม่ทำให้ query พัง", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    const out = await searchM10Transactions("8.1145");
    expect(out.rows).toEqual([]);
  });

  it("ไม่ส่ง payloadRaw/เลขบัตรออกมาในผลลัพธ์รายการ", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    const out = await searchM10Transactions("81145");
    expect(JSON.stringify(out.rows)).not.toContain("1609700018248");
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าแดง**

Run: `npx vitest run lib/m10-ingest/repository/search.test.ts`
Expected: FAIL — `searchM10Transactions is not a function` (ยังไม่มีฟังก์ชัน)

- [ ] **Step 3: เพิ่ม import ที่บรรทัดบนของ `lib/m10-ingest/repository/index.ts`**

แทรกต่อจากบรรทัด `import { normalizeEditedGeometry } from "../basemap/load";` (บรรทัด 7):

```ts
import { escapeRegex } from "../search/escapeRegex";
```

- [ ] **Step 4: เพิ่มฟังก์ชันท้ายไฟล์ `lib/m10-ingest/repository/index.ts`**

ต่อท้ายไฟล์ (หลัง `listPrintRows`):

```ts
// ---- ค้นหานิติกรรมข้ามงวด (ตรวจสอบย้อนหลัง) ----
// ไม่กรอง reviewStatus — เครื่องมือตรวจสอบต้องเห็นครบทั้ง pending/confirmed/rejected/auto
// (หลักการเดียวกับเล่มพิมพ์ ดู print.test.ts)
export interface SearchTxnRow {
  txnId: string;
  period: string | null;
  txnDate: Date;
  docType: string;
  changeType: string;
  deedNo: string | null;
  landNo: string | null;
  recordKey: string | null;
  ownerName: string | null;
  area: { rai: number; ngan: number; wa: number; sqm: number } | null;
  /** เนื้อที่สิ่งปลูกสร้างเป็น ตร.ม. จากไฟล์ดิบ (CONSTRUCTION ไม่มี ไร่-งาน-วา → area เป็น null) */
  constructionArea: string | null;
  reviewStatus: string;
  ltaxStatus: string | null;
  parcelCode: string | null;
}

export async function searchM10Transactions(
  q: string,
  opts: { skip?: number; limit?: number } = {}
): Promise<{ rows: SearchTxnRow[]; hasMore: boolean }> {
  const limit = opts.limit ?? 20;
  const skip = opts.skip ?? 0;
  const regex = new RegExp(escapeRegex(q), "i");

  // parcelCode ไม่ได้เก็บบน transaction ต้องหา recordKey จาก m10_records ก่อน
  const codeKeys = (await M10Record.find({
    $or: [{ parcelCode: regex }, { "reconcileOverride.parcelCode": regex }],
  }).distinct("recordKey")) as string[];

  const or: Record<string, unknown>[] = [
    { deedNo: regex },
    { "payloadRaw.LAND_NO": regex },
    { "owner.fullName": regex },
  ];
  if (codeKeys.length > 0) or.push({ recordKey: { $in: codeKeys } });

  // ดึงเกิน 1 แถวเพื่อรู้ว่ายังมีหน้าถัดไปไหม โดยไม่ต้อง count ทั้ง collection
  // payloadRaw ดึงเฉพาะ LAND_NO — ห้ามดึงทั้งก้อนเพราะมีเลขบัตร 13 หลัก
  const txns = await M10Transaction.find({ $or: or })
    .sort({ txnDate: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit + 1)
    .select("docType changeType deedNo recordKey owner.fullName area reviewStatus ltaxStatus txnDate batchId payloadRaw.LAND_NO payloadRaw.AREA")
    .lean();

  const hasMore = txns.length > limit;
  const page = txns.slice(0, limit);
  if (page.length === 0) return { rows: [], hasMore: false };

  const batchIds = [...new Set(page.map((t: { batchId: unknown }) => String(t.batchId)))];
  const batches = await M10ImportBatch.find({ _id: { $in: batchIds } }).select("_id period").lean();
  const periodOf = new Map<string, string>(
    batches.map((b: { _id: unknown; period: string }) => [String(b._id), b.period])
  );

  const recordKeys = [...new Set(page.map((t: { recordKey?: string }) => t.recordKey).filter(Boolean))] as string[];
  const records = await M10Record.find({ recordKey: { $in: recordKeys } })
    .select("recordKey parcelCode reconcileOverride.parcelCode")
    .lean();
  const codeByKey = new Map<string, string | null>();
  for (const r of records) {
    codeByKey.set(r.recordKey, r.reconcileOverride?.parcelCode ?? r.parcelCode ?? null);
  }

  const rows: SearchTxnRow[] = page.map((t: Record<string, unknown>) => {
    const recordKey = (t.recordKey as string) ?? null;
    return {
      txnId: String(t._id),
      period: periodOf.get(String(t.batchId)) ?? null,
      txnDate: t.txnDate as Date,
      docType: (t.docType as string) ?? "",
      changeType: (t.changeType as string) ?? "",
      deedNo: (t.deedNo as string) ?? null,
      landNo: (t.payloadRaw as { LAND_NO?: string } | undefined)?.LAND_NO ?? null,
      recordKey,
      ownerName: (t.owner as { fullName?: string } | undefined)?.fullName ?? null,
      area: (t.area as SearchTxnRow["area"]) ?? null,
      constructionArea: (t.payloadRaw as { AREA?: string } | undefined)?.AREA ?? null,
      reviewStatus: (t.reviewStatus as string) ?? "",
      ltaxStatus: (t.ltaxStatus as string) ?? null,
      parcelCode: recordKey ? codeByKey.get(recordKey) ?? null : null,
    };
  });

  return { rows, hasMore };
}
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

Run: `npx vitest run lib/m10-ingest/repository/search.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 6: เช็ค type**

Run: `npx tsc --noEmit -p .`
Expected: ไม่มี output (ผ่าน)

- [ ] **Step 7: commit**

```bash
git add lib/m10-ingest/repository/index.ts lib/m10-ingest/repository/search.test.ts
git commit -m "feat(m10): ค้นหานิติกรรมข้ามงวดด้วยโฉนด/เลขที่ดิน/ชื่อ/parcelCode"
```

---

### Task 3: getM10TransactionDetail — รายละเอียดเต็มรายการเดียว

endpoint แยกสำหรับรายการที่คลิกเท่านั้น (ส่ง payloadRaw เต็มรวมเลขบัตร) — ตามแบบ focus endpoint ของ worklist ที่ส่งเลขบัตรดิบเฉพาะจุดที่จำเป็น ไม่ส่งมาพร้อมลิสต์

**Files:**
- Modify: `lib/m10-ingest/repository/index.ts` (เพิ่มฟังก์ชันต่อจาก Task 2)
- Test: `lib/m10-ingest/repository/search.test.ts` (เพิ่ม describe block)

- [ ] **Step 1: เขียนเทสต์ที่ต้องแดงก่อน**

ต่อท้าย `lib/m10-ingest/repository/search.test.ts` (นอก describe เดิม) — และแก้บรรทัด import บนสุดให้เพิ่ม `getM10TransactionDetail`:

```ts
import { createBatch, insertTransactionDedup, searchM10Transactions, getM10TransactionDetail, M10Record } from "./index";
```

```ts
describe("getM10TransactionDetail", () => {
  it("คืนรายละเอียดเต็มรวม payloadRaw, งวด และ parcelCode", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    const t = await insertTransactionDedup(b._id, txn());
    await M10Record.create({ recordKey: "K1", parcelCode: "01A001" });

    const detail = await getM10TransactionDetail(String(t.doc._id));
    expect(detail).not.toBeNull();
    expect(detail!.period).toBe("2569-01");
    expect(detail!.deedNo).toBe("81145");
    expect(detail!.parcelCode).toBe("01A001");
    expect(detail!.payloadRaw.OWN_PERS_ID).toBe("1609700018248");
    expect(detail!.area).toEqual({ rai: 0, ngan: 0, wa: 53.6, sqm: 214.4 });
    expect(detail!.reviewStatus).toBe("pending");
  });

  it("เก็บเจ้าของร่วมมาด้วย", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    const first = await insertTransactionDedup(b._id, txn({
      payloadRaw: { PARCEL_NO: "81145", LAND_NO: "1100", OWN_LINE_NO: "1", OWN_FNAME: "หนึ่ง" },
    }));
    await insertTransactionDedup(b._id, txn({
      payloadRaw: { PARCEL_NO: "81145", LAND_NO: "1100", OWN_LINE_NO: "2", OWN_FNAME: "สอง" },
    }));

    const detail = await getM10TransactionDetail(String(first.doc._id));
    expect(detail!.coOwnerRows).toHaveLength(1);
    expect(detail!.coOwnerRows[0].OWN_FNAME).toBe("สอง");
  });

  it("ไม่มีรายการนี้ → null (ให้ API ตอบ 404 ได้)", async () => {
    const detail = await getM10TransactionDetail("000000000000000000000000");
    expect(detail).toBeNull();
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าแดง**

Run: `npx vitest run lib/m10-ingest/repository/search.test.ts`
Expected: FAIL — `getM10TransactionDetail is not a function`

- [ ] **Step 3: เพิ่มฟังก์ชันต่อท้าย `lib/m10-ingest/repository/index.ts`**

```ts
export interface SearchTxnDetail {
  txnId: string;
  period: string | null;
  txnDate: Date;
  docType: string;
  changeType: string;
  rawStatus: string;
  deedNo: string | null;
  recordKey: string | null;
  ownerName: string | null;
  area: { rai: number; ngan: number; wa: number; sqm: number } | null;
  regAmount: number | null;
  reviewStatus: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  ltaxStatus: string | null;
  ltaxKeyedBy: string | null;
  ltaxKeyedAt: Date | null;
  ltaxNote: string | null;
  parcelCode: string | null;
  payloadRaw: Record<string, string>;
  coOwnerRows: Record<string, string>[];
}

/** รายละเอียดเต็มของนิติกรรมเดียว — มีเลขบัตร 13 หลัก ใช้เฉพาะตอน จนท. คลิกดูรายการนั้น */
export async function getM10TransactionDetail(txnId: string): Promise<SearchTxnDetail | null> {
  if (!Types.ObjectId.isValid(txnId)) return null;
  const t = await M10Transaction.findById(txnId).lean();
  if (!t) return null;

  const batch = t.batchId ? await M10ImportBatch.findById(t.batchId).select("period").lean() : null;
  const record = t.recordKey
    ? await M10Record.findOne({ recordKey: t.recordKey }).select("parcelCode reconcileOverride.parcelCode").lean()
    : null;

  return {
    txnId: String(t._id),
    period: batch?.period ?? null,
    txnDate: t.txnDate,
    docType: t.docType ?? "",
    changeType: t.changeType ?? "",
    rawStatus: t.rawStatus ?? "",
    deedNo: t.deedNo ?? null,
    recordKey: t.recordKey ?? null,
    ownerName: t.owner?.fullName ?? null,
    area: t.area ?? null,
    regAmount: t.regAmount ?? null,
    reviewStatus: t.reviewStatus ?? "",
    reviewedBy: t.reviewedBy ?? null,
    reviewedAt: t.reviewedAt ?? null,
    ltaxStatus: t.ltaxStatus ?? null,
    ltaxKeyedBy: t.ltaxKeyedBy ?? null,
    ltaxKeyedAt: t.ltaxKeyedAt ?? null,
    ltaxNote: t.ltaxNote ?? null,
    parcelCode: record?.reconcileOverride?.parcelCode ?? record?.parcelCode ?? null,
    payloadRaw: t.payloadRaw ?? {},
    coOwnerRows: t.coOwnerRows ?? [],
  };
}
```

หมายเหตุ: `Types` import อยู่บรรทัดแรกของไฟล์แล้ว (`import type { Types } from "mongoose"`) — เป็น **type-only import** ใช้ `Types.ObjectId.isValid()` ตอน runtime ไม่ได้ ต้องแก้บรรทัดที่ 1 เป็น:

```ts
import { Types } from "mongoose";
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run lib/m10-ingest/repository/search.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: เช็ค type + เทสต์ทั้งโมดูลไม่พัง**

Run: `npx tsc --noEmit -p . && npx vitest run lib/m10-ingest`
Expected: tsc เงียบ · vitest ผ่านหมด ยกเว้น 2 ไฟล์เดิมที่ fail เพราะไม่มี `public/60070001_60010000.zip` (gitignore ไว้ — fail อยู่แล้วก่อนแก้ ไม่ใช่ของใหม่)

- [ ] **Step 6: commit**

```bash
git add lib/m10-ingest/repository/index.ts lib/m10-ingest/repository/search.test.ts
git commit -m "feat(m10): ดึงรายละเอียดเต็มของนิติกรรมรายรายการ"
```

---

### Task 4: API endpoints

**Files:**
- Create: `pages/api/m10-ingest/search/index.js`
- Create: `pages/api/m10-ingest/search/[txnId].js`

หมายเหตุ: repo นี้**ไม่มีเทสต์อัตโนมัติฝั่ง API** (vitest ครอบเฉพาะ logic ล้วนใน `lib/` ตาม CLAUDE.md) — การตรวจ `q` สั้นกว่า 2 ตัว → 400 จึงทดสอบด้วยมือใน Task 5 Step 4 ไม่ใช่การมองข้าม

- [ ] **Step 1: สร้าง endpoint ลิสต์ `pages/api/m10-ingest/search/index.js`**

```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../_auth";

const PER_PAGE = 20;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.status(400).json({ error: "คำค้นต้องมีอย่างน้อย 2 ตัวอักษร" });

  const skip = Math.max(0, Number(req.query.skip) || 0);

  await dbConnect();
  const { searchM10Transactions } = await import("@/lib/m10-ingest/repository/index");
  const { rows, hasMore } = await searchM10Transactions(q, { skip, limit: PER_PAGE });
  return res.status(200).json({ rows, hasMore });
}
```

- [ ] **Step 2: สร้าง endpoint รายละเอียด `pages/api/m10-ingest/search/[txnId].js`**

```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  await dbConnect();
  const { getM10TransactionDetail } = await import("@/lib/m10-ingest/repository/index");
  const detail = await getM10TransactionDetail(String(req.query.txnId || ""));
  if (!detail) return res.status(404).json({ error: "ไม่พบรายการนี้" });
  return res.status(200).json(detail);
}
```

- [ ] **Step 3: เช็คว่า route ใหม่ไม่ชนกับของเดิม**

Run: `find pages/api/m10-ingest -name "*.js" -o -name "*.ts" | sort`
Expected: เห็น `search/index.js` และ `search/[txnId].js` และ **ไม่มี** ไฟล์ dynamic ชื่ออื่นในโฟลเดอร์ `search/` (Next.js จะล้มทั้ง dev server ถ้ามี slug 2 ชื่อในโฟลเดอร์เดียวกัน)

- [ ] **Step 4: เช็ค lint**

Run: `npm run lint`
Expected: ไม่มี error ของไฟล์ใหม่ 2 ไฟล์นี้

- [ ] **Step 5: commit**

```bash
git add pages/api/m10-ingest/search/
git commit -m "feat(m10): API ค้นหานิติกรรม + รายละเอียดรายรายการ"
```

---

### Task 5: UI — แท็บ "ค้นหา"

**Files:**
- Create: `components/m10/SearchPanel.jsx`
- Modify: `pages/admin/m10.jsx:4-20` (เพิ่ม import + entry ใน TABS)

- [ ] **Step 1: สร้าง `components/m10/SearchPanel.jsx`**

```jsx
import { useEffect, useState, useCallback, useRef } from "react";
import { formatRaiNganWa, formatSqm } from "@/lib/m10-ingest/format";
import { docTypeLabel, changeTypeLabel, periodLabel } from "@/lib/m10-ingest/print/labels";

const MIN_Q = 2;

const REVIEW_LABEL = {
  pending: "รอยืนยัน", confirmed: "ยืนยันแล้ว", rejected: "ปฏิเสธ", auto: "อัตโนมัติ",
};
const LTAX_LABEL = { pending: "ค้างคีย์", keyed: "คีย์แล้ว", skipped: "ข้าม" };

export default function SearchPanel() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // กันผลลัพธ์ของคำค้นเก่ามาทับคำค้นใหม่ (พิมพ์เร็ว ๆ แล้ว response สลับคิวกัน)
  const reqIdRef = useRef(0);

  const runSearch = useCallback(async (q, skip) => {
    const myReq = ++reqIdRef.current;
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/m10-ingest/search?q=${encodeURIComponent(q)}&skip=${skip}`);
      const data = await res.json();
      if (myReq !== reqIdRef.current) return; // มีคำค้นใหม่แซงแล้ว ทิ้งผลเก่า
      if (!res.ok) throw new Error(data.error || "ค้นหาไม่สำเร็จ");
      setRows((prev) => (skip === 0 ? data.rows : [...prev, ...data.rows]));
      setHasMore(data.hasMore);
      setSearched(true);
    } catch (e) {
      if (myReq === reqIdRef.current) setError(e.message);
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  }, []);

  // หน่วงก่อนยิง เพื่อไม่ให้ query ทุกตัวอักษรที่พิมพ์
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_Q) { setRows([]); setHasMore(false); setSearched(false); setError(""); return; }
    const timer = setTimeout(() => runSearch(q, 0), 300);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  async function openDetail(txnId) {
    setDetailLoading(true); setDetail(null); setError("");
    try {
      const res = await fetch(`/api/m10-ingest/search/${txnId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดรายละเอียดไม่สำเร็จ");
      setDetail(data);
    } catch (e) { setError(e.message); }
    finally { setDetailLoading(false); }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">ค้นหานิติกรรมย้อนหลัง</h2>
      <p className="text-sm opacity-70 mb-3">ค้นข้ามทุกงวดที่นำเข้าแล้ว — เห็นทุกสถานะรวมรายการที่ยังรอยืนยัน</p>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          type="search"
          className="input input-bordered input-sm w-full max-w-md"
          placeholder="ค้นหา เลขโฉนด / เลขที่ดิน / ชื่อเจ้าของ / รหัสแปลง LTAX"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && <button className="btn btn-ghost btn-sm" onClick={() => setQuery("")}>ล้างคำค้น</button>}
      </div>

      {query.trim().length > 0 && query.trim().length < MIN_Q && (
        <p className="text-sm opacity-60 mb-3">พิมพ์อย่างน้อย {MIN_Q} ตัวอักษร</p>
      )}
      {error && <div className="alert alert-error mb-3">{error}</div>}

      {searched && (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>งวด</th><th>วันที่</th><th>ประเภท</th><th>นิติกรรม</th>
                <th>โฉนด</th><th>เลขที่ดิน</th><th>เจ้าของ</th>
                <th>เนื้อที่ (ไร่-งาน-วา)</th><th>รหัสแปลง</th><th>สถานะ</th><th>LTAX</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.txnId} className="cursor-pointer hover" onClick={() => openDetail(r.txnId)}>
                  <td className="whitespace-nowrap">{periodLabel(r.period)}</td>
                  <td className="whitespace-nowrap">{String(r.txnDate).slice(0, 10)}</td>
                  <td>{docTypeLabel(r.docType)}</td>
                  <td>{changeTypeLabel(r.changeType)}</td>
                  <td>{r.deedNo || "-"}</td>
                  <td>{r.landNo || "-"}</td>
                  <td>{r.ownerName || "-"}</td>
                  <td className="whitespace-nowrap tabular-nums">
                    {r.docType === "CONSTRUCTION" ? formatSqm(r.constructionArea) : formatRaiNganWa(r.area)}
                  </td>
                  <td className="font-mono text-xs">{r.parcelCode || "-"}</td>
                  <td><span className="badge badge-sm">{REVIEW_LABEL[r.reviewStatus] || r.reviewStatus}</span></td>
                  <td>{LTAX_LABEL[r.ltaxStatus] || "-"}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr><td colSpan={11} className="text-center opacity-60">ไม่พบรายการที่ตรงกับคำค้น</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {loading && <div className="mt-3"><span className="loading loading-spinner" /></div>}

      {hasMore && !loading && (
        <button className="btn btn-sm mt-3" onClick={() => runSearch(query.trim(), rows.length)}>
          โหลดเพิ่ม
        </button>
      )}

      {searched && rows.length > 0 && (
        <p className="text-xs opacity-60 mt-3">แสดง {rows.length} รายการ · คลิกแถวเพื่อดูรายละเอียดเต็ม</p>
      )}

      {(detail || detailLoading) && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-3xl">
            {detailLoading ? <span className="loading loading-spinner" /> : detail && (
              <>
                <h3 className="font-bold text-lg mb-1">
                  {docTypeLabel(detail.docType)} · {changeTypeLabel(detail.changeType)}
                </h3>
                <p className="text-sm opacity-70 mb-3">
                  งวด {periodLabel(detail.period)} · วันที่ {String(detail.txnDate).slice(0, 10)} · สถานะเดิมในไฟล์: {detail.rawStatus || "-"}
                </p>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-4">
                  <div><span className="opacity-60">โฉนด:</span> {detail.deedNo || "-"}</div>
                  <div><span className="opacity-60">รหัสแปลง:</span> {detail.parcelCode || "-"}</div>
                  <div><span className="opacity-60">เจ้าของ:</span> {detail.ownerName || "-"}</div>
                  <div><span className="opacity-60">เนื้อที่:</span> {detail.docType === "CONSTRUCTION" ? formatSqm(detail.payloadRaw?.AREA) : formatRaiNganWa(detail.area)}</div>
                  <div><span className="opacity-60">recordKey:</span> <span className="font-mono text-xs">{detail.recordKey || "-"}</span></div>
                  <div><span className="opacity-60">ราคาประเมิน:</span> {detail.regAmount ?? "-"}</div>
                  <div><span className="opacity-60">สถานะยืนยัน:</span> {REVIEW_LABEL[detail.reviewStatus] || detail.reviewStatus}
                    {detail.reviewedBy ? ` (${detail.reviewedBy} ${String(detail.reviewedAt || "").slice(0, 10)})` : ""}</div>
                  <div><span className="opacity-60">คีย์ LTAX:</span> {LTAX_LABEL[detail.ltaxStatus] || "-"}
                    {detail.ltaxKeyedBy ? ` (${detail.ltaxKeyedBy} ${String(detail.ltaxKeyedAt || "").slice(0, 10)})` : ""}</div>
                </div>

                {detail.ltaxNote && <p className="text-sm mb-3"><span className="opacity-60">หมายเหตุ:</span> {detail.ltaxNote}</p>}

                {detail.coOwnerRows?.length > 0 && (
                  <>
                    <h4 className="font-semibold text-sm mt-3 mb-1">เจ้าของร่วม ({detail.coOwnerRows.length})</h4>
                    <ul className="text-sm list-disc ms-5">
                      {detail.coOwnerRows.map((c, i) => (
                        <li key={i}>{[c.OWN_TITLE, c.OWN_FNAME, c.OWN_LNAME].filter(Boolean).join(" ")}</li>
                      ))}
                    </ul>
                  </>
                )}

                <h4 className="font-semibold text-sm mt-4 mb-1">ข้อมูลดิบจากไฟล์กรมที่ดิน</h4>
                <div className="overflow-x-auto max-h-80">
                  <table className="table table-xs">
                    <tbody>
                      {Object.entries(detail.payloadRaw || {}).map(([k, v]) => (
                        <tr key={k}>
                          <td className="font-mono text-xs opacity-70 w-1/3">{k}</td>
                          <td className="text-xs">{String(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div className="modal-action">
              <button className="btn btn-sm" onClick={() => setDetail(null)}>ปิด</button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={() => setDetail(null)} aria-label="ปิด" />
        </dialog>
      )}
    </div>
  );
}
```

- [ ] **Step 2: เพิ่มแท็บใน `pages/admin/m10.jsx`**

เพิ่ม import ต่อจากบรรทัด 10 (`import NewCodePanel ...`):

```jsx
import SearchPanel from "@/components/m10/SearchPanel";
```

แล้วเพิ่ม entry ใน `TABS` ต่อจากบรรทัด `{ key: "records", label: "ทะเบียน (as-of)", Panel: RecordsPanel },`:

```jsx
  { key: "search", label: "ค้นหาย้อนหลัง", Panel: SearchPanel },
```

- [ ] **Step 3: เช็ค lint + type + build**

Run: `npm run lint && npx tsc --noEmit -p .`
Expected: ไม่มี error

- [ ] **Step 4: ทดสอบด้วยมือบน dev server**

⚠️ ก่อนสตาร์ท: `lsof -i :3000` เช็คว่ามี dev server ค้างอยู่ไหม (ห้ามรัน 2 ตัวใน `.next` เดียวกัน) — ถ้ามีให้ใช้ตัวเดิม

Run: `npm run dev` แล้วเปิด `http://localhost:3000/admin/m10?tab=search`

ทดสอบ:
1. พิมพ์ `81145` → ต้องเจอนิติกรรมของโฉนดนี้ (มีจริงในฐาน งวด 2569)
2. พิมพ์ `1100` → ต้องเจอรายการที่เลขที่ดิน 1100
3. พิมพ์ชื่อเจ้าของบางส่วน → เจอรายการของคนนั้น
4. คลิกแถว → modal เปิด เห็น payloadRaw ครบ + เนื้อที่แสดงแบบ ไร่-งาน-วา
5. ถ้าผลเกิน 20 แถว → ปุ่ม "โหลดเพิ่ม" ต่อท้ายได้
6. พิมพ์ตัวอักษรเดียว → ไม่ยิง API (ขึ้นข้อความให้พิมพ์อย่างน้อย 2 ตัว)

- [ ] **Step 5: commit**

```bash
git add components/m10/SearchPanel.jsx pages/admin/m10.jsx
git commit -m "feat(m10): แท็บค้นหานิติกรรมย้อนหลัง + modal รายละเอียด"
```

---

### Task 6: เอกสารโมดูล + ตรวจครั้งสุดท้าย

**Files:**
- Modify: `docs/modules/m10-ingest.md` (เพิ่มหัวข้อใหม่ก่อน `## Open items`)

- [ ] **Step 1: เพิ่มหัวข้อในเอกสารโมดูล**

แทรกก่อนบรรทัด `## Open items`:

```markdown
## ค้นหานิติกรรมย้อนหลัง (2026-09-29)
- แท็บ **"ค้นหาย้อนหลัง"** ใน `/admin/m10` (`components/m10/SearchPanel.jsx`) — ค้นข้ามทุกงวด ไม่ต้องเลือกเดือนก่อน
- `searchM10Transactions()` ใน `repository/index.ts`: `$or` ข้าม `deedNo` · `payloadRaw.LAND_NO` · `owner.fullName` · `recordKey` ที่ parcelCode ตรง (join `m10_records` เพราะ parcelCode ไม่ได้อยู่บน transaction) · **ไม่กรอง reviewStatus** (เครื่องมือตรวจสอบต้องเห็นครบ หลักการเดียวกับเล่มพิมพ์)
- คำค้นต้อง escape regex เสมอ (`lib/m10-ingest/search/escapeRegex.ts`) — มาจากผู้ใช้ตรง ๆ
- **ลิสต์ไม่ส่ง payloadRaw/เลขบัตร** — เลขบัตร 13 หลักส่งเฉพาะ `GET /api/m10-ingest/search/[txnId]` ตอนคลิกดูรายการเดียว (แบบเดียวกับ focus endpoint ของ worklist)
- ยังไม่รองรับ: ค้นด้วยชื่อ**เจ้าของร่วม** (คนที่ 2+ อยู่ใน `coOwnerRows` เป็น raw payload ไม่ได้ต่อเป็น fullName)

Spec: `docs/superpowers/specs/2026-09-29-m10-cross-month-search-design.md` · Plan: `docs/superpowers/plans/2026-09-29-m10-cross-month-search.md`
```

- [ ] **Step 2: รันเทสต์ทั้งชุด + type + build**

Run: `npx vitest run lib/m10-ingest && npx tsc --noEmit -p . && npm run lint`
Expected: vitest ผ่านหมด ยกเว้น 2 ไฟล์เดิมที่ต้องมี `public/60070001_60010000.zip` (gitignore ไว้ — fail มาก่อนแล้ว) · tsc เงียบ · lint สะอาด

- [ ] **Step 3: build จริงก่อน push (บทเรียนเดิมของ repo นี้)**

⚠️ ปิด `next dev` ก่อน แล้วค่อย build (รัน build ขณะ dev ยังอยู่ = API ตอบ 500 แบบเงียบ)

Run: `npm run build`
Expected: exit 0

- [ ] **Step 4: commit**

```bash
git add docs/modules/m10-ingest.md
git commit -m "docs(m10): บันทึกแท็บค้นหานิติกรรมย้อนหลัง"
```
