# m10 Basemap Registry + Matcher (รอบ A) — Design

วันที่: 2026-06-29 · โมดูล: `m10-ingest` · สถานะ: design (รออนุมัติ)

## 1. เป้าหมาย / ขอบเขต

ต่อจาก worklist → LTAX: ตอนนี้ worklist ครอบเฉพาะแปลงที่ "แก้บนแปลงเดิม" (TRANSFER ฯลฯ)
ส่วน SPLIT/MERGE/NEW ยัง deferred เพราะต้องรู้ **Parcel Code (PARCEL_COD)** ของ LTAX ก่อน

งานรอบ Parcel Code แยกเป็น 2 ก้อนที่พึ่งพากัน — **spec นี้ครอบเฉพาะ A**:

- **A (spec นี้):** โหลด basemap เข้าระบบเป็น registry + matcher จับคู่ m10 ↔ basemap
  เพื่อให้ทุก record รู้ PARCEL_COD ของตัวเอง (หรือถูก flag ว่า match ไม่ได้)
- **B (รอบถัดไป — ไม่อยู่ใน spec นี้):** เอนจินแนะ Parcel Code ใหม่สำหรับ SPLIT/MERGE/NEW
  + หน้า officer confirm + ดันเข้า worklist

**คุณค่าที่ได้จาก A เพียวๆ:** record ที่ match ได้ (รวม TRANSFER ที่ใช้อยู่ตอนนี้) จะมี PARCEL_COD
แสดงใน worklist/ทะเบียนได้ทันที และเป็นวัตถุดิบ (record ของ SPLIT/MERGE/NEW ที่ match แล้ว) ให้รอบ B

## 2. ข้อมูลจริง (พื้นฐานการตัดสินใจ)

basemap `public/parcel.shp.geojson` — 13,436 แปลง, อยู่ใน WGS84/4326 แล้ว (พิกัด ~100.35, 15.24)
- field สำคัญ: `PARCEL_COD`, `Chanod_no`(โฉนด), `LAND_NO`(เลขที่ดิน), `SURVEY`(หน้าสำรวจ), `area/rai/ngan/wa`, geometry
- **coord เป็น 3D** (มีค่า Z elevation) → ต้องตัด ordinate ที่ 3 ทิ้งก่อนทำ 2dsphere
- **ไม่ unique เป๊ะ:** PARCEL_COD ซ้ำ 93 (13,436 → unique 13,343); Chanod_no ซ้ำ ~494 → index ห้าม unique

m10 transactions ปัจจุบัน (75 รายการที่มี recordKey, 71 มี geometry) จับด้วยโฉนด:
- โฉนดตรงตัว 1 แปลง = **52 (69%)** → จบด้วยโฉนดอย่างเดียว มั่นใจสูง
- โฉนดซ้ำ (เจอหลายแปลง) = **4** → ต้องใช้ geometry ตัดสิน
- โฉนดไม่อยู่ใน basemap = **19** (NEW 10, TRANSFER 5, ENCUMBRANCE 2, MERGE 1, RETIRED 1)
  - NEW 10 = match ไม่ได้ถูกต้อง (แปลงเกิดใหม่ → สัญญาณรอบ B)
  - TRANSFER 5 = ควร match → geometry ช่วยกู้ (โฉนดพิมพ์ต่าง/basemap เก่ากว่า)

## 3. สถาปัตยกรรม / โครงสร้างไฟล์ (ตาม module convention)

```
models/m10-ingest/M10Basemap.js          # collection m10_basemap
lib/m10-ingest/basemap/load.ts           # pure: geojson feature → basemap doc (+ ตัด Z)
lib/m10-ingest/basemap/match.ts          # pure: matchParcel() cascade ← หัวใจ
lib/m10-ingest/repository/index.ts       # + basemap query, reconcileRecord(), listReconcile()
scripts/m10-load-basemap.js              # CLI โหลด basemap → Mongo (ครั้งเดียว)
scripts/m10-reconcile-backfill.js        # CLI รัน matcher ทับ record เดิม
pages/api/m10-ingest/reconcile.js        # GET read-only (gate /admin/m10)
components/m10/ReconcilePanel.jsx         # แท็บใหม่ใน /admin/m10
```

## 4. Model `M10Basemap`

| field | มาจาก geojson | หมายเหตุ |
|---|---|---|
| parcelCode | PARCEL_COD | index (non-unique) |
| zoneId / blockId / lot | ZONE_ID / BLOCK_ID / LOT | |
| deedNo | Chanod_no → String | index (non-unique) |
| landNo | LAND_NO | |
| survey | SURVEY | |
| landType | land_type | |
| area | {rai, ngan, wa, sqm} | sqm = area; rai/ngan/wa จาก field ตรง |
| geometry | geometry (ตัด Z → 2D) | **2dsphere index** |

- ไม่เก็บ raw ทั้งก้อน (ลดขนาด) — เก็บเฉพาะ field ข้างต้น
- โหลดด้วย CLI `m10-load-basemap.js`: อ่าน geojson → **drop collection แล้ว bulk insert ใหม่** (idempotent รันซ้ำได้; เลี่ยง upsert เพราะ parcelCode/deedNo ซ้ำได้ ไม่มี natural key ที่ unique)

## 5. `matchParcel()` — cascade (pure fn)

```
input:  { deedNo, landNo, survey, geometry }  (จาก txn/record)
        + candidate fetchers (query DB ส่งเข้ามา เพื่อให้ fn บริสุทธิ์/เทสต์ได้)
output: {
  status: "matched" | "ambiguous" | "unmatched",
  method: "deed" | "deed+geom" | "land+survey" | "land+survey+geom" | "geom" | null,
  confidence: "high" | "medium" | "low" | null,
  parcelCode: string | null,
  basemapId: string | null,
  candidates: [{ parcelCode, basemapId, deedNo, overlapPct }]
}
```

ลำดับชั้น (หยุดทันทีที่ได้ `matched`):

1. **โฉนดตรงตัว** (`deedNo` == basemap.deedNo)
   - เจอ 1 → `matched` / `deed` / high
   - เจอหลาย → ตัดสินด้วย geometry overlap: ถ้ามีแปลงเดียว overlap ชัด → `matched` / `deed+geom` / high;
     ไม่งั้น → `ambiguous` (แนบ candidates)
   - ไม่เจอ → ชั้น 2
2. **เลขที่ดิน + หน้าสำรวจ** (`landNo` && `survey` ตรงทั้งคู่)
   - เจอ 1 → `matched` / `land+survey` / medium-high
   - เจอหลาย → geometry ตัดสิน (`land+survey+geom`)
   - ไม่เจอ → ชั้น 3
3. **geometry overlap** (`$geoIntersects` ดึง candidate → คำนวณ IoU ด้วย turf)
   - overlap สูงสุด **IoU ≥ 0.5** → `matched` / `geom` / medium
   - มี overlap แต่ < 0.5 → `ambiguous` (แนบ candidates เรียงตาม overlapPct)
   - ไม่มี overlap → `unmatched`

หมายเหตุ: record ที่ไม่มี geometry (4 ราย) ข้ามชั้นที่ใช้ geometry — ถ้าโฉนด/เลขที่ดินไม่จบ → `unmatched`

## 6. เก็บผลลง `M10Record`

เพิ่ม field:
```
parcelCode: String | null
parcelMatch: {
  status, method, confidence,
  basemapId: ObjectId | null,
  candidates: [{ parcelCode, basemapId, deedNo, overlapPct }],
  matchedAt: Date
}
```

**เมื่อไหร่ที่รัน:**
- ตอน `applyTxnToRecord()` (confirm txn) → หลัง upsert record เรียก `reconcileRecord(record)`
- backfill ครั้งเดียวสำหรับ record เดิม ด้วย `m10-reconcile-backfill.js`
- ถ้าโหลด basemap ใหม่ → รัน backfill ซ้ำได้ (idempotent)

SPLIT/MERGE/NEW เป็น taxRelevant → ได้ record → ถูก match ด้วย (NEW จะออกมา `unmatched` ตามคาด)

## 7. แท็บ Reconcile (read-only)

`ReconcilePanel` + `GET /api/m10-ingest/reconcile`:
- การ์ดสรุป: matched / ambiguous / unmatched (นับจำนวน)
- ตาราง: recordKey, โฉนด, ประเภท, สถานะ (badge), method/confidence, parcelCode **หรือ** candidates (รหัส+overlap%)
- filter ตามสถานะ
- **ไม่มี action** — การ confirm/เลือก candidate เป็นงานรอบ B

## 8. เทสต์

- **unit** `matchParcel` (vitest, fixtures เล็ก): โฉนดตรง 1, โฉนดหลาย→geom ตัดสิน, โฉนดหลาย→ambiguous,
  เลขที่ดิน+สำรวจ, geom-only ≥0.5, geom <0.5 → ambiguous, unmatched, record ไม่มี geometry
- **unit** `load` (geojson feature → doc): ตัด Z ออกจาก coord, map field, area
- **integration**: โหลด basemap subset จริง (ไม่กี่แปลงจากไฟล์จริง) → reconcileRecord → assert parcelCode/status

## 9. นอกขอบเขต (รอบ B)

- officer confirm รหัส / เลือก candidate
- เอนจินสร้างรหัส Parcel Code ใหม่สำหรับ SPLIT (suffix `/001`), MERGE (รหัสน้อยสุด), NEW (seq ถัดไปในบล็อก)
- ดัน SPLIT/MERGE/NEW เข้า worklist
- RETIRED handling

## 10. ความเสี่ยง / ข้อควรระวัง

- **Z coordinate**: 2dsphere จะ error ถ้าส่ง 3D coord — ต้องตัดใน `load` ให้แน่ใจ (มีเทสต์)
- **basemap เก่ากว่า m10**: TRANSFER 5 รายที่โฉนดไม่เจอ คือ symptom — geometry กู้ได้บางส่วน ที่เหลือเป็น `ambiguous/unmatched` ให้ จนท. ดู (ปกติของ as-of สองแหล่งที่ไม่ sync วัน)
- **IoU 0.5 เป็น default** — ปรับได้ถ้าเจอ false match; เก็บ overlapPct ไว้ใน candidates เพื่อ tune ภายหลัง
- **duplicate PARCEL_COD/deed** ใน basemap — matcher คืน candidates หลายตัวเป็น `ambiguous` ไม่เดามั่ว
