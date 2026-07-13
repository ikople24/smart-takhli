// POST /api/users/create
// สร้าง user ใหม่ใน MongoDB โดยตรง (ไม่ผ่าน Express)

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
    appId: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    allowedPages: { type: [String], default: [] },
  },
  { collection: 'users', timestamps: true }
);
const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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
    // สร้าง doc ให้ "ตัวเอง" ได้เสมอ (ฟอร์มลงทะเบียน) — สร้างให้ "คนอื่น" ได้เฉพาะ superadmin
    // (หน้า superadmin ใช้ช่องทางนี้ onboard พนักงานใหม่ที่มีแต่บัญชี Clerk)
    if (clerkId !== userId) {
      const client = await clerkClient();
      const caller = await client.users.getUser(userId);
      if (caller.publicMetadata?.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'สร้างผู้ใช้ให้คนอื่นได้เฉพาะ superadmin' });
      }
    }

    await dbConnect();

    // ตรวจสอบซ้ำ
    const existingUser = await User.findOne({ clerkId }).lean();
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User with this Clerk ID already exists' });
    }

    const newUser = new User({
      name,
      position,
      department,
      role,
      clerkId,
      profileUrl,
      phone,
      assignedTask,
      appId: process.env.NEXT_PUBLIC_APP_ID,
    });
    await newUser.save();

    return res.status(201).json({ success: true, message: 'User created', user: newUser });
  } catch (e) {
    console.error('CREATE USER ERROR:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
}
