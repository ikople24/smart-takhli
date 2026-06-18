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
