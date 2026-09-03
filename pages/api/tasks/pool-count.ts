// pages/api/tasks/pool-count.ts
// GET — จำนวนเรื่องในกองงานรอรับ (30 วันล่าสุด) สำหรับ badge บน bottom nav มือถือ
import type { NextApiRequest, NextApiResponse } from 'next';
import { getTaskSettings } from '@/lib/tasks/loadSettings';
import { loadPoolItems } from '@/lib/tasks/loadPool';
import { requirePage } from './_auth';
import { PAGE_PATH } from './pool';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });
  const auth = await requirePage(req, PAGE_PATH);
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.message, total: 0, stale: 0 });
  try {
    const settings = await getTaskSettings();
    const { items } = await loadPoolItems({ settings, days: null });
    return res.status(200).json({ success: true, total: items.length, stale: items.filter((i) => i.isStale).length });
  } catch (err) {
    console.error('[tasks] pool-count failed:', err);
    return res.status(500).json({ success: false, error: 'นับไม่สำเร็จ', total: 0, stale: 0 });
  }
}
