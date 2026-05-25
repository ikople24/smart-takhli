import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/dbConnect';
import Assignment from '@/models/Assignment';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { userId } = getAuth(req);
  const { id } = req.query;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid assignment ID' });
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await dbConnect();

    const assignment = await Assignment.findByIdAndUpdate(
      id,
      {
        completedAt: new Date(),
      },
      { new: true }
    );

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    return res.status(200).json({
      success: true,
      assignment,
    });
  } catch (error) {
    console.error('Error completing assignment:', error);
    res.status(500).json({ error: 'Failed to complete assignment' });
  }
}
