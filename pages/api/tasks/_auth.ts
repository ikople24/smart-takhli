// pages/api/tasks/_auth.ts
// ตัวช่วยตรวจสิทธิ์ของ API งานเจ้าหน้าที่ (pattern เดียวกับ pages/api/pm25/_auth.js)
// - getOfficer(req): เจ้าหน้าที่ที่ล็อกอิน + เอกสาร users ใน Mongo (ทุก endpoint ของโมดูลใช้)
// - requireSuperAdmin(req): เฉพาะแก้การตั้งค่า (Clerk publicMetadata.role)
import type { NextApiRequest } from 'next';
import mongoose from 'mongoose';
import { getAuth, clerkClient } from '@clerk/nextjs/server';
import dbConnect from '@/lib/dbConnect';
import { hasPermission, type Role } from '@/lib/permissions';

export interface OfficerUser {
  _id: mongoose.Types.ObjectId;
  clerkId: string;
  name?: string;
  department?: string;
  position?: string;
  role?: string;
  appId?: string;
  allowedPages?: string[];
  isDepartmentHead?: boolean;
  isActive?: boolean;
  isArchived?: boolean;
}

type AuthFail = { ok: false; status: number; message: string };
type OfficerOk = { ok: true; clerkUserId: string; officer: OfficerUser; isSuperAdmin: boolean };

// superadmin ตัดสินจาก Clerk publicMetadata.role (แหล่งความจริงเดียวกับ _app.tsx / PermissionGuard) — role ใน Mongo
// เป็นแค่ fallback · cache ต่อ process 60 วิ กัน Clerk API ถูกยิงทุก request
const SUPERADMIN_CACHE_MS = 60_000;
const superAdminCache = new Map<string, { value: boolean; at: number }>();

export async function isClerkSuperAdmin(clerkUserId: string): Promise<boolean> {
  const hit = superAdminCache.get(clerkUserId);
  if (hit && Date.now() - hit.at < SUPERADMIN_CACHE_MS) return hit.value;
  let value = false;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkUserId);
    value = user.publicMetadata?.role === 'superadmin';
  } catch (err) {
    console.error('[tasks] clerk role lookup failed:', err);
  }
  superAdminCache.set(clerkUserId, { value, at: Date.now() });
  return value;
}

// inline schema ย่อ (ธรรมเนียมของ repo) — strict:false + lean() เพื่อให้ได้ทุกฟิลด์ไม่ว่าใครลงทะเบียน User ก่อน
const UserSchema = new mongoose.Schema(
  { clerkId: String, name: String, department: String, position: String, role: String, appId: String, allowedPages: [String] },
  { collection: 'users', strict: false }
);

export const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || 'smart-takhli';

export function userModel() {
  return mongoose.models.User || mongoose.model('User', UserSchema);
}

export async function getOfficer(req: NextApiRequest): Promise<AuthFail | OfficerOk> {
  const { userId } = getAuth(req);
  if (!userId) return { ok: false, status: 401, message: 'Unauthorized' };
  await dbConnect();
  const officer = (await userModel().findOne({ clerkId: userId }).lean()) as OfficerUser | null;
  if (!officer) return { ok: false, status: 404, message: 'ยังไม่ได้ลงทะเบียนผู้ใช้ในระบบ' };
  const isSuperAdmin = officer.role === 'superadmin' || (await isClerkSuperAdmin(userId));
  return { ok: true, clerkUserId: userId, officer, isSuperAdmin };
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

/** เหมือน getOfficer แต่ตรวจสิทธิ์หน้าเพิ่ม (allowedPages ใน Mongo / DEFAULT_PERMISSIONS / superadmin) ผ่าน hasPermission ที่เดียว */
export async function requirePage(req: NextApiRequest, pagePath: string): Promise<AuthFail | OfficerOk> {
  const auth = await getOfficer(req);
  if (!auth.ok) return auth;
  if (auth.isSuperAdmin) return auth;
  const role = (auth.officer.role as Role) || 'admin';
  if (!hasPermission(role, auth.officer.allowedPages, pagePath)) {
    return {
      ok: false,
      status: 403,
      message: `ยังไม่มีสิทธิ์เข้าหน้านี้ (${pagePath}) — ให้ superadmin เพิ่มสิทธิ์ในหน้าจัดการผู้ใช้ หรือรัน scripts/grant-task-pool-permission.mjs`,
    };
  }
  return auth;
}
