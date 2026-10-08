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

### บันทึกภาคสนาม (ไม่ต้องล็อกอิน)

เจ้าหน้าที่ภาคสนามบันทึกโบตะกอนจากมือถือได้โดยไม่มีบัญชี Clerk

- หน้า `/papar/flushing` (นอก `/admin` โดยตั้งใจ) · ทางเข้า: แตะการ์ด "น้ำประปา" บนหน้าแรก (`EnvCards`)
  หรือลิงก์ "สำหรับเจ้าหน้าที่" ท้ายหน้าแรก — **ไม่มีการ์ด/ปุ่มโบตะกอนแยกบนหน้าแรก** (เคยมี `FieldFlushingHomeCard`
  แต่เจ้าของให้เอาออก 2026-10-08 เพราะรกหน้าจอหลัก)
- ใส่ **รหัส (env `FLUSHING_FIELD_PIN`) + ชื่อ** ครั้งเดียว → cookie `sp_field` (HttpOnly, 180 วัน) เซ็น HMAC ด้วย
  `CLERK_SECRET_KEY` + PIN — **เปลี่ยน PIN = ทุกเครื่องหลุดทันที** · ไม่ตั้ง env = ปิดใช้งาน (unlock ตอบ 503)
  · **ห้ามเขียน PIN ลงโค้ด/เอกสาร — repo นี้ public**
- กันเดารหัส: ผิด 5 ครั้ง/IP ล็อก 15 นาที + ผิดรวม 30 ครั้งทุก IP ล็อกทั้งระบบ 15 นาที (ตัวนับในหน่วยความจำ)
- API `pages/api/smart-papar/field/` — `unlock` (POST), `me` (GET สถานะ / DELETE ออกจากโหมดเจ้าหน้าที่),
  `flushing` (POST บันทึกอย่างเดียว คืนแค่ `_id`) · logic + เทสต์: `lib/smart-papar/fieldAuth.js`
- รายการภาคสนามมี `source: "field"`, `fieldDeviceId`, `createdByClerkId: ""` → เจ้าของแก้เองไม่ได้
  ต้องให้แอดมินแก้ (ลบได้เฉพาะ superadmin ตามกติกาเดิม)

### ทะเบียนหัวโบล์ (2026-10-08)

จุดหัวโบล์ (อุปกรณ์ที่ใช้โบตะกอน) 203 หัว ตั้งต้นจากแอป Glide เดิม (สำรวจ ม.ค.–ก.พ. 2568) — **ไม่ใช่บันทึกงานโบ**
และไม่เกี่ยวกับทะเบียนท่อ `smart-water`

- Model `models/smart-papar/FlushPoint.js` → `smart_papar_flush_points` (code unique, kind, location Point, รูปบน Cloudinary, `legacy` = ที่มา)
- ⚠️ ตัวอักษรนำหน้ารหัส (AT/BP/CN) ในข้อมูลเดิมไม่ตรงกับชนิดจริง ~76 หัว — **ตัดสินชนิดด้วย `kind` เสมอ** เก็บรหัสตามต้นฉบับ
- นำเข้า: `node --env-file=.env.local scripts/import-flush-points.mjs [ไฟล์.kmz] [--yes] [--skip-photos]`
  — dry-run เป็นค่าเริ่มต้น · upsert ตาม code · ย้ายรูปจาก Glide เข้า Cloudinary `smart-papar/flush-points` (ไม่อัปซ้ำ)
  · ไฟล์ต้นฉบับ `docs/point-bortagon.csv.kmz` **gitignore ไว้** (repo public)
- API `GET /api/smart-papar/flush-points` — แอดมิน (สิทธิ์คุณภาพน้ำ) หรือเครื่องภาคสนามที่ใส่รหัสแล้ว · คืน `lastFlushedAt`/`flushCount` ต่อหัว
- บันทึกโบตะกอนผูกหัวโบล์ได้ (ไม่บังคับ): `FlushingLog.flushPointId` + `flushPointCode` (สำเนา) — ตรวจว่ามีจริงที่
  `lib/smart-papar/attachFlushPoint.js` ทุก API ที่เขียน
- ฟอร์ม: หลังได้ GPS เสนอหัวโบล์ใกล้สุด 3 หัวในรัศมี 150 ม. (`nearestFlushPoints` ใน `lib/smart-papar/flushPoints.js`)
- แผนที่: หมุดเล็กสีตามชนิด · โปร่ง = ยังไม่เคยมีบันทึกโบที่หัวนี้ · รูปย่อด้วย `lib/smart-papar/cloudinaryThumb.js`

### ดีไซน์ใหม่หน้าโบตะกอน (2026-10-08)

- สี/ตัวอักษรใช้โทเคน `pp-*` ใน `styles/globals.css` (น้ำเงินน้ำลึก · ใส = `pp-clear` · ขุ่น = `pp-turbid`) + `font-tk-sans` / `font-tk-mono` — สถานะใส/ขุ่นต้องต่างทั้งสีและไอคอน (lucide `Check` / `TriangleAlert`)
- `FlushingForm` — แถบความคืบหน้า 5 ขั้น, ปุ่ม +/− และปุ่มลัดระยะเวลา, แสดง % ความขุ่นที่ลด (`ntuChangePct` ใน `lib/smart-papar/flushing.js`), แถบล่างบอกช่องที่ยังขาด · `onSaved(data, submitted)` ส่งสิ่งที่กรอกกลับมาด้วยเพราะ API ภาคสนามคืนแค่ `_id`
- `/papar/flushing` — หน้าหลักสรุป "รอบนี้" (นับเฉพาะที่ส่งในหน้านี้) + หน้าบันทึกสำเร็จ "บันทึกจุดถัดไป"
- หน้าแอดมิน — กรองผล/ค้นหาฝั่ง client, การ์ดสรุป 4 ช่อง, แถบ "จุดที่ยังขุ่น · ต้องตามซ้ำ" (จุดที่บันทึก**ล่าสุด**ยังขุ่น), ตารางบนจอกว้าง/การ์ดบนมือถือ, แผงรายละเอียดด้านขวามีรูปก่อน/หลังและประวัติจุดเดียวกันในช่วงที่โหลด

## จัดการทะเบียนหัวโบล์ (2026-10-08)

- **เป็นแท็บ "ทะเบียนหัวโบล์" ในหน้าโบตะกอน** `/admin/smart-papar/water-quality/flushing?tab=registry` (แท็บแรก "งานโบตะกอน" ไม่มี query)
  — เจ้าของให้รวมเป็นหน้าเดียว ไม่ต้องสลับหลายหน้า (2026-10-08) · ไม่มีหน้า/เมนูแยกแล้ว · component `FlushPointRegistry.js` โหลดแบบ `dynamic` ตอนเปิดแท็บ
  · สลับแท็บแล้วฟอร์มที่ยังไม่บันทึกหาย (แท็บถูก unmount)
- เดสก์ท็อป 3 คอลัมน์ [รายการ | แผนที่ | ฟอร์ม] · มือถือ: แผนที่ + รายการ, ฟอร์มเป็นแผ่นเต็มจอ (ซ่อนระหว่างย้ายหมุด) · components `FlushPointAdminMap.js` (react-leaflet, `dynamic ssr:false`) + `FlushPointEditor.js`
- แก้ได้: ชื่อจุด (`name`), ถนน/ซอย (`roadName` — แยกจากชื่อจุด, เลือกจากชื่อที่มีอยู่ให้สะกดตรงกัน), ประเภท (`kind`), ตำแหน่ง (ลากหมุด/แตะแผนที่/GPS ที่ยืนอยู่/วางพิกัด), รูป, สถานะใช้งาน (`active=false` → ไม่ส่งให้ฟอร์มภาคสนาม)
- **รหัส (`code`) เปลี่ยนไม่ได้หลังสร้าง** — `FlushingLog.flushPointCode` เป็นสำเนา; เปลี่ยนประเภทแล้วรหัสคงเดิม
- **รหัสหัวใหม่รันให้อัตโนมัติ** (`nextFlushPointCode`) ต่อรูปแบบเดิม `<อักษรตามชนิด>25<เลขรัน>` — เลขรันชุดเดียวทุกชนิด ไม่เติม 0
  (ข้อมูลเดิมถึง 204 → หัวถัดไป `AT25205`) · อักษร: ตัวทีใหญ่ AT · พวงมาลัย BP · ตัวทีเล็ก/กลาง CN · ไม่ระบุ AT
  · อักษรเปลี่ยนตามประเภทที่เลือกจนกว่าจะพิมพ์รหัสเอง · "25" คงที่ (เจ้าของเลือกต่อเลขเดิม ไม่เปลี่ยนตามปี)
- **ลบหัวโบล์** (`DELETE /api/smart-papar/flush-points/[id]`) ได้เฉพาะหัวที่**ไม่เคยถูกอ้างในบันทึกโบ** (นับรวมบันทึกที่ลบแล้ว)
  — มีบันทึกอ้าง → 409 แล้วหน้าเว็บเสนอ "ปิดใช้งาน" แทน · ลบจริงไม่มีประวัติเหลือ (log แค่ console) · ไม่ลบรูปใน Cloudinary
- API: `GET /api/smart-papar/flush-points?scope=admin` (รวมหัวที่ปิด + ประวัติ 10 รายการล่าสุด, `no-store`) · `POST` เพิ่มหัว · `PATCH /api/smart-papar/flush-points/[id]` (merge แล้ว validate ทั้งก้อน) — ไฟล์เดิม `flush-points.js` ย้ายเป็น `flush-points/index.js`
- ทุกการแก้ลง `FlushPoint.history` (`{at, byName, action, changes:[{field, from, to, movedM?}]}`) เก็บล่าสุด 30 รายการ + `updatedByName`
- logic ล้วน + เทสต์: `lib/smart-papar/flushPointEdit.js` (`validateFlushPointInput`, `diffFlushPoint`, `flushPointIssues`, `roadNameOptions`) · สีชนิดใช้ร่วม `FLUSH_POINT_KIND_COLORS` ใน `flushPoints.js`
- ตัวกรอง "ต้องตรวจข้อมูล" = ไม่มีชื่อจุด / ไม่มีถนน / ชนิดไม่ระบุ (ยังไม่ได้ตรวจ "ตัวอักษรหน้ารหัสไม่ตรงชนิด" เพราะยังไม่มีตารางจับคู่ที่ยืนยันแล้ว)
