// pages/api/tasks/my-kpi.ts
// GET /api/tasks/my-kpi?groupBy=category|organization|priority&alert=overdue|due_soon|coordinating|blocked&scope=mine|department
// scope=department (หัวหน้ากอง/superadmin เท่านั้น) = งานของทุกคนในกองเดียวกัน — ใช้โอนงาน/ดูภาระงานทั้งกอง
// งานทั้งหมดของเจ้าหน้าที่ที่ล็อกอิน (เปิด + เสร็จ) พร้อม derived fields (lib/tasks/derived.js), KPI strip
// (lib/tasks/kpi.js) และถ้าส่ง groupBy มาจะจัดกลุ่มให้ด้วย (lib/tasks/groupBy.js) — client จะ regroup เองก็ได้
// คีย์เดิม (status pending|overdue|completed, daysAssigned, resolutionDays, actionUrl) คงไว้ให้หน้า my-tasks เดิมใช้ต่อ
import type { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import Assignment from '@/models/Assignment';
import '@/models/Complaint';
import { getTaskSettings } from '@/lib/tasks/loadSettings';
import { deriveAssignment } from '@/lib/tasks/derived';
import { computeKpi } from '@/lib/tasks/kpi';
import { GROUP_BY, groupTasks, filterByAlert } from '@/lib/tasks/groupBy';
import { badgesForAssignment, statusPillFor } from '@/lib/tasks/badges';
import { summarizeText, toDate } from '@/lib/tasks/format';
import { defaultDepartmentForCategory, normalizeDepartment } from '@/lib/tasks/departments';
import { taskPermissions } from '@/lib/tasks/roles';
import { loadSatisfactionStatsForComplaints } from '@/lib/satisfaction/readStats';
import { computeFairStats } from '@/lib/satisfaction/fairStats';
import type { DerivedAssignment, OfficerTask, GroupBy, AlertKind, Badge, StatusPill, MyKpi } from '@/lib/tasks/types';
import { getOfficer, userModel, CURRENT_APP_ID } from './_auth';

interface ComplaintLean {
  _id: mongoose.Types.ObjectId;
  complaintId?: string;
  fullName?: string;
  detail?: string;
  category?: string;
  status?: string;
  community?: string;
  images?: string[];
  location?: { lat?: number; lng?: number };
  createdAt?: Date;
  updatedAt?: Date;
  /** กองที่คัดแยกแล้ว (ชื่อมาตรฐาน) — '' = ยังไม่ระบุ */
  department?: string;
}

interface AssignmentLean {
  _id: mongoose.Types.ObjectId;
  complaintId: ComplaintLean | null;
  role?: string;
  stage?: string;
  assignedAt: Date;
  completedAt?: Date | null;
  updatedAt?: Date | null;
  dueDate?: Date | null;
  slaPausedAt?: Date | null;
  slaPausedMs?: number;
  coordination?: {
    agencyName?: string;
    coordinatorOrgId?: mongoose.Types.ObjectId | null;
    documentNo?: string;
    sentAt?: Date | null;
    nextFollowUpAt?: Date | null;
    followUps?: Array<{ at?: Date }>;
  };
  blocked?: {
    isBlocked?: boolean;
    reason?: string;
    itemName?: string;
    purchaseRefNo?: string;
    expectedAt?: Date | null;
    since?: Date | null;
  };
  timeline?: Array<{ at?: Date }>;
  transferRequest?: { requestedAt?: Date | null; reason?: string; byName?: string };
  userId: mongoose.Types.ObjectId;
}

const iso = (v: unknown): string | null => {
  const d = toDate(v);
  return d ? d.toISOString() : null;
};

const ALERT_KINDS: AlertKind[] = ['overdue', 'due_soon', 'coordinating', 'blocked'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await getOfficer(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  const { officer } = auth;

  try {
    const now = new Date();
    const settings = await getTaskSettings();
    const perms = taskPermissions({ isSuperAdmin: auth.isSuperAdmin, user: officer });
    const scope: 'mine' | 'department' = req.query.scope === 'department' && (perms.isHead || auth.isSuperAdmin) ? 'department' : 'mine';

    // scope=department: เจ้าหน้าที่ทุกคนในกองเดียวกัน (superadmin ที่ไม่ระบุกอง = ทุกคน)
    let userIds: mongoose.Types.ObjectId[] = [officer._id];
    const namesById = new Map<string, string>();
    if (scope === 'department') {
      const ownDept = normalizeDepartment(officer.department);
      const members = (await userModel()
        .find({ appId: CURRENT_APP_ID, isArchived: { $ne: true } })
        .select('name department')
        .lean()) as Array<{ _id: mongoose.Types.ObjectId; name?: string; department?: string }>;
      const inScope = ownDept || !auth.isSuperAdmin ? members.filter((m) => normalizeDepartment(m.department) === ownDept) : members;
      userIds = inScope.map((m) => m._id);
      for (const m of inScope) namesById.set(String(m._id), m.name ?? '');
      if (!userIds.some((id) => String(id) === String(officer._id))) userIds.push(officer._id);
    }

    const rows = (await Assignment.find({ userId: { $in: userIds } })
      .populate({
        path: 'complaintId',
        model: 'SubmittedReport',
        select: 'complaintId fullName detail category status community images location createdAt updatedAt department',
      })
      .sort({ assignedAt: -1 })
      .lean()) as unknown as AssignmentLean[];

    const officerDepartment = officer.department ?? '';

    const assignments: OfficerTask[] = rows.map((a) => {
      const c = a.complaintId;
      const derived = deriveAssignment({ assignment: a, complaint: c ?? {}, settings, now }) as DerivedAssignment;
      const badges = badgesForAssignment(derived) as Badge[];
      const statusPill = statusPillFor(derived) as StatusPill;
      const detailTitle = summarizeText(c?.detail, 90);
      const coord = a.coordination;
      const followUps = Array.isArray(coord?.followUps) ? coord!.followUps! : [];
      const lastFollowUp = followUps.reduce<Date | null>((best, f) => {
        const d = toDate(f?.at);
        return d && (!best || d > best) ? d : best;
      }, null);

      return {
        ...derived,
        _id: String(a._id),
        complaintId: c ? String(c._id) : null,
        code: c?.complaintId || null,
        title: detailTitle || c?.category || '(ไม่ระบุรายละเอียด)',
        description: [c?.fullName ? `ผู้แจ้ง: ${c.fullName}` : null, c?.community || null].filter(Boolean).join(' · ') || undefined,
        category: c?.category ?? '',
        community: c?.community ?? '',
        // กองของเรื่อง: ที่คัดแยกไว้ → เดาจากประเภท → กองของเจ้าหน้าที่เอง (ใช้จัดกลุ่ม "ตามกอง")
        department: c?.department || defaultDepartmentForCategory(c?.category) || officerDepartment,
        complaintStatus: c?.status ?? '',
        status: derived.isCompleted ? 'completed' : derived.isOverdue ? 'overdue' : 'pending',
        assignedAt: iso(a.assignedAt) ?? new Date(0).toISOString(),
        completedAt: iso(a.completedAt),
        updatedAt: iso(a.updatedAt),
        imageCount: Array.isArray(c?.images) ? c!.images!.length : 0,
        hasLocation: typeof c?.location?.lat === 'number' && typeof c?.location?.lng === 'number',
        badges,
        statusPill,
        coordination: derived.needsCoordination && coord
          ? {
              agencyName: String(coord.agencyName ?? '').trim(),
              coordinatorOrgId: coord.coordinatorOrgId ? String(coord.coordinatorOrgId) : null,
              documentNo: coord.documentNo ?? '',
              sentAt: iso(coord.sentAt),
              nextFollowUpAt: iso(coord.nextFollowUpAt),
              followUpCount: followUps.length,
              lastFollowUpAt: lastFollowUp ? lastFollowUp.toISOString() : null,
            }
          : null,
        blocked: derived.isBlocked && a.blocked
          ? {
              isBlocked: true,
              reason: a.blocked.reason ?? '',
              itemName: a.blocked.itemName ?? '',
              purchaseRefNo: a.blocked.purchaseRefNo ?? '',
              expectedAt: iso(a.blocked.expectedAt),
              since: iso(a.blocked.since) ?? iso(a.slaPausedAt),
            }
          : null,
        actionUrl: `/admin/my-tasks/${String(a._id)}`,
        assignee: scope === 'department' ? { id: String(a.userId), name: namesById.get(String(a.userId)) ?? '' } : null,
        transferRequest: a.transferRequest?.requestedAt
          ? { requestedAt: iso(a.transferRequest.requestedAt) ?? '', reason: a.transferRequest.reason ?? '', byName: a.transferRequest.byName ?? '' }
          : null,
      };
    });

    const kpi = computeKpi(assignments, { now }) as MyKpi;

    // ความพึงพอใจของเจ้าหน้าที่คนนี้ — คะแนนของเรื่องที่เขาถือ นับ "1 ผู้แจ้ง = 1 เสียง" (lib/satisfaction/fairStats.js)
    // อ่านพลาดไม่ทำให้ทั้งหน้าล้ม — ช่องนี้แสดง "–" แทน
    try {
      const complaintIds = assignments.map((a) => a.complaintId).filter((id): id is string => !!id);
      const { ratings, reports } = await loadSatisfactionStatsForComplaints(complaintIds);
      const fair = computeFairStats(ratings, reports);
      kpi.satisfaction = fair.totalRatings > 0 ? fair.averageRating : null;
      kpi.satisfactionCount = fair.totalRatings;
      kpi.satisfactionReporters = fair.reporters;
    } catch (err) {
      console.error('[tasks] satisfaction kpi failed:', err);
    }

    // จัดกลุ่มเฉพาะงานที่ยังเปิด (กลุ่มงานของฉัน = งานที่ถืออยู่) — กรองตามการ์ดเตือนถ้าส่ง alert มา
    const groupByRaw = typeof req.query.groupBy === 'string' ? req.query.groupBy : '';
    const alertRaw = typeof req.query.alert === 'string' ? req.query.alert : '';
    const alert = (ALERT_KINDS as string[]).includes(alertRaw) ? (alertRaw as AlertKind) : null;
    const groups = (GROUP_BY as readonly string[]).includes(groupByRaw)
      ? groupTasks(filterByAlert(assignments.filter((a) => !a.isCompleted), alert), groupByRaw as GroupBy)
      : undefined;

    res.status(200).json({
      success: true,
      now: now.toISOString(),
      officer: {
        id: String(officer._id),
        name: officer.name ?? '',
        department: officerDepartment,
        position: officer.position ?? '',
        role: officer.role ?? 'admin',
      },
      scope,
      permissions: { isSuperAdmin: auth.isSuperAdmin, isHead: perms.isHead, canAssign: perms.canAssign, canTransfer: perms.canTransfer },
      settings,
      kpi,
      assignments,
      ...(groups ? { groups } : {}),
    });
  } catch (error) {
    console.error('Error fetching KPI:', error);
    res.status(500).json({ error: 'Failed to fetch KPI data' });
  }
}
