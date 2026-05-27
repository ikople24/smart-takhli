// GET /api/analytics/summary
// ภาพรวม KPI ของระบบ — ใช้แสดงในการ์ดด้านบนของหน้า analytics

import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/dbConnect';
import SubmittedReport from '@/models/SubmittedReport';
import Assignment from '@/models/Assignment';
import Satisfaction from '@/models/Satisfaction';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    await dbConnect();

    const [
      totalComplaints,
      statusCounts,
      totalAssignments,
      completedAssignments,
      satisfactionAgg,
      resolutionAgg,
    ] = await Promise.all([
      SubmittedReport.countDocuments({}),

      // นับตาม status
      SubmittedReport.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      Assignment.countDocuments({}),

      Assignment.countDocuments({ completedAt: { $exists: true } }),

      // คะแนนความพึงพอใจเฉลี่ย
      Satisfaction.aggregate([
        { $group: { _id: null, avg: { $avg: '$rating' }, total: { $sum: 1 } } },
      ]),

      // เวลาเฉลี่ยในการแก้ไข (วัน)
      Assignment.aggregate([
        { $match: { completedAt: { $exists: true } } },
        {
          $addFields: {
            resolutionMs: { $subtract: ['$completedAt', '$assignedAt'] },
          },
        },
        {
          $group: {
            _id: null,
            avgResolutionMs: { $avg: '$resolutionMs' },
          },
        },
      ]),
    ]);

    const statusMap: Record<string, number> = {};
    statusCounts.forEach((s: { _id: string; count: number }) => {
      statusMap[s._id] = s.count;
    });

    const avgSatisfaction = satisfactionAgg[0]?.avg ?? null;
    const totalRatings = satisfactionAgg[0]?.total ?? 0;
    const avgResolutionDays = resolutionAgg[0]?.avgResolutionMs
      ? Math.round(resolutionAgg[0].avgResolutionMs / (1000 * 60 * 60 * 24))
      : null;

    return res.status(200).json({
      success: true,
      summary: {
        totalComplaints,
        statusBreakdown: statusMap,
        totalAssignments,
        completedAssignments,
        pendingAssignments: totalAssignments - completedAssignments,
        completionRate:
          totalAssignments > 0
            ? Math.round((completedAssignments / totalAssignments) * 100)
            : 0,
        avgSatisfaction: avgSatisfaction ? parseFloat(avgSatisfaction.toFixed(2)) : null,
        totalRatings,
        avgResolutionDays,
      },
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
}
