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

### สาเหตุที่ยังขุ่น + ระบายสีชุมชน (2026-10-14)

ข้อมูลจริงสัปดาห์แรก (12–13 ต.ค.): 56 บันทึก ยังขุ่น 8 — ส่วนใหญ่ "ขุ่นนิดหน่อย" ที่โบแค่ 5–15 นาที, รองลงมาหัวฝืดเปิดไม่ได้ / มีสิ่งกีดขวาง

- `FlushingLog.turbidCause`: `more_flush` (ขุ่นเล็กน้อย·ต้องโบเพิ่ม) · `obstacle` (มีสิ่งกีดขวาง) · `damaged` (หัวโบล์ชำรุด/ฝืด) · `other` (อื่น ๆ — **ต้องมีหมายเหตุ**)
  — **บังคับเลือกเมื่อผล = ยังขุ่น** · ผลใสแล้วล้างเป็น `""` · บันทึกเก่าก่อนมีช่องนี้เป็น `""` (แก้บันทึกเก่าที่ยังขุ่นต้องเลือกสาเหตุก่อนบันทึก)
- หน้าแอดมิน แถบ "จุดที่ยังขุ่น · ต้องตามซ้ำ" แยกกลุ่ม `FOLLOW_UP_GROUPS`: โบซ้ำ / เคลียร์พื้นที่ / ส่งซ่อม / ตรวจสอบ (`followUpGroupOf`)
- "ล่าสุดต่อจุด" คำนวณที่เดียว `latestByPoint` ใน `lib/smart-papar/communityStatus.js` (จุด = หัวโบล์ หรือชื่อจุดถ้าไม่ผูกหัว)
- แผนที่ระบายสีชุมชน (`communityTurbidStatus` — point-in-polygon ฝั่ง client): มีจุดที่ผลล่าสุดยังขุ่น = อำพัน (เข้มขึ้นตามจำนวนจุด) ·
  มีบันทึกและใสทั้งหมด = ฟ้าทึบ `#0284C7` · ไม่มีบันทึก = เส้นประฟ้าจาง · ใช้บันทึก**ทั้งช่วงวัน** (`statusLogs`) ไม่ผ่านตัวกรองผล/ค้นหา
  · คอลัมน์ซ้ายมีรายชื่อ "ชุมชนที่ยังขุ่น"
- หัวโบล์ที่บันทึกล่าสุดแจ้ง `damaged` → ขอบแดงบนแผนที่ + แผงข้อมูลบอก "ต้องส่งซ่อม" (`GET /api/smart-papar/flush-points` คืน `lastResult`/`lastTurbidCause`)
- **เปิดน้ำไม่ได้** (`NO_FLUSH_CAUSES` = `obstacle`, `damaged`): ไม่ต้องกรอกระยะเวลา (ว่าง = บันทึก `durationMin: 0`) และไม่ต้องมีรูปหลังโบ
  — ยังต้องมีรูปอย่างน้อย 1 รูปเป็นหลักฐาน · แสดงผลด้วย `durationText()` = "ไม่ได้เปิดน้ำ" · เวลาโบเฉลี่ยในหน้าแอดมินไม่นับครั้งที่ 0 นาที
### รีเช็คทะเบียนจากงานโบหน้างาน (2026-10-14)

- **ขยับตำแหน่งหัวตาม GPS หน้างาน:** `scripts/relocate-flush-points-from-logs.mjs` (dry-run ค่าเริ่มต้น, `--yes` เขียนจริง)
  ใช้บันทึกโบล่าสุดของแต่ละหัว · ห่าง ≤ 10 ม. ไม่ขยับ (GPS คลาดเคลื่อนปกติ) · ห่าง > 100 ม. ไม่ขยับ รายงานให้คนตรวจ ·
  หัวที่มีคนย้ายด้วยมือ**หลัง**วันที่โบ ไม่ทับ · ลงประวัติ `byName: "ยืนยันจากงานโบ <วันที่> · <เจ้าหน้าที่>"` รันซ้ำได้
- **รายการรีเช็คในแท็บทะเบียน** (ตัวกรอง "รีเช็คจากงานโบ"): บันทึกโบที่ยังไม่ผูกหัว (จุดแดงบนแผนที่) — อาจเป็นหัวใหม่
  แผง `FlushPointRecheckPanel.js` ให้เลือก: ผูกกับหัวใกล้สุด (≤ 200 ม.) / **สร้างหัวใหม่ตรงนี้** (ตำแหน่ง-ชื่อ-รูปจากหน้างาน รหัสรันให้
  แล้วผูกบันทึกให้อัตโนมัติ) / ไม่ใช่หัวโบล์ (`FlushingLog.flushPointReview = "dismissed"` ไม่ขึ้นอีก)
- API `GET|POST /api/smart-papar/flush-points/recheck` — แก้เฉพาะช่องผูกหัว (`flushPointId`/`flushPointCode`/`flushPointReview`)
  ไม่แตะเนื้อหาบันทึก แอดมินผูกหัวให้บันทึกภาคสนามได้ · **ห้ามตัดสินว่าเป็นหัวไหนจากชื่อจุดอย่างเดียว** ใช้ระยะจาก GPS

### หน้าสรุปคุณภาพน้ำสำหรับประชาชน `/papar` (2026-10-15)

- กดจากการ์ด "น้ำประปา" บนหน้าแรก (เดิมไป `/papar/flushing`) · ไม่ต้องล็อกอิน · ใช้ `CitizenShell` (`/papar` exact ใน `components/Layout.js`)
- การ์ด NTU + หมายเหตุมาตรฐานกรมอนามัย ≤ 5 NTU · การ์ด pH/TDS พร้อมป้าย "อยู่ในเกณฑ์มาตรฐาน" · ตารางผลตรวจ 30 วันล่าสุด
  (นับเฉพาะวันที่มีข้อมูล) · การ์ดงานโบตะกอน % ใสแล้ววันล่าสุด + 3 วันล่าสุด · ปุ่ม "โบตะกอน" → `/papar/flushing`
- เกณฑ์ `WATER_STANDARDS` ใน `lib/smart-papar/publicSummary.js`: NTU ≤ 5 · pH 6.5–8.5 · TDS ≤ 600 mg/L (เจ้าของยืนยัน)
- แสดงเฉพาะน้ำประปาจ่ายออก (`tap`) ไม่แสดงน้ำดิบ · API `GET /api/smart-papar/water-quality/public-summary`
  **ส่งเฉพาะตัวเลขรวม — ห้ามเพิ่มชื่อเจ้าหน้าที่/ตำแหน่ง/รูป/หมายเหตุงานโบ**

### เลือกหัวโบล์ได้ทุกหัว + ผูกแล้วย้ายหัว (2026-10-15)

ตำแหน่งในทะเบียนบางหัวคลาดเกิน 100 ม. จาก GPS สำรวจเดิม → รายการ "หัวใกล้" (ฟอร์ม 150 ม. / รีเช็ค 200 ม.) เลือกหัวจริงไม่ได้

- `searchFlushPoints` (`lib/smart-papar/flushPoints.js`) ค้นจากรหัส/ชื่อจุด/ถนน **ไม่จำกัดระยะ** (ข้ามหัวปิดใช้งาน, ≥ 2 ตัวอักษร)
- ฟอร์มบันทึกโบ: ช่อง "ค้นหาหัวโบล์อื่น" ใต้รายการหัวใกล้ · เลือกหัวที่ห่างเกินรัศมีขึ้นเตือนระยะ — **ฟอร์มผูกหัวอย่างเดียว ไม่ย้ายหัว**
- แผงรีเช็ค: ค้นหาได้ทุกหัว + ปุ่ม **ผูก** / **ผูก + ย้ายหัวมาที่นี่** (`POST recheck { moveFlushPoint: true }` แก้ตำแหน่งหัวเป็น GPS
  ของบันทึก ลง history `"<ชื่อ> (ย้ายตามงานโบ)"`)

## หน้าประชาชน /papar (ดีไซน์ใหม่ 2026-10-16) + แจ้งน้ำขุ่น/ไม่ไหล

- `/papar` เรียงใหม่: คำตอบก่อน (ผ่านเกณฑ์กี่ค่า + แก้วน้ำตามสี) → แถบระดับความขุ่น → pH/TDS พร้อมแถบช่วงเกณฑ์ → กราฟแท่ง 30 วัน (แตะดูรายวัน) + ตารางรายวันแสดงตลอด สูง ~5 แถว เลื่อนดูในกล่อง (เจ้าของขอ 2026-10-16) → งานโบตะกอน 7 วัน (รวมจาก `flushing` รายวันฝั่ง client) → การ์ดแจ้งน้ำขุ่น → ปุ่ม "โบตะกอน" ของเจ้าหน้าที่ (แบบเดิม)
- สีระดับความขุ่นมาจาก `waterLevel`/`ntuShade` เท่านั้น
- `/papar/report` (CitizenShell, ต้องอยู่ในรายการ citizen route ของ `components/Layout.js`) — อาการ (หลายข้อ) · เริ่มเมื่อไหร่ · ปักหมุด (GPS/แตะ/ลาก, `ReportLocationMap.js`) · จุดสังเกต · รูป ≤ 3 · ชื่อ/เบอร์ · ติ๊กยินยอม
- `POST /api/smart-papar/water-reports` (สาธารณะ) → collection `smart_papar_water_reports` (`models/smart-papar/WaterReport.js`) → การ์ด LINE 1 ข้อความเข้า**กลุ่มเจ้าหน้าที่เดิม** (`lineNotifyAdminGroup`, เจ้าของเลือก 2026-10-16) · บันทึก `lineNotifiedAt` เมื่อส่งสำเร็จ · rate-limit 3 เรื่อง/ชม. ต่อ IP และต่อเบอร์ (โควตา OA ใช้ร่วมทั้งระบบ)
- `GET /api/smart-papar/water-reports/locate?lat=&lng=` — ชื่อชุมชนจากพิกัด (ใช้ `findCommunityName` ของ flood-relief ตัวเดียวกับตอนบันทึก)
- ticket `WR-XXXXXX` สุ่ม (ไม่มี 0/O/1/I) เดาเลขคนอื่นไม่ได้ · ไม่ผูกระบบร้องเรียน/มอบหมายงาน · ยังไม่มีหน้าแอดมินดูรายการ (ข้อมูลอยู่ใน DB แล้ว)
- การ์ด LINE: altText ไม่มีชื่อ/เบอร์ · เบอร์อยู่ในปุ่ม "โทรหาผู้แจ้ง" เท่านั้น · รูปแรกเป็น hero (ไม่ส่งรูปแยก) ผ่าน `lineImageUrl` (ย่อ 1024px + **บังคับ JPEG** — ห้าม f_auto เพราะ LINE ไม่รับ WebP)
- logic + เทสต์: `lib/smart-papar/waterReport.js`

### คำเรียกงาน: ประชาชน "ระบายตะกอน" · เจ้าหน้าที่ "โบตะกอน" (2026-10-16)

- หน้าที่**ประชาชน**เห็น (`/papar`, `/papar/report`) ใช้คำว่า **"ระบายตะกอน"** — ประชาชนส่วนใหญ่ไม่รู้จักคำว่า "โบ" (เจ้าของสั่ง)
- หน้า/การ์ด**เจ้าหน้าที่** (ฟอร์มภาคสนาม `/papar/flushing`, หน้าแอดมิน, ทะเบียนหัวโบล์, การ์ด LINE) คง **"โบตะกอน"/"หัวโบล์"** ตามที่ใช้จริง

## รายงานผู้บริหาร + คิวงานโบตะกอนประจำ (2026-10-29)

- **แท็บ "รายงานและคิวงาน"** `/admin/smart-papar/water-quality/flushing?tab=report` (component `FlushingReport.js`) — ใช้สิทธิ์หน้าคุณภาพน้ำเดิม ไม่มีหน้า/เมนูแยก
- **สรุปผล** รายวัน (`?period=day&date=`) / รายเดือน (`?period=month&month=` + ตารางรายวัน) ผ่าน `GET /api/smart-papar/flushing/report` แยกทีม: โบ (ครั้ง, รวมบันทึกไม่ผูกหัว) · ระบาย (หัวในทะเบียนไม่ซ้ำ) · ใสแล้ว/ยังขุ่น (ตามผลล่าสุดของหัวในช่วงนั้น) — หัวหนึ่งนับในทีมของบันทึกล่าสุดในช่วง ไม่นับซ้ำสองทีม
- **คิวงานประจำ** `GET /api/smart-papar/flushing/queue`: รอบถัดไปนับจากวันโบล่าสุด (วันไทย, วันปฏิทิน) — **ใสแล้ว +15 วัน · ยังขุ่น +5 วัน** (`CYCLE_DAYS`) · จ่ายให้**ทีมของคนที่โบหัวนั้นครั้งล่าสุด** · กลุ่ม: เลยกำหนด / วันนี้ / 7 วันข้างหน้า / ภายหลัง / รอแก้ไขก่อน (ขุ่นเพราะสิ่งกีดขวาง/หัวชำรุด — `isNoFlush` — ไม่เข้ารอบ) / ยังไม่เคยโบ
- **ทีม** collection `smart_papar_flushing_teams` (model `FlushingTeam`, ทีมตั้งต้น `water` กองการประปา / `prevention` ทีมงานป้องกัน — key ใช้อ้างอิง เพิ่มทีมต่อท้าย `DEFAULT_TEAMS` เท่านั้น) · `members` = ชื่อคนบันทึก (`createdByName`) ตรงตัวหลัง trim · **ทีมหาตอนอ่าน ไม่ประทับลง log** → แก้ทีมแล้วรายงาน/คิวย้อนหลังเปลี่ยนตาม · ชื่อหนึ่งอยู่ทีมเดียว · ตั้งที่ปุ่ม "ตั้งค่าทีม" (`GET/PUT /api/smart-papar/flushing/teams`, PUT ต้องส่งครบทุกทีม) · ชื่อที่ไม่อยู่ทีมไหน = "ยังไม่จัดทีม"
- **ภาคสนาม** `/papar/flushing` มีกล่อง "คิวทีมของฉัน" (`GET /api/smart-papar/field/queue`, cookie PIN) — ทีมหาจากชื่อที่ใส่ตอนปลดล็อก, คืนเฉพาะเลยกำหนด/วันนี้/7 วันข้างหน้า และแค่รหัส/ชื่อจุด/วันครบกำหนด/ผลครั้งก่อน · แตะรายการ = เปิดฟอร์มพร้อมเลือกหัว (`FlushingForm` prop `initialFlushPointId`)
- logic ล้วน + เทสต์: `lib/smart-papar/flushingSchedule.js` · loader ฝั่ง server ร่วม: `lib/smart-papar/loadFlushingData.js`

### แท็บรายงาน — ดีไซน์ใหม่ (2026-10-29)

- `?tab=report` เรียงใหม่: **งานที่ต้องจัดการ** ก่อน แล้วจึง **ผลงาน** (รายวัน/รายเดือน)
- งานที่ต้องจัดการ = การ์ด 5 กลุ่ม (`lib/smart-papar/flushingWork.js#groupWork`, เทสต์ `__tests__/flushingWork.test.js`):
  ยังขุ่น → ตามสาเหตุล่าสุด (`followUpGroupOf`): โบซ้ำ / ส่งซ่อม / เคลียร์พื้นที่ / ตรวจสอบ · ใสแล้ว → "ครบรอบประจำ" เฉพาะเลยกำหนด/วันนี้/7 วันข้างหน้า
  · กดการ์ด = รายการ + แผนที่ (`FlushingWorkMap.js`) · โบซ้ำ/ครบรอบเรียงตามวันครบกำหนด · ส่งซ่อม/เคลียร์/ตรวจสอบเรียง "ค้าง X วัน" (นับจากวันที่บันทึกผล)
  · แถบภาพรวม: ใสอยู่ในรอบ / ครบรอบ / ต้องตามซ้ำ-แก้ไข / ยังไม่เคยโบ · กรองทีมได้
- ออกจากกลุ่มเมื่อทีมไปโบใหม่แล้วผลเปลี่ยน — ไม่มีปุ่ม "ซ่อมแล้ว" (เจ้าของต้องการดูสรุปเท่านั้น)
- `GET /flushing/queue` เพิ่ม `lastNtuBefore/After`, `lastPhotos`, `lastNote` (aggregate ใน `loadQueue`) — API ภาคสนามยังส่งเฉพาะช่องเดิม
- ผลงาน: ตัวเลข 4 ตัว + แถบเทียบทีม (ใส/ขุ่น) + กราฟแท่งรายวันแยกสีทีม · ตารางรายวันพับไว้

### ปฏิทินครบรอบ + งานที่ต้องไป (ภาคสนาม) — 2026-10-29

- แท็บรายงาน → การ์ด "ครบรอบประจำ" มี 2 มุมมอง: **ปฏิทินทีม** (ค่าเริ่มต้น) / รายการ + แผนที่
  - `FlushingDueCalendar.js` + `buildDueCalendar` (`flushingWork.js`): 3 สัปดาห์ เริ่มวันอาทิตย์ของสัปดาห์นี้ (ครอบรอบ 15 วัน) · ช่องวันแยกจำนวนตามทีม (สีทีมเดียวกับกราฟผลงาน) · เลยกำหนดแยกเป็นแถบ "ต้องไปก่อน" · แตะวัน = รายชื่อหัวแยกทีม + ปุ่มนำทาง · ติ๊ก "รวมงานโบซ้ำ" ได้ · ตามตัวกรองทีมด้านบน
  - ปฏิทินรวมหัวที่ครบหลัง 7 วันด้วย (การ์ดนับเฉพาะ ≤ 7 วัน)
- `/papar/flushing` กล่อง "คิวทีมของฉัน" → **งานที่ต้องไป**: แยกประเภท โบซ้ำ / ตรวจสอบ / ครบรอบ (`fieldTaskOf`) · ส่วน "ต้องไปวันนี้" (เลยกำหนด+วันนี้) และ "7 วันข้างหน้า" · การ์ดมีปุ่ม "นำทาง" (Google Maps) + "บันทึกผลหัวนี้" (เปิดฟอร์มพร้อมเลือกหัว)
  - หัวที่รอแก้ไข (สิ่งกีดขวาง/หัวชำรุด) ไม่ส่งให้ภาคสนาม
  - `GET /api/smart-papar/field/queue` เพิ่ม `lastTurbidCause`, `lastYmd`, `lastNtuAfter`, `coordinates`
