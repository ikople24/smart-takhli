# m10 Reconcile Map Editor (เฟส 1) — Design

วันที่: 2026-06-29 · โมดูล: `m10-ingest` · สถานะ: design (อนุมัติ design แล้ว)

## 1. เป้าหมาย / บริบทงานจริง

งานหลักประจำของเจ้าหน้าที่แผนที่ภาษี = **กลั่นกรองข้อมูล 2 ทาง**: ข้อมูลดิบที่คัดกรองมาแล้ว (ม.10)
เทียบกับข้อมูลฝั่งแผนที่ (basemap/รูปแปลง) เพื่อลดความผิดพลาดก่อนบันทึกเข้า LTAX —
ปัจจุบัน**ไม่มีเครื่องมือช่วย** ทำด้วยสายตา/มือ

ต่อจากรอบ A (matcher จับคู่อัตโนมัติ) — รายการที่ matcher ตัดสินไม่ได้ (`ambiguous`/`unmatched`)
ต้องให้คนเปิดดูบนแผนที่ เทียบรูปแปลง แล้วแก้ให้ถูก

**โฟลว์ที่ผู้ใช้ต้องการ:** จับคู่แล้วมีแนวโน้มซ้ำ/ไม่ชัด → เปิดแผนที่ดูรูปแปลง → เลือก/แก้ → บันทึก → เช็คใหม่ให้พร้อมคีย์

## 2. ขอบเขตเฟส 1

- แผนที่ทับ **m10 polygon ↔ basemap polygon** (2-way visual check) ในแท็บ "จับคู่ basemap" (focus mode)
- จัดการรายการมีปัญหา (`ambiguous`/`unmatched`):
  1. **เลือกแปลง basemap ที่ถูกต้อง** จาก candidate (resolve match)
  2. **แก้ attribute** ของ record: โฉนด / เลขที่ดิน / หน้าสำรวจ / เนื้อที่ (ไร่-งาน-วา)
  3. **บันทึก → เช็คใหม่** (re-run matcher ด้วยค่าใหม่ + mark resolved)

**นอกขอบเขต (เฟส 2):** วาด/แก้ vertex รูปแปลง (ต้องเพิ่ม geoman) · สร้างรหัสใหม่ SPLIT/MERGE/NEW · ดันเข้า worklist

## 3. สถาปัตยกรรม / ไฟล์

```
components/m10/ReconcilePanel.jsx       # +focus mode (list → เลือก → แผนที่+แผงแก้)
components/m10/ReconcileMap.jsx          # ใหม่: react-leaflet (dynamic ssr:false)
lib/m10-ingest/repository/index.ts      # +getReconcileItem, resolveReconcile; reconcileRecord ข้าม resolved
models/m10-ingest/M10Record.js          # +reconcileOverride
pages/api/m10-ingest/reconcile/[recordKey]/index.js     # GET detail
pages/api/m10-ingest/reconcile/[recordKey]/resolve.js   # POST resolve
```

react-leaflet 5 + leaflet 1.9 มีอยู่แล้ว (pattern: dynamic import `ssr:false`, เพราะ Leaflet ต้อง window).
**ยังไม่เพิ่ม draw/edit lib** ในเฟส 1

## 4. Save model — ปกป้อง replay

M10Record ถูก materialize จาก transactions (replay ได้) → **ห้ามแก้ field canonical ตรง ๆ**
(txn เดือนถัดไปของ recordKey เดิมจะทับผ่าน `applyTxnToRecord`). เก็บการแก้เป็น override แยก:

```
M10Record.reconcileOverride: {
  parcelCode: String | null,
  deedNo: String | null, landNo: String | null, survey: String | null,
  area: { rai, ngan, wa, sqm } | null,
  status: "resolved",
  note: String | null,
  by: String, at: Date,
}
```

- **ค่า effective** (สำหรับ LTAX/แสดงผล) = `reconcileOverride.<field>` ?? `record.<field>` (auto)
- **parcelCode effective** = `reconcileOverride.parcelCode` ?? `parcelMatch.parcelCode`
- `reconcileRecord()` (auto) **ข้าม** record ที่ `reconcileOverride.status === "resolved"` — ไม่ทับการตัดสินของคน
- override อยู่รอดแม้ re-ingest/re-match

## 5. โฟลว์ "บันทึก & เช็คใหม่"

POST resolve รับ `{ parcelCode, deedNo, landNo, survey, area, note }`:
1. เก็บลง `reconcileOverride` (status `resolved`, by/at)
2. **re-run `matchParcel`** ด้วย attribute ใหม่ (deedNo/landNo/survey + geometry เดิม) → เก็บผลใน `parcelMatch`
   (เรียก `matchParcel` + resolver ตรง ๆ ใน resolve handler — **ไม่ผ่าน** `reconcileRecord` จึงไม่ติด guard "ข้าม resolved"; guard นั้นมีไว้กัน auto reconcile (confirm/backfill) มาทับเท่านั้น)
3. ถ้า จนท. เลือก parcelCode เอง → ใช้ค่านั้นเป็น effective (override ชนะ auto เสมอ)
4. คืนสถานะใหม่ให้ UI

> หมายเหตุ: เฟส 1 ไม่แก้ geometry → re-run ใช้ geometry เดิมของ record

## 6. API

- `GET /api/m10-ingest/reconcile/[recordKey]` (gate `/admin/m10`)
  → `{ record: { recordKey, deedNo, landNo, survey, area, geometry, parcelMatch, reconcileOverride },
       candidates: [{ parcelCode, basemapId, deedNo, overlapPct, geometry }],
       nearby: [{ parcelCode, geometry }] }` (nearby = basemap ใน bbox ของ m10 polygon เป็น context)
- `POST /api/m10-ingest/reconcile/[recordKey]/resolve` body `{ parcelCode, deedNo, landNo, survey, area, note }`
  → บันทึก override + re-check → `{ ok, status, parcelCode }`

## 7. UI (focus mode ใน ReconcilePanel)

- list (ตารางเดิม) เพิ่มปุ่ม "เปิดแผนที่" ต่อแถว (เฉพาะ ambiguous/unmatched/resolved) → เข้า focus
- focus: ซ้าย = `ReconcileMap` (m10 แดงประ · candidate คลิกเลือกเขียว · nearby เทาจาง) · ขวา = แผง
  - candidate list (PARCEL_COD + overlap% + โฉนด) คลิกเลือก
  - ฟอร์ม attribute (prefill, แก้ได้)
  - ปุ่ม [บันทึก & เช็คใหม่] · [ย้อนกลับ]
- filter เพิ่ม `resolved`

## 8. เทสต์

- **unit** `resolveReconcile` logic (pure ส่วน merge override + เลือก effective parcelCode) — ถ้าแยก pure ได้
- **integration** (mongodb-memory-server):
  - resolve เก็บ `reconcileOverride.status=resolved` + by/at
  - `reconcileRecord` ข้าม record ที่ resolved (ไม่ทับ)
  - effective parcelCode = override เมื่อมี
- API smoke ไม่ทำ (ตาม pattern เดิมของโมดูล ที่เทสต์ที่ repository layer)

## 9. ความเสี่ยง / ข้อควรระวัง

- **Leaflet SSR**: ต้อง dynamic import `ssr:false` (ตาม `GeoJSONMapPreview.tsx`/`ReporterInfoMap.js`)
- **ขนาด nearby**: จำกัด bbox + limit (เช่น ≤50 แปลง) กัน payload บวม (basemap 13k แปลง)
- **record ไม่มี geometry** (4 ราย): แผนที่โชว์เฉพาะ candidate/nearby + แก้ attribute ได้ (ไม่มีรูป m10 ให้ทับ)
- **replay clobber**: แก้ผ่าน override เท่านั้น — auto reconcile ข้าม resolved (มีเทสต์)
- เฟส 1 ไม่แตะ vertex — ถ้ารูป m10 ผิดจริง จนท. ยังแก้ vertex ไม่ได้ (รอเฟส 2) แต่เลือก basemap ที่ถูก + แก้ attribute ครอบเคสส่วนใหญ่
