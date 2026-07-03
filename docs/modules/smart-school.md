# Smart School (สำรวจการศึกษา / ทุนการศึกษา)

ทะเบียนผู้ขอทุนแบบ "บุคคล + ใบสมัครรายปีงบประมาณ" — รายเก่ายืนยันตัวด้วย
เลขบัตร 13 หลักแล้วดึงข้อมูลปีที่แล้วมาแก้ไขได้ ข้อมูลทุกปีเก็บครบ
(spec: `docs/superpowers/specs/2026-07-03-smart-school-redesign-design.md`)

## หน้า

- `/admin/smart-school` — แดชบอร์ด (แท็บปีงบ, ตาราง+แผนที่, สถานะ 4 ค่า,
  ป้ายกติกาทุน 1 คน/ครัวเรือน/ปี + หมุนเวียนผู้รับ)
- `/admin/education-map` — path เดิม redirect มาหน้านี้
- ฟอร์มสาธารณะ: wizard ใน `components/smart-school/survey/` เปิดจากหน้าแรก

## API — `pages/api/smart-school/`

- public: `lookup` (ค้นมาสก์), `verify` (ยืนยันเลข 13 หลัก + ผูกเลขให้รายเก่า),
  `submit` (ใบสมัครปีปัจจุบัน + n8n)
- admin (`_auth.js` pattern เดียวกับ pm25): `list` (+flags ครัวเรือน),
  `update` (รวมรูป + backfill เลขบัตร), `status`, `delete`

## Models — `models/smart-school/`

- `SchoolApplicant` → `school_applicants` (บุคคล; `citizenId` unique sparse)
- `SchoolApplication` → `school_applications` (ใบสมัคร/ปี; unique
  `applicantRef+surveyYear`; เลขใบสมัคร `TKC69-001` ออกผ่าน `school_counters`)
- collection เดิม `educationregisters` **ไม่ถูกแตะ** — backup ถาวร
  (migrate ด้วย `scripts/migrate-education-to-smart-school.js`)

## n8n

`lib/smart-school/notify.js` ยิง webhook `sm-school` (workflow "Api All") 3 events:
`school.submitted` / `school.renewal_updated` ("รายเก่า update ข้อมูล") /
`school.images_changed` — ENV override: `N8N_SCHOOL_WEBHOOK_URL`

## หมายเหตุ

- `pages/api/student-feedback/*` + `StudentFeedback` ยังแยกอยู่กับโมดูล
  activities (ดู activities.md)
- โมดูล education เดิมถูกปลดระวาง 2026-07 — โค้ดเก่าดูได้จาก git history
