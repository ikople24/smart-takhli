import type { NextApiRequest } from "next";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import dbConnect from "@/lib/dbConnect";
import { hasPermission, type Role } from "@/lib/permissions";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
const REQUIRED_PAGE = "/admin/garbage";

const KNOWN_ROLES: readonly string[] = ["superadmin", "admin", "user", "guest"];

/** role ที่ไม่รู้จัก/ไม่มีค่า ถือเป็น "admin" ตามแบบเดียวกับ pages/api/pm25/_auth.js */
function asRole(value: unknown): Role {
  return typeof value === "string" && KNOWN_ROLES.includes(value) ? (value as Role) : "admin";
}

export type GarbageAdminResult =
  | { ok: true; userId: string; isSuperAdmin: boolean }
  | { ok: false; status: 401 | 403; message: string };

/** ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์อีกครั้ง — ห้ามเชื่อฝั่ง client */
export async function requireGarbageAdmin(req: NextApiRequest): Promise<GarbageAdminResult> {
  const { userId } = getAuth(req);
  if (!userId) return { ok: false, status: 401, message: "ต้องเข้าสู่ระบบก่อน" };

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  if (clerkUser.publicMetadata?.role === "superadmin") {
    return { ok: true, userId, isSuperAdmin: true };
  }

  await dbConnect();
  // schema ย่อแบบ inline ตามแบบเดียวกับ pages/api/pm25/_auth.js
  const UserSchema = new mongoose.Schema(
    {
      clerkId: String,
      role: String,
      appId: { type: String, default: "" },
      allowedPages: { type: [String], default: [] },
      name: String,
    },
    { collection: "users", timestamps: true }
  );
  const User = mongoose.models.User || mongoose.model("User", UserSchema);
  const mongoUser = await User.findOne({ clerkId: userId }).lean<{
    appId?: string;
    allowedPages?: string[];
    role?: string;
  } | null>();

  if (!mongoUser) return { ok: false, status: 403, message: "ยังไม่ได้ลงทะเบียนผู้ใช้" };
  if (!mongoUser.appId || mongoUser.appId !== CURRENT_APP_ID) {
    return { ok: false, status: 403, message: "ไม่มีสิทธิ์เข้าใช้แอปนี้" };
  }

  // ใช้ helper กลางของรีโป — allowedPages ว่างต้องตกไปใช้ DEFAULT_PERMISSIONS[role]
  // ไม่ใช่ "ว่าง = ผ่านทุกหน้า" ตามที่ CLAUDE.md กำหนด
  // หมายเหตุ: /admin/garbage จะถูกเพิ่มใน ALL_PAGES + DEFAULT_PERMISSIONS.admin ใน task ถัดไป
  // ระหว่างนี้ admin ที่ allowedPages ว่างจะยังได้ 403 ซึ่งถูกต้อง และจะหายเองหลัง task 14
  const role = asRole(mongoUser.role ?? clerkUser.publicMetadata?.role);
  const allowed = Array.isArray(mongoUser.allowedPages) ? mongoUser.allowedPages : [];
  if (!hasPermission(role, allowed, REQUIRED_PAGE)) {
    return { ok: false, status: 403, message: "ไม่มีสิทธิ์หน้านี้" };
  }

  return { ok: true, userId, isSuperAdmin: false };
}
