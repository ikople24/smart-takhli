// GET /api/analytics/satisfaction?days=30
// แนวโน้มความพึงพอใจรายสัปดาห์ — สำหรับ Area Chart

import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/dbConnect';
import Satisfaction from '@/models/Satisfaction';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const days = Math.min(parseInt(req.query.days as string) || 90, 365);
  const from = new Date();
  from.setDate(from.getDate() - days);

  try {
    await dbConnect();

    // จัดกลุ่มรายสัปดาห์ เพื่อให้ข้อมูลกระชับขึ้น
    const weeklyTrend = await Satisfaction.aggregate([
      { $match: { createdAt: { $gte: from } } },
      {
        $group: {
          _id: {
            year: { $year: { date: '$createdAt', timezone: 'Asia/Bangkok' } },
            week: { $isoWeek: { date: '$createdAt', timezone: 'Asia/Bangkok' } },
          },
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 },
          distribution: {
            $push: '$rating',
          },
        },
      },
      { $sort: { '_id.year': 1, '_id.week': 1 } },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          week: '$_id.week',
          avgRating: { $round: ['$avgRating', 2] },
          count: 1,
          label: {
            $concat: [
              { $toString: '$_id.year' },
              '-W',
              {
                $cond: [
                  { $lt: ['$_id.week', 10] },
                  { $concat: ['0', { $toString: '$_id.week' }] },
                  { $toString: '$_id.week' },
                ],
              },
            ],
          },
        },
      },
    ]);

    // สรุปรายดาว
    const distributionAgg = await Satisfaction.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distributionAgg.forEach((d: { _id: number; count: number }) => {
      distribution[d._id] = d.count;
    });

    return res.status(200).json({
      success: true,
      weeklyTrend,
      distribution,
      days,
    });
  } catch (error) {
    console.error('satisfaction analytics error:', error);
    return res.status(500).json({ error: 'Failed to fetch satisfaction analytics' });
  }
}
