# m10 Reconcile Vertex Editing (เฟส 2) — Design

วันที่: 2026-06-29 · โมดูล: `m10-ingest` · สถานะ: design (อนุมัติแล้ว) · ต่อจากเฟส 1

## 1. เป้าหมาย

ต่อจาก reconcile map editor เฟส 1 (เลือกแปลง + แก้ attribute) — เพิ่มความสามารถ **แก้รูปแปลง (vertex)**
บนแผนที่: ลาก/เพิ่ม/ลบ vertex ของรูปแปลง ม.10 หรือวาดใหม่ถ้าไม่มี → บันทึกเป็น override → re-match

## 2. ขอบเขต

- โหมดแก้รูปแปลงใน focus mode เดิม (toggle)
- แก้ vertex ของ m10 polygon (มี geometry) · วาดใหม่ถ้าไม่มี (4 ราย)
- บันทึก geometry ที่แก้ → `reconcileOverride.geometry` (กัน replay เหมือนเฟส 1) → re-run matcher ด้วย geometry ใหม่

**นอก scope:** สร้างรหัส SPLIT/MERGE/NEW · worklist integration · แก้ basemap geometry (แก้เฉพาะฝั่ง m10)

## 3. Library

`@geoman-io/leaflet-geoman-free` ^2.20 (peer `leaflet ^1.2` → เข้ากับ 1.9.4, deduped).
ทำงานบน L.map instance ผ่าน `useMap()` ของ react-leaflet 5; โหลดใน `ReconcileMap` (dynamic `ssr:false` อยู่แล้ว) + import CSS ของ geoman

## 4. การทำงาน (ReconcileMap)

- child component `<GeomanEditor>` ใช้ `useMap()`:
  - `import "@geoman-io/leaflet-geoman-free"` + CSS (client-only)
  - เมื่อ `editing=true`: ถ้ามี m10 layer → `layer.pm.enable({ allowSelfIntersection: false })`; ถ้าไม่มี geometry → `map.pm.enableDraw("Polygon")`
  - ฟัง `pm:edit`/`pm:update`/`pm:create` → `onGeometryChange(layer.toGeoJSON().geometry)`
  - เมื่อ `editing=false` → `map.pm.disableGlobalEditMode()` + `layer.pm.disable()`
- m10 polygon เดิม render เป็น layer ที่แก้ได้ (เก็บ ref) — ใช้ effective geometry (override.geometry ?? record.geometry)

## 5. Save model (ต่อ reconcileOverride)

- เพิ่ม field `reconcileOverride.geometry` (Mixed, default null)
- **effective geometry** = `reconcileOverride.geometry` ?? `record.geometry`
- `resolveReconcile` รับ `geometry?` เพิ่ม:
  1. ถ้ามี geometry → **validate** (turf rewind + booleanValid); ไม่ valid → throw `"รูปแปลงไม่ถูกต้อง (เส้นตัดกัน/จุดน้อยเกินไป)"`
  2. เก็บ normalized geometry ลง `reconcileOverride.geometry`
  3. re-run `matchParcel` ด้วย **effective geometry** (override ?? record) — ใช้ geometry ใหม่ในชั้น geom
- canonical `record.geometry` ไม่ถูกแตะ; `reconcileRecord` (auto) ยังข้าม resolved เหมือนเดิม

## 6. API

ใช้ endpoint เดิม `POST /api/m10-ingest/reconcile/[recordKey]/resolve` — body เพิ่ม optional `geometry` (GeoJSON Polygon)
`getReconcileItem` คืน effective geometry ให้ UI แสดง (override ก่อน)

## 7. UI (ReconcilePanel focus)

- ปุ่ม **[แก้รูปแปลง]** (toggle) — ถ้า record ไม่มี geometry → label **[วาดแปลงใหม่]**
- ระหว่างแก้: แสดงคำแนะนำ "ลากจุด/คลิกเส้นเพิ่มจุด/คลิกขวาลบจุด"; ปุ่ม [ยกเลิกการแก้]
- geometry ที่แก้เก็บ state; กด [บันทึก & เช็คใหม่] ส่ง geometry ไปพร้อม attribute/parcelCode เดิม
- หลังบันทึก: กลับ list, reload

## 8. เทสต์

- **unit** `normalizeEditedGeometry()` (pure, แยกใน `lib/m10-ingest/basemap/`): รับ Polygon valid → rewind ออกมา valid; degenerate/self-intersect → throw/null
- **integration**: `resolveReconcile` ที่ส่ง geometry → เก็บ `reconcileOverride.geometry` + re-match ใช้ geometry นั้น (mock basemap ทับ → matched)
- geoman UI ไม่ unit test (ทดสอบมือบน browser)

## 9. ความเสี่ยง

- **geoman + react-leaflet 5**: geoman ผูกกับ L.map ตรง ๆ (ไม่ใช่ react component) → ใช้ `useMap` + useEffect cleanup ระวัง enable/disable ซ้อน; ทำใน ReconcileMap ที่ ssr:false
- **invalid geometry**: validate ก่อนเก็บ (turf) — กัน $geoIntersects ตอน re-match error; geoman `allowSelfIntersection:false` ช่วยกันตั้งแต่วาด
- **record ไม่มี geometry**: วาดใหม่ได้; ถ้าไม่วาด เก็บ attribute/parcelCode ได้ตามเฟส 1
- เก็บ override.geometry บน m10_records แต่ **ไม่มี 2dsphere บน field นี้** (index อยู่บน canonical geometry) — ใช้แค่ใน turf/`$geoIntersects` เป็น query arg ไม่ใช่ stored-index → ต้อง validate เอง (ทำแล้ว)
