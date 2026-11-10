// pages/api/complaints/assignments/release.ts
// POST { assignmentId, reason } — "คืนงานเข้ากองงานรอรับ" (2026-11-10): คนที่กดรับผิดเรื่องคืนเองได้ ไม่ต้องรอหัวหน้าโอน
// กติกาอยู่ที่ lib/tasks/release.js — เจ้าของงาน (หรือ superadmin) + งานยังไม่เริ่มทำ (ขั้นรับเรื่อง ไม่มีผล/ภาพ/ประสาน/รอวัสดุ)
// คืนงาน = ลบ assignment (กองงานรอรับคือเรื่องที่ไม่มี assignment) · ตอนรับเคยย้ายกองไว้ → คืนกองเดิม
// ประวัติ timeline ของงานเก็บไว้ใน audit log (assignment_unclaimed) เพราะ document ถูกลบ
import type { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import Assignment from '@/models/Assignment';
import Complaint from '@/models/Complaint';
import AuditLog from '@/models/AuditLog';
import { logAuditEvent } from '@/lib/auditLogger';
import { releaseCheck, departmentToRestore } from '@/lib/tasks/release';
import { getOfficer } from '@/pages/api/tasks/_auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  const auth = await getOfficer(req);
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.message });
  const { officer } = auth;

  const assignmentId = String(req.body?.assignmentId ?? '');
  const reason = String(req.body?.reason ?? '').trim();
  if (!mongoose.isValidObjectId(assignmentId)) return res.status(400).json({ success: false, error: 'assignmentId ไม่ถูกต้อง' });
  if (!reason) return res.status(400).json({ success: false, error: 'กรุณาระบุเหตุผลที่คืนงาน' });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignment = (await Assignment.findById(assignmentId).lean()) as any;
    const isOwner = !!assignment && String(assignment.userId) === String(officer._id);
    const check = releaseCheck({ assignment, isOwner, isSuperAdmin: auth.isSuperAdmin });
    if (!check.ok) return res.status(assignment ? 400 : 404).json({ success: false, error: check.reason });

    const complaint = (await Complaint.findById(assignment.complaintId).select('complaintId department').lean()) as
      | { complaintId?: string; department?: string }
      | null;
    const code = complaint?.complaintId || String(assignment.complaintId).slice(-8);

    // กองที่ถูกย้ายตอนรับ/โอนงานนี้ (ไม่นับการเลือกกองด้วยมือ)
    const since = new Date(new Date(assignment.assignedAt ?? 0).getTime() - 60_000);
    const moves = (await AuditLog.find({
      action: 'complaint_department_set',
      resourceId: String(assignment.complaintId),
      createdAt: { $gte: since },
      description: /^(รับงานข้ามกอง|โอนงานข้ามกอง)/,
    })
      .sort({ createdAt: -1 })
      .select('before after')
      .lean()) as Array<{ before?: { department?: string }; after?: { department?: string } }>;
    const restore = departmentToRestore({ currentDepartment: complaint?.department ?? null, moves });

    const deleted = await Assignment.deleteOne({ _id: assignmentId, completedAt: null });
    if (!deleted.deletedCount) return res.status(409).json({ success: false, error: 'งานนี้ถูกเปลี่ยนไปแล้ว — รีเฟรชหน้า' });

    if (restore.restore) {
      await Complaint.updateOne({ _id: assignment.complaintId }, { $set: { department: restore.department } });
      logAuditEvent({
        actorClerkId: auth.clerkUserId,
        actorName: officer.name || 'admin',
        action: 'complaint_department_set',
        resourceType: 'complaint',
        resourceId: String(assignment.complaintId),
        description: `คืนงาน — คืนกองเรื่อง ${code}: "${complaint?.department || '-'}" → "${restore.department || '-'}"`,
        before: { department: complaint?.department ?? '' },
        after: { department: restore.department },
      });
    }

    logAuditEvent({
      actorClerkId: auth.clerkUserId,
      actorName: officer.name || 'admin',
      action: 'assignment_unclaimed',
      resourceType: 'assignment',
      resourceId: assignmentId,
      description: `คืนงาน ${code} เข้ากองงานรอรับ — เหตุผล: ${reason}`,
      meta: {
        complaintId: String(assignment.complaintId),
        reason,
        releasedBy: isOwner ? 'owner' : 'superadmin',
        previousUserId: String(assignment.userId),
        timeline: assignment.timeline ?? [],
      },
    });

    return res.status(200).json({ success: true, restoredDepartment: restore.restore ? restore.department : null });
  } catch (err) {
    console.error('[tasks] release failed:', err);
    return res.status(500).json({ success: false, error: 'คืนงานไม่สำเร็จ' });
  }
}
