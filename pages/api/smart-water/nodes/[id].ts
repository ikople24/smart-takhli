import type { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { requireSmartWaterAdmin } from '../_auth';
import { nodes } from '@/lib/smart-water/db';
import { saveNode, softDeleteNode, DeletedDocError } from '@/lib/smart-water/service';
import { zodIssues } from '@/lib/smart-water/api-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let auth;
  try {
    auth = await requireSmartWaterAdmin(req);
  } catch (e) {
    console.error('[smart-water/nodes/id] auth', e);
    return res.status(500).json({ success: false, message: 'ตรวจสอบสิทธิ์ไม่สำเร็จ' });
  }
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  const id = String(req.query.id);
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'id ไม่ถูกต้อง' });
  }

  try {
    const col = await nodes();

    if (req.method === 'GET') {
      const doc = await col.findOne({ _id: new ObjectId(id), deletedAt: null });
      if (!doc) return res.status(404).json({ success: false, message: 'ไม่พบอุปกรณ์นี้' });
      return res.status(200).json({ success: true, data: doc });
    }

    if (req.method === 'PATCH') {
      const existing = await col.findOne({ _id: new ObjectId(id), deletedAt: null });
      if (!existing) return res.status(404).json({ success: false, message: 'ไม่พบอุปกรณ์นี้' });
      const merged: Record<string, unknown> = { ...existing, ...req.body, _id: id };
      if (merged.onPipeId) merged.onPipeId = String(merged.onPipeId);
      else delete merged.onPipeId;
      delete merged.createdAt;
      delete merged.updatedAt;
      delete merged.deletedAt;
      const doc = await saveNode(merged);
      return res.status(200).json({ success: true, data: doc });
    }

    if (req.method === 'DELETE') {
      const r = await softDeleteNode(id);
      if (r.matchedCount === 0) {
        return res.status(404).json({ success: false, message: 'ไม่พบอุปกรณ์นี้' });
      }
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
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
    console.error('[smart-water/nodes/id]', e);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
  }
}
