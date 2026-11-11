// pages/api/tasks/pool-alert.ts
// POST { days? } — "แจ้งเตือนหัวหน้ากอง": ส่งสรุปเรื่องค้างไม่มีคนรับเกินเกณฑ์เข้า LINE กลุ่มเจ้าหน้าที่
// ⚠️ 1 push นับโควตา LINE เท่าจำนวนสมาชิกกลุ่ม — UI ต้องถามยืนยันก่อน · ข้อความสร้างที่ lib/tasks/digest.js#buildStaleLineText (ใช้ร่วมกับ cron)
import type { NextApiRequest, NextApiResponse } from 'next';
import { lineNotifyAdminGroup } from '@/lib/lineMessaging';
import { logAuditEvent } from '@/lib/auditLogger';
import { getTaskSettings } from '@/lib/tasks/loadSettings';
import { loadPoolItems } from '@/lib/tasks/loadPool';
import { staleSummary } from '@/lib/tasks/pool';
import { buildStaleLineText } from '@/lib/tasks/digest';
import { requirePage } from './_auth';
import { PAGE_PATH } from './pool';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  const auth = await requirePage(req, PAGE_PATH);
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.message });

  try {
    const settings = await getTaskSettings();
    const daysRaw = req.body?.days;
    const days = daysRaw === 'all' || daysRaw === null ? null : Number(daysRaw) > 0 ? Number(daysRaw) : 30;
    const { items } = await loadPoolItems({ settings, days });
    const summary = staleSummary(items);
    const text = buildStaleLineText(items, {
      unclaimedAlertHours: settings.unclaimedAlertHours,
      footer: `(แจ้งโดย ${auth.officer.name || 'เจ้าหน้าที่'})`,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    });
    if (!text) return res.status(400).json({ success: false, error: 'ตอนนี้ไม่มีเรื่องค้างเกินเกณฑ์' });

    const sent = await lineNotifyAdminGroup([{ type: 'text', text }]);
    if (!sent) return res.status(502).json({ success: false, error: 'ส่ง LINE ไม่สำเร็จ — ยังไม่ตั้ง groupId หรือโควตาข้อความเต็ม' });

    logAuditEvent({
      actorClerkId: auth.clerkUserId,
      actorName: auth.officer.name || 'admin',
      action: 'notification_sent',
      resourceType: 'system',
      resourceId: 'task_pool',
      description: `แจ้ง LINE กลุ่ม — เรื่องค้างไม่มีคนรับ ${summary.count} เรื่อง`,
    });
    return res.status(200).json({ success: true, count: summary.count });
  } catch (err) {
    console.error('[tasks] pool-alert failed:', err);
    return res.status(500).json({ success: false, error: 'แจ้งเตือนไม่สำเร็จ' });
  }
}
