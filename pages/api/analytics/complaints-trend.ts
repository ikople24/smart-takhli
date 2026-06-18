// GET /api/analytics/complaints-trend?days=30
// ปริมาณเรื่องร้องเรียนรายวัน สำหรับ Line Chart

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
  from.setHours(0, 0, 0, 0);

  try {
    await dbConnect();

    const trend = await SubmittedReport.aggregate([
      { $match: { createdAt: { $gte: from } } },
      {
        $group: {
          _id: {
            year: { $year: { date: '$createdAt', timezone: 'Asia/Bangkok' } },
            month: { $month: { date: '$createdAt', timezone: 'Asia/Bangkok' } },
            day: { $dayOfMonth: { date: '$createdAt', timezone: 'Asia/Bangkok' } },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      {
        $project: {
          _id: 0,
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: {
                $dateFromParts: {
                  year: '$_id.year',
                  month: '$_id.month',
                  day: '$_id.day',
                },
              },
            },
          },
          count: 1,
        },
      },
    ]);

    // เติมวันที่ขาดให้ count = 0 เพื่อให้ chart ต่อเนื่อง
    const resultMap = new Map(trend.map((d: { date: string; count: number }) => [d.date, d.count]));
    const filled: { date: string; count: number }[] = [];
    for (let i = days; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      filled.push({ date: key, count: resultMap.get(key) ?? 0 });
    }

    return res.status(200).json({ success: true, trend: filled, days });
  } catch (error) {
    console.error('complaints-trend error:', error);
    return res.status(500).json({ error: 'Failed to fetch complaint trend' });
  }
}
