import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import { hasPermission } from "@/lib/permissions";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
const REQUIRED_PAGE = "/admin/smart-waste";

// หมายเหตุ: User schema ถูก redefine แบบย่อ inline หลายที่ใน repo นี้
// (pages/api/auth/verify-app-access.js, lib/pm25CronAuth.js, pages/api/pm25/_auth.js)
// — เพิ่มฟิลด์ใน User ต้องแก้ทุกที่ ไม่งั้นฟิลด์หายเงียบจากผลคิวรี
function getUserModel() {
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
  return mongoose.models.User || mongoose.model("User", UserSchema);
}

export async function requireWasteAdmin(req) {
  const { userId } = getAuth(req);
  if (!userId) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const clerkRole = clerkUser.publicMetadata?.role || "admin";
  const clerkName = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim();

  // Clerk publicMetadata คือ "แหล่งความจริงเดียว" ของ superadmin (ตาม CLAUDE.md)
  if (clerkRole === "superadmin") {
    return { ok: true, userId, role: clerkRole, isSuperAdmin: true, name: clerkName };
  }

  await dbConnect();
  const User = getUserModel();
  const mongoUser = await User.findOne({ clerkId: userId }).lean();

  if (!mongoUser) {
    return { ok: false, status: 403, message: "User not registered" };
  }
  // พนักงานที่ถูกปิดใช้งาน/เก็บเข้ากรุแล้วต้องเข้าไม่ได้ แม้บัญชี Clerk ยังอยู่
  if (mongoUser.isActive === false || mongoUser.isArchived === true) {
    return { ok: false, status: 403, message: "Account disabled" };
  }
  if (!mongoUser.appId || mongoUser.appId !== CURRENT_APP_ID) {
    return { ok: false, status: 403, message: "No app access" };
  }

  // มาถึงตรงนี้แปลว่า Clerk ไม่ได้บอกว่าเป็น superadmin — ห้าม role ใน Mongo
  // ยกระดับตัวเองเป็น superadmin ผ่านการเช็คสิทธิ์
  const effectiveRole =
    (mongoUser.role || clerkRole) === "superadmin" ? "admin" : mongoUser.role || clerkRole;

  // ใช้ hasPermission จาก lib/permissions.ts เป็นแหล่งความจริงเดียว —
  // มันจัดการเคส allowedPages ว่าง (fallback ไป DEFAULT_PERMISSIONS[role]) ให้แล้ว
  //
  // ⚠️ ห้ามเขียนเงื่อนไข "allowedPages ว่าง = ผ่าน" เองที่นี่:
  // ให้ hasPermission ตัดสินจาก DEFAULT_PERMISSIONS ที่เดียว — เขียนเองเมื่อไร
  // API จะหลวมกว่า UI ทันทีที่นโยบายชุดพื้นฐานเปลี่ยน
  const allowed = Array.isArray(mongoUser.allowedPages) ? mongoUser.allowedPages : [];
  if (!hasPermission(effectiveRole, allowed, REQUIRED_PAGE)) {
    return { ok: false, status: 403, message: "No page access" };
  }

  return {
    ok: true,
    userId,
    role: effectiveRole,
    isSuperAdmin: false,
    name: mongoUser.name || clerkName,
  };
}

// เข้มกว่า requireWasteAdmin — ใช้กับ endpoint ที่เขียนทับข้อมูลได้ทีละหลายร้อยวัน
// (การนำเข้าไฟล์ xlsx)
export async function requireWasteSuperadmin(req) {
  const auth = await requireWasteAdmin(req);
  if (!auth.ok) return auth;
  if (!auth.isSuperAdmin) {
    return { ok: false, status: 403, message: "Superadmin only" };
  }
  return auth;
}
