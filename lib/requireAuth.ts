// lib/requireAuth.ts
// Helper สำหรับตรวจสอบสิทธิ์ใน API routes ทุกตัว
// ใช้แทนการตรวจสอบซ้ำๆ ในแต่ละ handler
//
// หมายเหตุประสิทธิภาพ: เดิมทุก request เรียก Clerk `users.getUser` — หน้าเดียวที่ fetch API
// หลายตัวพร้อมกันจะยิง Clerk ซ้ำหลายครั้ง (ช้า). ใช้แคช TTL + dedupe in-flight ต่อ userId

import { getAuth, clerkClient } from '@clerk/nextjs/server';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Role } from './permissions';

export interface AuthUser {
  userId: string;
  role: Role;
}

/** ระยะเวลาใช้ role จากแคช (หลังเปลี่ยน role ใน Clerk อาจดีเลย์ได้สูงสุดเท่านี้) */
const ROLE_CACHE_TTL_MS = 30_000;

const roleCache = new Map<string, { role: Role; expiresAt: number }>();
const inflightRoleFetch = new Map<string, Promise<Role>>();

async function resolveRoleFromClerk(userId: string): Promise<Role> {
  const now = Date.now();
  const hit = roleCache.get(userId);
  if (hit && hit.expiresAt > now) {
    return hit.role;
  }

  let pending = inflightRoleFetch.get(userId);
  if (!pending) {
    pending = (async () => {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      const role = (clerkUser.publicMetadata?.role as Role) || 'guest';
      roleCache.set(userId, { role, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
      return role;
    })();
    pending.finally(() => {
      inflightRoleFetch.delete(userId);
    });
    inflightRoleFetch.set(userId, pending);
  }

  return pending;
}

/**
 * ตรวจสอบว่า request มี session ที่ถูกต้องและ role ตรงตามที่กำหนด
 *
 * การใช้งาน:
 *   const auth = await requireAuth(req, res, ['admin', 'superadmin']);
 *   if (!auth) return;  // ส่ง 401/403 ไปแล้ว ออกจาก handler ได้เลย
 *   // auth.userId, auth.role พร้อมใช้
 */
export async function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  allowedRoles: Role[] = ['admin', 'superadmin']
): Promise<AuthUser | null> {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized — กรุณาล็อกอินก่อน' });
    return null;
  }

  try {
    const role = await resolveRoleFromClerk(userId);

    if (!allowedRoles.includes(role)) {
      res.status(403).json({
        success: false,
        message: `ไม่มีสิทธิ์ใช้งาน — ต้องการ role: ${allowedRoles.join(' หรือ ')}`,
      });
      return null;
    }

    return { userId, role };
  } catch {
    res.status(500).json({ success: false, message: 'ไม่สามารถยืนยันตัวตนได้' });
    return null;
  }
}
