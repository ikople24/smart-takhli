import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Assignment from '@/models/Assignment';

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

    return res.status(200).json({ success: true, assignment });
  } catch (error) {
    console.error('Error completing assignment:', error);
    res.status(500).json({ error: 'Failed to complete assignment' });
  }
}
