# M10 Ingest + Normalize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a data layer that ingests กรมที่ดิน มาตรา 10 monthly file batches (parcel/ns3a/construction CSV + geometry GeoJSON), normalizes them with pure functions, reprojects geometry 24047→4326 with a real datum shift, and writes an idempotent canonical store in MongoDB with quarantine for bad rows.

**Architecture:** Four layers under `lib/m10-ingest/`, each with one responsibility: **adapters** (file format → `RawRow`, no domain logic), **normalize core** (pure functions, no I/O, all domain logic — fully unit-tested), **geometry** (proj4 reproject + spatial join), **repository** (the only layer that touches MongoDB). An `ingest()` orchestrator wires them; a CLI + a function API let n8n call it. Mongoose models live in `models/m10-ingest/` (model names prefixed `M10*`, collections `m10_*`, because Mongo is shared across sibling apps).

**Tech Stack:** TypeScript (strict), Vitest (new — first test runner in repo), papaparse (already installed), proj4 + @turf/turf (new), mongoose (already installed), mongodb-memory-server (new, dev — for repository/idempotency tests).

**Source of truth:** `docs/superpowers/specs/2026-06-21-m10-ingest-normalize-design.md`. Read it before starting.

**Conventions to honor (from CLAUDE.md):**
- Module folders: `lib/m10-ingest/`, `models/m10-ingest/`, scripts in `scripts/`. Do not scatter files outside this.
- Mongo URI env var is `MONGO_URI` (not `MONGODB_URI`); connection cached on `globalThis.mongoose` via `lib/dbConnect.js`.
- Mongoose models use the `mongoose.models.X || mongoose.model("X", schema)` guard (hot-reload safe).
- Thai is the default language for UI/comments/docs.

**Decisions locked during planning:**
- Package lives in `lib/m10-ingest/` (module convention), NOT a separate npm workspace.
- Test runner: **Vitest**.
- Geometry input format is **GeoJSON**. Shapefiles must be pre-converted to GeoJSON (e.g. `ogr2ogr`/mapshaper) before ingest — out of scope to read `.shp` directly this round.
- No real sample data files exist in the repo yet. Fixtures are built from the dirty-data examples and the golden reproject point documented in the spec. **When real `parcel.csv`/geometry files arrive, add them under `lib/m10-ingest/__fixtures__/real/` and extend the fixture-driven tests — do not delete the synthetic fixtures.**

---

## File Structure

```
lib/m10-ingest/
  types.ts                       # all shared types: DocType, ChangeType, RawRow, NormalizedTxn, NormalizeOutcome, RejectReason, NormalizeError
  normalize/
    trim.ts                      # trimAll(row)
    changeType.ts                # STATUS_MAP + classifyStatus()
    area.ts                      # parseArea()
    owner.ts                     # buildFullName(), hashId()
    ravang.ts                    # ravangKey(), recordKey()
    date.ts                      # parseThaiDate()
    currency.ts                  # parseCurrency()
    index.ts                     # normalizeRow() orchestrator
  adapters/
    csv.ts                       # parseParcelCsv/parseNs3aCsv/parseConstructionCsv -> RawRow[]
    geometry.ts                  # parseGeometryGeoJSON() -> RawGeometry[]
  geometry/
    reproject.ts                 # proj4 def + reprojectPoint() + reprojectGeometry()
    join.ts                      # joinGeometry()
  repository/
    connect.ts                   # thin re-export of lib/dbConnect for the package
    batches.ts                   # findBatchByHash(), createBatch(), finishBatch()
    transactions.ts              # insertTransactionsDedup()
    records.ts                   # materializeRecord()
    rejects.ts                   # insertReject()
  ingest.ts                      # ingest() orchestrator (function API)
  cli.ts                         # CLI entry (argv -> ingest())
  __fixtures__/
    sampleRows.ts                # synthetic-but-spec-accurate rows (all 21 statuses + dirty data)
    sampleGeometry.ts            # one GeoJSON feature in EPSG:24047 incl. golden point

models/m10-ingest/
  M10ImportBatch.js              # collection m10_import_batches
  M10Transaction.js              # collection m10_transactions
  M10Record.js                   # collection m10_records
  M10Reject.js                   # collection m10_rejects
  index.js                       # re-export all four

scripts/
  m10-ingest.js                  # node entry: `node --env-file=.env.local scripts/m10-ingest.js <dir>`

pages/api/m10-ingest/
  run.js                         # (Task 16) optional HTTP trigger for n8n, guarded by CRON_SECRET

vitest.config.ts                 # repo-root vitest config (scopes tests to lib/m10-ingest)
docs/modules/m10-ingest.md       # module doc
```

**Co-located tests:** each source file gets a sibling `*.test.ts` (Vitest default glob picks them up). Pure-function tests need no DB; repository + ingest tests use `mongodb-memory-server`.

---

## Task 1: Project scaffolding (deps, Vitest, types, fixtures)

**Files:**
- Modify: `package.json` (add deps + scripts)
- Create: `vitest.config.ts`
- Create: `lib/m10-ingest/types.ts`
- Create: `lib/m10-ingest/__fixtures__/sampleRows.ts`
- Create: `lib/m10-ingest/smoke.test.ts` (temporary, deleted at end of task)

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm i proj4 @turf/turf
npm i -D vitest @types/proj4 @types/papaparse mongodb-memory-server
```
Expected: installs succeed, `package.json` updated. (`papaparse`, `mongoose` already present.)

- [ ] **Step 2: Add test scripts to package.json**

In `package.json` `"scripts"`, add:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```
(Place after the existing `"lint"` line. Keep trailing-comma validity.)

- [ ] **Step 3: Create vitest.config.ts**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/m10-ingest/**/*.test.ts"],
    environment: "node",
    globals: false,
    testTimeout: 30000, // mongodb-memory-server first download can be slow
  },
});
```

- [ ] **Step 4: Write a smoke test to prove Vitest runs**

Create `lib/m10-ingest/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the smoke test**

Run: `npm test`
Expected: PASS, 1 test passed.

- [ ] **Step 6: Create the shared types**

Create `lib/m10-ingest/types.ts`:
```ts
// ชนิดเอกสารต้นทาง 1 ชนิด = 1 adapter
export type DocType = "PARCEL" | "NS3A" | "CONSTRUCTION";

// changeType ตาม dictionary (spec มาตรา 5)
export type ChangeType =
  | "TRANSFER"
  | "TRANSFER_PARTIAL"
  | "MERGE"
  | "NEW"
  | "SPLIT"
  | "SPLIT_PUBLIC"
  | "BOUNDARY_CHANGE"
  | "OWNER_CORRECTION"
  | "ENCUMBRANCE"
  | "NOTE"
  | "ADMIN"
  | "RETIRED";

// เหตุผลที่ row ถูก quarantine (ไม่เคย drop เงียบ)
export type RejectReason =
  | "unknown_status"
  | "area_parse_failed"
  | "date_parse_failed"
  | "missing_key"
  | "geometry_invalid";

export class NormalizeError extends Error {
  constructor(public reason: RejectReason, message?: string) {
    super(message ?? reason);
    this.name = "NormalizeError";
  }
}

// ผลผลิตของ adapter ก่อน normalize (ค่าและคีย์ผ่าน trim แล้ว)
export interface RawRow {
  docType: DocType;
  source: string; // ชื่อไฟล์
  raw: Record<string, string>;
}

export interface Area {
  rai: number;
  ngan: number;
  wa: number;
  sqm: number;
}

export interface Owner {
  title: string;
  name: string;
  surname: string;
  fullName: string;
  idHash: string | null; // PDPA: sha256(digitsOnly) — ไม่เก็บเลขดิบ
}

export interface NormalizedTxn {
  docType: DocType;
  recordKey: string;
  rawStatus: string;
  changeType: ChangeType;
  taxRelevant: boolean;
  txnDate: string; // ISO date "YYYY-MM-DD"
  regAmount: number | null;
  owner: Owner;
  area: Area | null;
  payloadRaw: Record<string, string>;
}

export type NormalizeOutcome =
  | { ok: true; txn: NormalizedTxn }
  | { ok: false; reason: RejectReason };

// geometry ดิบจาก adapter (พิกัดยังเป็น EPSG:24047)
export interface RawGeometry {
  recordKey: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon; // EPSG:24047
}
```

Note: `GeoJSON` namespace comes from `@types/geojson` (transitive via `@turf/turf`). If TS can't resolve it, run `npm i -D @types/geojson`.

- [ ] **Step 7: Create fixtures (all 21 statuses + dirty data)**

Create `lib/m10-ingest/__fixtures__/sampleRows.ts`:
```ts
import type { ChangeType } from "../types";

// ทุกสถานะจาก dictionary (spec มาตรา 5) — exact string หลัง strip
// ใช้ขับ completeness test: ทุกตัวต้อง map ได้ ไม่มี unknown_status
export const ALL_STATUSES: { status: string; changeType: ChangeType; taxRelevant: boolean }[] = [
  { status: "ขาย", changeType: "TRANSFER", taxRelevant: true },
  { status: "ขายตามคำสั่งศาล", changeType: "TRANSFER", taxRelevant: true },
  { status: "โอนมรดก", changeType: "TRANSFER", taxRelevant: true },
  { status: "ให้", changeType: "TRANSFER", taxRelevant: true },
  { status: "ให้เฉพาะส่วน (ระหว่างภาระจำยอม)", changeType: "TRANSFER_PARTIAL", taxRelevant: true },
  { status: "ไถ่ถอนจากจำนอง รวมสองโฉนด", changeType: "MERGE", taxRelevant: true },
  { status: "ลงชื่อคู่สมรส รวมสองโฉนด", changeType: "MERGE", taxRelevant: true },
  { status: "ให้ รวมสองโฉนด", changeType: "MERGE", taxRelevant: true },
  { status: "เอกสารสิทธิที่เกิดใหม่ - ปรับปรุง ระหว่างเดือน", changeType: "NEW", taxRelevant: true },
  { status: "แบ่งแยกในนามเดิม", changeType: "SPLIT", taxRelevant: true },
  { status: "แบ่งหักเป็นที่สาธารณประโยชน์", changeType: "SPLIT_PUBLIC", taxRelevant: true },
  { status: "สอบเขตโฉนดที่ดิน", changeType: "BOUNDARY_CHANGE", taxRelevant: true },
  { status: "แก้ชื่อ (ราชการให้เปลี่ยนชื่อ)", changeType: "OWNER_CORRECTION", taxRelevant: true },
  { status: "จำนอง", changeType: "ENCUMBRANCE", taxRelevant: false },
  { status: "ไถ่ถอนจากจำนอง", changeType: "ENCUMBRANCE", taxRelevant: false },
  { status: "ขึ้นเงินจากจำนอง", changeType: "ENCUMBRANCE", taxRelevant: false },
  { status: "จำนองเพิ่มหลักทรัพย์", changeType: "ENCUMBRANCE", taxRelevant: false },
  { status: "จำนองลำดับที่สอง", changeType: "ENCUMBRANCE", taxRelevant: false },
  { status: "ระงับจำนอง (ศาลขายบังคับจำนอง)", changeType: "ENCUMBRANCE", taxRelevant: false },
  { status: "หมายเหตุสารบัญ", changeType: "NOTE", taxRelevant: false },
  { status: "ใบแทน", changeType: "ADMIN", taxRelevant: false },
];

// เพิ่มเฉพาะ ns3a
export const NS3A_EXTRA_STATUSES = [
  { status: "เอกสารสิทธิที่ยกเลิกระหว่างเดือน", changeType: "RETIRED" as ChangeType, taxRelevant: true },
];

// แถว parcel ดิบ 1 แถว — จงใจใส่ความสกปรกทุกแบบจาก spec มาตรา 2:
// trailing space ในค่าและคีย์, วันที่ d/m/yyyy พ.ศ. ไม่ zero-pad, เงิน "฿304,000.00", UTM4 ไม่ pad ("7")
export const DIRTY_PARCEL_ROW: Record<string, string> = {
  "สถานะดำเนินการ ": "ขาย ", // trailing space ในคีย์และค่า
  "วันที่": "5/1/2569",
  "ราคาประเมิน": "฿304,000.00",
  "UTM1": "47",
  "UTM2": "P",
  "UTM3": "5239",
  "UTM4": "7", // ไม่ pad → ต้องกลายเป็น "07"
  "Scale": "4000",
  "เลขที่ดิน": "123",
  "คำนำหน้า": "นาย",
  "ชื่อ": "สมชาย",
  "นามสกุล": "ใจดี",
  "เลขบัตรประชาชน": "1-2345-67890-12-3",
  "ไร่": "1",
  "งาน": "2",
  "วา": "30",
  "เศษ": "5",
};
```

- [ ] **Step 8: Run tests, then delete the smoke test**

Run: `npm test`
Expected: PASS (smoke still passes; fixtures/types compile).
Then delete `lib/m10-ingest/smoke.test.ts`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/m10-ingest/types.ts lib/m10-ingest/__fixtures__/sampleRows.ts
git commit -m "chore(m10-ingest): scaffold package, add vitest + deps, types & fixtures"
```

---

## Task 2: `trimAll` — strip every key and value

**Files:**
- Create: `lib/m10-ingest/normalize/trim.ts`
- Test: `lib/m10-ingest/normalize/trim.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/m10-ingest/normalize/trim.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { trimAll } from "./trim";

describe("trimAll", () => {
  it("strips both keys and values", () => {
    const out = trimAll({ "สถานะดำเนินการ ": "ขาย ", " UTM4": " 7 " });
    expect(out).toEqual({ "สถานะดำเนินการ": "ขาย", "UTM4": "7" });
  });

  it("coerces non-string values to trimmed strings", () => {
    const out = trimAll({ a: 5 as unknown as string, b: null as unknown as string });
    expect(out).toEqual({ a: "5", b: "" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- trim`
Expected: FAIL — cannot find module `./trim`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/m10-ingest/normalize/trim.ts`:
```ts
// strip ทุกค่า + ชื่อคอลัมน์ ก่อนประมวลผลเสมอ (spec มาตรา 6)
export function trimAll(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const k = String(key).trim();
    const v = value == null ? "" : String(value).trim();
    out[k] = v;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- trim`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/normalize/trim.ts lib/m10-ingest/normalize/trim.test.ts
git commit -m "feat(m10-ingest): trimAll normalize helper"
```

---

## Task 3: `classifyStatus` — status → changeType dictionary + completeness

**Files:**
- Create: `lib/m10-ingest/normalize/changeType.ts`
- Test: `lib/m10-ingest/normalize/changeType.test.ts`

- [ ] **Step 1: Write the failing test (incl. completeness — the trailing-space bug catcher)**

Create `lib/m10-ingest/normalize/changeType.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { classifyStatus } from "./changeType";
import { ALL_STATUSES, NS3A_EXTRA_STATUSES } from "../__fixtures__/sampleRows";

describe("classifyStatus", () => {
  it("maps a known status to changeType + taxRelevant", () => {
    expect(classifyStatus("ขาย")).toEqual({ changeType: "TRANSFER", taxRelevant: true });
  });

  it("treats mortgage as not tax-relevant", () => {
    expect(classifyStatus("จำนอง")).toEqual({ changeType: "ENCUMBRANCE", taxRelevant: false });
  });

  it("returns null for unknown status (-> caller quarantines)", () => {
    expect(classifyStatus("สถานะที่ไม่เคยเห็น")).toBeNull();
  });

  // COMPLETENESS: ทุกสถานะใน dictionary ต้อง map ได้ — จับบั๊ก trailing-space อัตโนมัติ
  it.each([...ALL_STATUSES, ...NS3A_EXTRA_STATUSES])(
    "maps fixture status %s",
    ({ status, changeType, taxRelevant }) => {
      expect(classifyStatus(status)).toEqual({ changeType, taxRelevant });
    }
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- changeType`
Expected: FAIL — cannot find module `./changeType`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/m10-ingest/normalize/changeType.ts`:
```ts
import type { ChangeType } from "../types";

interface Classification {
  changeType: ChangeType;
  taxRelevant: boolean;
}

// dictionary อนุมัติแล้ว (spec มาตรา 5). key = สถานะ exact หลัง strip
export const STATUS_MAP: Record<string, Classification> = {
  // TRANSFER
  "ขาย": { changeType: "TRANSFER", taxRelevant: true },
  "ขายตามคำสั่งศาล": { changeType: "TRANSFER", taxRelevant: true },
  "โอนมรดก": { changeType: "TRANSFER", taxRelevant: true },
  "ให้": { changeType: "TRANSFER", taxRelevant: true },
  // TRANSFER_PARTIAL
  "ให้เฉพาะส่วน (ระหว่างภาระจำยอม)": { changeType: "TRANSFER_PARTIAL", taxRelevant: true },
  // MERGE (แกนหลัก = รวมโฉนด; aspect รองเก็บใน rawStatus)
  "ไถ่ถอนจากจำนอง รวมสองโฉนด": { changeType: "MERGE", taxRelevant: true },
  "ลงชื่อคู่สมรส รวมสองโฉนด": { changeType: "MERGE", taxRelevant: true },
  "ให้ รวมสองโฉนด": { changeType: "MERGE", taxRelevant: true },
  // NEW
  "เอกสารสิทธิที่เกิดใหม่ - ปรับปรุง ระหว่างเดือน": { changeType: "NEW", taxRelevant: true },
  // SPLIT
  "แบ่งแยกในนามเดิม": { changeType: "SPLIT", taxRelevant: true },
  "แบ่งหักเป็นที่สาธารณประโยชน์": { changeType: "SPLIT_PUBLIC", taxRelevant: true },
  // BOUNDARY / OWNER
  "สอบเขตโฉนดที่ดิน": { changeType: "BOUNDARY_CHANGE", taxRelevant: true },
  "แก้ชื่อ (ราชการให้เปลี่ยนชื่อ)": { changeType: "OWNER_CORRECTION", taxRelevant: true },
  // ENCUMBRANCE (ไม่กระทบทะเบียน)
  "จำนอง": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "ไถ่ถอนจากจำนอง": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "ขึ้นเงินจากจำนอง": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "จำนองเพิ่มหลักทรัพย์": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "จำนองลำดับที่สอง": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "ระงับจำนอง (ศาลขายบังคับจำนอง)": { changeType: "ENCUMBRANCE", taxRelevant: false },
  // NOTE / ADMIN
  "หมายเหตุสารบัญ": { changeType: "NOTE", taxRelevant: false },
  "ใบแทน": { changeType: "ADMIN", taxRelevant: false },
  // ns3a-only
  "เอกสารสิทธิที่ยกเลิกระหว่างเดือน": { changeType: "RETIRED", taxRelevant: true },
};

// คืน null ถ้าไม่เจอ → caller ต้อง quarantine (reason="unknown_status") ห้ามเดา
export function classifyStatus(status: string): Classification | null {
  return STATUS_MAP[status.trim()] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- changeType`
Expected: PASS (3 unit + 22 parameterized).

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/normalize/changeType.ts lib/m10-ingest/normalize/changeType.test.ts
git commit -m "feat(m10-ingest): status->changeType dictionary + completeness test"
```

---

## Task 4: `parseArea` — ไร่/งาน/วา/เศษ → sqm

**Files:**
- Create: `lib/m10-ingest/normalize/area.ts`
- Test: `lib/m10-ingest/normalize/area.test.ts`

> ⚠ ASSUMPTION (spec มาตรา 6 + open item): `เศษ` = ส่วนสิบของ ตร.ว. Formula: `sqm = (rai*400 + ngan*100 + wa + sub/10) * 4`. Must be confirmed against one real LTAX record before production.

- [ ] **Step 1: Write the failing test**

Create `lib/m10-ingest/normalize/area.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseArea } from "./area";
import { NormalizeError } from "../types";

describe("parseArea", () => {
  it("computes sqm = (rai*400 + ngan*100 + wa + sub/10) * 4", () => {
    // 1 ไร่ 2 งาน 30.5 วา = (400 + 200 + 30 + 0.5) * 4 = 2522
    const a = parseArea("1", "2", "30", "5");
    expect(a).toEqual({ rai: 1, ngan: 2, wa: 30.5, sqm: 2522 });
  });

  it("treats empty parts as zero", () => {
    const a = parseArea("0", "", "", "");
    expect(a).toEqual({ rai: 0, ngan: 0, wa: 0, sqm: 0 });
  });

  it("throws area_parse_failed on non-numeric input", () => {
    try {
      parseArea("หนึ่ง", "0", "0", "0");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(NormalizeError);
      expect((e as NormalizeError).reason).toBe("area_parse_failed");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- area`
Expected: FAIL — cannot find module `./area`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/m10-ingest/normalize/area.ts`:
```ts
import { type Area, NormalizeError } from "../types";

function num(part: string, field: string): number {
  const t = part.trim();
  if (t === "") return 0;
  const n = Number(t);
  if (!Number.isFinite(n)) {
    throw new NormalizeError("area_parse_failed", `area field "${field}" not numeric: "${part}"`);
  }
  return n;
}

// (ไร่×400 + งาน×100 + วา + เศษ/10) × 4  (spec มาตรา 6)
// เศษ = ส่วนสิบของ ตร.ว.
export function parseArea(rai: string, ngan: string, wa: string, sub: string): Area {
  const r = num(rai, "rai");
  const ng = num(ngan, "ngan");
  const w = num(wa, "wa");
  const s = num(sub, "sub");
  const waWithSub = w + s / 10;
  const sqm = (r * 400 + ng * 100 + waWithSub) * 4;
  return { rai: r, ngan: ng, wa: waWithSub, sqm };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- area`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/normalize/area.ts lib/m10-ingest/normalize/area.test.ts
git commit -m "feat(m10-ingest): parseArea (rai/ngan/wa/sub -> sqm)"
```

---

## Task 5: `owner` — fullName + PDPA idHash

**Files:**
- Create: `lib/m10-ingest/normalize/owner.ts`
- Test: `lib/m10-ingest/normalize/owner.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/m10-ingest/normalize/owner.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { buildOwner, hashId } from "./owner";

describe("hashId", () => {
  it("hashes digits-only of a 13-digit id, ignoring separators", () => {
    const expected = createHash("sha256").update("1234567890123").digest("hex");
    expect(hashId("1-2345-67890-12-3")).toBe(expected);
  });

  it("returns null when there are no digits", () => {
    expect(hashId("")).toBeNull();
    expect(hashId("-")).toBeNull();
  });
});

describe("buildOwner", () => {
  it("builds trimmed fullName and hashes id", () => {
    const o = buildOwner({ title: "นาย", name: "สมชาย", surname: "ใจดี", id: "1-2345-67890-12-3" });
    expect(o.fullName).toBe("นาย สมชาย ใจดี");
    expect(o.idHash).toBe(createHash("sha256").update("1234567890123").digest("hex"));
  });

  it("collapses missing parts without leaving stray spaces", () => {
    const o = buildOwner({ title: "", name: "สมหญิง", surname: "", id: "" });
    expect(o.fullName).toBe("สมหญิง");
    expect(o.idHash).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- owner`
Expected: FAIL — cannot find module `./owner`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/m10-ingest/normalize/owner.ts`:
```ts
import { createHash } from "node:crypto";
import type { Owner } from "../types";

// PDPA: เก็บเฉพาะ sha256 ของเลข 13 หลัก (digits only) ไม่เก็บเลขดิบ
export function hashId(rawId: string): string | null {
  const digits = (rawId ?? "").replace(/\D/g, "");
  if (digits === "") return null;
  return createHash("sha256").update(digits).digest("hex");
}

export function buildOwner(input: {
  title: string;
  name: string;
  surname: string;
  id: string;
}): Owner {
  const title = input.title.trim();
  const name = input.name.trim();
  const surname = input.surname.trim();
  const fullName = [title, name, surname].filter(Boolean).join(" ");
  return { title, name, surname, fullName, idHash: hashId(input.id) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- owner`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/normalize/owner.ts lib/m10-ingest/normalize/owner.test.ts
git commit -m "feat(m10-ingest): owner fullName + PDPA idHash"
```

---

## Task 6: `ravangKey` / `recordKey` — the join key

**Files:**
- Create: `lib/m10-ingest/normalize/ravang.ts`
- Test: `lib/m10-ingest/normalize/ravang.test.ts`

> Critical: this one function is used by BOTH the attribute side and the geometry side, so a single source of truth guarantees joins match (spec validated 59/59).

- [ ] **Step 1: Write the failing test**

Create `lib/m10-ingest/normalize/ravang.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ravangKey, recordKey } from "./ravang";

describe("ravangKey", () => {
  it("zero-pads UTM4 to 2 digits and joins parts with |", () => {
    expect(ravangKey({ utm1: "47", utm2: "P", utm3: "5239", utm4: "7", scale: "4000" }))
      .toBe("47|P|5239|07|4000");
  });

  it("leaves an already 2-digit UTM4 unchanged", () => {
    expect(ravangKey({ utm1: "47", utm2: "P", utm3: "5239", utm4: "12", scale: "4000" }))
      .toBe("47|P|5239|12|4000");
  });
});

describe("recordKey", () => {
  it("appends landNumber to the ravang key", () => {
    const rk = recordKey({ utm1: "47", utm2: "P", utm3: "5239", utm4: "7", scale: "4000" }, "123");
    expect(rk).toBe("47|P|5239|07|4000|123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ravang`
Expected: FAIL — cannot find module `./ravang`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/m10-ingest/normalize/ravang.ts`:
```ts
export interface RavangParts {
  utm1: string;
  utm2: string;
  utm3: string;
  utm4: string;
  scale: string;
}

function zeroPad(value: string, width: number): string {
  const t = value.trim();
  return t.padStart(width, "0");
}

// ${UTM1}|${UTM2}|${UTM3}|${zeroPad(UTM4,2)}|${Scale}  (spec มาตรา 6)
// ⚠ ใช้ฟังก์ชันเดียวกันทั้งฝั่ง attribute และ geometry — ห้าม inline ที่อื่น
export function ravangKey(p: RavangParts): string {
  return [p.utm1.trim(), p.utm2.trim(), p.utm3.trim(), zeroPad(p.utm4, 2), p.scale.trim()].join("|");
}

export function recordKey(p: RavangParts, landNumber: string): string {
  return `${ravangKey(p)}|${landNumber.trim()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ravang`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/normalize/ravang.ts lib/m10-ingest/normalize/ravang.test.ts
git commit -m "feat(m10-ingest): ravangKey/recordKey single source of truth"
```

---

## Task 7: `parseThaiDate` — d/m/yyyy พ.ศ. → ISO

**Files:**
- Create: `lib/m10-ingest/normalize/date.ts`
- Test: `lib/m10-ingest/normalize/date.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/m10-ingest/normalize/date.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseThaiDate } from "./date";
import { NormalizeError } from "../types";

describe("parseThaiDate", () => {
  it("converts non-zero-padded d/m/yyyy Buddhist year to ISO", () => {
    expect(parseThaiDate("5/1/2569")).toBe("2026-01-05");
  });

  it("handles zero-padded day/month too", () => {
    expect(parseThaiDate("05/01/2569")).toBe("2026-01-05");
  });

  it("throws date_parse_failed on garbage", () => {
    try {
      parseThaiDate("ไม่ใช่วันที่");
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as NormalizeError).reason).toBe("date_parse_failed");
    }
  });

  it("throws date_parse_failed on impossible month", () => {
    expect(() => parseThaiDate("5/13/2569")).toThrow(NormalizeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- date`
Expected: FAIL — cannot find module `./date`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/m10-ingest/normalize/date.ts`:
```ts
import { NormalizeError } from "../types";

// "d/m/yyyy" (พ.ศ., ไม่ zero-pad ก็ได้) → "YYYY-MM-DD" (ค.ศ., ปี−543)
export function parseThaiDate(input: string): string {
  const m = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) {
    throw new NormalizeError("date_parse_failed", `bad date: "${input}"`);
  }
  const day = Number(m[1]);
  const month = Number(m[2]);
  const yearCE = Number(m[3]) - 543;
  if (month < 1 || month > 12 || day < 1 || day > 31 || yearCE < 1900) {
    throw new NormalizeError("date_parse_failed", `out-of-range date: "${input}"`);
  }
  // ตรวจวันจริง (เช่น 31/2) ผ่าน round-trip
  const d = new Date(Date.UTC(yearCE, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new NormalizeError("date_parse_failed", `invalid calendar date: "${input}"`);
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yearCE}-${mm}-${dd}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- date`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/normalize/date.ts lib/m10-ingest/normalize/date.test.ts
git commit -m "feat(m10-ingest): parseThaiDate Buddhist d/m/yyyy -> ISO"
```

---

## Task 8: `parseCurrency` — "฿1,234.50" → number | null

**Files:**
- Create: `lib/m10-ingest/normalize/currency.ts`
- Test: `lib/m10-ingest/normalize/currency.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/m10-ingest/normalize/currency.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseCurrency } from "./currency";

describe("parseCurrency", () => {
  it("parses baht with thousands separators", () => {
    expect(parseCurrency("฿304,000.00")).toBe(304000);
    expect(parseCurrency("฿1,234.50")).toBe(1234.5);
  });

  it("returns null for the dash placeholder and empty", () => {
    expect(parseCurrency("฿-")).toBeNull();
    expect(parseCurrency("")).toBeNull();
    expect(parseCurrency("   ")).toBeNull();
  });

  it("returns null for non-numeric junk (caller decides; currency is non-fatal)", () => {
    expect(parseCurrency("฿abc")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- currency`
Expected: FAIL — cannot find module `./currency`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/m10-ingest/normalize/currency.ts`:
```ts
// "฿1,234.50" → 1234.5 ; "฿-" หรือว่าง → null  (spec มาตรา 6)
export function parseCurrency(input: string): number | null {
  const cleaned = (input ?? "").replace(/[฿,\s]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- currency`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/normalize/currency.ts lib/m10-ingest/normalize/currency.test.ts
git commit -m "feat(m10-ingest): parseCurrency baht string -> number|null"
```

---

## Task 9: `normalizeRow` — orchestrate normalize → NormalizeOutcome

**Files:**
- Create: `lib/m10-ingest/normalize/index.ts`
- Test: `lib/m10-ingest/normalize/index.test.ts`

This ties the pure functions together against a `RawRow`. Column names are mapped here. It NEVER throws — it returns `{ok:false, reason}` so the caller quarantines.

- [ ] **Step 1: Write the failing test**

Create `lib/m10-ingest/normalize/index.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeRow } from "./index";
import { DIRTY_PARCEL_ROW } from "../__fixtures__/sampleRows";
import type { RawRow } from "../types";

const dirtyRaw: RawRow = { docType: "PARCEL", source: "parcel.csv", raw: DIRTY_PARCEL_ROW };

describe("normalizeRow", () => {
  it("normalizes a dirty parcel row end-to-end", () => {
    const out = normalizeRow(dirtyRaw);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.txn.changeType).toBe("TRANSFER");
    expect(out.txn.taxRelevant).toBe(true);
    expect(out.txn.rawStatus).toBe("ขาย"); // trimmed
    expect(out.txn.txnDate).toBe("2026-01-05");
    expect(out.txn.regAmount).toBe(304000);
    expect(out.txn.recordKey).toBe("47|P|5239|07|4000|123"); // UTM4 padded
    expect(out.txn.owner.fullName).toBe("นาย สมชาย ใจดี");
    expect(out.txn.area?.sqm).toBe((400 + 200 + 30 + 0.5) * 4);
    expect(out.txn.payloadRaw["สถานะดำเนินการ"]).toBe("ขาย"); // trimmed key+value preserved
  });

  it("quarantines unknown status", () => {
    const raw: RawRow = {
      docType: "PARCEL",
      source: "parcel.csv",
      raw: { ...DIRTY_PARCEL_ROW, "สถานะดำเนินการ ": "สถานะแปลกๆ" },
    };
    const out = normalizeRow(raw);
    expect(out).toEqual({ ok: false, reason: "unknown_status" });
  });

  it("quarantines a bad date", () => {
    const raw: RawRow = {
      docType: "PARCEL",
      source: "parcel.csv",
      raw: { ...DIRTY_PARCEL_ROW, "วันที่": "??" },
    };
    const out = normalizeRow(raw);
    expect(out).toEqual({ ok: false, reason: "date_parse_failed" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- normalize/index`
Expected: FAIL — cannot find module `./index`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/m10-ingest/normalize/index.ts`:
```ts
import { type NormalizeOutcome, type RawRow, NormalizeError } from "../types";
import { trimAll } from "./trim";
import { classifyStatus } from "./changeType";
import { parseArea } from "./area";
import { buildOwner } from "./owner";
import { recordKey } from "./ravang";
import { parseThaiDate } from "./date";
import { parseCurrency } from "./currency";

// ชื่อคอลัมน์ต้นทาง (หลัง trim) → field ภายใน
const COL = {
  status: "สถานะดำเนินการ",
  date: "วันที่",
  amount: "ราคาประเมิน",
  utm1: "UTM1",
  utm2: "UTM2",
  utm3: "UTM3",
  utm4: "UTM4",
  scale: "Scale",
  landNumber: "เลขที่ดิน",
  title: "คำนำหน้า",
  name: "ชื่อ",
  surname: "นามสกุล",
  id: "เลขบัตรประชาชน",
  rai: "ไร่",
  ngan: "งาน",
  wa: "วา",
  sub: "เศษ",
} as const;

export function normalizeRow(rawRow: RawRow): NormalizeOutcome {
  const raw = trimAll(rawRow.raw); // strip ก่อนเสมอ
  const get = (k: string) => raw[k] ?? "";

  try {
    const rawStatus = get(COL.status);
    const classification = classifyStatus(rawStatus);
    if (!classification) {
      throw new NormalizeError("unknown_status", rawStatus);
    }

    const rk = recordKey(
      {
        utm1: get(COL.utm1),
        utm2: get(COL.utm2),
        utm3: get(COL.utm3),
        utm4: get(COL.utm4),
        scale: get(COL.scale),
      },
      get(COL.landNumber)
    );

    const txnDate = parseThaiDate(get(COL.date));
    const regAmount = parseCurrency(get(COL.amount)); // null = ว่าง, ไม่ fatal

    // area อาจไม่มี (เช่น ns3a "ไม่บันทึกระวาง") → ถ้าไม่มีฟิลด์เลย area=null
    const hasAreaFields =
      raw[COL.rai] !== undefined ||
      raw[COL.ngan] !== undefined ||
      raw[COL.wa] !== undefined ||
      raw[COL.sub] !== undefined;
    const area = hasAreaFields
      ? parseArea(get(COL.rai), get(COL.ngan), get(COL.wa), get(COL.sub))
      : null;

    const owner = buildOwner({
      title: get(COL.title),
      name: get(COL.name),
      surname: get(COL.surname),
      id: get(COL.id),
    });

    return {
      ok: true,
      txn: {
        docType: rawRow.docType,
        recordKey: rk,
        rawStatus,
        changeType: classification.changeType,
        taxRelevant: classification.taxRelevant,
        txnDate,
        regAmount,
        owner,
        area,
        payloadRaw: raw,
      },
    };
  } catch (e) {
    if (e instanceof NormalizeError) {
      return { ok: false, reason: e.reason };
    }
    throw e; // bug จริง ๆ ไม่ใช่ข้อมูลสกปรก — ปล่อยให้ดังขึ้นไป
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- normalize/index`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/normalize/index.ts lib/m10-ingest/normalize/index.test.ts
git commit -m "feat(m10-ingest): normalizeRow orchestrator (raw -> NormalizeOutcome)"
```

---

## Task 10: Adapters — CSV + GeoJSON → RawRow / RawGeometry

**Files:**
- Create: `lib/m10-ingest/adapters/csv.ts`
- Create: `lib/m10-ingest/adapters/geometry.ts`
- Create: `lib/m10-ingest/__fixtures__/sampleGeometry.ts`
- Test: `lib/m10-ingest/adapters/csv.test.ts`
- Test: `lib/m10-ingest/adapters/geometry.test.ts`

Adapters do NO domain logic — they only turn a file format into the package's input shapes.

- [ ] **Step 1: Write the failing CSV adapter test**

Create `lib/m10-ingest/adapters/csv.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseCsv } from "./csv";

const CSV = `สถานะดำเนินการ,เลขที่ดิน,UTM4
ขาย,123,7
จำนอง,124,8
`;

describe("parseCsv", () => {
  it("returns one RawRow per data row with the given docType + source", () => {
    const rows = parseCsv(CSV, "PARCEL", "parcel.csv");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      docType: "PARCEL",
      source: "parcel.csv",
      raw: { "สถานะดำเนินการ": "ขาย", "เลขที่ดิน": "123", "UTM4": "7" },
    });
    expect(rows[1].raw["สถานะดำเนินการ"]).toBe("จำนอง");
  });

  it("skips fully blank trailing rows", () => {
    const rows = parseCsv(CSV + "\n\n", "PARCEL", "parcel.csv");
    expect(rows).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- adapters/csv`
Expected: FAIL — cannot find module `./csv`.

- [ ] **Step 3: Write the CSV adapter**

Create `lib/m10-ingest/adapters/csv.ts`:
```ts
import Papa from "papaparse";
import type { DocType, RawRow } from "../types";

// อ่าน CSV 1 ไฟล์ → RawRow[] (ไม่มี domain logic; แค่ format → shape)
export function parseCsv(content: string, docType: DocType, source: string): RawRow[] {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: "greedy",
  });
  return result.data
    .filter((row) => row && Object.keys(row).length > 0)
    .map((raw) => ({ docType, source, raw }));
}

export const parseParcelCsv = (c: string, source = "parcel.csv") => parseCsv(c, "PARCEL", source);
export const parseNs3aCsv = (c: string, source = "ns3a.csv") => parseCsv(c, "NS3A", source);
export const parseConstructionCsv = (c: string, source = "construction.csv") =>
  parseCsv(c, "CONSTRUCTION", source);
```

- [ ] **Step 4: Run CSV test to verify it passes**

Run: `npm test -- adapters/csv`
Expected: PASS, 2 tests.

- [ ] **Step 5: Create the geometry fixture (incl. golden point)**

Create `lib/m10-ingest/__fixtures__/sampleGeometry.ts`:
```ts
// FeatureCollection ใน EPSG:24047 (เมตร). ใช้จุด golden จาก spec มาตรา 9:
// E=647023, N=1683144 → คาดหวัง lat∈[15.20,15.25], lon∈[100.36,100.37] หลัง reproject
// properties มีคอลัมน์ระวาง (UTM1..Scale + เลขที่ดิน) เพื่อสร้าง recordKey เหมือนฝั่ง attribute
export const GOLDEN_POINT_24047: [number, number] = [647023, 1683144];

export const SAMPLE_GEOJSON_24047 = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { UTM1: "47", UTM2: "P", UTM3: "5239", UTM4: "7", Scale: "4000", "เลขที่ดิน": "123" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [647023, 1683144],
            [647073, 1683144],
            [647073, 1683194],
            [647023, 1683194],
            [647023, 1683144],
          ],
        ],
      },
    },
  ],
} as const;
```

- [ ] **Step 6: Write the failing geometry adapter test**

Create `lib/m10-ingest/adapters/geometry.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseGeometryGeoJSON } from "./geometry";
import { SAMPLE_GEOJSON_24047 } from "../__fixtures__/sampleGeometry";

describe("parseGeometryGeoJSON", () => {
  it("returns one RawGeometry per feature, keyed by recordKey", () => {
    const out = parseGeometryGeoJSON(JSON.stringify(SAMPLE_GEOJSON_24047));
    expect(out).toHaveLength(1);
    expect(out[0].recordKey).toBe("47|P|5239|07|4000|123"); // same key fn as attributes
    expect(out[0].geometry.type).toBe("Polygon");
  });

  it("throws geometry_invalid for non-FeatureCollection input", () => {
    expect(() => parseGeometryGeoJSON("{}")).toThrowError();
  });
});
```

- [ ] **Step 7: Run geometry test to verify it fails**

Run: `npm test -- adapters/geometry`
Expected: FAIL — cannot find module `./geometry`.

- [ ] **Step 8: Write the geometry adapter**

Create `lib/m10-ingest/adapters/geometry.ts`:
```ts
import { type RawGeometry, NormalizeError } from "../types";
import { recordKey } from "../normalize/ravang";

// อ่าน GeoJSON FeatureCollection (EPSG:24047) → RawGeometry[]
// shapefile ต้องแปลงเป็น GeoJSON ก่อน (out of scope รอบนี้)
export function parseGeometryGeoJSON(content: string): RawGeometry[] {
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new NormalizeError("geometry_invalid", "geometry file is not valid JSON");
  }
  if (!parsed || parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    throw new NormalizeError("geometry_invalid", "expected a GeoJSON FeatureCollection");
  }
  return parsed.features.map((f: any) => {
    const p = f.properties ?? {};
    const rk = recordKey(
      {
        utm1: String(p.UTM1 ?? ""),
        utm2: String(p.UTM2 ?? ""),
        utm3: String(p.UTM3 ?? ""),
        utm4: String(p.UTM4 ?? ""),
        scale: String(p.Scale ?? ""),
      },
      String(p["เลขที่ดิน"] ?? "")
    );
    return { recordKey: rk, geometry: f.geometry };
  });
}
```

- [ ] **Step 9: Run geometry test to verify it passes**

Run: `npm test -- adapters/geometry`
Expected: PASS, 2 tests.

- [ ] **Step 10: Commit**

```bash
git add lib/m10-ingest/adapters/ lib/m10-ingest/__fixtures__/sampleGeometry.ts
git commit -m "feat(m10-ingest): CSV + GeoJSON adapters"
```

---

## Task 11: Geometry reproject — proj4 24047→4326 + golden test

**Files:**
- Create: `lib/m10-ingest/geometry/reproject.ts`
- Test: `lib/m10-ingest/geometry/reproject.test.ts`

> The datum shift is mandatory (spec มาตรา 7 + validated assumption: skipping it = ~625 m error). Do NOT substitute EPSG:32647.

- [ ] **Step 1: Write the failing golden test**

Create `lib/m10-ingest/geometry/reproject.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { reprojectPoint, reprojectGeometry } from "./reproject";
import { GOLDEN_POINT_24047 } from "../__fixtures__/sampleGeometry";

describe("reprojectPoint (24047 -> 4326)", () => {
  it("lands the golden point in Takhli with datum shift applied", () => {
    const [lon, lat] = reprojectPoint(GOLDEN_POINT_24047);
    expect(lat).toBeGreaterThanOrEqual(15.2);
    expect(lat).toBeLessThanOrEqual(15.25);
    expect(lon).toBeGreaterThanOrEqual(100.36);
    expect(lon).toBeLessThanOrEqual(100.37);
  });
});

describe("reprojectGeometry", () => {
  it("reprojects every coordinate of a Polygon and keeps it closed", () => {
    const out = reprojectGeometry({
      type: "Polygon",
      coordinates: [[[647023, 1683144], [647073, 1683144], [647073, 1683194], [647023, 1683144]]],
    });
    expect(out.type).toBe("Polygon");
    const ring = out.coordinates[0];
    // first === last (closed ring)
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    // coords now in lon/lat degrees
    expect(ring[0][0]).toBeGreaterThan(100);
    expect(ring[0][1]).toBeGreaterThan(15);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- reproject`
Expected: FAIL — cannot find module `./reproject`.

- [ ] **Step 3: Write the reproject implementation**

Create `lib/m10-ingest/geometry/reproject.ts`:
```ts
import proj4 from "proj4";

// EPSG:24047 = Indian 1975 / UTM zone 47N (Everest 1830), 3-param towgs84 for Thailand.
// towgs84 = datum shift จริง — ห้ามตัดทิ้ง (ตัดทิ้ง = เพี้ยน ~625 ม.)
const EPSG_24047 =
  "+proj=utm +zone=47 +ellps=evrst30 +towgs84=210,814,289,0,0,0,0 +units=m +no_defs";
const EPSG_4326 = "+proj=longlat +datum=WGS84 +no_defs";

const transform = proj4(EPSG_24047, EPSG_4326);

// [E, N] เมตร (24047) → [lon, lat] องศา (4326)
export function reprojectPoint(coord: [number, number]): [number, number] {
  const [lon, lat] = transform.forward(coord);
  return [lon, lat];
}

type Ring = [number, number][];

function reprojectRing(ring: Ring): Ring {
  return ring.map((c) => reprojectPoint([c[0], c[1]]));
}

// reproject Polygon | MultiPolygon ทุกพิกัด
export function reprojectGeometry(
  geom: GeoJSON.Polygon | GeoJSON.MultiPolygon
): GeoJSON.Polygon | GeoJSON.MultiPolygon {
  if (geom.type === "Polygon") {
    return { type: "Polygon", coordinates: (geom.coordinates as Ring[]).map(reprojectRing) };
  }
  return {
    type: "MultiPolygon",
    coordinates: (geom.coordinates as Ring[][]).map((poly) => poly.map(reprojectRing)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- reproject`
Expected: PASS, 2 tests. If the golden point lands outside the box, the proj4 def is wrong — fix the def, do not loosen the assertion.

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/geometry/reproject.ts lib/m10-ingest/geometry/reproject.test.ts
git commit -m "feat(m10-ingest): proj4 24047->4326 reproject with datum shift + golden test"
```

---

## Task 12: Geometry winding/validate + spatial join

**Files:**
- Create: `lib/m10-ingest/geometry/join.ts`
- Test: `lib/m10-ingest/geometry/join.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/m10-ingest/geometry/join.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { prepareGeometry, joinGeometry } from "./join";
import type { RawGeometry } from "../types";

const validGeom24047: RawGeometry = {
  recordKey: "47|P|5239|07|4000|123",
  geometry: {
    type: "Polygon",
    coordinates: [[[647023, 1683144], [647073, 1683144], [647073, 1683194], [647023, 1683194], [647023, 1683144]]],
  },
};

describe("prepareGeometry", () => {
  it("reprojects + rewinds to RFC7946 (returns ok)", () => {
    const out = prepareGeometry(validGeom24047);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.geometry.type).toBe("Polygon");
    expect(out.geometry.coordinates[0][0][0]).toBeGreaterThan(100); // lon degrees
  });

  it("rejects an invalid (self-degenerate) polygon as geometry_invalid", () => {
    const bad: RawGeometry = {
      recordKey: "bad",
      geometry: { type: "Polygon", coordinates: [[[0, 0], [0, 0], [0, 0], [0, 0]]] },
    };
    const out = prepareGeometry(bad);
    expect(out.ok).toBe(false);
  });
});

describe("joinGeometry", () => {
  it("matches geometries to record keys, reporting unmatched", () => {
    const result = joinGeometry(["47|P|5239|07|4000|123", "99|X|0000|00|4000|1"], [validGeom24047]);
    expect(result.matched.size).toBe(1);
    expect(result.matched.has("47|P|5239|07|4000|123")).toBe(true);
    expect(result.unmatchedGeometry).toEqual([]); // every geometry found a key
    expect(result.recordsWithoutGeometry).toEqual(["99|X|0000|00|4000|1"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- geometry/join`
Expected: FAIL — cannot find module `./join`.

- [ ] **Step 3: Write the implementation**

Create `lib/m10-ingest/geometry/join.ts`:
```ts
import rewind from "@turf/rewind";
import booleanValid from "@turf/boolean-valid";
import { feature } from "@turf/helpers";
import { type RawGeometry } from "../types";
import { reprojectGeometry } from "./reproject";

export type PreparedGeometry =
  | { ok: true; recordKey: string; geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon }
  | { ok: false; recordKey: string; reason: "geometry_invalid" };

// reproject → rewind (RFC 7946) → validate ด้วย turf
export function prepareGeometry(raw: RawGeometry): PreparedGeometry {
  try {
    const reprojected = reprojectGeometry(raw.geometry);
    const wound = rewind(feature(reprojected), { reverse: false })
      .geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    if (!booleanValid(wound)) {
      return { ok: false, recordKey: raw.recordKey, reason: "geometry_invalid" };
    }
    return { ok: true, recordKey: raw.recordKey, geometry: wound };
  } catch {
    return { ok: false, recordKey: raw.recordKey, reason: "geometry_invalid" };
  }
}

export interface JoinResult {
  matched: Map<string, GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  invalid: RawGeometry[];
  unmatchedGeometry: string[]; // geometry whose recordKey has no attribute record
  recordsWithoutGeometry: string[]; // record keys with no geometry (still valid, e.g. ns3a)
}

// join ด้วย recordKey (= ravangKey + landNumber). ฟังก์ชัน key เดียวกับฝั่ง attribute
export function joinGeometry(recordKeys: string[], geometries: RawGeometry[]): JoinResult {
  const keySet = new Set(recordKeys);
  const matched = new Map<string, GeoJSON.Polygon | GeoJSON.MultiPolygon>();
  const invalid: RawGeometry[] = [];
  const unmatchedGeometry: string[] = [];

  for (const g of geometries) {
    const prepared = prepareGeometry(g);
    if (!prepared.ok) {
      invalid.push(g);
      continue;
    }
    if (keySet.has(prepared.recordKey)) {
      matched.set(prepared.recordKey, prepared.geometry);
    } else {
      unmatchedGeometry.push(prepared.recordKey);
    }
  }

  const recordsWithoutGeometry = recordKeys.filter((k) => !matched.has(k));
  return { matched, invalid, unmatchedGeometry, recordsWithoutGeometry };
}
```

Note: imports use the individual `@turf/*` modules bundled inside `@turf/turf`. If TS module resolution complains about default imports, switch to `import { rewind, booleanValid, feature } from "@turf/turf";` and adjust call sites (no default import).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- geometry/join`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/geometry/join.ts lib/m10-ingest/geometry/join.test.ts
git commit -m "feat(m10-ingest): geometry validate/rewind + recordKey spatial join"
```

---

## Task 13: Mongoose models (`models/m10-ingest/`)

**Files:**
- Create: `models/m10-ingest/M10ImportBatch.js`
- Create: `models/m10-ingest/M10Transaction.js`
- Create: `models/m10-ingest/M10Record.js`
- Create: `models/m10-ingest/M10Reject.js`
- Create: `models/m10-ingest/index.js`

No standalone test (schemas are exercised by the repository tests in Task 14). Models follow the existing `mongoose.models.X || mongoose.model(...)` hot-reload guard pattern and use `m10_*` collections.

- [ ] **Step 1: Create M10ImportBatch**

Create `models/m10-ingest/M10ImportBatch.js`:
```js
const mongoose = require("mongoose");

const ImportBatchSchema = new mongoose.Schema(
  {
    optId: String,
    optName: String,
    period: { type: String, index: true }, // "2569-01"
    files: [{ name: String, hash: String }],
    fileHash: { type: String, index: true }, // hash รวมของชุดไฟล์ — กันนำเข้าซ้ำ (idempotent)
    counts: {
      parcel: Number,
      ns3a: Number,
      construction: Number,
      geometry: Number,
    },
    status: { type: String, enum: ["processing", "done", "failed"], default: "processing" },
    importedAt: { type: Date, default: Date.now },
  },
  { collection: "m10_import_batches" }
);

module.exports =
  mongoose.models.M10ImportBatch || mongoose.model("M10ImportBatch", ImportBatchSchema);
```

- [ ] **Step 2: Create M10Transaction**

Create `models/m10-ingest/M10Transaction.js`:
```js
const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "M10ImportBatch", index: true },
    docType: { type: String, enum: ["PARCEL", "NS3A", "CONSTRUCTION"] },
    recordKey: { type: String, index: true },
    rawStatus: String,
    changeType: String,
    taxRelevant: Boolean,
    txnDate: Date,
    regAmount: { type: Number, default: null },
    owner: {
      title: String,
      name: String,
      surname: String,
      fullName: String,
      idHash: { type: String, default: null },
    },
    payloadRaw: { type: mongoose.Schema.Types.Mixed }, // ทั้งแถวเดิม (trimmed)
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "m10_transactions" }
);

// dedup key: (batchId, recordKey, rawStatus, txnDate)
TransactionSchema.index(
  { batchId: 1, recordKey: 1, rawStatus: 1, txnDate: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.M10Transaction || mongoose.model("M10Transaction", TransactionSchema);
```

- [ ] **Step 3: Create M10Record**

Create `models/m10-ingest/M10Record.js`:
```js
const mongoose = require("mongoose");

const RecordSchema = new mongoose.Schema(
  {
    docType: { type: String, enum: ["PARCEL", "NS3A", "CONSTRUCTION"] },
    recordKey: { type: String, unique: true }, // ravangKey + landNumber
    deedNo: { type: String, index: true, default: null },
    area: { rai: Number, ngan: Number, wa: Number, sqm: Number },
    location: { province: String, amphoe: String, tambon: String },
    owners: [
      {
        title: String,
        name: String,
        surname: String,
        fullName: String,
        idHash: { type: String, default: null },
        address: String,
      },
    ],
    geometry: { type: mongoose.Schema.Types.Mixed, default: null }, // GeoJSON Polygon EPSG:4326
    hasGeometry: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "retired"], default: "active" },
    lastTxnId: { type: mongoose.Schema.Types.ObjectId, ref: "M10Transaction" },
    lastChangeType: String,
    version: { type: Number, default: 1 },
    history: [{ txnId: mongoose.Schema.Types.ObjectId, changeType: String, at: Date }],
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "m10_records" }
);

RecordSchema.index({ geometry: "2dsphere" }); // เตรียมไว้สำหรับ spatial reconcile รอบถัดไป

module.exports = mongoose.models.M10Record || mongoose.model("M10Record", RecordSchema);
```

Note: a `2dsphere` index over a field that is `null` for many docs is fine in MongoDB (nulls are skipped); no sparse flag needed for mixed/geojson, but if Mongo errors on indexing null geometry, make it `{ geometry: "2dsphere" }, { sparse: true }`.

- [ ] **Step 4: Create M10Reject**

Create `models/m10-ingest/M10Reject.js`:
```js
const mongoose = require("mongoose");

const RejectSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "M10ImportBatch", index: true },
    source: String, // ชื่อไฟล์
    docType: String,
    rawRow: { type: mongoose.Schema.Types.Mixed },
    reason: String, // RejectReason
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "m10_rejects" }
);

module.exports = mongoose.models.M10Reject || mongoose.model("M10Reject", RejectSchema);
```

- [ ] **Step 5: Create the index re-export**

Create `models/m10-ingest/index.js`:
```js
module.exports = {
  M10ImportBatch: require("./M10ImportBatch"),
  M10Transaction: require("./M10Transaction"),
  M10Record: require("./M10Record"),
  M10Reject: require("./M10Reject"),
};
```

- [ ] **Step 6: Type-check compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from these files (they are `.js`; allowJs is on).

- [ ] **Step 7: Commit**

```bash
git add models/m10-ingest/
git commit -m "feat(m10-ingest): mongoose models (M10* / m10_* collections)"
```

---

## Task 14: Repository — idempotent batch, dedup txn, materialize record, reject

**Files:**
- Create: `lib/m10-ingest/repository/index.ts`
- Test: `lib/m10-ingest/repository/index.test.ts`

The repository is the only layer touching MongoDB. Tests use `mongodb-memory-server` so they are hermetic.

- [ ] **Step 1: Write the failing test**

Create `lib/m10-ingest/repository/index.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  findBatchByHash,
  createBatch,
  insertTransactionDedup,
  materializeRecord,
  insertReject,
} from "./index";
import type { NormalizedTxn } from "../types";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  const db = mongoose.connection.db;
  if (db) {
    const cols = await db.collections();
    await Promise.all(cols.map((c) => c.deleteMany({})));
  }
});

function txn(over: Partial<NormalizedTxn> = {}): NormalizedTxn {
  return {
    docType: "PARCEL",
    recordKey: "47|P|5239|07|4000|123",
    rawStatus: "ขาย",
    changeType: "TRANSFER",
    taxRelevant: true,
    txnDate: "2026-01-05",
    regAmount: 304000,
    owner: { title: "นาย", name: "สมชาย", surname: "ใจดี", fullName: "นาย สมชาย ใจดี", idHash: "abc" },
    area: { rai: 1, ngan: 2, wa: 30.5, sqm: 2522 },
    payloadRaw: {},
    ...over,
  };
}

describe("batch idempotency", () => {
  it("findBatchByHash returns null then the created batch", async () => {
    expect(await findBatchByHash("hash1")).toBeNull();
    const b = await createBatch({ fileHash: "hash1", period: "2569-01", files: [], counts: {} });
    const found = await findBatchByHash("hash1");
    expect(found?._id.toString()).toBe(b._id.toString());
  });
});

describe("insertTransactionDedup", () => {
  it("inserts once, second identical insert is a no-op", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const first = await insertTransactionDedup(b._id, txn());
    const second = await insertTransactionDedup(b._id, txn());
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    const count = await mongoose.connection.db!.collection("m10_transactions").countDocuments();
    expect(count).toBe(1);
  });
});

describe("materializeRecord", () => {
  it("creates an active record from a tax-relevant txn", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const t = await insertTransactionDedup(b._id, txn());
    await materializeRecord(t.doc!._id, txn());
    const rec = await mongoose.connection.db!
      .collection("m10_records")
      .findOne({ recordKey: "47|P|5239|07|4000|123" });
    expect(rec?.status).toBe("active");
    expect(rec?.lastChangeType).toBe("TRANSFER");
    expect(rec?.version).toBe(1);
  });

  it("retires a record on RETIRED change and bumps version", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const t1 = await insertTransactionDedup(b._id, txn());
    await materializeRecord(t1.doc!._id, txn());
    const retire = txn({ rawStatus: "เอกสารสิทธิที่ยกเลิกระหว่างเดือน", changeType: "RETIRED", txnDate: "2026-01-10" });
    const t2 = await insertTransactionDedup(b._id, retire);
    await materializeRecord(t2.doc!._id, retire);
    const rec = await mongoose.connection.db!
      .collection("m10_records")
      .findOne({ recordKey: "47|P|5239|07|4000|123" });
    expect(rec?.status).toBe("retired");
    expect(rec?.version).toBe(2);
  });
});

describe("insertReject", () => {
  it("stores a quarantined row with its reason", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    await insertReject(b._id, { source: "parcel.csv", docType: "PARCEL", rawRow: { a: "1" }, reason: "unknown_status" });
    const count = await mongoose.connection.db!.collection("m10_rejects").countDocuments();
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- repository/index`
Expected: FAIL — cannot find module `./index`.

- [ ] **Step 3: Write the repository**

Create `lib/m10-ingest/repository/index.ts`:
```ts
import type { Types } from "mongoose";
import type { NormalizedTxn, RejectReason, DocType } from "../types";

// โหลด models ผ่าน require (CommonJS) — ใช้ guard mongoose.models.* hot-reload safe
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { M10ImportBatch, M10Transaction, M10Record, M10Reject } = require("../../../models/m10-ingest");

export interface CreateBatchInput {
  fileHash: string;
  period: string;
  optId?: string;
  optName?: string;
  files: { name: string; hash: string }[];
  counts: Record<string, number>;
}

export async function findBatchByHash(fileHash: string) {
  return M10ImportBatch.findOne({ fileHash }).lean();
}

export async function createBatch(input: CreateBatchInput) {
  return M10ImportBatch.create({ ...input, status: "processing", importedAt: new Date() });
}

export async function finishBatch(batchId: Types.ObjectId, status: "done" | "failed") {
  await M10ImportBatch.updateOne({ _id: batchId }, { $set: { status } });
}

// dedup by (batchId, recordKey, rawStatus, txnDate). คืน inserted=false ถ้าซ้ำ (idempotent)
export async function insertTransactionDedup(batchId: Types.ObjectId, txn: NormalizedTxn) {
  const filter = {
    batchId,
    recordKey: txn.recordKey,
    rawStatus: txn.rawStatus,
    txnDate: new Date(txn.txnDate),
  };
  const existing = await M10Transaction.findOne(filter);
  if (existing) {
    return { inserted: false as const, doc: existing };
  }
  const doc = await M10Transaction.create({
    batchId,
    docType: txn.docType,
    recordKey: txn.recordKey,
    rawStatus: txn.rawStatus,
    changeType: txn.changeType,
    taxRelevant: txn.taxRelevant,
    txnDate: new Date(txn.txnDate),
    regAmount: txn.regAmount,
    owner: txn.owner,
    payloadRaw: txn.payloadRaw,
  });
  return { inserted: true as const, doc };
}

// materialize record จาก txn ที่ taxRelevant. RETIRED → status retired
export async function materializeRecord(txnId: Types.ObjectId, txn: NormalizedTxn) {
  if (!txn.taxRelevant) return; // txn จำนอง ฯลฯ ไม่ขยับ records

  const existing = await M10Record.findOne({ recordKey: txn.recordKey });
  const status = txn.changeType === "RETIRED" ? "retired" : "active";
  const historyEntry = { txnId, changeType: txn.changeType, at: new Date(txn.txnDate) };

  if (!existing) {
    await M10Record.create({
      docType: txn.docType,
      recordKey: txn.recordKey,
      area: txn.area ?? undefined,
      owners: [txn.owner],
      status,
      lastTxnId: txnId,
      lastChangeType: txn.changeType,
      version: 1,
      history: [historyEntry],
      updatedAt: new Date(),
    });
    return;
  }

  await M10Record.updateOne(
    { _id: existing._id },
    {
      $set: {
        area: txn.area ?? existing.area,
        owners: [txn.owner],
        status,
        lastTxnId: txnId,
        lastChangeType: txn.changeType,
        updatedAt: new Date(),
      },
      $inc: { version: 1 },
      $push: { history: historyEntry },
    }
  );
}

export interface RejectInput {
  source: string;
  docType: DocType;
  rawRow: Record<string, unknown>;
  reason: RejectReason;
}

export async function insertReject(batchId: Types.ObjectId, input: RejectInput) {
  await M10Reject.create({ batchId, ...input, createdAt: new Date() });
}

// ตั้ง geometry ให้ record หลัง join สำเร็จ
export async function setRecordGeometry(
  recordKey: string,
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
) {
  await M10Record.updateOne(
    { recordKey },
    { $set: { geometry, hasGeometry: true, updatedAt: new Date() } }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- repository/index`
Expected: PASS. (First run downloads a Mongo binary — may take a minute; timeout is set to 30s per test.)

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/repository/index.ts lib/m10-ingest/repository/index.test.ts
git commit -m "feat(m10-ingest): repository (idempotent batch/txn, materialize, reject, geometry)"
```

---

## Task 15: `ingest()` orchestrator + integration test

**Files:**
- Create: `lib/m10-ingest/ingest.ts`
- Test: `lib/m10-ingest/ingest.test.ts`

Wires adapters → normalize → repository (txn + record + reject), then geometry join → setRecordGeometry. Computes the batch `fileHash` for idempotency and bails out (no-op) if the batch already exists.

- [ ] **Step 1: Write the failing integration test (idempotency + join + quarantine)**

Create `lib/m10-ingest/ingest.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ingest } from "./ingest";
import { SAMPLE_GEOJSON_24047 } from "./__fixtures__/sampleGeometry";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  const db = mongoose.connection.db;
  if (db) {
    const cols = await db.collections();
    await Promise.all(cols.map((c) => c.deleteMany({})));
  }
});

// parcel: 1 taxRelevant (ขาย, key=...123) + 1 non-relevant (จำนอง, key=...124) + 1 unknown -> reject
const PARCEL_CSV = `สถานะดำเนินการ,วันที่,ราคาประเมิน,UTM1,UTM2,UTM3,UTM4,Scale,เลขที่ดิน,คำนำหน้า,ชื่อ,นามสกุล,เลขบัตรประชาชน,ไร่,งาน,วา,เศษ
ขาย,5/1/2569,฿304000.00,47,P,5239,7,4000,123,นาย,สมชาย,ใจดี,1234567890123,1,2,30,5
จำนอง,6/1/2569,฿-,47,P,5239,7,4000,124,นาย,ก,ข,1234567890124,0,1,0,0
สถานะแปลก,7/1/2569,฿-,47,P,5239,7,4000,125,นาย,ค,ง,1234567890125,0,0,1,0`;

const files = () => ({
  period: "2569-01",
  parcelCsv: PARCEL_CSV,
  geometryGeoJSON: JSON.stringify(SAMPLE_GEOJSON_24047),
});

describe("ingest", () => {
  it("ingests a batch: txns, materialized records, geometry join, quarantine", async () => {
    const res = await ingest(files());
    expect(res.skipped).toBe(false);

    const txns = await mongoose.connection.db!.collection("m10_transactions").countDocuments();
    expect(txns).toBe(2); // ขาย + จำนอง (unknown ไม่นับ — ไป reject)

    const rejects = await mongoose.connection.db!.collection("m10_rejects").countDocuments();
    expect(rejects).toBe(1); // unknown_status

    const records = await mongoose.connection.db!.collection("m10_records").find({}).toArray();
    expect(records).toHaveLength(1); // เฉพาะ taxRelevant (ขาย); จำนองไม่สร้าง record
    expect(records[0].recordKey).toBe("47|P|5239|07|4000|123");
    expect(records[0].hasGeometry).toBe(true); // join สำเร็จ
    expect(records[0].geometry.type).toBe("Polygon");
  });

  it("is idempotent: re-running the same batch is a no-op", async () => {
    await ingest(files());
    const res2 = await ingest(files());
    expect(res2.skipped).toBe(true);

    const txns = await mongoose.connection.db!.collection("m10_transactions").countDocuments();
    expect(txns).toBe(2); // ไม่เพิ่ม
    const batches = await mongoose.connection.db!.collection("m10_import_batches").countDocuments();
    expect(batches).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ingest`
Expected: FAIL — cannot find module `./ingest`.

- [ ] **Step 3: Write the orchestrator**

Create `lib/m10-ingest/ingest.ts`:
```ts
import { createHash } from "node:crypto";
import { parseParcelCsv, parseNs3aCsv, parseConstructionCsv } from "./adapters/csv";
import { parseGeometryGeoJSON } from "./adapters/geometry";
import { normalizeRow } from "./normalize/index";
import { joinGeometry } from "./geometry/join";
import { NormalizeError, type RawRow, type RawGeometry } from "./types";
import {
  findBatchByHash,
  createBatch,
  finishBatch,
  insertTransactionDedup,
  materializeRecord,
  insertReject,
  setRecordGeometry,
} from "./repository/index";

export interface IngestInput {
  period: string; // "2569-01"
  optId?: string;
  optName?: string;
  parcelCsv?: string;
  ns3aCsv?: string;
  constructionCsv?: string;
  geometryGeoJSON?: string;
}

export interface IngestResult {
  skipped: boolean; // true = batch นี้นำเข้าแล้ว (idempotent no-op)
  batchId?: string;
  counts?: { transactions: number; records: number; rejects: number; matchedGeometry: number };
}

function hashFiles(input: IngestInput): string {
  const h = createHash("sha256");
  for (const part of [input.parcelCsv, input.ns3aCsv, input.constructionCsv, input.geometryGeoJSON]) {
    h.update(part ?? "");
    h.update(" ");
  }
  return h.digest("hex");
}

export async function ingest(input: IngestInput): Promise<IngestResult> {
  const fileHash = hashFiles(input);

  // idempotent: ถ้ามี batch hash นี้แล้ว → no-op
  const existing = await findBatchByHash(fileHash);
  if (existing) {
    return { skipped: true, batchId: existing._id.toString() };
  }

  // รวม raw rows จากทุก adapter
  const rawRows: RawRow[] = [
    ...(input.parcelCsv ? parseParcelCsv(input.parcelCsv) : []),
    ...(input.ns3aCsv ? parseNs3aCsv(input.ns3aCsv) : []),
    ...(input.constructionCsv ? parseConstructionCsv(input.constructionCsv) : []),
  ];

  // geometry (fatal ถ้าไฟล์ทั้งไฟล์พัง — ยกเลิก batch)
  let geometries: RawGeometry[] = [];
  const batch = await createBatch({
    fileHash,
    period: input.period,
    optId: input.optId,
    optName: input.optName,
    files: [],
    counts: {},
  });

  try {
    if (input.geometryGeoJSON) {
      geometries = parseGeometryGeoJSON(input.geometryGeoJSON);
    }
  } catch (e) {
    if (e instanceof NormalizeError) {
      await finishBatch(batch._id, "failed");
      throw new Error(`fatal: geometry file invalid (${e.reason})`);
    }
    throw e;
  }

  let txCount = 0;
  let recCount = 0;
  let rejCount = 0;
  const insertedRecordKeys = new Set<string>();

  for (const rawRow of rawRows) {
    const outcome = normalizeRow(rawRow);
    if (!outcome.ok) {
      await insertReject(batch._id, {
        source: rawRow.source,
        docType: rawRow.docType,
        rawRow: rawRow.raw,
        reason: outcome.reason,
      });
      rejCount++;
      continue;
    }
    const { inserted, doc } = await insertTransactionDedup(batch._id, outcome.txn);
    if (inserted) txCount++;
    if (outcome.txn.taxRelevant) {
      await materializeRecord(doc._id, outcome.txn);
      if (!insertedRecordKeys.has(outcome.txn.recordKey)) {
        insertedRecordKeys.add(outcome.txn.recordKey);
        recCount++;
      }
    }
  }

  // geometry join → set บน record ที่มีอยู่
  const joinResult = joinGeometry([...insertedRecordKeys], geometries);
  for (const [recordKey, geometry] of joinResult.matched) {
    await setRecordGeometry(recordKey, geometry);
  }
  for (const bad of joinResult.invalid) {
    await insertReject(batch._id, {
      source: "geometry",
      docType: "PARCEL",
      rawRow: { recordKey: bad.recordKey },
      reason: "geometry_invalid",
    });
    rejCount++;
  }

  await finishBatch(batch._id, "done");

  return {
    skipped: false,
    batchId: batch._id.toString(),
    counts: {
      transactions: txCount,
      records: recCount,
      rejects: rejCount,
      matchedGeometry: joinResult.matched.size,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ingest`
Expected: PASS, 2 tests.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: ALL pass (normalize, adapters, geometry, repository, ingest).

- [ ] **Step 6: Commit**

```bash
git add lib/m10-ingest/ingest.ts lib/m10-ingest/ingest.test.ts
git commit -m "feat(m10-ingest): ingest() orchestrator + idempotency/join integration tests"
```

---

## Task 16: CLI + node script entry (n8n / manual run)

**Files:**
- Create: `lib/m10-ingest/cli.ts`
- Create: `scripts/m10-ingest.js`

CLI reads a directory containing `parcel.csv`, `ns3a.csv`, `construction.csv`, `geometry.geojson` and a `--period`, connects via the project's `lib/dbConnect`, and runs `ingest()`. No new test (it is thin glue over the tested `ingest()`); verified by a manual dry run.

- [ ] **Step 1: Write the CLI module**

Create `lib/m10-ingest/cli.ts`:
```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { ingest, type IngestInput } from "./ingest";

async function readIfExists(path: string): Promise<string | undefined> {
  return existsSync(path) ? readFile(path, "utf8") : undefined;
}

export interface CliArgs {
  dir: string;
  period: string;
  optId?: string;
  optName?: string;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};
  let dir = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      args[a.slice(2)] = argv[++i];
    } else {
      dir = a;
    }
  }
  if (!dir) throw new Error("usage: m10-ingest <dir> --period 2569-01 [--optId X] [--optName Y]");
  if (!args.period) throw new Error("missing --period (e.g. --period 2569-01)");
  return { dir, period: args.period, optId: args.optId, optName: args.optName };
}

export async function runCli(args: CliArgs) {
  const input: IngestInput = {
    period: args.period,
    optId: args.optId,
    optName: args.optName,
    parcelCsv: await readIfExists(join(args.dir, "parcel.csv")),
    ns3aCsv: await readIfExists(join(args.dir, "ns3a.csv")),
    constructionCsv: await readIfExists(join(args.dir, "construction.csv")),
    geometryGeoJSON: await readIfExists(join(args.dir, "geometry.geojson")),
  };
  return ingest(input);
}
```

- [ ] **Step 2: Write the node entry script**

Create `scripts/m10-ingest.js`:
```js
// รัน: node --env-file=.env.local scripts/m10-ingest.js <dir> --period 2569-01
// ใช้ tsx/esbuild ไม่ได้โดยตรงกับ .ts จาก node ล้วน → import ผ่าน next/swc ไม่ available ใน script
// วิธีที่เสถียร: เรียก ingest ผ่าน dynamic import ของไฟล์ที่ compile แล้ว หรือใช้ tsx loader.
const path = require("path");

async function main() {
  // ใช้ tsx เพื่อโหลด TypeScript ได้ตรง ๆ (ติดตั้ง: npm i -D tsx)
  const { parseArgs, runCli } = await import("../lib/m10-ingest/cli.ts");
  const dbConnect = require("../lib/dbConnect");

  const args = parseArgs(process.argv.slice(2));
  await (dbConnect.default || dbConnect)();
  const result = await runCli(args);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Add `tsx` and a convenience npm script**

Run: `npm i -D tsx`

In `package.json` `"scripts"`, add:
```json
    "m10:ingest": "node --env-file=.env.local --import tsx scripts/m10-ingest.js"
```
(`--import tsx` lets the node script load the `.ts` CLI module.)

- [ ] **Step 4: Smoke-check arg parsing (no DB)**

Run: `npx tsx -e "import('./lib/m10-ingest/cli.ts').then(m => console.log(m.parseArgs(['/tmp/batch','--period','2569-01'])))"`
Expected: prints `{ dir: '/tmp/batch', period: '2569-01', optId: undefined, optName: undefined }`.

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/cli.ts scripts/m10-ingest.js package.json package-lock.json
git commit -m "feat(m10-ingest): CLI + node script entry (m10:ingest)"
```

---

## Task 17: Module documentation

**Files:**
- Create: `docs/modules/m10-ingest.md`
- Modify: `docs/modules/README.md` (add to the module index)

- [ ] **Step 1: Write the module doc**

Create `docs/modules/m10-ingest.md`:
```markdown
# โมดูล m10-ingest — นำเข้า/normalize ข้อมูลมาตรา 10

Data layer รับชุดไฟล์รายเดือนจากกรมที่ดิน (parcel/ns3a/construction CSV + geometry GeoJSON)
→ parse → normalize (pure fns) → reproject geometry 24047→4326 → เก็บ canonical store ใน MongoDB
แบบ idempotent พร้อม quarantine ของเสีย

## โครงสร้าง
- `lib/m10-ingest/adapters/` — file format → RawRow/RawGeometry (ไม่มี domain logic)
- `lib/m10-ingest/normalize/` — pure functions: trim, changeType dict, area, owner(+PDPA idHash), ravangKey, date, currency
- `lib/m10-ingest/geometry/` — proj4 reproject (datum shift จริง) + validate/rewind + join ด้วย recordKey
- `lib/m10-ingest/repository/` — ชั้นเดียวที่แตะ MongoDB
- `lib/m10-ingest/ingest.ts` — orchestrator (function API)
- `lib/m10-ingest/cli.ts` + `scripts/m10-ingest.js` — CLI / n8n entry
- `models/m10-ingest/` — M10ImportBatch / M10Transaction / M10Record / M10Reject (collections `m10_*`)

## รัน
```bash
npm test                       # unit + integration (vitest)
npm run m10:ingest <dir> --period 2569-01
# <dir> ต้องมี parcel.csv / ns3a.csv / construction.csv / geometry.geojson (มีไฟล์ไหนใส่ไฟล์นั้น)
```

## หลักการสำคัญ
- **ห้าม drop เงียบ** — normalize/validate ไม่ผ่าน → เข้า `m10_rejects` พร้อม reason เสมอ
- **Idempotent** — `fileHash` ของชุดไฟล์กันนำเข้าซ้ำ; รันไฟล์เดิม = no-op
- **Datum shift บังคับ** — proj4 def Indian 1975 + towgs84; ห้ามใช้ EPSG:32647 แทน (เพี้ยน ~625 ม.)
- **recordKey เดียวทั้งระบบ** — `lib/m10-ingest/normalize/ravang.ts` ใช้ทั้งฝั่ง attribute และ geometry

## Open items (จาก spec)
- ⚠ หน่วย `เศษ` = ส่วนสิบของ ตร.ว. — ต้องยืนยันกับระเบียน LTAX จริง 1 รายการก่อน production
- map ของ ns3a/construction สถานะเต็มชุด (ตอนนี้ unknown → quarantine)
- รอบถัดไป: diff/spatial reconcile, Review UI, worklist→LTAX

Spec: `docs/superpowers/specs/2026-06-21-m10-ingest-normalize-design.md`
```

- [ ] **Step 2: Add to the module index**

In `docs/modules/README.md`, add a row/line for `m10-ingest` in the module list, matching the existing format of that file (open it first to copy the exact row style — e.g. a table row or bullet linking to `m10-ingest.md` with a one-line description).

- [ ] **Step 3: Commit**

```bash
git add docs/modules/m10-ingest.md docs/modules/README.md
git commit -m "docs(m10-ingest): module doc + index entry"
```

---

## Final verification

- [ ] Run the full test suite: `npm test` — expect ALL pass.
- [ ] Type-check: `npx tsc --noEmit` — expect no new errors.
- [ ] Lint: `npm run lint` — expect no new errors in `lib/m10-ingest/**`.
- [ ] Confirm the spec is committed alongside the work: `git status` shows the spec file tracked.

---

## Spec coverage map (self-review)

| Spec section | Task(s) |
|---|---|
| §3 Architecture (adapters/normalize/geometry/repo) | 1, 9, 10, 11–12, 13–14, 15 |
| §4 Data model (4 collections + indexes) | 13 |
| §5 status→changeType dictionary (+ completeness) | 3 |
| §6 Normalize rules (trim/area/owner/ravang/date/currency) | 2, 4, 5, 6, 7, 8, 9 |
| §7 Geometry (datum shift, rewind, validate, join, 2dsphere) | 11, 12, 13 |
| §8 Error handling (quarantine, idempotent, fatal vs warning) | 14, 15 |
| §9 Testing (fixtures, completeness, reproject golden, join, idempotency) | 3, 11, 15 |
| §10 Validated assumptions (datum shift, join key) | 11, 12, 15 |
| §11 Open items (เศษ unit, ns3a/construction maps) | flagged in Task 4 + docs (Task 17) |
| CLI / n8n entry | 16 |

**Out of scope (deferred to next round, correctly absent):** diff/spatial reconcile, Review UI, worklist→LTAX/RPA, LTAX baseline export comparison.
