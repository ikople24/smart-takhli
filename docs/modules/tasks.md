# งานเจ้าหน้าที่ (tasks) — Officer Task Management

ระบบจัดการงานของเจ้าหน้าที่: **กลุ่มงานของฉัน** (งานที่ถืออยู่ จัดกลุ่มตามประเภท/กอง/ความเร่งด่วน) ·
**กองงานรอรับ** (เรื่องยังไม่มีเจ้าของ กดรับเอง) · **ป้ายเตือนชุดเดียวทุกหน้าจอ** ·
**ประสานหน่วยงานภายนอก** (แยก *หน่วยงานผู้ดำเนินการ* เช่น กฟภ. ออกจาก *ผู้ประสานงาน* เช่น กองช่าง)

- ที่มาดีไซน์ (hifi): `docs/design_handoff_officer_task_management/README.md`
- แผน + เหตุผลการตัดสินใจ: `docs/superpowers/plans/2026-08-31-officer-task-management-p1.md`
- **สถานะ (2026-09-01): ครบทั้ง 8 ข้อของ README + นโยบายสิทธิ์** (เฟส 1–6) — หน้าจอ 1 `/admin/my-tasks`, หน้าจอ 2 `/admin/task-pool`, หน้าจอ 3 `/admin/my-tasks/[assignmentId]`
  ใช้งานได้จริงทั้งเดสก์ท็อปและมือถือ · **ต้องรัน `scripts/grant-task-pool-permission.mjs --yes` (13 user)** · ยังไม่มีใครเห็นหน้าจริงด้วยตา

## หน้า

- `/admin/my-tasks` — **หน้าจอ 1 โฉมใหม่** (`pages/admin/my-tasks.tsx`): header card · การ์ดเตือน 4 ใบ (คลิก → `?alert=`) ·
  KPI strip · กลุ่มงานของฉัน (`?groupBy=category|organization|priority` regroup ฝั่ง client, จำกลุ่มที่เปิดใน sessionStorage) ·
  right rail (ต้องประสานงานต่อ / รอวัสดุ / ครบกำหนดสัปดาห์นี้) · ปุ่ม "โอน / ส่งต่องาน" (modal) · "รับงานจากกอง"
  ไป `/admin/task-pool` · ลูกศรใน task row / rail → หน้าจอ 3
  · meta ใน `components/Layout.js` เหลือแค่ `title` เพราะหน้ามี header card เอง
- `/admin/my-tasks/[assignmentId]` — **หน้าจอ 3 รายละเอียดงาน + อัปเดตความคืบหน้า** (`pages/admin/my-tasks/[assignmentId].tsx`, ครอบ
  `PermissionGuard requiredPath="/admin/my-tasks"` — ยืมสิทธิ์หน้าแม่, ADMIN_META `noSidebar + fullBleed`): header bar ← กลับ + breadcrumb ·
  การ์ดเรื่อง (ชื่อ/เบอร์ผู้แจ้งเต็ม — เจ้าหน้าที่ต้องติดต่อ ต่างจาก /status ที่ mask) · ภาพ + แผนที่ (`SmallMap` dynamic) · ไทม์ไลน์ (`buildTimeline`) ·
  แผงอัปเดต: `StatusStepper` (ถอยขั้นถาม Swal เหตุผล, ขั้น "ปิดเรื่อง" เปิด modal ปิดเรื่อง) · `CoordinationBlock` (+ `CoordinationSetModal` / `FollowUpModal` / โทรแล้ว / แจ้ง LINE) ·
  `BlockedCard` (พัก/เลิกพัก SLA) · บันทึก + `ImageUploads` · ปุ่มปิดเรื่อง (`CloseTaskModal` ≥1 ภาพ + สรุป + วิธีแก้ไขจาก AdminOption) · โอนงาน · เรื่องปิดแล้ว/ไม่ใช่งานของตัวเอง = อ่านอย่างเดียว
- `/admin/task-pool` — **หน้าจอ 2 กองงานรอรับ** (`pages/admin/task-pool.tsx`, ครอบ `PermissionGuard`): alert bar แดง (ค้างเกิน `unclaimedAlertDays`
  + ปุ่ม "ดูเฉพาะที่ค้าง" / "แจ้งเตือนหัวหน้ากอง" ทาง LINE) · tabs `?groupBy=organization|category|priority` · ค้นหา / ชุมชน / ช่วงเวลา
  (`?days=30|90|365|all` default 30 — ถ้ามีเรื่องเก่ากว่านั้น alert bar บอกจำนวนพร้อมลิงก์ดูทั้งหมด) · kanban ต่อคอลัมน์ (กองของตัวเองมีเสมอ,
  "ยังไม่ระบุกอง" dashed ท้ายสุด) · การ์ด: รับงาน (optimistic + toast "เลิกทำ" 5 วิ) / มอบหมาย (หัวหน้ากอง) / เลือกกอง / ไม่ใช่กองของคุณ
  · ลงทะเบียนครบ (ALL_PAGES + DEFAULT_PERMISSIONS admin + navigationItems; **ไม่ใส่ ADMIN_META title** เพราะหน้ามี h1 เอง — ไม่งั้นชื่อซ้ำ) + `scripts/grant-task-pool-permission.mjs`

## API (`pages/api/tasks/`)

| endpoint | หน้าที่ |
|---|---|
| `GET /api/tasks/my-kpi?groupBy=…&alert=…&scope=mine\|department` | งานทั้งหมดของเจ้าหน้าที่ที่ล็อกอิน + derived fields + `kpi` + (ถ้าส่ง groupBy) `groups` + `permissions` (isHead/canAssign/canTransfer) · `scope=department` (หัวหน้า/superadmin) = งานทุกคนในกอง พร้อม `assignee` และ `transferRequest` |
| `GET /api/tasks/pending` | widget งานค้างเดิม — เปลี่ยนมาใช้ SLA จาก `task_settings` ผ่าน `deriveAssignment` |
| `GET /api/tasks/pool-count` | จำนวนเรื่องในกองงานรอรับ (30 วัน + เก่ากว่านั้น) สำหรับ badge บน bottom nav มือถือ |
| `GET /api/tasks/heads` · `PUT` (superadmin) | รายชื่อ user + สถานะหัวหน้ากอง · `PUT { userId, isDepartmentHead: true\|false\|null }` (null = กลับไปดูตำแหน่ง) audit `department_head_set` |
| `POST /api/complaints/assignments/transfer-request` · `DELETE ?assignmentId=` | เจ้าของงานที่โอนเองไม่ได้ "ขอโอนงาน" (เหตุผลบังคับ) → `Assignment.transferRequest` + timeline + แจ้งกระดิ่งถึงหัวหน้ากอง (`digestRecipients`) · DELETE = เจ้าของยกเลิก / หัวหน้าปฏิเสธ |
| `POST\|GET /api/cron/tasks/stale-digest` (`CRON_SECRET`) | ทุกเช้า (แนะนำ `30 1 * * *` UTC = 08:30 ไทย): เรื่องค้างเกินเกณฑ์ → แจ้งกระดิ่งหัวหน้ากอง 1 รายการ/กอง/วัน (dedupe `relatedId`) — **ไม่ส่ง LINE** (โควตา) |
| `GET /api/tasks/[assignmentId]` | หน้าจอ 3: เรื่อง + assignment + derived + ป้าย + ไทม์ไลน์ + `solutionOptions` (AdminOption ของประเภทนั้น) + `canEdit` (เจ้าของ/superadmin) |
| `PATCH /api/tasks/[assignmentId]` | `action: progress` { note?, images?, stage?, reason? } (เลื่อนขั้นทีละขั้น, ถอยต้องมี reason, status เรื่องตาม `statusForStage` + แจ้ง LINE ผู้แจ้ง) · `close` { note, images≥1, solution? } (completedAt + status DONE + audit + LINE ผู้แจ้ง/กลุ่มผ่าน `lib/complaintNotify.js`) · `blocked` { on, itemName, purchaseRefNo, expectedAt } (`blockedUpdate` พัก/เลิกพัก SLA) |
| `GET /api/tasks/pool?groupBy=&q=&community=&days=&onlyStale=1` | เรื่องที่ยังไม่มี Assignment และยังไม่ปิด (`lib/tasks/loadPool.js`) + derived/ป้าย + `action` ต่อเจ้าหน้าที่ + คอลัมน์ (`groupPool`) + `stale` + `workload` (งานเปิดต่อคน) + `departments` — สิทธิ์ผ่าน `requirePage('/admin/task-pool')` · ไม่คืนชื่อ/เบอร์ผู้แจ้ง |
| `POST /api/tasks/pool-alert` | สรุปเรื่องค้างเกินเกณฑ์เข้า LINE กลุ่ม (⚠️ โควตา — UI ยืนยันก่อน) |
| `PATCH /api/tasks/set-department` | คัดแยกกอง `{ complaintId, department }` (ชื่อมาตรฐานเท่านั้น, '' = ล้าง) → audit `complaint_department_set` — README เขียนเป็น `/api/complaints/:id/organization` แต่วางใต้ `complaints/[id]/` ไม่ได้ เพราะชนกับ `[id_card].js` (Next.js ห้าม slug ต่างชื่อใน path เดียวกัน → dev server ล้มทั้งตัว) |
| `DELETE /api/complaints/assignments/[id]` | "เลิกทำ" การรับงาน — เจ้าของ/superadmin, ภายใน 15 นาที, ยังไม่มีความคืบหน้า → audit `assignment_unclaimed` |
| `GET /api/tasks/settings` · `PUT` (superadmin) | SLA/เกณฑ์เตือน — PUT รับบางฟิลด์ได้ (merge) ลง audit `task_settings_updated` |
| `pages/api/tasks/_auth.ts` | `getOfficer(req)` (Clerk → users ใน Mongo) · `requireSuperAdmin(req)` |
| `POST /api/complaints/assignments/create` | (path เดิมใต้ complaints — ใช้ทั้งกองงานรอรับและหน้าการร้องเรียน) **บังคับล็อกอิน + กติกาฝั่ง server (2026-09-02)**: รับเอง → `canClaim` (กองเดียวกัน) · มอบหมายให้คนอื่น → หัวหน้ากอง/superadmin · เรื่องที่มี assignment เปิดค้าง → 409 กันรับซ้ำ · ตั้ง `dueDate`/`stage`/timeline `created` |
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
- `Complaint.department` (String ชื่อกองมาตรฐาน, '' = ยังไม่ระบุ) — เติมใน **ทั้ง** `models/Complaint.js` และ `models/SubmittedReport.js`
  (สองไฟล์ลงทะเบียน model `SubmittedReport` เดียวกัน ไฟล์ไหนโหลดก่อนชนะ) · **ไม่ใช้ `organizationId` ตาม README** เพราะ collection
  `organizations` มีแค่ตัวเทศบาล ไม่ใช่รายชื่อกอง — กองจริงอยู่ใน `users.department` (ข้อความอิสระ) → normalize ผ่าน `lib/tasks/departments.js`
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
| `departments.js` | **ทะเบียนกองมาตรฐาน + alias** (`normalizeDepartment`, `departmentShort`) และ `defaultDepartmentForCategory` (ประเภทเรื่อง → กอง ค่าเสนอแนะ) |
| `pool.js` | หน้าจอ 2: `poolAction` (claim / not_yours / choose_org), `groupPool` (คอลัมน์ตามกอง/ประเภท/ความเร่งด่วน), `staleSummary`, `dangerHint`, `possibleAgencyFor` (กฟภ.) |
| `roles.js` | **นโยบายสิทธิ์**: `isDepartmentHead(user)` (ติ๊ก `users.isDepartmentHead` มาก่อน, fallback ตำแหน่ง `HEAD_POSITION_RE`), `headsOf`, `taskPermissions` → canAssign / canTransfer (หัวหน้าเฉพาะงานในกอง) / canRequestTransfer |
| `digest.js` | `buildStaleDigest` (สรุปเรื่องค้างรายกอง + relatedId กันซ้ำรายวัน), `digestRecipients` (หัวหน้ากอง → ไม่มีก็หัวหน้าทุกกอง + superadmin) |
| `mobile.js` | มือถือ: `haversineKm` / `formatDistanceLabel` / `withDistance` ("ใกล้ฉัน" — พิกัดผู้ใช้อยู่ฝั่ง client ไม่ส่งขึ้น server), `topUrgent` (FAB อัปเดตงานด่วน), `poolChipCounts` |
| `timeline.js` | หน้าจอ 3: `buildTimeline` (รับเรื่อง → มอบหมาย → รายการ timeline → ปิดเรื่อง → รายการรออยู่; เรียงเชิงตรรกะก่อนเวลา เพราะข้อมูลเก่า completedAt เป็นวันที่ล้วน), `closeChecklist`, `stageChangePlan`, `blockedUpdate` |
| `loadPool.js` | I/O: `loadPoolItems({ settings, days })` (ไม่มี Assignment + ยังไม่ปิด, ร้องซ้ำ = เบอร์+ประเภท+ชุมชนเดียวกันใน 180 วัน — เบอร์ไม่ออกจากฟังก์ชัน), `loadWorkload()` |
| `loadSettings.js` | I/O: `getTaskSettings` (พลาด → default) / `saveTaskSettings` (merge) |
| `types.ts` | TypeScript types ของผลลัพธ์ทั้งหมด |

## Components (`components/tasks/`)

shared (ข้อ 4): `AlertBadge` (tone → `tk-*`) · `TaskRow` · `WorkGroupAccordion` (เปิดหลายกลุ่ม, จำใน sessionStorage) ·
`PoolCard` (ปุ่มตาม `action`: claim / coordinate / choose_org / not_yours) · `StatusStepper` · `CoordinationBlock`

หน้าจอ 1 (ข้อ 5): `OfficerHeaderCard` · `AlertCards` · `KpiStrip` · `RailCards` (`CoordinationRailCard` / `BlockedRailCard` / `DueThisWeekCard`) ·
`TransferTaskModal` (รายชื่อจาก `GET /api/users/get-all-user` จัดกลุ่มตามกอง) · `FollowUpModal`

หน้าจอ 2 (ข้อ 6): `AssignTaskModal` (เจ้าหน้าที่ในกองก่อน เรียงงานน้อย→มาก จาก `workload`) · `DepartmentPickerModal`

หน้าจอ 3 (ข้อ 7): `TaskTimeline` · `BlockedCard` · `CoordinationSetModal` · `CloseTaskModal` (ใช้ `ImageUploads` เดิม + `closeChecklist`)

มือถือ (ข้อ 8): `MobileTaskNav` (bottom nav 5 ช่อง + FAB, แสดง < md) · `QuickTaskSheet` (bottom sheet งานด่วน 5 เรื่อง → หน้าจอ 3) · `PoolCard variant="mobile"` (ปุ่ม "รับงานนี้" + แผนที่ + ระยะทาง) · `AlertCards` มีการ์ด "ต้องจัดการวันนี้" 2×2 · `OfficerHeaderCard` ย่อ

สิทธิ์ (เฟส 5): `TransferTaskModal` มี `mode: transfer | request` · `HeadsPanel` (superadmin ติ๊กหัวหน้ากอง) — ใช้ที่หน้า **`/admin/superadmin/department-heads`** (การบริหารระบบ · `SUPERADMIN_ONLY_PAGES`)
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
- **นโยบายสิทธิ์ (ตกลง 2026-09-01):** admin ธรรมดา *รับงาน* จากกองเองได้ แต่ **โอน/มอบหมายได้เฉพาะหัวหน้ากอง (งานในกองตัวเอง) และ superadmin** ·
  เจ้าของงานที่โอนเองไม่ได้ใช้ "ขอโอนงาน" (แจ้งกระดิ่งหัวหน้า) · หัวหน้าเห็น "งานของกอง" ในหน้างานของฉัน · เรื่องค้างไม่มีคนรับแจ้งหัวหน้าทุกเช้าทางกระดิ่ง (cron)
  · หัวหน้ากอง = `users.isDepartmentHead` (superadmin ติ๊กที่ `/admin/superadmin/department-heads`) หรือถ้าไม่ตั้งดูจากตำแหน่ง — ทุกจุดผ่าน `lib/tasks/roles.js`
- "กอง" ของเรื่อง = `complaint.department` ที่คัดแยก (manual) → ถ้าไม่มีใช้ `defaultDepartmentForCategory` (category) → ไม่ได้ = ยังไม่ระบุกอง;
  เจ้าหน้าที่ที่โปรไฟล์ไม่ระบุกอง / superadmin รับได้ทุกเรื่อง
- ป้าย "เสี่ยงอันตราย" / "อาจต้องประสาน กฟภ." เป็นคำใบ้จาก keyword ในข้อความ (`pool.js`) ไม่ใช่การตัดสิน
- **แจ้งเตือน LINE ตอนสถานะเรื่องเปลี่ยน/ปิดงานอยู่ที่เดียว `lib/complaintNotify.js`** (`notifyComplaintStatusChanged`) — ใช้ทั้ง `update-status.js` เดิม
  และ `PATCH /api/tasks/[assignmentId]` ห้าม copy · การบันทึกความคืบหน้าธรรมดา (note/รูป) **ไม่** แจ้ง LINE (โควตา) — แจ้งเฉพาะเมื่อขั้นเปลี่ยนสถานะเรื่อง/ปิดงาน
- stepper: เดินหน้าทีละขั้น, ถอยต้องมีเหตุผล, ขั้น "ปิดเรื่อง" ต้องผ่าน `close` (ภาพ ≥1 + สรุป) เท่านั้น · รูปความคืบหน้าอยู่ใน timeline, รูปตอนปิดเรื่องรวมเข้า `solutionImages` (หน้า /status + การ์ด LINE ใช้)
- สี: โทเคน `tk-*` ใน `styles/globals.css` (`@theme`) — **ไม่แตะ `--color-primary` ของ `mytheme`**; ฟอนต์ `font-tk-sans` / `font-tk-mono` (IBM Plex Mono เพิ่มใน `_document.tsx`)
- ข้อความไทยในป้าย/ปุ่มต้อง `whitespace-nowrap`

## มือถือ (README § หน้าจอมือถือ)

- `< md` ทั้ง 3 หน้าใช้ layout มือถือด้วย Tailwind responsive (ไม่มีหน้าแยก): งานของฉัน = header ย่อ + "ต้องจัดการวันนี้" 2×2 + กลุ่มงาน (ไม่มี KPI strip) ·
  กองงานรอรับ = chip แถวเดียว (กองของฉัน / ค้างนาน / ใกล้ฉัน / ทั้งหมด) + flat list การ์ดใหญ่ · รายละเอียดงาน = header chevron+รหัส+pill,
  ปุ่มสถานะเร็ว 2×2 (ใช้กฎ `stageTransition` เดียวกับ stepper — "เสร็จแล้ว" เปิด modal ปิดเรื่อง), ปุ่ม "ถ่ายภาพ" (`<input capture="environment">` → Cloudinary), footer ปุ่มเดียวลอยล่าง
- bottom nav `MobileTaskNav` อยู่ในหน้างานของฉัน/กองงานรอรับ (ไม่อยู่ในหน้ารายละเอียด — footer แทน) · FAB → `/admin/my-tasks?quick=1` เปิด `QuickTaskSheet`
- "ใกล้ฉัน" ขอ geolocation ตอนกดเท่านั้น, คำนวณระยะทางฝั่ง client — ไม่มีการเก็บตำแหน่งเจ้าหน้าที่
- hit target ≥ 48px ทุกปุ่มหลัก (`min-h-12`), `.touch-feedback` ตอนกด, เผื่อ safe-area ล่างด้วย `env(safe-area-inset-bottom)`

## ความสัมพันธ์กับหน้าการร้องเรียน (`/admin/manage-complaints`) — จัดระเบียบ 2026-09-02

- หน้าการร้องเรียน = **ทะเบียน + PDPA + export + ลบ** · โมดูลนี้ = งานรายวันของเจ้าหน้าที่ — ไม่ซ้ำหน้าที่กัน
- ปุ่ม "อัพเดท" ในหน้าการร้องเรียนพามาหน้าจอ 3 (`/admin/my-tasks/[assignmentId]`) — `UpdateAssignmentModal` + `PUT assignments/update` **ปลดระวางแล้ว** (ทางเขียนเดียว)
- ปุ่ม "รับเรื่อง" ใช้ endpoint เดียวกับกองงานรอรับ → กติกากอง/กันรับซ้ำบังคับที่ server ครอบทั้งสองหน้า
- ปิดเรื่องจากหน้าทะเบียน (`update-status`) ตั้ง `assignment.completedAt`/`stage: closed` + timeline ให้ด้วย → KPI นับสม่ำเสมอ
- `assignments/create` และ `update-status` บังคับล็อกอินแล้ว (เดิมยิงตรงได้โดยไม่ล็อกอิน)
