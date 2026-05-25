import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/dbConnect';
import Notification from '@/models/Notification';

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
    return res.status(400).json({ error: 'Invalid notification ID' });
  }

  try {
    await dbConnect();

    if (req.method === 'PUT') {
      // Mark as read
      const notification = await Notification.findByIdAndUpdate(
        id,
        {
          read: true,
          readAt: new Date(),
        },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      return res.status(200).json({
        success: true,
        notification,
      });
    }

    if (req.method === 'DELETE') {
      // Delete notification
      const result = await Notification.findByIdAndDelete(id);

      if (!result) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'Notification deleted',
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
}
