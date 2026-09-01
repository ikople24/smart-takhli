// pages/api/complaints/assignments/[id]/index.ts
// DELETE — "เลิกทำ" การรับงาน (toast undo 5 วินาทีในกองงานรอรับ) · ลบได้เฉพาะงานของตัวเองที่เพิ่งรับ
// (ภายใน UNDO_WINDOW_MIN นาที) และยังไม่มีความคืบหน้าใด ๆ (timeline มีแค่ 'created', ไม่มี completedAt)
import type { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import Assignment from '@/models/Assignment';
import { logAuditEvent } from '@/lib/auditLogger';
import { getOfficer } from '@/pages/api/tasks/_auth';

const UNDO_WINDOW_MIN = 15;

interface AssignmentLean {
  userId: unknown;
  complaintId: unknown;
  assignedAt: Date;
  completedAt?: Date | null;
  timeline?: unknown[];
  solution?: string[];
  note?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  const auth = await getOfficer(req);
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.message });
  const { officer } = auth;

  const { id } = req.query;
  if (typeof id !== 'string' || !mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, error: 'id ไม่ถูกต้อง' });

  try {
    const assignment = (await Assignment.findById(id).lean()) as AssignmentLean | null;
    if (!assignment) return res.status(404).json({ success: false, error: 'ไม่พบงานนี้' });
    const isOwner = String(assignment.userId) === String(officer._id);
    if (!isOwner && !auth.isSuperAdmin) return res.status(403).json({ success: false, error: 'เลิกทำได้เฉพาะงานของตัวเอง' });
    if (assignment.completedAt) return res.status(400).json({ success: false, error: 'งานนี้ปิดแล้ว' });
    const ageMin = (Date.now() - new Date(assignment.assignedAt).getTime()) / 60000;
    const hasProgress = (assignment.timeline?.length ?? 0) > 1 || (assignment.solution?.length ?? 0) > 0 || !!assignment.note;
    if (ageMin > UNDO_WINDOW_MIN || hasProgress) {
      return res.status(400).json({ success: false, error: 'เลยช่วงเลิกทำแล้ว — ใช้ "โอน / ส่งต่องาน" แทน' });
    }

    await Assignment.deleteOne({ _id: id });
    logAuditEvent({
      actorClerkId: auth.clerkUserId,
      actorName: officer.name || 'admin',
      action: 'assignment_unclaimed',
      resourceType: 'assignment',
      resourceId: id,
      description: `เลิกทำการรับงาน (assignment ${id.slice(-8)}) — เรื่องกลับเข้ากองงานรอรับ`,
      meta: { complaintId: String(assignment.complaintId) },
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[tasks] unclaim failed:', err);
    return res.status(500).json({ success: false, error: 'เลิกทำไม่สำเร็จ' });
  }
}
