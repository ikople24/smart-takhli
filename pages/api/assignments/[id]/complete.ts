import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Assignment from '@/models/Assignment';
import { logAuditEvent } from '@/lib/auditLogger';
import { n8n } from '@/lib/n8nWebhook';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = getAuth(req);
  const { id } = req.query;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (typeof id !== 'string') return res.status(400).json({ error: 'Invalid assignment ID' });
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await dbConnect();

    // Find MongoDB user to get _id for ownership check
    const UserSchema = new mongoose.Schema({ clerkId: String, role: String }, { collection: 'users' });
    const User = mongoose.models.User || mongoose.model('User', UserSchema);
    const mongoUser = await User.findOne({ clerkId: userId }).lean() as { _id: string; role?: string } | null;

    if (!mongoUser) return res.status(403).json({ error: 'User not found' });

    // Superadmin can complete any assignment; others only their own
    const filter = mongoUser.role === 'superadmin'
      ? { _id: id }
      : { _id: id, userId: mongoUser._id };

    const assignment = await Assignment.findOneAndUpdate(
      filter,
      { completedAt: new Date() },
      { new: true }
    );

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found or not authorized' });
    }

    const completedAt = assignment.completedAt as Date;
    const assignedAt = assignment.assignedAt as Date;
    const resolutionDays = completedAt && assignedAt
      ? Math.round((completedAt.getTime() - assignedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // บันทึก audit log + ส่ง n8n event (fire-and-forget ทั้งคู่ — ไม่รอ)
    logAuditEvent({
      actorClerkId: userId,
      actorName: mongoUser?.role || 'admin',
      action: 'assignment_completed',
      resourceType: 'assignment',
      resourceId: String(id),
      description: `งานถูกทำเครื่องหมายว่าเสร็จสิ้น (assignment ${String(id).slice(-8)}) ใช้เวลา ${resolutionDays} วัน`,
    });

    n8n.assignmentCompleted({
      assignmentId: String(id),
      complaintId: String(assignment.complaintId),
      officerName: mongoUser?.role || 'admin',
      completedAt: completedAt.toISOString(),
      resolutionDays,
    });

    return res.status(200).json({ success: true, assignment });
  } catch (error) {
    console.error('Error completing assignment:', error);
    res.status(500).json({ error: 'Failed to complete assignment' });
  }
}
