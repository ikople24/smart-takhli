# หน้าแก้ basemap (m10) — Design

> Standalone full-screen GIS editor สำหรับแก้รูปแปลง + รหัส/attribute ของ basemap ภาษีที่ดิน (ม.10) เขียนกลับ corrections layer ที่รอด re-import

วันที่: 2026-06-30 · โมดูล: `m10-ingest` · branch: `new-m10`

## ที่มา

งานหลักของเจ้าหน้าที่แผนที่ภาษีคือดูแลความถูกต้องของรูปแปลง (`m10_basemap`, 13,436 แปลงจาก `public/parcel.shp.geojson`) แท็บ "จับคู่ basemap" เดิมแก้ได้เฉพาะเวลามี record ม.10 มา reconcile เท่านั้น — ยังไม่มีเครื่องมือ **เปิดแผนที่มาแก้ basemap ตรง ๆ**

โปรเจกต์พี่น้อง `smart-saard` (`/Users/thanawatsodsri/Fullstack/smart-saard`, branch `admin-office`) มีตัวแก้แผนที่ภาษีที่ทำงานได้จริง (`components/TaxMapView.js`) บนสแตกเดียวกัน (react-leaflet 5 + leaflet 1.9.4 + `@geoman-io/leaflet-geoman-free` + turf) → **ยืมเฉพาะ pattern geoman ที่ใช้ได้จริง** มาสร้างหน้าแก้ basemap ของ m10

**กุญแจ:** ตอนทำ reconcile vertex-edit m10 เคยใส่ geoman บน `<Polygon>`/`<GeoJSON>` ของ react-leaflet แล้ว handle ไม่ขึ้น (React คุม lifecycle ของ layer) จึงทิ้ง geoman ไปใช้ Marker เอง smart-saard ทำถูก: สร้าง **native Leaflet layer** (`L.geoJSON(feature)`) แล้ว `addTo(map)` เองใน child ที่เรียก `useMap()` จากนั้น `layer.pm.enable()` — geoman เกาะ native layer ที่ map เป็นเจ้าของ → handle ขึ้น ลาก/เพิ่ม/ลบ vertex + snapping ได้

## เป้าหมาย / ขอบเขต

**ในรอบนี้:**
- หน้าเต็มจอ `/admin/m10/basemap` เปิดแผนที่มาแก้ basemap โดยตรง
- โหลดแปลงตาม viewport (bbox spatial query) + ช่องค้นหา (parcelCode/โฉนด) กระโดดไปแปลง
- เลือกแปลง → แก้ **vertex** (geoman) + **attribute** (parcelCode/โฉนด/เลขที่ดิน/หน้าสำรวจ/landType/zone/block/lot/พื้นที่)
- **วาดแปลงใหม่** → ใส่ parcelCode → บันทึก
- บันทึก = เขียน corrections layer เดิม (`m10_basemap_edit` → `m10_basemap`) ที่รอด re-import

**นอก scope (รอบถัดไป):**
- ลบแปลง (`kind:"delete"`)
- land-use / การใช้ประโยชน์ที่ดิน
- export กลับเป็นไฟล์ `.geojson`
- เอนจินสร้างรหัส SPLIT/MERGE/NEW อัตโนมัติ

## Routing & permission

- Route: `pages/admin/m10/basemap.jsx` → `/admin/m10/basemap` (Next.js pages router รองรับ `m10.jsx` + โฟลเดอร์ `m10/` คู่กันได้)
- **ไม่ต้อง migration permission:** `pathMatchesPermission("/admin/m10/basemap", "/admin/m10")` = true (prefix + `/`) → user ที่มีสิทธิ์ `/admin/m10` เห็นหน้านี้อัตโนมัติ
- ไม่ต้องลงทะเบียนใน `ALL_PAGES`/`DEFAULT_PERMISSIONS` แยก (อยู่ใต้ร่ม `/admin/m10`)
- เพิ่มเมนู `components/LayoutAdmin.tsx` `navigationItems` 1 รายการ: `{ label: 'แก้รูปแปลง (basemap)', href: '/admin/m10/basemap', icon: '✏️', group: 'จัดการ' }` (filter เดิมจะ match `/admin/m10` prefix ให้เอง)
- เต็มจอ = เติมพื้นที่ content (ภายใน LayoutAdmin) ด้วยความสูง `h-[calc(100vh-…)]`

## สถาปัตยกรรมไฟล์

### Frontend
- `pages/admin/m10/basemap.jsx` — shell บาง: `dynamic(() => import("@/components/m10/basemap/BasemapEditor"), { ssr:false })` + `<Head>`
- `components/m10/basemap/BasemapEditor.jsx` — orchestrator: `<MapContainer>` + state (`features` ใน viewport / `selected` / `mode: view|edit|draw`) + `save()` (~250 บรรทัด)
- `components/m10/basemap/BasemapViewportLoader.jsx` — `useMap` child: `moveend` (debounce ~400ms) → ถ้า `zoom >= MIN_ZOOM` fetch bbox แล้วส่ง features ขึ้น parent; ถ้า zoom ต่ำ ส่งสัญญาณโชว์ป้าย "ซูมเข้าเพื่อโหลดแปลง"
- `components/m10/basemap/BasemapGeoman.jsx` — export 2 ตัว (พอร์ตจาก smart-saard, native-layer pattern):
  - `EditFeature({ feature, onCollect })` — สร้าง `L.featureGroup().addTo(map)` + `L.geoJSON(feature)` → `addLayer` → `layer.pm.enable({ allowSelfIntersection:false })` + `map.pm.setGlobalOptions({ snappable:true, snapDistance:15 })`; `onCollect.current = () => fg layer.toGeoJSON()`; cleanup: `pm.disable()` + `removeLayer`
  - `DrawNew({ onCreated })` — `map.pm.enableDraw('Polygon', { finishOn:'dblclick' })` + listen `pm:create` → `onCreated(geo)` + `disableDraw`; cleanup ถอด layer
- `components/m10/basemap/BasemapAttrPanel.jsx` — แผงข้าง: ช่องค้นหา + รายการผล (click → flyTo) + ฟอร์ม attribute (parcelCode/deedNo/landNo/survey/landType/zoneId/blockId/lot) + พื้นที่ไร่-งาน-วา + ปุ่ม [แก้ไข]/[วาดใหม่]/[บันทึก]/[ยกเลิก]

### Backend / lib
- `lib/m10-ingest/basemap/area.ts` (pure, ยืมจาก smart-saard) — `parseAreaParts(str) → {rai,ngan,wa}` · `partsToStr(rai,ngan,wa) → "R-N-W"` · `wahToSqm`/`sqmToParts` · `geodesicArea(latLngs) → sqm` (turf area)
- `pages/api/m10-ingest/basemap/index.js` — `GET ?bbox=minLng,minLat,maxLng,maxLat&limit=` → FeatureCollection ของ effective parcels ที่ตัด bbox (`$geoIntersects` กับ bbox polygon, cap `MAX_FEATURES=800`, เกิน → `{ truncated:true }`); ต้องมี bbox ไม่งั้น 400
- `pages/api/m10-ingest/basemap/search.js` — `GET ?q=` → ถ้ามี `/` ถือเป็น parcelCode (prefix/exact) ไม่งั้นลอง deedNo; คืนสูงสุด 20 `{ parcelCode, deedNo, bbox }` (bbox จาก turf ของ geometry) ให้ flyToBounds
- `pages/api/m10-ingest/basemap/save.js` — `POST { parcelCode, deedNo, landNo, survey, landType, zoneId, blockId, lot, area, geometry, kind }` → `applyBasemapEdit()`; geometry S2 reject → 422 ข้อความไทย
- ทุก endpoint ขึ้นต้น `await requireM10Admin(req, "/admin/m10")` (ลัด superadmin ในตัว)

## แก้ repository เดิม (targeted)

ไฟล์ `lib/m10-ingest/repository/index.ts` ฟังก์ชัน `applyBasemapEdit()` + model `models/m10-ingest/M10BasemapEdit.js`:

1. **ขยาย attribute** — `BasemapEditInput`/attrs รับเพิ่ม `zoneId/blockId/lot/landType`; `M10BasemapEdit` schema เพิ่มฟิลด์เดียวกัน
2. **area เป็น object** — เปลี่ยน `area` จาก scalar เป็น `{ rai, ngan, wa, sqm }` ให้ตรง `M10Basemap.area` (ปัจจุบันเก็บ scalar = ความเพี้ยนที่มีอยู่; แก้ทีเดียว) · `M10BasemapEdit.area` → object/Mixed
3. **สลับลำดับเขียน** — ปัจจุบันเขียน edit-row ก่อนแล้วค่อย apply effective. เปลี่ยนเป็น **apply effective ก่อน** (ตัวที่ MongoDB S2 ตรวจเข้มกว่า turf) สำเร็จ → ค่อย upsert edit-row → กัน geometry ที่ S2 reject ตกค้างใน source-of-truth (`m10_basemap_edit`) ทำให้ replay ครั้งหน้าพังเงียบ ๆ
   - S2 reject (effective `create` throw) → โยน error ให้ `save.js` แปลงเป็น 422 "รูปแปลงไม่ผ่านการตรวจของฐานข้อมูล (เส้นซ้อน/วนผิดทาง)"
   - **กระทบ flow reconcile เดิม** (`resolveReconcile` ที่มี `writeBasemap`) — ได้ประโยชน์เหมือนกัน (edit ไม่ตกค้างถ้า apply ไม่ผ่าน) ลำดับเดิมไม่มี caller พึ่งพา; ต้องอัปเดต `resolveReconcile` ให้ส่ง area เป็น object (จุดเดียว)

> geometry validate ยังผ่าน `normalizeEditedGeometry()` เดิม (strip Z + rewind + turf booleanValid) ก่อนถึง S2

## Data flow

```
เปิดหน้า → ตั้ง center เทศบาลตาคลี, zoom ~15
moveend (zoom>=MIN_ZOOM=16) → GET basemap?bbox → render parcels (เทาอ่อน) + label PARCEL_COD
zoom<16 → ป้าย "ซูมเข้าเพื่อโหลดแปลง"
ค้นหา parcelCode/โฉนด → GET search → คลิกผล → map.flyToBounds(bbox)
คลิกแปลง → selected (เขียว) → panel โชว์ attribute (อ่าน)
[แก้ไข] → mode=edit → <EditFeature feature={selected}/> mount (native layer + pm.enable) → ลาก/เพิ่ม/ลบ vertex; ฟอร์มแก้ได้; area คำนวณสด (geodesicArea)
[วาดใหม่] → mode=draw → <DrawNew/> → วาด polygon (dblclick จบ) → ฟอร์มเปล่า (parcelCode บังคับ)
[บันทึก] → รวม geometry (onCollect / drawn) + attrs → POST save {kind: edit|new} → applyBasemapEdit → reload viewport, mode=view
[ยกเลิก] → ทิ้ง edit, mode=view
```

## Error handling
- bbox ไม่ครบ/พัง → 400; ผลเกิน `MAX_FEATURES` → `truncated:true` + UI ป้าย "ซูมเข้าอีกเพื่อเห็นครบ"
- save: parcelCode ว่าง → 400; geometry turf-invalid → 400 (`normalizeEditedGeometry` คืน null); geometry S2 reject → 422
- กระโดด/แก้ตอน zoom ต่ำ → โหลดไม่ทำงาน, แสดงป้ายแทน
- map ssr → `dynamic ssr:false` (geoman/leaflet)

## Testing
- `lib/m10-ingest/basemap/area.test.ts` — round-trip ไร่-งาน-วา ↔ sqm, `geodesicArea` รูปสี่เหลี่ยมรู้พื้นที่
- ขยาย test `applyBasemapEdit` (integration, mongodb-memory-server):
  - attrs ใหม่ (`zoneId/blockId/lot/landType`) เขียนลง effective ครบ
  - `area` object เก็บถูก
  - **ลำดับใหม่:** geometry ดี → ทั้ง edit-row + effective เกิด; (mock) effective ล้มเหลว → edit-row ไม่เกิด
- test bbox query (`GET basemap` repository-level): แปลงในกรอบมา, นอกกรอบไม่มา, cap ทำงาน

## ที่ไม่เอาจาก smart-saard (ตั้งใจตัด)
- persistence แบบไฟล์ (`/api/geojson`, `public/geojson/*.json`) — m10 ใช้ Mongo corrections layer
- `AttributeTable` (ตารางทั้งเลเยอร์), `GeoJSONUploadAssistant` (อัปโหลดไฟล์), land-use (`ParcelInspectorPanel`, `LAND_USE_TYPES`)
- reproject/datum — basemap เป็น EPSG:4326 แล้ว
