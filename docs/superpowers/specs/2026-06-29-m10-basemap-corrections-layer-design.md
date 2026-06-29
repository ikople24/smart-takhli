# m10 Basemap Corrections Layer — Design

วันที่: 2026-06-29 · โมดูล: `m10-ingest` · สถานะ: design (อนุมัติแล้ว) · ต่อจาก reconcile map editor

## 1. ปัญหา

การแก้ของ จนท. (รหัส/รูปแปลง/attribute) ปัจจุบันเก็บบน `m10_records.reconcileOverride` เท่านั้น
ไม่ย้อนกลับไป basemap (`m10_basemap`) → matcher ยังเทียบ basemap เก่า → ข้อมูล 2 ชุด "ปนกันมั่ว"

## 2. แนวทาง (ผู้ใช้เลือก: Layer แก้ทับ basemap นำเข้า)

เลียนแบบ transactions→records replay:
- **`m10_basemap`** = basemap **effective** (นำเข้า + แก้ทับแล้ว) — matcher query ตัวนี้ (2dsphere)
- **`m10_basemap_edit`** = ชั้นแก้ของ จนท. (source of truth, key=parcelCode) — **replay ทับหลัง import ทุกครั้ง** → รอด import

**ผู้ใช้ยืนยัน:** geometry ทำ "เดี่ยวๆ" (1 รหัส = 1 รูปแปลง; ยุบ fragment เป็นรูปที่ จนท. วาด) ก่อน — เทียบ fragment ทีหลัง · checkbox explicit (default ปิด)

## 3. Model `M10BasemapEdit` (collection `m10_basemap_edit`)

```
parcelCode: String  (unique index — 1 edit ต่อรหัส, upsert latest-wins)
deedNo, landNo, survey: String|null
area: { rai, ngan, wa, sqm } | null
geometry: Mixed | null   (รูปที่ จนท. วาด — ถ้า null = แก้เฉพาะ attribute)
kind: "edit" | "new"     (มีในนำเข้าเดิม = edit / รหัสใหม่ = new)
by: String, at: Date, note: String|null
```

## 4. Repository

### `applyBasemapEdit(edit)` — เขียน edit + apply ลง effective
1. upsert `m10_basemap_edit` by parcelCode (เก็บ source of truth)
2. apply ลง `m10_basemap`:
   - **มี geometry**: ลบ doc เดิมของ parcelCode (ยุบ fragment) → insert 1 doc `{parcelCode, deedNo, landNo, survey, area, geometry}` (validate geometry ด้วย `normalizeEditedGeometry` ก่อน; invalid → throw)
   - **ไม่มี geometry** (แก้ attribute อย่างเดียว): `updateMany({parcelCode}, {$set: attrs})`; ถ้าไม่มี doc เลย (รหัสใหม่ไม่มีรูป) → insert 1 doc ไม่มี geometry

### `replayBasemapEdits()` — เรียกหลัง import
วน `m10_basemap_edit` ทุกตัว → `applyBasemapEdit` (apply ทับ effective ที่เพิ่ง drop+reinsert)

### `resolveReconcile` — เพิ่ม param `writeBasemap?: boolean`
หลังเก็บ record override (เดิม):
- ถ้า `writeBasemap && parcelCode`:
  - kind = (มี parcelCode นี้ใน m10_basemap แล้ว) ? "edit" : "new"
  - geometry = overrideGeom (รูปที่ จนท. วาดในรอบนี้) ถ้ามี
  - `applyBasemapEdit({ parcelCode, deedNo, landNo, survey, area, geometry, kind, by })`
- ถ้าไม่ติ๊ก → แค่ override (ไม่แตะ basemap) เหมือนเดิม

## 5. CLI `m10-load-basemap.js`

หลัง drop+reinsert + syncIndexes → เรียก `replayBasemapEdits()` → log จำนวน edit ที่ replay

## 6. API `POST .../resolve`

body เพิ่ม `writeBasemap` (boolean) → ส่งต่อ `resolveReconcile`

## 7. UI (ReconcilePanel focus)

เพิ่ม **☑ "อัปเดตข้อมูลนี้กลับเข้า basemap (parcel.shp)"** (default ปิด) เหนือปุ่มบันทึก
- คำอธิบายเล็ก: "ติ๊กเมื่อแก้รหัส/รูปแปลง/ข้อมูลให้ basemap ใช้ matching รอบถัดไป"
- ส่ง `writeBasemap` ใน body ตอน save

## 8. เทสต์

- **integration** `applyBasemapEdit`:
  - แก้ geometry รหัสที่มีหลาย fragment → เหลือ 1 doc (ยุบ) geometry ใหม่
  - รหัสใหม่ + geometry → insert 1 doc
  - แก้ attribute อย่างเดียว → updateMany attrs, geometry เดิมคงอยู่
  - invalid geometry → throw
- **integration** `replayBasemapEdits`: จำลอง reimport (drop m10_basemap + reinsert) → replay → edit กลับมาทับ
- **integration** `resolveReconcile` writeBasemap=true → มี doc ใน m10_basemap_edit + m10_basemap อัปเดต; writeBasemap=false → ไม่มี

## 9. นอกขอบเขต (รอบ B เต็ม)

- เอนจินคำนวณรหัส SPLIT/MERGE/NEW อัตโนมัติ (รอบนี้ จนท. พิมพ์รหัสเอง)
- ลบแปลง / retire
- เก็บหลาย fragment ต่อรหัสหลังแก้ (รอบนี้ยุบเป็นรูปเดียว)
- export กลับเป็นไฟล์ parcel.shp.geojson (ใช้ collection เป็น source; export ไว้รอบหน้า)

## 10. ความเสี่ยง

- **ยุบ fragment**: แก้ geometry รหัสที่มีหลาย fragment → เหลือรูปเดียว (เสีย fragment เดิม) — ผู้ใช้ยอมรับ ("เดี่ยวๆก่อน")
- **validate**: geometry edit ผ่าน `normalizeEditedGeometry` (turf) ก่อนลง basemap — กัน 2dsphere/`$geoIntersects` พัง
- **2dsphere บน insert ใหม่**: doc ที่ apply ต้อง geometry valid (S2) — normalizeEditedGeometry ใช้ turf (อาจหลวมกว่า S2); ถ้า insert fail ให้ catch + แจ้ง (rare กับรูปที่ จนท. วาดเอง)
- replay หลัง import เพิ่มเวลา CLI เล็กน้อย (edit น้อย)
