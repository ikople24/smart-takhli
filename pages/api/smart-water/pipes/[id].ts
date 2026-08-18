import type { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { requireSmartWaterAdmin } from '../_auth';
import { pipes } from '@/lib/smart-water/db';
import { savePipe, softDeletePipe, DeletedDocError } from '@/lib/smart-water/service';
import { zodIssues } from '@/lib/smart-water/api-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireSmartWaterAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  const id = String(req.query.id);
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'id ไม่ถูกต้อง' });
  }

  try {
    const col = await pipes();

    if (req.method === 'GET') {
      const doc = await col.findOne({ _id: new ObjectId(id), deletedAt: null });
      if (!doc) return res.status(404).json({ success: false, message: 'ไม่พบท่อนี้' });
      return res.status(200).json({ success: true, data: doc });
    }

    if (req.method === 'PATCH') {
      const existing = await col.findOne({ _id: new ObjectId(id), deletedAt: null });
      if (!existing) return res.status(404).json({ success: false, message: 'ไม่พบท่อนี้' });
      // merge ของเดิม + ของใหม่ แล้ววนกลับเข้า savePipe เพื่อ re-validate + re-derive
      // ตัดฟิลด์ derive/metadata ทิ้งก่อน — Zod schema ไม่รู้จักและ service จะคำนวณใหม่เอง
      const merged: Record<string, unknown> = { ...existing, ...req.body, _id: id };
      delete merged.createdAt;
      delete merged.updatedAt;
      delete merged.deletedAt;
      delete merged.code;
      delete merged.diameterMm;
      delete merged.lengthM;
      delete merged.bbox;
      const doc = await savePipe(merged);
      return res.status(200).json({ success: true, data: doc });
    }

    if (req.method === 'DELETE') {
      await softDeletePipe(id);
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return res.status(405).json({ success: false, message: 'ไม่รองรับ method นี้' });
  } catch (e) {
    if (e instanceof DeletedDocError) {
      return res.status(409).json({ success: false, message: e.message });
    }
    const issues = zodIssues(e);
    if (issues) {
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', issues });
    }
    console.error('[smart-water/pipes/id]', e);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
  }
}
