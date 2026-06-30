# m10 Basemap Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หน้าเต็มจอ `/admin/m10/basemap` ให้เจ้าหน้าที่เปิดแผนที่มาแก้รูปแปลง basemap (vertex ด้วย geoman) + attribute + วาดแปลงใหม่ → เขียน corrections layer เดิมที่รอด re-import

**Architecture:** ยืม pattern geoman ที่ใช้ได้จริงจาก `smart-saard` (สร้าง native Leaflet layer + `addTo(map)` เองใน `useMap()` child แล้วค่อย `pm.enable()`). โหลดแปลงตาม viewport (bbox `$geoIntersects`) + ค้นหา. บันทึกผ่าน `applyBasemapEdit()` ที่มีอยู่แล้ว (เขียน `m10_basemap_edit` → `m10_basemap`, replay หลัง import).

**Tech Stack:** Next.js 15 pages router, react-leaflet 5, leaflet 1.9.4, @geoman-io/leaflet-geoman-free 2.20, @turf/turf 7.3, MongoDB/Mongoose, vitest + mongodb-memory-server

**Branch:** `new-m10` (commit ทุก task ลง branch นี้)

**Spec:** `docs/superpowers/specs/2026-06-30-m10-basemap-editor-design.md`

---

## File Structure

**สร้างใหม่**
- `lib/m10-ingest/basemap/area.ts` — แปลงไร่-งาน-วา ↔ ตร.ม. + พื้นที่ geodesic (pure)
- `lib/m10-ingest/basemap/area.test.ts` — เทส area.ts
- `lib/m10-ingest/repository/basemap-query.test.ts` — เทส bbox/search + applyBasemapEdit attrs ใหม่
- `pages/api/m10-ingest/basemap/index.js` — GET bbox → FeatureCollection
- `pages/api/m10-ingest/basemap/search.js` — GET ?q= → results
- `pages/api/m10-ingest/basemap/save.js` — POST → applyBasemapEdit
- `pages/admin/m10/basemap.jsx` — page shell (dynamic ssr:false)
- `components/m10/basemap/BasemapGeoman.jsx` — `EditFeature` + `DrawNew`
- `components/m10/basemap/BasemapViewportLoader.jsx` — แจ้ง bbox/zoom ตอน moveend
- `components/m10/basemap/BasemapAttrPanel.jsx` — แผงข้าง: ค้นหา + ฟอร์ม attribute + ปุ่ม
- `components/m10/basemap/BasemapEditor.jsx` — orchestrator (map + state + save)

**แก้ไข**
- `lib/m10-ingest/repository/index.ts` — `BasemapEditInput` + `applyBasemapEdit` (attrs ใหม่ + reorder) + `listBasemapInBbox` + `searchBasemap` + `basemapToFeature`/`escapeRegExp`
- `models/m10-ingest/M10BasemapEdit.js` — เพิ่ม `zoneId/blockId/lot/landType`
- `components/LayoutAdmin.tsx` — เพิ่มเมนู 1 รายการ
- `docs/modules/m10-ingest.md` — section ใหม่

---

## Task 1: area lib (pure, ไร่-งาน-วา ↔ ตร.ม.)

**Files:**
- Create: `lib/m10-ingest/basemap/area.ts`
- Test: `lib/m10-ingest/basemap/area.test.ts`

- [ ] **Step 1: Write failing test**

`lib/m10-ingest/basemap/area.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { partsToSqm, sqmToParts, parseAreaStr, formatAreaStr, geometryAreaSqm } from "./area";

describe("area conversions", () => {
  it("partsToSqm: ไร่/งาน/วา → ตร.ม.", () => {
    expect(partsToSqm(1, 0, 0)).toBe(1600);
    expect(partsToSqm(0, 1, 0)).toBe(400);
    expect(partsToSqm(0, 0, 1)).toBe(4);
    expect(partsToSqm(1, 2, 3)).toBe(2412);
  });
  it("sqmToParts: ตร.ม. → ไร่/งาน/วา", () => {
    expect(sqmToParts(2412)).toEqual({ rai: 1, ngan: 2, wa: 3, sqm: 2412 });
    expect(sqmToParts(0)).toEqual({ rai: 0, ngan: 0, wa: 0, sqm: 0 });
  });
  it("parseAreaStr / formatAreaStr round-trip", () => {
    expect(parseAreaStr("1-2-3")).toEqual({ rai: 1, ngan: 2, wa: 3, sqm: 2412 });
    expect(parseAreaStr("bad")).toBeNull();
    expect(parseAreaStr("1-2")).toBeNull();
    expect(formatAreaStr({ rai: 1, ngan: 2, wa: 3 })).toBe("1-2-3");
    expect(formatAreaStr(null)).toBe("");
  });
  it("geometryAreaSqm: รูปสามจุดขึ้นไปได้พื้นที่ > 0, ไม่ถูกต้อง = 0", () => {
    const sq = { type: "Polygon", coordinates: [[[100, 15], [100.001, 15], [100.001, 15.001], [100, 15.001], [100, 15]]] } as const;
    expect(geometryAreaSqm(sq as unknown as GeoJSON.Polygon)).toBeGreaterThan(0);
    expect(geometryAreaSqm(null)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `npx vitest run lib/m10-ingest/basemap/area.test.ts`
Expected: FAIL — "Failed to resolve import ./area"

- [ ] **Step 3: Implement `area.ts`**

`lib/m10-ingest/basemap/area.ts`:
```ts
// แปลงพื้นที่ไร่-งาน-วา ↔ ตร.ม. + พื้นที่ geodesic จาก geometry (pure)
import { area as turfArea } from "@turf/turf";

export const SQM_PER_WA = 4;
export const WA_PER_NGAN = 100;
export const WA_PER_RAI = 400;
export const SQM_PER_NGAN = WA_PER_NGAN * SQM_PER_WA; // 400
export const SQM_PER_RAI = WA_PER_RAI * SQM_PER_WA; // 1600

export interface AreaParts { rai: number; ngan: number; wa: number; sqm: number; }

// {rai,ngan,wa} → ตร.ม.
export function partsToSqm(rai: number, ngan: number, wa: number): number {
  return rai * SQM_PER_RAI + ngan * SQM_PER_NGAN + wa * SQM_PER_WA;
}

// ตร.ม. → {rai,ngan,wa,sqm} (วา ปัด 2 ตำแหน่ง)
export function sqmToParts(sqm: number): AreaParts {
  if (!sqm || sqm <= 0) return { rai: 0, ngan: 0, wa: 0, sqm: 0 };
  const totalWa = sqm / SQM_PER_WA;
  const rai = Math.floor(totalWa / WA_PER_RAI);
  let remain = totalWa - rai * WA_PER_RAI;
  const ngan = Math.floor(remain / WA_PER_NGAN);
  remain -= ngan * WA_PER_NGAN;
  const wa = Math.round(remain * 100) / 100;
  return { rai, ngan, wa, sqm: Math.round(sqm * 100) / 100 };
}

// "R-N-W" → {rai,ngan,wa,sqm} | null
export function parseAreaStr(str: string | null | undefined): AreaParts | null {
  if (!str || typeof str !== "string") return null;
  const p = str.split("-");
  if (p.length !== 3) return null;
  const rai = Number(p[0]), ngan = Number(p[1]), wa = Number(p[2]);
  if (![rai, ngan, wa].every((n) => Number.isFinite(n))) return null;
  return { rai, ngan, wa, sqm: partsToSqm(rai, ngan, wa) };
}

// {rai,ngan,wa} → "R-N-W"
export function formatAreaStr(a: { rai: number; ngan: number; wa: number } | null | undefined): string {
  if (!a) return "";
  return `${a.rai || 0}-${a.ngan || 0}-${a.wa || 0}`;
}

// geometry → ตร.ม. (turf geodesic)
export function geometryAreaSqm(geom: GeoJSON.Geometry | null | undefined): number {
  if (!geom) return 0;
  try { return Math.round(Math.abs(turfArea(geom)) * 100) / 100; } catch { return 0; }
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `npx vitest run lib/m10-ingest/basemap/area.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/basemap/area.ts lib/m10-ingest/basemap/area.test.ts
git commit -m "feat(m10-basemap): area lib (ไร่-งาน-วา ↔ ตร.ม. + geodesic)"
```

---

## Task 2: ขยาย applyBasemapEdit (attrs ใหม่ + reorder effective-first)

**Files:**
- Modify: `models/m10-ingest/M10BasemapEdit.js`
- Modify: `lib/m10-ingest/repository/index.ts` (`BasemapEditInput` ~308-313, `applyBasemapEdit` ~317-343)
- Test: `lib/m10-ingest/repository/basemap-query.test.ts` (สร้างใหม่ — ใช้ในหลาย task)

- [ ] **Step 1: Write failing test**

`lib/m10-ingest/repository/basemap-query.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { applyBasemapEdit } from "./index";

const POLY = (x: number, y: number, s = 0.001) => ({
  type: "Polygon", coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]],
});

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });
const col = (n: string) => mongoose.connection.db!.collection(n);

describe("applyBasemapEdit — attrs ใหม่ + reorder", () => {
  it("เก็บ zoneId/blockId/lot/landType ลง effective + edit-row", async () => {
    await applyBasemapEdit({
      parcelCode: "07A001", deedNo: "9", landNo: "12", survey: "3",
      zoneId: "07", blockId: "A", lot: "001", landType: "นา",
      area: { rai: 1, ngan: 0, wa: 0, sqm: 1600 }, geometry: POLY(100, 15), kind: "new", by: "o",
    });
    const eff = await col("m10_basemap").findOne({ parcelCode: "07A001" });
    expect(eff?.zoneId).toBe("07");
    expect(eff?.landType).toBe("นา");
    expect(eff?.area?.sqm).toBe(1600);
    const edit = await col("m10_basemap_edit").findOne({ parcelCode: "07A001" });
    expect(edit?.blockId).toBe("A");
    expect(edit?.lot).toBe("001");
  });

  it("geometry ไม่ถูกต้อง → โยน error และไม่เขียนอะไรเลย (effective-first)", async () => {
    await expect(applyBasemapEdit({
      parcelCode: "07B001", geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [0, 0]]] },
    })).rejects.toThrow();
    expect(await col("m10_basemap").countDocuments({ parcelCode: "07B001" })).toBe(0);
    expect(await col("m10_basemap_edit").countDocuments({ parcelCode: "07B001" })).toBe(0);
  });

  it("geometry edit ยุบ fragment เป็น 1 doc (ลำดับใหม่: create ก่อน ลบทีหลัง)", async () => {
    await col("m10_basemap").insertMany([
      { parcelCode: "07C001", geometry: POLY(100, 15) },
      { parcelCode: "07C001", geometry: POLY(100.002, 15) },
    ]);
    await applyBasemapEdit({ parcelCode: "07C001", deedNo: "9", geometry: POLY(100, 15, 0.002), by: "o" });
    expect(await col("m10_basemap").countDocuments({ parcelCode: "07C001" })).toBe(1);
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `npx vitest run lib/m10-ingest/repository/basemap-query.test.ts`
Expected: FAIL — `zoneId` undefined (ยังไม่ได้เก็บ)

- [ ] **Step 3a: เพิ่มฟิลด์ใน `M10BasemapEdit.js`**

แก้ `models/m10-ingest/M10BasemapEdit.js` — เพิ่มหลัง `survey:` (บรรทัด 7):
```js
  survey: { type: String, default: null },
  zoneId: { type: String, default: null },
  blockId: { type: String, default: null },
  lot: { type: String, default: null },
  landType: { type: String, default: null },
```

- [ ] **Step 3b: ขยาย `BasemapEditInput` ใน `repository/index.ts`** (บรรทัด ~308-313)

แทนที่ interface เดิม:
```ts
export interface BasemapEditInput {
  parcelCode: string;
  deedNo?: string | null; landNo?: string | null; survey?: string | null;
  zoneId?: string | null; blockId?: string | null; lot?: string | null; landType?: string | null;
  area?: { rai: number; ngan: number; wa: number; sqm: number } | null;
  geometry?: unknown; kind?: "edit" | "new"; by?: string | null; note?: string | null;
}
```

- [ ] **Step 3c: เขียน `applyBasemapEdit` ใหม่ (effective-first + attrs ใหม่)** (บรรทัด ~317-343)

แทนที่ทั้งฟังก์ชัน:
```ts
export async function applyBasemapEdit(edit: BasemapEditInput): Promise<void> {
  const { parcelCode } = edit;
  if (!parcelCode) throw new Error("parcelCode ว่างไม่ได้");
  let geom: Geom | null = null;
  if (edit.geometry != null) {
    geom = normalizeEditedGeometry(edit.geometry);
    if (!geom) throw new Error("รูปแปลงไม่ถูกต้อง (เส้นตัดกัน/จุดน้อยเกินไป)");
  }
  const attrs = {
    deedNo: edit.deedNo ?? null, landNo: edit.landNo ?? null, survey: edit.survey ?? null,
    zoneId: edit.zoneId ?? null, blockId: edit.blockId ?? null, lot: edit.lot ?? null,
    landType: edit.landType ?? null, area: edit.area ?? null,
  };
  // 1) apply ลง effective ก่อน (MongoDB S2 ตรวจเข้มกว่า turf) — กัน geometry เสียตกค้างใน source of truth
  if (geom) {
    const created = await M10Basemap.create({ parcelCode, ...attrs, geometry: geom }); // S2 throw ที่นี่ถ้าเสีย
    await M10Basemap.deleteMany({ parcelCode, _id: { $ne: created._id } });            // ยุบ fragment เดิม
  } else {
    const r = await M10Basemap.updateMany({ parcelCode }, { $set: attrs });
    if (r.matchedCount === 0) await M10Basemap.create({ parcelCode, ...attrs, geometry: null });
  }
  // 2) upsert edit-row (source of truth) — เฉพาะเมื่อ effective สำเร็จ
  await M10BasemapEdit.updateOne(
    { parcelCode },
    { $set: { ...attrs, geometry: geom, kind: edit.kind ?? "edit", by: edit.by ?? null, note: edit.note ?? null, at: new Date() } },
    { upsert: true }
  );
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `npx vitest run lib/m10-ingest/repository/basemap-query.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run reconcile regression + commit**

Run: `npx vitest run lib/m10-ingest/repository/reconcile.test.ts`
Expected: PASS (ทุก test เดิม — reorder เข้ากันได้)
```bash
git add models/m10-ingest/M10BasemapEdit.js lib/m10-ingest/repository/index.ts lib/m10-ingest/repository/basemap-query.test.ts
git commit -m "feat(m10-basemap): applyBasemapEdit รับ zone/block/lot/landType + เขียน effective ก่อน edit-row"
```

---

## Task 3: bbox query + search ใน repository

**Files:**
- Modify: `lib/m10-ingest/repository/index.ts` (เพิ่มฟังก์ชัน + helper)
- Test: `lib/m10-ingest/repository/basemap-query.test.ts` (เพิ่ม describe)

- [ ] **Step 1: เพิ่ม failing test** (ต่อท้ายไฟล์ test เดิม)

ต่อท้าย `lib/m10-ingest/repository/basemap-query.test.ts` (ก่อนบรรทัดสุดท้าย):
```ts
import { listBasemapInBbox, searchBasemap } from "./index";

describe("listBasemapInBbox", () => {
  it("คืนเฉพาะแปลงที่ตัดกรอบ + ตั้ง truncated เมื่อเกิน limit", async () => {
    await col("m10_basemap").insertMany([
      { parcelCode: "07A001", deedNo: "1", geometry: POLY(100, 15) },
      { parcelCode: "07A002", deedNo: "2", geometry: POLY(100.001, 15) },
      { parcelCode: "07Z999", deedNo: "9", geometry: POLY(105, 15) }, // ไกลออกนอกกรอบ
    ]);
    const bbox: [number, number, number, number] = [99.9, 14.9, 100.1, 15.1];
    const all = await listBasemapInBbox(bbox, 800);
    expect(all.features.length).toBe(2);
    expect(all.truncated).toBe(false);
    expect(all.features[0].properties!.parcelCode).toBeTruthy();
    const capped = await listBasemapInBbox(bbox, 1);
    expect(capped.features.length).toBe(1);
    expect(capped.truncated).toBe(true);
  });
});

describe("searchBasemap", () => {
  it("ค้นด้วยรหัสแปลง (มี /) แบบ prefix และ deedNo แบบตรง", async () => {
    await col("m10_basemap").insertMany([
      { parcelCode: "07K002/004", deedNo: "49166", geometry: POLY(100, 15) },
      { parcelCode: "07K002/004/01", deedNo: "74241", geometry: POLY(100.001, 15) },
      { parcelCode: "09Z001", deedNo: "555", geometry: POLY(101, 16) },
    ]);
    const byCode = await searchBasemap("07K002/004");
    expect(byCode.results.map((r) => r.parcelCode).sort()).toEqual(["07K002/004", "07K002/004/01"]);
    expect(byCode.results[0].bbox).toHaveLength(4);
    const byDeed = await searchBasemap("555");
    expect(byDeed.results.map((r) => r.parcelCode)).toEqual(["09Z001"]);
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `npx vitest run lib/m10-ingest/repository/basemap-query.test.ts`
Expected: FAIL — "listBasemapInBbox is not a function"

- [ ] **Step 3: เพิ่มฟังก์ชันใน `repository/index.ts`**

เพิ่มก่อนบรรทัด `export { M10ImportBatch, ... }` (ท้ายไฟล์ บรรทัด ~482):
```ts
// escape อักขระพิเศษ regex (parcelCode มี "/")
function escapeRegExp(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// basemap doc → GeoJSON Feature (properties = attribute)
function basemapToFeature(d: Record<string, unknown>): GeoJSON.Feature {
  return {
    type: "Feature",
    geometry: (d.geometry ?? null) as GeoJSON.Geometry,
    properties: {
      parcelCode: d.parcelCode ?? null, deedNo: d.deedNo ?? null, landNo: d.landNo ?? null,
      survey: d.survey ?? null, landType: d.landType ?? null, zoneId: d.zoneId ?? null,
      blockId: d.blockId ?? null, lot: d.lot ?? null, area: d.area ?? null,
    },
  };
}

// แปลงในกรอบ bbox=[minLng,minLat,maxLng,maxLat] (cap; เกิน → truncated)
export async function listBasemapInBbox(
  bbox: [number, number, number, number], limit = 800
): Promise<{ features: GeoJSON.Feature[]; truncated: boolean }> {
  const poly = turfBboxPolygon(bbox).geometry;
  const docs = await M10Basemap.find({ geometry: { $geoIntersects: { $geometry: poly } } })
    .limit(limit + 1).lean();
  const truncated = docs.length > limit;
  const sliced = truncated ? docs.slice(0, limit) : docs;
  return { features: sliced.map(basemapToFeature), truncated };
}

// ค้นหารหัสแปลง (มี "/" = prefix) หรือ deedNo (ตรง) → รวมเป็น 1 แถว/รหัส พร้อม bbox สำหรับ flyTo
export async function searchBasemap(
  q: string, limit = 20
): Promise<{ results: { parcelCode: string; deedNo: string | null; bbox: [number, number, number, number] }[] }> {
  const query = q.includes("/")
    ? { parcelCode: new RegExp("^" + escapeRegExp(q)) }
    : { $or: [{ deedNo: q }, { parcelCode: new RegExp("^" + escapeRegExp(q)) }] };
  const docs = await M10Basemap.find(query).select("parcelCode deedNo geometry").limit(200).lean();
  const byCode = new Map<string, { parcelCode: string; deedNo: string | null; geoms: Geom[] }>();
  for (const d of docs) {
    const code = String(d.parcelCode ?? "");
    if (!byCode.has(code)) byCode.set(code, { parcelCode: code, deedNo: (d.deedNo as string) ?? null, geoms: [] });
    if (d.geometry) byCode.get(code)!.geoms.push(d.geometry as Geom);
  }
  const results = [...byCode.values()].slice(0, limit).map((g) => ({
    parcelCode: g.parcelCode, deedNo: g.deedNo,
    bbox: (g.geoms.length
      ? turfBbox(turfFC(g.geoms.map((x) => turfFeature(x))))
      : [0, 0, 0, 0]) as [number, number, number, number],
  }));
  return { results };
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `npx vitest run lib/m10-ingest/repository/basemap-query.test.ts`
Expected: PASS (5 tests รวม)

- [ ] **Step 5: Commit**

```bash
git add lib/m10-ingest/repository/index.ts lib/m10-ingest/repository/basemap-query.test.ts
git commit -m "feat(m10-basemap): repository listBasemapInBbox + searchBasemap"
```

---

## Task 4: API endpoints (bbox / search / save)

**Files:**
- Create: `pages/api/m10-ingest/basemap/index.js`
- Create: `pages/api/m10-ingest/basemap/search.js`
- Create: `pages/api/m10-ingest/basemap/save.js`

> ไม่มี unit test (เป็น thin handler gate+delegate ตาม pattern `reconcile.js`); ตรวจด้วย lint + build ใน Task 9

- [ ] **Step 1: สร้าง `pages/api/m10-ingest/basemap/index.js`**

```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  const parts = String(req.query.bbox || "").split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return res.status(400).json({ error: "bbox ต้องเป็น minLng,minLat,maxLng,maxLat" });
  }
  await dbConnect();
  const { listBasemapInBbox } = await import("@/lib/m10-ingest/repository/index");
  const limit = Math.min(Number(req.query.limit) || 800, 2000);
  const { features, truncated } = await listBasemapInBbox(parts, limit);
  return res.status(200).json({ type: "FeatureCollection", features, truncated });
}
```

- [ ] **Step 2: สร้าง `pages/api/m10-ingest/basemap/search.js`**

```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "ต้องระบุคำค้น" });
  await dbConnect();
  const { searchBasemap } = await import("@/lib/m10-ingest/repository/index");
  const { results } = await searchBasemap(q);
  return res.status(200).json({ results });
}
```

- [ ] **Step 3: สร้าง `pages/api/m10-ingest/basemap/save.js`**

```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../_auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  const b = req.body || {};
  if (!b.parcelCode || typeof b.parcelCode !== "string" || !b.parcelCode.trim()) {
    return res.status(400).json({ error: "ต้องระบุรหัสแปลง (parcelCode)" });
  }
  await dbConnect();
  const { applyBasemapEdit } = await import("@/lib/m10-ingest/repository/index");
  const by = auth.name || auth.userId;
  try {
    await applyBasemapEdit({
      parcelCode: b.parcelCode.trim(),
      deedNo: b.deedNo ?? null, landNo: b.landNo ?? null, survey: b.survey ?? null,
      zoneId: b.zoneId ?? null, blockId: b.blockId ?? null, lot: b.lot ?? null, landType: b.landType ?? null,
      area: b.area ?? null, geometry: b.geometry ?? undefined,
      kind: b.kind === "new" ? "new" : "edit", by,
    });
    return res.status(200).json({ ok: true, parcelCode: b.parcelCode.trim() });
  } catch (e) {
    const msg = e?.message || "บันทึกไม่สำเร็จ";
    const isGeom = /รูปแปลง|geo|loop|edges|S2|coordinates|Polygon/i.test(msg);
    return res.status(isGeom ? 422 : 500).json({ error: msg });
  }
}
```

- [ ] **Step 4: Lint**

Run: `npx next lint --dir pages/api/m10-ingest/basemap`
Expected: ไม่มี error

- [ ] **Step 5: Commit**

```bash
git add pages/api/m10-ingest/basemap
git commit -m "feat(m10-basemap): API bbox/search/save (gate /admin/m10)"
```

---

## Task 5: geoman editor components (EditFeature + DrawNew)

**Files:**
- Create: `components/m10/basemap/BasemapGeoman.jsx`

> Component แผนที่ทดสอบด้วยตา (ไม่มี runner สำหรับ leaflet ในโปรเจกต์); ตรวจด้วย lint + build + manual ใน Task 9-10

- [ ] **Step 1: สร้าง `components/m10/basemap/BasemapGeoman.jsx`**

```jsx
import { useEffect, useRef, useCallback } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

// แก้ vertex แปลงเดียว: สร้าง native layer + addTo(map) เองแล้วค่อย pm.enable
// (geoman เกาะ native layer ที่ map เป็นเจ้าของ → handle ขึ้น; ต่างจากการใส่บน <Polygon> ของ react-leaflet)
export function EditFeature({ feature, onCollect }) {
  const map = useMap();
  const fgRef = useRef(null);

  useEffect(() => {
    if (!map || !feature) return;
    const fg = L.featureGroup().addTo(map);
    fgRef.current = fg;
    const geoLayer = L.geoJSON(feature, {
      style: () => ({ color: "#f59e0b", weight: 3, fillColor: "#fef3c7", fillOpacity: 0.35 }),
    });
    geoLayer.eachLayer((l) => fg.addLayer(l));
    fg.eachLayer((l) => { if (l.pm) l.pm.enable({ allowSelfIntersection: false }); });
    map.pm.setGlobalOptions({ allowSelfIntersection: false, snappable: true, snapDistance: 15 });
    try {
      const b = fg.getBounds();
      if (b.isValid()) map.fitBounds(b, { padding: [60, 60], maxZoom: 20 });
    } catch { /* noop */ }
    return () => {
      fg.eachLayer((l) => { if (l.pm) l.pm.disable(); });
      map.removeLayer(fg);
      fgRef.current = null;
    };
  }, [map, feature]);

  const collect = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return null;
    let geom = null;
    fg.eachLayer((l) => { geom = l.toGeoJSON()?.geometry ?? null; });
    return geom;
  }, []);

  useEffect(() => { if (onCollect) onCollect.current = collect; }, [collect, onCollect]);
  return null;
}

// วาดแปลงใหม่ → onCreated(geometry)
export function DrawNew({ onCreated }) {
  const map = useMap();
  const createdRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    map.pm.setGlobalOptions({
      allowSelfIntersection: false, snappable: true, snapDistance: 15,
      templineStyle: { color: "#16a34a", weight: 3 },
      hintlineStyle: { color: "#16a34a", dashArray: "5,5", weight: 2 },
      pathOptions: { color: "#16a34a", weight: 3, fillColor: "#bbf7d0", fillOpacity: 0.35 },
    });
    map.pm.enableDraw("Polygon", { finishOn: "dblclick" });
    const handle = (e) => {
      createdRef.current = e.layer;
      const geo = e.layer.toGeoJSON();
      map.pm.disableDraw();
      onCreated(geo.geometry);
    };
    map.on("pm:create", handle);
    return () => {
      map.pm.disableDraw();
      map.off("pm:create", handle);
      if (createdRef.current) { try { map.removeLayer(createdRef.current); } catch { /* noop */ } createdRef.current = null; }
    };
  }, [map, onCreated]);
  return null;
}
```

- [ ] **Step 2: Lint**

Run: `npx next lint --dir components/m10/basemap`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add components/m10/basemap/BasemapGeoman.jsx
git commit -m "feat(m10-basemap): geoman EditFeature + DrawNew (native-layer pattern จาก smart-saard)"
```

---

## Task 6: viewport loader

**Files:**
- Create: `components/m10/basemap/BasemapViewportLoader.jsx`

- [ ] **Step 1: สร้างไฟล์**

```jsx
import { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";

// แจ้ง bbox + zoom (debounce) เมื่อแผนที่ขยับ; zoom < minZoom → ส่ง bbox = null (parent โชว์ป้าย "ซูมเข้า")
export default function BasemapViewportLoader({ onViewport, minZoom }) {
  const map = useMap();
  const timer = useRef(null);

  const fire = () => {
    const z = map.getZoom();
    if (z < minZoom) { onViewport(null, z); return; }
    const b = map.getBounds();
    onViewport([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], z);
  };

  useMapEvents({
    moveend() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(fire, 400);
    },
  });

  useEffect(() => {
    map.whenReady(() => fire());
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}
```

- [ ] **Step 2: Lint**

Run: `npx next lint --dir components/m10/basemap`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add components/m10/basemap/BasemapViewportLoader.jsx
git commit -m "feat(m10-basemap): viewport loader (debounced bbox + min-zoom gate)"
```

---

## Task 7: attribute panel

**Files:**
- Create: `components/m10/basemap/BasemapAttrPanel.jsx`

- [ ] **Step 1: สร้างไฟล์**

```jsx
import { useState } from "react";
import { formatAreaStr, sqmToParts } from "@/lib/m10-ingest/basemap/area";

const FIELDS = [
  { key: "parcelCode", label: "รหัสแปลง (PARCEL_COD)" },
  { key: "deedNo", label: "เลขโฉนด" },
  { key: "landNo", label: "เลขที่ดิน" },
  { key: "survey", label: "หน้าสำรวจ" },
  { key: "landType", label: "ประเภทที่ดิน" },
  { key: "zoneId", label: "Zone" },
  { key: "blockId", label: "Block" },
  { key: "lot", label: "Lot" },
];

export default function BasemapAttrPanel({
  mode, selected, form, setForm, areaSqm,
  onEdit, onDraw, onSave, onCancel, saving,
  onSearch, searchResults, onPickResult, searching,
}) {
  const [q, setQ] = useState("");
  const editing = mode === "edit" || mode === "draw";
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const areaParts = areaSqm != null ? sqmToParts(areaSqm) : null;

  return (
    <div className="w-80 shrink-0 h-full overflow-y-auto border-l bg-base-100 p-3 space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); onSearch(q); }} className="join w-full">
        <input className="input input-sm input-bordered join-item w-full" placeholder="ค้นหารหัสแปลง / โฉนด"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-sm join-item" type="submit">{searching ? "…" : "ค้นหา"}</button>
      </form>
      {searchResults?.length > 0 && (
        <ul className="menu menu-sm bg-base-200 rounded-box max-h-40 overflow-y-auto flex-nowrap">
          {searchResults.map((r) => (
            <li key={r.parcelCode}>
              <a onClick={() => onPickResult(r)}>{r.parcelCode}{r.deedNo ? ` · โฉนด ${r.deedNo}` : ""}</a>
            </li>
          ))}
        </ul>
      )}

      <div className="divider my-1" />

      {!selected && mode === "view" && (
        <p className="text-sm opacity-60">คลิกแปลงบนแผนที่เพื่อดู/แก้ หรือกด “วาดแปลงใหม่”</p>
      )}

      {(selected || editing) && (
        <>
          <div className="grid grid-cols-1 gap-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="text-xs block">
                <span className="opacity-60">{f.label}</span>
                <input className="input input-sm input-bordered w-full" disabled={!editing}
                  value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
              </label>
            ))}
          </div>
          {areaParts && (
            <p className="text-xs opacity-70">พื้นที่จากรูป: <b>{formatAreaStr(areaParts)}</b> (≈{areaParts.sqm} ตร.ม.)</p>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        {mode === "view" && selected && <button className="btn btn-sm btn-primary" onClick={onEdit}>แก้ไข</button>}
        {mode === "view" && <button className="btn btn-sm" onClick={onDraw}>วาดแปลงใหม่</button>}
        {editing && <button className="btn btn-sm btn-success" onClick={onSave} disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึก"}</button>}
        {editing && <button className="btn btn-sm btn-ghost" onClick={onCancel} disabled={saving}>ยกเลิก</button>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npx next lint --dir components/m10/basemap`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add components/m10/basemap/BasemapAttrPanel.jsx
git commit -m "feat(m10-basemap): attribute panel (search + form + พื้นที่ไร่-งาน-วา)"
```

---

## Task 8: orchestrator (BasemapEditor)

**Files:**
- Create: `components/m10/basemap/BasemapEditor.jsx`

- [ ] **Step 1: สร้างไฟล์**

```jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { EditFeature, DrawNew } from "./BasemapGeoman";
import BasemapViewportLoader from "./BasemapViewportLoader";
import BasemapAttrPanel from "./BasemapAttrPanel";
import { geometryAreaSqm } from "@/lib/m10-ingest/basemap/area";

const MIN_ZOOM = 16;
const CENTER = [15.255, 100.342]; // เทศบาลเมืองตาคลี
const EMPTY_FORM = { parcelCode: "", deedNo: "", landNo: "", survey: "", landType: "", zoneId: "", blockId: "", lot: "" };

// เก็บ ref ของ map ไว้สั่ง flyToBounds จากผลค้นหา
function MapRef({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

export default function BasemapEditor() {
  const mapRef = useRef(null);
  const collectRef = useRef(null);
  const [features, setFeatures] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [lowZoom, setLowZoom] = useState(true);
  const [selectedCode, setSelectedCode] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [mode, setMode] = useState("view"); // view | edit | draw
  const [form, setForm] = useState(EMPTY_FORM);
  const [drawnGeom, setDrawnGeom] = useState(null);
  const [areaSqm, setAreaSqm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [lastBbox, setLastBbox] = useState(null);

  const loadBbox = useCallback(async (bbox) => {
    try {
      const r = await fetch(`/api/m10-ingest/basemap?bbox=${bbox.join(",")}`);
      const j = await r.json();
      setFeatures(j.features || []);
      setTruncated(!!j.truncated);
    } catch { /* noop */ }
  }, []);

  const onViewport = useCallback((bbox) => {
    if (!bbox) { setLowZoom(true); setFeatures([]); return; }
    setLowZoom(false); setLastBbox(bbox); loadBbox(bbox);
  }, [loadBbox]);

  const formFromProps = (p) => ({
    parcelCode: p.parcelCode ?? "", deedNo: p.deedNo ?? "", landNo: p.landNo ?? "",
    survey: p.survey ?? "", landType: p.landType ?? "", zoneId: p.zoneId ?? "",
    blockId: p.blockId ?? "", lot: p.lot ?? "",
  });

  const selectFeature = (f) => {
    if (mode !== "view") return;
    setSelectedCode(f.properties.parcelCode);
    setSelectedFeature(f);
    setForm(formFromProps(f.properties));
    setAreaSqm(geometryAreaSqm(f.geometry));
  };

  const onEdit = () => { if (selectedFeature) setMode("edit"); };
  const onDraw = () => {
    setSelectedCode(null); setSelectedFeature(null); setForm(EMPTY_FORM);
    setDrawnGeom(null); setAreaSqm(null); setMode("draw");
  };
  const onCreated = (geom) => { setDrawnGeom(geom); setAreaSqm(geometryAreaSqm(geom)); };
  const onCancel = () => { setMode("view"); setDrawnGeom(null); collectRef.current = null; };

  const onSave = async () => {
    if (!form.parcelCode?.trim()) { alert("ต้องระบุรหัสแปลง"); return; }
    let geometry;
    if (mode === "edit") geometry = collectRef.current ? collectRef.current() : null;
    else if (mode === "draw") geometry = drawnGeom;
    if (mode === "draw" && !geometry) { alert("ยังไม่ได้วาดรูปแปลง"); return; }
    setSaving(true);
    try {
      const body = { ...form, geometry: geometry || undefined, kind: mode === "draw" ? "new" : "edit" };
      const r = await fetch("/api/m10-ingest/basemap/save", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) { alert(j.error || "บันทึกไม่สำเร็จ"); return; }
      setMode("view"); setDrawnGeom(null); collectRef.current = null;
      setSelectedCode(null); setSelectedFeature(null);
      if (lastBbox) loadBbox(lastBbox);
    } finally { setSaving(false); }
  };

  const onSearch = async (q) => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(`/api/m10-ingest/basemap/search?q=${encodeURIComponent(q.trim())}`);
      const j = await r.json();
      setSearchResults(j.results || []);
    } finally { setSearching(false); }
  };
  const onPickResult = (r) => {
    if (mapRef.current && r.bbox && r.bbox[0] !== r.bbox[2]) {
      mapRef.current.flyToBounds([[r.bbox[1], r.bbox[0]], [r.bbox[3], r.bbox[2]]], { maxZoom: 19 });
    }
    setSearchResults([]);
  };

  const fc = useMemo(() => ({ type: "FeatureCollection", features }), [features]);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full">
      <div className="relative flex-1">
        {lowZoom && <div className="absolute z-[1000] top-2 left-1/2 -translate-x-1/2 badge badge-warning">ซูมเข้าเพื่อโหลดแปลง</div>}
        {truncated && !lowZoom && <div className="absolute z-[1000] top-2 left-1/2 -translate-x-1/2 badge badge-error">แปลงเยอะเกิน — ซูมเข้าอีก</div>}
        <MapContainer center={CENTER} zoom={15} maxZoom={21} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxNativeZoom={19} maxZoom={21} />
          <MapRef mapRef={mapRef} />
          <BasemapViewportLoader onViewport={onViewport} minZoom={MIN_ZOOM} />
          {mode !== "edit" && (
            <GeoJSON
              key={features.length + "|" + selectedCode + "|" + mode}
              data={fc}
              style={(f) => ({
                color: f.properties.parcelCode === selectedCode ? "#16a34a" : "#6b7280",
                weight: f.properties.parcelCode === selectedCode ? 3 : 1,
                fillOpacity: f.properties.parcelCode === selectedCode ? 0.3 : 0.05,
              })}
              onEachFeature={(f, layer) => {
                layer.on("click", () => selectFeature(f));
                if (f.properties.parcelCode) {
                  layer.bindTooltip(String(f.properties.parcelCode), { permanent: true, direction: "center", className: "parcel-label" });
                }
              }}
            />
          )}
          {mode === "edit" && selectedFeature && <EditFeature feature={selectedFeature} onCollect={collectRef} />}
          {mode === "draw" && <DrawNew onCreated={onCreated} />}
        </MapContainer>
      </div>
      <BasemapAttrPanel
        mode={mode} selected={selectedCode} form={form} setForm={setForm} areaSqm={areaSqm}
        onEdit={onEdit} onDraw={onDraw} onSave={onSave} onCancel={onCancel} saving={saving}
        onSearch={onSearch} searchResults={searchResults} onPickResult={onPickResult} searching={searching}
      />
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npx next lint --dir components/m10/basemap`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add components/m10/basemap/BasemapEditor.jsx
git commit -m "feat(m10-basemap): orchestrator (viewport load + select + edit/draw + save)"
```

---

## Task 9: page shell + nav + docs + build

**Files:**
- Create: `pages/admin/m10/basemap.jsx`
- Modify: `components/LayoutAdmin.tsx` (`navigationItems` ~บรรทัด 32)
- Modify: `docs/modules/m10-ingest.md`

- [ ] **Step 1: สร้าง `pages/admin/m10/basemap.jsx`**

```jsx
import Head from "next/head";
import dynamic from "next/dynamic";

const BasemapEditor = dynamic(() => import("@/components/m10/basemap/BasemapEditor"), {
  ssr: false,
  loading: () => <div className="p-6">กำลังโหลดแผนที่…</div>,
});

export default function M10BasemapPage() {
  return (
    <>
      <Head><title>แก้รูปแปลง basemap (ม.10)</title></Head>
      <BasemapEditor />
    </>
  );
}
```

- [ ] **Step 2: เพิ่มเมนูใน `components/LayoutAdmin.tsx`**

หลังบรรทัด `{ label: 'แผนที่ภาษี (ม.10)', href: '/admin/m10', ... }` (บรรทัด 32) เพิ่ม:
```tsx
  { label: 'แก้รูปแปลง (basemap)', href: '/admin/m10/basemap',          icon: '✏️', group: 'จัดการ' },
```

- [ ] **Step 3: อัปเดต `docs/modules/m10-ingest.md`** — ต่อท้ายไฟล์:
```markdown
## Basemap editor (หน้าแยก — 2026-06-30)
- หน้าเต็มจอ `/admin/m10/basemap` (อยู่ใต้ permission `/admin/m10` ผ่าน prefix-match — ไม่ต้อง migration) เปิดแผนที่มาแก้ basemap โดยตรง แยกจาก flow reconcile
- ยืม pattern geoman จาก `smart-saard/components/TaxMapView.js`: native Leaflet layer (`L.geoJSON().addTo(map)` ใน `useMap()` child) แล้ว `pm.enable()` — handle ขึ้น (m10 เดิมใส่บน `<Polygon>` react-leaflet เลยไม่ขึ้น)
- โหลดแปลงตาม viewport (`listBasemapInBbox`, `$geoIntersects`, MIN_ZOOM=16, cap 800 → `truncated`) + ค้นหา (`searchBasemap` รหัส/โฉนด → flyToBounds)
- เลือกแปลง → แก้ vertex (`EditFeature`) + attribute (parcelCode/โฉนด/เลขที่ดิน/หน้าสำรวจ/landType/zone/block/lot) · วาดใหม่ (`DrawNew`) → `kind:"new"`
- บันทึก = `POST /api/m10-ingest/basemap/save` → `applyBasemapEdit` (เขียน `m10_basemap_edit` → `m10_basemap`, รอด re-import). geometry S2 reject → 422
- `applyBasemapEdit` เขียน effective ก่อน edit-row (กัน geometry เสียตกค้างใน source of truth) + รับ zone/block/lot/landType
- ไฟล์: `components/m10/basemap/*` · `lib/m10-ingest/basemap/area.ts` · `pages/api/m10-ingest/basemap/*`
- **นอก scope:** ลบแปลง (`kind:"delete"`), land-use, export `.geojson`, เอนจินรหัส SPLIT/MERGE/NEW

Spec: `docs/superpowers/specs/2026-06-30-m10-basemap-editor-design.md` · Plan: `docs/superpowers/plans/2026-06-30-m10-basemap-editor.md`
```

- [ ] **Step 4: Lint + full test + build**

Run: `npx next lint --dir pages/admin/m10 --dir components/m10/basemap`
Expected: ไม่มี error

Run: `npx vitest run lib/m10-ingest`
Expected: PASS ทั้งหมด (รวมของเดิม + area + basemap-query)

Run: `npm run build`
Expected: exit 0; route `/admin/m10/basemap` ปรากฏใน build output (ตรวจว่า `pages/admin/m10.jsx` + `pages/admin/m10/basemap.jsx` อยู่ร่วมกันได้)

- [ ] **Step 5: Commit**

```bash
git add pages/admin/m10/basemap.jsx components/LayoutAdmin.tsx docs/modules/m10-ingest.md
git commit -m "feat(m10-basemap): page /admin/m10/basemap + nav + docs"
```

---

## Task 10: manual smoke test (ต้องรัน dev)

> ตรวจของจริงหลัง build ผ่าน — ทำเมื่อผู้ใช้กลับมาหน้าจอ

- [ ] เปิด `npm run dev` → `/admin/m10/basemap`
- [ ] ซูมเข้าในเขตเทศบาล (zoom ≥16) → แปลงโหลด + label PARCEL_COD ขึ้น
- [ ] คลิกแปลง → panel โชว์ attribute; กด [แก้ไข] → **มีจุด vertex ลากได้** (จุดที่ smart-saard แก้ได้, m10 เดิมแก้ไม่ได้)
- [ ] ขยับ vertex → [บันทึก] → reload เห็นรูปใหม่
- [ ] กด [วาดแปลงใหม่] → วาด (dblclick จบ) → ใส่ parcelCode → [บันทึก] → แปลงใหม่ขึ้น
- [ ] ค้นหารหัส/โฉนด → คลิกผล → แผนที่บินไปถูกแปลง

---

## Self-Review (เช็คก่อนส่ง)

**Spec coverage:**
- หน้าเต็มจอ `/admin/m10/basemap` → Task 9 ✓
- viewport bbox + min-zoom + truncated → Task 3 (`listBasemapInBbox`) + Task 6 + Task 8 ✓
- ค้นหา parcelCode/โฉนด → Task 3 (`searchBasemap`) + Task 4 + Task 8 ✓
- แก้ vertex (geoman native-layer) → Task 5 (`EditFeature`) ✓
- แก้ attribute → Task 7 + Task 8 ✓
- วาดใหม่ → Task 5 (`DrawNew`) + Task 8 ✓
- บันทึก corrections layer → Task 2 (`applyBasemapEdit` reorder + attrs) + Task 4 (`save.js`) ✓
- area ไร่-งาน-วา + geodesic → Task 1 ✓
- permission ผ่าน prefix-match (ไม่ migration) → Task 4 (gate `/admin/m10`) + Task 9 (nav) ✓
- S2 reject → 422 → Task 4 ✓

**Type consistency:** `BasemapEditInput` (Task 2) ↔ `save.js` body (Task 4) ↔ form keys (Task 7/8) ใช้ชื่อเดียวกันทั้งหมด: parcelCode/deedNo/landNo/survey/landType/zoneId/blockId/lot/area/geometry/kind ✓. `onCollect.current` คืน geometry (Task 5) ↔ `onSave` ใช้เป็น geometry (Task 8) ✓. `onViewport(bbox|null, zoom)` (Task 6) ↔ parent (Task 8) ✓.

**Out-of-scope ที่ตั้งใจไม่ทำ:** ลบแปลง, land-use, export .geojson, เอนจิน SPLIT/MERGE/NEW — ไม่มี task (ถูกต้อง)

**หมายเหตุ:** ความสูง `h-[calc(100vh-4rem)]` (Task 8) เป็นค่าประมาณ chrome ของ LayoutAdmin — ปรับใน manual test ถ้าแผนที่ล้น/สั้นเกิน
