# Smart Papar — คุณภาพน้ำประปา

บันทึกคุณภาพน้ำรายวันจาก Google Sheets → MongoDB (upsert ราย `recordDate`
เขตเวลา Bangkok)

## หน้า

- `/admin/smart-papar/water-quality.jsx`

## API

- `pages/api/smart-papar/water-quality/` (มี `_auth.js` — Clerk)
- Sync manual: `POST /api/smart-papar/water-quality/sync-sheet` (Clerk)
- Sync อัตโนมัติ: `POST /api/cron/smart-papar/water-quality-sync` (`CRON_SECRET`)

## Model

`models/smart-papar/WaterQualityDaily.js` → collection
`smart_papar_water_quality_daily`
— **โมดูลแรกที่ใช้ convention โฟลเดอร์ย่อยใน models/** (แบบอย่างของแนวทาง A)

## Components

`components/smart-papar/`

## Env vars

`GOOGLE_SHEETS_SPREADSHEET_ID` (+ `GOOGLE_SHEETS_SHEET_NAME` /
service-account pair เมื่อ sheet ไม่ได้ link-share), `CRON_SECRET`

## บันทึกโบตะกอน (2026-10-06)

ให้เจ้าหน้าที่หน้างานบันทึกงานโบตะกอน (ระบายตะกอนในท่อ) + ถ่ายรูปก่อน/หลัง จากมือถือ —
**ใช้คำว่า "โบตะกอน" ใน UI เสมอ** · ไม่ผูกกับเรื่องร้องเรียนหรือทะเบียนท่อ (`smart-water`)

- หน้า: `pages/admin/smart-papar/water-quality/flushing.jsx` → `/admin/smart-papar/water-quality/flushing`
  — **อยู่ใต้ path หน้าคุณภาพน้ำโดยตั้งใจ** เพราะ `_app.tsx` ตรวจสิทธิ์ด้วย `router.pathname` แบบ prefix
  จึงใช้สิทธิ์หน้าแม่ได้ทั้ง guard และเมนูโดยไม่ต้องลง `ALL_PAGES`/รัน grant · ห้ามย้ายออกไปนอก `water-quality/`
- API: `pages/api/smart-papar/flushing/` — `GET ?from=&to=` (วันไทย, ≤ 500 รายการ + summary), `POST`,
  `PATCH /[id]` (merge เดิม + payload แล้ว validate ทั้งก้อน), `DELETE /[id]` (soft delete) — ผ่าน `requireSmartPaparAdmin`
- Model: `models/smart-papar/FlushingLog.js` → collection `smart_papar_flushing_logs` (GeoJSON Point + `2dsphere`)
- Logic ล้วน + เทสต์: `lib/smart-papar/flushing.js` (`validateFlushingInput`, `canModifyFlushingLog`,
  `summarizeFlushing`, `bangkokDayRange`) · `lib/smart-papar/__tests__/flushing.test.js`
- Components: `components/smart-papar/FlushingForm.js`, `FlushingList.js`, `FlushingMap.js` (leaflet — โหลดผ่าน `dynamic(..., { ssr:false })`)
- ชั้นขอบเขตชุมชนบนแผนที่: `GET /api/smart-papar/communities` อ่าน `geojsonfeatures` (ของแอปพี่น้อง app_b — **อ่านอย่างเดียว** ผ่าน native driver) แยกจาก endpoint ของ flood-relief เพราะสิทธิ์คนละชุด
- กติกา:
  - ต้องมีพิกัด GPS, ชื่อจุด, ระยะเวลา (1–600 นาที), ผล (`clear`/`still_turbid`) และรูปอย่างน้อย 1 รูป · NTU ไม่บังคับ
  - รูปช่องละ ≤ 3, URL ต้องเป็น `https://res.cloudinary.com/` · ย่อฝั่ง client (`lib/smart-papar/resizeImage.js`) ก่อนอัปโหลด
  - แก้/ลบ: เจ้าของภายใน 7 วันนับจาก **`createdAt`** (ไม่ใช่ `flushedAt` ที่เจ้าของแก้เองได้) · superadmin ได้เสมอ
