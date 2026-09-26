import type { NextApiRequest } from "next";
import mongoose from "mongoose";
import { clerkClient, getAuth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/dbConnect";
import { hasPermission, type Role } from "@/lib/permissions";
import { isDepartmentHead } from "@/lib/tasks/roles";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
const REQUIRED_PAGE = "/admin/flood-relief";
const KNOWN_ROLES: readonly string[] = ["superadmin", "admin", "user", "guest"];

function asRole(value: unknown): Role {
  return typeof value === "string" && KNOWN_ROLES.includes(value) ? (value as Role) : "admin";
}

export type FloodAdminResult =
  | {
      ok: true;
      userId: string;
      name: string;
      isSuperAdmin: boolean;
      /** ย้อนสถานะ / เปิดคำขอที่ยกเลิก / ลบโซน — หัวหน้ากอง (users.isDepartmentHead) หรือ superadmin */
      canRewind: boolean;
    }
  | { ok: false; status: 401 | 403; message: string };

type UserDoc = {
  name?: string;
  appId?: string;
  allowedPages?: string[];
  role?: string;
  isActive?: boolean;
  isArchived?: boolean;
  isDepartmentHead?: boolean;
  position?: string;
};

/**
 * ตรวจสิทธิ์แอดมินศูนย์ฯ ฝั่ง server (pattern pages/api/pm25/_auth.js#requirePm25Admin / garbage/_auth.ts)
 * getAuth → superadmin ลัด → Mongo users (appId, active, allowedPages ผ่าน hasPermission)
 * อ่าน users ผ่าน native collection — ไม่ redefine User schema เพิ่มอีกที่ (repo นี้มีหลายสำเนาอยู่แล้ว)
 */
export async function requireFloodAdmin(req: NextApiRequest): Promise<FloodAdminResult> {
  const { userId } = getAuth(req);
  if (!userId) return { ok: false, status: 401, message: "ต้องเข้าสู่ระบบก่อน" };

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);
  const clerkName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    clerkUser.emailAddresses?.[0]?.emailAddress ||
    "เจ้าหน้าที่";

  await dbConnect();
  const db = mongoose.connection.db;
  if (!db) throw new Error("ยังไม่ได้เชื่อมต่อฐานข้อมูล");
  const u = (await db.collection("users").findOne(
    { clerkId: userId },
    { projection: { name: 1, appId: 1, allowedPages: 1, role: 1, isActive: 1, isArchived: 1, isDepartmentHead: 1, position: 1 } }
  )) as UserDoc | null;

  if (clerkUser.publicMetadata?.role === "superadmin") {
    return { ok: true, userId, name: u?.name || clerkName, isSuperAdmin: true, canRewind: true };
  }

  if (!u) return { ok: false, status: 403, message: "ยังไม่ได้ลงทะเบียนผู้ใช้" };
  if (u.isActive === false || u.isArchived === true) return { ok: false, status: 403, message: "บัญชีถูกปิดใช้งาน" };
  if (!u.appId || u.appId !== CURRENT_APP_ID) return { ok: false, status: 403, message: "ไม่มีสิทธิ์เข้าใช้แอปนี้" };

  // role ใน Mongo ยกตัวเองเป็น superadmin ไม่ได้ — Clerk ตัดสินแล้วข้างบน
  const rawRole = asRole(u.role ?? clerkUser.publicMetadata?.role);
  const role: Role = rawRole === "superadmin" ? "admin" : rawRole;
  if (!hasPermission(role, Array.isArray(u.allowedPages) ? u.allowedPages : [], REQUIRED_PAGE)) {
    return { ok: false, status: 403, message: "ไม่มีสิทธิ์หน้านี้" };
  }

  return { ok: true, userId, name: u.name || clerkName, isSuperAdmin: false, canRewind: isDepartmentHead(u) };
}
