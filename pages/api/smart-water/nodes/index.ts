import type { NextApiRequest, NextApiResponse } from 'next';
import { requireSmartWaterAdmin } from '../_auth';
import { listNodes, saveNode, DeletedDocError } from '@/lib/smart-water/service';
import { parseBBox, str, toFeatureCollection, zodIssues } from '@/lib/smart-water/api-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let auth;
  try {
    auth = await requireSmartWaterAdmin(req);
  } catch (e) {
    console.error('[smart-water/nodes] auth', e);
    return res.status(500).json({ success: false, message: 'ตรวจสอบสิทธิ์ไม่สำเร็จ' });
  }
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
      if (req.body && typeof req.body === 'object' && '_id' in req.body) {
        return res
          .status(400)
          .json({ success: false, message: 'สร้างใหม่ห้ามส่ง _id — แก้ไขข้อมูลเดิมให้ใช้ PATCH' });
      }
      const doc = await saveNode(req.body);
      return res.status(201).json({ success: true, data: doc });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ success: false, message: 'ไม่รองรับ method นี้' });
  } catch (e) {
    if (e instanceof DeletedDocError) {
      return res.status(409).json({ success: false, message: e.message });
    }
    if ((e as { code?: number })?.code === 11000) {
      return res.status(409).json({ success: false, message: 'เลขหัวดับเพลิงนี้ถูกใช้แล้ว' });
    }
    const issues = zodIssues(e);
    if (issues) {
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', issues });
    }
    console.error('[smart-water/nodes]', e);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
  }
}
