# งานเจ้าหน้าที่ (tasks) — Officer Task Management

ระบบจัดการงานของเจ้าหน้าที่: **กลุ่มงานของฉัน** (งานที่ถืออยู่ จัดกลุ่มตามประเภท/กอง/ความเร่งด่วน) ·
**กองงานรอรับ** (เรื่องยังไม่มีเจ้าของ กดรับเอง) · **ป้ายเตือนชุดเดียวทุกหน้าจอ** ·
**ประสานหน่วยงานภายนอก** (แยก *หน่วยงานผู้ดำเนินการ* เช่น กฟภ. ออกจาก *ผู้ประสานงาน* เช่น กองช่าง)

- ที่มาดีไซน์ (hifi): `docs/design_handoff_officer_task_management/README.md`
- แผน + เหตุผลการตัดสินใจ: `docs/superpowers/plans/2026-08-31-officer-task-management-p1.md`
- **สถานะ (2026-09-01): เฟส 1–3 (ข้อ 1–6) เสร็จ** — `/admin/my-tasks` (หน้าจอ 1) และ `/admin/task-pool` (หน้าจอ 2) ใช้งานได้จริง
  · ค้าง: หน้าจอ 3 (รายละเอียด+อัปเดต), มือถือ/LINE hooks · **ต้องรัน `scripts/grant-task-pool-permission.mjs --yes` (13 user)**

## หน้า

- `/admin/my-tasks` — **หน้าจอ 1 โฉมใหม่** (`pages/admin/my-tasks.tsx`): header card · การ์ดเตือน 4 ใบ (คลิก → `?alert=`) ·
  KPI strip · กลุ่มงานของฉัน (`?groupBy=category|organization|priority` regroup ฝั่ง client, จำกลุ่มที่เปิดใน sessionStorage) ·
  right rail (ต้องประสานงานต่อ / รอวัสดุ / ครบกำหนดสัปดาห์นี้) · ปุ่ม "โอน / ส่งต่องาน" (modal) · "รับงานจากกอง"
  ไป `/admin/task-pool` · ลูกศรใน task row ยังไปหน้า manage-complaints (หน้าจอ 3 ยังไม่มี)
  · meta ใน `components/Layout.js` เหลือแค่ `title` เพราะหน้ามี header card เอง
- `/admin/task-pool` — **หน้าจอ 2 กองงานรอรับ** (`pages/admin/task-pool.tsx`, ครอบ `PermissionGuard`): alert bar แดง (ค้างเกิน `unclaimedAlertDays`
  + ปุ่ม "ดูเฉพาะที่ค้าง" / "แจ้งเตือนหัวหน้ากอง" ทาง LINE) · tabs `?groupBy=organization|category|priority` · ค้นหา / ชุมชน / ช่วงเวลา
  (`?days=30|90|365|all` default 30 — ถ้ามีเรื่องเก่ากว่านั้น alert bar บอกจำนวนพร้อมลิงก์ดูทั้งหมด) · kanban ต่อคอลัมน์ (กองของตัวเองมีเสมอ,
  "ยังไม่ระบุกอง" dashed ท้ายสุด) · การ์ด: รับงาน (optimistic + toast "เลิกทำ" 5 วิ) / มอบหมาย (หัวหน้ากอง) / เลือกกอง / ไม่ใช่กองของคุณ
  · ลงทะเบียนครบ 4 จุด (ALL_PAGES + DEFAULT_PERMISSIONS admin + navigationItems + ADMIN_META) + `scripts/grant-task-pool-permission.mjs`

## API (`pages/api/tasks/`)

| endpoint | หน้าที่ |
|---|---|
| `GET /api/tasks/my-kpi?groupBy=category\|organization\|priority&alert=overdue\|due_soon\|coordinating\|blocked` | งานทั้งหมดของเจ้าหน้าที่ที่ล็อกอิน + derived fields + `kpi` + (ถ้าส่ง groupBy) `groups` — คีย์เดิม (`status`, `daysAssigned`, `resolutionDays`, `actionUrl`) คงไว้ให้หน้าเดิม |
| `GET /api/tasks/pending` | widget งานค้างเดิม — เปลี่ยนมาใช้ SLA จาก `task_settings` ผ่าน `deriveAssignment` |
| `GET /api/tasks/pool?groupBy=&q=&community=&days=&onlyStale=1` | เรื่องที่ยังไม่มี Assignment และยังไม่ปิด (`lib/tasks/loadPool.js`) + derived/ป้าย + `action` ต่อเจ้าหน้าที่ + คอลัมน์ (`groupPool`) + `stale` + `workload` (งานเปิดต่อคน) + `departments` — สิทธิ์ผ่าน `requirePage('/admin/task-pool')` · ไม่คืนชื่อ/เบอร์ผู้แจ้ง |
| `POST /api/tasks/pool-alert` | สรุปเรื่องค้างเกินเกณฑ์เข้า LINE กลุ่ม (⚠️ โควตา — UI ยืนยันก่อน) |
| `PATCH /api/tasks/set-department` | คัดแยกกอง `{ complaintId, department }` (ชื่อมาตรฐานเท่านั้น, '' = ล้าง) → audit `complaint_department_set` — README เขียนเป็น `/api/complaints/:id/organization` แต่วางใต้ `complaints/[id]/` ไม่ได้ เพราะชนกับ `[id_card].js` (Next.js ห้าม slug ต่างชื่อใน path เดียวกัน → dev server ล้มทั้งตัว) |
| `DELETE /api/complaints/assignments/[id]` | "เลิกทำ" การรับงาน — เจ้าของ/superadmin, ภายใน 15 นาที, ยังไม่มีความคืบหน้า → audit `assignment_unclaimed` |
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
| `loadPool.js` | I/O: `loadPoolItems({ settings, days })` (ไม่มี Assignment + ยังไม่ปิด, ร้องซ้ำ = เบอร์+ประเภท+ชุมชนเดียวกันใน 180 วัน — เบอร์ไม่ออกจากฟังก์ชัน), `loadWorkload()` |
| `loadSettings.js` | I/O: `getTaskSettings` (พลาด → default) / `saveTaskSettings` (merge) |
| `types.ts` | TypeScript types ของผลลัพธ์ทั้งหมด |

## Components (`components/tasks/`)

shared (ข้อ 4): `AlertBadge` (tone → `tk-*`) · `TaskRow` · `WorkGroupAccordion` (เปิดหลายกลุ่ม, จำใน sessionStorage) ·
`PoolCard` (ปุ่มตาม `action`: claim / coordinate / choose_org / not_yours) · `StatusStepper` · `CoordinationBlock`

หน้าจอ 1 (ข้อ 5): `OfficerHeaderCard` · `AlertCards` · `KpiStrip` · `RailCards` (`CoordinationRailCard` / `BlockedRailCard` / `DueThisWeekCard`) ·
`TransferTaskModal` (รายชื่อจาก `GET /api/users/get-all-user` จัดกลุ่มตามกอง) · `FollowUpModal`

หน้าจอ 2 (ข้อ 6): `AssignTaskModal` (เจ้าหน้าที่ในกองก่อน เรียงงานน้อย→มาก จาก `workload`) · `DepartmentPickerModal`
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
- "กอง" ของเรื่อง = `complaint.department` ที่คัดแยก (manual) → ถ้าไม่มีใช้ `defaultDepartmentForCategory` (category) → ไม่ได้ = ยังไม่ระบุกอง;
  เจ้าหน้าที่ที่โปรไฟล์ไม่ระบุกอง / superadmin รับได้ทุกเรื่อง · "หัวหน้ากอง" (มอบหมายได้) = superadmin หรือ position ตรง `HEAD_POSITION_RE`
  (ผู้อำนวยการ/หัวหน้า/ผอ./ปลัด — ระบบไม่มี role หัวหน้า)
- ป้าย "เสี่ยงอันตราย" / "อาจต้องประสาน กฟภ." เป็นคำใบ้จาก keyword ในข้อความ (`pool.js`) ไม่ใช่การตัดสิน
- สี: โทเคน `tk-*` ใน `styles/globals.css` (`@theme`) — **ไม่แตะ `--color-primary` ของ `mytheme`**; ฟอนต์ `font-tk-sans` / `font-tk-mono` (IBM Plex Mono เพิ่มใน `_document.tsx`)
- ข้อความไทยในป้าย/ปุ่มต้อง `whitespace-nowrap`
