# โรงเรียนผู้สูงอายุ (elderly-school)

ติดตามสุขภาพผู้เรียนโรงเรียนผู้สูงอายุรายปีการศึกษา (พ.ศ.) ปีละ 16 ครั้งเรียน:
น้ำหนัก/ส่วนสูง/รอบเอว/ชีพจร/ความดัน + ประเมินสุขภาพจิต 2Q/9Q
เช็คอินผ่าน QR ที่พิมพ์แจกผู้เรียน

> แยกออกจาก smart-health เมื่อ 2026-06-10 (เฟส 1 ของการจัดระเบียบโครงสร้าง)

## หน้า

| Path | ทำอะไร | สิทธิ์ |
|---|---|---|
| `/admin/elderly-school` | แดชบอร์ดหลัก (สรุปสุขภาพ, แก้ข้อมูลบุคคล, 2Q/9Q, import ชีต) | เมนู "จัดการ" |
| `/admin/elderly-cards` | พิมพ์บัตร QR เช็คอิน | hideFromMenu, ลิงก์จากแดชบอร์ด |
| `/admin/elderly-schedule` | ตั้งวันเรียนครั้งที่ 1-16 ของปี | hideFromMenu, ลิงก์จากแดชบอร์ด |
| `/elderly/checkin` | **public** — ผู้เรียนเช็คอิน+กรอกค่าวัดเอง (ยืนยันเลขบัตร 4 ตัวท้าย) | ไม่ต้องล็อกอิน |

⚠️ **ห้ามเปลี่ยน path `/elderly/checkin`** — QR ที่พิมพ์แจกแล้วฝัง URL นี้

## API — `pages/api/elderly-school/`

`cards` (รายชื่อทำบัตร), `checkin` (verify/บันทึก/สรุป — public),
`schedule` (GET/PUT วันเรียน), `dashboard` (aggregation สรุปสุขภาพ),
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

- `components/elderly-school/ElderlySchoolDashboard.js` — แดชบอร์ดหลัก (ใหญ่, มี modal แก้ไข/2Q/import/QR)
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
