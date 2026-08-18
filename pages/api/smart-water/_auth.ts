import type { NextApiRequest } from "next";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import dbConnect from "@/lib/dbConnect";
import { hasPermission, type Role } from "@/lib/permissions";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
const REQUIRED_PAGE = "/admin/smart-water";

const KNOWN_ROLES: readonly string[] = ["superadmin", "admin", "user", "guest"];

/** role ที่ไม่รู้จัก/ไม่มีค่า ถือเป็น "admin" ตามแบบเดียวกับ pages/api/garbage/_auth.ts */
function asRole(value: unknown): Role {
  return typeof value === "string" && KNOWN_ROLES.includes(value) ? (value as Role) : "admin";
}

export type SmartWaterAdminResult =
  | { ok: true; userId: string; isSuperAdmin: boolean }
  | { ok: false; status: 401 | 403; message: string };

/** ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์อีกครั้ง — ห้ามเชื่อฝั่ง client */
export async function requireSmartWaterAdmin(req: NextApiRequest): Promise<SmartWaterAdminResult> {
  const { userId } = getAuth(req);
  if (!userId) return { ok: false, status: 401, message: "ต้องเข้าสู่ระบบก่อน" };

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  if (clerkUser.publicMetadata?.role === "superadmin") {
    return { ok: true, userId, isSuperAdmin: true };
  }

  await dbConnect();
  // schema ย่อแบบ inline ตามแบบเดียวกับ pages/api/garbage/_auth.ts
  // (repo นี้ redefine User แบบย่อหลายที่ — เพิ่มฟิลด์ใน User ต้องแก้ทุกที่ ไม่งั้นฟิลด์หายเงียบ)
  const UserSchema = new mongoose.Schema(
    {
      clerkId: String,
      role: String,
      appId: { type: String, default: "" },
      allowedPages: { type: [String], default: [] },
      isActive: { type: Boolean, default: true },
      isArchived: { type: Boolean, default: false },
      name: String,
    },
    { collection: "users", timestamps: true }
  );
  const User = mongoose.models.User || mongoose.model("User", UserSchema);
  const mongoUser = await User.findOne({ clerkId: userId }).lean<{
    appId?: string;
    allowedPages?: string[];
    role?: string;
    isActive?: boolean;
    isArchived?: boolean;
  } | null>();

  if (!mongoUser) return { ok: false, status: 403, message: "ยังไม่ได้ลงทะเบียนผู้ใช้" };
  // พนักงานที่ถูกปิดใช้งาน/เก็บเข้ากรุแล้วต้องเข้าไม่ได้ แม้บัญชี Clerk ยังอยู่
  if (mongoUser.isActive === false || mongoUser.isArchived === true) {
    return { ok: false, status: 403, message: "บัญชีถูกปิดใช้งาน" };
  }
  if (!mongoUser.appId || mongoUser.appId !== CURRENT_APP_ID) {
    return { ok: false, status: 403, message: "ไม่มีสิทธิ์เข้าใช้แอปนี้" };
  }

  // มาถึงตรงนี้แปลว่า Clerk ไม่ได้บอกว่าเป็น superadmin — ห้าม role ใน Mongo
  // ยกระดับตัวเองเป็น superadmin ผ่านการเช็คสิทธิ์
  const rawRole = asRole(mongoUser.role ?? clerkUser.publicMetadata?.role);
  const role: Role = rawRole === "superadmin" ? "admin" : rawRole;

  // ใช้ helper กลางของรีโป — allowedPages ว่างตกไปใช้ DEFAULT_PERMISSIONS[role]
  // หน้านี้ไม่อยู่ใน DEFAULT_PERMISSIONS.admin (นโยบาย: superadmin ติ๊กสิทธิ์รายคน)
  // → admin ที่ยังไม่ถูกให้สิทธิ์จะได้ 403 — ให้สิทธิ์ที่ /admin/superadmin
  //   หรือรัน scripts/grant-smart-water-permission.js --yes
  const allowed = Array.isArray(mongoUser.allowedPages) ? mongoUser.allowedPages : [];
  if (!hasPermission(role, allowed, REQUIRED_PAGE)) {
    return { ok: false, status: 403, message: "ไม่มีสิทธิ์หน้านี้" };
  }

  return { ok: true, userId, isSuperAdmin: false };
}
