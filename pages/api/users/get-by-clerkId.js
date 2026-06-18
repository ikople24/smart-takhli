// GET /api/users/get-by-clerkId
// ดึงข้อมูล user ของตัวเองจาก MongoDB โดยตรง (ไม่ผ่าน Express)

import { getAuth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/dbConnect';
import mongoose from 'mongoose';

// Inline User schema ตามแพทเทิร์น CLAUDE.md
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

    // ค้นหา user จาก clerkId โดยตรง
    const user = await User.findOne({ clerkId: userId }).lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('GET USER BY CLERKID ERROR:', error.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}
