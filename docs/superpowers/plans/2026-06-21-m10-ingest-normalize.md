# M10 Ingest + Normalize Implementation Plan (rev.2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest กรมที่ดิน มาตรา 10 monthly ZIP batches via an admin upload page, normalize with pure functions, reproject geometry 24047→4326 (real datum shift), store an idempotent canonical store, gate ownership changes behind a human confirm queue, and expose an as-of records viewer.

**Architecture:** `lib/m10-ingest/` in four layers — **adapters** (zip/csv/geojson → `RawRow`/`RawGeometry`, no domain logic), **normalize core** (pure fns, all domain logic, fully unit-tested), **geometry** (proj4 reproject + key join), **repository** (only MongoDB I/O, incl. confirm/apply/as-of). `ingest()` writes **transactions only** (with `reviewStatus`); `records` are materialized later when an officer confirms a transaction. Three Clerk-guarded admin pages: upload, review queue, records (as-of) viewer.

**Tech Stack:** TypeScript (strict), Vitest (new — first test runner), papaparse + formidable (installed), proj4 + @turf/turf + adm-zip + mongodb-memory-server + tsx (new), mongoose (installed).

**Source of truth:** `docs/superpowers/specs/2026-06-21-m10-ingest-normalize-design.md` (rev.2). Read it first — especially §2.1 (real field map), §4.1 (temporal/review), §13 (surfaces).

**Real sample data:** `public/60070001_60010000.zip` (ม.ค. 2569) is committed in the repo — used as an integration fixture. Do NOT delete it.

**Conventions (CLAUDE.md):** module folders `lib/m10-ingest/` + `models/m10-ingest/` + `pages/api/m10-ingest/` + `pages/admin/m10-*`; Mongo env var `MONGO_URI`; mongoose `models.X || model(...)` guard; adding any `/admin/*` page = 4-point permission registration (skill `adding-admin-page`); Thai default for UI/comments/docs.

**Locked decisions:** `lib/m10-ingest/` (not a workspace) · Vitest · geometry from the in-batch GeoJSON (basemap deferred) · upload minimal + synchronous · review queue = plain list at `/admin/m10-review` · as-of = function + API + simple viewer at `/admin/m10-records` · do not store raw ZIP (keep `fileHash` only) · collections `m10_*`, models `M10*`.

---

## File Structure

```
lib/m10-ingest/
  types.ts                       # DocType, ChangeType, ReviewStatus, RejectReason, RawRow, RawGeometry, NormalizedTxn, NormalizeOutcome, NormalizeError
  normalize/
    trim.ts                      # trimAll(row)
    changeType.ts                # STATUS_MAP (+ variants) + classifyStatus()
    review.ts                    # initialReviewStatus(changeType, hasRecordKey)
    area.ts                      # parseArea()
    owner.ts                     # buildOwner(), hashId()
    ravang.ts                    # ravangKey(), parcelRecordKey(), ns3aRecordKey()
    date.ts                      # parseThaiDate()
    currency.ts                  # parseCurrency()
    index.ts                     # normalizeRow() — per-docType column maps
  adapters/
    csv.ts                       # parseCsv() -> RawRow[] (per docType)
    geometry.ts                  # parseGeometryGeoJSON() (unwrap LocationGeospatial) -> RawGeometry[]
    zip.ts                       # extractBatch(buffer) -> { parcelCsv, ns3aCsv, constructionCsv, geometryGeoJSON, optId, optName }
  geometry/
    reproject.ts                 # proj4 def + reprojectPoint()/reprojectGeometry()
    join.ts                      # prepareGeometry() + joinGeometry()
  repository/
    index.ts                     # batches, transactions(dedup+reviewStatus), confirm/reject, applyTxnToRecord, asOfMaterialize, rejects
  ingest.ts                      # ingest() orchestrator -> transactions only
  cli.ts                         # CLI glue
  __fixtures__/
    sampleRows.ts                # real column names + the 21 real statuses + a dirty parcel row

models/m10-ingest/
  M10ImportBatch.js · M10Transaction.js · M10Record.js · M10Reject.js · index.js

pages/api/m10-ingest/
  _auth.js                       # requireM10Admin(req, requiredPage)
  upload.js                      # POST: formidable -> zip -> ingest
  transactions/index.js          # GET: list by reviewStatus
  transactions/[id]/confirm.js   # POST
  transactions/[id]/reject.js    # POST
  records.js                     # GET: as-of materialization

pages/admin/
  m10-ingest.jsx                 # upload UI
  m10-review.jsx                 # confirm queue
  m10-records.jsx                # as-of viewer

scripts/
  m10-ingest.js                  # node CLI entry
  grant-m10-permission.js        # migration: add 3 pages to existing custom allowedPages users

vitest.config.ts
docs/modules/m10-ingest.md
```

---

# PHASE 1 — Data layer (`lib/m10-ingest`)

## Task 1: Scaffold (deps, Vitest, types, fixtures)

**Files:** Modify `package.json`; Create `vitest.config.ts`, `lib/m10-ingest/types.ts`, `lib/m10-ingest/__fixtures__/sampleRows.ts`, `lib/m10-ingest/smoke.test.ts`

- [ ] **Step 1: Install dependencies**

```bash
npm i proj4 @turf/turf adm-zip
npm i -D vitest @types/proj4 @types/papaparse @types/adm-zip mongodb-memory-server tsx
```
Expected: installs succeed. (`papaparse`, `formidable`, `mongoose` already present.)

- [ ] **Step 2: Add scripts to package.json**

In `"scripts"`, after `"lint"`, add:
```json
    "test": "vitest run",
    "test:watch": "vitest",
    "m10:ingest": "node --env-file=.env.local --import tsx scripts/m10-ingest.js"
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/m10-ingest/**/*.test.ts"],
    environment: "node",
    globals: false,
    testTimeout: 60000, // mongodb-memory-server first run downloads a binary
  },
});
```

- [ ] **Step 4: Smoke test + run**

Create `lib/m10-ingest/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("vitest smoke", () => { it("runs", () => { expect(1 + 1).toBe(2); }); });
```
Run: `npm test` → Expected: PASS, 1 test.

- [ ] **Step 5: Create types**

Create `lib/m10-ingest/types.ts`:
```ts
export type DocType = "PARCEL" | "NS3A" | "CONSTRUCTION";

export type ChangeType =
  | "TRANSFER" | "TRANSFER_PARTIAL" | "MERGE" | "NEW" | "SPLIT"
  | "SPLIT_PUBLIC" | "BOUNDARY_CHANGE" | "OWNER_CORRECTION"
  | "ENCUMBRANCE" | "NOTE" | "ADMIN" | "RETIRED";

// pending = รอเจ้าหน้าที่ยืนยัน · confirmed = apply เข้า records แล้ว · rejected = ปฏิเสธ · auto = ไม่ต้องยืนยัน (จำนอง/note/admin/construction)
export type ReviewStatus = "pending" | "confirmed" | "rejected" | "auto";

export type RejectReason =
  | "unknown_status" | "area_parse_failed" | "date_parse_failed"
  | "missing_key" | "geometry_invalid" | "geometry_unmatched";

export class NormalizeError extends Error {
  constructor(public reason: RejectReason, message?: string) {
    super(message ?? reason);
    this.name = "NormalizeError";
  }
}

export interface RawRow {
  docType: DocType;
  source: string;
  raw: Record<string, string>;
}

export interface RawGeometry {
  recordKey: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon; // EPSG:24047
}

export interface Area { rai: number; ngan: number; wa: number; sqm: number; }
export interface Owner { title: string; name: string; surname: string; fullName: string; idHash: string | null; }

export interface NormalizedTxn {
  docType: DocType;
  recordKey: string | null;   // null = materialize ไม่ได้ (เช่น construction)
  deedNo: string | null;      // จาก `โฉนด` — เก็บไว้รอบ reconcile
  rawStatus: string;
  changeType: ChangeType;
  taxRelevant: boolean;
  reviewStatus: ReviewStatus;
  txnDate: string;            // ISO "YYYY-MM-DD"
  regAmount: number | null;
  owner: Owner;
  area: Area | null;
  payloadRaw: Record<string, string>;
}

export type NormalizeOutcome =
  | { ok: true; txn: NormalizedTxn }
  | { ok: false; reason: RejectReason };
```
If `GeoJSON` namespace fails to resolve, run `npm i -D @types/geojson`.

- [ ] **Step 6: Create fixtures (real columns + 21 real statuses)**

Create `lib/m10-ingest/__fixtures__/sampleRows.ts`:
```ts
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
  "โฉนด": "31635",
  "UTM_MAP1": "5039",
  "UTM_MAP2": "2",
  "UTM_MAP3": "4682",
  "UTM_MAP4": "7",            // ไม่ pad → ต้องเป็น "07"
  "UTM_SCALE": "1000",
  "ที่ดิน": "84",
  "ไร่": "0", "งาน": "2", "วา": "24", "เศษ": "0",
  "คำนำหน้า": "นางสาว", "ชื่อ": "วรารีย์", "นามสกุล": "ชาลีรัตน์",
  "13 หลัก": "1 6097 00018 24 8",
  "สถานะดำเนินการ ": "ขาย ", // trailing space ในคีย์และค่า
  "วันที่": "5/1/2569",
  " REG_AMT ": " ฿304,000.00 ",
};
```

- [ ] **Step 7: Run tests, delete smoke test, commit**

Run: `npm test` → PASS. Delete `lib/m10-ingest/smoke.test.ts`.
```bash
git add package.json package-lock.json vitest.config.ts lib/m10-ingest/types.ts lib/m10-ingest/__fixtures__/sampleRows.ts
git commit -m "chore(m10-ingest): scaffold vitest + deps, types, real-data fixtures"
```

---

## Task 2: `trimAll`

**Files:** Create `lib/m10-ingest/normalize/trim.ts` + `trim.test.ts`

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from "vitest";
import { trimAll } from "./trim";

describe("trimAll", () => {
  it("strips keys and values", () => {
    expect(trimAll({ "สถานะดำเนินการ ": "ขาย ", " REG_AMT ": " ฿- " }))
      .toEqual({ "สถานะดำเนินการ": "ขาย", "REG_AMT": "฿-" });
  });
  it("coerces non-strings", () => {
    expect(trimAll({ a: 5 as unknown as string, b: null as unknown as string })).toEqual({ a: "5", b: "" });
  });
});
```
- [ ] **Step 2: Run** `npm test -- trim` → FAIL (no module).
- [ ] **Step 3: Implement** `lib/m10-ingest/normalize/trim.ts`:
```ts
export function trimAll(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    out[String(key).trim()] = value == null ? "" : String(value).trim();
  }
  return out;
}
```
- [ ] **Step 4: Run** `npm test -- trim` → PASS.
- [ ] **Step 5: Commit** `git add lib/m10-ingest/normalize/trim.* && git commit -m "feat(m10-ingest): trimAll"`

---

## Task 3: `classifyStatus` + dictionary (with variants) + completeness

**Files:** Create `lib/m10-ingest/normalize/changeType.ts` + `changeType.test.ts`

- [ ] **Step 1: Failing test (completeness driven by real statuses)**
```ts
import { describe, it, expect } from "vitest";
import { classifyStatus } from "./changeType";
import { REAL_PARCEL_STATUSES, NS3A_EXTRA_STATUSES } from "../__fixtures__/sampleRows";

describe("classifyStatus", () => {
  it("maps a known status", () => {
    expect(classifyStatus("ขาย")).toEqual({ changeType: "TRANSFER", taxRelevant: true });
  });
  it("maps the real 'ครั้งที่หนึ่ง' variant", () => {
    expect(classifyStatus("ขึ้นเงินจากจำนอง ครั้งที่หนึ่ง"))
      .toEqual({ changeType: "ENCUMBRANCE", taxRelevant: false });
  });
  it("returns null for unknown (caller quarantines)", () => {
    expect(classifyStatus("สถานะที่ไม่เคยเห็น")).toBeNull();
  });
  it.each([...REAL_PARCEL_STATUSES, ...NS3A_EXTRA_STATUSES])(
    "maps real status %s", ({ status, changeType, taxRelevant }) => {
      expect(classifyStatus(status)).toEqual({ changeType, taxRelevant });
    });
});
```
- [ ] **Step 2: Run** `npm test -- changeType` → FAIL.
- [ ] **Step 3: Implement** `lib/m10-ingest/normalize/changeType.ts`:
```ts
import type { ChangeType } from "../types";

interface Classification { changeType: ChangeType; taxRelevant: boolean; }

export const STATUS_MAP: Record<string, Classification> = {
  "ขาย": { changeType: "TRANSFER", taxRelevant: true },
  "ขายตามคำสั่งศาล": { changeType: "TRANSFER", taxRelevant: true },
  "โอนมรดก": { changeType: "TRANSFER", taxRelevant: true },
  "ให้": { changeType: "TRANSFER", taxRelevant: true },
  "ให้เฉพาะส่วน (ระหว่างภาระจำยอม)": { changeType: "TRANSFER_PARTIAL", taxRelevant: true },
  "ไถ่ถอนจากจำนอง รวมสองโฉนด": { changeType: "MERGE", taxRelevant: true },
  "ลงชื่อคู่สมรส รวมสองโฉนด": { changeType: "MERGE", taxRelevant: true },
  "ให้ รวมสองโฉนด": { changeType: "MERGE", taxRelevant: true },
  "เอกสารสิทธิที่เกิดใหม่ - ปรับปรุง ระหว่างเดือน": { changeType: "NEW", taxRelevant: true },
  "แบ่งแยกในนามเดิม": { changeType: "SPLIT", taxRelevant: true },
  "แบ่งหักเป็นที่สาธารณประโยชน์": { changeType: "SPLIT_PUBLIC", taxRelevant: true },
  "สอบเขตโฉนดที่ดิน": { changeType: "BOUNDARY_CHANGE", taxRelevant: true },
  "แก้ชื่อ (ราชการให้เปลี่ยนชื่อ)": { changeType: "OWNER_CORRECTION", taxRelevant: true },
  "จำนอง": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "ไถ่ถอนจากจำนอง": { changeType: "ENCUMBRANCE", taxRelevant: false },
  // variants ที่เจอจริง — เพิ่มแบบ explicit (ไม่ใช้ regex เดา)
  "ขึ้นเงินจากจำนอง": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "ขึ้นเงินจากจำนอง ครั้งที่หนึ่ง": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "ขึ้นเงินจากจำนอง ครั้งที่สอง": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "ขึ้นเงินจากจำนอง ครั้งที่สาม": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "จำนองเพิ่มหลักทรัพย์": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "จำนองลำดับที่สอง": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "ระงับจำนอง (ศาลขายบังคับจำนอง)": { changeType: "ENCUMBRANCE", taxRelevant: false },
  "หมายเหตุสารบัญ": { changeType: "NOTE", taxRelevant: false },
  "ใบแทน": { changeType: "ADMIN", taxRelevant: false },
  "เอกสารสิทธิที่ยกเลิกระหว่างเดือน": { changeType: "RETIRED", taxRelevant: true },
};

// ไม่เจอ → null → caller quarantine (reason="unknown_status") ห้ามเดา
export function classifyStatus(status: string): Classification | null {
  return STATUS_MAP[status.trim()] ?? null;
}
```
- [ ] **Step 4: Run** `npm test -- changeType` → PASS (3 + 22 parameterized).
- [ ] **Step 5: Commit** `git add lib/m10-ingest/normalize/changeType.* && git commit -m "feat(m10-ingest): status dictionary + variants + completeness test"`

---

## Task 4: `initialReviewStatus`

**Files:** Create `lib/m10-ingest/normalize/review.ts` + `review.test.ts`

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from "vitest";
import { initialReviewStatus } from "./review";

describe("initialReviewStatus", () => {
  it("ownership/area-affecting with a recordKey -> pending", () => {
    expect(initialReviewStatus("TRANSFER", true)).toBe("pending");
    expect(initialReviewStatus("SPLIT", true)).toBe("pending");
    expect(initialReviewStatus("RETIRED", true)).toBe("pending");
  });
  it("encumbrance/note/admin -> auto", () => {
    expect(initialReviewStatus("ENCUMBRANCE", true)).toBe("auto");
    expect(initialReviewStatus("NOTE", true)).toBe("auto");
    expect(initialReviewStatus("ADMIN", true)).toBe("auto");
  });
  it("no recordKey (e.g. construction) -> auto even if tax-relevant", () => {
    expect(initialReviewStatus("TRANSFER", false)).toBe("auto");
  });
});
```
- [ ] **Step 2: Run** `npm test -- review` → FAIL.
- [ ] **Step 3: Implement** `lib/m10-ingest/normalize/review.ts`:
```ts
import type { ChangeType, ReviewStatus } from "../types";

const AUTO_TYPES = new Set<ChangeType>(["ENCUMBRANCE", "NOTE", "ADMIN"]);

// ownership/เนื้อที่ที่มี recordKey → pending (ต้องคนยืนยัน); ที่เหลือ → auto (§4.1)
export function initialReviewStatus(changeType: ChangeType, hasRecordKey: boolean): ReviewStatus {
  if (!hasRecordKey) return "auto";
  if (AUTO_TYPES.has(changeType)) return "auto";
  return "pending";
}
```
- [ ] **Step 4: Run** `npm test -- review` → PASS.
- [ ] **Step 5: Commit** `git add lib/m10-ingest/normalize/review.* && git commit -m "feat(m10-ingest): initialReviewStatus"`

---

## Task 5: `parseArea`

**Files:** Create `lib/m10-ingest/normalize/area.ts` + `area.test.ts`

> ⚠ ASSUMPTION (spec §6/§11): `เศษ` = ส่วนสิบของ ตร.ว. → `sqm = (rai*400 + ngan*100 + wa + sub/10) * 4`. ยืนยันกับ LTAX 1 รายการก่อน production.

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from "vitest";
import { parseArea } from "./area";
import { NormalizeError } from "../types";

describe("parseArea", () => {
  it("row0 of real data: 0 ไร่ 2 งาน 24 วา 0 เศษ = 896 sqm", () => {
    expect(parseArea("0", "2", "24", "0")).toEqual({ rai: 0, ngan: 2, wa: 24, sqm: 896 });
  });
  it("handles tenths in เศษ", () => {
    expect(parseArea("1", "2", "30", "5").sqm).toBe((400 + 200 + 30 + 0.5) * 4);
  });
  it("empty parts -> zero", () => {
    expect(parseArea("0", "", "", "")).toEqual({ rai: 0, ngan: 0, wa: 0, sqm: 0 });
  });
  it("throws area_parse_failed on non-numeric", () => {
    try { parseArea("หนึ่ง", "0", "0", "0"); throw new Error("no throw"); }
    catch (e) { expect((e as NormalizeError).reason).toBe("area_parse_failed"); }
  });
});
```
- [ ] **Step 2: Run** `npm test -- normalize/area` → FAIL.
- [ ] **Step 3: Implement** `lib/m10-ingest/normalize/area.ts`:
```ts
import { type Area, NormalizeError } from "../types";

function num(part: string, field: string): number {
  const t = part.trim();
  if (t === "") return 0;
  const n = Number(t);
  if (!Number.isFinite(n)) throw new NormalizeError("area_parse_failed", `${field}="${part}"`);
  return n;
}

export function parseArea(rai: string, ngan: string, wa: string, sub: string): Area {
  const r = num(rai, "rai"), ng = num(ngan, "ngan"), w = num(wa, "wa"), s = num(sub, "sub");
  const waWithSub = w + s / 10;
  return { rai: r, ngan: ng, wa: waWithSub, sqm: (r * 400 + ng * 100 + waWithSub) * 4 };
}
```
- [ ] **Step 4: Run** `npm test -- normalize/area` → PASS.
- [ ] **Step 5: Commit** `git add lib/m10-ingest/normalize/area.* && git commit -m "feat(m10-ingest): parseArea"`

---

## Task 6: `buildOwner` + `hashId`

**Files:** Create `lib/m10-ingest/normalize/owner.ts` + `owner.test.ts`

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { buildOwner, hashId } from "./owner";

describe("hashId", () => {
  it("hashes digits-only of '13 หลัก' incl. spaces", () => {
    expect(hashId("1 6097 00018 24 8")).toBe(createHash("sha256").update("1609700018248").digest("hex"));
  });
  it("null when no digits", () => { expect(hashId("")).toBeNull(); });
});
describe("buildOwner", () => {
  it("builds trimmed fullName + idHash", () => {
    const o = buildOwner({ title: "นางสาว", name: "วรารีย์", surname: "ชาลีรัตน์", id: "1 6097 00018 24 8" });
    expect(o.fullName).toBe("นางสาว วรารีย์ ชาลีรัตน์");
    expect(o.idHash).toBe(createHash("sha256").update("1609700018248").digest("hex"));
  });
  it("no stray spaces when parts missing", () => {
    expect(buildOwner({ title: "", name: "สมหญิง", surname: "", id: "" }).fullName).toBe("สมหญิง");
  });
});
```
- [ ] **Step 2: Run** `npm test -- owner` → FAIL.
- [ ] **Step 3: Implement** `lib/m10-ingest/normalize/owner.ts`:
```ts
import { createHash } from "node:crypto";
import type { Owner } from "../types";

export function hashId(rawId: string): string | null {
  const digits = (rawId ?? "").replace(/\D/g, "");
  return digits === "" ? null : createHash("sha256").update(digits).digest("hex");
}

export function buildOwner(input: { title: string; name: string; surname: string; id: string }): Owner {
  const title = input.title.trim(), name = input.name.trim(), surname = input.surname.trim();
  return { title, name, surname, fullName: [title, name, surname].filter(Boolean).join(" "), idHash: hashId(input.id) };
}
```
- [ ] **Step 4: Run** `npm test -- owner` → PASS.
- [ ] **Step 5: Commit** `git add lib/m10-ingest/normalize/owner.* && git commit -m "feat(m10-ingest): owner + PDPA idHash"`

---

## Task 7: `ravangKey` / `parcelRecordKey` / `ns3aRecordKey`

**Files:** Create `lib/m10-ingest/normalize/ravang.ts` + `ravang.test.ts`

> `parcelRecordKey` is used by BOTH the parcel CSV and the geometry adapter — one source of truth (verified 59/59).

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from "vitest";
import { ravangKey, parcelRecordKey, ns3aRecordKey } from "./ravang";

describe("ravangKey", () => {
  it("zero-pads UTM4 to 2, joins with |, coerces numbers", () => {
    expect(ravangKey({ utm1: "5039", utm2: 2 as unknown as string, utm3: "4682", utm4: "7", scale: 1000 as unknown as string }))
      .toBe("5039|2|4682|07|1000");
  });
});
describe("parcelRecordKey", () => {
  it("appends land number", () => {
    expect(parcelRecordKey({ utm1: "5039", utm2: "2", utm3: "4682", utm4: "7", scale: "1000" }, "84"))
      .toBe("5039|2|4682|07|1000|84");
  });
});
describe("ns3aRecordKey", () => {
  it("uses a distinct NS3A-prefixed shape (3 air-map parts)", () => {
    expect(ns3aRecordKey({ a1: "12", a2: "34", a3: "56", scale: "4000" }, "9"))
      .toBe("NS3A|12|34|56|4000|9");
  });
});
```
- [ ] **Step 2: Run** `npm test -- ravang` → FAIL.
- [ ] **Step 3: Implement** `lib/m10-ingest/normalize/ravang.ts`:
```ts
const S = (v: unknown) => String(v ?? "").trim();

export interface RavangParts { utm1: string; utm2: string; utm3: string; utm4: string; scale: string; }

export function ravangKey(p: RavangParts): string {
  return [S(p.utm1), S(p.utm2), S(p.utm3), S(p.utm4).padStart(2, "0"), S(p.scale)].join("|");
}
export function parcelRecordKey(p: RavangParts, landNumber: string): string {
  return `${ravangKey(p)}|${S(landNumber)}`;
}
// ns3a มี air-map 3 ส่วน (ไม่มี geometry ให้ join) → คีย์รูปแบบเฉพาะ ป้องกันชนกับ parcel
export function ns3aRecordKey(p: { a1: string; a2: string; a3: string; scale: string }, landNumber: string): string {
  return ["NS3A", S(p.a1), S(p.a2), S(p.a3), S(p.scale), S(landNumber)].join("|");
}
```
- [ ] **Step 4: Run** `npm test -- ravang` → PASS.
- [ ] **Step 5: Commit** `git add lib/m10-ingest/normalize/ravang.* && git commit -m "feat(m10-ingest): ravang/record keys (shared parcel+geometry)"`

---

## Task 8: `parseThaiDate`

**Files:** Create `lib/m10-ingest/normalize/date.ts` + `date.test.ts`

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from "vitest";
import { parseThaiDate } from "./date";
import { NormalizeError } from "../types";

describe("parseThaiDate", () => {
  it("non-padded d/m/yyyy Buddhist -> ISO", () => { expect(parseThaiDate("5/1/2569")).toBe("2026-01-05"); });
  it("padded too", () => { expect(parseThaiDate("05/01/2569")).toBe("2026-01-05"); });
  it("throws on garbage", () => {
    try { parseThaiDate("ไม่ใช่วันที่"); throw new Error("no throw"); }
    catch (e) { expect((e as NormalizeError).reason).toBe("date_parse_failed"); }
  });
  it("throws on impossible month", () => { expect(() => parseThaiDate("5/13/2569")).toThrow(NormalizeError); });
});
```
- [ ] **Step 2: Run** `npm test -- normalize/date` → FAIL.
- [ ] **Step 3: Implement** `lib/m10-ingest/normalize/date.ts`:
```ts
import { NormalizeError } from "../types";

export function parseThaiDate(input: string): string {
  const m = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) throw new NormalizeError("date_parse_failed", `bad date: "${input}"`);
  const day = Number(m[1]), month = Number(m[2]), yearCE = Number(m[3]) - 543;
  if (month < 1 || month > 12 || day < 1 || day > 31 || yearCE < 1900)
    throw new NormalizeError("date_parse_failed", `out-of-range: "${input}"`);
  const d = new Date(Date.UTC(yearCE, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day)
    throw new NormalizeError("date_parse_failed", `invalid calendar date: "${input}"`);
  return `${yearCE}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
```
- [ ] **Step 4: Run** `npm test -- normalize/date` → PASS.
- [ ] **Step 5: Commit** `git add lib/m10-ingest/normalize/date.* && git commit -m "feat(m10-ingest): parseThaiDate"`

---

## Task 9: `parseCurrency`

**Files:** Create `lib/m10-ingest/normalize/currency.ts` + `currency.test.ts`

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from "vitest";
import { parseCurrency } from "./currency";

describe("parseCurrency", () => {
  it("parses baht with separators", () => {
    expect(parseCurrency("฿304,000.00")).toBe(304000);
    expect(parseCurrency(" ฿1,234.50 ")).toBe(1234.5);
  });
  it("dash/empty -> null (real value is ' ฿-   ')", () => {
    expect(parseCurrency(" ฿-   ")).toBeNull();
    expect(parseCurrency("")).toBeNull();
  });
  it("junk -> null", () => { expect(parseCurrency("฿abc")).toBeNull(); });
});
```
- [ ] **Step 2: Run** `npm test -- currency` → FAIL.
- [ ] **Step 3: Implement** `lib/m10-ingest/normalize/currency.ts`:
```ts
export function parseCurrency(input: string): number | null {
  const cleaned = (input ?? "").replace(/[฿,\s]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
```
- [ ] **Step 4: Run** `npm test -- currency` → PASS.
- [ ] **Step 5: Commit** `git add lib/m10-ingest/normalize/currency.* && git commit -m "feat(m10-ingest): parseCurrency"`

---

## Task 10: `normalizeRow` (per-docType column maps)

**Files:** Create `lib/m10-ingest/normalize/index.ts` + `index.test.ts`

Ties pure fns together; picks a column map by `docType`; never throws (returns `{ok:false, reason}`).

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from "vitest";
import { normalizeRow } from "./index";
import { DIRTY_PARCEL_ROW } from "../__fixtures__/sampleRows";
import type { RawRow } from "../types";

const parcel: RawRow = { docType: "PARCEL", source: "parcel.csv", raw: DIRTY_PARCEL_ROW };

describe("normalizeRow PARCEL", () => {
  it("normalizes a dirty parcel row end-to-end", () => {
    const out = normalizeRow(parcel);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.txn.changeType).toBe("TRANSFER");
    expect(out.txn.taxRelevant).toBe(true);
    expect(out.txn.reviewStatus).toBe("pending");
    expect(out.txn.rawStatus).toBe("ขาย");
    expect(out.txn.txnDate).toBe("2026-01-05");
    expect(out.txn.regAmount).toBe(304000);
    expect(out.txn.recordKey).toBe("5039|2|4682|07|1000|84");
    expect(out.txn.deedNo).toBe("31635");
    expect(out.txn.owner.fullName).toBe("นางสาว วรารีย์ ชาลีรัตน์");
    expect(out.txn.area?.sqm).toBe(896);
    expect(out.txn.payloadRaw["สถานะดำเนินการ"]).toBe("ขาย");
  });
  it("encumbrance -> reviewStatus auto", () => {
    const raw: RawRow = { docType: "PARCEL", source: "parcel.csv", raw: { ...DIRTY_PARCEL_ROW, "สถานะดำเนินการ ": "จำนอง" } };
    const out = normalizeRow(raw);
    expect(out.ok && out.txn.reviewStatus).toBe("auto");
  });
  it("quarantines unknown status", () => {
    const raw: RawRow = { docType: "PARCEL", source: "parcel.csv", raw: { ...DIRTY_PARCEL_ROW, "สถานะดำเนินการ ": "แปลกๆ" } };
    expect(normalizeRow(raw)).toEqual({ ok: false, reason: "unknown_status" });
  });
});

describe("normalizeRow CONSTRUCTION", () => {
  it("has null recordKey -> reviewStatus auto", () => {
    const raw: RawRow = { docType: "CONSTRUCTION", source: "construction.csv",
      raw: { "สถานะ": "ขาย", "วันที่": "5/1/2569", "REG_AMT": "฿-", "คำนำหน้า": "นาย", "ชื่อ": "ก", "นามสกุล": "ข", "13 หลัก": "1234567890123" } };
    const out = normalizeRow(raw);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.txn.recordKey).toBeNull();
    expect(out.txn.reviewStatus).toBe("auto");
  });
});
```
- [ ] **Step 2: Run** `npm test -- normalize/index` → FAIL.
- [ ] **Step 3: Implement** `lib/m10-ingest/normalize/index.ts`:
```ts
import { type NormalizeOutcome, type RawRow, type DocType, NormalizeError } from "../types";
import { trimAll } from "./trim";
import { classifyStatus } from "./changeType";
import { initialReviewStatus } from "./review";
import { parseArea } from "./area";
import { buildOwner } from "./owner";
import { parcelRecordKey, ns3aRecordKey } from "./ravang";
import { parseThaiDate } from "./date";
import { parseCurrency } from "./currency";

// ชื่อคอลัมน์ (หลัง trim) ต่อ docType — จาก spec §2.1
const MAP: Record<DocType, {
  status: string; date: string; amount: string; deed?: string;
  title: string; name: string; surname: string; id: string;
  rai?: string; ngan?: string; wa?: string; sub?: string;
}> = {
  PARCEL: { status: "สถานะดำเนินการ", date: "วันที่", amount: "REG_AMT", deed: "โฉนด",
    title: "คำนำหน้า", name: "ชื่อ", surname: "นามสกุล", id: "13 หลัก",
    rai: "ไร่", ngan: "งาน", wa: "วา", sub: "เศษ" },
  NS3A: { status: "สถานะ", date: "วันที่", amount: "REG_AMT", deed: "เลขที่นส3ก",
    title: "คำนำหน้า", name: "ชื่อ", surname: "นามสกุล", id: "OWN_PERS_ID",
    rai: "ไร่", ngan: "งาน", wa: "วา", sub: "เศษ" },
  CONSTRUCTION: { status: "สถานะ", date: "วันที่", amount: "REG_AMT",
    title: "คำนำหน้า", name: "ชื่อ", surname: "นามสกุล", id: "13 หลัก" },
};

function buildRecordKey(docType: DocType, raw: Record<string, string>): string | null {
  const g = (k: string) => raw[k] ?? "";
  if (docType === "PARCEL") {
    return parcelRecordKey(
      { utm1: g("UTM_MAP1"), utm2: g("UTM_MAP2"), utm3: g("UTM_MAP3"), utm4: g("UTM_MAP4"), scale: g("UTM_SCALE") },
      g("ที่ดิน"));
  }
  if (docType === "NS3A") {
    return ns3aRecordKey({ a1: g("UTM_AIRMAP1"), a2: g("UTM_AIRMAP2"), a3: g("UTM_AIRMAP3"), scale: g("UTM_SCALE") }, g("ล.ที่ดิน"));
  }
  return null; // CONSTRUCTION: ไม่มี key แปลง
}

export function normalizeRow(rawRow: RawRow): NormalizeOutcome {
  const raw = trimAll(rawRow.raw);
  const m = MAP[rawRow.docType];
  const g = (k: string) => raw[k] ?? "";
  try {
    const rawStatus = g(m.status);
    const cls = classifyStatus(rawStatus);
    if (!cls) throw new NormalizeError("unknown_status", rawStatus);

    const recordKey = buildRecordKey(rawRow.docType, raw);
    const txnDate = parseThaiDate(g(m.date));
    const regAmount = parseCurrency(g(m.amount));
    const area = m.rai && (raw[m.rai] !== undefined || raw[m.ngan!] !== undefined)
      ? parseArea(g(m.rai), g(m.ngan!), g(m.wa!), g(m.sub!)) : null;
    const owner = buildOwner({ title: g(m.title), name: g(m.name), surname: g(m.surname), id: g(m.id) });

    return {
      ok: true,
      txn: {
        docType: rawRow.docType,
        recordKey,
        deedNo: m.deed ? (g(m.deed) || null) : null,
        rawStatus,
        changeType: cls.changeType,
        taxRelevant: cls.taxRelevant,
        reviewStatus: initialReviewStatus(cls.changeType, recordKey !== null),
        txnDate, regAmount, owner, area, payloadRaw: raw,
      },
    };
  } catch (e) {
    if (e instanceof NormalizeError) return { ok: false, reason: e.reason };
    throw e;
  }
}
```
- [ ] **Step 4: Run** `npm test -- normalize/index` → PASS.
- [ ] **Step 5: Commit** `git add lib/m10-ingest/normalize/index.* && git commit -m "feat(m10-ingest): normalizeRow per-docType maps + reviewStatus"`

---

## Task 11: CSV adapter

**Files:** Create `lib/m10-ingest/adapters/csv.ts` + `csv.test.ts`

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from "vitest";
import { parseCsv } from "./csv";

const CSV = `สถานะดำเนินการ,ที่ดิน,UTM_MAP4
ขาย,84,7
จำนอง,85,8
`;

describe("parseCsv", () => {
  it("one RawRow per data row with docType+source", () => {
    const rows = parseCsv(CSV, "PARCEL", "parcel.csv");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ docType: "PARCEL", source: "parcel.csv",
      raw: { "สถานะดำเนินการ": "ขาย", "ที่ดิน": "84", "UTM_MAP4": "7" } });
  });
  it("skips blank trailing rows", () => { expect(parseCsv(CSV + "\n\n", "PARCEL", "p.csv")).toHaveLength(2); });
});
```
- [ ] **Step 2: Run** `npm test -- adapters/csv` → FAIL.
- [ ] **Step 3: Implement** `lib/m10-ingest/adapters/csv.ts`:
```ts
import Papa from "papaparse";
import type { DocType, RawRow } from "../types";

export function parseCsv(content: string, docType: DocType, source: string): RawRow[] {
  const result = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: "greedy" });
  return result.data
    .filter((row) => row && Object.keys(row).length > 0)
    .map((raw) => ({ docType, source, raw }));
}
```
- [ ] **Step 4: Run** `npm test -- adapters/csv` → PASS.
- [ ] **Step 5: Commit** `git add lib/m10-ingest/adapters/csv.* && git commit -m "feat(m10-ingest): CSV adapter"`

---

## Task 12: Geometry adapter (unwrap `LocationGeospatial`)

**Files:** Create `lib/m10-ingest/adapters/geometry.ts` + `geometry.test.ts`

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from "vitest";
import { parseGeometryGeoJSON } from "./geometry";

const WRAPPED = JSON.stringify({
  LocationGeospatial: {
    crs: { type: "name", properties: { name: "EPSG:24047" } },
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { LandUTM1: "5039", LandUTM2: 2, LandUTM3: "4682", LandUTM4: "07", LandUTMScale: 1000, LandNumber: "58" },
      geometry: { type: "Polygon", coordinates: [[[647023.24, 1683144.48], [647011.6, 1683134.9], [647058.7, 1683084.2], [647023.24, 1683144.48]]] },
    }],
  },
});

describe("parseGeometryGeoJSON", () => {
  it("unwraps LocationGeospatial and keys by parcelRecordKey (numbers coerced)", () => {
    const out = parseGeometryGeoJSON(WRAPPED);
    expect(out).toHaveLength(1);
    expect(out[0].recordKey).toBe("5039|2|4682|07|1000|58");
    expect(out[0].geometry.type).toBe("Polygon");
  });
  it("throws geometry_invalid for non-JSON / missing FeatureCollection", () => {
    expect(() => parseGeometryGeoJSON("{}")).toThrowError();
  });
});
```
- [ ] **Step 2: Run** `npm test -- adapters/geometry` → FAIL.
- [ ] **Step 3: Implement** `lib/m10-ingest/adapters/geometry.ts`:
```ts
import { type RawGeometry, NormalizeError } from "../types";
import { parcelRecordKey } from "../normalize/ravang";

export function parseGeometryGeoJSON(content: string): RawGeometry[] {
  let parsed: any;
  try { parsed = JSON.parse(content); }
  catch { throw new NormalizeError("geometry_invalid", "not valid JSON"); }
  // ไฟล์จริงห่อใน LocationGeospatial; เผื่อกรณี FeatureCollection ตรง ๆ ด้วย
  const fc = parsed?.LocationGeospatial ?? parsed;
  if (!fc || fc.type !== "FeatureCollection" || !Array.isArray(fc.features))
    throw new NormalizeError("geometry_invalid", "expected a FeatureCollection");
  return fc.features.map((f: any) => {
    const p = f.properties ?? {};
    const recordKey = parcelRecordKey(
      { utm1: p.LandUTM1, utm2: p.LandUTM2, utm3: p.LandUTM3, utm4: p.LandUTM4, scale: p.LandUTMScale },
      String(p.LandNumber ?? ""));
    return { recordKey, geometry: f.geometry };
  });
}
```
- [ ] **Step 4: Run** `npm test -- adapters/geometry` → PASS.
- [ ] **Step 5: Commit** `git add lib/m10-ingest/adapters/geometry.* && git commit -m "feat(m10-ingest): geometry adapter (unwrap LocationGeospatial)"`

---

## Task 13: ZIP adapter (`adm-zip` + glob)

**Files:** Create `lib/m10-ingest/adapters/zip.ts` + `zip.test.ts`

- [ ] **Step 1: Failing test (uses the real committed ZIP)**
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractBatch } from "./zip";

const ZIP = readFileSync(join(process.cwd(), "public/60070001_60010000.zip"));

describe("extractBatch", () => {
  it("finds the 4 inputs by glob and reads optId/optName from geometry", () => {
    const b = extractBatch(ZIP);
    expect(b.parcelCsv).toContain("สถานะดำเนินการ");
    expect(b.ns3aCsv).toContain("เลขที่นส3ก");
    expect(b.constructionCsv).toContain("ประเภทสิ่งปลูกสร้าง");
    expect(b.geometryGeoJSON).toContain("LocationGeospatial");
    expect(b.optId).toBe("4600701");
    expect(b.optName).toContain("ตาคลี");
  });
  it("ignores junk (shapefile parts, pdf, _ogr_tmp)", () => {
    const b = extractBatch(ZIP);
    expect(b.parcelCsv).not.toContain("ogr_tmp");
  });
});
```
- [ ] **Step 2: Run** `npm test -- adapters/zip` → FAIL.
- [ ] **Step 3: Implement** `lib/m10-ingest/adapters/zip.ts`:
```ts
import AdmZip from "adm-zip";

export interface ExtractedBatch {
  parcelCsv?: string;
  ns3aCsv?: string;
  constructionCsv?: string;
  geometryGeoJSON?: string;
  optId?: string;
  optName?: string;
  fileNames: string[];
}

// หาไฟล์ด้วย pattern (ชื่อ optId เปลี่ยนทุกเดือน) — ข้าม _ogr_tmp / shapefile / pdf
function findEntry(zip: AdmZip, test: (name: string) => boolean): string | undefined {
  const e = zip.getEntries().find((x) => !x.isDirectory && test(x.entryName.split("/").pop() || ""));
  return e ? e.getData().toString("utf8") : undefined;
}

export function extractBatch(buffer: Buffer): ExtractedBatch {
  const zip = new AdmZip(buffer);
  const base = (n: string) => /^parcel_.*\.csv$/i.test(n) && !/ogr_tmp/i.test(n);
  const parcelCsv = findEntry(zip, base);
  const ns3aCsv = findEntry(zip, (n) => /^ns3a_.*\.csv$/i.test(n));
  const constructionCsv = findEntry(zip, (n) => /^construction_.*\.csv$/i.test(n));
  const geometryGeoJSON = findEntry(zip, (n) => /_MAP_LAND_GIS_.*\.geojson$/i.test(n));

  let optId: string | undefined, optName: string | undefined;
  if (geometryGeoJSON) {
    try {
      const fc = JSON.parse(geometryGeoJSON).LocationGeospatial;
      const p = fc?.features?.[0]?.properties ?? {};
      optId = p.OptID ? String(p.OptID) : undefined;
      optName = p.OptName ? String(p.OptName) : undefined;
    } catch { /* ปล่อยให้ ingest จัดการ geometry เสียทีหลัง */ }
  }
  return {
    parcelCsv, ns3aCsv, constructionCsv, geometryGeoJSON, optId, optName,
    fileNames: zip.getEntries().map((e) => e.entryName),
  };
}
```
- [ ] **Step 4: Run** `npm test -- adapters/zip` → PASS.
- [ ] **Step 5: Commit** `git add lib/m10-ingest/adapters/zip.* && git commit -m "feat(m10-ingest): ZIP adapter (adm-zip + glob)"`

---

## Task 14: Geometry reproject (proj4) + golden test

**Files:** Create `lib/m10-ingest/geometry/reproject.ts` + `reproject.test.ts`

> Datum shift mandatory (spec §7): skipping = ~625 m error. Golden: E=647023, N=1683144 → ตาคลี.

- [ ] **Step 1: Failing golden test**
```ts
import { describe, it, expect } from "vitest";
import { reprojectPoint, reprojectGeometry } from "./reproject";

describe("reprojectPoint (24047 -> 4326)", () => {
  it("golden point lands in Takhli", () => {
    const [lon, lat] = reprojectPoint([647023, 1683144]);
    expect(lat).toBeGreaterThanOrEqual(15.2);
    expect(lat).toBeLessThanOrEqual(15.25);
    expect(lon).toBeGreaterThanOrEqual(100.36);
    expect(lon).toBeLessThanOrEqual(100.37);
  });
});
describe("reprojectGeometry", () => {
  it("reprojects every coordinate, ring stays closed", () => {
    const out = reprojectGeometry({ type: "Polygon",
      coordinates: [[[647023, 1683144], [647073, 1683144], [647073, 1683194], [647023, 1683144]]] });
    const ring = (out.coordinates as number[][][])[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(ring[0][0]).toBeGreaterThan(100);
    expect(ring[0][1]).toBeGreaterThan(15);
  });
});
```
- [ ] **Step 2: Run** `npm test -- reproject` → FAIL.
- [ ] **Step 3: Implement** `lib/m10-ingest/geometry/reproject.ts`:
```ts
import proj4 from "proj4";

// EPSG:24047 = Indian 1975 / UTM 47N (Everest 1830) + 3-param towgs84 (Thailand). ห้ามตัด towgs84.
const EPSG_24047 = "+proj=utm +zone=47 +ellps=evrst30 +towgs84=210,814,289,0,0,0,0 +units=m +no_defs";
const EPSG_4326 = "+proj=longlat +datum=WGS84 +no_defs";
const transform = proj4(EPSG_24047, EPSG_4326);

export function reprojectPoint(coord: [number, number]): [number, number] {
  const [lon, lat] = transform.forward(coord);
  return [lon, lat];
}

type Ring = [number, number][];
const reprojectRing = (ring: Ring): Ring => ring.map((c) => reprojectPoint([c[0], c[1]]));

export function reprojectGeometry(
  geom: GeoJSON.Polygon | GeoJSON.MultiPolygon
): GeoJSON.Polygon | GeoJSON.MultiPolygon {
  if (geom.type === "Polygon")
    return { type: "Polygon", coordinates: (geom.coordinates as Ring[]).map(reprojectRing) };
  return { type: "MultiPolygon", coordinates: (geom.coordinates as Ring[][]).map((poly) => poly.map(reprojectRing)) };
}
```
- [ ] **Step 4: Run** `npm test -- reproject` → PASS. If golden fails, the proj4 def is wrong — fix the def, never loosen the assertion.
- [ ] **Step 5: Commit** `git add lib/m10-ingest/geometry/reproject.* && git commit -m "feat(m10-ingest): proj4 24047->4326 reproject + golden test"`

---

## Task 15: Geometry validate/rewind + join

**Files:** Create `lib/m10-ingest/geometry/join.ts` + `join.test.ts`

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from "vitest";
import { prepareGeometry, joinGeometry } from "./join";
import type { RawGeometry } from "../types";

const g: RawGeometry = { recordKey: "5039|2|4682|07|1000|58",
  geometry: { type: "Polygon", coordinates: [[[647023, 1683144], [647073, 1683144], [647073, 1683194], [647023, 1683194], [647023, 1683144]]] } };

describe("prepareGeometry", () => {
  it("reprojects + validates (ok)", () => {
    const out = prepareGeometry(g);
    expect(out.ok).toBe(true);
    if (out.ok) expect((out.geometry.coordinates as number[][][])[0][0][0]).toBeGreaterThan(100);
  });
  it("invalid polygon -> ok:false", () => {
    expect(prepareGeometry({ recordKey: "x", geometry: { type: "Polygon", coordinates: [[[0, 0], [0, 0], [0, 0], [0, 0]]] } }).ok).toBe(false);
  });
});
describe("joinGeometry", () => {
  it("matches by recordKey, reports leftovers", () => {
    const r = joinGeometry(["5039|2|4682|07|1000|58", "9|9|9|99|1000|1"], [g]);
    expect(r.matched.size).toBe(1);
    expect(r.unmatchedGeometry).toEqual([]);
    expect(r.recordsWithoutGeometry).toEqual(["9|9|9|99|1000|1"]);
  });
});
```
- [ ] **Step 2: Run** `npm test -- geometry/join` → FAIL.
- [ ] **Step 3: Implement** `lib/m10-ingest/geometry/join.ts`:
```ts
import { rewind, booleanValid, feature } from "@turf/turf";
import type { RawGeometry } from "../types";
import { reprojectGeometry } from "./reproject";

type Geom = GeoJSON.Polygon | GeoJSON.MultiPolygon;
export type PreparedGeometry =
  | { ok: true; recordKey: string; geometry: Geom }
  | { ok: false; recordKey: string };

export function prepareGeometry(raw: RawGeometry): PreparedGeometry {
  try {
    const reprojected = reprojectGeometry(raw.geometry);
    const wound = rewind(feature(reprojected), { reverse: false }).geometry as Geom;
    if (!booleanValid(wound)) return { ok: false, recordKey: raw.recordKey };
    return { ok: true, recordKey: raw.recordKey, geometry: wound };
  } catch {
    return { ok: false, recordKey: raw.recordKey };
  }
}

export interface JoinResult {
  matched: Map<string, Geom>;
  invalid: RawGeometry[];
  unmatchedGeometry: string[];
  recordsWithoutGeometry: string[];
}

export function joinGeometry(recordKeys: string[], geometries: RawGeometry[]): JoinResult {
  const keySet = new Set(recordKeys);
  const matched = new Map<string, Geom>();
  const invalid: RawGeometry[] = [];
  const unmatchedGeometry: string[] = [];
  for (const g of geometries) {
    const p = prepareGeometry(g);
    if (!p.ok) { invalid.push(g); continue; }
    if (keySet.has(p.recordKey)) matched.set(p.recordKey, p.geometry);
    else unmatchedGeometry.push(p.recordKey);
  }
  return { matched, invalid, unmatchedGeometry, recordsWithoutGeometry: recordKeys.filter((k) => !matched.has(k)) };
}
```
If `@turf/turf` named imports fail under the bundler, use `import * as turf from "@turf/turf";` and call `turf.rewind/turf.booleanValid/turf.feature`.
- [ ] **Step 4: Run** `npm test -- geometry/join` → PASS.
- [ ] **Step 5: Commit** `git add lib/m10-ingest/geometry/join.* && git commit -m "feat(m10-ingest): geometry validate/rewind + key join"`

---

## Task 16: Mongoose models (`models/m10-ingest/`)

**Files:** Create `M10ImportBatch.js`, `M10Transaction.js`, `M10Record.js`, `M10Reject.js`, `index.js`

Exercised by repository tests (Task 17+). `m10_*` collections, `M10*` models, hot-reload guard.

- [ ] **Step 1: M10ImportBatch.js**
```js
const mongoose = require("mongoose");
const ImportBatchSchema = new mongoose.Schema({
  optId: String, optName: String, period: { type: String, index: true },
  files: [{ name: String }],
  fileHash: { type: String, index: true },
  counts: { parcel: Number, ns3a: Number, construction: Number, geometry: Number, rejects: Number },
  status: { type: String, enum: ["processing", "done", "failed"], default: "processing" },
  importedAt: { type: Date, default: Date.now },
}, { collection: "m10_import_batches" });
module.exports = mongoose.models.M10ImportBatch || mongoose.model("M10ImportBatch", ImportBatchSchema);
```
- [ ] **Step 2: M10Transaction.js**
```js
const mongoose = require("mongoose");
const TransactionSchema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: "M10ImportBatch", index: true },
  docType: { type: String, enum: ["PARCEL", "NS3A", "CONSTRUCTION"] },
  recordKey: { type: String, default: null, index: true },
  deedNo: { type: String, default: null, index: true },
  rawStatus: String, changeType: String, taxRelevant: Boolean,
  reviewStatus: { type: String, enum: ["pending", "confirmed", "rejected", "auto"], default: "pending", index: true },
  reviewedBy: String, reviewedAt: Date,
  txnDate: Date, regAmount: { type: Number, default: null },
  owner: { title: String, name: String, surname: String, fullName: String, idHash: { type: String, default: null } },
  area: { rai: Number, ngan: Number, wa: Number, sqm: Number },
  geometry: { type: mongoose.Schema.Types.Mixed, default: null }, // reprojected 4326 (parcel txn)
  payloadRaw: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
}, { collection: "m10_transactions" });
TransactionSchema.index({ batchId: 1, recordKey: 1, rawStatus: 1, txnDate: 1 }, { unique: true });
module.exports = mongoose.models.M10Transaction || mongoose.model("M10Transaction", TransactionSchema);
```
- [ ] **Step 3: M10Record.js**
```js
const mongoose = require("mongoose");
const RecordSchema = new mongoose.Schema({
  docType: { type: String, enum: ["PARCEL", "NS3A", "CONSTRUCTION"] },
  recordKey: { type: String, unique: true },
  deedNo: { type: String, default: null, index: true },
  area: { rai: Number, ngan: Number, wa: Number, sqm: Number },
  owners: [{ title: String, name: String, surname: String, fullName: String, idHash: { type: String, default: null } }],
  geometry: { type: mongoose.Schema.Types.Mixed, default: null },
  hasGeometry: { type: Boolean, default: false },
  status: { type: String, enum: ["active", "retired"], default: "active" },
  lastTxnId: { type: mongoose.Schema.Types.ObjectId, ref: "M10Transaction" },
  lastChangeType: String, lastTxnDate: Date,
  version: { type: Number, default: 1 },
  history: [{ txnId: mongoose.Schema.Types.ObjectId, changeType: String, txnDate: Date, at: Date }],
  updatedAt: { type: Date, default: Date.now },
}, { collection: "m10_records" });
RecordSchema.index({ geometry: "2dsphere" }, { sparse: true });
module.exports = mongoose.models.M10Record || mongoose.model("M10Record", RecordSchema);
```
- [ ] **Step 4: M10Reject.js**
```js
const mongoose = require("mongoose");
const RejectSchema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: "M10ImportBatch", index: true },
  source: String, docType: String,
  rawRow: { type: mongoose.Schema.Types.Mixed }, reason: String,
  createdAt: { type: Date, default: Date.now },
}, { collection: "m10_rejects" });
module.exports = mongoose.models.M10Reject || mongoose.model("M10Reject", RejectSchema);
```
- [ ] **Step 5: index.js**
```js
module.exports = {
  M10ImportBatch: require("./M10ImportBatch"),
  M10Transaction: require("./M10Transaction"),
  M10Record: require("./M10Record"),
  M10Reject: require("./M10Reject"),
};
```
- [ ] **Step 6:** Run `npx tsc --noEmit` → no new errors. Commit `git add models/m10-ingest/ && git commit -m "feat(m10-ingest): mongoose models (M10*/m10_*)"`

---

## Task 17: Repository — batches, transactions (dedup+reviewStatus), rejects

**Files:** Create `lib/m10-ingest/repository/index.ts` + `repository/index.test.ts`

Repository tests use `mongodb-memory-server`.

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { findBatchByHash, createBatch, insertTransactionDedup, insertReject } from "./index";
import type { NormalizedTxn } from "../types";

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });

function txn(over: Partial<NormalizedTxn> = {}): NormalizedTxn {
  return { docType: "PARCEL", recordKey: "5039|2|4682|07|1000|84", deedNo: "31635",
    rawStatus: "ขาย", changeType: "TRANSFER", taxRelevant: true, reviewStatus: "pending",
    txnDate: "2026-01-05", regAmount: 304000,
    owner: { title: "นางสาว", name: "วรารีย์", surname: "ชาลีรัตน์", fullName: "นางสาว วรารีย์ ชาลีรัตน์", idHash: "h" },
    area: { rai: 0, ngan: 2, wa: 24, sqm: 896 }, payloadRaw: {}, ...over };
}

describe("batch idempotency", () => {
  it("findBatchByHash null then created", async () => {
    expect(await findBatchByHash("h1")).toBeNull();
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    expect((await findBatchByHash("h1"))?._id.toString()).toBe(b._id.toString());
  });
});
describe("insertTransactionDedup", () => {
  it("inserts once, second identical = no-op, stores geometry+reviewStatus", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const geo = { type: "Polygon", coordinates: [[[100, 15], [100.1, 15], [100.1, 15.1], [100, 15]]] };
    const first = await insertTransactionDedup(b._id, txn(), geo as any);
    const second = await insertTransactionDedup(b._id, txn(), geo as any);
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(first.doc.reviewStatus).toBe("pending");
    expect(first.doc.geometry.type).toBe("Polygon");
    expect(await mongoose.connection.db!.collection("m10_transactions").countDocuments()).toBe(1);
  });
});
describe("insertReject", () => {
  it("stores quarantine row", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    await insertReject(b._id, { source: "parcel.csv", docType: "PARCEL", rawRow: { a: "1" }, reason: "unknown_status" });
    expect(await mongoose.connection.db!.collection("m10_rejects").countDocuments()).toBe(1);
  });
});
```
- [ ] **Step 2: Run** `npm test -- repository/index` → FAIL.
- [ ] **Step 3: Implement** `lib/m10-ingest/repository/index.ts`:
```ts
import type { Types } from "mongoose";
import type { NormalizedTxn, RejectReason, DocType } from "../types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { M10ImportBatch, M10Transaction, M10Record, M10Reject } = require("../../../models/m10-ingest");

type Geom = GeoJSON.Polygon | GeoJSON.MultiPolygon;

export interface CreateBatchInput {
  fileHash: string; period: string; optId?: string; optName?: string;
  files: { name: string }[]; counts: Record<string, number>;
}
export async function findBatchByHash(fileHash: string) { return M10ImportBatch.findOne({ fileHash }).lean(); }
export async function createBatch(input: CreateBatchInput) {
  return M10ImportBatch.create({ ...input, status: "processing", importedAt: new Date() });
}
export async function finishBatch(batchId: Types.ObjectId, status: "done" | "failed", counts?: Record<string, number>) {
  await M10ImportBatch.updateOne({ _id: batchId }, { $set: { status, ...(counts ? { counts } : {}) } });
}

export async function insertTransactionDedup(batchId: Types.ObjectId, txn: NormalizedTxn, geometry: Geom | null = null) {
  const filter = { batchId, recordKey: txn.recordKey, rawStatus: txn.rawStatus, txnDate: new Date(txn.txnDate) };
  const existing = await M10Transaction.findOne(filter);
  if (existing) return { inserted: false as const, doc: existing };
  const doc = await M10Transaction.create({
    batchId, docType: txn.docType, recordKey: txn.recordKey, deedNo: txn.deedNo,
    rawStatus: txn.rawStatus, changeType: txn.changeType, taxRelevant: txn.taxRelevant,
    reviewStatus: txn.reviewStatus, txnDate: new Date(txn.txnDate), regAmount: txn.regAmount,
    owner: txn.owner, area: txn.area ?? undefined, geometry, payloadRaw: txn.payloadRaw,
  });
  return { inserted: true as const, doc };
}

export interface RejectInput { source: string; docType: DocType | string; rawRow: Record<string, unknown>; reason: RejectReason; }
export async function insertReject(batchId: Types.ObjectId, input: RejectInput) {
  await M10Reject.create({ batchId, ...input, createdAt: new Date() });
}

export { M10ImportBatch, M10Transaction, M10Record, M10Reject };
```
- [ ] **Step 4: Run** `npm test -- repository/index` → PASS (first run downloads Mongo binary).
- [ ] **Step 5: Commit** `git add lib/m10-ingest/repository/index.* && git commit -m "feat(m10-ingest): repository batches/transactions/rejects"`

---

## Task 18: Repository — confirm/reject + `applyTxnToRecord`

**Files:** Modify `lib/m10-ingest/repository/index.ts`; Create `lib/m10-ingest/repository/apply.test.ts`

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createBatch, insertTransactionDedup, confirmTransaction, rejectTransaction } from "./index";
import type { NormalizedTxn } from "../types";

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });

function txn(over: Partial<NormalizedTxn> = {}): NormalizedTxn {
  return { docType: "PARCEL", recordKey: "K1", deedNo: "31635", rawStatus: "ขาย", changeType: "TRANSFER",
    taxRelevant: true, reviewStatus: "pending", txnDate: "2026-01-05", regAmount: 304000,
    owner: { title: "นาย", name: "ก", surname: "ข", fullName: "นาย ก ข", idHash: "h" },
    area: { rai: 0, ngan: 2, wa: 24, sqm: 896 }, payloadRaw: {}, ...over };
}
const col = (n: string) => mongoose.connection.db!.collection(n);

describe("confirmTransaction -> applyTxnToRecord", () => {
  it("creates record on confirm; reject does not", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const geo = { type: "Polygon", coordinates: [[[100, 15], [100.1, 15], [100.1, 15.1], [100, 15]]] };
    const t = await insertTransactionDedup(b._id, txn(), geo as any);
    expect(await col("m10_records").countDocuments()).toBe(0); // ยังไม่มีจน confirm

    await confirmTransaction(t.doc._id, "officer1");
    const rec = await col("m10_records").findOne({ recordKey: "K1" });
    expect(rec?.status).toBe("active");
    expect(rec?.hasGeometry).toBe(true);
    expect(rec?.version).toBe(1);
    expect((await col("m10_transactions").findOne({ _id: t.doc._id }))?.reviewStatus).toBe("confirmed");
  });

  it("RETIRED confirm retires record + bumps version", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const t1 = await insertTransactionDedup(b._id, txn());
    await confirmTransaction(t1.doc._id, "o");
    const t2 = await insertTransactionDedup(b._id, txn({ rawStatus: "เอกสารสิทธิที่ยกเลิกระหว่างเดือน", changeType: "RETIRED", txnDate: "2026-01-10" }));
    await confirmTransaction(t2.doc._id, "o");
    const rec = await col("m10_records").findOne({ recordKey: "K1" });
    expect(rec?.status).toBe("retired");
    expect(rec?.version).toBe(2);
  });

  it("rejectTransaction sets rejected, no record", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const t = await insertTransactionDedup(b._id, txn());
    await rejectTransaction(t.doc._id, "o");
    expect(await col("m10_records").countDocuments()).toBe(0);
    expect((await col("m10_transactions").findOne({ _id: t.doc._id }))?.reviewStatus).toBe("rejected");
  });
});
```
- [ ] **Step 2: Run** `npm test -- repository/apply` → FAIL.
- [ ] **Step 3: Add to `lib/m10-ingest/repository/index.ts`**:
```ts
import type { ChangeType } from "../types";

// apply 1 txn (doc จาก mongoose) เข้า records — เรียกตอน confirm
export async function applyTxnToRecord(txnDoc: any) {
  if (!txnDoc.taxRelevant || !txnDoc.recordKey) return; // construction/encumbrance ไม่ materialize
  const status = (txnDoc.changeType as ChangeType) === "RETIRED" ? "retired" : "active";
  const historyEntry = { txnId: txnDoc._id, changeType: txnDoc.changeType, txnDate: txnDoc.txnDate, at: new Date() };
  const existing = await M10Record.findOne({ recordKey: txnDoc.recordKey });

  const hasGeo = !!txnDoc.geometry;
  if (!existing) {
    await M10Record.create({
      docType: txnDoc.docType, recordKey: txnDoc.recordKey, deedNo: txnDoc.deedNo,
      area: txnDoc.area, owners: [txnDoc.owner],
      geometry: txnDoc.geometry ?? null, hasGeometry: hasGeo,
      status, lastTxnId: txnDoc._id, lastChangeType: txnDoc.changeType, lastTxnDate: txnDoc.txnDate,
      version: 1, history: [historyEntry], updatedAt: new Date(),
    });
    return;
  }
  await M10Record.updateOne({ _id: existing._id }, {
    $set: {
      area: txnDoc.area ?? existing.area, owners: [txnDoc.owner], deedNo: txnDoc.deedNo ?? existing.deedNo,
      ...(hasGeo ? { geometry: txnDoc.geometry, hasGeometry: true } : {}),
      status, lastTxnId: txnDoc._id, lastChangeType: txnDoc.changeType, lastTxnDate: txnDoc.txnDate, updatedAt: new Date(),
    },
    $inc: { version: 1 },
    $push: { history: historyEntry },
  });
}

export async function confirmTransaction(txnId: Types.ObjectId, reviewedBy: string) {
  const doc = await M10Transaction.findById(txnId);
  if (!doc) throw new Error("transaction not found");
  doc.reviewStatus = "confirmed"; doc.reviewedBy = reviewedBy; doc.reviewedAt = new Date();
  await doc.save();
  await applyTxnToRecord(doc);
  return doc;
}
export async function rejectTransaction(txnId: Types.ObjectId, reviewedBy: string) {
  await M10Transaction.updateOne({ _id: txnId }, { $set: { reviewStatus: "rejected", reviewedBy, reviewedAt: new Date() } });
}
```
- [ ] **Step 4: Run** `npm test -- repository/apply` → PASS.
- [ ] **Step 5: Commit** `git add lib/m10-ingest/repository/ && git commit -m "feat(m10-ingest): confirm/reject + applyTxnToRecord"`

---

## Task 19: Repository — `asOfMaterialize(cutoff)`

**Files:** Modify `lib/m10-ingest/repository/index.ts`; Create `lib/m10-ingest/repository/asof.test.ts`

as-of replays **confirmed** transactions with `txnDate ≤ cutoff` (transactions = source of truth).

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createBatch, insertTransactionDedup, confirmTransaction, asOfMaterialize } from "./index";
import type { NormalizedTxn } from "../types";

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });

function txn(over: Partial<NormalizedTxn>): NormalizedTxn {
  return { docType: "PARCEL", recordKey: "K1", deedNo: null, rawStatus: "ขาย", changeType: "TRANSFER",
    taxRelevant: true, reviewStatus: "pending", txnDate: "2026-01-05", regAmount: null,
    owner: { title: "", name: "A", surname: "", fullName: "A", idHash: null }, area: null, payloadRaw: {}, ...over };
}

describe("asOfMaterialize", () => {
  it("returns owner as of cutoff, ignoring later transactions", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const t1 = await insertTransactionDedup(b._id, txn({ txnDate: "2026-01-05", owner: { title: "", name: "A", surname: "", fullName: "A", idHash: null } }));
    const t2 = await insertTransactionDedup(b._id, txn({ rawStatus: "โอนมรดก", txnDate: "2026-01-20", owner: { title: "", name: "B", surname: "", fullName: "B", idHash: null } }));
    await confirmTransaction(t1.doc._id, "o");
    await confirmTransaction(t2.doc._id, "o");

    const early = await asOfMaterialize(new Date("2026-01-10"));
    expect(early.find((r) => r.recordKey === "K1")?.owners[0].fullName).toBe("A");
    const late = await asOfMaterialize(new Date("2026-01-31"));
    expect(late.find((r) => r.recordKey === "K1")?.owners[0].fullName).toBe("B");
  });
});
```
- [ ] **Step 2: Run** `npm test -- repository/asof` → FAIL.
- [ ] **Step 3: Add to `lib/m10-ingest/repository/index.ts`**:
```ts
export interface AsOfRecord {
  recordKey: string; docType: string; status: "active" | "retired";
  owners: any[]; area: any; deedNo: string | null; lastChangeType: string; lastTxnDate: Date; hasGeometry: boolean;
}

// replay confirmed txn ที่ txnDate <= cutoff เรียงตามเวลา → สถานะ ณ cutoff (ไม่เขียน DB)
export async function asOfMaterialize(cutoff: Date): Promise<AsOfRecord[]> {
  const txns = await M10Transaction.find({
    reviewStatus: "confirmed", taxRelevant: true, recordKey: { $ne: null }, txnDate: { $lte: cutoff },
  }).sort({ txnDate: 1, createdAt: 1 }).lean();

  const byKey = new Map<string, AsOfRecord>();
  for (const t of txns) {
    byKey.set(t.recordKey, {
      recordKey: t.recordKey, docType: t.docType,
      status: t.changeType === "RETIRED" ? "retired" : "active",
      owners: [t.owner], area: t.area ?? null, deedNo: t.deedNo ?? null,
      lastChangeType: t.changeType, lastTxnDate: t.txnDate, hasGeometry: !!t.geometry,
    });
  }
  return [...byKey.values()];
}
```
- [ ] **Step 4: Run** `npm test -- repository/asof` → PASS.
- [ ] **Step 5: Commit** `git add lib/m10-ingest/repository/ && git commit -m "feat(m10-ingest): asOfMaterialize (replay confirmed txns)"`

---

## Task 20: `ingest()` orchestrator + integration test

**Files:** Create `lib/m10-ingest/ingest.ts` + `ingest.test.ts`

Writes **transactions only** (with reviewStatus + attached geometry). Records appear only after confirm. Idempotent by `fileHash`.

- [ ] **Step 1: Failing test (uses the real ZIP)**
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ingestZip } from "./ingest";

const ZIP = readFileSync(join(process.cwd(), "public/60070001_60010000.zip"));
let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });
const col = (n: string) => mongoose.connection.db!.collection(n);

describe("ingestZip (real ม.ค. 2569 batch)", () => {
  it("writes transactions, no records yet; parcel txns carry geometry; geometry 59/59", async () => {
    const res = await ingestZip(ZIP, { period: "2569-01" });
    expect(res.skipped).toBe(false);
    // parcel 87 + ns3a 4 + construction 12, minus any quarantine
    expect(await col("m10_transactions").countDocuments()).toBeGreaterThan(90);
    expect(await col("m10_records").countDocuments()).toBe(0); // ยังไม่ confirm
    const withGeo = await col("m10_transactions").countDocuments({ docType: "PARCEL", geometry: { $ne: null } });
    expect(withGeo).toBeGreaterThan(0);
    expect(res.counts!.geometryMatched).toBe(59);
    // ทุกสถานะ map ได้ → ไม่มี unknown_status
    expect(await col("m10_rejects").countDocuments({ reason: "unknown_status" })).toBe(0);
  });

  it("is idempotent: re-run same ZIP -> skipped, no new txns", async () => {
    await ingestZip(ZIP, { period: "2569-01" });
    const before = await col("m10_transactions").countDocuments();
    const res2 = await ingestZip(ZIP, { period: "2569-01" });
    expect(res2.skipped).toBe(true);
    expect(await col("m10_transactions").countDocuments()).toBe(before);
    expect(await col("m10_import_batches").countDocuments()).toBe(1);
  });
});
```
- [ ] **Step 2: Run** `npm test -- ingest` → FAIL.
- [ ] **Step 3: Implement** `lib/m10-ingest/ingest.ts`:
```ts
import { createHash } from "node:crypto";
import { extractBatch, type ExtractedBatch } from "./adapters/zip";
import { parseCsv } from "./adapters/csv";
import { parseGeometryGeoJSON } from "./adapters/geometry";
import { normalizeRow } from "./normalize/index";
import { joinGeometry } from "./geometry/join";
import { NormalizeError, type RawRow, type RawGeometry } from "./types";
import {
  findBatchByHash, createBatch, finishBatch,
  insertTransactionDedup, insertReject,
} from "./repository/index";

export interface IngestOptions { period: string; optId?: string; optName?: string; }
export interface IngestResult {
  skipped: boolean; batchId?: string;
  counts?: { transactions: number; rejects: number; geometryMatched: number; geometryUnmatched: number };
}

export async function ingestZip(buffer: Buffer, opts: IngestOptions): Promise<IngestResult> {
  const fileHash = createHash("sha256").update(buffer).digest("hex");
  const existing = await findBatchByHash(fileHash);
  if (existing) return { skipped: true, batchId: existing._id.toString() };

  const batchFiles: ExtractedBatch = extractBatch(buffer);
  const batch = await createBatch({
    fileHash, period: opts.period,
    optId: opts.optId ?? batchFiles.optId, optName: opts.optName ?? batchFiles.optName,
    files: batchFiles.fileNames.map((name) => ({ name })), counts: {},
  });

  // geometry fatal ถ้าทั้งไฟล์พัง → ยกเลิก batch
  let geometries: RawGeometry[] = [];
  try {
    if (batchFiles.geometryGeoJSON) geometries = parseGeometryGeoJSON(batchFiles.geometryGeoJSON);
  } catch (e) {
    if (e instanceof NormalizeError) { await finishBatch(batch._id, "failed"); throw new Error(`fatal geometry: ${e.reason}`); }
    throw e;
  }

  const rawRows: RawRow[] = [
    ...(batchFiles.parcelCsv ? parseCsv(batchFiles.parcelCsv, "PARCEL", "parcel.csv") : []),
    ...(batchFiles.ns3aCsv ? parseCsv(batchFiles.ns3aCsv, "NS3A", "ns3a.csv") : []),
    ...(batchFiles.constructionCsv ? parseCsv(batchFiles.constructionCsv, "CONSTRUCTION", "construction.csv") : []),
  ];

  // join geometry กับ recordKey ของ parcel ในรอบเดียว
  const parcelKeys: string[] = [];
  const normalized = rawRows.map((rawRow) => ({ rawRow, outcome: normalizeRow(rawRow) }));
  for (const { outcome } of normalized) {
    if (outcome.ok && outcome.txn.docType === "PARCEL" && outcome.txn.recordKey) parcelKeys.push(outcome.txn.recordKey);
  }
  const join = joinGeometry(parcelKeys, geometries);

  let txCount = 0, rejCount = 0;
  for (const { rawRow, outcome } of normalized) {
    if (!outcome.ok) {
      await insertReject(batch._id, { source: rawRow.source, docType: rawRow.docType, rawRow: rawRow.raw, reason: outcome.reason });
      rejCount++; continue;
    }
    const geom = outcome.txn.recordKey ? join.matched.get(outcome.txn.recordKey) ?? null : null;
    const { inserted } = await insertTransactionDedup(batch._id, outcome.txn, geom);
    if (inserted) txCount++;
  }

  // geometry ที่ join ไม่ติด → quarantine ไม่ทิ้งเงียบ
  for (const key of join.unmatchedGeometry) {
    await insertReject(batch._id, { source: "geometry", docType: "PARCEL", rawRow: { recordKey: key }, reason: "geometry_unmatched" });
    rejCount++;
  }
  for (const bad of join.invalid) {
    await insertReject(batch._id, { source: "geometry", docType: "PARCEL", rawRow: { recordKey: bad.recordKey }, reason: "geometry_invalid" });
    rejCount++;
  }

  const counts = { transactions: txCount, rejects: rejCount, geometryMatched: join.matched.size, geometryUnmatched: join.unmatchedGeometry.length };
  await finishBatch(batch._id, "done", { ...counts, geometry: geometries.length });
  return { skipped: false, batchId: batch._id.toString(), counts };
}
```
- [ ] **Step 4: Run** `npm test -- ingest` → PASS.
- [ ] **Step 5: Run full suite** `npm test` → ALL pass.
- [ ] **Step 6: Commit** `git add lib/m10-ingest/ingest.* && git commit -m "feat(m10-ingest): ingestZip orchestrator (txns only) + integration tests"`

---

## Task 21: CLI + node script

**Files:** Create `lib/m10-ingest/cli.ts`, `scripts/m10-ingest.js`

- [ ] **Step 1: Implement** `lib/m10-ingest/cli.ts`:
```ts
import { readFile } from "node:fs/promises";
import { ingestZip, type IngestResult } from "./ingest";

export interface CliArgs { zipPath: string; period: string; }
export function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};
  let zipPath = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[++i];
    else zipPath = argv[i];
  }
  if (!zipPath) throw new Error("usage: m10:ingest <file.zip> --period 2569-01");
  if (!args.period) throw new Error("missing --period (e.g. --period 2569-01)");
  return { zipPath, period: args.period };
}
export async function runCli(args: CliArgs): Promise<IngestResult> {
  const buf = await readFile(args.zipPath);
  return ingestZip(buf, { period: args.period });
}
```
- [ ] **Step 2: Implement** `scripts/m10-ingest.js`:
```js
// รัน: npm run m10:ingest -- public/60070001_60010000.zip --period 2569-01
async function main() {
  const { parseArgs, runCli } = await import("../lib/m10-ingest/cli.ts");
  const dbConnect = require("../lib/dbConnect");
  const args = parseArgs(process.argv.slice(2));
  await (dbConnect.default || dbConnect)();
  console.log(JSON.stringify(await runCli(args), null, 2));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```
- [ ] **Step 3: Smoke-check arg parse** `npx tsx -e "import('./lib/m10-ingest/cli.ts').then(m=>console.log(m.parseArgs(['x.zip','--period','2569-01'])))"` → prints `{ zipPath: 'x.zip', period: '2569-01' }`.
- [ ] **Step 4: Commit** `git add lib/m10-ingest/cli.ts scripts/m10-ingest.js && git commit -m "feat(m10-ingest): CLI + node script"`

---

# PHASE 2 — API (`pages/api/m10-ingest`)

## Task 22: Server auth helper `requireM10Admin`

**Files:** Create `pages/api/m10-ingest/_auth.js`

Mirrors `pages/api/pm25/_auth.js#requirePm25Admin` but takes the required page path as an argument (3 pages share it).

- [ ] **Step 1: Implement** `pages/api/m10-ingest/_auth.js`:
```js
import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";

export async function requireM10Admin(req, requiredPage) {
  const { userId } = getAuth(req);
  if (!userId) return { ok: false, status: 401, message: "Unauthorized" };

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const role = clerkUser.publicMetadata?.role || "admin";
  if (role === "superadmin") {
    return { ok: true, userId, role, isSuperAdmin: true, name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() };
  }

  await dbConnect();
  const UserSchema = new mongoose.Schema({
    clerkId: String, role: String, appId: { type: String, default: "" },
    allowedPages: { type: [String], default: [] }, name: String,
  }, { collection: "users", timestamps: true });
  const User = mongoose.models.User || mongoose.model("User", UserSchema);
  const mongoUser = await User.findOne({ clerkId: userId }).lean();

  if (!mongoUser) return { ok: false, status: 403, message: "User not registered" };
  if (!mongoUser.appId || mongoUser.appId !== CURRENT_APP_ID) return { ok: false, status: 403, message: "No app access" };

  const allowed = Array.isArray(mongoUser.allowedPages) ? mongoUser.allowedPages : [];
  const hasPageAccess = allowed.length === 0 || allowed.includes(requiredPage);
  if (!hasPageAccess) return { ok: false, status: 403, message: "No page access" };

  return { ok: true, userId, role: mongoUser.role || role, isSuperAdmin: false, name: mongoUser.name || "" };
}
```
- [ ] **Step 2: Type-check** `npx tsc --noEmit` → no new errors.
- [ ] **Step 3: Commit** `git add pages/api/m10-ingest/_auth.js && git commit -m "feat(m10-ingest): requireM10Admin server auth"`

---

## Task 23: `POST /api/m10-ingest/upload`

**Files:** Create `pages/api/m10-ingest/upload.js`

Disables Next body parser, uses `formidable`, runs `ingestZip` synchronously.

- [ ] **Step 1: Implement** `pages/api/m10-ingest/upload.js`:
```js
import { readFile } from "node:fs/promises";
import formidable from "formidable";
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "./_auth";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10-ingest");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const form = formidable({ maxFileSize: 100 * 1024 * 1024 });
  let fields, files;
  try { [fields, files] = await form.parse(req); }
  catch { return res.status(400).json({ error: "อัปโหลดไฟล์ไม่สำเร็จ" }); }

  const file = Array.isArray(files.file) ? files.file[0] : files.file;
  if (!file) return res.status(400).json({ error: "ไม่พบไฟล์ (field name ต้องเป็น 'file')" });
  const period = Array.isArray(fields.period) ? fields.period[0] : fields.period;
  if (!period) return res.status(400).json({ error: "ต้องระบุ period เช่น 2569-01" });

  try {
    const buffer = await readFile(file.filepath);
    await dbConnect();
    const { ingestZip } = await import("@/lib/m10-ingest/ingest");
    const result = await ingestZip(buffer, { period });
    return res.status(200).json(result);
  } catch (e) {
    console.error("m10 ingest error", e);
    return res.status(500).json({ error: e?.message || "ingest ล้มเหลว" });
  }
}
```
- [ ] **Step 2: Manual verify (dev server running)**:
```bash
# ต้องมี session cookie ของ admin — ทดสอบผ่าน UI ใน Task 26 แทน ถ้า curl ไม่มี cookie
npx tsc --noEmit
```
Expected: type-check passes; full UI verification happens in Task 26.
- [ ] **Step 3: Commit** `git add pages/api/m10-ingest/upload.js && git commit -m "feat(m10-ingest): POST upload (formidable + ingestZip)"`

---

## Task 24: Transactions list + confirm/reject

**Files:** Create `pages/api/m10-ingest/transactions/index.js`, `pages/api/m10-ingest/transactions/[id]/confirm.js`, `pages/api/m10-ingest/transactions/[id]/reject.js`

- [ ] **Step 1: list** `pages/api/m10-ingest/transactions/index.js`:
```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10-review");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  await dbConnect();
  const { M10Transaction } = await import("@/models/m10-ingest");
  const reviewStatus = req.query.reviewStatus || "pending";
  const rows = await M10Transaction.find({ reviewStatus })
    .sort({ txnDate: 1, createdAt: 1 })
    .select("docType recordKey deedNo rawStatus changeType taxRelevant txnDate regAmount owner reviewStatus")
    .limit(500).lean();
  return res.status(200).json({ items: rows });
}
```
- [ ] **Step 2: confirm** `pages/api/m10-ingest/transactions/[id]/confirm.js`:
```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../../_auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10-review");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  await dbConnect();
  const { confirmTransaction } = await import("@/lib/m10-ingest/repository/index");
  try {
    await confirmTransaction(req.query.id, auth.name || auth.userId);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: e?.message || "confirm ล้มเหลว" });
  }
}
```
- [ ] **Step 3: reject** `pages/api/m10-ingest/transactions/[id]/reject.js`:
```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../../_auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10-review");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  await dbConnect();
  const { rejectTransaction } = await import("@/lib/m10-ingest/repository/index");
  try {
    await rejectTransaction(req.query.id, auth.name || auth.userId);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: e?.message || "reject ล้มเหลว" });
  }
}
```
- [ ] **Step 4: Type-check** `npx tsc --noEmit` → no new errors.
- [ ] **Step 5: Commit** `git add pages/api/m10-ingest/transactions && git commit -m "feat(m10-ingest): transactions list + confirm/reject API"`

---

## Task 25: `GET /api/m10-ingest/records?asOf=...`

**Files:** Create `pages/api/m10-ingest/records.js`

- [ ] **Step 1: Implement**:
```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "./_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10-records");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  await dbConnect();
  const { asOfMaterialize } = await import("@/lib/m10-ingest/repository/index");
  // asOf ว่าง = ปัจจุบัน (วันนี้)
  const cutoff = req.query.asOf ? new Date(String(req.query.asOf)) : new Date();
  if (isNaN(cutoff.getTime())) return res.status(400).json({ error: "asOf ไม่ใช่วันที่ที่ถูกต้อง (YYYY-MM-DD)" });
  const records = await asOfMaterialize(cutoff);
  return res.status(200).json({ asOf: cutoff.toISOString().slice(0, 10), count: records.length, records });
}
```
- [ ] **Step 2: Type-check** `npx tsc --noEmit` → no new errors.
- [ ] **Step 3: Commit** `git add pages/api/m10-ingest/records.js && git commit -m "feat(m10-ingest): records as-of API"`

---

# PHASE 3 — Admin UI + permissions

## Task 26: Register the 3 pages (4-point permission registration)

**Files:** Modify `lib/permissions.ts` (ALL_PAGES + DEFAULT_PERMISSIONS), `components/LayoutAdmin.tsx` (navigationItems); Create `scripts/grant-m10-permission.js`

Per skill `adding-admin-page`. Do all four points.

- [ ] **Step 1: Add to `ALL_PAGES`** in `lib/permissions.ts` (in the `management` group, after the smart-papar entry):
```ts
  {
    path: '/admin/m10-ingest',
    label: 'ม.10 นำเข้าข้อมูล',
    icon: '🗂️',
    description: 'นำเข้าชุดไฟล์มาตรา 10 รายเดือน (ZIP) จากกรมที่ดิน',
    category: 'management'
  },
  {
    path: '/admin/m10-review',
    label: 'ม.10 คิวยืนยัน',
    icon: '✅',
    description: 'ยืนยัน/ปฏิเสธรายการเปลี่ยนแปลงกรรมสิทธิ์ก่อนเข้าทะเบียน',
    category: 'management'
  },
  {
    path: '/admin/m10-records',
    label: 'ม.10 ทะเบียน (as-of)',
    icon: '🗺️',
    description: 'ดูสถานะกรรมสิทธิ์ ณ วันที่กำหนด (ปัจจุบัน / 1 ม.ค.)',
    category: 'management'
  },
```
- [ ] **Step 2: Add to `DEFAULT_PERMISSIONS`** in `lib/permissions.ts` — add the three paths to `superadmin` and `admin` arrays (open `DEFAULT_PERMISSIONS` ~line 190 and append to the existing arrays; match the file's existing string-array style):
```ts
  // ภายใน admin: [ ... existing ..., '/admin/m10-ingest', '/admin/m10-review', '/admin/m10-records' ]
```
(If `superadmin` uses a wildcard/`'*'` style, leave it; otherwise add the three there too.)
- [ ] **Step 3: Add to `navigationItems`** in `components/LayoutAdmin.tsx` (in the `'จัดการ'` group, after the คุณภาพน้ำ line):
```ts
  { label: 'ม.10 นำเข้า',        href: '/admin/m10-ingest',                icon: '🗂️', group: 'จัดการ' },
  { label: 'ม.10 คิวยืนยัน',     href: '/admin/m10-review',                icon: '✅', group: 'จัดการ' },
  { label: 'ม.10 ทะเบียน',       href: '/admin/m10-records',               icon: '🗺️', group: 'จัดการ' },
```
- [ ] **Step 4: Migration script** `scripts/grant-m10-permission.js` (model after `scripts/grant-elderly-school-permission.js`):
```js
// รัน: node --env-file=.env.local scripts/grant-m10-permission.js
const mongoose = require("mongoose");
const PAGES = ["/admin/m10-ingest", "/admin/m10-review", "/admin/m10-records"];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.connection.collection("users");
  // เพิ่มสิทธิ์ให้ user ที่มี custom allowedPages อยู่แล้ว (allowedPages ไม่ว่าง) เท่านั้น
  const res = await User.updateMany(
    { appId: process.env.NEXT_PUBLIC_APP_ID || "smart-takhli", allowedPages: { $exists: true, $ne: [] } },
    { $addToSet: { allowedPages: { $each: PAGES } } }
  );
  console.log("matched:", res.matchedCount, "modified:", res.modifiedCount);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
```
- [ ] **Step 5: Verify** `npm run lint && npx tsc --noEmit` → no new errors. (Run the migration script against the real DB only when deploying.)
- [ ] **Step 6: Commit** `git add lib/permissions.ts components/LayoutAdmin.tsx scripts/grant-m10-permission.js && git commit -m "feat(m10-ingest): register 3 admin pages + permission migration"`

---

## Task 27: `/admin/m10-ingest` upload page

**Files:** Create `pages/admin/m10-ingest.jsx`

- [ ] **Step 1: Implement** `pages/admin/m10-ingest.jsx`:
```jsx
import { useState } from "react";
import Head from "next/head";
import LayoutAdmin from "@/components/LayoutAdmin";

export default function M10IngestPage() {
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
    <LayoutAdmin>
      <Head><title>ม.10 นำเข้าข้อมูล</title></Head>
      <div className="p-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">นำเข้าข้อมูลมาตรา 10 (รายเดือน)</h1>
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
            <p className="text-sm opacity-70">รายการที่กระทบกรรมสิทธิ์รอการยืนยันที่หน้า “ม.10 คิวยืนยัน”</p>
          </div>
        )}
      </div>
    </LayoutAdmin>
  );
}
```
- [ ] **Step 2: Verify in app** — start `npm run dev`, log in as admin, open `/admin/m10-ingest`, upload `public/60070001_60010000.zip` with period `2569-01`. Expected: stats show Transactions > 90, Geometry matched 59, Quarantine small; second upload shows the "นำเข้าแล้ว" info.
- [ ] **Step 3: Commit** `git add pages/admin/m10-ingest.jsx && git commit -m "feat(m10-ingest): upload admin page"`

---

## Task 28: `/admin/m10-review` confirm queue

**Files:** Create `pages/admin/m10-review.jsx`

- [ ] **Step 1: Implement** `pages/admin/m10-review.jsx`:
```jsx
import { useEffect, useState, useCallback } from "react";
import Head from "next/head";
import LayoutAdmin from "@/components/LayoutAdmin";

export default function M10ReviewPage() {
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
    <LayoutAdmin>
      <Head><title>ม.10 คิวยืนยัน</title></Head>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">คิวยืนยันการเปลี่ยนแปลง (รอดำเนินการ {items.length})</h1>
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
    </LayoutAdmin>
  );
}
```
- [ ] **Step 2: Verify in app** — after Task 27 upload, open `/admin/m10-review`: pending rows appear (ownership-affecting only; จำนอง/note/admin not shown). Confirm a row → it disappears; check `/admin/m10-records` next.
- [ ] **Step 3: Commit** `git add pages/admin/m10-review.jsx && git commit -m "feat(m10-ingest): review queue admin page"`

---

## Task 29: `/admin/m10-records` as-of viewer

**Files:** Create `pages/admin/m10-records.jsx`

- [ ] **Step 1: Implement** `pages/admin/m10-records.jsx`:
```jsx
import { useEffect, useState, useCallback } from "react";
import Head from "next/head";
import LayoutAdmin from "@/components/LayoutAdmin";

export default function M10RecordsPage() {
  const [asOf, setAsOf] = useState(""); // "" = ปัจจุบัน
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
    <LayoutAdmin>
      <Head><title>ม.10 ทะเบียน (as-of)</title></Head>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">ทะเบียนกรรมสิทธิ์ (as-of)</h1>
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
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </LayoutAdmin>
  );
}
```
- [ ] **Step 2: Verify in app** — open `/admin/m10-records`. After confirming records in Task 28, rows appear. Set date before/after a confirmed txn to see owner change. Empty before any confirm.
- [ ] **Step 3: Commit** `git add pages/admin/m10-records.jsx && git commit -m "feat(m10-ingest): as-of records viewer page"`

---

## Task 30: Module documentation

**Files:** Create `docs/modules/m10-ingest.md`; Modify `docs/modules/README.md`

- [ ] **Step 1: Write** `docs/modules/m10-ingest.md`:
```markdown
# โมดูล m10-ingest — นำเข้า/normalize ข้อมูลมาตรา 10

รับ ZIP รายเดือนจากกรมที่ดิน → parse → normalize (pure fns) → reproject geometry 24047→4326 →
เก็บ transactions (idempotent) → คนยืนยัน → materialize records → ดู as-of

## โครงสร้าง
- `lib/m10-ingest/adapters/` — zip(unzip+glob) · csv · geometry(unwrap LocationGeospatial)
- `lib/m10-ingest/normalize/` — trim · changeType(dict+variants) · review · area · owner(PDPA idHash) · ravang · date · currency · index(per-docType)
- `lib/m10-ingest/geometry/` — reproject(datum shift) · join(validate/rewind + key)
- `lib/m10-ingest/repository/` — batches · transactions(dedup+reviewStatus) · confirm/reject · applyTxnToRecord · asOfMaterialize
- `lib/m10-ingest/ingest.ts` — ingestZip() (เขียน transactions เท่านั้น)
- `models/m10-ingest/` — M10ImportBatch/Transaction/Record/Reject (collections m10_*)
- `pages/api/m10-ingest/` — upload · transactions(list/confirm/reject) · records(as-of)
- `pages/admin/m10-ingest|m10-review|m10-records` — 3 หน้า admin

## รัน
```bash
npm test                                                   # vitest (unit + integration ใช้ ZIP จริง)
npm run m10:ingest -- public/60070001_60010000.zip --period 2569-01
```

## หลักการ
- **ห้าม drop เงียบ** → `m10_rejects` พร้อม reason เสมอ (unknown_status / *_parse_failed / geometry_*)
- **Idempotent** — `fileHash` ของ ZIP กันนำเข้าซ้ำ
- **records เกิดตอน confirm เท่านั้น** (human-in-the-loop §4.1); as-of = replay confirmed txn ที่ txnDate ≤ cutoff
- **datum shift บังคับ** — proj4 Indian 1975 + towgs84; ห้ามใช้ EPSG:32647
- recordKey ฟังก์ชันเดียวทั้ง attribute + geometry (`normalize/ravang.ts`)

## Open items
- ⚠ หน่วย `เศษ` ยืนยันกับ LTAX 1 รายการก่อน production
- ns3a/construction สถานะเต็มชุด (unknown → quarantine)
- รอบถัดไป: basemap link, diff/reconcile, worklist→LTAX

Spec: `docs/superpowers/specs/2026-06-21-m10-ingest-normalize-design.md` (rev.2)
```
- [ ] **Step 2: Add to `docs/modules/README.md`** — add a line for `m10-ingest` matching the file's existing row format (open it to copy the style).
- [ ] **Step 3: Commit** `git add docs/modules/m10-ingest.md docs/modules/README.md && git commit -m "docs(m10-ingest): module doc + index"`

---

## Final verification

- [ ] `npm test` — ALL pass (normalize, adapters incl. real ZIP, geometry golden, repository, confirm/apply, as-of, ingest idempotency).
- [ ] `npx tsc --noEmit` — no new errors.
- [ ] `npm run lint` — no new errors in `lib/m10-ingest/**`, `pages/api/m10-ingest/**`, `pages/admin/m10-*`.
- [ ] Manual end-to-end (dev server): upload real ZIP → review queue shows pending ownership rows → confirm a few → records viewer shows them → switch as-of date and observe owner changes → re-upload same ZIP shows "นำเข้าแล้ว".
- [ ] The 3 pages appear in the admin sidebar for superadmin; access-denied for users without the page permission.

---

## Spec coverage map (self-review)

| Spec section | Task(s) |
|---|---|
| §1 in-scope (ZIP upload, 3 surfaces, idempotent, as-of, confirm queue) | 13, 20, 23–29 |
| §2.1 ground truth (ZIP structure, real field map) | 11, 12, 13, 10 |
| §3 architecture (zip adapter + 4 layers) | 1, 10–20 |
| §4 + §4.1 data model + temporal/review (reviewStatus, geometry on txn, apply, as-of) | 4, 16, 17, 18, 19 |
| §5 dictionary + variants + reviewStatus defaults | 3, 4 |
| §6 normalize rules | 2, 5–10 |
| §7 geometry (datum shift, unwrap, validate, join, attach) | 12, 14, 15, 20 |
| §8 error handling (quarantine reasons, idempotent, fatal vs warning) | 17, 20 |
| §9 testing (completeness, golden, 59/59, idempotency, review/apply, as-of, zip) | 3, 14, 17–20 |
| §13 admin surfaces + auth + no raw ZIP | 22–29 |

**Out of scope (correctly absent):** basemap link, diff/spatial reconcile, map Review UI, worklist→LTAX, LTAX baseline export.
