# m10 Reconcile Vertex Editing (เฟส 2) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** เจ้าหน้าที่แก้/วาด vertex รูปแปลง ม.10 บนแผนที่ → บันทึกเป็น reconcileOverride.geometry (กัน replay) → re-match

**Architecture:** geoman-free บน ReconcileMap (useMap); resolveReconcile รับ geometry + validate; effective geometry = override ?? record

**Tech Stack:** @geoman-io/leaflet-geoman-free ^2.20, react-leaflet 5, leaflet 1.9, @turf/turf

Spec: `docs/superpowers/specs/2026-06-29-m10-reconcile-vertex-edit-design.md`

---

## Task 1: normalizeEditedGeometry + reconcileOverride.geometry + resolveReconcile geometry

**Files:** `lib/m10-ingest/basemap/load.ts` (เพิ่ม export), `lib/m10-ingest/basemap/load.test.ts`, `models/m10-ingest/M10Record.js`, `lib/m10-ingest/repository/index.ts`, `lib/m10-ingest/repository/reconcile.test.ts`

- [ ] **Step 1: เพิ่ม `normalizeEditedGeometry` ใน load.ts** (reuse rewind/validate logic; รับ geometry ที่ จนท. วาด, ไม่ตัด Z เพราะ leaflet ออก 2D อยู่แล้ว)
```ts
export function normalizeEditedGeometry(g: unknown): Geom | null {
  if (!g || typeof g !== "object") return null;
  const geom = g as Geom;
  if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") return null;
  try {
    const rewound = rewind(feature({ type: geom.type, coordinates: strip3D(geom.coordinates) } as Geom), { reverse: false }) as Feature<Geom>;
    if (!booleanValid(rewound.geometry)) return null;
    return rewound.geometry;
  } catch { return null; }
}
```

- [ ] **Step 2: test ใน load.test.ts**
```ts
import { normalizeEditedGeometry } from "./load";
describe("normalizeEditedGeometry", () => {
  it("accepts valid polygon, returns rewound", () => {
    const g = { type: "Polygon", coordinates: [[[100, 15], [100.001, 15], [100.001, 15.001], [100, 15.001], [100, 15]]] };
    expect(normalizeEditedGeometry(g)?.type).toBe("Polygon");
  });
  it("rejects degenerate / non-polygon", () => {
    expect(normalizeEditedGeometry({ type: "Polygon", coordinates: [[[0, 0], [1, 0], [0, 0]]] })).toBeNull();
    expect(normalizeEditedGeometry({ type: "Point", coordinates: [0, 0] })).toBeNull();
    expect(normalizeEditedGeometry(null)).toBeNull();
  });
});
```

- [ ] **Step 3: M10Record** — เพิ่มใน `reconcileOverride`: `geometry: { type: mongoose.Schema.Types.Mixed, default: null },`

- [ ] **Step 4: resolveReconcile รับ geometry** (`index.ts`) — เพิ่ม param + logic:
```ts
// ใน signature input เพิ่ม: geometry?: unknown
// ก่อนคำนวณ match:
let overrideGeom: Geom | null = null;
if (input.geometry != null) {
  overrideGeom = normalizeEditedGeometry(input.geometry);
  if (!overrideGeom) throw new Error("รูปแปลงไม่ถูกต้อง (เส้นตัดกัน/จุดน้อยเกินไป)");
}
const effGeom = overrideGeom ?? (rec.geometry as Geom) ?? null;
// matchParcel ใช้ effGeom แทน rec.geometry
// override object เพิ่ม: geometry: overrideGeom,
```
import `normalizeEditedGeometry` จาก `../basemap/load`

- [ ] **Step 5: getReconcileItem คืน effective geometry** — แก้ให้ record.geometry ที่ส่งออก = `reconcileOverride?.geometry ?? geometry` (เพื่อ UI แสดงรูปที่แก้ล่าสุด)
```ts
// หลัง rec = ...lean(); ก่อน return:
const effGeometry = rec.reconcileOverride?.geometry ?? rec.geometry;
// ใน return record: ส่ง { ...rec, geometry: effGeometry }
```

- [ ] **Step 6: integration test** (`reconcile.test.ts`) เพิ่ม:
```ts
it("resolveReconcile saves override geometry + re-matches with it", async () => {
  const poly = { type: "Polygon", coordinates: [[[100, 15], [100.01, 15], [100.01, 15.01], [100, 15.01], [100, 15]]] };
  await col("m10_basemap").insertOne({ parcelCode: "07A001", deedNo: "9", geometry: poly });
  await col("m10_records").insertOne({ recordKey: "K1", deedNo: null, geometry: null, parcelMatch: { status: "unmatched", candidates: [] } });
  const r = await resolveReconcile("K1", "o", { geometry: poly });
  const rec = await col("m10_records").findOne({ recordKey: "K1" });
  expect(rec?.reconcileOverride?.geometry?.type).toBe("Polygon");
  expect(r.status).toBe("resolved");
});
it("resolveReconcile rejects invalid geometry", async () => {
  await col("m10_records").insertOne({ recordKey: "K2", geometry: null });
  await expect(resolveReconcile("K2", "o", { geometry: { type: "Polygon", coordinates: [[[0,0],[1,0],[0,0]]] } })).rejects.toThrow();
});
```

- [ ] **Step 7: run** `npx vitest run lib/m10-ingest/basemap/load.test.ts lib/m10-ingest/repository/reconcile.test.ts` → PASS; `npx tsc --noEmit` → 0
- [ ] **Step 8: Commit** `feat(m10-reconcile): vertex geometry override + validate + re-match`

---

## Task 2: ReconcileMap geoman edit/draw

**Files:** Modify `components/m10/ReconcileMap.jsx`

- [ ] เพิ่ม geoman child component (useMap) + props `editing`, `onGeometryChange`:
```jsx
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { useMemo, useEffect, useRef } from "react";
import L from "leaflet";

function GeomanEditor({ editing, m10Geometry, onGeometryChange }) {
  const map = useMap();
  const layerRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await import("@geoman-io/leaflet-geoman-free");
      if (cancelled) return;
      // ล้าง layer เดิม
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
      if (!editing) { map.pm?.disableGlobalEditMode?.(); map.pm?.disableDraw?.(); return; }
      const onChange = (e) => {
        const layer = e.layer || layerRef.current;
        if (layer?.toGeoJSON) onGeometryChange(layer.toGeoJSON().geometry);
      };
      if (m10Geometry) {
        const layer = L.geoJSON(m10Geometry, { style: { color: "#dc2626", weight: 3 } }).addTo(map);
        // geoJSON เป็น group → หา layer แรก
        const inner = layer.getLayers()[0];
        layerRef.current = inner;
        inner.pm.enable({ allowSelfIntersection: false });
        inner.on("pm:edit", onChange);
        try { map.fitBounds(inner.getBounds(), { maxZoom: 18 }); } catch { /* noop */ }
      } else {
        map.pm.enableDraw("Polygon", { allowSelfIntersection: false });
        map.on("pm:create", (e) => { layerRef.current = e.layer; onChange(e); map.pm.disableDraw(); });
      }
    })();
    return () => { cancelled = true; map.pm?.disableGlobalEditMode?.(); map.pm?.disableDraw?.(); map.off("pm:create"); };
  }, [editing, m10Geometry, map, onGeometryChange]);
  return null;
}
```
- [ ] เพิ่ม `<GeomanEditor editing={editing} m10Geometry={m10Geometry} onGeometryChange={onGeometryChange} />` ใน MapContainer; render m10 GeoJSON เดิมเฉพาะตอน **ไม่ editing** (ตอน editing ใช้ layer ของ geoman แทน กันซ้อน) — wrap ด้วย `{!editing && m10Geometry && <GeoJSON .../>}`
- [ ] รับ props ใหม่ `editing`, `onGeometryChange` ใน `ReconcileMap({ ..., editing, onGeometryChange })`
- [ ] lint → ไม่มี error
- [ ] Commit `feat(m10-reconcile): geoman vertex edit/draw in ReconcileMap`

---

## Task 3: ReconcilePanel wire edit

**Files:** Modify `components/m10/ReconcilePanel.jsx`

- [ ] เพิ่ม state `editing`, `editedGeom`; ส่ง `editing` + `onGeometryChange={setEditedGeom}` ลง ReconcileMap
- [ ] ปุ่ม toggle: label = `detail.record.geometry ? "แก้รูปแปลง" : "วาดแปลงใหม่"`; ตอน editing โชว์ [ยกเลิกการแก้] + คำแนะนำ
- [ ] ใน `save()` body เพิ่ม `geometry: editedGeom || undefined`
- [ ] reset `editing/editedGeom` ตอน openFocus/closeFocus
- [ ] lint → ไม่มี error
- [ ] Commit `feat(m10-reconcile): wire vertex edit in ReconcilePanel`

---

## Task 4: docs + full verify

- [ ] อัปเดต `docs/modules/m10-ingest.md` (reconcile: + เฟส 2 vertex edit, geoman, reconcileOverride.geometry, effective geometry)
- [ ] `npx tsc --noEmit && npx vitest run && npx next lint` → ผ่านหมด
- [ ] Commit `docs(m10-reconcile): vertex editing phase 2`

---

## Self-review notes
- geoman ผูก L.map ตรง → ทำใน child `useMap` + cleanup (disable/off) กัน leak
- validate geometry ก่อนเก็บ (turf) — กัน $geoIntersects error
- canonical geometry ไม่ถูกแตะ; effective = override ?? record
- เฟส 2 แก้เฉพาะฝั่ง m10 (ไม่แตะ basemap)
