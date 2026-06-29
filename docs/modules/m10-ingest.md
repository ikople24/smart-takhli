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

## Worklist → LTAX (rev. 2026-06-28)
- หน้า admin รวมเป็น `/admin/m10` แบบ tabs: นำเข้า · คิวยืนยัน · ทะเบียน · **Worklist → LTAX** (panels ที่ `components/m10/`)
- worklist = txn ที่ `reviewStatus=confirmed` && changeType ∈ {TRANSFER, TRANSFER_PARTIAL, OWNER_CORRECTION, BOUNDARY_CHANGE} && `ltaxStatus=pending`
- `lib/m10-ingest/worklist/buildWorklistItem.ts` (pure) → สคริปต์คีย์ตามลำดับ LTAX (ดึงเจ้าของดิบจาก payloadRaw); **ลำดับ field เป็น assumption ปรับได้** (ดู spec §5)
- API `pages/api/m10-ingest/worklist/*` (gate `/admin/m10`); เลขบัตรดิบส่งเฉพาะ focus endpoint, ไม่ log
- สถานะคีย์เก็บบน M10Transaction (`ltaxStatus/ltaxKeyedBy/ltaxKeyedAt/ltaxNote`)
- **ยังไม่รองรับ:** SPLIT/MERGE/NEW (ต้อง Parcel Code + basemap), RETIRED, RPA

Spec: `docs/superpowers/specs/2026-06-28-ltax-worklist-design.md`
