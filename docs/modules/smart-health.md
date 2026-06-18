# Smart Health

ระบบสุขภาพชุมชน: ยืม-คืนอุปกรณ์การแพทย์, สุขภาพพนักงานเทศบาล,
ทะเบียนบุคคล/เยี่ยมบ้าน, สรุปตามชุมชน

> โรงเรียนผู้สูงอายุเคยเป็นแท็บหนึ่งของโมดูลนี้ — แยกออกเป็นโมดูล
> [elderly-school](elderly-school.md) แล้วเมื่อ 2026-06-10

## หน้า

- `/admin/smart-health` — แดชบอร์ดแท็บ: คำขออุปกรณ์ / สุขภาพพนักงาน /
  คลังอุปกรณ์ / ประวัติยืม-คืน / สรุปตามชุมชน / ข้อมูลบุคคล

## API — `pages/api/smart-health/`

- อุปกรณ์: `active-borrows`, `all-borrows`, `available-count`, `available-devices`,
  `borrow-device`, `borrow-return`, `borrowed-devices`, `deliver-device`,
  `return-device`, `registered-devices`, `registered-users`, `update-request-status`,
  `ob-registration`, `menu-ob-health`
- สุขภาพพนักงาน: `employee-health/dashboard`, `employee-health/dashboard-db`,
  `employee-health/sync`
- อื่น ๆ: `people` (ทะเบียนบุคคล/เยี่ยมบ้าน), `register-object-health/*`,
  `feedback-submitted`
- ⚠️ เหลือ shim ชั่วคราว `elderly/checkin.js` (re-export ไป
  `/api/elderly-school/checkin`) — ลบใน release ถัดไป

## Models (ยังอยู่ root ของ `models/` — รอเฟส 5)

`RegisterHealthModel`, `MenuHealthModel`, `EmployeeHealthRecord`, `EmployeePerson`,
`SubmittedReport` (+ ดู `pages/api/submittedreports/*` ซึ่งควรย้ายมาใต้โมดูลนี้ในเฟสหลัง)

## Components — `components/sm-health/`

แท็บ/ตาราง/โมดัลของอุปกรณ์ (`RequestTable`, `RegisterDeviceTable`,
`BorrowReturnTable`, `BorrowModal`, `ReturnModal`, …), `EmployeeHealthDashboard`,
`CommunityPlanningSummary`, `SmartHealthMap`, `PersonDataTable`

- ⚠️ `ElderlyDataTable.js` เป็น **dead code** (ไม่มีใคร import) — รอลบเฟส 7

## Lib

- `lib/employeeHealthDashboard.js` — สรุปสุขภาพพนักงาน
  (import เมตริกจาก **`lib/health/metrics.js`** — ของกลาง อย่าก็อปฟังก์ชันซ้ำ)
