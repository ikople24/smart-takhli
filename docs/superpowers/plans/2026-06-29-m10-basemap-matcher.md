# m10 Basemap Registry + Matcher (รอบ A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทุก M10Record รู้ PARCEL_COD ของตัวเอง (หรือถูก flag matched/ambiguous/unmatched) โดย match กับ basemap ด้วย cascade โฉนด→เลขที่ดิน+หน้าสำรวจ→geometry

**Architecture:** โหลด basemap (parcel.shp.geojson) เข้า collection `m10_basemap` ผ่าน CLkI; `matchParcel()` เป็น async pure fn ที่รับ resolver inject; `reconcileRecord()` ใน repository ต่อ resolver กับ DB; รันตอน confirm + backfill; แท็บ Reconcile read-only

**Tech Stack:** Next.js Pages Router, Mongoose, @turf/turf (intersect/area/rewind/booleanValid), vitest + mongodb-memory-server, tsx CLI

Spec: `docs/superpowers/specs/2026-06-29-m10-basemap-matcher-design.md`

---

## File Structure

- `models/m10-ingest/M10Basemap.js` — schema basemap (collection `m10_basemap`)
- `models/m10-ingest/M10Record.js` — +landNo, survey, parcelCode, parcelMatch
- `models/m10-ingest/index.js` — export M10Basemap
- `lib/m10-ingest/basemap/load.ts` — `featureToBasemapDoc()` pure (strip Z + rewind + validate)
- `lib/m10-ingest/basemap/match.ts` — `matchParcel()` async + types
- `lib/m10-ingest/repository/index.ts` — `reconcileRecord()`, `listReconcile()`, +reconcile ใน applyTxnToRecord, export M10Basemap
- `scripts/m10-load-basemap.js` — CLI โหลด basemap
- `scripts/m10-reconcile-backfill.js` — CLI backfill record เดิม
- `pages/api/m10-ingest/reconcile.js` — GET read-only
- `components/m10/ReconcilePanel.jsx` — แท็บใหม่
- `pages/admin/m10.jsx` — +tab reconcile

---

## Task 1: M10Basemap model

**Files:** Create `models/m10-ingest/M10Basemap.js`; Modify `models/m10-ingest/index.js`

- [ ] **Step 1: สร้าง model**

```js
const mongoose = require("mongoose");
const BasemapSchema = new mongoose.Schema({
  parcelCode: { type: String, index: true }, // ไม่ unique — basemap มีซ้ำ 93
  zoneId: String, blockId: String, lot: String,
  deedNo: { type: String, default: null, index: true }, // Chanod_no → string (ซ้ำได้)
  landNo: { type: String, default: null },
  survey: { type: String, default: null },
  landType: String,
  area: { rai: Number, ngan: Number, wa: Number, sqm: Number },
  geometry: { type: mongoose.Schema.Types.Mixed, default: null }, // Polygon 2D (4326)
}, { collection: "m10_basemap" });
BasemapSchema.index({ geometry: "2dsphere" });
module.exports = mongoose.models.M10Basemap || mongoose.model("M10Basemap", BasemapSchema);
```

- [ ] **Step 2: export ใน index.js** — เพิ่มบรรทัด `M10Basemap: require("./M10Basemap"),`

- [ ] **Step 3: Commit**

```bash
git add models/m10-ingest/M10Basemap.js models/m10-ingest/index.js
git commit -m "feat(m10-basemap): M10Basemap model"
```

---

## Task 2: basemap load (pure fn)

**Files:** Create `lib/m10-ingest/basemap/load.ts`, `lib/m10-ingest/basemap/load.test.ts`

- [ ] **Step 1: เขียน failing test** (`load.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { featureToBasemapDoc } from "./load";
import type { Feature } from "geojson";

function feat(props: Record<string, unknown>, coords: number[][][]): Feature {
  return { type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: coords } };
}
const SQUARE3D = [[[100, 15, -35], [100.001, 15, -35], [100.001, 15.001, -35], [100, 15.001, -35], [100, 15, -35]]];

describe("featureToBasemapDoc", () => {
  it("maps fields + strips Z + keeps 2D geometry", () => {
    const d = featureToBasemapDoc(feat(
      { PARCEL_COD: "07B034/081", ZONE_ID: "07", BLOCK_ID: "07B", LOT: "034/081",
        Chanod_no: 58181, LAND_NO: "711", SURVEY: "23173", land_type: "โฉนด",
        rai: 0, ngan: 1, wa: 12.4, area: 437.42 }, SQUARE3D))!;
    expect(d.parcelCode).toBe("07B034/081");
    expect(d.deedNo).toBe("58181"); // number → string
    expect(d.landNo).toBe("711");
    expect(d.survey).toBe("23173");
    expect(d.area.sqm).toBe(437.42);
    // Z ถูกตัด — ทุกพิกัดเหลือ 2 ค่า
    const ring = (d.geometry as GeoJSON.Polygon).coordinates[0];
    expect(ring.every((c) => c.length === 2)).toBe(true);
  });

  it("returns null when PARCEL_COD missing", () => {
    expect(featureToBasemapDoc(feat({ Chanod_no: 1 }, SQUARE3D))).toBeNull();
  });

  it("returns null for invalid (self-intersecting) polygon", () => {
    const bowtie = [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]];
    expect(featureToBasemapDoc(feat({ PARCEL_COD: "X1" }, bowtie))).toBeNull();
  });
});
```

- [ ] **Step 2: รันให้ fail** — `npx vitest run lib/m10-ingest/basemap/load.test.ts` → FAIL (module not found)

- [ ] **Step 3: implement `load.ts`**

```ts
import { rewind, booleanValid, feature } from "@turf/turf";
import type { Feature, Polygon, MultiPolygon } from "geojson";

type Geom = Polygon | MultiPolygon;

export interface BasemapDoc {
  parcelCode: string;
  zoneId: string | null; blockId: string | null; lot: string | null;
  deedNo: string | null; landNo: string | null; survey: string | null;
  landType: string | null;
  area: { rai: number; ngan: number; wa: number; sqm: number };
  geometry: Geom;
}

const str = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim();
};
const num = (v: unknown): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

// ตัด ordinate ที่ 3 (Z) ออกจากทุกพิกัด → เหลือ [lng, lat]
function strip3D(coords: unknown): unknown {
  if (Array.isArray(coords) && typeof coords[0] === "number") return [coords[0], coords[1]];
  if (Array.isArray(coords)) return coords.map(strip3D);
  return coords;
}

export function featureToBasemapDoc(f: Feature): BasemapDoc | null {
  const p = f.properties ?? {};
  const parcelCode = str(p.PARCEL_COD);
  if (!parcelCode) return null;
  const g = f.geometry;
  if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) return null;
  const stripped = { type: g.type, coordinates: strip3D((g as Geom).coordinates) } as Geom;
  let geometry: Geom;
  try {
    const rewound = rewind(feature(stripped), { reverse: false }) as Feature<Geom>;
    if (!booleanValid(rewound.geometry)) return null;
    geometry = rewound.geometry;
  } catch { return null; }
  return {
    parcelCode,
    zoneId: str(p.ZONE_ID), blockId: str(p.BLOCK_ID), lot: str(p.LOT),
    deedNo: str(p.Chanod_no), landNo: str(p.LAND_NO), survey: str(p.SURVEY),
    landType: str(p.land_type),
    area: { rai: num(p.rai), ngan: num(p.ngan), wa: num(p.wa), sqm: num(p.area) },
    geometry,
  };
}
```

- [ ] **Step 4: รันให้ผ่าน** — `npx vitest run lib/m10-ingest/basemap/load.test.ts` → PASS

- [ ] **Step 5: Commit** — `git add lib/m10-ingest/basemap/load.* && git commit -m "feat(m10-basemap): featureToBasemapDoc loader (strip Z + validate)"`

---

## Task 3: matchParcel cascade (pure async fn)

**Files:** Create `lib/m10-ingest/basemap/match.ts`, `lib/m10-ingest/basemap/match.test.ts`

> **ก่อนเขียน:** ตรวจ signature ของ `intersect` ใน turf เวอร์ชันที่ติดตั้ง — `npm ls @turf/turf`. v7 ใช้ `intersect(featureCollection([a,b]))`; v6 ใช้ `intersect(a,b)`. โค้ดด้านล่างเขียนแบบ v7; ถ้าเป็น v6 ปรับ `iou()`

- [ ] **Step 1: เขียน failing test** (`match.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { matchParcel, type BasemapCandidate, type MatchResolvers } from "./match";

const SQ = (x: number, y: number, s = 0.001): GeoJSON.Polygon => ({
  type: "Polygon", coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]],
});
const cand = (id: string, code: string, deed: string | null, geom: GeoJSON.Polygon | null): BasemapCandidate =>
  ({ basemapId: id, parcelCode: code, deedNo: deed, geometry: geom });

const none: MatchResolvers = { byDeed: async () => [], byLandSurvey: async () => [], byGeom: async () => [] };
const input = { deedNo: "111", landNo: "5", survey: "9", geometry: SQ(100, 15) };

describe("matchParcel", () => {
  it("deed exact 1 → matched/deed/high", async () => {
    const r = { ...none, byDeed: async () => [cand("b1", "01A001", "111", SQ(100, 15))] };
    const m = await matchParcel(input, r);
    expect(m.status).toBe("matched"); expect(m.method).toBe("deed");
    expect(m.parcelCode).toBe("01A001"); expect(m.basemapId).toBe("b1");
  });

  it("deed multi → geometry ตัดสิน → deed+geom", async () => {
    const r = { ...none, byDeed: async () => [cand("b1", "C1", "111", SQ(0, 0)), cand("b2", "C2", "111", SQ(100, 15))] };
    const m = await matchParcel(input, r);
    expect(m.status).toBe("matched"); expect(m.method).toBe("deed+geom");
    expect(m.parcelCode).toBe("C2"); // ทับกับ input
    expect(m.candidates.length).toBe(2);
  });

  it("deed multi + ไม่ทับ → ambiguous", async () => {
    const r = { ...none, byDeed: async () => [cand("b1", "C1", "111", SQ(0, 0)), cand("b2", "C2", "111", SQ(50, 50))] };
    const m = await matchParcel(input, r);
    expect(m.status).toBe("ambiguous"); expect(m.parcelCode).toBeNull();
    expect(m.candidates.length).toBe(2);
  });

  it("ไม่เจอโฉนด → land+survey เจอ 1 → matched/land+survey", async () => {
    const r = { ...none, byLandSurvey: async () => [cand("b3", "C3", "111", SQ(100, 15))] };
    const m = await matchParcel(input, r);
    expect(m.status).toBe("matched"); expect(m.method).toBe("land+survey"); expect(m.parcelCode).toBe("C3");
  });

  it("ตกมาชั้น geom → overlap ≥ 0.5 → matched/geom", async () => {
    const r = { ...none, byGeom: async () => [cand("b4", "C4", null, SQ(100, 15))] };
    const m = await matchParcel(input, r);
    expect(m.status).toBe("matched"); expect(m.method).toBe("geom"); expect(m.parcelCode).toBe("C4");
  });

  it("geom overlap < 0.5 → ambiguous", async () => {
    const r = { ...none, byGeom: async () => [cand("b5", "C5", null, SQ(100.0008, 15.0008))] }; // ทับน้อย
    const m = await matchParcel(input, r);
    expect(m.status).toBe("ambiguous");
  });

  it("ไม่เจออะไรเลย → unmatched", async () => {
    const m = await matchParcel(input, none);
    expect(m.status).toBe("unmatched"); expect(m.method).toBeNull();
  });

  it("ไม่มี geometry + โฉนดหลาย → ambiguous (ตัดสินด้วย geom ไม่ได้)", async () => {
    const r = { ...none, byDeed: async () => [cand("b1", "C1", "111", SQ(0, 0)), cand("b2", "C2", "111", SQ(1, 1))] };
    const m = await matchParcel({ ...input, geometry: null }, r);
    expect(m.status).toBe("ambiguous");
  });
});
```

- [ ] **Step 2: รันให้ fail** — `npx vitest run lib/m10-ingest/basemap/match.test.ts` → FAIL

- [ ] **Step 3: implement `match.ts`**

```ts
import { area as turfArea, intersect, feature as turfFeature, featureCollection } from "@turf/turf";
import type { Polygon, MultiPolygon } from "geojson";

type Geom = Polygon | MultiPolygon;

export interface BasemapCandidate { basemapId: string; parcelCode: string; deedNo: string | null; geometry: Geom | null; }
export interface MatchInput { deedNo: string | null; landNo: string | null; survey: string | null; geometry: Geom | null; }
export interface MatchResolvers {
  byDeed: (deedNo: string) => Promise<BasemapCandidate[]>;
  byLandSurvey: (landNo: string, survey: string) => Promise<BasemapCandidate[]>;
  byGeom: (geometry: Geom) => Promise<BasemapCandidate[]>;
}
export interface MatchCandidate { parcelCode: string; basemapId: string; deedNo: string | null; overlapPct: number; }
export interface MatchResult {
  status: "matched" | "ambiguous" | "unmatched";
  method: "deed" | "deed+geom" | "land+survey" | "land+survey+geom" | "geom" | null;
  confidence: "high" | "medium" | "low" | null;
  parcelCode: string | null; basemapId: string | null; candidates: MatchCandidate[];
}

const IOU_THRESHOLD = 0.5;

function iou(a: Geom, b: Geom): number {
  try {
    const inter = intersect(featureCollection([turfFeature(a), turfFeature(b)]));
    if (!inter) return 0;
    const ai = turfArea(inter);
    const denom = turfArea(turfFeature(a)) + turfArea(turfFeature(b)) - ai;
    return denom > 0 ? ai / denom : 0;
  } catch { return 0; }
}

function rank(geom: Geom | null, cands: BasemapCandidate[]): MatchCandidate[] {
  return cands
    .map((c) => ({ parcelCode: c.parcelCode, basemapId: c.basemapId, deedNo: c.deedNo,
      overlapPct: geom && c.geometry ? iou(geom, c.geometry) : 0 }))
    .sort((x, y) => y.overlapPct - x.overlapPct);
}

const matched = (method: MatchResult["method"], confidence: MatchResult["confidence"], c: BasemapCandidate, candidates: MatchCandidate[] = []): MatchResult =>
  ({ status: "matched", method, confidence, parcelCode: c.parcelCode, basemapId: c.basemapId, candidates });
const ambiguous = (method: MatchResult["method"], candidates: MatchCandidate[]): MatchResult =>
  ({ status: "ambiguous", method, confidence: "low", parcelCode: null, basemapId: null, candidates });

export async function matchParcel(input: MatchInput, r: MatchResolvers): Promise<MatchResult> {
  // ชั้น 1: โฉนด
  if (input.deedNo) {
    const ds = await r.byDeed(input.deedNo);
    if (ds.length === 1) return matched("deed", "high", ds[0]);
    if (ds.length > 1) {
      const ranked = rank(input.geometry, ds);
      if (input.geometry && ranked[0].overlapPct >= IOU_THRESHOLD) {
        const top = ds.find((c) => c.basemapId === ranked[0].basemapId)!;
        return matched("deed+geom", "high", top, ranked);
      }
      return ambiguous("deed", ranked);
    }
  }
  // ชั้น 2: เลขที่ดิน + หน้าสำรวจ
  if (input.landNo && input.survey) {
    const ls = await r.byLandSurvey(input.landNo, input.survey);
    if (ls.length === 1) return matched("land+survey", "medium", ls[0]);
    if (ls.length > 1) {
      const ranked = rank(input.geometry, ls);
      if (input.geometry && ranked[0].overlapPct >= IOU_THRESHOLD) {
        const top = ls.find((c) => c.basemapId === ranked[0].basemapId)!;
        return matched("land+survey+geom", "medium", top, ranked);
      }
      return ambiguous("land+survey", ranked);
    }
  }
  // ชั้น 3: geometry overlap
  if (input.geometry) {
    const gs = await r.byGeom(input.geometry);
    const ranked = rank(input.geometry, gs).filter((c) => c.overlapPct > 0);
    if (ranked.length > 0) {
      if (ranked[0].overlapPct >= IOU_THRESHOLD) {
        const top = gs.find((c) => c.basemapId === ranked[0].basemapId)!;
        return matched("geom", "medium", top, ranked);
      }
      return ambiguous("geom", ranked);
    }
  }
  return { status: "unmatched", method: null, confidence: null, parcelCode: null, basemapId: null, candidates: [] };
}
```

- [ ] **Step 4: รันให้ผ่าน** — `npx vitest run lib/m10-ingest/basemap/match.test.ts` → PASS

- [ ] **Step 5: Commit** — `git add lib/m10-ingest/basemap/match.* && git commit -m "feat(m10-basemap): matchParcel cascade (deed→land+survey→geom IoU)"`

---

## Task 4: M10Record fields + applyTxnToRecord populate/reconcile

**Files:** Modify `models/m10-ingest/M10Record.js`, `lib/m10-ingest/repository/index.ts`, `lib/m10-ingest/repository/apply.test.ts`

- [ ] **Step 1: เพิ่ม field ใน M10Record.js** (หลัง `deedNo`)

```js
  landNo: { type: String, default: null },
  survey: { type: String, default: null },
  parcelCode: { type: String, default: null, index: true },
  parcelMatch: {
    status: { type: String, default: null },
    method: { type: String, default: null },
    confidence: { type: String, default: null },
    basemapId: { type: mongoose.Schema.Types.ObjectId, default: null },
    candidates: { type: Array, default: [] },
    matchedAt: { type: Date, default: null },
  },
```

- [ ] **Step 2: repository — require M10Basemap + reconcileRecord** (เพิ่มใน `index.ts`)

แก้บรรทัด require ให้รวม M10Basemap:
```ts
const { M10ImportBatch, M10Transaction, M10Record, M10Reject, M10Basemap } = require("../../../models/m10-ingest");
```

เพิ่ม import + ฟังก์ชัน (ใกล้ส่วน asOf/worklist):
```ts
import { matchParcel, type BasemapCandidate } from "../basemap/match";

type Geom = GeoJSON.Polygon | GeoJSON.MultiPolygon;
function toCand(d: Record<string, unknown>): BasemapCandidate {
  return { basemapId: String(d._id), parcelCode: d.parcelCode as string,
    deedNo: (d.deedNo as string) ?? null, geometry: (d.geometry as Geom) ?? null };
}

// reconcile 1 record: รัน matcher (resolver ต่อ DB) แล้วเก็บผล (ไม่ bump version)
export async function reconcileRecord(rec: {
  _id: unknown; recordKey: string; deedNo: string | null; landNo?: string | null; survey?: string | null; geometry: Geom | null;
}): Promise<void> {
  const result = await matchParcel(
    { deedNo: rec.deedNo, landNo: rec.landNo ?? null, survey: rec.survey ?? null, geometry: rec.geometry },
    {
      byDeed: async (deedNo) => (await M10Basemap.find({ deedNo }).lean()).map(toCand),
      byLandSurvey: async (landNo, survey) => (await M10Basemap.find({ landNo, survey }).lean()).map(toCand),
      byGeom: async (geometry) => (await M10Basemap.find({ geometry: { $geoIntersects: { $geometry: geometry } } }).limit(20).lean()).map(toCand),
    }
  );
  await M10Record.updateOne({ _id: rec._id }, { $set: {
    parcelCode: result.parcelCode,
    parcelMatch: { status: result.status, method: result.method, confidence: result.confidence,
      basemapId: result.basemapId, candidates: result.candidates, matchedAt: new Date() },
  } });
}
```

- [ ] **Step 3: applyTxnToRecord — เก็บ landNo/survey + เรียก reconcile**

ใน `TxnDocLike` เพิ่ม `payloadRaw?: Record<string, string>;`
ใน applyTxnToRecord ก่อน create/update เพิ่ม:
```ts
  const landNo = txnDoc.payloadRaw?.["ที่ดิน"] ?? null;
  const survey = txnDoc.payloadRaw?.["ห.สำรวจ"] ?? null;
```
ใส่ `landNo, survey,` ใน object ของ `M10Record.create({...})` และใน `$set` ของ updateOne
ท้ายฟังก์ชัน (หลัง create/update) เพิ่ม:
```ts
  const saved = await M10Record.findOne({ recordKey: txnDoc.recordKey }).select("_id recordKey deedNo landNo survey geometry").lean();
  if (saved) await reconcileRecord(saved as Parameters<typeof reconcileRecord>[0]);
```

- [ ] **Step 4: เพิ่ม integration test ใน apply.test.ts**

```ts
  it("confirm populates landNo/survey + parcelMatch (unmatched when no basemap)", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const geo: GeoJSON.Polygon = { type: "Polygon", coordinates: [[[100, 15], [100.1, 15], [100.1, 15.1], [100, 15]]] };
    const t = await insertTransactionDedup(b._id, txn({ payloadRaw: { "ที่ดิน": "84", "ห.สำรวจ": "13725" } }), geo);
    await confirmTransaction(t.doc._id, "o");
    const rec = await col("m10_records").findOne({ recordKey: "K1" });
    expect(rec?.landNo).toBe("84");
    expect(rec?.survey).toBe("13725");
    expect(rec?.parcelMatch?.status).toBe("unmatched"); // ยังไม่มี basemap
    expect(rec?.version).toBe(1); // reconcile ไม่ bump version
  });
```

- [ ] **Step 5: รัน** — `npx vitest run lib/m10-ingest/repository/apply.test.ts` → PASS (ของเดิม + ใหม่)

- [ ] **Step 6: Commit** — `git add models/m10-ingest/M10Record.js lib/m10-ingest/repository/index.ts lib/m10-ingest/repository/apply.test.ts && git commit -m "feat(m10-basemap): record landNo/survey + reconcileRecord on confirm"`

---

## Task 5: listReconcile + reconcile API

**Files:** Modify `lib/m10-ingest/repository/index.ts`; Create `pages/api/m10-ingest/reconcile.js`

- [ ] **Step 1: เพิ่ม listReconcile ใน index.ts**

```ts
export interface ReconcileRow {
  recordKey: string; deedNo: string | null; changeType: string;
  status: string | null; method: string | null; confidence: string | null;
  parcelCode: string | null; candidates: { parcelCode: string; overlapPct: number }[];
}
export async function listReconcile(filter: { status?: string } = {}): Promise<ReconcileRow[]> {
  const q: Record<string, unknown> = {};
  if (filter.status) q["parcelMatch.status"] = filter.status;
  const rows = await M10Record.find(q)
    .select("recordKey deedNo lastChangeType parcelCode parcelMatch").limit(2000).lean();
  return rows.map((r: Record<string, unknown>) => {
    const pm = (r.parcelMatch ?? {}) as Record<string, unknown>;
    const cands = (pm.candidates as { parcelCode: string; overlapPct: number }[]) ?? [];
    return {
      recordKey: r.recordKey as string, deedNo: (r.deedNo as string) ?? null,
      changeType: (r.lastChangeType as string) ?? "",
      status: (pm.status as string) ?? null, method: (pm.method as string) ?? null,
      confidence: (pm.confidence as string) ?? null, parcelCode: (r.parcelCode as string) ?? null,
      candidates: cands.map((c) => ({ parcelCode: c.parcelCode, overlapPct: c.overlapPct })),
    };
  });
}
```

เพิ่ม `M10Basemap` ใน export ท้ายไฟล์ (`export { ..., M10Basemap };`)

- [ ] **Step 2: สร้าง API** (`pages/api/m10-ingest/reconcile.js`)

```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "./_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  await dbConnect();
  const { listReconcile } = await import("@/lib/m10-ingest/repository/index");
  const rows = await listReconcile({ status: req.query.status ? String(req.query.status) : undefined });
  return res.status(200).json({ rows });
}
```

- [ ] **Step 3: ตรวจ tsc + lint** — `npx tsc --noEmit && npx next lint --dir lib/m10-ingest --dir pages/api/m10-ingest` → ไม่มี error

- [ ] **Step 4: Commit** — `git add lib/m10-ingest/repository/index.ts pages/api/m10-ingest/reconcile.js && git commit -m "feat(m10-basemap): listReconcile + reconcile API"`

---

## Task 6: CLI โหลด basemap + backfill

**Files:** Create `scripts/m10-load-basemap.js`, `scripts/m10-reconcile-backfill.js`

- [ ] **Step 1: load script** (`scripts/m10-load-basemap.js`)

```js
// รัน: node --env-file=.env.local scripts/m10-load-basemap.js public/parcel.shp.geojson
const fs = require("node:fs");
const mongoose = require("mongoose");

(async () => {
  const file = process.argv[2] || "public/parcel.shp.geojson";
  const { M10Basemap } = require("../models/m10-ingest");
  const { featureToBasemapDoc } = await import("../lib/m10-ingest/basemap/load.ts");
  const gj = JSON.parse(fs.readFileSync(file, "utf8"));
  await mongoose.connect(process.env.MONGO_URI);
  await M10Basemap.collection.drop().catch(() => {}); // idempotent
  let ok = 0, skip = 0;
  const buf = [];
  for (const f of gj.features) {
    const d = featureToBasemapDoc(f);
    if (!d) { skip++; continue; }
    buf.push(d); ok++;
    if (buf.length >= 1000) { await M10Basemap.insertMany(buf); buf.length = 0; }
  }
  if (buf.length) await M10Basemap.insertMany(buf);
  await M10Basemap.syncIndexes(); // สร้าง 2dsphere
  console.log(`basemap loaded: ${ok}, skipped(invalid/no-code): ${skip}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
```

> หมายเหตุ: require `.ts` ตรง ๆ ผ่าน dynamic import ใน node อาจไม่ทำงาน — ถ้า error ให้รันด้วย `npx tsx scripts/m10-load-basemap.js ...` (มี tsx เป็น dep แล้ว) หรือเปลี่ยน import เป็น tsx loader. ทดสอบจริงในขั้นรัน

- [ ] **Step 2: รัน load จริง** — `npx tsx --env-file=.env.local scripts/m10-load-basemap.js public/parcel.shp.geojson`
Expected: `basemap loaded: ~13343, skipped: ~93` (ดูจำนวนจริง)

- [ ] **Step 3: backfill script** (`scripts/m10-reconcile-backfill.js`)

```js
// รัน: npx tsx --env-file=.env.local scripts/m10-reconcile-backfill.js
const mongoose = require("mongoose");
(async () => {
  const { M10Record, M10Transaction } = require("../models/m10-ingest");
  const { reconcileRecord } = await import("../lib/m10-ingest/repository/index.ts");
  await mongoose.connect(process.env.MONGO_URI);
  const recs = await M10Record.find({}).lean();
  let done = 0;
  for (const rec of recs) {
    let { landNo, survey } = rec;
    if (landNo == null || survey == null) {
      const t = await M10Transaction.findById(rec.lastTxnId).select("payloadRaw").lean();
      landNo = t?.payloadRaw?.["ที่ดิน"] ?? null;
      survey = t?.payloadRaw?.["ห.สำรวจ"] ?? null;
      await M10Record.updateOne({ _id: rec._id }, { $set: { landNo, survey } });
    }
    await reconcileRecord({ _id: rec._id, recordKey: rec.recordKey, deedNo: rec.deedNo, landNo, survey, geometry: rec.geometry });
    done++;
  }
  console.log(`reconciled ${done} records`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: รัน backfill** — `npx tsx --env-file=.env.local scripts/m10-reconcile-backfill.js`
Expected: `reconciled N records`; ตรวจ distribution ของ parcelMatch.status (matched ส่วนใหญ่)

- [ ] **Step 5: Commit** — `git add scripts/m10-load-basemap.js scripts/m10-reconcile-backfill.js && git commit -m "feat(m10-basemap): CLI load basemap + reconcile backfill"`

---

## Task 7: ReconcilePanel + tab

**Files:** Create `components/m10/ReconcilePanel.jsx`; Modify `pages/admin/m10.jsx`

- [ ] **Step 1: สร้าง ReconcilePanel.jsx**

```jsx
import { useEffect, useState } from "react";

const STATUS_BADGE = { matched: "badge-success", ambiguous: "badge-warning", unmatched: "badge-error" };

export default function ReconcilePanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true); setError("");
      try {
        const url = filter ? `/api/m10-ingest/reconcile?status=${filter}` : "/api/m10-ingest/reconcile";
        const res = await fetch(url);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "โหลดข้อมูลล้มเหลว");
        setRows(d.rows);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [filter]);

  const count = (s) => rows.filter((r) => r.status === s).length;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">จับคู่ basemap (Reconcile)</h2>
      {error && <div className="alert alert-error mb-3">{error}</div>}
      <div className="flex gap-2 mb-4">
        {["", "matched", "ambiguous", "unmatched"].map((s) => (
          <button key={s} className={`btn btn-sm ${filter === s ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(s)}>
            {s === "" ? "ทั้งหมด" : s}{s && ` (${count(s)})`}
          </button>
        ))}
      </div>
      {loading ? <span className="loading loading-spinner" /> : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead><tr><th>recordKey</th><th>โฉนด</th><th>ประเภท</th><th>สถานะ</th><th>วิธี</th><th>PARCEL_COD</th><th>candidates</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.recordKey}>
                  <td className="font-mono text-xs">{r.recordKey}</td>
                  <td>{r.deedNo || "-"}</td>
                  <td><span className="badge badge-sm">{r.changeType}</span></td>
                  <td><span className={`badge badge-sm ${STATUS_BADGE[r.status] || ""}`}>{r.status || "-"}</span></td>
                  <td className="text-xs">{r.method || "-"}</td>
                  <td className="font-mono">{r.parcelCode || "-"}</td>
                  <td className="text-xs">{r.candidates.map((c) => `${c.parcelCode}(${Math.round(c.overlapPct * 100)}%)`).join(", ") || "-"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="text-center opacity-60">ไม่มีข้อมูล</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs opacity-60 mt-3">read-only — การเลือก candidate/สร้างรหัสใหม่เป็นงานรอบถัดไป (B)</p>
    </div>
  );
}
```

- [ ] **Step 2: เพิ่ม tab ใน m10.jsx** — import ReconcilePanel + เพิ่ม `{ key: "reconcile", label: "จับคู่ basemap", Panel: ReconcilePanel }` (ต่อท้าย records ก่อน worklist)

- [ ] **Step 3: ตรวจ lint** — `npx next lint --dir components/m10 --dir pages/admin` → ไม่มี error

- [ ] **Step 4: Commit** — `git add components/m10/ReconcilePanel.jsx pages/admin/m10.jsx && git commit -m "feat(m10-basemap): Reconcile tab (read-only)"`

---

## Task 8: docs + full verify

**Files:** Modify `docs/modules/m10-ingest.md`

- [ ] **Step 1: เพิ่มหัวข้อ basemap/reconcile ใน docs** (ใต้ Worklist section) — สรุป: model M10Basemap, matchParcel cascade, reconcile ตอน confirm+backfill, CLI 2 ตัว, แท็บ Reconcile, รอบ B = นอก scope

- [ ] **Step 2: full verify** — `npx tsc --noEmit && npx vitest run && npx next lint` → ทั้งหมดผ่าน

- [ ] **Step 3: Commit** — `git add docs/modules/m10-ingest.md && git commit -m "docs(m10-basemap): module doc for basemap registry + matcher"`

---

## Self-review notes
- เทสต์ครอบ matchParcel 8 เคส + load 3 เคส + apply integration 1 เคส (รวมของเดิม)
- `prepareGeometry` เดิม reproject 24047→4326 → **ไม่ reuse** กับ basemap (4326 แล้ว); ใช้ rewind+booleanValid ตรง ๆ ใน load.ts แทน
- turf `intersect` signature ต้องเช็คเวอร์ชันก่อน (Task 3 หมายเหตุ)
- `.ts` require ใน node script ต้องรันผ่าน tsx (Task 6 หมายเหตุ)
