// ตรวจสิทธิ์เจ้าหน้าที่โครงการพระสังข์หอบทอง (Clerk) — ทุก API ใน /api/recycle/* ต้องผ่านตัวนี้
// pattern เดียวกับ pages/api/pm25/_auth.js แต่เช็คสิทธิ์หน้าด้วย hasPermission()
// (allowedPages ว่าง = ชุดพื้นฐาน DEFAULT_PERMISSIONS ไม่ใช่ "เห็นทุกหน้า")
import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import { hasPermission } from "@/lib/permissions";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
export const RECYCLE_PAGE = "/admin/recycle";

export async function requireRecycleStaff(req) {
  const { userId } = getAuth(req);
  if (!userId) return { ok: false, status: 401, message: "กรุณาเข้าสู่ระบบ" };

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const role = clerkUser.publicMetadata?.role || "admin";
  const clerkName = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim();

  if (role === "superadmin") {
    return { ok: true, userId, role, isSuperAdmin: true, name: clerkName };
  }

  await dbConnect();
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
  const mongoUser = await User.findOne({ clerkId: userId }).lean();

  if (!mongoUser) return { ok: false, status: 403, message: "ยังไม่ได้ลงทะเบียนผู้ใช้" };
  if (mongoUser.isActive === false || mongoUser.isArchived) {
    return { ok: false, status: 403, message: "บัญชีถูกระงับ" };
  }
  if (!mongoUser.appId || mongoUser.appId !== CURRENT_APP_ID) {
    return { ok: false, status: 403, message: "ไม่มีสิทธิ์เข้าแอปนี้" };
  }
  const userRole = mongoUser.role || role;
  if (!hasPermission(userRole, mongoUser.allowedPages, RECYCLE_PAGE)) {
    return { ok: false, status: 403, message: "ไม่มีสิทธิ์ใช้งานโครงการพระสังข์หอบทอง" };
  }

  return {
    ok: true,
    userId,
    role: userRole,
    isSuperAdmin: false,
    name: mongoUser.name || clerkName,
  };
}

/** helper: ผ่าน → คืนข้อมูล auth; ไม่ผ่าน → ตอบ error ให้แล้วและคืน null */
export async function withRecycleAuth(req, res) {
  const auth = await requireRecycleStaff(req);
  if (!auth.ok) {
    res.status(auth.status).json({ success: false, message: auth.message });
    return null;
  }
  return auth;
}
