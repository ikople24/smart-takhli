import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/dbConnect';
import Community from '@/models/Community';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const appId = process.env.NEXT_PUBLIC_APP_ID || 'smart-takhli';
  await dbConnect();

  if (req.method === 'GET') {
    try {
      const communities = await Community.find({ appId }).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, data: communities });
    } catch {
      return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, description, population, latitude, longitude } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อชุมชน' });
      const community = await Community.create({ name, description, population, latitude, longitude, appId });
      return res.status(201).json({ success: true, data: community });
    } catch {
      return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id } = req.query;
      const { name, description, population, latitude, longitude, active } = req.body;
      if (!id) return res.status(400).json({ success: false, message: 'ไม่พบ ID' });
      const community = await Community.findOneAndUpdate(
        { _id: id, appId },
        { name, description, population, latitude, longitude, active },
        { new: true }
      );
      if (!community) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลชุมชน' });
      return res.status(200).json({ success: true, data: community });
    } catch {
      return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, message: 'ไม่พบ ID' });
      const community = await Community.findOneAndDelete({ _id: id, appId });
      if (!community) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลชุมชน' });
      return res.status(200).json({ success: true, message: 'ลบข้อมูลสำเร็จ' });
    } catch {
      return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบข้อมูล' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
