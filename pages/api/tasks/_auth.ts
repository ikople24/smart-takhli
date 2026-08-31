// pages/api/tasks/_auth.ts
// ตัวช่วยตรวจสิทธิ์ของ API งานเจ้าหน้าที่ (pattern เดียวกับ pages/api/pm25/_auth.js)
// - getOfficer(req): เจ้าหน้าที่ที่ล็อกอิน + เอกสาร users ใน Mongo (ทุก endpoint ของโมดูลใช้)
// - requireSuperAdmin(req): เฉพาะแก้การตั้งค่า (Clerk publicMetadata.role)
import type { NextApiRequest } from 'next';
import mongoose from 'mongoose';
import { getAuth, clerkClient } from '@clerk/nextjs/server';
import dbConnect from '@/lib/dbConnect';

export interface OfficerUser {
  _id: mongoose.Types.ObjectId;
  clerkId: string;
  name?: string;
  department?: string;
  position?: string;
  role?: string;
  appId?: string;
  allowedPages?: string[];
}

type AuthFail = { ok: false; status: number; message: string };
type OfficerOk = { ok: true; clerkUserId: string; officer: OfficerUser };

// inline schema ย่อ (ธรรมเนียมของ repo) — strict:false + lean() เพื่อให้ได้ทุกฟิลด์ไม่ว่าใครลงทะเบียน User ก่อน
const UserSchema = new mongoose.Schema(
  { clerkId: String, name: String, department: String, position: String, role: String, appId: String, allowedPages: [String] },
  { collection: 'users', strict: false }
);

function userModel() {
  return mongoose.models.User || mongoose.model('User', UserSchema);
}

export async function getOfficer(req: NextApiRequest): Promise<AuthFail | OfficerOk> {
  const { userId } = getAuth(req);
  if (!userId) return { ok: false, status: 401, message: 'Unauthorized' };
  await dbConnect();
  const officer = (await userModel().findOne({ clerkId: userId }).lean()) as OfficerUser | null;
  if (!officer) return { ok: false, status: 404, message: 'User not found' };
  return { ok: true, clerkUserId: userId, officer };
}

export async function requireSuperAdmin(req: NextApiRequest): Promise<AuthFail | { ok: true; clerkUserId: string }> {
  const { userId } = getAuth(req);
  if (!userId) return { ok: false, status: 401, message: 'Unauthorized' };
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    if (user.publicMetadata?.role !== 'superadmin') return { ok: false, status: 403, message: 'Superadmin only' };
    return { ok: true, clerkUserId: userId };
  } catch (err) {
    console.error('[tasks] clerk lookup failed:', err);
    return { ok: false, status: 403, message: 'Forbidden' };
  }
}
