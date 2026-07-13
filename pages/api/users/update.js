// PUT /api/users/update
// อัปเดต user ใน MongoDB โดยตรง (ไม่ผ่าน Express)

import { getAuth, clerkClient } from '@clerk/nextjs/server';
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
  { collection: 'users', timestamps: true }
);
const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { name, position, department, role, clerkId, profileUrl, phone, assignedTask } = req.body;

  if (!clerkId) {
    return res.status(400).json({ success: false, message: 'Missing Clerk ID' });
  }

  try {
    // แก้ได้เฉพาะโปรไฟล์ "ของตัวเอง" — แก้ของคนอื่นได้เฉพาะ superadmin
    // (เดิมรับ clerkId จาก body ตรง ๆ → ใครก็แก้ข้อมูล/role ของคนอื่นได้)
    if (clerkId !== userId) {
      const client = await clerkClient();
      const caller = await client.users.getUser(userId);
      if (caller.publicMetadata?.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'แก้ไขข้อมูลผู้ใช้อื่นได้เฉพาะ superadmin' });
      }
    }

    await dbConnect();

    const updatedUser = await User.findOneAndUpdate(
      { clerkId },
      { $set: { name, position, department, role, profileUrl, phone, assignedTask } },
      { new: true }
    ).lean();

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, message: 'User updated', user: updatedUser });
  } catch (e) {
    console.error('UPDATE USER ERROR:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
}
