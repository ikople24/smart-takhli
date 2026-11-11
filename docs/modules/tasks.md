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
  `BlockedCard` (พัก/เลิกพัก SLA) · บันทึก + `ImageUploads` · ปุ่มปิดเรื่อง (`CloseTaskModal` สรุปบังคับ · ภาพ optional — ไม่มีภาพต้องติ๊กยืนยัน `confirmNoImages` เช่น เรื่องสอบถามข้อมูล + วิธีแก้ไขจาก AdminOption) · โอนงาน · เรื่องปิดแล้ว/ไม่ใช่งานของตัวเอง = อ่านอย่างเดียว
- `/admin/task-pool` — **หน้าจอ 2 กองงานรอรับ** (`pages/admin/task-pool.tsx`, ครอบ `PermissionGuard`): alert bar แดง (รอรับเกิน `unclaimedAlertHours` = 24 ชม.
  + ปุ่ม "ดูเฉพาะที่ค้าง" / "แจ้งเตือนหัวหน้ากอง" ทาง LINE) · tabs `?groupBy=organization|category|priority` · ค้นหา / ชุมชน / ช่วงเวลา
  (`?days=all|30|90|365` **default ทั้งหมด — เจ้าของยืนยันหน้านี้ต้องเห็นทุกเรื่อง**) · kanban ต่อคอลัมน์ (กองของตัวเอง + **กองที่มีงานกำลังดำเนินการมีคอลัมน์เสมอ** พร้อมบรรทัด "กำลังดำเนินการ N เรื่อง" ลิงก์ไปงานของกอง — เรื่องที่มีคนรับแล้วไม่อยู่หน้านี้,
  "ยังไม่ระบุกอง" dashed ท้ายสุด) · การ์ด: รับงาน — **ทุกคนรับได้ทุกเรื่อง** (2026-11-09; การ์ดกองอื่นมีบรรทัด "รับแล้วย้ายเข้ากองของคุณ") (optimistic + toast "เลิกทำ" 5 วิ — เลิกทำคืนกองเดิมให้ด้วย) / มอบหมาย (หัวหน้ากอง) / เลือกกอง (เรื่องที่ยังไม่ระบุกอง)
  · ลงทะเบียนครบ (ALL_PAGES + DEFAULT_PERMISSIONS admin + navigationItems; **ไม่ใส่ ADMIN_META title** เพราะหน้ามี h1 เอง — ไม่งั้นชื่อซ้ำ) + `scripts/grant-task-pool-permission.mjs`

## API (`pages/api/tasks/`)

| endpoint | หน้าที่ |
|---|---|
| `GET /api/tasks/my-kpi?groupBy=…&alert=…&scope=mine\|department` | งานทั้งหมดของเจ้าหน้าที่ที่ล็อกอิน + derived fields + `kpi` + (ถ้าส่ง groupBy) `groups` + `permissions` (isHead/canAssign/canTransfer) · `scope=department` (หัวหน้า/superadmin) = งานทุกคนในกอง พร้อม `assignee` และ `transferRequest` |
| `GET /api/tasks/pending` | widget งานค้างเดิม — เปลี่ยนมาใช้ SLA จาก `task_settings` ผ่าน `deriveAssignment` |
| `GET /api/tasks/pool-count` | จำนวนเรื่องในกองงานรอรับ (30 วัน + เก่ากว่านั้น) สำหรับ badge บน bottom nav มือถือ |
| `GET /api/tasks/heads` · `PUT` (superadmin) | รายชื่อ user + สถานะหัวหน้ากอง · `PUT { userId, isDepartmentHead: true\|false\|null }` (null = กลับไปดูตำแหน่ง) audit `department_head_set` |
| `POST /api/complaints/assignments/transfer-request` · `DELETE ?assignmentId=` | เจ้าของงานที่โอนเองไม่ได้ "ขอโอนงาน" (เหตุผลบังคับ) → `Assignment.transferRequest` + timeline + แจ้งกระดิ่งถึงหัวหน้ากอง (`digestRecipients`) · DELETE = เจ้าของยกเลิก / หัวหน้าปฏิเสธ |
| `POST /api/complaints/assignments/release` | **คืนงานเข้ากองงานรอรับ** (2026-11-10) — คนที่รับผิดเรื่องคืนเองได้ ไม่ต้องรอหัวหน้า · เจ้าของ/superadmin + งานยังไม่เริ่มทำ (ขั้นรับเรื่อง ไม่มีผล/ภาพ/ประสาน/รอวัสดุ — `lib/tasks/release.js#releaseCheck`) · ลบ assignment + ตอนรับเคยย้ายกอง → คืนกองเดิม (`departmentToRestore` จาก audit) · timeline เก็บใน audit `assignment_unclaimed` · เหตุผลบังคับ |
| `POST\|GET /api/cron/tasks/stale-digest` (`CRON_SECRET`) | ทุกเช้า (แนะนำ `30 1 * * *` UTC = 08:30 ไทย): เรื่องค้างเกินเกณฑ์ → แจ้งกระดิ่งหัวหน้ากอง 1 รายการ/กอง/วัน (dedupe `relatedId`) **+ LINE กลุ่มเจ้าหน้าที่วันละครั้ง** (เปิดอีกครั้ง 2026-11-09 หลังอัปเกรด LINE OA Starter; dedupe ด้วย audit log `resourceId: stale-digest-line:<วันที่>`; ข้อความจาก `digest.js#buildStaleLineText` ตัวเดียวกับปุ่ม pool-alert) |
| `GET /api/tasks/[assignmentId]` | หน้าจอ 3: เรื่อง + assignment + derived + ป้าย + ไทม์ไลน์ + `solutionOptions` (AdminOption ของประเภทนั้น) + `canEdit` (เจ้าของ/superadmin) |
| `PATCH /api/tasks/[assignmentId]` | `action: progress` { note?, images?, stage?, reason? } (เลื่อนขั้นทีละขั้น, ถอยต้องมี reason, status เรื่องตาม `statusForStage` + แจ้ง LINE ผู้แจ้ง) · `close` { note, images≥1, solution? } (completedAt + status DONE + audit + LINE ผู้แจ้ง/กลุ่มผ่าน `lib/complaintNotify.js`) · `blocked` { on, itemName, purchaseRefNo, expectedAt } (`blockedUpdate` พัก/เลิกพัก SLA) · `work_type` { workType } เปลี่ยนชนิดงาน (ดู § เปลี่ยนชนิดงาน) · `site_issue` { reasonCode, note?, images? } แจ้งปัญหาหน้างาน — พัก SLA + กระดิ่งหัวหน้ากอง/superadmin (ดู § พบปัญหาหน้างาน) |
| `GET /api/tasks/pool?groupBy=&q=&community=&days=&onlyStale=1` | เรื่องที่ยังไม่มี Assignment และยังไม่ปิด (`lib/tasks/loadPool.js`) + derived/ป้าย + `action` ต่อเจ้าหน้าที่ + คอลัมน์ (`groupPool`) + `stale` + `workload` (งานเปิดต่อคน) + `departments` — สิทธิ์ผ่าน `requirePage('/admin/task-pool')` · ไม่คืนชื่อ/เบอร์ผู้แจ้ง |
| `POST /api/tasks/pool-alert` | สรุปเรื่องค้างเกินเกณฑ์เข้า LINE กลุ่ม (⚠️ โควตา — UI ยืนยันก่อน) |
| `PATCH /api/tasks/set-department` | คัดแยกกอง `{ complaintId, department }` (ชื่อมาตรฐานเท่านั้น, '' = ล้าง) → audit `complaint_department_set` — README เขียนเป็น `/api/complaints/:id/organization` แต่วางใต้ `complaints/[id]/` ไม่ได้ เพราะชนกับ `[id_card].js` (Next.js ห้าม slug ต่างชื่อใน path เดียวกัน → dev server ล้มทั้งตัว) |
| `DELETE /api/complaints/assignments/[id]` | "เลิกทำ" การรับงาน — เจ้าของ/superadmin, ภายใน 15 นาที, ยังไม่มีความคืบหน้า → audit `assignment_unclaimed` |
| `GET /api/tasks/settings` · `PUT` (superadmin) | SLA/เกณฑ์เตือน/วันหยุด (`holidays`) — PUT รับบางฟิลด์ได้ (merge) ลง audit `task_settings_updated` · หน้าแก้ไข `/admin/superadmin/task-settings` |
| `pages/api/tasks/_auth.ts` | `getOfficer(req)` (Clerk → users ใน Mongo) · `requireSuperAdmin(req)` |
| `POST /api/complaints/assignments/create` | (path เดิมใต้ complaints — ใช้ทั้งกองงานรอรับและหน้าการร้องเรียน) **บังคับล็อกอิน + กติกาฝั่ง server (2026-09-02)**: รับเอง → ได้ทุกเรื่องทุกกอง (2026-11-09 — เลิก `canClaim` เพราะระบบเดากองจากหมวดใหญ่ผิดบ่อยจนงานค้าง) · ผู้รับหลักอยู่กองอื่น → ย้าย `complaint.department` เข้ากองผู้รับ (`roles.js#departmentAfterClaim`) + timeline note + audit `complaint_department_set` + คืน `movedFrom` ให้ปุ่มเลิกทำ · รับผิด → "ขอโอนงาน" แจ้ง superadmin + หัวหน้ากอง (`digest.js#transferRequestRecipients`) · มอบหมายให้คนอื่น → หัวหน้ากอง/superadmin · เรื่องที่มี assignment เปิดค้าง → 409 กันรับซ้ำ · ตั้ง `dueDate`/`stage`/timeline `created` |
| `POST /api/complaints/assignments/transfer` | `{ assignmentId, toUserId, reason }` โอนงาน — เจ้าของงาน/superadmin, เหตุผลบังคับ, ปลายทางต้องเป็น user ของแอปนี้ที่ยังไม่ archive → เปลี่ยน `userId` + timeline `transfer` + audit `complaint_reassigned` |
| `POST /api/complaints/coordination` | `action: set` (ตั้งหน่วยงาน/เลขหนังสือ/วันส่ง/วันติดตาม) · `follow_up` (บันทึกติดตาม → `followUps[]`, ตั้ง `nextFollowUpAt` = ที่ส่งมา หรือวันนี้ + `followUpEveryDays`, audit `assignment_follow_up`) · `notify_line` (สรุปเข้า LINE กลุ่ม ⚠️ นับโควตาตามสมาชิกกลุ่ม — UI ถามยืนยันก่อน) |

รูปทรง response: `lib/tasks/types.ts` (`MyKpiResponse`, `OfficerTask`, `TaskGroup`, `PoolItem`)

## Models

- `models/Assignment.js` (ยังอยู่ root — ของโมดูลร้องเรียน) **ขยาย**: `role`, `stage`, `dueDate`, `slaPausedAt`,
  `slaPausedMs`, `coordination{agencyName, coordinatorOrgId, documentNo, sentAt, nextFollowUpAt, followUps[]}`,
  `blocked{isBlocked, kind ('materials'|'site_issue'), siteIssueCode, reason, itemName, purchaseRefNo, expectedAt, since}`, `timeline[]`, `timestamps`
  — เอกสารเก่าไม่มีฟิลด์เหล่านี้ อ่านผ่าน `derived.js` ได้เลย ไม่ต้อง migrate
- `models/tasks/TaskSettings.js` — singleton `key: 'default'` collection `task_settings`
  (`defaultSlaDays 3 · warnBeforeDays 2 · unclaimedWarnHours 12 · unclaimedAlertHours 24 · followUpEveryDays 7 · slaByCategory[] · slaByWorkType[]`;
  `unclaimedWarnDays`/`unclaimedAlertDays` ยังอยู่ในเอกสารเพื่อความเข้ากันได้ แต่เลิกใช้ตัดสินแล้ว)
  ไม่มีเอกสาร = ใช้ default ทำงานได้เลย
- `Complaint.workType` (String key ใน `lib/tasks/workTypes.js`, '' = ให้ระบบเดา) — เติมใน **ทั้ง** `models/Complaint.js` และ `models/SubmittedReport.js`
  · ตั้งได้ทางเดียวคือ `PATCH /api/tasks/[assignmentId]` action `work_type` — `submit-report.js` ตัดฟิลด์นี้ทิ้งจาก body สาธารณะ
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
| `departments.js` | **ทะเบียนกองมาตรฐาน + alias** (`normalizeDepartment`, `departmentShort`) และ `defaultDepartmentForComplaint` (ทั้งเรื่อง → กอง ค่าเสนอแนะ: งานตัดกิ่งไม้/ต้นไม้ → งานป้องกันฯ ก่อน แม้แจ้งผิดหมวด (2026-11-10) แล้วค่อยใช้ `defaultDepartmentForCategory` ตามหมวดใหญ่) |
| `pool.js` | หน้าจอ 2: `poolAction` (claim / claim_other / choose_org — ทุกค่ารับได้), `groupPool` (คอลัมน์ตามกอง/ประเภท/ความเร่งด่วน), `staleSummary`, `dangerHint`, `possibleAgencyFor` (กฟภ.) |
| `roles.js` | **นโยบายสิทธิ์**: `isDepartmentHead(user)` (ติ๊ก `users.isDepartmentHead` มาก่อน, fallback ตำแหน่ง `HEAD_POSITION_RE`), `headsOf`, `taskPermissions` → canAssign / canTransfer (หัวหน้าเฉพาะงานในกอง) / canRequestTransfer |
| `digest.js` | `buildStaleDigest` (สรุปเรื่องค้างรายกอง + relatedId กันซ้ำรายวัน), `digestRecipients` (หัวหน้ากอง → ไม่มีก็หัวหน้าทุกกอง + superadmin) |
| `mobile.js` | มือถือ: `haversineKm` / `formatDistanceLabel` / `withDistance` ("ใกล้ฉัน" — พิกัดผู้ใช้อยู่ฝั่ง client ไม่ส่งขึ้น server), `topUrgent` (FAB อัปเดตงานด่วน), `poolChipCounts` |
| `timeline.js` | หน้าจอ 3: `buildTimeline` (รับเรื่อง → มอบหมาย → รายการ timeline → ปิดเรื่อง → รายการรออยู่; เรียงเชิงตรรกะก่อนเวลา เพราะข้อมูลเก่า completedAt เป็นวันที่ล้วน), `closeChecklist`, `stageChangePlan`, `blockedUpdate` |
| `workTypeChange.js` | เปลี่ยนชนิดงาน: `workTypeChange` (ตรวจ key, ชนิดเดิม = ไม่ผ่าน, วันครบกำหนดใหม่ผ่าน `dueDateFor`, `suggestedDepartment`), `workTypeOptionsFor` (SLA ต่อตัวเลือกรวมค่าตั้ง), `workTypeSourceOf` (manual/auto) |
| `loadPool.js` | I/O: `loadPoolItems({ settings, days })` (ไม่มี Assignment + ยังไม่ปิด, ร้องซ้ำ = เบอร์+ประเภท+ชุมชนเดียวกันใน 180 วัน — เบอร์ไม่ออกจากฟังก์ชัน), `loadWorkload()` |
| `businessDays.js` | วันทำการ (จ.–ศ. ไม่รวมวันหยุด, เวลาไทย, ไม่ขึ้นกับ TZ เครื่อง): `isBusinessDay`, `addBusinessDays` (เส้นตาย = สิ้นวันไทย), `businessDaysBetween`, `businessDaysToDue`, `toHolidaySet` |
| `holidays.js` | `FIXED_THAI_HOLIDAYS` + `fixedHolidaysForBeYear(พ.ศ.)` (เฉพาะวันที่ตายตัว) · `normalizeHolidays` · `mergeHolidays` |
| `grassSchedule.js` | ตารางคิวตัดหญ้า: `normalizeGrassSchedule` (https เท่านั้น) · `grassSchedulePatch` (ประทับ `updatedAt` ฝั่ง server) · `grassScheduleFor(complaint, settings)` · `GRASS_QUEUE_NOTE` |
| `loadSettings.js` | I/O: `getTaskSettings` (พลาด → default) / `saveTaskSettings` (merge) |
| `types.ts` | TypeScript types ของผลลัพธ์ทั้งหมด |

## Components (`components/tasks/`)

shared (ข้อ 4): `AlertBadge` (tone → `tk-*`) · `TaskRow` · `WorkGroupAccordion` (เปิดหลายกลุ่ม, จำใน sessionStorage) ·
`PoolCard` (ปุ่มตาม `action`: claim / claim_other / coordinate / choose_org) · `StatusStepper` · `CoordinationBlock`

หน้าจอ 1 (ข้อ 5): `OfficerHeaderCard` · `AlertCards` · `KpiStrip` · `RailCards` (`CoordinationRailCard` / `BlockedRailCard` / `DueThisWeekCard`) ·
`TransferTaskModal` (รายชื่อจาก `GET /api/users/get-all-user` จัดกลุ่มตามกอง) · `FollowUpModal`

หน้าจอ 2 (ข้อ 6): `AssignTaskModal` (เจ้าหน้าที่ในกองก่อน เรียงงานน้อย→มาก จาก `workload`) · `DepartmentPickerModal`

หน้าจอ 3 (ข้อ 7): `TaskTimeline` · `BlockedCard` · `GrassScheduleCard` (เฉพาะงาน `grass`) · `CoordinationSetModal` · `CloseTaskModal` (ใช้ `ImageUploads` เดิม + `closeChecklist`)

มือถือ (ข้อ 8): `MobileTaskNav` (bottom nav 5 ช่อง + FAB, แสดง < md) · `QuickTaskSheet` (bottom sheet งานด่วน 5 เรื่อง → หน้าจอ 3) · `PoolCard variant="mobile"` (ปุ่ม "รับงานนี้" + แผนที่ + ระยะทาง) · `AlertCards` มีการ์ด "ต้องจัดการวันนี้" 2×2 · `OfficerHeaderCard` ย่อ

สิทธิ์ (เฟส 5): `TransferTaskModal` มี `mode: transfer | request` · `HeadsPanel` (superadmin ติ๊กหัวหน้ากอง) — ใช้ที่หน้า **`/admin/superadmin/department-heads`** (การบริหารระบบ · `SUPERADMIN_ONLY_PAGES`)
· `TaskSettingsPanel` (วันหยุดราชการ + กำหนดปิดตามชนิดงาน + ตารางคิวตัดหญ้า) — ใช้ที่หน้า **`/admin/superadmin/task-settings`**
— ทั้งหมดรับข้อมูลที่ API derive แล้ว **ไม่คำนวณเอง**

## กติกาที่ต้องรู้

- **กำหนดปิดเรื่องนับ "วันทำการ"** (ตัดสินโดยเจ้าของระบบ 11/11/69 · `lib/tasks/businessDays.js`, `SLA_COUNT_MODE = "business"` ตายตัว ไม่มีให้ตั้ง)
  = จันทร์–ศุกร์ ไม่รวมวันหยุดราชการใน `task_settings.holidays` ตามเวลาไทย · **วันแจ้งไม่นับ** · แจ้งเสาร์/อาทิตย์/วันหยุด → วันทำการถัดไปคือวันที่ 1
  (แจ้งศุกร์ SLA 3 → จ. อ. พ. → ครบสิ้นวันพุธ) · `dueDate` ที่คำนวณใหม่ = 23:59:59.999 ไทยของวันครบกำหนด (`addBusinessDays`)
  · `daysToDue` / `overdueDays` / `isDueSoon` (`warnBeforeDays` = วันทำการ) / `isUrgent` นับวันทำการ (`businessDaysToDue`) — เลยวันครบกำหนดแล้วติดลบ **อย่างน้อย 1**
    (ครบศุกร์ ตอนนี้เสาร์ = เกิน 1 วันทำการ) · `completedLate` = วันไทยที่เสร็จ > วันครบกำหนด · ป้าย/การ์ดเขียน "N วันทำการ" · การ์ด "ครบกำหนดสัปดาห์นี้" = ≤ 5 วันทำการ
  · เส้นตาย = สิ้นวันไทย — ค่าเก่าที่บันทึกเป็นเวลากลางวันก็ตัดสินด้วยวันไทย (ครบ 10:00 ตอนนี้ 12:00 ยัง "ครบกำหนดวันนี้")
  · **ช่วงพัก SLA เลื่อนเส้นตายเป็นวันทำการ** แล้วยึดสิ้นวันไทย (`effectiveDueDate` → `businessDays.js#shiftDueByBusinessDays`)
    ช่วงหนึ่งช่วง = `pauseBusinessDays(พักเมื่อ, กลับมาเมื่อ)` = วันทำการใน (วันเริ่มพัก, วันกลับมา] — วันเริ่มพักไม่นับ วันกลับมานับ
    (พัก 1 นาที/ในวันเดียวกัน = 0 · ศ. 17:00 → จ. 09:00 = 1 · พักข้ามเสาร์อาทิตย์ไม่ได้วันฟรี)
    · ช่วงที่จบแล้วสะสมใน `Assignment.slaPausedBusinessDays` ตอนเลิกพัก (`timeline.js#blockedUpdate`, ใช้ `holidays` ณ ตอนนั้น) · ช่วงที่ยังพักคิดถึง now (งานเสร็จแล้วคิดถึง `completedAt`)
    · ข้อมูลเก่าที่ยังไม่มีฟิลด์นี้ (`null`) → ใช้ `floor(slaPausedMs / 1 วัน)` วันทำการ (`closedPauseBusinessDays`) · `slaPausedMs` ยังเก็บต่อไว้ดู
  · **เกณฑ์ "กดรับเรื่องภายใน 24 ชม." ยังเป็นนาฬิกาจริง** (ไม่ข้ามเสาร์อาทิตย์/วันหยุด — ตั้งใจให้รับเร็ว) · วันอื่นที่แสดง (ค้าง N วัน, รอตอบกลับ N วัน, ไม่อัปเดต N วัน) ยังเป็นวันตามปฏิทินไทย (`calendarDaysBetween`)
  ส่วน `daysAssigned`/`resolutionDays` ยัง floor(ms) ตามความหมายเดิม
- **วันหยุดราชการ** ตั้งที่ **`/admin/superadmin/task-settings`** (superadmin · `SUPERADMIN_ONLY_PAGES` · เมนู "วันหยุด/กำหนดปิดงาน" + ปุ่มในหน้าการบริหารระบบ)
  → `PUT /api/tasks/settings { holidays: [{ date: 'YYYY-MM-DD', name }] }` (แทนทั้งรายการ, normalize ตรวจวันที่/ตัดซ้ำ/เรียง — `lib/tasks/holidays.js#normalizeHolidays`)
  · ปุ่ม "เติมวันหยุดที่วันที่ตายตัวของปี พ.ศ. …" เติม 14 วันใน `FIXED_THAI_HOLIDAYS` (1 ม.ค. · 6 เม.ย. · 13–15 เม.ย. · 4 พ.ค. · 3 มิ.ย. · 28 ก.ค. · 12 ส.ค. · 13 ต.ค. · 23 ต.ค. · 5 ธ.ค. · 10 ธ.ค. · 31 ธ.ค.) ไม่ทับชื่อที่ตั้งเอง
  · **วันหยุดทางจันทรคติ (มาฆบูชา วิสาขบูชา อาสาฬหบูชา เข้าพรรษา) วันหยุดชดเชย และวันหยุดพิเศษตาม ครม. ต้องเพิ่มเองทุกปี**
  · หน้าเดียวกันแก้ "กำหนดปิดตามชนิดงาน" ได้ (งานทั่วไป → `defaultSlaDays` · ชนิดอื่น → `slaByWorkType` เฉพาะที่ต่างจากทะเบียน) พร้อมตัวอย่างวันครบกำหนดถ้าแจ้งวันนี้
  · เพิ่ม/ลบวันหยุดไม่เลื่อน `Assignment.dueDate` ที่บันทึกแล้ว — ต้องรันสคริปต์ recompute (ด้านล่าง; toast หลังบันทึกบอกแอดมินให้แจ้งทีมพัฒนา)
  · เก็บได้สูงสุด 500 วัน (`MAX_HOLIDAYS` — เกินแล้ววันเก่าสุดหลุด) · `saveTaskSettings` อ่านค่าปัจจุบันแบบเข้มงวด (DB พลาด = error ไม่ merge กับ default ทับของเดิม)
  · บันทึก "กำหนดปิด" ของงานทั่วไปเขียน `defaultSlaDays` และ **ตัดแถว `general` ใน `slaByWorkType`** (ค่าที่ใช้จริงไม่เปลี่ยน แต่ `slaByCategory` กลับมามีผล — หน้าแจ้งเตือนไว้)
- **SLA นับจากวันที่ประชาชนแจ้ง** (`complaint.createdAt`) ไม่ใช่วันรับงาน — เรื่องที่ค้างในกองรอรับนานจึงมาถึงพร้อมเวลาที่เหลือน้อย (ตั้งใจ)
- **มติประชุม 10/11/69 — SLA ตามชนิดงาน + รับเรื่องภายใน 24 ชม.** ทะเบียนชนิดงานอยู่ `lib/tasks/workTypes.js` (ตรวจจาก `complaint.workType` ที่เลือกเอง → ประเภทย่อย → ข้อความ → หมวด)
  · ตัดสิน SLA ที่เดียว `lib/tasks/settings.js#resolveSla` (เรียกผ่าน `derived.js#dueDateFor` — ส่ง complaint ที่มี `problems detail workType category` เสมอ)
  · ลำดับ: `slaByWorkType` → (เฉพาะงานทั่วไป) `slaByCategory` → `defaultSlaDays` · ชนิดงานอื่นใช้ค่าทะเบียน · ทิศ import: settings → workTypes เท่านั้น

  | ชนิดงาน (`workType`) | SLA (วันทำการ) |
  |---|---|
  | ปะถนน (`road_patch`) · ดูดโคลน/ลอกท่อ (`drain_sludge`) | 30 วัน |
  | ฝาท่อเหล็ก/ปูน (`manhole_steel`/`manhole_concrete`) · กิ่งไม้/ต้นไม้ (`tree`) · ตัดหญ้า (`grass`) · เหตุรำคาญ (`nuisance`) | 15 วัน |
  | งานทั่วไป (`general` — ขยะ ไฟฟ้า ประปา ฯลฯ) | 3 วัน (`defaultSlaDays`) |

  · เรื่องรอรับ: amber ≥ `unclaimedWarnHours` (12), `isStale` เมื่อ **เกิน `unclaimedAlertHours` (24 ชม.)** — ตัดสินด้วย ms ไม่ปัดเศษ
    (24 ชม. พอดียังทัน · 24 ชม. 30 นาทีค้าง) · `hoursUnclaimed`/`claimHours` เป็นชม.เต็มไว้แสดงผลเท่านั้น · cron/ปุ่มแจ้ง LINE ใช้เกณฑ์เดียวกัน
    · ป้ายอายุบนการ์ด (`badges.js#agingPill`): ต่ำกว่าเกณฑ์ "รอ N ชม." / "ใหม่" (< 1 ชม.) · ถึงเกณฑ์ "ค้าง N วัน" (วันตามปฏิทิน อย่างน้อย 1)
  · KPI `claimedWithin24hRate` = % งาน (ผู้รับผิดชอบหลัก ไม่นับผู้ประสาน) ที่ `claimMs` (แจ้ง → กดรับ) ≤ `unclaimedAlertHours` — เกณฑ์ตามค่าตั้งนี้ · **นับเฉพาะเรื่องที่ประชาชนแจ้งตั้งแต่ `claimKpiFrom`** (ค่าเริ่มต้น `2026-11-16` = วันจันทร์ที่เริ่มใช้งานจริงตามมติประชุม, '' = นับทั้งหมด) งานเก่าก่อนมีกติกาไม่ดึง % ลง
    (ป้าย KpiStrip เขียน "รับเรื่องภายใน 24 ชม." ตามค่า default) · **เวลารับนับจากวันที่ประชาชนแจ้งเสมอ** — เรื่องที่ถูก "คืนงาน" แล้วมีคนรับใหม่
    ก็นับจากวันแจ้งเดิม ไม่ใช่จากตอนคืน (ตั้งใจ: เป็นคำมั่นต่อประชาชน) · การโอนงานไม่เปลี่ยน `assignedAt`
  · `Assignment.dueDate` ถูกบันทึกตอนกดรับ → เปลี่ยนกติกาแล้วงานเปิดเดิมไม่เปลี่ยนเอง ต้องรัน
    `node --env-file=.env.local --import tsx scripts/recompute-task-due-dates.mjs` (dry-run — บอกค่าตั้งที่ใช้ (รวมจำนวนวันหยุด), จำนวนสั้นลง/เลื่อนออก, จำนวนที่จะเกินกำหนดทันที)
    แล้วค่อยใส่ `--yes` เพื่อเขียนจริง · `--only-extend` = เฉพาะรายการที่วันครบกำหนดเลื่อนออก (ยังต้องมี `--yes` ถึงจะเขียน)
- **เปลี่ยนชนิดงาน (`work_type`)** — ประชาชนเลือกหมวดผิดบ่อย และชนิดงานตามมติประชุม (ฝาท่อเหล็ก/ปูน, ตัดหญ้า, ดูดโคลน) ไม่มีในฟอร์มสาธารณะ
  คนหน้างานจึงเลือกชนิดจริงที่หน้า `/admin/my-tasks/[assignmentId]` (แถว "ชนิดงาน" + ปุ่ม "เปลี่ยนชนิดงาน"; ยังไม่ตั้ง = "(ระบบเดา)")
  · สิทธิ์: เจ้าของงาน / หัวหน้ากองของเรื่อง (`taskPermissions().canTransfer`) / superadmin · งานปิดแล้วเปลี่ยนไม่ได้ · ชนิดเดิม = 400 "ชนิดงานเดิม"
  · ผล: `complaint.workType` + `Assignment.dueDate` = วันแจ้ง + SLA (วันทำการ) ของชนิดใหม่ (ค่าฐานไม่รวมช่วงพัก — พักยังบวกตอนอ่าน) ทั้งงานนี้และงานเปิดอื่นของเรื่องเดียวกัน
    + timeline note `เปลี่ยนชนิดงานเป็น "…" (กำหนดปิด N วันทำการนับจากวันแจ้ง)` + audit `complaint_work_type_set`
  · **ไม่ย้ายกองให้** — ถ้ากองปกติของชนิดนั้นไม่ใช่กองของเรื่อง คืน `suggestedDepartment` แล้ว UI แนะนำให้กด "ขอโอนงาน"/"โอนงาน" เอง
  · ป้ายชนิดงาน (ยกเว้นงานทั่วไป) แสดงบน `PoolCard` และ `TaskRow` จาก `workTypeLabel` ที่ derive ให้แล้ว
- **รอบแนบภาพความคืบหน้า (มติประชุม — งานปะถนน)** ชนิดงานที่มี `progressEveryDays` ในทะเบียน (`road_patch` = 7) ต้องแนบภาพหน้างานเป็นรอบ
  · `derived.js` คืน `progressEveryDays` · `lastProgressAt` (ล่าสุดของ: timeline `note`/`stage` ที่มี `images` · `unblocked` (เลิกพัก SLA = เริ่มรอบใหม่) · `assignedAt`)
    · `daysSinceProgress` (**วันทำการ** ผ่าน `businessDaysBetween` ข้ามวันหยุด) · `progressDue` (≥ รอบ) → `alertKinds` เพิ่ม `needs_update`
  · ไม่บังคับ/ปิดแล้ว/พัก SLA → `progressDue` false · **ไม่เปลี่ยน severity** · note ที่ไม่มีภาพไม่นับ
  · ป้าย `needs_update` (tone due) "ต้องอัปเดตภาพความคืบหน้า (ทุก N วันทำการ)" · การ์ดเตือนใบที่ 5 "ต้องอัปเดตความคืบหน้า" (`?alert=needs_update`)
    โผล่เฉพาะเมื่อมีงานเปิดที่ชนิดงานบังคับ · หน้ารายละเอียดมีแถบเตือน + แนบภาพผ่านฟอร์ม "บันทึกการดำเนินงานวันนี้" (PATCH `progress` รับ `images` https สูงสุด 10)
- **พบปัญหาหน้างาน (มติประชุม 2026-11)** รับงาน → ลงพื้นที่ → พบว่าเทศบาลทำไม่ได้ (เช่น แจ้งกิ่งมะม่วงพาดเสาไฟ แต่ต้นอยู่ในบ้านผู้แจ้ง) → ต้องแจ้งในระบบ
  · เจ้าของตัดสินใจ (owner): **แจ้งหัวหน้า + พัก SLA** แล้วหัวหน้า/superadmin ตัดสินใจต่อ
  · `PATCH /api/tasks/[assignmentId]` action `site_issue` { reasonCode, note?, images? } — เจ้าของงาน/superadmin · งานปิดแล้ว (`completedAt` หรือ status เรื่องปิดจากหน้า manage-complaints) หรือพักอยู่แล้ว (ทั้งสองแบบ) = 400 · `blocked` { on: true } ก็ปฏิเสธเรื่องที่ status ปิดแล้วเช่นกัน
  · เหตุผลมาตรฐาน `lib/tasks/siteIssue.js#SITE_ISSUE_REASONS` (private_property · not_our_duty · wrong_location · need_owner_consent · other — **ห้ามเปลี่ยน code เดิม**)
    · `validateSiteIssue`: note ตัด 500 ตัวอักษร (บังคับเมื่อ `other`) · ภาพเฉพาะ `https://res.cloudinary.com/` (โดเมน next/image) ≤ 5
  · บันทึก `blocked{ isBlocked: true, kind: 'site_issue', siteIssueCode, reason: "label — note", since }` ด้วย `timeline.js#siteIssueUpdate` — บัญชีพัก SLA ชุดเดียวกับรอวัสดุ
    + timeline `blocked` "พบปัญหาหน้างาน: …" พร้อมภาพ + กระดิ่ง (`priority: high`, `relatedId: site-issue:<id>`) ถึงหัวหน้ากองของเรื่อง + superadmin
    (`digest.js#transferRequestRecipients` ชุดเดียวกับคำขอโอน ไม่รวมคนกด) + audit `assignment_site_issue`
  · **ดำเนินการต่อ** = `blocked` { on: false } ตัวเดิม — เจ้าของ/superadmin + **หัวหน้ากองของเรื่อง (`canTransfer`) เฉพาะ kind site_issue** · ระหว่างพักแบบนี้ `blocked` { on: true } = 400 (กันกลายเป็นรอวัสดุ)
    · **ปิดเรื่อง**ยังเป็น `close` ของเจ้าของงาน/superadmin เท่านั้น — หัวหน้าที่ไม่ใช่เจ้าของ "ดำเนินการต่อ" ได้ หรือให้เจ้าของงาน/superadmin ปิด
  · `derived.js`: `isSiteIssue` · `siteIssueLabel` · `alertKinds` ใช้ `site_issue` **แทน** `blocked` (severity ยังเป็น `blocked`) · ป้าย "ปัญหาหน้างาน: <label>" · status pill "พบปัญหาหน้างาน"
    · การ์ดเตือน "พบปัญหาหน้างาน" (`?alert=site_issue`) โผล่ต่อจาก "รอวัสดุ" เฉพาะเมื่อมี ≥ 1 เรื่อง · การ์ดรอวัสดุ + `blockedRail` ไม่นับเรื่องเหล่านี้
    · กลุ่มงาน: `groupTasks` คืน `siteIssues` ต่อกลุ่ม (รวมอยู่ใน `counts.blocked`) → accordion แยกป้าย "รอวัสดุ"/"ปัญหาหน้างาน" · โหมดความเร่งด่วน กลุ่ม blocked ตั้งชื่อตามของจริง ("พบปัญหาหน้างาน" / "รอวัสดุ / พบปัญหาหน้างาน")
    · `kpi.blocked` = พักทั้งหมด · `kpi.siteIssue` = ในนั้นที่เป็นปัญหาหน้างาน · มือถือซ่อนปุ่มเร็ว "รอวัสดุ / งบ" ระหว่างพักแบบนี้
  · GET รายละเอียดคืน `siteIssueReasons`, `canReportSiteIssue` (canEdit + ยังไม่ปิด + ยังไม่พัก), `canResume`, `assignment.blocked.kind/siteIssueCode/images`
    · UI: การ์ด `SiteIssueCard` (ฟอร์ม inline เหตุผล/รายละเอียด/ภาพ) · พักอยู่ → แถบ "พักงาน — พบปัญหาหน้างาน: …" + ภาพ + ปุ่ม "ดำเนินการต่อ" บน header card และซ่อนการ์ดรอวัสดุ
- **ตารางคิวตัดหญ้า (มติประชุม — เรื่องตัดหญ้า)** เจ้าของตัดสินใจ: **ไฟล์กลางไฟล์เดียว** (รูปหรือ PDF) อัปโหลดครั้งเดียว แนบให้งานชนิด `grass` และประชาชนเห็นที่ `/status`
  · เก็บที่ `task_settings.grassSchedule { url, fileName, updatedAt }` — logic `lib/tasks/grassSchedule.js` (`normalizeGrassSchedule` รับ **https เท่านั้น** ไม่งั้นค่าว่างทั้งชุด · `grassSchedulePatch` ประทับ `updatedAt` ฝั่ง server · `grassScheduleFor(complaint, settings)` = url เฉพาะชนิด `grass` ที่ยังไม่ปิด)
  · อัปโหลด/ลบที่ `/admin/superadmin/task-settings` ส่วน "ตารางคิวตัดหญ้า" (บันทึกแยกจากวันหยุด/กำหนดปิด) → `PUT /api/tasks/settings { grassSchedule: { url, fileName } }` (url '' = ลบ)
    · อัปโหลดตรงเข้า Cloudinary ด้วย unsigned preset เดิม: **รูป → `image/upload` (ไม่ย่อ — ต้องอ่านตัวหนังสือออก)** · **PDF → `raw/upload`** (บัญชี Cloudinary ที่ไม่เปิด "Allow delivery of PDF and ZIP files" เปิด PDF แบบ image ไม่ได้ — raw เปิดได้) · ไม่เกิน 10 MB
    · ⚠️ ถ้า preset จำกัดชนิดไฟล์/resource type ไว้ อัปโหลด PDF จะได้ error จาก Cloudinary — แก้ที่ตั้งค่า preset · ลบตารางไม่ลบไฟล์บน Cloudinary (cloud แชร์กับแอปพี่น้อง ห้าม sweep)
  · `GET /api/tasks/[assignmentId]` คืน `grassSchedule` (มีไฟล์ + งานชนิด `grass`) หรือ `null` → การ์ด `GrassScheduleCard` ในคอลัมน์ขวา (เฉพาะงาน `grass`): ลิงก์เปิดแท็บใหม่ + ปุ่ม "บันทึกว่าอยู่ในคิวตัดหญ้า"
    = PATCH `progress` ตัวเดิม note `GRASS_QUEUE_NOTE` ("อยู่ในคิวตัดหญ้าตามตาราง — ดูตารางคิวได้ที่หน้าติดตามสถานะ") — ลงไทม์ไลน์เท่านั้น **ไม่ส่ง LINE** (กติกาความคืบหน้าธรรมดา) · ยังไม่มีไฟล์ = ข้อความให้ superadmin อัปโหลด
  · หน้า `/status` (โมดูลร้องเรียน): `GET /api/complaints` เติม **ฟิลด์ derived เดียว `grassScheduleUrl`** ให้เรื่อง `grass` ที่ยังไม่ปิด (คำนวณจากเอกสารหลัง sanitize · อ่าน settings เฉพาะเมื่อมีเรื่องเข้าเงื่อนไข · ไม่ขยาย projection)
    → ลิงก์ "ดูตารางคิวตัดหญ้า" บน `ComplaintCard` (span + `window.open` เพราะการ์ดเป็น `<a>`) และการ์ดในหน้า `/status/[id]` · ไม่ส่ง timeline/บันทึกภายในออกไป
- พัก SLA (`slaPausedAt`) → ไม่นับเกินกำหนด; วันครบกำหนดเลื่อนเป็นวันทำการด้วย `slaPausedBusinessDays` + ช่วงที่ยังพัก (ดูกติกาวันทำการด้านบน)
- severity: `overdue > due_soon > coordinating > blocked > normal > done`; เรื่องเดียวมีได้หลาย `alertKinds`
- เรื่องที่ปิดด้วย status จากหน้า manage-complaints โดย assignment ไม่มี `completedAt` → ถือว่าเสร็จ แต่ไม่เข้าตัวหาร on-time/avg
- `kpi.satisfaction` = คะแนนของเรื่องที่เจ้าหน้าที่ถือ นับ "1 ผู้แจ้ง = 1 เสียง" ผ่าน `lib/satisfaction/readStats.js#loadSatisfactionStatsForComplaints`
  + `computeFairStats` (null เมื่อไม่มีคะแนน) — ห้ามคำนวณ `$avg` เอง; อ่านพลาดไม่ทำให้หน้าล้ม
- ปุ่ม "แจ้ง LINE" ทุกจุดต้องมี dialog ยืนยัน — 1 push เข้ากลุ่มนับโควตาเท่าจำนวนสมาชิก (โควตา 300/เดือน)
- **นโยบายสิทธิ์ (ตกลง 2026-09-01):** admin ธรรมดา *รับงาน* จากกองเองได้ แต่ **โอน/มอบหมายได้เฉพาะหัวหน้ากอง (งานในกองตัวเอง) และ superadmin** ·
  รับผิดเรื่องและยังไม่เริ่มทำ → "คืนงานเข้ากองงานรอรับ" เอง · งานที่เริ่มแล้วใช้ "ขอโอนงาน" (แจ้งกระดิ่งหัวหน้า) · หัวหน้าเห็น "งานของกอง" ในหน้างานของฉัน · เรื่องค้างไม่มีคนรับแจ้งหัวหน้าทุกเช้าทางกระดิ่ง (cron)
  · หัวหน้ากอง = `users.isDepartmentHead` (superadmin ติ๊กที่ `/admin/superadmin/department-heads`) หรือถ้าไม่ตั้งดูจากตำแหน่ง — ทุกจุดผ่าน `lib/tasks/roles.js`
- "กอง" ของเรื่อง = `complaint.department` ที่คัดแยก (manual) → ถ้าไม่มีใช้ `defaultDepartmentForComplaint` (ประเภทย่อย/ข้อความกิ่งไม้-ต้นไม้ → งานป้องกันฯ, ไม่งั้นตามหมวด) → ไม่ได้ = ยังไม่ระบุกอง;
  เจ้าหน้าที่ที่โปรไฟล์ไม่ระบุกอง / superadmin รับได้ทุกเรื่อง
- ป้าย "เสี่ยงอันตราย" / "อาจต้องประสาน กฟภ." เป็นคำใบ้จาก keyword ในข้อความ (`pool.js`) ไม่ใช่การตัดสิน
- **แจ้งเตือน LINE ตอนสถานะเรื่องเปลี่ยน/ปิดงานอยู่ที่เดียว `lib/complaintNotify.js`** (`notifyComplaintStatusChanged`) — ใช้ทั้ง `update-status.js` เดิม
  และ `PATCH /api/tasks/[assignmentId]` ห้าม copy · การบันทึกความคืบหน้าธรรมดา (note/รูป) **ไม่** แจ้ง LINE (โควตา) — แจ้งเฉพาะเมื่อขั้นเปลี่ยนสถานะเรื่อง/ปิดงาน
- stepper: เดินหน้าทีละขั้น, ถอยต้องมีเหตุผล, ขั้น "ปิดเรื่อง" ต้องผ่าน `close` (สรุปบังคับ · ภาพ ≥1 หรือส่ง `confirmNoImages: true` — กติกาที่ `closeChecklist`) เท่านั้น · รูปความคืบหน้าอยู่ใน timeline, รูปตอนปิดเรื่องรวมเข้า `solutionImages` (หน้า /status + การ์ด LINE ใช้)
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
