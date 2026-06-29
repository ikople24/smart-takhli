# m10 Reconcile Map Editor (เฟส 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** เจ้าหน้าที่เปิดแผนที่เทียบ m10 polygon ↔ basemap, เลือกแปลงที่ถูก + แก้ attribute, บันทึกเป็น override (กัน replay), แล้วเช็คใหม่

**Architecture:** repository เพิ่ม getReconcileItem/resolveReconcile + override-aware; API detail/resolve; ReconcileMap (react-leaflet ssr:false) + ReconcilePanel focus mode

**Tech Stack:** react-leaflet 5, leaflet 1.9, Mongoose, @turf/turf, vitest + mongodb-memory-server

Spec: `docs/superpowers/specs/2026-06-29-m10-reconcile-map-editor-design.md`

---

## Task 1: M10Record.reconcileOverride

**Files:** Modify `models/m10-ingest/M10Record.js`

- [ ] เพิ่มหลัง `parcelMatch`:
```js
  reconcileOverride: {
    parcelCode: { type: String, default: null },
    deedNo: { type: String, default: null },
    landNo: { type: String, default: null },
    survey: { type: String, default: null },
    area: { rai: Number, ngan: Number, wa: Number, sqm: Number },
    status: { type: String, default: null }, // "resolved"
    note: { type: String, default: null },
    by: { type: String, default: null },
    at: { type: Date, default: null },
  },
```
- [ ] Commit: `feat(m10-reconcile): M10Record.reconcileOverride field`

---

## Task 2: repository — getReconcileItem, resolveReconcile, skip-resolved

**Files:** Modify `lib/m10-ingest/repository/index.ts`, `lib/m10-ingest/repository/reconcile.test.ts` (new)

- [ ] **Step 1: reconcileRecord ข้าม resolved** — เพิ่มต้นฟังก์ชัน `reconcileRecord`:
```ts
  const cur = await M10Record.findById(rec._id).select("reconcileOverride").lean();
  if (cur?.reconcileOverride?.status === "resolved") return; // ไม่ทับการตัดสินของคน
```

- [ ] **Step 2: getReconcileItem + resolveReconcile** (เพิ่มก่อน export ท้ายไฟล์):
```ts
export async function getReconcileItem(recordKey: string) {
  const rec = await M10Record.findOne({ recordKey })
    .select("recordKey deedNo landNo survey area geometry parcelCode parcelMatch reconcileOverride").lean();
  if (!rec) return null;
  const candIds = (rec.parcelMatch?.candidates ?? []).map((c: { basemapId: string }) => c.basemapId).filter(Boolean);
  const candDocs = candIds.length ? await M10Basemap.find({ _id: { $in: candIds } }).select("parcelCode deedNo geometry").lean() : [];
  const candMap = new Map(candDocs.map((d: Record<string, unknown>) => [String(d._id), d]));
  const candidates = (rec.parcelMatch?.candidates ?? []).map((c: { basemapId: string; parcelCode: string; deedNo: string | null; overlapPct: number }) => ({
    parcelCode: c.parcelCode, basemapId: c.basemapId, deedNo: c.deedNo, overlapPct: c.overlapPct,
    geometry: (candMap.get(c.basemapId) as { geometry?: unknown })?.geometry ?? null,
  }));
  // nearby = basemap ใน bbox ของ geometry (context) จำกัด 50
  let nearby: { parcelCode: string; geometry: unknown }[] = [];
  if (rec.geometry) {
    const near = await M10Basemap.find({ geometry: { $geoIntersects: { $geometry: bboxPolygon(rec.geometry as Geom) } } })
      .select("parcelCode geometry").limit(50).lean();
    nearby = near.map((d: Record<string, unknown>) => ({ parcelCode: d.parcelCode as string, geometry: d.geometry }));
  }
  return { record: rec, candidates, nearby };
}

export async function resolveReconcile(recordKey: string, by: string, input: {
  parcelCode?: string | null; deedNo?: string | null; landNo?: string | null; survey?: string | null;
  area?: { rai: number; ngan: number; wa: number; sqm: number } | null; note?: string | null;
}) {
  const rec = await M10Record.findOne({ recordKey }).lean();
  if (!rec) throw new Error("record not found");
  // re-match ด้วย attribute ใหม่ (geometry เดิม) — เรียก matchParcel ตรง ไม่ผ่าน guard
  const deedNo = input.deedNo ?? rec.deedNo;
  const landNo = input.landNo ?? rec.landNo ?? null;
  const survey = input.survey ?? rec.survey ?? null;
  const match = await matchParcel(
    { deedNo, landNo, survey, geometry: (rec.geometry as Geom) ?? null },
    {
      byDeed: async (d) => (await M10Basemap.find({ deedNo: d }).lean()).map(toCand),
      byLandSurvey: async (l, s) => (await M10Basemap.find({ landNo: l, survey: s }).lean()).map(toCand),
      byGeom: async (g) => (await M10Basemap.find({ geometry: { $geoIntersects: { $geometry: g } } }).limit(20).lean()).map(toCand),
    }
  );
  const override = {
    parcelCode: input.parcelCode ?? match.parcelCode,
    deedNo: input.deedNo ?? null, landNo: input.landNo ?? null, survey: input.survey ?? null,
    area: input.area ?? null, status: "resolved", note: input.note ?? null, by, at: new Date(),
  };
  await M10Record.updateOne({ recordKey }, { $set: {
    reconcileOverride: override,
    parcelMatch: { status: match.status, method: match.method, confidence: match.confidence,
      basemapId: match.basemapId, candidates: match.candidates, matchedAt: new Date() },
  } });
  return { ok: true, status: "resolved", parcelCode: override.parcelCode };
}
```
+ helper `bboxPolygon` (turf `bbox` + `bboxPolygon`) import; + export ทั้งสองใน `export {}` ปลายไฟล์ไม่ต้อง (เป็น named export อยู่แล้ว)

- [ ] **Step 3: import turf bbox helpers** — บนสุดไฟล์ basemap import ไม่มี; เพิ่ม:
```ts
import { bbox as turfBbox, bboxPolygon as turfBboxPolygon } from "@turf/turf";
function bboxPolygon(g: Geom): GeoJSON.Polygon { return turfBboxPolygon(turfBbox(g)).geometry; }
```

- [ ] **Step 4: integration test** (`reconcile.test.ts`):
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { resolveReconcile, reconcileRecord, getReconcileItem } from "./index";

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });
const col = (n: string) => mongoose.connection.db!.collection(n);

describe("resolveReconcile", () => {
  it("stores override resolved + chosen parcelCode wins", async () => {
    await col("m10_records").insertOne({ recordKey: "K1", deedNo: "1", geometry: null, parcelMatch: { status: "ambiguous", candidates: [] } });
    const r = await resolveReconcile("K1", "officer1", { parcelCode: "07A001", note: "เลือกเอง" });
    expect(r.parcelCode).toBe("07A001");
    const rec = await col("m10_records").findOne({ recordKey: "K1" });
    expect(rec?.reconcileOverride?.status).toBe("resolved");
    expect(rec?.reconcileOverride?.by).toBe("officer1");
  });

  it("reconcileRecord skips a resolved record (no clobber)", async () => {
    await col("m10_records").insertOne({ recordKey: "K1", deedNo: "1", geometry: null,
      reconcileOverride: { status: "resolved", parcelCode: "07A001", by: "o", at: new Date() } });
    await reconcileRecord({ _id: (await col("m10_records").findOne({ recordKey: "K1" }))!._id, recordKey: "K1", deedNo: "1", geometry: null });
    const rec = await col("m10_records").findOne({ recordKey: "K1" });
    expect(rec?.reconcileOverride?.parcelCode).toBe("07A001"); // ยังอยู่
    expect(rec?.parcelMatch).toBeUndefined(); // reconcileRecord ออกก่อนเขียน
  });

  it("getReconcileItem returns null for missing", async () => {
    expect(await getReconcileItem("NOPE")).toBeNull();
  });
});
```

- [ ] **Step 5: run** `npx vitest run lib/m10-ingest/repository/reconcile.test.ts` → PASS; `npx tsc --noEmit` → 0
- [ ] **Step 6: Commit** `feat(m10-reconcile): getReconcileItem + resolveReconcile + skip-resolved`

---

## Task 3: API detail + resolve

**Files:** Create `pages/api/m10-ingest/reconcile/[recordKey]/index.js`, `pages/api/m10-ingest/reconcile/[recordKey]/resolve.js`

- [ ] **detail** (`[recordKey]/index.js`):
```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../../_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  await dbConnect();
  const { getReconcileItem } = await import("@/lib/m10-ingest/repository/index");
  const item = await getReconcileItem(String(req.query.recordKey));
  if (!item) return res.status(404).json({ error: "ไม่พบ record" });
  return res.status(200).json(item);
}
```

- [ ] **resolve** (`[recordKey]/resolve.js`):
```js
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../../_auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  await dbConnect();
  const { resolveReconcile } = await import("@/lib/m10-ingest/repository/index");
  const by = auth.name || auth.userId;
  try {
    const r = await resolveReconcile(String(req.query.recordKey), by, req.body || {});
    return res.status(200).json(r);
  } catch (e) {
    return res.status(400).json({ error: e?.message || "บันทึกไม่สำเร็จ" });
  }
}
```

- [ ] lint `npx next lint --dir pages/api/m10-ingest` → ไม่มี error
- [ ] Commit `feat(m10-reconcile): reconcile detail + resolve API`

---

## Task 4: ReconcileMap component

**Files:** Create `components/m10/ReconcileMap.jsx`

- [ ] เขียน component (react-leaflet, **ผ่าน dynamic ssr:false** จาก ReconcilePanel):
```jsx
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useMemo } from "react";

// คำนวณ center จาก geometry แรกที่มี
function centerOf(geom) {
  try {
    const flat = JSON.stringify(geom.coordinates).match(/-?\d+\.\d+/g).map(Number);
    const lng = []; const lat = [];
    for (let i = 0; i < flat.length; i += 2) { lng.push(flat[i]); lat.push(flat[i + 1]); }
    return [lat.reduce((a, b) => a + b, 0) / lat.length, lng.reduce((a, b) => a + b, 0) / lng.length];
  } catch { return [15.26, 100.34]; }
}

export default function ReconcileMap({ m10Geometry, candidates, nearby, selectedId, onSelect }) {
  const center = useMemo(() => {
    if (m10Geometry) return centerOf(m10Geometry);
    if (candidates?.[0]?.geometry) return centerOf(candidates[0].geometry);
    return [15.26, 100.34];
  }, [m10Geometry, candidates]);

  return (
    <MapContainer center={center} zoom={17} style={{ height: 420, width: "100%" }} scrollWheelZoom>
      <TileLayer attribution="&copy; OSM" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {nearby?.map((n, i) => n.geometry && (
        <GeoJSON key={`n${i}`} data={n.geometry} style={{ color: "#9ca3af", weight: 1, fillOpacity: 0.05 }} />
      ))}
      {candidates?.map((c) => c.geometry && (
        <GeoJSON key={c.basemapId} data={c.geometry}
          style={{ color: selectedId === c.basemapId ? "#16a34a" : "#2563eb", weight: 2, fillOpacity: selectedId === c.basemapId ? 0.35 : 0.1 }}
          eventHandlers={{ click: () => onSelect(c.basemapId) }} />
      ))}
      {m10Geometry && (
        <GeoJSON data={m10Geometry} style={{ color: "#dc2626", weight: 3, dashArray: "6", fill: false }} />
      )}
    </MapContainer>
  );
}
```

- [ ] Commit `feat(m10-reconcile): ReconcileMap (m10 vs basemap overlay)`

---

## Task 5: ReconcilePanel focus mode

**Files:** Modify `components/m10/ReconcilePanel.jsx`

- [ ] เพิ่ม dynamic import map + focus state + ปุ่ม "เปิดแผนที่" ต่อแถว + แผงแก้ (candidate list, attribute form, [บันทึก & เช็คใหม่]) + filter `resolved`. โหลด detail จาก `/api/m10-ingest/reconcile/[recordKey]`, resolve ผ่าน POST. รายละเอียดโค้ดเต็มเขียนตอน implement (UI ยาว) — โครง:
  - state: `focus` (recordKey), `detail`, `selectedId` (basemapId), `form` (deedNo/landNo/survey/rai/ngan/wa), `saving`
  - map ผ่าน `dynamic(() => import("./ReconcileMap"), { ssr: false })`
  - บันทึก → POST resolve { parcelCode: เลือกจาก selectedId, ...form } → กลับ list + reload
- [ ] lint → ไม่มี error
- [ ] Commit `feat(m10-reconcile): ReconcilePanel map focus + resolve UI`

---

## Task 6: docs + full verify

- [ ] อัปเดต `docs/modules/m10-ingest.md` (หัวข้อ reconcile: + map editor เฟส 1, reconcileOverride, resolve flow)
- [ ] `npx tsc --noEmit && npx vitest run && npx next lint` → ผ่านหมด
- [ ] Commit `docs(m10-reconcile): module doc for map editor phase 1`

---

## Self-review notes
- geometry editing (vertex) = เฟส 2 — เฟส 1 map เป็น read+select เท่านั้น
- override กัน replay: reconcileRecord เช็ค resolved ก่อน (มีเทสต์)
- resolve เรียก matchParcel ตรง ไม่ผ่าน reconcileRecord guard
- nearby จำกัด 50 + bbox กัน payload บวม
