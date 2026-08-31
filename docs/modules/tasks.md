# งานเจ้าหน้าที่ (tasks) — Officer Task Management

ระบบจัดการงานของเจ้าหน้าที่: **กลุ่มงานของฉัน** (งานที่ถืออยู่ จัดกลุ่มตามประเภท/กอง/ความเร่งด่วน) ·
**กองงานรอรับ** (เรื่องยังไม่มีเจ้าของ กดรับเอง) · **ป้ายเตือนชุดเดียวทุกหน้าจอ** ·
**ประสานหน่วยงานภายนอก** (แยก *หน่วยงานผู้ดำเนินการ* เช่น กฟภ. ออกจาก *ผู้ประสานงาน* เช่น กองช่าง)

- ที่มาดีไซน์ (hifi): `docs/design_handoff_officer_task_management/README.md`
- แผน + เหตุผลการตัดสินใจ: `docs/superpowers/plans/2026-08-31-officer-task-management-p1.md`
- **สถานะ (2026-08-31): เฟส 1 = ข้อ 1–4 ของ README เสร็จ** (โทเคนสี/ฟอนต์ · schema · derived logic + API · shared components)
  — หน้าจอ 1–3, API `pool`, responsive/LINE hooks เป็นเฟสถัดไป

## หน้า

- `/admin/my-tasks` — ยังเป็น UI เดิม (จะถูกแทนด้วยหน้าจอ 1) แต่อ่าน `overdueDays` จาก API แล้ว ไม่ hardcode 7 วัน
- `/admin/task-pool` — ยังไม่มี (หน้าจอ 2)

## API (`pages/api/tasks/`)

| endpoint | หน้าที่ |
|---|---|
| `GET /api/tasks/my-kpi?groupBy=category\|organization\|priority&alert=overdue\|due_soon\|coordinating\|blocked` | งานทั้งหมดของเจ้าหน้าที่ที่ล็อกอิน + derived fields + `kpi` + (ถ้าส่ง groupBy) `groups` — คีย์เดิม (`status`, `daysAssigned`, `resolutionDays`, `actionUrl`) คงไว้ให้หน้าเดิม |
| `GET /api/tasks/pending` | widget งานค้างเดิม — เปลี่ยนมาใช้ SLA จาก `task_settings` ผ่าน `deriveAssignment` |
| `GET /api/tasks/settings` · `PUT` (superadmin) | SLA/เกณฑ์เตือน — PUT รับบางฟิลด์ได้ (merge) ลง audit `task_settings_updated` |
| `pages/api/tasks/_auth.ts` | `getOfficer(req)` (Clerk → users ใน Mongo) · `requireSuperAdmin(req)` |
| `POST /api/complaints/assignments/create` | (path เดิมใต้ complaints) รับ `role: assignee\|coordinator`, ตั้ง `dueDate` = วันที่แจ้ง + SLA, `stage: received`, timeline `created` |

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
| `loadSettings.js` | I/O: `getTaskSettings` (พลาด → default) / `saveTaskSettings` (merge) |
| `types.ts` | TypeScript types ของผลลัพธ์ทั้งหมด |

## Components (`components/tasks/`)

`AlertBadge` (tone → `tk-*`) · `TaskRow` · `WorkGroupAccordion` (เปิดหลายกลุ่ม, จำใน sessionStorage) ·
`PoolCard` (ปุ่มตาม `action`: claim / coordinate / choose_org / not_yours) · `StatusStepper` · `CoordinationBlock`
— ทั้งหมดรับข้อมูลที่ API derive มาแล้ว **ไม่คำนวณเอง**

## กติกาที่ต้องรู้

- **นับ "วัน" ตามปฏิทินไทย** (`calendarDaysBetween`) — เส้นตาย = สิ้นวันไทยของวันครบกำหนด (ครบ 10:00 ตอนนี้ 12:00 ยัง "ครบกำหนดวันนี้")
  ส่วน `daysAssigned`/`resolutionDays` ยัง floor(ms) ตามความหมายเดิม
- **SLA นับจากวันที่ประชาชนแจ้ง** (`complaint.createdAt`) ไม่ใช่วันรับงาน — เรื่องที่ค้างในกองรอรับนานจึงมาถึงพร้อมเวลาที่เหลือน้อย (ตั้งใจ)
- พัก SLA (`slaPausedAt`) → ไม่นับเกินกำหนด; วันครบกำหนดเลื่อนด้วย `slaPausedMs` + ช่วงที่ยังพัก
- severity: `overdue > due_soon > coordinating > blocked > normal > done`; เรื่องเดียวมีได้หลาย `alertKinds`
- เรื่องที่ปิดด้วย status จากหน้า manage-complaints โดย assignment ไม่มี `completedAt` → ถือว่าเสร็จ แต่ไม่เข้าตัวหาร on-time/avg
- `kpi.satisfaction = null` จนกว่า `lib/satisfaction/readStats.js` (PR #145) เข้า main — ห้ามคำนวณ `$avg` เอง
- สี: โทเคน `tk-*` ใน `styles/globals.css` (`@theme`) — **ไม่แตะ `--color-primary` ของ `mytheme`**; ฟอนต์ `font-tk-sans` / `font-tk-mono` (IBM Plex Mono เพิ่มใน `_document.tsx`)
- ข้อความไทยในป้าย/ปุ่มต้อง `whitespace-nowrap`
