// pages/api/tasks/[assignmentId].ts
// หน้าจอ 3 "รายละเอียดงาน + อัปเดตความคืบหน้า" (README)
//   GET   — เรื่อง + assignment + derived + ไทม์ไลน์ + ตัวเลือกวิธีแก้ไข (AdminOption ของประเภทนั้น)
//   PATCH — { action: 'progress' | 'close' | 'blocked', ... } เฉพาะเจ้าของงาน / superadmin
//     progress: { note?, images?, stage?, reason? } บันทึกความคืบหน้า และ/หรือ เลื่อนขั้น (ถอยขั้นต้องมี reason)
//     close:    { note, images (≥1), solution? } ปิดเรื่อง → assignment.completedAt + status เรื่อง + แจ้ง LINE (lib/complaintNotify.js)
//     blocked:  { on, itemName?, purchaseRefNo?, expectedAt?, reason? } พัก/เลิกพัก SLA (lib/tasks/timeline.js#blockedUpdate)
// การประสานงาน (set/follow_up/notify_line) ใช้ POST /api/complaints/coordination · โอนงานใช้ assignments/transfer
import type { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import Assignment from '@/models/Assignment';
import Complaint from '@/models/Complaint';
import AdminOption from '@/models/AdminOption';
import { logAuditEvent } from '@/lib/auditLogger';
import { notifyComplaintStatusChanged } from '@/lib/complaintNotify';
import { getTaskSettings } from '@/lib/tasks/loadSettings';
import { deriveAssignment } from '@/lib/tasks/derived';
import { badgesForAssignment, statusPillFor } from '@/lib/tasks/badges';
import { buildTimeline, closeChecklist, stageChangePlan, blockedUpdate } from '@/lib/tasks/timeline';
import { STAGE_LABELS, COMPLAINT_STATUS } from '@/lib/tasks/status';
import { summarizeText, toDate } from '@/lib/tasks/format';
import { defaultDepartmentForCategory, normalizeDepartment } from '@/lib/tasks/departments';
import { taskPermissions } from '@/lib/tasks/roles';
import type { Badge, DerivedAssignment, Stage, StatusPill, TaskDetailResponse, TimelineEntry } from '@/lib/tasks/types';
import { getOfficer, userModel } from './_auth';

const iso = (v: unknown): string | null => {
  const d = toDate(v);
  return d ? d.toISOString() : null;
};
const str = (v: unknown) => String(v ?? '').trim();
const httpsList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((u): u is string => typeof u === 'string' && u.startsWith('https://')) : []);

interface ComplaintLean {
  _id: mongoose.Types.ObjectId;
  complaintId?: string;
  fullName?: string;
  phone?: string;
  detail?: string;
  category?: string;
  community?: string;
  problems?: string[];
  images?: string[];
  location?: { lat?: number; lng?: number };
  createdAt?: Date;
  updatedAt?: Date;
  status?: string;
  department?: string;
  isConfidential?: boolean;
  pdpaSensitive?: boolean;
  lineUserId?: string | null;
}

const COMPLAINT_FIELDS =
  'complaintId fullName phone detail category community problems images location createdAt updatedAt status department isConfidential pdpaSensitive lineUserId';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await getOfficer(req);
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.message });
  const { officer } = auth;
  const { assignmentId } = req.query;
  if (typeof assignmentId !== 'string' || !mongoose.isValidObjectId(assignmentId)) {
    return res.status(400).json({ success: false, error: 'id ไม่ถูกต้อง' });
  }

  try {
    const now = new Date();

    /* ───────── GET ───────── */
    if (req.method === 'GET') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = (await Assignment.findById(assignmentId).lean()) as any;
      if (!a) return res.status(404).json({ success: false, error: 'ไม่พบงานนี้' });
      const [c, assignee, settings] = await Promise.all([
        Complaint.findById(a.complaintId).select(COMPLAINT_FIELDS).lean() as Promise<ComplaintLean | null>,
        userModel().findById(a.userId).select('name department position').lean() as Promise<{ _id: unknown; name?: string; department?: string; position?: string } | null>,
        getTaskSettings(),
      ]);
      const derived = deriveAssignment({ assignment: a, complaint: c ?? {}, settings, now }) as DerivedAssignment;
      const isOwner = String(a.userId) === String(officer._id);
      const canEdit = isOwner || auth.isSuperAdmin;
      const taskDepartment = normalizeDepartment(c?.department) ?? defaultDepartmentForCategory(c?.category ?? '');
      const perms = taskPermissions({ isSuperAdmin: auth.isSuperAdmin, user: officer, taskDepartment, isOwner });
      const timeline = buildTimeline({ complaint: c ?? {}, assignment: a, derived, officerName: assignee?.name }) as TimelineEntry[];
      const category = c?.category ?? '';
      // ตัวเลือกของประเภทนี้ + ค่าที่เรื่องนี้เคยเลือกไว้ (เหมือน UpdateAssignmentModal เดิม — ประเภทเรื่องอาจถูกแก้ทีหลัง)
      const chosen = Array.isArray(a.solution) ? a.solution : [];
      const options = (await AdminOption.find(
        category ? { $or: [{ menu_category: category }, { label: { $in: chosen } }] } : { label: { $in: chosen } }
      )
        .select('label icon_url active')
        .lean()) as unknown as Array<{ _id: unknown; label: string; icon_url?: string; active?: boolean }>;
      const coord = a.coordination ?? {};
      const followUps: Array<{ at?: Date }> = Array.isArray(coord.followUps) ? coord.followUps : [];
      const lastFollowUp = followUps.reduce((best: Date | null, f) => {
        const d = toDate(f?.at);
        return d && (!best || d > best) ? d : best;
      }, null as Date | null);

      const payload: TaskDetailResponse = {
        success: true,
        now: now.toISOString(),
        canEdit,
        canTransfer: perms.canTransfer,
        canRequestTransfer: perms.canRequestTransfer,
        transferRequest: a.transferRequest?.requestedAt
          ? { requestedAt: iso(a.transferRequest.requestedAt) ?? '', reason: a.transferRequest.reason ?? '', byName: a.transferRequest.byName ?? '' }
          : null,
        settings,
        assignment: {
          _id: String(a._id),
          stage: derived.stage,
          role: derived.role,
          assignedAt: iso(a.assignedAt) ?? new Date(0).toISOString(),
          completedAt: iso(a.completedAt),
          updatedAt: iso(a.updatedAt),
          dueDate: derived.dueDate,
          slaPausedAt: iso(a.slaPausedAt),
          note: a.note ?? '',
          solution: Array.isArray(a.solution) ? a.solution : [],
          solutionImages: Array.isArray(a.solutionImages) ? a.solutionImages : [],
          coordination: str(coord.agencyName)
            ? {
                agencyName: str(coord.agencyName),
                coordinatorOrgId: coord.coordinatorOrgId ? String(coord.coordinatorOrgId) : null,
                documentNo: coord.documentNo ?? '',
                sentAt: iso(coord.sentAt),
                nextFollowUpAt: iso(coord.nextFollowUpAt),
                followUpCount: followUps.length,
                lastFollowUpAt: lastFollowUp ? lastFollowUp.toISOString() : null,
              }
            : null,
          blocked: a.blocked?.isBlocked
            ? {
                isBlocked: true,
                reason: a.blocked.reason ?? '',
                itemName: a.blocked.itemName ?? '',
                purchaseRefNo: a.blocked.purchaseRefNo ?? '',
                expectedAt: iso(a.blocked.expectedAt),
                since: iso(a.blocked.since) ?? iso(a.slaPausedAt),
              }
            : null,
          assignee: assignee ? { id: String(assignee._id), name: assignee.name ?? '', department: assignee.department ?? '', position: assignee.position ?? '' } : null,
        },
        complaint: {
          _id: c ? String(c._id) : String(a.complaintId),
          code: c?.complaintId || null,
          title: summarizeText(c?.detail, 120) || category || '(ไม่ระบุรายละเอียด)',
          detail: c?.detail ?? '',
          category,
          community: c?.community ?? '',
          problems: Array.isArray(c?.problems) ? c!.problems! : [],
          images: Array.isArray(c?.images) ? c!.images! : [],
          location: typeof c?.location?.lat === 'number' && typeof c?.location?.lng === 'number' ? { lat: c.location.lat, lng: c.location.lng } : null,
          createdAt: iso(c?.createdAt),
          updatedAt: iso(c?.updatedAt),
          status: c?.status ?? '',
          department: normalizeDepartment(c?.department) ?? defaultDepartmentForCategory(category),
          // ปลายทางเป็นเจ้าหน้าที่ผู้รับผิดชอบ — ต้องเห็นชื่อ/เบอร์เต็มเพื่อติดต่อ (ต่างจากหน้า /status สาธารณะที่ mask)
          reporterName: c?.fullName ?? '',
          reporterPhone: c?.phone ?? '',
          isConfidential: !!c?.isConfidential,
          pdpaSensitive: !!c?.pdpaSensitive,
          hasLine: !!c?.lineUserId,
        },
        derived,
        badges: badgesForAssignment(derived) as Badge[],
        statusPill: statusPillFor(derived) as StatusPill,
        timeline,
        solutionOptions: options.filter((o) => o.active !== false).map((o) => ({ _id: String(o._id), label: o.label, iconUrl: o.icon_url })),
      };
      return res.status(200).json(payload);
    }

    /* ───────── PATCH ───────── */
    if (req.method !== 'PATCH') {
      res.setHeader('Allow', 'GET, PATCH');
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignment = (await Assignment.findById(assignmentId)) as any;
    if (!assignment) return res.status(404).json({ success: false, error: 'ไม่พบงานนี้' });
    const isOwner = String(assignment.userId) === String(officer._id);
    if (!isOwner && !auth.isSuperAdmin) return res.status(403).json({ success: false, error: 'แก้ไขได้เฉพาะงานของตัวเอง' });
    if (assignment.completedAt) return res.status(400).json({ success: false, error: 'งานนี้ปิดแล้ว' });

    const complaint = (await Complaint.findById(assignment.complaintId).select(COMPLAINT_FIELDS).lean()) as ComplaintLean | null;
    const body = req.body ?? {};
    const action = str(body.action);
    const byName = officer.name || '';
    const audit = (params: Parameters<typeof logAuditEvent>[0]) => logAuditEvent(params);

    const setComplaintStatus = async (status: string) => {
      if (!complaint || complaint.status === status) return;
      await Complaint.updateOne({ _id: complaint._id }, { $set: { status, updatedAt: now } });
      audit({
        actorClerkId: auth.clerkUserId,
        actorName: byName || 'admin',
        action: 'complaint_status_changed',
        resourceType: 'complaint',
        resourceId: String(complaint._id),
        description: `สถานะเรื่องร้องเรียนเปลี่ยนจาก "${complaint.status ?? ''}" เป็น "${status}" (จากหน้างานเจ้าหน้าที่)`,
        before: { status: complaint.status ?? '' },
        after: { status },
      });
      notifyComplaintStatusChanged({
        existing: complaint,
        updated: { complaintId: complaint.complaintId, updatedAt: now },
        status,
        closingAssignment: status === COMPLAINT_STATUS.DONE ? assignment.toObject() : null,
      });
    };

    if (action === 'progress') {
      const note = str(body.note);
      const images = httpsList(body.images);
      const stage = str(body.stage) as Stage | '';
      const reason = str(body.reason);
      // วิธีการแก้ไข (chip AdminOption) — ส่งมาเฉพาะตอนเปลี่ยน แทนที่ค่าเดิมทั้งชุด (พฤติกรรมเดียวกับ modal เดิม)
      const solution = Array.isArray(body.solution) ? body.solution.map((v: unknown) => str(v)).filter(Boolean) : null;
      if (!note && !images.length && !stage && solution === null) return res.status(400).json({ success: false, error: 'ไม่มีอะไรให้บันทึก' });

      let plan: ReturnType<typeof stageChangePlan> | null = null;
      if (stage) {
        plan = stageChangePlan(assignment.stage ?? 'received', stage);
        if (!plan.ok) return res.status(400).json({ success: false, error: plan.reason ?? 'เปลี่ยนขั้นไม่ได้' });
        if (plan.needsReason && !reason) return res.status(400).json({ success: false, error: 'ถอยขั้นต้องระบุเหตุผล' });
        if (plan.closes) return res.status(400).json({ success: false, error: 'ปิดเรื่องผ่านปุ่ม "ปิดเรื่อง" (ต้องมีภาพผลงาน + บันทึกสรุป)' });
      }
      if (solution !== null) assignment.solution = solution;
      if (note || images.length || solution !== null) {
        const solutionText = solution !== null ? `วิธีแก้ไข: ${solution.join(', ') || '—'}` : '';
        const text = [note, solutionText].filter(Boolean).join(' · ') || 'แนบภาพความคืบหน้า';
        assignment.timeline.push({ at: now, kind: 'note', text, images, byUserId: officer._id, byName });
      }
      if (stage && plan) {
        assignment.stage = stage;
        assignment.timeline.push({ at: now, kind: 'stage', stage, text: reason ? `เหตุผล: ${reason}` : '', byUserId: officer._id, byName });
      }
      await assignment.save();
      if (plan) await setComplaintStatus(plan.complaintStatus);
      return res.status(200).json({ success: true, stage: assignment.stage, stageLabel: STAGE_LABELS[assignment.stage as Stage] });
    }

    if (action === 'close') {
      const note = str(body.note);
      const images = httpsList(body.images);
      const check = closeChecklist({ note, images });
      if (!check.ok) return res.status(400).json({ success: false, error: check.errors.join(' · '), errors: check.errors });
      const solution = Array.isArray(body.solution) ? body.solution.map(String).filter(Boolean) : [];

      assignment.completedAt = now;
      assignment.stage = 'closed';
      assignment.note = note;
      if (solution.length) assignment.solution = solution;
      assignment.solutionImages = [...new Set([...(assignment.solutionImages ?? []), ...images])];
      assignment.timeline.push({ at: now, kind: 'closed', text: `ปิดเรื่อง — ${note}`, images, byUserId: officer._id, byName });
      await assignment.save();

      const assignedAt = toDate(assignment.assignedAt);
      const resolutionDays = assignedAt ? Math.round((now.getTime() - assignedAt.getTime()) / 86400000) : 0;
      audit({
        actorClerkId: auth.clerkUserId,
        actorName: byName || 'admin',
        action: 'assignment_completed',
        resourceType: 'assignment',
        resourceId: String(assignment._id),
        description: `ปิดเรื่องจากหน้างานเจ้าหน้าที่ (assignment ${String(assignment._id).slice(-8)}) ใช้เวลา ${resolutionDays} วัน`,
      });
      await setComplaintStatus(COMPLAINT_STATUS.DONE);
      return res.status(200).json({ success: true, completedAt: now.toISOString() });
    }

    if (action === 'blocked') {
      const on = body.on === true || body.on === 'true';
      const update = blockedUpdate(assignment.toObject(), {
        on,
        itemName: body.itemName,
        purchaseRefNo: body.purchaseRefNo,
        expectedAt: body.expectedAt,
        reason: body.reason,
        now,
      });
      assignment.blocked = update.set.blocked;
      assignment.slaPausedAt = update.set.slaPausedAt;
      assignment.slaPausedMs = update.set.slaPausedMs;
      assignment.timeline.push({ ...update.timelineEntry, byUserId: officer._id, byName });
      await assignment.save();
      return res.status(200).json({ success: true, blocked: assignment.blocked, slaPausedAt: iso(assignment.slaPausedAt) });
    }

    return res.status(400).json({ success: false, error: 'action ไม่ถูกต้อง' });
  } catch (err) {
    console.error('[tasks] task detail failed:', err);
    return res.status(500).json({ success: false, error: 'ดำเนินการไม่สำเร็จ' });
  }
}
