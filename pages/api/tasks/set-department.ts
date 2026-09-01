// pages/api/tasks/set-department.ts
// PATCH { complaintId, department } — คัดแยกกองให้เรื่อง (README: "เลือกกอง" ในคอลัมน์ยังไม่ระบุกอง) · department '' = ล้างค่า
// ค่าเก็บเป็นชื่อกองมาตรฐานจาก lib/tasks/departments.js เท่านั้น
// ⚠️ ไม่วางไว้ที่ /api/complaints/[id]/department ตาม README เพราะ pages/api/complaints มี [id_card].js อยู่แล้ว —
//    Next.js ห้าม slug ต่างชื่อใน path เดียวกัน (dev server ล้มทั้งตัว)
import type { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import Complaint from '@/models/Complaint';
import { logAuditEvent } from '@/lib/auditLogger';
import { normalizeDepartment } from '@/lib/tasks/departments';
import { requirePage } from './_auth';
import { PAGE_PATH } from './pool';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  const auth = await requirePage(req, PAGE_PATH);
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.message });

  const complaintId = String(req.body?.complaintId ?? '');
  if (!mongoose.isValidObjectId(complaintId)) return res.status(400).json({ success: false, error: 'complaintId ไม่ถูกต้อง' });
  const raw = String(req.body?.department ?? '').trim();
  const department = raw ? normalizeDepartment(raw) : '';
  if (department === null) return res.status(400).json({ success: false, error: 'ไม่รู้จักชื่อกองนี้' });

  try {
    const before = (await Complaint.findById(complaintId).select('department complaintId').lean()) as { complaintId?: string; department?: string } | null;
    if (!before) return res.status(404).json({ success: false, error: 'ไม่พบเรื่องนี้' });
    await Complaint.updateOne({ _id: complaintId }, { $set: { department } });
    logAuditEvent({
      actorClerkId: auth.clerkUserId,
      actorName: auth.officer.name || 'admin',
      action: 'complaint_department_set',
      resourceType: 'complaint',
      resourceId: complaintId,
      description: `คัดแยกกองเรื่อง ${before.complaintId || complaintId.slice(-8)}: "${before.department || '-'}" → "${department || '-'}"`,
      before: { department: before.department ?? '' },
      after: { department },
    });
    return res.status(200).json({ success: true, department });
  } catch (err) {
    console.error('[tasks] set department failed:', err);
    return res.status(500).json({ success: false, error: 'บันทึกกองไม่สำเร็จ' });
  }
}
