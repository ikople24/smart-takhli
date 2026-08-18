import type { NextApiRequest, NextApiResponse } from 'next';
import { requireSmartWaterAdmin } from '../_auth';
import { runLengthReport, type GroupBy } from '@/lib/smart-water/reports';
import { str } from '@/lib/smart-water/api-helpers';

const VALID: GroupBy[] = ['material', 'road', 'year', 'status'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireSmartWaterAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'ไม่รองรับ method นี้' });
  }

  const g = str(req.query.groupBy) as GroupBy | undefined;
  try {
    const result = await runLengthReport({
      groupBy: g && VALID.includes(g) ? g : 'material',
      roadName: str(req.query.roadName),
      material: str(req.query.material),
      includeAbandoned: req.query.includeAbandoned === 'true',
    });
    return res.status(200).json({ success: true, ...result });
  } catch (e) {
    console.error('[smart-water/reports/length]', e);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
  }
}
