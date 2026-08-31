# แผนงาน: จัดการงานเจ้าหน้าที่ (Officer Task Management) — เฟส 1 (ข้อ 1–4)

ที่มา: `docs/design_handoff_officer_task_management/README.md` (หัวข้อ "ลำดับงานที่แนะนำ")
สาขา: `officer-task-management` (แตกจาก `origin/main` — ไม่ซ้อน PR #145)

เฟส 1 ครอบ 4 ข้อแรก: (1) สี primary + ฟอนต์ (2) ขยาย schema + ย้าย SLA ไปตั้งค่า
(3) derived-field logic ฝั่ง server + `GET /api/tasks/my-kpi` (4) shared components 6 ตัว
หน้าจอ 1–3 / API pool / responsive เป็นเฟสถัดไป

**สถานะ 2026-08-31: ข้อ 1–4 เสร็จ** (vitest 80 เทสต์ใหม่ผ่าน · tsc/lint สะอาด · smoke test อ่านข้อมูลจริงผ่าน) — ยังไม่ commit · ยังไม่ได้รัน `next build` (dev server ของเจ้าของรันอยู่ที่ :3000) · ค้าง: UI ตั้งค่า `task_settings` (มีแต่ API), `kpi.satisfaction` รอ PR #145

## การตัดสินใจ (เหตุผลสั้น ๆ)

| เรื่อง | ตัดสินใจ | ทำไม |
|---|---|---|
| สี primary | **ไม่แตะ `--color-primary` ของ `mytheme`** — เพิ่มโทเคน `tk-*` ใน `@theme` ของ `styles/globals.css` แล้วใช้ `bg-tk-primary` / `text-tk-overdue-ink` ฯลฯ | หน้าเก่าทุกหน้ายังพึ่ง `btn-primary` (น้ำเงิน) — เปลี่ยน global = รีคัลเลอร์ทั้งระบบโดยไม่ได้รีวิวทีละหน้า; โมดูล smart-school/garbage/waste ก็ใช้ม่วง `#7C3AED` ผ่าน `components/ui/adminTheme.jsx` โดยไม่แตะ theme อยู่แล้ว · ถ้าจะสลับทั้งระบบภายหลัง แก้ `--color-primary` บรรทัดเดียว ไม่ต้องแก้ component |
| ฟอนต์ | Anuphan โหลดอยู่แล้วใน `pages/_document.tsx` → เติม **IBM Plex Mono** ในลิงก์เดิม + โทเคน `font-tk-sans` / `font-tk-mono` | ไม่เพิ่ม request ใหม่ |
| SLA ต่อประเภทเรื่อง | **ไม่ใส่ใน `AdminOption`** (README เสนอ) → model ใหม่ `models/tasks/TaskSettings.js` (singleton, collection `task_settings`) + `lib/tasks/settings.js` | `AdminOption` คือ "วิธีแก้ไข" หลายแถวต่อประเภท ไม่ใช่ทะเบียนประเภทเรื่อง ใส่ slaDays ที่นั่นจะซ้ำทุกแถว; แบบ singleton ตรงกับ `Pm25Settings` / `LineSettings` |
| status enum ใหม่ | **ไม่ใส่ Mongoose `enum`** — ค่าคงที่ใน `lib/tasks/status.js` (`รอประสานหน่วยงานภายนอก`) | `status` เป็น String เปล่าใน schema ทั้งสองไฟล์ และข้อมูลเก่ามีค่าที่ไม่อยู่ในชุด (`รอการตรวจสอบ` ฯลฯ) ใส่ enum จะทำให้ save เอกสารเก่าพัง |
| ขั้นของ stepper | เพิ่ม `Assignment.stage` (`received → site_visit → coordinating → awaiting_review → closed`) + `timeline[]` | stepper ต้องมีที่เก็บสถานะ; ไทม์ไลน์หน้าจอ 3 ต้องมีที่เก็บ |
| Complaint model | เติม `organizationId` **ทั้ง** `models/Complaint.js` และ `models/SubmittedReport.js` | สองไฟล์ลงทะเบียนชื่อ `SubmittedReport` เดียวกัน — ไฟล์ไหนโหลดก่อนชนะ ฟิลด์ต้องมีทั้งคู่ (ปัญหาเดียวกับ User inline schema) |
| ความพึงพอใจใน KPI | `kpi.satisfaction = null` ไว้ก่อน | `lib/satisfaction/readStats.js` อยู่บน PR #145 ยังไม่เข้า main — ห้ามคำนวณ `$avg` เอง; ต่อหลัง merge |
| เวลา | ทุกการนับวัน/เดือนใช้ Asia/Bangkok (`lib/tasks/format.js`) | เซิร์ฟเวอร์ Railway รัน UTC |

## โครงไฟล์ (โมดูล `tasks` — ต่อจาก `pages/api/tasks/` เดิม)

```
lib/tasks/        settings.js status.js derived.js kpi.js groupBy.js badges.js format.js
                  loadSettings.js (I/O) · types.ts · __tests__/*.test.js
models/tasks/     TaskSettings.js
components/tasks/ AlertBadge TaskRow WorkGroupAccordion PoolCard StatusStepper CoordinationBlock (+index.ts)
pages/api/tasks/  my-kpi.ts (อัปเดต) · pending.ts (ใช้ SLA จาก settings) · settings.ts (ใหม่)
docs/modules/tasks.md
```

## เกณฑ์ derived (สรุปจาก README + ค่า default)

- `slaDays(category)` = `slaByCategory[category]` ?? `defaultSlaDays` (7)
- `dueDate` = `assignment.dueDate` ที่บันทึกไว้ → ถ้าไม่มี `complaint.createdAt + slaDays` → ถ้าไม่มี `assignedAt + slaDays`
  · พัก SLA: เลื่อนด้วย `slaPausedMs` + ช่วงที่ยังพักอยู่
- `isOverdue` = now > dueDate && !completedAt && !slaPausedAt · `overdueDays` = วันที่เลย
- `isDueSoon` = !overdue && daysToDue ≤ `warnBeforeDays` (2)
- `daysUnclaimed` = now − createdAt (เรื่องไม่มี assignment) · amber ≥ `unclaimedWarnDays` (3) · แดง/"ค้างเกิน" > `unclaimedAlertDays` (4)
- `needsCoordination` = มี `coordination.agencyName` และยังไม่ปิด · `isBlocked` = `blocked.isBlocked`
- `severity` = overdue > due_soon > coordinating > blocked > normal
