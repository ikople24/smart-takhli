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

## เฟส 2 (2026-09-01) — ข้อ 5 หน้าจอ 1 `my-tasks` ✅

- หน้า `pages/admin/my-tasks.tsx` เขียนใหม่ตาม hifi: header card · alert row (กรอง `?alert=`) · KPI strip · กลุ่มงาน (`?groupBy=`) + right rail
- logic เพิ่ม: `lib/tasks/summary.js` (alertCards / coordinationRail / blockedRail / dueThisWeekRail) + `initials` — TDD 15 เทสต์ใหม่
- API เพิ่ม: `POST /api/complaints/assignments/transfer`, `POST /api/complaints/coordination` (set / follow_up / notify_line)
- `kpi.satisfaction` ต่อแล้วผ่าน `readStats.js#loadSatisfactionStatsForComplaints` (PR #145 เข้า main แล้ว)
- ตัดสินใจ: ปุ่ม "รับงานจากกอง" ชี้ `/admin/manage-complaints` ชั่วคราว (`POOL_HREF`) · ลูกศร task row ไป manage-complaints จนกว่าจะมีหน้าจอ 3
  · "แจ้ง LINE" ถามยืนยันก่อนเสมอ (โควตา) · ยังไม่ได้ดูหน้าด้วยตา (ไม่มี browser tool) — ตรวจ tsc/lint/CSS/smoke
- ค้าง: ข้อ 6 (`/admin/task-pool` + `GET /api/tasks/pool` — ต้องทำครบ 4 จุดของ skill adding-admin-page), ข้อ 7 (หน้าจอ 3), ข้อ 8 (มือถือ)

## เฟส 3 (2026-09-01) — ข้อ 6 หน้าจอ 2 `task-pool` ✅

- ข้อมูลจริงเปลี่ยนสมมติฐาน README: `organizations` มีแค่ตัวเทศบาล → ใช้ `Complaint.department` (ชื่อกองมาตรฐาน) แทน `organizationId`
  + ทะเบียนกอง `lib/tasks/departments.js` (alias จาก `users.department` ที่สะกดไม่ตรงกัน) + mapping ประเภท→กอง (ค่าเสนอแนะ)
- `lib/tasks/pool.js` (TDD 18 เทสต์) + `loadPool.js` (I/O) · API `GET /api/tasks/pool`, `POST pool-alert`, `PATCH tasks/set-department` (ย้ายจาก `complaints/[id]/…` เพราะชน slug `[id_card].js` — dev server ล้ม), `DELETE assignments/[id]` (เลิกทำ)
- หน้า `/admin/task-pool` ลงทะเบียนครบ 4 จุด + `scripts/grant-task-pool-permission.mjs` (dry-run พบ 13 user — **รอเจ้าของรัน --yes**)
- ตัดสินใจ: ช่วงเวลา default 30 วัน แต่ alert bar บอกจำนวนเรื่องเก่ากว่านั้นเสมอ · "ร้องซ้ำ" = เบอร์+ประเภท+ชุมชน (เบอร์อย่างเดียวได้ 17 ครั้งจากเบอร์เจ้าหน้าที่)
  · ยังไม่ทำ drag & drop ข้ามคอลัมน์ (README ระบุ desktop) · "รับเป็นผู้ประสาน" รอหน้าจอ 3
- ค้าง: ข้อ 7 หน้าจอ 3 (รายละเอียด + stepper + coordination set) — ลูกศร task row / หัวเรื่อง pool card ยังไปหน้า manage-complaints · ข้อ 8 มือถือ

## เฟส 4 (2026-09-01) — ข้อ 7 หน้าจอ 3 `/admin/my-tasks/[assignmentId]` ✅

- `lib/tasks/timeline.js` (TDD 14 เทสต์): buildTimeline (เรียงเชิงตรรกะก่อนเวลา — ข้อมูลเก่า completedAt 00:00), closeChecklist, stageChangePlan, blockedUpdate
- สกัด `lib/complaintNotify.js` จาก `update-status.js` (LINE ผู้แจ้ง + กลุ่ม) ให้ปิดเรื่องจากหน้าจอ 3 ใช้ร่วม — พฤติกรรมเดิมคงไว้
- API `GET/PATCH /api/tasks/[assignmentId]` (progress / close / blocked) · หน้า + 4 components · ลูกศร task row / rail / pending widget → หน้าจอ 3
- ตัดสินใจ: ชื่อ/เบอร์ผู้แจ้งแสดงเต็มให้เจ้าหน้าที่ (README วาด mask แต่เจ้าหน้าที่ต้องโทร) · progress ธรรมดาไม่แจ้ง LINE (โควตา) · ไม่ทำ drag/popover ป้าย
- ค้าง: ข้อ 8 มือถือ (bottom nav/FAB/หน้ามือถือ 3 จอ) + ยังไม่มีใครเห็นหน้าจริง · ยังไม่ `next build`

## เฟส 5 (2026-09-01) — นโยบายสิทธิ์โอน/มอบหมาย (เจ้าของสั่ง: กันโอนกันมั่ว / ไม่มีใครรับ) ✅

- `lib/tasks/roles.js` + `digest.js` (TDD 15 เทสต์) · `users.isDepartmentHead` (superadmin ติ๊กผ่าน `HeadsPanel` + `GET/PUT /api/tasks/heads`) fallback ตำแหน่ง
- โอนงาน: เฉพาะหัวหน้ากอง (งานในกอง) / superadmin · admin ธรรมดา "ขอโอนงาน" (`transfer-request` → กระดิ่งหัวหน้า) · โอนแล้วแจ้งผู้รับทางกระดิ่ง
- หัวหน้าเห็น "งานของกอง" (`my-kpi?scope=department`) และโอนงานลูกน้องได้จากปุ่มเดิม
- cron `pages/api/cron/tasks/stale-digest.ts` (แนะนำ `30 1 * * *` UTC) แจ้งกระดิ่งหัวหน้ากอง 1 รายการ/กอง/วัน — ไม่ใช้ LINE (โควตา)
- ค้าง: ตั้ง cron บน Railway · ย้าย HeadsPanel เข้าหน้าจัดการผู้ใช้เมื่อรีดีไซน์เสร็จ · ข้อ 8 มือถือ

## เฟส 6 (2026-09-01) — ข้อ 8 มือถือ ✅ (ครบทั้ง 8 ข้อของ README)

- `lib/tasks/mobile.js` (TDD 7 เทสต์): ระยะทาง "ใกล้ฉัน", topUrgent (FAB), poolChipCounts
- `MobileTaskNav` (5 ช่อง + FAB) · `QuickTaskSheet` · `PoolCard variant=mobile` · AlertCards 2×2 · OfficerHeaderCard ย่อ · `GET /api/tasks/pool-count`
- 3 หน้าใช้ responsive ในไฟล์เดิม (ไม่แยกหน้า): chip+flat list (pool), ปุ่มสถานะเร็ว 2×2 + ถ่ายภาพ + footer ลอย (detail)
- ค้าง: ดูจริงบนมือถือ (ผมไม่มี browser) · ตั้ง cron · grant script · next build · push/PR
- ปรับตาม feedback 2026-09-01: ย้าย HeadsPanel ไป `/admin/superadmin/department-heads` (การบริหารระบบ) · ตัด ADMIN_META title ของ task-pool (ชื่อซ้ำ h1) · แก้ alert bar มือถือถูกบีบ

## เฟส 7 (2026-09-02) — จัดระเบียบความซ้ำซ้อนกับหน้าการร้องเรียน (เจ้าของสั่งทำครบ 4 ข้อ) ✅

1. บังคับล็อกอิน `assignments/create` + `update-status` (เดิมยิงตรงได้ไม่ต้องล็อกอิน) · ลบ `assignments/update` ที่ไม่มี auth
2. ปุ่ม "อัพเดท" ใน manage-complaints → หน้าจอ 3 · ลบ `UpdateAssignmentModal` (ทางเขียนเดียว)
3. ปิดเรื่องจากหน้าทะเบียนตั้ง `assignment.completedAt/stage` + timeline (KPI สม่ำเสมอ)
4. กติกาที่ server ใน create: `canClaim` (กองเดียวกัน, TDD) · มอบหมาย = หัวหน้า/superadmin · 409 กันรับซ้ำ
- feedback 2026-09-02: กองงานรอรับ default แสดงทุกเรื่อง/ทุกช่วงเวลา (เดิม 30 วัน) ทั้งเดสก์ท็อป+มือถือ · คอลัมน์กองที่มีงานกำลังดำเนินการโผล่เสมอ + ตัวเลขลิงก์ไป 'งานของกอง' (`loadInProgressByDepartment`)
