// pages/api/tasks/heads.ts
// PUT { userId, isDepartmentHead: boolean | null } — superadmin ติ๊ก "หัวหน้ากอง" ให้ user (null = ล้างค่า กลับไปดูจากตำแหน่ง)
// GET — รายชื่อ user ของแอปพร้อมสถานะหัวหน้า (ตั้งค่าและตำแหน่ง fallback) สำหรับแผงตั้งค่าในหน้ากองงานรอรับ
// (ที่นี่ชั่วคราวจนกว่าหน้าจัดการผู้ใช้ของ superadmin จะรีดีไซน์เสร็จ — ค่อยย้ายปุ่มไปที่นั่น)
import type { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import { logAuditEvent } from '@/lib/auditLogger';
import { isDepartmentHead, HEAD_POSITION_RE } from '@/lib/tasks/roles';
import { normalizeDepartment } from '@/lib/tasks/departments';
import { getOfficer, requireSuperAdmin, userModel, CURRENT_APP_ID } from './_auth';

interface UserLean {
  _id: mongoose.Types.ObjectId;
  clerkId?: string;
  name?: string;
  department?: string;
  position?: string;
  role?: string;
  isActive?: boolean;
  isArchived?: boolean;
  isDepartmentHead?: boolean;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const auth = await getOfficer(req);
    if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.message });
    const users = (await userModel()
      .find({ appId: CURRENT_APP_ID, isArchived: { $ne: true } })
      .select('clerkId name department position role isActive isDepartmentHead')
      .sort({ department: 1, name: 1 })
      .lean()) as UserLean[];
    return res.status(200).json({
      success: true,
      users: users.map((u) => ({
        _id: String(u._id),
        name: u.name ?? '',
        department: u.department ?? '',
        canonicalDepartment: normalizeDepartment(u.department),
        position: u.position ?? '',
        role: u.role ?? 'admin',
        isActive: u.isActive !== false,
        /** ค่าที่ superadmin ตั้ง (undefined = ยังไม่ตั้ง) */
        isDepartmentHead: typeof u.isDepartmentHead === 'boolean' ? u.isDepartmentHead : null,
        /** ผลจริงหลังรวม fallback ตำแหน่ง */
        effectiveHead: isDepartmentHead(u),
        headByPosition: HEAD_POSITION_RE.test(String(u.position ?? '')),
      })),
    });
  }

  if (req.method === 'PUT') {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.message });
    const { userId, isDepartmentHead: flag } = req.body ?? {};
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ success: false, error: 'userId ไม่ถูกต้อง' });
    if (flag !== true && flag !== false && flag !== null) return res.status(400).json({ success: false, error: 'isDepartmentHead ต้องเป็น true/false/null' });
    try {
      const update = flag === null ? { $unset: { isDepartmentHead: 1 } } : { $set: { isDepartmentHead: flag } };
      const user = (await userModel().findOneAndUpdate({ _id: userId, appId: CURRENT_APP_ID }, update, { new: true }).lean()) as UserLean | null;
      if (!user) return res.status(404).json({ success: false, error: 'ไม่พบผู้ใช้' });
      logAuditEvent({
        actorClerkId: auth.clerkUserId,
        actorName: 'superadmin',
        action: 'department_head_set',
        resourceType: 'user',
        resourceId: String(user._id),
        description: `${flag === null ? 'ล้างค่า' : flag ? 'ตั้ง' : 'ยกเลิก'}หัวหน้ากอง: ${user.name || userId}${user.department ? ` (${user.department})` : ''}`,
        after: { isDepartmentHead: flag },
      });
      return res.status(200).json({ success: true, isDepartmentHead: flag, effectiveHead: isDepartmentHead(user) });
    } catch (err) {
      console.error('[tasks] set head failed:', err);
      return res.status(500).json({ success: false, error: 'บันทึกไม่สำเร็จ' });
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
