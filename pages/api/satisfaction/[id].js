// GET /api/satisfaction/:complaintId
// คืนค่า satisfaction records สำหรับ complaint นั้น (เหมือน Express route เดิม)

import dbConnect from '@/lib/dbConnect';
import Satisfaction from '@/models/Satisfaction';
import mongoose from 'mongoose';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing complaint ID' });
  }

  try {
    await dbConnect();

    const objectId = mongoose.Types.ObjectId.isValid(id)
      ? new mongoose.Types.ObjectId(id)
      : id;

    const data = await Satisfaction.find({ complaintId: objectId })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();

    // ส่งเป็น array ตรงๆ เพื่อให้ SatisfactionChart ใช้ได้
    return res.status(200).json(data);
  } catch (err) {
    console.error('Error fetching satisfaction by complaintId:', err);
    return res.status(500).json({ error: 'Failed to fetch satisfaction data' });
  }
}
