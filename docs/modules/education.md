# การศึกษา / Smart School (education)

ทะเบียนผู้รับทุน-นักเรียนพร้อมพิกัดบนแผนที่ + ความเห็นนักเรียนต่อกิจกรรม

## หน้า

- `/admin/education-map` — แดชบอร์ดหลัก (แผนที่ Leaflet, ตาราง, filter, export, CRUD)

## API

- `pages/api/education/*`: `all`, `update`, `education-survey`, `fix-duplicates`,
  `bulk-update-prefix` (ดช. → ด.ช.), `reset-applicant-id`
- `pages/api/student-feedback/*` — ความเห็นนักเรียน (ผูกกิจกรรม — ดู
  [activities.md](activities.md); ความสัมพันธ์สองโมดูลนี้จะจัดใหม่หลังออกแบบฟีดกิจกรรม)

## Models

- `EducationRegisterModel` → collection `EducationRegister` (ข้อมูลผู้รับทุน:
  รายได้, ที่อยู่อาศัย, ทุนที่เคยได้, โรงเรียน, GPA, พิกัด lat/lng)
- `StudentFeedback` (แชร์กับโมดูล activities)
- `ElderlySchoolSchedule` ไม่เกี่ยวกับโมดูลนี้ (อยู่ `models/elderly-school/`)

## Components — `components/education/`

`MapEducationPoints` (แผนที่), `EducationDetailModal`, `EducationEditModal`,
`EducationFormModal`, `EducationSummary`, `EducationTable`
(⚠️ `StudentFeedbackForm/Modal` ยังอยู่ root ของ components/ — รอเฟส 4)

เอกสารเดิม: `EDUCATION_FEATURES.md` ที่ root
