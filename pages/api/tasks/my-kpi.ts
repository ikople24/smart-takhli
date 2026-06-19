import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Assignment from '@/models/Assignment';

interface AssignmentDoc {
  _id: string;
  complaintId: {
    _id: string;
    fullName: string;
    detail?: string;
    category?: string;
    status?: string;
  } | null;
  assignedAt: Date;
  completedAt?: Date;
}

interface MongoUser {
  _id: string;
  clerkId: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    await dbConnect();

    const UserSchema = new mongoose.Schema(
      { clerkId: String, name: String },
      { collection: 'users' }
    );
    const User = mongoose.models.User || mongoose.model('User', UserSchema);
    const mongoUser = (await User.findOne({ clerkId: userId }).lean()) as MongoUser | null;

    if (!mongoUser) return res.status(404).json({ error: 'User not found' });

    // Fetch ALL assignments (completed + pending) — not just open ones
    const allAssignments = (await Assignment.find({ userId: mongoUser._id })
      .populate({
        path: 'complaintId',
        model: 'SubmittedReport',
        select: 'fullName detail category status',
      })
      .sort({ assignedAt: -1 })
      .lean()) as unknown as AssignmentDoc[];

    const now = Date.now();
    const OVERDUE_DAYS = 7;

    const assignments = allAssignments.map((a) => {
      const daysAssigned = Math.floor((now - new Date(a.assignedAt).getTime()) / 86400000);
      const isCompleted = !!a.completedAt;
      const isOverdue = !isCompleted && daysAssigned > OVERDUE_DAYS;
      const resolutionDays = isCompleted
        ? Math.floor(
            (new Date(a.completedAt!).getTime() - new Date(a.assignedAt).getTime()) / 86400000
          )
        : null;

      return {
        _id: String(a._id),
        complaintId: a.complaintId ? String(a.complaintId._id) : null,
        title: a.complaintId?.fullName ?? '(ไม่ระบุชื่อ)',
        description: a.complaintId?.detail?.substring(0, 120),
        category: a.complaintId?.category,
        status: isCompleted ? 'completed' : isOverdue ? 'overdue' : 'pending',
        assignedAt: a.assignedAt,
        completedAt: a.completedAt ?? null,
        daysAssigned,
        resolutionDays,
        actionUrl: a.complaintId
          ? `/admin/manage-complaints?complaintId=${a.complaintId._id}`
          : null,
      };
    });

    // KPI calculations
    const total = assignments.length;
    const completed = assignments.filter((a) => a.status === 'completed').length;
    const pending = assignments.filter((a) => a.status === 'pending').length;
    const overdue = assignments.filter((a) => a.status === 'overdue').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const resolvedTimes = assignments
      .filter((a) => a.resolutionDays !== null)
      .map((a) => a.resolutionDays as number);
    const avgResolutionDays =
      resolvedTimes.length > 0
        ? Math.round(resolvedTimes.reduce((s, v) => s + v, 0) / resolvedTimes.length)
        : null;

    res.status(200).json({
      success: true,
      kpi: { total, completed, pending, overdue, completionRate, avgResolutionDays },
      assignments,
    });
  } catch (error) {
    console.error('Error fetching KPI:', error);
    res.status(500).json({ error: 'Failed to fetch KPI data' });
  }
}
