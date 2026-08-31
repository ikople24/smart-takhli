// pages/api/tasks/settings.ts
// GET  — การตั้งค่า SLA/เกณฑ์เตือน (เจ้าหน้าที่ทุกคนอ่านได้ — UI ใช้ทำ caption "ครบกำหนดภายใน N วัน")
// PUT  — แก้การตั้งค่า (superadmin เท่านั้น) body รับบางฟิลด์ได้ ฟิลด์ที่ไม่ส่งคงเดิม
//        { defaultSlaDays, warnBeforeDays, unclaimedWarnDays, unclaimedAlertDays, followUpEveryDays,
//          slaByCategory: [{ category, slaDays }] }
import type { NextApiRequest, NextApiResponse } from 'next';
import { getTaskSettings, saveTaskSettings } from '@/lib/tasks/loadSettings';
import { logAuditEvent } from '@/lib/auditLogger';
import { getOfficer, requireSuperAdmin } from './_auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const auth = await getOfficer(req);
    if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.message });
    const settings = await getTaskSettings();
    return res.status(200).json({ success: true, settings });
  }

  if (req.method === 'PUT') {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.message });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    try {
      const before = await getTaskSettings();
      const settings = await saveTaskSettings(body, auth.clerkUserId);
      logAuditEvent({
        actorClerkId: auth.clerkUserId,
        actorName: 'superadmin',
        action: 'task_settings_updated',
        resourceType: 'system',
        resourceId: 'task_settings',
        description: 'แก้การตั้งค่า SLA/เกณฑ์เตือนงานเจ้าหน้าที่',
        before,
        after: settings,
      });
      return res.status(200).json({ success: true, settings });
    } catch (err) {
      console.error('[tasks] save settings failed:', err);
      return res.status(500).json({ success: false, error: 'บันทึกการตั้งค่าไม่สำเร็จ' });
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
