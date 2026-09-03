// pages/api/complaints/assignments/transfer.ts
// POST { assignmentId, toUserId, reason } — โอน / ส่งต่องานให้เจ้าหน้าที่คนอื่น (README หน้าจอ 1: เหตุผลบังคับกรอก → AuditLog)
// สิทธิ์ (นโยบาย 2026-09-01, lib/tasks/roles.js): **หัวหน้ากอง (งานในกองตัวเอง) หรือ superadmin เท่านั้น** — admin ธรรมดาใช้ "ขอโอนงาน"
// งานที่ปิดแล้วโอนไม่ได้ · ปลายทางต้องเป็นเจ้าหน้าที่ของแอปนี้ที่ยังไม่ถูก archive · โอนแล้วเคลียร์คำขอโอน + แจ้งผู้รับทางกระดิ่ง
import type { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import Assignment from '@/models/Assignment';
import Complaint from '@/models/Complaint';
import Notification from '@/models/Notification';
import { logAuditEvent } from '@/lib/auditLogger';
import { taskPermissions } from '@/lib/tasks/roles';
import { normalizeDepartment, defaultDepartmentForCategory } from '@/lib/tasks/departments';
import { getOfficer, userModel, CURRENT_APP_ID } from '@/pages/api/tasks/_auth';

interface TargetUser {
  _id: mongoose.Types.ObjectId;
  clerkId?: string;
  name?: string;
  department?: string;
  isActive?: boolean;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const auth = await getOfficer(req);
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.message });
  const { officer } = auth;

  const { assignmentId, toUserId } = req.body ?? {};
  const reason = String(req.body?.reason ?? '').trim();
  if (!mongoose.isValidObjectId(assignmentId) || !mongoose.isValidObjectId(toUserId)) {
    return res.status(400).json({ success: false, error: 'ข้อมูลไม่ถูกต้อง' });
  }
  if (!reason) return res.status(400).json({ success: false, error: 'กรุณาระบุเหตุผลการโอนงาน' });
  if (String(toUserId) === String(officer._id)) {
    return res.status(400).json({ success: false, error: 'โอนให้ตัวเองไม่ได้' });
  }

  try {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) return res.status(404).json({ success: false, error: 'ไม่พบงานนี้' });
    if (assignment.completedAt) return res.status(400).json({ success: false, error: 'งานนี้ปิดแล้ว โอนไม่ได้' });

    const complaint = (await Complaint.findById(assignment.complaintId).select('complaintId category department').lean()) as { complaintId?: string; category?: string; department?: string } | null;
    const taskDepartment = normalizeDepartment(complaint?.department) ?? defaultDepartmentForCategory(complaint?.category);
    const isOwner = String(assignment.userId) === String(officer._id);
    const perms = taskPermissions({ isSuperAdmin: auth.isSuperAdmin, user: officer, taskDepartment, isOwner });
    if (!perms.canTransfer) {
      return res.status(403).json({ success: false, error: perms.isHead ? 'โอนได้เฉพาะงานในกองของคุณ' : 'โอนงานได้เฉพาะหัวหน้ากอง/superadmin — ใช้ "ขอโอนงาน" ให้หัวหน้าดำเนินการ' });
    }

    const target = (await userModel()
      .findOne({ _id: toUserId, appId: CURRENT_APP_ID, isArchived: { $ne: true } })
      .select('clerkId name department isActive')
      .lean()) as TargetUser | null;
    if (!target) return res.status(404).json({ success: false, error: 'ไม่พบเจ้าหน้าที่ปลายทาง' });
    if (target.isActive === false) return res.status(400).json({ success: false, error: 'เจ้าหน้าที่ปลายทางถูกระงับการใช้งาน' });

    const fromUserId = String(assignment.userId);
    const now = new Date();
    const hadRequest = !!assignment.transferRequest?.requestedAt;
    assignment.userId = target._id;
    assignment.transferRequest = { requestedAt: null, reason: '', byUserId: null, byName: '' };
    assignment.timeline.push({
      at: now,
      kind: 'transfer',
      text: `โอนงานจาก ${officer.name || 'เจ้าหน้าที่'} ให้ ${target.name || 'เจ้าหน้าที่'}${target.department ? ` (${target.department})` : ''} — เหตุผล: ${reason}`,
      byUserId: officer._id,
      byName: officer.name || '',
    });
    await assignment.save();

    // แจ้งผู้รับงานทางกระดิ่ง (ไม่ใช้ LINE — โควตา)
    if (target.clerkId && target.clerkId !== auth.clerkUserId) {
      Notification.create({
        userId: target.clerkId,
        type: 'complaint_assigned',
        title: `ได้รับโอนงาน ${complaint?.complaintId || String(assignment._id).slice(-8)}`,
        message: `${officer.name || 'หัวหน้ากอง'} โอนงานให้คุณ${hadRequest ? ' (ตามคำขอโอน)' : ''} — เหตุผล: ${reason}`,
        actionUrl: `/admin/my-tasks/${String(assignment._id)}`,
        relatedId: `transfer:${String(assignment._id)}`,
        relatedType: 'assignment',
        priority: 'high',
      }).catch((err: unknown) => console.error('[tasks] notify transfer failed:', err));
    }

    logAuditEvent({
      actorClerkId: auth.clerkUserId,
      actorName: officer.name || 'admin',
      action: 'complaint_reassigned',
      resourceType: 'assignment',
      resourceId: String(assignment._id),
      description: `โอนงาน (assignment ${String(assignment._id).slice(-8)}) ให้ ${target.name || toUserId} — ${reason}`,
      before: { userId: fromUserId },
      after: { userId: String(target._id) },
      meta: { complaintId: String(assignment.complaintId) },
    });

    return res.status(200).json({
      success: true,
      assignment: { _id: String(assignment._id), userId: String(target._id), toUserName: target.name || '' },
    });
  } catch (err) {
    console.error('[tasks] transfer failed:', err);
    return res.status(500).json({ success: false, error: 'โอนงานไม่สำเร็จ' });
  }
}
