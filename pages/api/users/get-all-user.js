// GET /api/users/get-all-user
// ดึง user ทั้งหมดของ app นี้จาก MongoDB โดยตรง (ไม่ผ่าน Express)

import { getAuth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/dbConnect';
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: String,
    position: String,
    department: String,
    role: String,
    phone: String,
    profileImage: String,
    profileUrl: String,
    assignedTask: String,
    clerkId: String,
    appId: String,
    isActive: Boolean,
    isArchived: Boolean,
    allowedPages: [String],
  },
  { collection: 'users' }
);
const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    await dbConnect();

    const appId = process.env.NEXT_PUBLIC_APP_ID;

    // ดึงเฉพาะ user ของ app นี้ และยังไม่ถูก archive
    const users = await User.find({
      appId,
      isArchived: { $ne: true },
    })
      .select('name position department role phone profileImage profileUrl assignedTask clerkId allowedPages isActive')
      .sort({ name: 1 })
      .lean();

    return res.status(200).json(users);
  } catch (error) {
    console.error('Failed to fetch users:', error.message);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
