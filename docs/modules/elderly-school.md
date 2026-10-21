# โรงเรียนผู้สูงอายุ (elderly-school)

ติดตามสุขภาพผู้เรียนโรงเรียนผู้สูงอายุรายปีการศึกษา (พ.ศ.) ปีละ 16 ครั้งเรียน:
น้ำหนัก/ส่วนสูง/รอบเอว/ชีพจร/ความดัน + ประเมินสุขภาพจิต 2Q/9Q
เช็คอินผ่าน QR ที่พิมพ์แจกผู้เรียน

> แยกออกจาก smart-health เมื่อ 2026-06-10 (เฟส 1 ของการจัดระเบียบโครงสร้าง)

## หน้า

| Path | ทำอะไร | สิทธิ์ |
|---|---|---|
| `/admin/elderly-school` | หน้าหลักแบบแท็บ `?tab=` (ดูด้านล่าง) — ปีเลือกด้วย `?yearBE=` | เมนู "จัดการ" (รายการเดียวใน Sidebar หลัก) |
| `/admin/elderly-cards` | **redirect** → `/admin/elderly-school?tab=cards` (คง path ให้ลิงก์เดิม) | hideFromMenu |
| `/admin/elderly-schedule` | **redirect** → `/admin/elderly-school?tab=schedule` | hideFromMenu |
| `/elderly/checkin` | **public** — ผู้เรียนเช็คอิน+กรอกค่าวัดเอง (ยืนยันเลขบัตร 4 ตัวท้าย) | ไม่ต้องล็อกอิน |

⚠️ **ห้ามเปลี่ยน path `/elderly/checkin`** — QR ที่พิมพ์แจกแล้วฝัง URL นี้

### แท็บใน `/admin/elderly-school` (ดีไซน์ใหม่ 2026-10)

เมนูย่อยของโมดูลเป็น**แท็บด้านบน** ไม่ใช่เมนูด้านข้าง (กันซ้อนกับ Sidebar หลักของ `LayoutAdmin`)
ทุกแท็บใช้สิทธิ์ `/admin/elderly-school` ที่เดียว — เพิ่มแท็บใหม่**ไม่ต้อง**ลงทะเบียนสิทธิ์/เมนู

| `?tab=` | ทำอะไร | query เสริม |
|---|---|---|
| `overview` (ค่าเริ่มต้น) | ความคืบหน้า 16 ครั้ง, ตัวเลขหลัก, การ์ดสุขภาพทั้งกลุ่ม (ขึ้นต้นด้วย % เกณฑ์ดี), รายชื่อต้องติดตาม, กราฟจำนวนผู้มีผลวัด | — |
| `visits` | เลือกครั้งที่ → กรอก/แก้ผลวัดทั้งห้องในตาราง, รายชื่อคนที่ยังไม่มีผลวัด | `visit=1..16` |
| `registry` | ทะเบียนทั้งปี + แผงประวัติรายคน (แก้ข้อมูลคน/ผลวัดรายครั้ง/QR) | `person`, `quick`, `filter` (bp/bmi/whtr/ncd/pulse/2q จากการ์ดภาพรวม) |
| `screening` | คัดกรอง 2Q (หน้าจอนี้ไม่มี 9Q) | `person`, `list` |
| `schedule` | ตั้งวันเรียน 1–16 (เดิม `/admin/elderly-schedule`) | — |
| `cards` | พิมพ์บัตร QR A4 (เดิม `/admin/elderly-cards`) — บัตรยังพิมพ์เลขบัตร 4 ตัวท้ายเหมือนเดิม | — |
| `import` | นำเข้า Google Sheet (ตรวจตัวอย่าง → นำเข้า) — **แสดงเฉพาะ superadmin เหมือนเดิม** | — |

"ต้องติดตามใกล้ชิด" = ความดันสูง หรือ NCD 3/3 หรือ 2Q บวก หรือชีพจรผิดปกติ (`needsCloseFollowUp` ใน `lib/elderly-school/followUp.js`)

## API — `pages/api/elderly-school/`

`cards` (รายชื่อทำบัตร), `checkin` (verify/บันทึก/สรุป — public),
`schedule` (GET/PUT วันเรียน), `dashboard` (aggregation สรุปสุขภาพ — 2026-10 เพิ่ม `totals.registered`,
`attendance[16]`, `mentalHealthOthers`, และต่อคน `visitId`/`source`/`hasData`/`attendedCount`/`bpReadings`),
`import` (นำเข้าชีต CSV แบบ upsert), `assessments` (2Q/9Q),
`people`, `visits`, `sheet-dashboard` (สรุปจาก Google Sheet CSV โดยตรง)

- ✅ **Auth (2026-06-19):** endpoint admin ทั้ง 8 (`cards`, `dashboard`, `import`,
  `people`, `schedule`, `visits`, `assessments`, `sheet-dashboard`) กั้นด้วย
  `requireElderlySchoolAdmin` (`pages/api/elderly-school/_auth.js`) — ต้องมีสิทธิ์หน้า
  `/admin/elderly-school` (superadmin ลัดผ่าน). `checkin` ยังเป็น **public** ตามตั้งใจ
- shim ชั่วคราว: `/api/smart-health/elderly/checkin` re-export ไป endpoint ใหม่
  (กัน tab ค้างช่วง deploy — ลบได้ใน release ถัดไป)

## Models — `models/elderly-school/`

| Model | Collection | เก็บอะไร |
|---|---|---|
| `ElderlyPerson` | `elderly_people` | ข้อมูลบุคคล, citizenId, baseline น้ำหนัก/ส่วนสูง |
| `ElderlyVisit` | `elderly_visits` | ค่าวัดรายครั้ง (visitNo 1-16, yearBE) |
| `ElderlyMentalHealthAssessment` | `elderly_mental_health_assessments` | ผล 2Q/9Q, ธงเสี่ยงฆ่าตัวตาย |
| `ElderlySchoolSchedule` | `elderly_school_schedules` | วันเรียนรายปี |

## Components / Lib

- `components/elderly-school/ElderlySchoolModule.jsx` — shell หน้าหลัก: หัวโมดูล + ตัวเลือกปี + แถบแท็บ (`TABS`)
- `components/elderly-school/tabs/*Tab.jsx` — หนึ่งไฟล์ต่อแท็บ
- `components/elderly-school/PersonProfilePanel.jsx`, `VisitEditModal.jsx`, `QrCheckinModal.jsx` — ใช้ร่วมหลายแท็บ
- `components/elderly-school/useElderlyData.js` — hook ดึง dashboard/roster/schedule + `mergeRoster`
- `components/elderly-school/elderlyTheme.jsx` — โทเคนสี/ปุ่ม/ป้ายสถานะ (`TONE_STYLES`: ok/care/see/low/none/mind)
- `lib/elderly-school/followUp.js` — ตรรกะล้วนของหน้าแท็บ (ป้ายติดตาม, การ์ดสุขภาพ, สถานะวันเรียน) + เทสต์ `__tests__/followUp.test.js`
- (ลบ `ElderlySchoolDashboard.js` แดชบอร์ดเดิมแล้ว 2026-10)
- `components/elderly-school/ElderlyPersonalHealthSummary.tsx` — สรุปสุขภาพรายคน (ใช้ในหน้า checkin)
- `lib/elderly-school/dashboard.js` — parse ชีต CSV + สรุปแถว
- `lib/elderly-school/import.js` — แปลงแถวชีต → person+visits
- `lib/elderly-school/mentalHealth.js` — ตรรกะ 2Q/9Q (`is2QPositive`, `score9Q`, …)
- **ของกลาง**: `lib/health/metrics.js` (`computeBMI`, `bmiCategoryThai`, `bpCategory`,
  `coerceMeasurementNumber`) — โมดูล smart-health (employee-health) ใช้ร่วม ห้ามย้ายกลับเข้าโมดูลนี้

## Env vars

`ELDERLY_SCHOOL_SHEET_CSV_URL` (จำเป็นสำหรับ sheet-dashboard/import) +
`ELDERLY_SCHOOL_SHEET_*_COLUMN` (เลือกใส่ — map คอลัมน์ชีต)

## ข้อควรระวัง

- เพิ่มหน้าใหม่ของโมดูลนี้: ลงทะเบียน `ALL_PAGES` + `DEFAULT_PERMISSIONS` ใน
  `lib/permissions.ts` และเมนูใน `components/LayoutAdmin.tsx` (hardcode แยกกัน)
- user ที่มี custom `allowedPages` ใน Mongo ต้องได้รับสิทธิ์หน้าใหม่ด้วย script
  (ดู `scripts/grant-elderly-school-permission.js` เป็นตัวอย่าง)
