// pages/api/complaints/assignments/transfer-request.ts
// POST   { assignmentId, reason } — เจ้าของงาน (ที่โอนเองไม่ได้) ขอให้หัวหน้ากองโอนงาน → แจ้งเตือนในระบบถึงหัวหน้ากอง/superadmin
// DELETE ?assignmentId= — ยกเลิก/ปฏิเสธคำขอ (เจ้าของ, หัวหน้ากอง, superadmin)
// นโยบาย: lib/tasks/roles.js — admin ธรรมดาโอนกันเองไม่ได้ ต้องผ่านหัวหน้า
import type { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import Assignment from '@/models/Assignment';
import Complaint from '@/models/Complaint';
import Notification from '@/models/Notification';
import { logAuditEvent } from '@/lib/auditLogger';
import { taskPermissions } from '@/lib/tasks/roles';
import { digestRecipients } from '@/lib/tasks/digest';
import { normalizeDepartment, defaultDepartmentForCategory } from '@/lib/tasks/departments';
import { getOfficer, userModel, CURRENT_APP_ID } from '@/pages/api/tasks/_auth';

const str = (v: unknown) => String(v ?? '').trim();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await getOfficer(req);
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.message });
  const { officer } = auth;

  const assignmentId = req.method === 'DELETE' ? String(req.query.assignmentId ?? '') : String(req.body?.assignmentId ?? '');
  if (!mongoose.isValidObjectId(assignmentId)) return res.status(400).json({ success: false, error: 'assignmentId ไม่ถูกต้อง' });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignment = (await Assignment.findById(assignmentId)) as any;
    if (!assignment) return res.status(404).json({ success: false, error: 'ไม่พบงานนี้' });
    if (assignment.completedAt) return res.status(400).json({ success: false, error: 'งานนี้ปิดแล้ว' });
    const complaint = (await Complaint.findById(assignment.complaintId).select('complaintId category department').lean()) as { complaintId?: string; category?: string; department?: string } | null;
    const taskDepartment = normalizeDepartment(complaint?.department) ?? defaultDepartmentForCategory(complaint?.category);
    const isOwner = String(assignment.userId) === String(officer._id);
    const perms = taskPermissions({ isSuperAdmin: auth.isSuperAdmin, user: officer, taskDepartment, isOwner });
    const code = complaint?.complaintId || assignmentId.slice(-8);
    const now = new Date();

    if (req.method === 'DELETE') {
      if (!isOwner && !perms.canTransfer) return res.status(403).json({ success: false, error: 'ยกเลิกได้เฉพาะเจ้าของงานหรือหัวหน้ากอง' });
      if (!assignment.transferRequest?.requestedAt) return res.status(400).json({ success: false, error: 'ไม่มีคำขอโอนค้างอยู่' });
      assignment.transferRequest = { requestedAt: null, reason: '', byUserId: null, byName: '' };
      assignment.timeline.push({ at: now, kind: 'transfer', text: isOwner ? 'ยกเลิกคำขอโอนงาน' : `หัวหน้าปฏิเสธคำขอโอนงาน (${officer.name || 'หัวหน้ากอง'})`, byUserId: officer._id, byName: officer.name || '' });
      await assignment.save();
      return res.status(200).json({ success: true });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, DELETE');
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
    if (!isOwner) return res.status(403).json({ success: false, error: 'ขอโอนได้เฉพาะเจ้าของงาน' });
    if (perms.canTransfer) return res.status(400).json({ success: false, error: 'คุณโอนงานได้เองอยู่แล้ว — ใช้ปุ่ม "โอน / ส่งต่องาน"' });
    const reason = str(req.body?.reason);
    if (!reason) return res.status(400).json({ success: false, error: 'กรุณาระบุเหตุผลที่ขอโอน' });
    if (assignment.transferRequest?.requestedAt) return res.status(400).json({ success: false, error: 'มีคำขอโอนค้างอยู่แล้ว รอหัวหน้ากองดำเนินการ' });

    assignment.transferRequest = { requestedAt: now, reason, byUserId: officer._id, byName: officer.name || '' };
    assignment.timeline.push({ at: now, kind: 'transfer', text: `ขอโอนงาน — เหตุผล: ${reason}`, byUserId: officer._id, byName: officer.name || '' });
    await assignment.save();

    // แจ้งหัวหน้ากองของงานนี้ (ไม่มี → หัวหน้าทุกกอง + superadmin) ทางกระดิ่งในระบบ
    const users = await userModel().find({ appId: CURRENT_APP_ID, isArchived: { $ne: true } }).select('clerkId department position role isActive isDepartmentHead').lean();
    const recipients = digestRecipients(users, taskDepartment).filter((clerkId) => clerkId !== auth.clerkUserId);
    if (recipients.length) {
      await Notification.insertMany(
        recipients.map((clerkId) => ({
          userId: clerkId,
          type: 'admin_alert',
          title: `ขอโอนงาน ${code}`,
          message: `${officer.name || 'เจ้าหน้าที่'}${officer.department ? ` (${officer.department})` : ''} ขอโอนงาน — เหตุผล: ${reason}`,
          actionUrl: `/admin/my-tasks/${assignmentId}`,
          relatedId: `transfer-request:${assignmentId}`,
          relatedType: 'assignment',
          priority: 'high',
        }))
      );
    }
    logAuditEvent({
      actorClerkId: auth.clerkUserId,
      actorName: officer.name || 'admin',
      action: 'assignment_transfer_requested',
      resourceType: 'assignment',
      resourceId: assignmentId,
      description: `ขอโอนงาน ${code} — ${reason} (แจ้ง ${recipients.length} คน)`,
    });
    return res.status(200).json({ success: true, notified: recipients.length });
  } catch (err) {
    console.error('[tasks] transfer-request failed:', err);
    return res.status(500).json({ success: false, error: 'ดำเนินการไม่สำเร็จ' });
  }
}
