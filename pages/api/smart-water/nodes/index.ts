import type { NextApiRequest, NextApiResponse } from 'next';
import { requireSmartWaterAdmin } from '../_auth';
import { listNodes, saveNode, DeletedDocError } from '@/lib/smart-water/service';
import { parseBBox, str, toFeatureCollection, zodIssues } from '@/lib/smart-water/api-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireSmartWaterAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  try {
    if (req.method === 'GET') {
      const docs = await listNodes({
        bbox: parseBBox(req),
        type: str(req.query.type),
        limit: Number(req.query.limit) || undefined,
      });
      if (req.query.format === 'geojson') {
        return res.status(200).json(toFeatureCollection(docs));
      }
      return res.status(200).json({ success: true, data: docs, count: docs.length });
    }

    if (req.method === 'POST') {
      const doc = await saveNode(req.body);
      return res.status(201).json({ success: true, data: doc });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ success: false, message: 'ไม่รองรับ method นี้' });
  } catch (e) {
    if (e instanceof DeletedDocError) {
      return res.status(409).json({ success: false, message: e.message });
    }
    const issues = zodIssues(e);
    if (issues) {
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', issues });
    }
    console.error('[smart-water/nodes]', e);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
  }
}
