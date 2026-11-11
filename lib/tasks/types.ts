// lib/tasks/types.ts
// ชนิดข้อมูลกลางของโมดูลงานเจ้าหน้าที่ — ใช้ร่วมกันระหว่าง API (pages/api/tasks/*) และ components/tasks/*
// logic จริงอยู่ในไฟล์ .js ข้าง ๆ (derived / kpi / groupBy / badges) — ไฟล์นี้บรรยายรูปทรงผลลัพธ์เท่านั้น

export type Severity = 'overdue' | 'due_soon' | 'coordinating' | 'blocked' | 'normal' | 'done';
export type AlertKind = 'overdue' | 'due_soon' | 'coordinating' | 'blocked';
export type GroupBy = 'category' | 'organization' | 'priority';
export type Stage = 'received' | 'site_visit' | 'coordinating' | 'awaiting_review' | 'closed';
export type AssignmentRole = 'assignee' | 'coordinator';

/** โทนสีป้าย → โทเคน tk-* ใน styles/globals.css */
export type BadgeTone = 'overdue' | 'due' | 'coord' | 'blocked' | 'unclaimed' | 'done' | 'info' | 'neutral';

export interface Badge {
  kind: string;
  tone: BadgeTone;
  label: string;
}

export interface StatusPill {
  label: string;
  tone: BadgeTone;
}

export interface TaskSettings {
  defaultSlaDays: number;
  warnBeforeDays: number;
  /** เลิกใช้ตัดสินแล้ว — คงไว้เพื่อความเข้ากันได้ */
  unclaimedWarnDays: number;
  /** เลิกใช้ตัดสินแล้ว — คงไว้เพื่อความเข้ากันได้ */
  unclaimedAlertDays: number;
  /** ป้าย amber เมื่อรอรับ ≥ N ชม. */
  unclaimedWarnHours: number;
  /** "รอเกิน N ชม." เมื่อรอรับ > N ชม. (มติประชุม 10/11/69 = 24) */
  unclaimedAlertHours: number;
  followUpEveryDays: number;
  /** ใช้กับ "งานทั่วไป" เท่านั้น */
  slaByCategory: Array<{ category: string; slaDays: number }>;
  /** ทับ SLA ในทะเบียนชนิดงาน (lib/tasks/workTypes.js) */
  slaByWorkType: Array<{ workType: string; slaDays: number }>;
  /** วันหยุดราชการ (ไม่นับเป็นวันทำการของกำหนดปิดเรื่อง) — เรียงตามวันที่ ไม่ซ้ำ */
  holidays: TaskHoliday[];
}

export interface TaskHoliday {
  /** 'YYYY-MM-DD' (วันที่ไทย) */
  date: string;
  name: string;
}

/** ผลของ deriveAssignment (lib/tasks/derived.js) */
export interface DerivedAssignment {
  /** กำหนดปิด (วันทำการ จ.–ศ. ไม่รวมวันหยุด) นับจากวันแจ้ง */
  slaDays: number;
  /** key ในทะเบียนชนิดงาน (lib/tasks/workTypes.js) */
  workType: string;
  workTypeLabel: string;
  dueDate: string | null;
  dueBasis: 'stored' | 'complaint' | 'assignment' | null;
  /** วันทำการที่เหลือถึงกำหนด (0 = วันนี้ · ติดลบ = เลยแล้ว อย่างน้อย -1) */
  daysToDue: number | null;
  isCompleted: boolean;
  isPaused: boolean;
  isOverdue: boolean;
  /** เกินกำหนดกี่วันทำการ (≥ 1 เมื่อ isOverdue) */
  overdueDays: number;
  isDueSoon: boolean;
  needsCoordination: boolean;
  agencyName: string | null;
  coordinationWaitDays: number | null;
  followUpDue: boolean;
  isBlocked: boolean;
  blockedDays: number | null;
  lastActivityAt: string | null;
  daysSinceUpdate: number | null;
  daysAssigned: number | null;
  resolutionDays: number | null;
  completedLate: boolean | null;
  /** ms จากประชาชนแจ้ง → กดรับ (null = ไม่รู้เวลาแจ้ง) — ใช้ตัดสิน KPI รับภายใน 24 ชม. */
  claimMs: number | null;
  /** ชม.เต็มของ claimMs — แสดงผลเท่านั้น */
  claimHours: number | null;
  stage: Stage;
  role: AssignmentRole;
  severity: Severity;
  alertKinds: AlertKind[];
}

/** ผลของ deriveUnclaimed (lib/tasks/derived.js) */
export interface DerivedUnclaimed {
  daysUnclaimed: number | null;
  /** ชม.เต็มตั้งแต่ประชาชนแจ้ง (≥ 0) — แสดงผลเท่านั้น (isStale ตัดสินด้วย ms) */
  hoursUnclaimed: number | null;
  /** รอรับเกิน unclaimedAlertHours */
  isStale: boolean;
  agingTone: 'overdue' | 'due' | 'neutral';
  slaDays: number;
  workType: string;
  workTypeLabel: string;
  dueDate: string | null;
  daysToDue: number | null;
  isUrgent: boolean;
}

export interface CoordinationInfo {
  agencyName: string;
  coordinatorOrgId: string | null;
  coordinatorName?: string;
  documentNo: string;
  sentAt: string | null;
  nextFollowUpAt: string | null;
  followUpCount: number;
  lastFollowUpAt: string | null;
}

export interface BlockedInfo {
  isBlocked: boolean;
  reason: string;
  itemName: string;
  purchaseRefNo: string;
  expectedAt: string | null;
  since: string | null;
}

/** หนึ่งรายการใน GET /api/tasks/my-kpi — สิ่งที่ TaskRow / WorkGroupAccordion ใช้ */
export interface OfficerTask extends DerivedAssignment {
  _id: string;
  complaintId: string | null;
  /** รหัสเรื่อง TKC-xxxxxx (ถ้ามี) */
  code: string | null;
  title: string;
  description?: string;
  category: string;
  community: string;
  /** กองที่รับผิดชอบ (Organization) หรือกองของเจ้าหน้าที่ */
  department: string;
  complaintStatus: string;
  /** สถานะย่อสำหรับหน้าเดิม — pending | overdue | completed */
  status: 'pending' | 'overdue' | 'completed';
  assignedAt: string;
  completedAt: string | null;
  updatedAt: string | null;
  imageCount: number;
  hasLocation: boolean;
  badges: Badge[];
  statusPill: StatusPill;
  coordination: CoordinationInfo | null;
  blocked: BlockedInfo | null;
  actionUrl: string | null;
  /** เจ้าของงาน (มีเมื่อดู scope=department) */
  assignee?: { id: string; name: string } | null;
  /** คำขอโอนงานที่ยังค้าง (รอหัวหน้า) */
  transferRequest?: TransferRequestInfo | null;
}

export interface TransferRequestInfo {
  requestedAt: string;
  reason: string;
  byName: string;
}

/** สิทธิ์ของเจ้าหน้าที่ที่ล็อกอิน (lib/tasks/roles.js#taskPermissions) */
export interface TaskPermissions {
  isSuperAdmin: boolean;
  isHead: boolean;
  canAssign: boolean;
  canTransfer: boolean;
}

export interface TaskGroup<T = OfficerTask> {
  key: string;
  label: string;
  sub: string;
  count: number;
  counts: Record<Severity, number>;
  topSeverity: Severity;
  items: T[];
}

export interface MyKpi {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  overdue: number;
  dueSoon: number;
  coordinating: number;
  blocked: number;
  completedThisMonth: number;
  completionRate: number;
  onTimeRate: number | null;
  avgResolutionDays: number | null;
  /** % เรื่องที่กดรับภายใน 24 ชม. นับจากประชาชนแจ้ง — null เมื่อไม่มีข้อมูล */
  claimedWithin24hRate: number | null;
  /** ตัวหารของ claimedWithin24hRate */
  claimedCount: number;
  /** คะแนนเฉลี่ยแบบ 1 ผู้แจ้ง = 1 เสียง ของเรื่องที่เจ้าหน้าที่ถือ — null เมื่อยังไม่มีคะแนน */
  satisfaction: number | null;
  satisfactionCount?: number;
  satisfactionReporters?: number;
}

export interface MyKpiResponse {
  success: true;
  now: string;
  officer: { id: string; name: string; department: string; position: string; role: string };
  /** mine = งานของฉัน · department = งานทั้งกอง (หัวหน้า/superadmin) */
  scope: 'mine' | 'department';
  permissions: TaskPermissions;
  settings: TaskSettings;
  kpi: MyKpi;
  assignments: OfficerTask[];
  groups?: TaskGroup[];
}

/** หนึ่งการ์ดในกองงานรอรับ — GET /api/tasks/pool (derive แล้ว: deriveUnclaimed + badges + department) */
export interface PoolItem extends DerivedUnclaimed {
  _id: string;
  code: string | null;
  title: string;
  category: string;
  /** ประเภทย่อยที่ประชาชนเลือก (เช่น "กิ่งไม้ล้ำถนน") */
  problems: string[];
  community: string;
  /** กองที่รับผิดชอบ (ชื่อมาตรฐาน) — null = ยังไม่ระบุกอง */
  department: string | null;
  /** manual = เจ้าหน้าที่คัดแยก · category = เดาจากประเภทเรื่อง */
  departmentSource: 'manual' | 'category' | null;
  createdAt: string;
  imageCount: number;
  hasLocation: boolean;
  location: { lat: number; lng: number } | null;
  /** เติมฝั่ง client เมื่อกด "ใกล้ฉัน" (lib/tasks/mobile.js#withDistance) */
  distanceKm?: number | null;
  distanceLabel?: string | null;
  repeatCount: number;
  possibleAgency: string | null;
  isDangerous: boolean;
  agingPill: Badge | null;
  contextBadges: Badge[];
  /** ปุ่มบนการ์ดสำหรับเจ้าหน้าที่ที่ล็อกอิน (lib/tasks/pool.js#poolAction) */
  action: 'claim' | 'claim_other' | 'choose_org';
}

export interface PoolColumn {
  key: string;
  label: string;
  fullName?: string;
  count: number;
  maxDays: number | null;
  maxDaysTone: 'overdue' | 'due' | 'neutral';
  tone: BadgeTone | 'primary';
  isOwn?: boolean;
  isUnassigned?: boolean;
  items: PoolItem[];
}

export interface PoolResponse {
  success: true;
  now: string;
  officer: { id: string; name: string; department: string | null; rawDepartment: string; canAssign: boolean; isSuperAdmin: boolean; isHead: boolean };
  settings: TaskSettings;
  filters: { groupBy: GroupBy; q: string; community: string; days: number | null; onlyStale: boolean };
  items: PoolItem[];
  columns: PoolColumn[];
  stale: { count: number; maxDays: number | null; community: string; urgentCount: number; olderOutsideWindow: number };
  total: number;
  communities: string[];
  departments: Array<{ name: string; short: string }>;
  /** จำนวนงานเปิดที่แต่ละเจ้าหน้าที่ถืออยู่ (สำหรับ modal มอบหมาย) */
  workload: Record<string, number>;
  /** งาน "กำลังดำเนินการ" (มีเจ้าของแล้ว) แยกตามกอง — โชว์ใต้หัวคอลัมน์ */
  inProgressByDepartment: Record<string, number>;
}

/* ── ผลของ lib/tasks/summary.js (หน้าจอ 1) ── */

export interface AlertCard {
  key: AlertKind;
  tone: BadgeTone;
  label: string;
  count: number;
  caption: string;
}

export interface CoordinationRailItem {
  agencyName: string;
  count: number;
  maxWaitDays: number | null;
  waitPill: Badge | null;
  latestSentAt: string | null;
  nextFollowUpAt: string | null;
  followUpDue: boolean;
  asCoordinator: boolean;
  tasks: Array<{ _id: string; code: string | null; title: string; actionUrl: string | null; role: AssignmentRole }>;
}

export interface BlockedRailItem {
  _id: string;
  code: string | null;
  title: string;
  itemName: string;
  purchaseRefNo: string;
  expectedAt: string | null;
  since: string | null;
  actionUrl: string | null;
}

export interface DueThisWeekItem {
  _id: string;
  code: string | null;
  title: string;
  dueDate: string | null;
  daysToDue: number;
  tone: 'overdue' | 'due' | 'neutral';
  caption: string;
  actionUrl: string | null;
}

/* ── หน้าจอ 3: GET /api/tasks/[assignmentId] ── */

export type TimelineKind = 'received' | 'assigned' | 'created' | 'note' | 'stage' | 'coordination' | 'follow_up' | 'blocked' | 'unblocked' | 'transfer' | 'closed' | 'pending';

export interface TimelineEntry {
  key: string;
  kind: TimelineKind;
  tone: BadgeTone;
  title: string;
  detail?: string;
  at: string | null;
  by?: string;
  images?: string[];
  pending: boolean;
}

export interface SolutionOption {
  _id: string;
  label: string;
  iconUrl?: string;
}

export interface WorkTypeOption {
  key: string;
  label: string;
  slaDays: number;
}

/** ผลของ PATCH /api/tasks/[assignmentId] action work_type */
export interface WorkTypeChangeResponse {
  success: true;
  workType: string;
  workTypeLabel: string;
  slaDays: number;
  dueDate: string | null;
  /** กองปกติของชนิดงานนี้ เมื่อไม่ใช่กองปัจจุบันของเรื่อง (แนะนำเท่านั้น ไม่ได้ย้ายให้) */
  suggestedDepartment: string | null;
}

export interface TaskDetailResponse {
  success: true;
  now: string;
  canEdit: boolean;
  canTransfer: boolean;
  canRequestTransfer: boolean;
  /** เปลี่ยนชนิดงานได้ (เจ้าของ / หัวหน้ากองของเรื่อง / superadmin และงานยังไม่ปิด) */
  canSetWorkType: boolean;
  /** ชนิดงานของเรื่อง (key ใน lib/tasks/workTypes.js) — ตัวเดียวกับ derived.workType */
  workType: string;
  workTypeLabel: string;
  /** manual = เจ้าหน้าที่เลือก · auto = ระบบเดา */
  workTypeSource: 'manual' | 'auto';
  /** ตัวเลือกชนิดงาน + SLA ที่ใช้กับเรื่องนี้จริง (รวมค่าตั้ง) — lib/tasks/workTypeChange.js#workTypeOptionsFor */
  workTypeOptions: WorkTypeOption[];
  /** คืนงานเข้ากองงานรอรับได้ (เจ้าของ/superadmin + ยังไม่เริ่มทำ — lib/tasks/release.js) */
  canRelease: boolean;
  transferRequest: TransferRequestInfo | null;
  settings: TaskSettings;
  assignment: {
    _id: string;
    stage: Stage;
    role: AssignmentRole;
    assignedAt: string;
    completedAt: string | null;
    updatedAt: string | null;
    dueDate: string | null;
    slaPausedAt: string | null;
    note: string;
    solution: string[];
    solutionImages: string[];
    coordination: CoordinationInfo | null;
    blocked: BlockedInfo | null;
    assignee: { id: string; name: string; department: string; position: string } | null;
  };
  complaint: {
    _id: string;
    code: string | null;
    title: string;
    detail: string;
    category: string;
    community: string;
    problems: string[];
    images: string[];
    location: { lat: number; lng: number } | null;
    createdAt: string | null;
    updatedAt: string | null;
    status: string;
    department: string | null;
    reporterName: string;
    reporterPhone: string;
    isConfidential: boolean;
    pdpaSensitive: boolean;
    hasLine: boolean;
  };
  derived: DerivedAssignment;
  badges: Badge[];
  statusPill: StatusPill;
  timeline: TimelineEntry[];
  solutionOptions: SolutionOption[];
}
