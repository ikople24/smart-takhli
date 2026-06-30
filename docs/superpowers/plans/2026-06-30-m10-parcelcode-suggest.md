# ผู้ช่วยแนะรหัสแปลง SPLIT/MERGE/NEW — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แท็บ "รหัสแปลงใหม่" ใน /admin/m10 ที่แนะ ParcelCode ให้ record SPLIT/MERGE/NEW (จาก geometry+basemap+โฉนด) → จนท. ยืนยัน → สร้างแปลงใน basemap (รูป m10) + record เข้า worklist คีย์ LTAX

**Architecture:** เอนจินแนะรหัสเป็น pure fn (resolver inject แบบ matchParcel); ยืนยัน reuse `resolveReconcile`+`applyBasemapEdit` ผ่าน wrapper `confirmNewCode` (inject geometry=record.geometry); worklist eligibility ขยายให้ครอบ deferred ที่ resolved (ผ่าน distinct resolved recordKeys)

**Tech Stack:** TypeScript, MongoDB/Mongoose, Next.js pages router, react-leaflet (reuse ReconcileMap), vitest + mongodb-memory-server

**Branch:** `new-m10` (commit ทุก task)

**Spec:** `docs/superpowers/specs/2026-06-30-m10-parcelcode-suggest-design.md`

---

## File Structure

**สร้างใหม่**
- `lib/m10-ingest/parcelcode/parcelCode.ts` — parse/suffix/seq (pure)
- `lib/m10-ingest/parcelcode/parcelCode.test.ts`
- `lib/m10-ingest/parcelcode/suggest.ts` — `suggestForRecord` (pure, resolver inject)
- `lib/m10-ingest/parcelcode/suggest.test.ts`
- `pages/api/m10-ingest/newcode/index.js` — GET list
- `pages/api/m10-ingest/newcode/[recordKey]/index.js` — GET detail
- `pages/api/m10-ingest/newcode/[recordKey]/confirm.js` — POST confirm
- `components/m10/NewCodePanel.jsx` — list + focus (reuse ReconcileMap)

**แก้ไข**
- `lib/m10-ingest/repository/index.ts` — `listNewCode`, `getNewCodeItem`, `confirmNewCode` + worklist eligibility (summaryByPeriod + listWorklistPending) ขยาย deferred-resolved
- `lib/m10-ingest/repository/newcode.test.ts` (สร้างใหม่) — integration
- `pages/admin/m10.jsx` — เพิ่ม tab
- `docs/modules/m10-ingest.md`

---

## Task 1: parcelCode lib (parse / block-seq / suffix)

**Files:**
- Create: `lib/m10-ingest/parcelcode/parcelCode.ts`
- Test: `lib/m10-ingest/parcelcode/parcelCode.test.ts`

- [ ] **Step 1: Write failing test**

`lib/m10-ingest/parcelcode/parcelCode.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseParcelCode, nextBlockSeq, nextSuffix } from "./parcelCode";

describe("parseParcelCode", () => {
  it("แยก zone/block/seq/suffixes", () => {
    expect(parseParcelCode("07K002")).toEqual({ zone: "07", block: "K", seq: "002", suffixes: [] });
    expect(parseParcelCode("07K002/004")).toEqual({ zone: "07", block: "K", seq: "002", suffixes: ["004"] });
    expect(parseParcelCode("01A001/002/01")).toEqual({ zone: "01", block: "A", seq: "001", suffixes: ["002", "01"] });
    expect(parseParcelCode("bad")).toBeNull();
  });
});

describe("nextBlockSeq", () => {
  it("seq ถัดไปในบล็อก (3 หลัก), ข้ามเลขหาย, บล็อกว่าง = 001", () => {
    expect(nextBlockSeq("02B", ["02B120", "02B118", "02A001"])).toBe("02B121");
    expect(nextBlockSeq("02B", [])).toBe("02B001");
    expect(nextBlockSeq("02B", ["02B005", "02B003"])).toBe("02B006");
    // ไม่นับรหัสที่มี suffix
    expect(nextBlockSeq("02B", ["02B120/001"])).toBe("02B121");
  });
});

describe("nextSuffix", () => {
  it("รหัสลูกถัดไปตามชั้น", () => {
    expect(nextSuffix("01A001", [])).toBe("01A001/001");
    expect(nextSuffix("01A001", ["01A001/001"])).toBe("01A001/002");
    expect(nextSuffix("01A001", ["01A001/001", "01A001/003"])).toBe("01A001/004");
    // ชั้น 2: parent มี suffix แล้ว → /01
    expect(nextSuffix("01A001/002", [])).toBe("01A001/002/01");
    expect(nextSuffix("01A001/002", ["01A001/002/01"])).toBe("01A001/002/02");
    // ชั้น 3 → /1
    expect(nextSuffix("01A001/002/01", [])).toBe("01A001/002/01/1");
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `npx vitest run lib/m10-ingest/parcelcode/parcelCode.test.ts`
Expected: FAIL — "Failed to resolve import ./parcelCode"

- [ ] **Step 3: Implement `parcelCode.ts`**

`lib/m10-ingest/parcelcode/parcelCode.ts`:
```ts
// ParcelCode = ZONE(2 ตัวเลข) + BLOCK(1 อักษร) + SEQ(ตัวเลข) + suffix /NNN /NN /N (pure)
export interface ParsedCode { zone: string; block: string; seq: string; suffixes: string[]; }

export function parseParcelCode(code: string | null | undefined): ParsedCode | null {
  if (!code || typeof code !== "string") return null;
  const m = code.match(/^(\d{2})([A-Za-z])(\d+)((?:\/[^/]+)*)$/);
  if (!m) return null;
  const suffixes = m[4] ? m[4].split("/").filter(Boolean) : [];
  return { zone: m[1], block: m[2].toUpperCase(), seq: m[3], suffixes };
}

// seq ถัดไปในบล็อก (เช่น "02B") จาก code ที่ไม่มี suffix; คืน "02B121" (3 หลักขั้นต่ำ)
export function nextBlockSeq(zoneBlock: string, existingCodes: string[]): string {
  const re = new RegExp(`^${zoneBlock}(\\d+)$`);
  let max = 0;
  for (const c of existingCodes) {
    const m = c.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max + 1;
  return `${zoneBlock}${String(next).padStart(3, "0")}`;
}

// suffix ของชั้น: parent ไม่มี "/" → 3 หลัก, มี 1 "/" → 2 หลัก, มี 2 "/" → 1 หลัก
function suffixWidth(parentCode: string): number {
  const slashes = (parentCode.match(/\//g) || []).length;
  return slashes === 0 ? 3 : slashes === 1 ? 2 : 1;
}

// รหัสลูกถัดไปใต้ parent (direct child เท่านั้น)
export function nextSuffix(parentCode: string, existingChildCodes: string[]): string {
  const width = suffixWidth(parentCode);
  const prefix = parentCode + "/";
  let max = 0;
  for (const c of existingChildCodes) {
    if (!c.startsWith(prefix)) continue;
    const rest = c.slice(prefix.length);
    if (rest.includes("/")) continue; // ลูกตรงเท่านั้น
    const n = parseInt(rest, 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return `${parentCode}/${String(max + 1).padStart(width, "0")}`;
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `npx vitest run lib/m10-ingest/parcelcode/parcelCode.test.ts`
Expected: PASS (3 describe)

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/parcelcode/parcelCode.ts lib/m10-ingest/parcelcode/parcelCode.test.ts
git commit -m "feat(m10-parcelcode): parcelCode lib (parse + block-seq + suffix)"
```

---

## Task 2: suggestForRecord engine (pure, resolver inject)

**Files:**
- Create: `lib/m10-ingest/parcelcode/suggest.ts`
- Test: `lib/m10-ingest/parcelcode/suggest.test.ts`

- [ ] **Step 1: Write failing test**

`lib/m10-ingest/parcelcode/suggest.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { suggestForRecord, type SuggestResolvers } from "./suggest";

// fake resolvers — คุมผลทุกชั้น
const fake = (over: Partial<SuggestResolvers>): SuggestResolvers => ({
  byDeed: async () => [],
  byGeomOverlap: async () => [],
  childrenOfParent: async () => [],
  codesInBlock: async () => [],
  ...over,
});

const G = { type: "Polygon", coordinates: [[[100, 15], [100.001, 15], [100.001, 15.001], [100, 15.001], [100, 15]]] };

describe("suggestForRecord — NEW", () => {
  it("โฉนดตรง basemap → ใช้รหัสเดิม (deed-reuse)", async () => {
    const r = await suggestForRecord(
      { changeType: "NEW", deedNo: "555", landNo: "10", survey: "3", geometry: G },
      fake({ byDeed: async () => [{ parcelCode: "09Z001", deedNo: "555", landNo: "10", survey: "3", geometry: G }] })
    );
    expect(r.method).toBe("deed-reuse");
    expect(r.suggestedCode).toBe("09Z001");
  });

  it("โฉนดไม่ตรง → block seq ถัดไปจากแปลงที่ทับ", async () => {
    const r = await suggestForRecord(
      { changeType: "NEW", deedNo: "999", landNo: null, survey: null, geometry: G },
      fake({
        byGeomOverlap: async () => [{ parcelCode: "02B120", deedNo: "1", geometry: G }],
        codesInBlock: async () => ["02B120", "02B118"],
      })
    );
    expect(r.method).toBe("block-seq");
    expect(r.suggestedCode).toBe("02B121");
  });

  it("ไม่มี overlap → null + warning", async () => {
    const r = await suggestForRecord(
      { changeType: "NEW", deedNo: "999", landNo: null, survey: null, geometry: G },
      fake({})
    );
    expect(r.suggestedCode).toBeNull();
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("suggestForRecord — SPLIT", () => {
  it("แม่จากรูปที่ทับ → suffix ลูกถัดไป", async () => {
    const r = await suggestForRecord(
      { changeType: "SPLIT", deedNo: "9", landNo: "5", survey: "1", geometry: G },
      fake({
        byGeomOverlap: async () => [{ parcelCode: "01A001", deedNo: "9", geometry: G }],
        childrenOfParent: async () => ["01A001/001"],
      })
    );
    expect(r.method).toBe("split-suffix");
    expect(r.parent).toBe("01A001");
    expect(r.suggestedCode).toBe("01A001/002");
  });
});

describe("suggestForRecord — MERGE", () => {
  it("แนะรหัสน้อยสุดของแปลงที่ทับ", async () => {
    const r = await suggestForRecord(
      { changeType: "MERGE", deedNo: "9", landNo: "5", survey: "1", geometry: G },
      fake({ byGeomOverlap: async () => [
        { parcelCode: "01A005", deedNo: "9", geometry: G },
        { parcelCode: "01A002", deedNo: "8", geometry: G },
      ] })
    );
    expect(r.method).toBe("merge-min");
    expect(r.suggestedCode).toBe("01A002");
    expect(r.candidates.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `npx vitest run lib/m10-ingest/parcelcode/suggest.test.ts`
Expected: FAIL — "Failed to resolve import ./suggest"

- [ ] **Step 3: Implement `suggest.ts`**

`lib/m10-ingest/parcelcode/suggest.ts`:
```ts
import { parseParcelCode, nextBlockSeq, nextSuffix } from "./parcelCode";

type Geom = GeoJSON.Polygon | GeoJSON.MultiPolygon;
export interface BasemapLite { parcelCode: string; deedNo?: string | null; landNo?: string | null; survey?: string | null; geometry?: unknown; }

export interface SuggestResolvers {
  byDeed: (deedNo: string) => Promise<BasemapLite[]>;
  byGeomOverlap: (geometry: Geom) => Promise<BasemapLite[]>; // เรียง overlap มาก→น้อย
  childrenOfParent: (parentCode: string) => Promise<string[]>;
  codesInBlock: (zoneBlock: string) => Promise<string[]>;
}

export interface SuggestInput {
  changeType: string; deedNo: string | null; landNo: string | null; survey: string | null; geometry: Geom | null;
}

export interface SuggestResult {
  method: "deed-reuse" | "block-seq" | "split-suffix" | "merge-min" | "none";
  suggestedCode: string | null;
  confidence: "high" | "medium" | "low";
  parent: string | null;
  candidates: BasemapLite[];
  warnings: string[];
}

const NONE = (warnings: string[]): SuggestResult => ({ method: "none", suggestedCode: null, confidence: "low", parent: null, candidates: [], warnings });

export async function suggestForRecord(input: SuggestInput, res: SuggestResolvers): Promise<SuggestResult> {
  const { changeType, deedNo, geometry } = input;

  if (changeType === "NEW") {
    // 1) โฉนดตรง basemap → ใช้รหัสเดิม
    if (deedNo) {
      const byDeed = await res.byDeed(deedNo);
      if (byDeed.length) {
        const warnings: string[] = [];
        const m = byDeed[0];
        if (input.landNo && m.landNo && String(input.landNo) !== String(m.landNo)) warnings.push("เลขที่ดินไม่ตรงกับ basemap");
        if (input.survey && m.survey && String(input.survey) !== String(m.survey)) warnings.push("หน้าสำรวจไม่ตรงกับ basemap");
        return { method: "deed-reuse", suggestedCode: m.parcelCode, confidence: warnings.length ? "medium" : "high", parent: null, candidates: byDeed, warnings };
      }
    }
    // 2) block seq ถัดไปจากแปลงที่รูปทับ
    if (geometry) {
      const ov = await res.byGeomOverlap(geometry);
      if (ov.length) {
        const p = parseParcelCode(ov[0].parcelCode);
        if (p) {
          const zoneBlock = p.zone + p.block;
          const codes = await res.codesInBlock(zoneBlock);
          return { method: "block-seq", suggestedCode: nextBlockSeq(zoneBlock, codes), confidence: "low", parent: null, candidates: ov, warnings: ["แปลงใหม่ — เดาบล็อกจากแปลงข้างเคียง ตรวจรหัสก่อนยืนยัน"] };
        }
      }
    }
    return NONE(["หาแปลงข้างเคียงไม่ได้ — ระบุรหัสเอง"]);
  }

  if (changeType === "SPLIT" || changeType === "SPLIT_PUBLIC") {
    if (geometry) {
      const ov = await res.byGeomOverlap(geometry);
      if (ov.length) {
        const parent = ov[0].parcelCode;
        const children = await res.childrenOfParent(parent);
        return { method: "split-suffix", suggestedCode: nextSuffix(parent, children), confidence: "medium", parent, candidates: ov, warnings: changeType === "SPLIT_PUBLIC" ? ["แบ่งเป็นที่สาธารณะ — ตรวจว่าควรเป็นที่หลวงไหม"] : [] };
      }
    }
    return NONE(["หาแปลงแม่ไม่ได้ (รูปไม่ทับ basemap) — ระบุรหัสเอง"]);
  }

  if (changeType === "MERGE") {
    if (geometry) {
      const ov = await res.byGeomOverlap(geometry);
      if (ov.length) {
        const min = ov.map((c) => c.parcelCode).filter(Boolean).sort()[0];
        return { method: "merge-min", suggestedCode: min, confidence: ov.length > 1 ? "high" : "medium", parent: null, candidates: ov, warnings: ov.length < 2 ? ["พบแปลงที่ทับ < 2 — ตรวจว่าครบที่รวมไหม"] : [] };
      }
    }
    return NONE(["หาแปลงที่รวมไม่ได้ — ระบุรหัสเอง"]);
  }

  return NONE([`changeType ${changeType} ไม่รองรับการแนะรหัส`]);
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `npx vitest run lib/m10-ingest/parcelcode/suggest.test.ts`
Expected: PASS (NEW 3 + SPLIT 1 + MERGE 1)

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/parcelcode/suggest.ts lib/m10-ingest/parcelcode/suggest.test.ts
git commit -m "feat(m10-parcelcode): suggestForRecord engine (NEW/SPLIT/MERGE, resolver inject)"
```

---

## Task 3: repository — listNewCode / getNewCodeItem / confirmNewCode + worklist eligibility

**Files:**
- Modify: `lib/m10-ingest/repository/index.ts`
- Test: `lib/m10-ingest/repository/newcode.test.ts` (สร้างใหม่)

> หมายเหตุ resolvers: `byGeomOverlap` ใช้ `$geoIntersects` + `overlapOf` (มีอยู่แล้วในไฟล์) เรียง overlap มาก→น้อย · `codesInBlock`/`childrenOfParent` ใช้ regex prefix แล้ว distinct

- [ ] **Step 1: Write failing test**

`lib/m10-ingest/repository/newcode.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { listNewCode, getNewCodeItem, confirmNewCode, summaryByPeriod } from "./index";

const POLY = (x: number, y: number, s = 0.001) => ({
  type: "Polygon", coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]],
});

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });
const col = (n: string) => mongoose.connection.db!.collection(n);

describe("listNewCode", () => {
  it("คืนเฉพาะ confirmed deferred + suggestedCode", async () => {
    await col("m10_basemap").insertOne({ parcelCode: "01A001", deedNo: "9", geometry: POLY(100, 15, 0.01) });
    await col("m10_records").insertOne({ recordKey: "S1", deedNo: "9", landNo: "5", survey: "1", changeType: "SPLIT", geometry: POLY(100, 15) });
    await col("m10_transactions").insertOne({ recordKey: "S1", changeType: "SPLIT", reviewStatus: "confirmed" });
    // TRANSFER ไม่ควรมา
    await col("m10_transactions").insertOne({ recordKey: "T1", changeType: "TRANSFER", reviewStatus: "confirmed" });
    const rows = await listNewCode({});
    expect(rows.length).toBe(1);
    expect(rows[0].recordKey).toBe("S1");
    expect(rows[0].suggestedCode).toBe("01A001/001");
  });
});

describe("confirmNewCode → record + basemap + worklist eligible", () => {
  it("ยืนยัน → record มี parcelCode/resolved, basemap มีแปลงใหม่ (รูป m10), summary นับ wlEligible", async () => {
    await col("m10_records").insertOne({ recordKey: "N1", deedNo: "999", changeType: "NEW", geometry: POLY(100, 15) });
    const batch = await col("m10_import_batches").insertOne({ period: "2569-01" });
    await col("m10_transactions").insertOne({ recordKey: "N1", changeType: "NEW", reviewStatus: "confirmed", batchId: batch.insertedId });

    await confirmNewCode("N1", "officer1", { parcelCode: "02B121", deedNo: "999" });

    const rec = await col("m10_records").findOne({ recordKey: "N1" });
    expect(rec?.parcelCode).toBe("02B121");
    expect(rec?.reconcileOverride?.status).toBe("resolved");
    expect(await col("m10_basemap").countDocuments({ parcelCode: "02B121" })).toBe(1);
    const bm = await col("m10_basemap").findOne({ parcelCode: "02B121" });
    expect(bm?.geometry?.type).toBe("Polygon"); // ได้รูปจาก m10

    const sum = await summaryByPeriod();
    const row = sum.find((s) => s.period === "2569-01");
    expect(row?.wlEligible).toBe(1); // deferred resolved นับเป็น eligible
    expect(row?.deferred).toBe(0);   // ไม่ค้างแล้ว
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `npx vitest run lib/m10-ingest/repository/newcode.test.ts`
Expected: FAIL — "listNewCode is not a function"

- [ ] **Step 3a: เพิ่ม resolvers + listNewCode/getNewCodeItem/confirmNewCode**

เพิ่มก่อนบรรทัด `export { M10ImportBatch, ... }` ใน `lib/m10-ingest/repository/index.ts`:
```ts
// ── ผู้ช่วยแนะรหัสแปลง (SPLIT/MERGE/NEW) ──
// resolver ต่อ DB สำหรับ suggestForRecord
function newCodeResolvers() {
  return {
    byDeed: async (deedNo: string) =>
      (await M10Basemap.find({ deedNo }).select("parcelCode deedNo landNo survey geometry").limit(20).lean())
        .map((d: Record<string, unknown>) => ({ parcelCode: d.parcelCode as string, deedNo: (d.deedNo as string) ?? null, landNo: (d.landNo as string) ?? null, survey: (d.survey as string) ?? null, geometry: d.geometry })),
    byGeomOverlap: async (geometry: Geom) => {
      const docs = await M10Basemap.find({ geometry: { $geoIntersects: { $geometry: geometry } } }).select("parcelCode deedNo landNo survey geometry").limit(30).lean();
      return docs
        .map((d: Record<string, unknown>) => ({ doc: d, ov: overlapOf(geometry, d.geometry) ?? 0 }))
        .sort((a, b) => b.ov - a.ov)
        .map(({ doc: d }) => ({ parcelCode: d.parcelCode as string, deedNo: (d.deedNo as string) ?? null, landNo: (d.landNo as string) ?? null, survey: (d.survey as string) ?? null, geometry: d.geometry }));
    },
    childrenOfParent: async (parentCode: string) =>
      (await M10Basemap.find({ parcelCode: new RegExp("^" + parentCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/") }).distinct("parcelCode")) as string[],
    codesInBlock: async (zoneBlock: string) =>
      (await M10Basemap.find({ parcelCode: new RegExp("^" + zoneBlock) }).distinct("parcelCode")) as string[],
  };
}

export interface NewCodeRow {
  recordKey: string; deedNo: string | null; changeType: string;
  suggestedCode: string | null; method: string; confidence: string; currentParcelCode: string | null; resolved: boolean;
}

// รายการ confirmed deferred (ยังไม่ resolved) พร้อมรหัสที่แนะ
// หมายเหตุ: changeType เอาจาก transaction (authoritative); M10Record เก็บเป็น lastChangeType
export async function listNewCode(_filter: Record<string, unknown> = {}): Promise<NewCodeRow[]> {
  const txns = await M10Transaction.find({ reviewStatus: "confirmed", changeType: { $in: DEFERRED_CHANGE_TYPES } })
    .select("recordKey changeType").lean();
  const ctByKey = new Map<string, string>();
  for (const t of txns as { recordKey: string; changeType: string }[]) if (t.recordKey) ctByKey.set(t.recordKey, t.changeType);
  const keys = [...ctByKey.keys()];
  const recs = await M10Record.find({ recordKey: { $in: keys } })
    .select("recordKey deedNo landNo survey geometry parcelCode reconcileOverride").lean();
  const res = newCodeResolvers();
  const rows: NewCodeRow[] = [];
  for (const r of recs) {
    const changeType = ctByKey.get(r.recordKey) || "";
    const resolved = r.reconcileOverride?.status === "resolved";
    const s = await suggestForRecord(
      { changeType, deedNo: r.deedNo ?? null, landNo: r.landNo ?? null, survey: r.survey ?? null, geometry: (r.geometry as Geom) ?? null },
      res
    );
    rows.push({
      recordKey: r.recordKey, deedNo: r.deedNo ?? null, changeType,
      suggestedCode: resolved ? (r.parcelCode ?? null) : s.suggestedCode,
      method: s.method, confidence: s.confidence,
      currentParcelCode: r.parcelCode ?? null, resolved,
    });
  }
  return rows;
}

// detail: m10 geometry + suggestion + candidates(geometry) สำหรับ map
export async function getNewCodeItem(recordKey: string) {
  const rec = await M10Record.findOne({ recordKey })
    .select("recordKey deedNo landNo survey area geometry lastChangeType parcelCode reconcileOverride").lean();
  if (!rec) return null;
  const changeType = rec.lastChangeType as string;
  const res = newCodeResolvers();
  const suggestion = await suggestForRecord(
    { changeType, deedNo: rec.deedNo ?? null, landNo: rec.landNo ?? null, survey: rec.survey ?? null, geometry: (rec.geometry as Geom) ?? null },
    res
  );
  // candidate พร้อม geometry สำหรับ ReconcileMap
  const candDocs = (rec.geometry)
    ? await M10Basemap.find({ geometry: { $geoIntersects: { $geometry: rec.geometry as Geom } } }).select("parcelCode deedNo geometry").limit(20).lean()
    : [];
  const candidates = candDocs.map(toCand);
  return { record: { ...rec, changeType }, suggestion, candidates, nearby: [] };
}

// ยืนยันรหัส — inject geometry=record.geometry ให้ resolveReconcile เขียน basemap kind:new
export async function confirmNewCode(recordKey: string, by: string, input: {
  parcelCode: string; deedNo?: string | null; landNo?: string | null; survey?: string | null;
  area?: { rai: number; ngan: number; wa: number; sqm: number } | null;
}) {
  const rec = await M10Record.findOne({ recordKey }).select("geometry").lean();
  if (!rec) throw new Error("record not found");
  return resolveReconcile(recordKey, by, {
    parcelCode: input.parcelCode, deedNo: input.deedNo ?? null, landNo: input.landNo ?? null,
    survey: input.survey ?? null, area: input.area ?? null,
    geometry: rec.geometry ?? undefined, writeBasemap: true,
  });
}
```

- [ ] **Step 3b: ขยาย worklist eligibility — `summaryByPeriod`**

ใน `summaryByPeriod()` แทนที่บล็อกสร้าง `wlEligible` + การ aggregate (บรรทัด ~182, 192-197):

แทนที่:
```ts
  const wlEligible = { $and: [{ $eq: ["$reviewStatus", "confirmed"] }, { $in: ["$changeType", WORKLIST_CHANGE_TYPES] }] };
  const rows = await M10Transaction.aggregate([
```
ด้วย:
```ts
  // deferred ที่ จนท. ยืนยันรหัสแล้ว (record resolved) → นับเป็น worklist eligible
  const resolvedKeys = (await M10Record.find({ "reconcileOverride.status": "resolved" }).distinct("recordKey")) as string[];
  const confirmed = { $eq: ["$reviewStatus", "confirmed"] };
  const deferredResolved = { $and: [confirmed, { $in: ["$changeType", DEFERRED_CHANGE_TYPES] }, { $in: ["$recordKey", resolvedKeys] }] };
  const wlEligible = { $or: [{ $and: [confirmed, { $in: ["$changeType", WORKLIST_CHANGE_TYPES] }] }, deferredResolved] };
  const rows = await M10Transaction.aggregate([
```

และแทนที่บรรทัด `deferred:` (เดิม):
```ts
      deferred: { $sum: { $cond: [{ $and: [{ $eq: ["$reviewStatus", "confirmed"] }, { $in: ["$changeType", DEFERRED_CHANGE_TYPES] }] }, 1, 0] } },
```
ด้วย (deferred = ยังไม่ resolved เท่านั้น):
```ts
      deferred: { $sum: { $cond: [{ $and: [confirmed, { $in: ["$changeType", DEFERRED_CHANGE_TYPES] }, { $not: [{ $in: ["$recordKey", resolvedKeys] }] }] }, 1, 0] } },
```

- [ ] **Step 3c: ขยาย worklist eligibility — `listWorklistPending`**

ใน `listWorklistPending()` แทนที่ object `q` (บรรทัด ~222-229):
```ts
  const q: Record<string, unknown> = {
    reviewStatus: "confirmed",
    ltaxStatus: { $nin: ["keyed", "skipped"] },
    changeType: filter.changeType && WORKLIST_CHANGE_TYPES.includes(filter.changeType)
      ? filter.changeType
      : { $in: WORKLIST_CHANGE_TYPES },
  };
```
ด้วย:
```ts
  const resolvedKeys = (await M10Record.find({ "reconcileOverride.status": "resolved" }).distinct("recordKey")) as string[];
  const q: Record<string, unknown> = {
    reviewStatus: "confirmed",
    ltaxStatus: { $nin: ["keyed", "skipped"] },
  };
  if (filter.changeType && WORKLIST_CHANGE_TYPES.includes(filter.changeType)) {
    q.changeType = filter.changeType;
  } else if (filter.changeType && DEFERRED_CHANGE_TYPES.includes(filter.changeType)) {
    q.changeType = filter.changeType; q.recordKey = { $in: resolvedKeys };
  } else {
    // เกณฑ์ปกติ + deferred ที่ resolved
    q.$or = [
      { changeType: { $in: WORKLIST_CHANGE_TYPES } },
      { changeType: { $in: DEFERRED_CHANGE_TYPES }, recordKey: { $in: resolvedKeys } },
    ];
  }
```

- [ ] **Step 3d: เพิ่ม import suggestForRecord ที่หัวไฟล์**

ใน `lib/m10-ingest/repository/index.ts` ใต้ import `matchParcel`:
```ts
import { suggestForRecord } from "../parcelcode/suggest";
```

- [ ] **Step 4: Run test, verify PASS**

Run: `npx vitest run lib/m10-ingest/repository/newcode.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Regression + commit**

Run: `npx vitest run lib/m10-ingest/repository`
Expected: PASS ทั้งหมด (reconcile/worklist/summary เดิมไม่พัง)
```bash
git add lib/m10-ingest/repository/index.ts lib/m10-ingest/repository/newcode.test.ts
git commit -m "feat(m10-parcelcode): repository listNewCode/getNewCodeItem/confirmNewCode + worklist eligibility deferred-resolved"
```

---

## Task 4: API endpoints (list / detail / confirm)

**Files:**
- Create: `pages/api/m10-ingest/newcode/index.js`
- Create: `pages/api/m10-ingest/newcode/[recordKey]/index.js`
- Create: `pages/api/m10-ingest/newcode/[recordKey]/confirm.js`

- [ ] **Step 1: `pages/api/m10-ingest/newcode/index.js`**

```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  await dbConnect();
  const { listNewCode } = await import("@/lib/m10-ingest/repository/index");
  const rows = await listNewCode({});
  return res.status(200).json({ rows });
}
```

- [ ] **Step 2: `pages/api/m10-ingest/newcode/[recordKey]/index.js`**

```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../../_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  await dbConnect();
  const { getNewCodeItem } = await import("@/lib/m10-ingest/repository/index");
  const item = await getNewCodeItem(String(req.query.recordKey));
  if (!item) return res.status(404).json({ error: "ไม่พบ record" });
  return res.status(200).json(item);
}
```

- [ ] **Step 3: `pages/api/m10-ingest/newcode/[recordKey]/confirm.js`**

```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../../_auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  const b = req.body || {};
  if (!b.parcelCode || typeof b.parcelCode !== "string" || !b.parcelCode.trim()) {
    return res.status(400).json({ error: "ต้องระบุรหัสแปลง (parcelCode)" });
  }
  await dbConnect();
  const { confirmNewCode } = await import("@/lib/m10-ingest/repository/index");
  const by = auth.name || auth.userId;
  try {
    const r = await confirmNewCode(String(req.query.recordKey), by, {
      parcelCode: b.parcelCode.trim(), deedNo: b.deedNo ?? null, landNo: b.landNo ?? null,
      survey: b.survey ?? null, area: b.area ?? null,
    });
    return res.status(200).json(r);
  } catch (e) {
    const msg = e?.message || "บันทึกไม่สำเร็จ";
    const isGeom = /รูปแปลง|geo|loop|edges|S2|coordinates|Polygon/i.test(msg);
    return res.status(isGeom ? 422 : 400).json({ error: msg });
  }
}
```

- [ ] **Step 4: Lint**

Run: `npx next lint --dir pages/api/m10-ingest/newcode`
Expected: ไม่มี error

- [ ] **Step 5: Commit**

```bash
git add pages/api/m10-ingest/newcode
git commit -m "feat(m10-parcelcode): API newcode list/detail/confirm (gate /admin/m10)"
```

---

## Task 5: UI — NewCodePanel + tab

**Files:**
- Create: `components/m10/NewCodePanel.jsx`
- Modify: `pages/admin/m10.jsx`

- [ ] **Step 1: สร้าง `components/m10/NewCodePanel.jsx`**

```jsx
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";

const ReconcileMap = dynamic(() => import("./ReconcileMap"), { ssr: false });

const CONF_BADGE = { high: "badge-success", medium: "badge-warning", low: "badge-ghost" };

export default function NewCodePanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [focusKey, setFocusKey] = useState(null);
  const [detail, setDetail] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/m10-ingest/newcode");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "โหลดข้อมูลล้มเหลว");
      setRows(d.rows);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function openFocus(recordKey) {
    setError(""); setFocusKey(recordKey); setDetail(null); setSelectedId(null);
    try {
      const res = await fetch(`/api/m10-ingest/newcode/${encodeURIComponent(recordKey)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "โหลดรายละเอียดไม่สำเร็จ");
      setDetail(d);
      setCode(d.record.parcelCode || d.suggestion.suggestedCode || "");
    } catch (e) { setError(e.message); }
  }
  function closeFocus() { setFocusKey(null); setDetail(null); }

  async function confirm() {
    if (!code.trim()) { setError("ต้องระบุรหัสแปลง"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/m10-ingest/newcode/${encodeURIComponent(focusKey)}/confirm`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcelCode: code.trim(), deedNo: detail.record.deedNo, landNo: detail.record.landNo, survey: detail.record.survey, area: detail.record.area }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      closeFocus(); await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (focusKey) {
    return (
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-bold">แนะรหัสแปลง · <span className="font-mono text-sm">{focusKey}</span></h2>
          <button className="btn btn-ghost btn-sm" onClick={closeFocus}>← ย้อนกลับ</button>
        </div>
        {error && <div className="alert alert-error mb-3">{error}</div>}
        {!detail ? <span className="loading loading-spinner" /> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <ReconcileMap m10Geometry={detail.record.geometry} candidates={detail.candidates} nearby={detail.nearby} selectedId={selectedId} onSelect={setSelectedId} />
              <p className="text-xs opacity-60 mt-2">
                <span className="text-red-600 font-bold">▬</span> รูปแปลง ม.10 ·
                <span className="text-blue-600 font-bold"> ▬</span> basemap ที่ทับ (คลิกเลือก)
              </p>
            </div>
            <div className="space-y-3">
              <div className="bg-base-200 rounded p-3 space-y-1 text-sm">
                <div>ประเภท: <span className="badge badge-sm">{detail.record.changeType}</span> · โฉนด {detail.record.deedNo || "-"}</div>
                <div>วิธีแนะ: <b>{detail.suggestion.method}</b> · ความมั่นใจ: <span className={`badge badge-xs ${CONF_BADGE[detail.suggestion.confidence] || ""}`}>{detail.suggestion.confidence}</span></div>
                {detail.suggestion.parent && <div>แปลงแม่: <span className="font-mono">{detail.suggestion.parent}</span></div>}
              </div>
              {detail.suggestion.warnings?.map((w, i) => (
                <div key={i} className="alert alert-warning text-sm py-2">⚠ {w}</div>
              ))}
              <div className="bg-base-200 rounded p-3 space-y-2">
                <p className="text-sm font-semibold">รหัสแปลง (PARCEL_COD)</p>
                <input className="input input-bordered input-sm w-full font-mono" placeholder="เช่น 02B121 หรือ 01A001/001"
                  value={code} onChange={(e) => setCode(e.target.value)} />
                <p className="text-xs opacity-60">ยืนยันแล้วจะสร้างแปลงใน basemap ด้วยรูปจาก ม.10 + record เข้าคิวคีย์ LTAX (ปรับรูปละเอียดที่หน้า “แก้รูปแปลง (basemap)” ทีหลัง)</p>
              </div>
              <button className="btn btn-primary w-full" disabled={saving} onClick={confirm}>
                {saving ? "กำลังบันทึก..." : "ยืนยันรหัส & เข้า worklist"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">รหัสแปลงใหม่ (SPLIT / MERGE / NEW)</h2>
      {error && <div className="alert alert-error mb-3">{error}</div>}
      {loading ? <span className="loading loading-spinner" /> : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead><tr><th>recordKey</th><th>โฉนด</th><th>ประเภท</th><th>รหัสที่แนะ</th><th>วิธี</th><th>มั่นใจ</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.recordKey}>
                  <td className="font-mono text-xs">{r.recordKey}</td>
                  <td>{r.deedNo || "-"}</td>
                  <td><span className="badge badge-sm">{r.changeType}</span></td>
                  <td className="font-mono">{r.suggestedCode || "—"}</td>
                  <td className="text-xs">{r.method}</td>
                  <td><span className={`badge badge-xs ${CONF_BADGE[r.confidence] || ""}`}>{r.confidence}</span></td>
                  <td>{r.resolved ? <span className="badge badge-info badge-sm">ยืนยันแล้ว</span> : <span className="badge badge-ghost badge-sm">รอ</span>}</td>
                  <td><button className="btn btn-xs btn-outline" onClick={() => openFocus(r.recordKey)}>เปิด</button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="text-center opacity-60">ไม่มีรายการ</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs opacity-60 mt-3">เอนจินแนะรหัสจากรูปแปลง + basemap + โฉนด — ตรวจก่อนยืนยันทุกครั้ง (ข้อมูลไม่มี key ลิงก์แปลงพี่น้อง)</p>
    </div>
  );
}
```

- [ ] **Step 2: เพิ่ม tab ใน `pages/admin/m10.jsx`**

แก้ import + TABS:
```jsx
import ReconcilePanel from "@/components/m10/ReconcilePanel";
import NewCodePanel from "@/components/m10/NewCodePanel";
```
และเพิ่มใน array `TABS` หลัง reconcile:
```jsx
  { key: "reconcile", label: "จับคู่ basemap", Panel: ReconcilePanel },
  { key: "newcode", label: "รหัสแปลงใหม่", Panel: NewCodePanel },
  { key: "worklist", label: "Worklist → LTAX", Panel: WorklistPanel },
```

- [ ] **Step 3: Lint**

Run: `npx next lint --dir components/m10 --dir pages/admin/m10`
Expected: ไม่มี error

- [ ] **Step 4: Commit**

```bash
git add components/m10/NewCodePanel.jsx pages/admin/m10.jsx
git commit -m "feat(m10-parcelcode): NewCodePanel + แท็บ 'รหัสแปลงใหม่'"
```

---

## Task 6: docs + full test + build

**Files:**
- Modify: `docs/modules/m10-ingest.md`

- [ ] **Step 1: เพิ่ม section ใน `docs/modules/m10-ingest.md`** — ต่อท้ายไฟล์:
```markdown
## ผู้ช่วยแนะรหัสแปลง SPLIT/MERGE/NEW (2026-06-30)
- แท็บ **"รหัสแปลงใหม่"** ใน `/admin/m10` — list confirmed deferred (SPLIT/SPLIT_PUBLIC/MERGE/NEW) + รหัสที่แนะ → จนท. ยืนยัน
- **เอนจินแนะ (pure):** `lib/m10-ingest/parcelcode/suggest.ts` (resolver inject) — NEW: โฉนดตรง basemap→ใช้รหัสเดิม, ไม่ตรง→`nextBlockSeq` ของบล็อกแปลงที่ทับ · SPLIT: `nextSuffix` ใต้แปลงแม่ (รูปทับมากสุด) · MERGE: parcelCode น้อยสุด · `parcelCode.ts` = parse/seq/suffix (ชั้น /001→/01→/1)
- **ข้อมูลไม่มี group key** (`MERGE_PARCEL` ว่าง) → assistant แนะต่อ record ไม่ auto-group; default SPLIT = suffix ลูก
- ยืนยัน = `confirmNewCode` → `resolveReconcile` (inject geometry=record.geometry, writeBasemap) → record.parcelCode + reconcileOverride.resolved + basemap `kind:new` (รูปจาก m10) → ปรับรูปละเอียดที่หน้า basemap ทีหลัง
- **worklist eligibility ขยาย:** deferred ที่ `reconcileOverride.status==="resolved"` นับเป็น eligible (ผ่าน distinct resolvedKeys ใน `summaryByPeriod`/`listWorklistPending`) → ไหลเข้าคิวคีย์ LTAX
- API `pages/api/m10-ingest/newcode/*` (gate `/admin/m10`)
- **นอก scope:** auto-group siblings, RETIRED, ปรับ buildWorklistItem เฉพาะ SPLIT/MERGE

Spec: `docs/superpowers/specs/2026-06-30-m10-parcelcode-suggest-design.md` · Plan: `docs/superpowers/plans/2026-06-30-m10-parcelcode-suggest.md`
```

- [ ] **Step 2: Lint + full test + build**

Run: `npx vitest run lib/m10-ingest`
Expected: PASS ทั้งหมด (เดิม + parcelCode + suggest + newcode)

Run: `npx next lint --dir lib/m10-ingest --dir components/m10 --dir pages/api/m10-ingest --dir pages/admin/m10`
Expected: ไม่มี error

Run: `npm run build`
Expected: exit 0; route `/api/m10-ingest/newcode/*` ปรากฏ

- [ ] **Step 3: Commit**

```bash
git add docs/modules/m10-ingest.md
git commit -m "docs(m10-parcelcode): module doc — ผู้ช่วยแนะรหัส SPLIT/MERGE/NEW"
```

---

## Task 7: manual smoke test (เมื่อผู้ใช้กลับมา)

- [ ] เปิด `/admin/m10` แท็บ "รหัสแปลงใหม่" → เห็นรายการ SPLIT/MERGE/NEW + รหัสที่แนะ
- [ ] เปิด record NEW → เห็นแผนที่ m10 (แดง) + แปลงที่ทับ + รหัสที่แนะ (block seq) → แก้ได้
- [ ] ยืนยัน → record หายจาก list (resolved) → ไปโผล่แท็บ Worklist → LTAX
- [ ] เปิดหน้า basemap → เห็นแปลงใหม่ที่รหัสนั้น (รูปจาก m10) แก้รูปละเอียดได้
- [ ] SPLIT → รหัสแนะเป็น suffix `/001` ของแปลงแม่ · MERGE → รหัสน้อยสุด

---

## Self-Review

**Spec coverage:**
- เอนจินแนะ NEW/SPLIT/MERGE (pure) → Task 1 (parcelCode) + Task 2 (suggest) ✓
- listNewCode/getNewCodeItem/confirmNewCode → Task 3 ✓
- worklist eligibility deferred-resolved (summary + listWorklistPending, ผ่าน resolvedKeys) → Task 3b/3c ✓
- reuse resolveReconcile + geometry=m10 (confirmNewCode wrapper) → Task 3 ✓
- API list/detail/confirm gate /admin/m10 → Task 4 ✓
- แท็บ + ReconcileMap read-only + ฟอร์มรหัส → Task 5 ✓
- S2 reject → 422 → Task 4 ✓
- tests pure + integration → Task 1/2/3 ✓

**Type consistency:** `suggestForRecord(input, resolvers)` (Task 2) ↔ `newCodeResolvers()` keys byDeed/byGeomOverlap/childrenOfParent/codesInBlock (Task 3) ตรงกับ `SuggestResolvers` ✓. `SuggestResult` fields method/suggestedCode/confidence/parent/candidates/warnings (Task 2) ↔ NewCodePanel ใช้ detail.suggestion.* (Task 5) ตรง ✓. `confirmNewCode(recordKey, by, {parcelCode,...})` (Task 3) ↔ confirm API body (Task 4) ↔ panel confirm (Task 5) ตรง ✓. `NewCodeRow` fields (Task 3) ↔ panel table (Task 5) ตรง ✓.

**Dependencies ที่ต้องมีอยู่แล้ว:** `overlapOf`, `toCand`, `resolveReconcile`, `DEFERRED_CHANGE_TYPES`, `WORKLIST_CHANGE_TYPES`, `Geom`, `M10Basemap/M10Record/M10Transaction` — ยืนยันมีในไฟล์ repository (Task 3 import suggestForRecord เพิ่มอย่างเดียว)

**หมายเหตุ:** `M10Record` ต้องมี field `changeType` (มี — materialized as `lastChangeType`? ตรวจ: getReconcileItem/applyTxnToRecord ใช้). ⚠ ถ้า M10Record เก็บเป็น `lastChangeType` ไม่ใช่ `changeType` → listNewCode/getNewCodeItem ต้องอ่าน `lastChangeType`. ตรวจตอน Task 3 ก่อนเขียน (ดู applyTxnToRecord); ถ้าใช่ ปรับ select + field ให้ตรง.
