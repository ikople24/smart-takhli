// GET /api/analytics/category?days=30
// จำนวนเรื่องร้องเรียนจำแนกตามหมวดหมู่ — สำหรับ Bar / Pie Chart

import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/dbConnect';
import SubmittedReport from '@/models/SubmittedReport';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const days = Math.min(parseInt(req.query.days as string) || 30, 365);
  const from = new Date();
  from.setDate(from.getDate() - days);

  try {
    await dbConnect();

    const breakdown = await SubmittedReport.aggregate([
      { $match: { createdAt: { $gte: from } } },
      {
        $group: {
          _id: { $ifNull: ['$category', 'ไม่ระบุ'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $project: { _id: 0, category: '$_id', count: 1 } },
    ]);

    // แยก status breakdown ด้วย
    const statusBreakdown = await SubmittedReport.aggregate([
      { $match: { createdAt: { $gte: from } } },
      {
        $group: {
          _id: { $ifNull: ['$status', 'ไม่ระบุ'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
    ]);

    return res.status(200).json({ success: true, breakdown, statusBreakdown, days });
  } catch (error) {
    console.error('category analytics error:', error);
    return res.status(500).json({ error: 'Failed to fetch category analytics' });
  }
}
