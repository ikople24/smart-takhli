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
  unclaimedWarnDays: number;
  unclaimedAlertDays: number;
  followUpEveryDays: number;
  slaByCategory: Array<{ category: string; slaDays: number }>;
}

/** ผลของ deriveAssignment (lib/tasks/derived.js) */
export interface DerivedAssignment {
  slaDays: number;
  dueDate: string | null;
  dueBasis: 'stored' | 'complaint' | 'assignment' | null;
  daysToDue: number | null;
  isCompleted: boolean;
  isPaused: boolean;
  isOverdue: boolean;
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
  stage: Stage;
  role: AssignmentRole;
  severity: Severity;
  alertKinds: AlertKind[];
}

/** ผลของ deriveUnclaimed (lib/tasks/derived.js) */
export interface DerivedUnclaimed {
  daysUnclaimed: number | null;
  isStale: boolean;
  agingTone: 'overdue' | 'due' | 'neutral';
  slaDays: number;
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
  /** คะแนนเฉลี่ยแบบ 1 ผู้แจ้ง = 1 เสียง ของเรื่องที่เจ้าหน้าที่ถือ — null เมื่อยังไม่มีคะแนน */
  satisfaction: number | null;
  satisfactionCount?: number;
  satisfactionReporters?: number;
}

export interface MyKpiResponse {
  success: true;
  now: string;
  officer: { id: string; name: string; department: string; position: string; role: string };
  settings: TaskSettings;
  kpi: MyKpi;
  assignments: OfficerTask[];
  groups?: TaskGroup[];
}

/** หนึ่งการ์ดในกองงานรอรับ (ใช้โดย PoolCard — API pool มาในเฟสถัดไป) */
export interface PoolItem extends DerivedUnclaimed {
  _id: string;
  code: string | null;
  title: string;
  category: string;
  community: string;
  department: string | null;
  createdAt: string;
  agingPill: Badge | null;
  contextBadges: Badge[];
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
