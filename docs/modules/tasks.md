# งานเจ้าหน้าที่ (tasks) — Officer Task Management

ระบบจัดการงานของเจ้าหน้าที่: **กลุ่มงานของฉัน** (งานที่ถืออยู่ จัดกลุ่มตามประเภท/กอง/ความเร่งด่วน) ·
**กองงานรอรับ** (เรื่องยังไม่มีเจ้าของ กดรับเอง) · **ป้ายเตือนชุดเดียวทุกหน้าจอ** ·
**ประสานหน่วยงานภายนอก** (แยก *หน่วยงานผู้ดำเนินการ* เช่น กฟภ. ออกจาก *ผู้ประสานงาน* เช่น กองช่าง)

- ที่มาดีไซน์ (hifi): `docs/design_handoff_officer_task_management/README.md`
- แผน + เหตุผลการตัดสินใจ: `docs/superpowers/plans/2026-08-31-officer-task-management-p1.md`
- **สถานะ (2026-09-01): เฟส 1 (ข้อ 1–4) + เฟส 2 (ข้อ 5 หน้าจอ 1) เสร็จ** — `/admin/my-tasks` โฉมใหม่ใช้งานได้จริง
  (โอนงาน · บันทึกติดตาม · แจ้ง LINE) · ค้าง: หน้าจอ 2 (`task-pool` + API pool), หน้าจอ 3, มือถือ/LINE hooks

## หน้า

- `/admin/my-tasks` — **หน้าจอ 1 โฉมใหม่** (`pages/admin/my-tasks.tsx`): header card · การ์ดเตือน 4 ใบ (คลิก → `?alert=`) ·
  KPI strip · กลุ่มงานของฉัน (`?groupBy=category|organization|priority` regroup ฝั่ง client, จำกลุ่มที่เปิดใน sessionStorage) ·
  right rail (ต้องประสานงานต่อ / รอวัสดุ / ครบกำหนดสัปดาห์นี้) · ปุ่ม "โอน / ส่งต่องาน" (modal) · "รับงานจากกอง"
  ชี้ไป `/admin/manage-complaints` ชั่วคราวจนกว่าจะมีหน้าจอ 2 (`POOL_HREF`) · ลูกศรใน task row ยังไปหน้า manage-complaints (หน้าจอ 3 ยังไม่มี)
  · meta ใน `components/Layout.js` เหลือแค่ `title` เพราะหน้ามี header card เอง
- `/admin/task-pool` — ยังไม่มี (หน้าจอ 2)

## API (`pages/api/tasks/`)

| endpoint | หน้าที่ |
|---|---|
| `GET /api/tasks/my-kpi?groupBy=category\|organization\|priority&alert=overdue\|due_soon\|coordinating\|blocked` | งานทั้งหมดของเจ้าหน้าที่ที่ล็อกอิน + derived fields + `kpi` + (ถ้าส่ง groupBy) `groups` — คีย์เดิม (`status`, `daysAssigned`, `resolutionDays`, `actionUrl`) คงไว้ให้หน้าเดิม |
| `GET /api/tasks/pending` | widget งานค้างเดิม — เปลี่ยนมาใช้ SLA จาก `task_settings` ผ่าน `deriveAssignment` |
| `GET /api/tasks/settings` · `PUT` (superadmin) | SLA/เกณฑ์เตือน — PUT รับบางฟิลด์ได้ (merge) ลง audit `task_settings_updated` |
| `pages/api/tasks/_auth.ts` | `getOfficer(req)` (Clerk → users ใน Mongo) · `requireSuperAdmin(req)` |
| `POST /api/complaints/assignments/create` | (path เดิมใต้ complaints) รับ `role: assignee\|coordinator`, ตั้ง `dueDate` = วันที่แจ้ง + SLA, `stage: received`, timeline `created` |
| `POST /api/complaints/assignments/transfer` | `{ assignmentId, toUserId, reason }` โอนงาน — เจ้าของงาน/superadmin, เหตุผลบังคับ, ปลายทางต้องเป็น user ของแอปนี้ที่ยังไม่ archive → เปลี่ยน `userId` + timeline `transfer` + audit `complaint_reassigned` |
| `POST /api/complaints/coordination` | `action: set` (ตั้งหน่วยงาน/เลขหนังสือ/วันส่ง/วันติดตาม) · `follow_up` (บันทึกติดตาม → `followUps[]`, ตั้ง `nextFollowUpAt` = ที่ส่งมา หรือวันนี้ + `followUpEveryDays`, audit `assignment_follow_up`) · `notify_line` (สรุปเข้า LINE กลุ่ม ⚠️ นับโควตาตามสมาชิกกลุ่ม — UI ถามยืนยันก่อน) |

รูปทรง response: `lib/tasks/types.ts` (`MyKpiResponse`, `OfficerTask`, `TaskGroup`, `PoolItem`)

## Models

- `models/Assignment.js` (ยังอยู่ root — ของโมดูลร้องเรียน) **ขยาย**: `role`, `stage`, `dueDate`, `slaPausedAt`,
  `slaPausedMs`, `coordination{agencyName, coordinatorOrgId, documentNo, sentAt, nextFollowUpAt, followUps[]}`,
  `blocked{isBlocked, reason, itemName, purchaseRefNo, expectedAt, since}`, `timeline[]`, `timestamps`
  — เอกสารเก่าไม่มีฟิลด์เหล่านี้ อ่านผ่าน `derived.js` ได้เลย ไม่ต้อง migrate
- `models/tasks/TaskSettings.js` — singleton `key: 'default'` collection `task_settings`
  (`defaultSlaDays 7 · warnBeforeDays 2 · unclaimedWarnDays 3 · unclaimedAlertDays 4 · followUpEveryDays 7 · slaByCategory[]`)
  ไม่มีเอกสาร = ใช้ default ทำงานได้เลย
- `Complaint.organizationId` (ref Organization) — เติมใน **ทั้ง** `models/Complaint.js` และ `models/SubmittedReport.js`
  (สองไฟล์ลงทะเบียน model `SubmittedReport` เดียวกัน ไฟล์ไหนโหลดก่อนชนะ)
- **ไม่ใส่ Mongoose enum ให้ `status`** — ค่าคงที่อยู่ `lib/tasks/status.js` (`รอประสานหน่วยงานภายนอก` เป็นค่าใหม่)

## lib (`lib/tasks/` — logic ล้วน, เทสต์ใน `__tests__/`)

| ไฟล์ | หน้าที่ |
|---|---|
| `settings.js` | `DEFAULT_TASK_SETTINGS`, `normalizeTaskSettings`, `slaDaysFor(category)` |
| `status.js` | `COMPLAINT_STATUS`, `STAGES`/`STAGE_LABELS`, `stageTransition` (เดินหน้าทีละขั้น ถอยหลังต้องมีเหตุผล), `statusForStage` |
| `format.js` | วันที่แบบไทย/Asia/Bangkok: `bangkokDateKey`, `calendarDaysBetween`, `formatThaiShortDate`, `relativeDaysLabel`, `summarizeText` |
| `derived.js` | `deriveAssignment` / `deriveUnclaimed` / `dueDateFor` / `effectiveDueDate` / `severityOf` |
| `kpi.js` | `computeKpi` (KPI strip) |
| `groupBy.js` | `groupTasks(items, groupBy)` + `filterByAlert` — ใช้ทั้ง server และ client |
| `badges.js` | ข้อความ+โทนป้าย: `badgesForAssignment`, `agingPill`, `contextBadges`, `statusPillFor`, `coordinationWaitPill` |
| `summary.js` | หน้าจอ 1: `alertCards` (การ์ดเตือน 4 ใบ), `coordinationRail` (รวมตามหน่วยงาน), `blockedRail`, `dueThisWeekRail` |
| `loadSettings.js` | I/O: `getTaskSettings` (พลาด → default) / `saveTaskSettings` (merge) |
| `types.ts` | TypeScript types ของผลลัพธ์ทั้งหมด |

## Components (`components/tasks/`)

shared (ข้อ 4): `AlertBadge` (tone → `tk-*`) · `TaskRow` · `WorkGroupAccordion` (เปิดหลายกลุ่ม, จำใน sessionStorage) ·
`PoolCard` (ปุ่มตาม `action`: claim / coordinate / choose_org / not_yours) · `StatusStepper` · `CoordinationBlock`

หน้าจอ 1 (ข้อ 5): `OfficerHeaderCard` · `AlertCards` · `KpiStrip` · `RailCards` (`CoordinationRailCard` / `BlockedRailCard` / `DueThisWeekCard`) ·
`TransferTaskModal` (รายชื่อจาก `GET /api/users/get-all-user` จัดกลุ่มตามกอง) · `FollowUpModal`
— ทั้งหมดรับข้อมูลที่ API derive แล้ว **ไม่คำนวณเอง**

## กติกาที่ต้องรู้

- **นับ "วัน" ตามปฏิทินไทย** (`calendarDaysBetween`) — เส้นตาย = สิ้นวันไทยของวันครบกำหนด (ครบ 10:00 ตอนนี้ 12:00 ยัง "ครบกำหนดวันนี้")
  ส่วน `daysAssigned`/`resolutionDays` ยัง floor(ms) ตามความหมายเดิม
- **SLA นับจากวันที่ประชาชนแจ้ง** (`complaint.createdAt`) ไม่ใช่วันรับงาน — เรื่องที่ค้างในกองรอรับนานจึงมาถึงพร้อมเวลาที่เหลือน้อย (ตั้งใจ)
- พัก SLA (`slaPausedAt`) → ไม่นับเกินกำหนด; วันครบกำหนดเลื่อนด้วย `slaPausedMs` + ช่วงที่ยังพัก
- severity: `overdue > due_soon > coordinating > blocked > normal > done`; เรื่องเดียวมีได้หลาย `alertKinds`
- เรื่องที่ปิดด้วย status จากหน้า manage-complaints โดย assignment ไม่มี `completedAt` → ถือว่าเสร็จ แต่ไม่เข้าตัวหาร on-time/avg
- `kpi.satisfaction` = คะแนนของเรื่องที่เจ้าหน้าที่ถือ นับ "1 ผู้แจ้ง = 1 เสียง" ผ่าน `lib/satisfaction/readStats.js#loadSatisfactionStatsForComplaints`
  + `computeFairStats` (null เมื่อไม่มีคะแนน) — ห้ามคำนวณ `$avg` เอง; อ่านพลาดไม่ทำให้หน้าล้ม
- ปุ่ม "แจ้ง LINE" ทุกจุดต้องมี dialog ยืนยัน — 1 push เข้ากลุ่มนับโควตาเท่าจำนวนสมาชิก (โควตา 300/เดือน)
- สี: โทเคน `tk-*` ใน `styles/globals.css` (`@theme`) — **ไม่แตะ `--color-primary` ของ `mytheme`**; ฟอนต์ `font-tk-sans` / `font-tk-mono` (IBM Plex Mono เพิ่มใน `_document.tsx`)
- ข้อความไทยในป้าย/ปุ่มต้อง `whitespace-nowrap`
