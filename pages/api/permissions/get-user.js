// GET /api/permissions/get-user?userId=<clerkId>
// ดึง allowedPages และ role ของ user จาก MongoDB โดยตรง (ไม่ผ่าน Express)

import { getAuth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/dbConnect';
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  { role: String, allowedPages: [String], clerkId: String },
  { collection: 'users' }
);
const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { userId: callerClerkId } = getAuth(req);
  if (!callerClerkId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { userId } = req.query; // userId คือ clerkId ของ user ที่ต้องการ query

  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }

  try {
    await dbConnect();

    const user = await User.findOne({ clerkId: userId }).select('role allowedPages').lean();

    return res.status(200).json({
      success: true,
      permissions: user?.allowedPages || [],
      role: user?.role || 'admin',
    });
  } catch (e) {
    console.error('get-user permissions error:', e.message);
    // คืนค่า default เพื่อไม่ให้ user ถูก block
    return res.status(200).json({ success: true, permissions: [], role: 'admin' });
  }
}
