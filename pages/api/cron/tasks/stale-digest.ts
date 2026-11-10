// pages/api/cron/tasks/stale-digest.ts
// cron ตอนเช้า (แนะนำ 30 1 * * * UTC = 08:30 Asia/Bangkok): เรื่องค้างไม่มีคนรับเกินเกณฑ์ → แจ้งเตือนในระบบ (กระดิ่ง)
// ถึงหัวหน้ากองที่เกี่ยวข้อง — 1 รายการ/กอง/วัน (dedupe ด้วย relatedId)
// + ส่ง LINE กลุ่มเจ้าหน้าที่วันละครั้ง (เปิดอีกครั้ง 2026-11-09 หลังอัปเกรด LINE OA Starter) — dedupe ด้วย audit log
//   ของวันนั้น (cron ยิงซ้ำ/retry ไม่ส่งซ้ำ) · ส่งไม่สำเร็จ (ไม่ตั้ง groupId / โควตาเต็ม) ไม่ทำให้ cron ล้ม
// ป้องกันด้วย CRON_SECRET (header x-cron-secret หรือ ?secret=) — ห้ามใส่ Clerk
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireCronSecret } from '@/lib/pm25CronAuth';
import Notification from '@/models/Notification';
import { getTaskSettings } from '@/lib/tasks/loadSettings';
import { loadPoolItems } from '@/lib/tasks/loadPool';
import { buildStaleDigest, buildStaleLineText, digestRecipients } from '@/lib/tasks/digest';
import AuditLog from '@/models/AuditLog';
import { logAuditEvent } from '@/lib/auditLogger';
import { lineNotifyAdminGroup } from '@/lib/lineMessaging';
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
    const dateKey = bangkokDateKey(now) ?? '';
    const digest = buildStaleDigest(items, { unclaimedAlertDays: settings.unclaimedAlertDays, dateKey });
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

    // LINE กลุ่ม — วันละครั้ง
    let line: 'sent' | 'already_sent' | 'failed' | 'skipped' = 'skipped';
    const lineMarker = `stale-digest-line:${dateKey}`;
    const text = buildStaleLineText(items, {
      unclaimedAlertDays: settings.unclaimedAlertDays,
      footer: '(สรุปอัตโนมัติทุกเช้า)',
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    });
    if (text && dateKey) {
      if (await AuditLog.exists({ action: 'notification_sent', resourceId: lineMarker })) {
        line = 'already_sent';
      } else if (await lineNotifyAdminGroup([{ type: 'text', text }])) {
        line = 'sent';
        await logAuditEvent({
          actorClerkId: 'cron',
          actorName: 'cron',
          action: 'notification_sent',
          resourceType: 'system',
          resourceId: lineMarker,
          description: `แจ้ง LINE กลุ่มอัตโนมัติ — เรื่องค้างไม่มีคนรับ ${digest.reduce((n, d) => n + d.count, 0)} เรื่อง`,
        });
      } else {
        line = 'failed';
      }
    }
    return res.status(200).json({ success: true, created, line, groups: digest.length, digest: digest.map((d) => ({ department: d.department, count: d.count, maxDays: d.maxDays })) });
  } catch (err) {
    console.error('[cron] stale-digest failed:', err);
    return res.status(500).json({ success: false, error: 'stale-digest failed' });
  }
}
