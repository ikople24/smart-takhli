// GET /api/analytics/officers?days=30
// ประสิทธิภาพเจ้าหน้าที่ — จำนวนงานที่ได้รับ / เสร็จ / อัตราความสำเร็จ
// สำหรับ Bar Chart ในหน้า analytics

import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Assignment from '@/models/Assignment';

interface UserDoc {
  _id: mongoose.Types.ObjectId;
  name?: string;
  email?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const days = Math.min(parseInt(req.query.days as string) || 30, 365);
  const from = new Date();
  from.setDate(from.getDate() - days);

  try {
    await dbConnect();

    // Inline User schema (ตามแพทเทิร์น CLAUDE.md)
    const UserSchema = new mongoose.Schema(
      { name: String, email: String },
      { collection: 'users' }
    );
    const User = mongoose.models.User || mongoose.model('User', UserSchema);

    const officerStats = await Assignment.aggregate([
      { $match: { assignedAt: { $gte: from } } },
      {
        $group: {
          _id: '$userId',
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $ifNull: ['$completedAt', false] }, 1, 0] },
          },
          avgResolutionMs: {
            $avg: {
              $cond: [
                { $ifNull: ['$completedAt', false] },
                { $subtract: ['$completedAt', '$assignedAt'] },
                null,
              ],
            },
          },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]);

    // ดึงชื่อ user จาก MongoDB
    const userIds = officerStats.map((s: { _id: mongoose.Types.ObjectId }) => s._id);
    const users = (await User.find({ _id: { $in: userIds } })
      .select('name email')
      .lean()) as UserDoc[];
    const userMap = new Map(users.map((u) => [String(u._id), u.name || u.email || 'ไม่ระบุ']));

    const result = officerStats.map((s: {
      _id: mongoose.Types.ObjectId;
      total: number;
      completed: number;
      avgResolutionMs: number | null;
    }) => ({
      officerId: String(s._id),
      name: userMap.get(String(s._id)) || 'ไม่ระบุ',
      total: s.total,
      completed: s.completed,
      pending: s.total - s.completed,
      completionRate:
        s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      avgResolutionDays: s.avgResolutionMs
        ? Math.round(s.avgResolutionMs / (1000 * 60 * 60 * 24))
        : null,
    }));

    return res.status(200).json({ success: true, officers: result, days });
  } catch (error) {
    console.error('officers analytics error:', error);
    return res.status(500).json({ error: 'Failed to fetch officer analytics' });
  }
}
