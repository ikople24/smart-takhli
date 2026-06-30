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

## Worklist → LTAX (rev. 2026-06-29)
- หน้า admin รวมเป็น `/admin/m10` แบบ tabs: **สรุปรายเดือน** (default) · นำเข้า · คิวยืนยัน · ทะเบียน · **Worklist → LTAX** (panels ที่ `components/m10/`)
- **สรุปรายเดือน** (`SummaryPanel` + `GET /api/m10-ingest/summary` → `summaryByPeriod()`): group by `batch.period` แสดง นำเข้า/รอยืนยัน/คืบหน้าคีย์ LTAX (keyed/eligible)/ค้างคีย์/ข้าม/รอรอบหน้า(SPLIT/MERGE/NEW)
- หน้านำเข้าเลือกเดือน-ปีด้วย dropdown (เดือนไทย + พ.ศ.) → period `YYYY-MM`
- worklist = txn ที่ `reviewStatus=confirmed` && changeType ∈ {TRANSFER, TRANSFER_PARTIAL, OWNER_CORRECTION, BOUNDARY_CHANGE} && `ltaxStatus ∉ {keyed,skipped}` (รวม doc เก่าที่ไม่มี field — default ไม่ backfill)
- `lib/m10-ingest/worklist/buildWorklistItem.ts` (pure) → สคริปต์คีย์ตามลำดับ LTAX (ดึงเจ้าของดิบจาก payloadRaw); **ลำดับ field เป็น assumption ปรับได้** (ดู spec §5)
- API `pages/api/m10-ingest/worklist/*` (gate `/admin/m10`); เลขบัตรดิบส่งเฉพาะ focus endpoint, ไม่ log
- สถานะคีย์เก็บบน M10Transaction (`ltaxStatus/ltaxKeyedBy/ltaxKeyedAt/ltaxNote`)
- **ยังไม่รองรับ:** SPLIT/MERGE/NEW (ต้อง Parcel Code + basemap), RETIRED, RPA

Spec: `docs/superpowers/specs/2026-06-28-ltax-worklist-design.md`

## Basemap registry + matcher (รอบ A — 2026-06-29)
- **เป้าหมาย:** ทุก record รู้ `PARCEL_COD` (LTAX) ของตัวเอง โดยจับคู่กับ basemap (`parcel.shp.geojson` 13,436 แปลง)
- model `M10Basemap` (collection `m10_basemap`): parcelCode/zoneId/blockId/lot/deedNo/landNo/survey/area/geometry; index `deedNo`,`parcelCode` (non-unique — basemap มีซ้ำ), `2dsphere`
- `lib/m10-ingest/basemap/load.ts` (pure): geojson feature → doc; **ตัด Z** + rewind + turf booleanValid (basemap เป็น 4326 แล้ว — ไม่ reproject ต่างจาก `geometry/join.ts`)
- `lib/m10-ingest/basemap/match.ts` (pure async): `matchParcel()` cascade **โฉนด → เลขที่ดิน+หน้าสำรวจ → geometry IoU≥0.5**; รับ resolver inject (เทสต์ด้วย fake), เรียก lazy ตามชั้น; output `{status: matched|ambiguous|unmatched, method, confidence, parcelCode, candidates}`
  - **เจอหลาย candidate แต่ parcelCode เดียวกันหมด → matched** (basemap เก็บแปลงเดียวเป็นหลาย polygon fragment ไม่ใช่ ambiguous จริง); ambiguous เหลือเฉพาะกรณีรหัสต่างกันจริง → ดูที่แท็บ "จับคู่ basemap" filter ambiguous เพื่อแก้
- `reconcileRecord()` ใน repository: ต่อ resolver กับ DB (`$geoIntersects`) เก็บผลลง `M10Record.parcelCode/parcelMatch` (ไม่ bump version) — รันตอน `applyTxnToRecord` (confirm) + backfill
- `M10Record` เพิ่ม `landNo/survey` (ดึงจาก payloadRaw ตอน materialize), `parcelCode`, `parcelMatch`
- CLI: `npm run m10:load-basemap -- <geojson>` (drop+insert, สร้าง 2dsphere ก่อน insert ให้ MongoDB S2 validate รายตัว — เข้มกว่า turf) · `npm run m10:reconcile-backfill`
- API `GET /api/m10-ingest/reconcile` (gate `/admin/m10`) + แท็บ **จับคู่ basemap** (read-only: matched/ambiguous/unmatched + candidates)
- **นอก scope (รอบ B):** officer confirm/เลือก candidate, สร้างรหัส Parcel Code ใหม่ (SPLIT/MERGE/NEW), ดันเข้า worklist

Spec: `docs/superpowers/specs/2026-06-29-m10-basemap-matcher-design.md` · Plan: `docs/superpowers/plans/2026-06-29-m10-basemap-matcher.md`

## Reconcile map editor (เฟส 1 — 2026-06-29)
- งานหลักเจ้าหน้าที่แผนที่ภาษี = กลั่นกรอง 2 ทาง (ข้อมูลดิบ ม.10 ↔ รูปแปลง basemap) — แท็บ "จับคู่ basemap" เพิ่ม **focus mode** มีแผนที่
- `components/m10/ReconcileMap.jsx` (react-leaflet, dynamic `ssr:false`): ทับ m10 polygon (แดงประ) · candidate basemap (น้ำเงิน คลิกเลือก=เขียว) · แปลงข้างเคียง bbox (เทา)
- จนท. **เลือกแปลงที่ถูก + แก้ attribute** (โฉนด/เลขที่ดิน/หน้าสำรวจ/เนื้อที่) → [บันทึก & เช็คใหม่]
- **Save model กัน replay:** เก็บลง `M10Record.reconcileOverride` (status `resolved`, by/at) ไม่แตะ field canonical; `reconcileRecord` (auto) **ข้าม** record ที่ resolved; effective = override ?? auto
- `resolveReconcile()` re-run `matchParcel` ด้วยค่าใหม่ (ตรง ไม่ผ่าน guard) เก็บ parcelMatch ล่าสุด; parcelCode ที่ จนท. เลือกชนะเสมอ
- API: `GET /api/m10-ingest/reconcile/[recordKey]` (detail+candidates+nearby) · `POST .../resolve`
- **นอก scope (เฟส 2):** วาด/แก้ vertex (เพิ่ม geoman) · สร้างรหัส SPLIT/MERGE/NEW · ดันเข้า worklist

Spec: `docs/superpowers/specs/2026-06-29-m10-reconcile-map-editor-design.md` · Plan: `docs/superpowers/plans/2026-06-29-m10-reconcile-map-editor.md`

### เฟส 2 — แก้/วาด vertex รูปแปลง (2026-06-29)
- เพิ่ม `@geoman-io/leaflet-geoman-free` (peer leaflet ^1.2 → เข้ากับ 1.9.4); ผูกกับ L.map ผ่าน `useMap` ใน `ReconcileMap` (ssr:false)
- ปุ่ม [แก้รูปแปลง]/[วาดแปลงใหม่] ใน focus → ลาก/เพิ่ม/ลบ vertex (`allowSelfIntersection:false`) → เก็บ geometry ใน state
- `normalizeEditedGeometry()` (`basemap/load.ts`): strip Z + rewind + booleanValid — validate ก่อนเก็บ
- เก็บ `reconcileOverride.geometry`; **effective geometry = override.geometry ?? record.geometry** (canonical ไม่ถูกแตะ); `getReconcileItem`/`resolveReconcile` ใช้ effective ในการ re-match
- `POST .../resolve` รับ `geometry` เพิ่ม (optional); invalid → 400

Spec: `docs/superpowers/specs/2026-06-29-m10-reconcile-vertex-edit-design.md` · Plan: `docs/superpowers/plans/2026-06-29-m10-reconcile-vertex-edit.md`

### Basemap corrections layer (2026-06-29)
- ปัญหา: การแก้ของ จนท. อยู่บน record override เท่านั้น → matcher เทียบ basemap เก่า "ปนกันมั่ว"
- **2 collection (replay เหมือน txn→record):** `m10_basemap` = effective (นำเข้า+แก้ทับ, matcher ใช้) · `m10_basemap_edit` = ชั้นแก้ของ จนท. (key=parcelCode, source of truth)
- `applyBasemapEdit()`: upsert edit + apply ลง effective — มี geometry → ลบ fragment เดิม insert 1 doc (ยุบเป็นรูปเดียว); attr-only → updateMany; รหัสใหม่ → insert
- `replayBasemapEdits()`: เรียกท้าย `m10:load-basemap` หลัง drop+reinsert → **การแก้รอด import**
- `resolveReconcile(writeBasemap)`: opt-in (checkbox "อัปเดตกลับเข้า basemap" default ปิด) → applyBasemapEdit
- **v1 จำกัด:** ยุบ fragment เป็นรูปเดียว (เทียบ fragment ทีหลัง), จนท. พิมพ์รหัสเอง (ยังไม่มีเอนจิน SPLIT/MERGE/NEW), ไม่ลบแปลง, ยังไม่ export กลับเป็นไฟล์ .geojson

Spec: `docs/superpowers/specs/2026-06-29-m10-basemap-corrections-layer-design.md`

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

## ผู้ช่วยแนะรหัสแปลง SPLIT/MERGE/NEW (2026-06-30)
- แท็บ **"รหัสแปลงใหม่"** ใน `/admin/m10` — list confirmed deferred (SPLIT/SPLIT_PUBLIC/MERGE/NEW) + รหัสที่แนะ → จนท. ยืนยัน
- **เอนจินแนะ (pure):** `lib/m10-ingest/parcelcode/suggest.ts` (resolver inject) — NEW: โฉนดตรง basemap→ใช้รหัสเดิม, ไม่ตรง→`nextBlockSeq` ของบล็อกแปลงที่ทับ · SPLIT: `nextSuffix` ใต้แปลงแม่ (รูปทับมากสุด) · MERGE: parcelCode น้อยสุด · `parcelCode.ts` = parse/seq/suffix (ชั้น /001→/01→/1)
- **ข้อมูลไม่มี group key** (`MERGE_PARCEL` ว่าง, `PROCESS_ORDER` แค่ลำดับ step) → assistant แนะต่อ record ไม่ auto-group; default SPLIT = suffix ลูก
- ยืนยัน = `confirmNewCode` → `resolveReconcile` (inject geometry=record.geometry, writeBasemap) → reconcileOverride.resolved + basemap `kind:new` (รูปจาก m10) → ปรับรูปละเอียดที่หน้า basemap ทีหลัง. รหัสที่ยืนยันเก็บใน `reconcileOverride.parcelCode` (canonical parcelCode ไม่ถูกแตะ)
- **worklist eligibility ขยาย:** deferred ที่ `reconcileOverride.status==="resolved"` นับเป็น eligible (ผ่าน distinct resolvedKeys ใน `summaryByPeriod`/`listWorklistPending`) → ไหลเข้าคิวคีย์ LTAX; `deferred` count = ที่ยังไม่ resolved
- API `pages/api/m10-ingest/newcode/*` (gate `/admin/m10`) · UI `components/m10/NewCodePanel.jsx` (focus ใช้ ReconcileMap read-only)
- **นอก scope:** auto-group siblings, RETIRED, ตั้งแปลงเก่าที่ถูกรวม/แบ่งเป็น retired อัตโนมัติ, ปรับ buildWorklistItem script เฉพาะ SPLIT/MERGE (worklist item ใช้ builder เดิม)

Spec: `docs/superpowers/specs/2026-06-30-m10-parcelcode-suggest-design.md` · Plan: `docs/superpowers/plans/2026-06-30-m10-parcelcode-suggest.md`
