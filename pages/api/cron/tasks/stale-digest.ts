// pages/api/cron/tasks/stale-digest.ts
// cron ตอนเช้า (แนะนำ 30 1 * * * UTC = 08:30 Asia/Bangkok): เรื่องค้างไม่มีคนรับเกินเกณฑ์ → แจ้งเตือนในระบบ (กระดิ่ง)
// ถึงหัวหน้ากองที่เกี่ยวข้อง — 1 รายการ/กอง/วัน (dedupe ด้วย relatedId) · ไม่ส่ง LINE (โควตา)
// ป้องกันด้วย CRON_SECRET (header x-cron-secret หรือ ?secret=) — ห้ามใส่ Clerk
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireCronSecret } from '@/lib/pm25CronAuth';
import Notification from '@/models/Notification';
import { getTaskSettings } from '@/lib/tasks/loadSettings';
import { loadPoolItems } from '@/lib/tasks/loadPool';
import { buildStaleDigest, digestRecipients } from '@/lib/tasks/digest';
import { bangkokDateKey } from '@/lib/tasks/format';
import { userModel, CURRENT_APP_ID } from '@/pages/api/tasks/_auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });
  const gate = requireCronSecret(req);
  if (!gate.ok) return res.status(gate.status ?? 401).json({ success: false, error: gate.message });

  try {
    const now = new Date();
    const settings = await getTaskSettings();
    const { items } = await loadPoolItems({ settings, now, days: null });
    const digest = buildStaleDigest(items, { unclaimedAlertDays: settings.unclaimedAlertDays, dateKey: bangkokDateKey(now) ?? '' });
    if (!digest.length) return res.status(200).json({ success: true, created: 0, groups: 0, message: 'ไม่มีเรื่องค้างเกินเกณฑ์' });

    const users = await userModel().find({ appId: CURRENT_APP_ID, isArchived: { $ne: true } }).select('clerkId department position role isActive isDepartmentHead').lean();
    let created = 0;
    for (const entry of digest) {
      const recipients = digestRecipients(users, entry.department);
      for (const clerkId of recipients) {
        const exists = await Notification.exists({ userId: clerkId, relatedId: entry.relatedId });
        if (exists) continue;
        await Notification.create({
          userId: clerkId,
          type: 'admin_alert',
          title: entry.title,
          message: entry.message,
          actionUrl: entry.actionUrl,
          relatedId: entry.relatedId,
          priority: entry.urgentCount > 0 ? 'urgent' : 'high',
        });
        created += 1;
      }
    }
    return res.status(200).json({ success: true, created, groups: digest.length, digest: digest.map((d) => ({ department: d.department, count: d.count, maxDays: d.maxDays })) });
  } catch (err) {
    console.error('[cron] stale-digest failed:', err);
    return res.status(500).json({ success: false, error: 'stale-digest failed' });
  }
}
