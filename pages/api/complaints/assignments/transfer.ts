// pages/api/complaints/assignments/transfer.ts
// POST { assignmentId, toUserId, reason } — โอน / ส่งต่องานให้เจ้าหน้าที่คนอื่น (README หน้าจอ 1: เหตุผลบังคับกรอก → AuditLog)
// สิทธิ์: เจ้าของงาน หรือ superadmin · งานที่ปิดแล้วโอนไม่ได้ · ปลายทางต้องเป็นเจ้าหน้าที่ของแอปนี้ที่ยังไม่ถูก archive
import type { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import Assignment from '@/models/Assignment';
import { logAuditEvent } from '@/lib/auditLogger';
import { getOfficer, userModel, CURRENT_APP_ID } from '@/pages/api/tasks/_auth';

interface TargetUser {
  _id: mongoose.Types.ObjectId;
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

    const isOwner = String(assignment.userId) === String(officer._id);
    if (!isOwner && !auth.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'โอนได้เฉพาะงานของตัวเอง' });
    }

    const target = (await userModel()
      .findOne({ _id: toUserId, appId: CURRENT_APP_ID, isArchived: { $ne: true } })
      .lean()) as TargetUser | null;
    if (!target) return res.status(404).json({ success: false, error: 'ไม่พบเจ้าหน้าที่ปลายทาง' });
    if (target.isActive === false) return res.status(400).json({ success: false, error: 'เจ้าหน้าที่ปลายทางถูกระงับการใช้งาน' });

    const fromUserId = String(assignment.userId);
    const now = new Date();
    assignment.userId = target._id;
    assignment.timeline.push({
      at: now,
      kind: 'transfer',
      text: `โอนงานจาก ${officer.name || 'เจ้าหน้าที่'} ให้ ${target.name || 'เจ้าหน้าที่'}${target.department ? ` (${target.department})` : ''} — เหตุผล: ${reason}`,
      byUserId: officer._id,
      byName: officer.name || '',
    });
    await assignment.save();

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
