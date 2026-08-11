import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import { pathMatchesPermission } from "@/lib/permissions";

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
  const role = clerkUser.publicMetadata?.role || "admin";
  const clerkName = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim();

  if (role === "superadmin") {
    return { ok: true, userId, role, isSuperAdmin: true, name: clerkName };
  }

  await dbConnect();
  const User = getUserModel();
  const mongoUser = await User.findOne({ clerkId: userId }).lean();

  if (!mongoUser) {
    return { ok: false, status: 403, message: "User not registered" };
  }
  if (!mongoUser.appId || mongoUser.appId !== CURRENT_APP_ID) {
    return { ok: false, status: 403, message: "No app access" };
  }

  const allowed = Array.isArray(mongoUser.allowedPages) ? mongoUser.allowedPages : [];
  // allowedPages ว่าง = ใช้ DEFAULT_PERMISSIONS ซึ่งจะรวมหน้านี้ไว้แล้ว (ดูแผนที่ 2)
  const hasPageAccess =
    allowed.length === 0 ||
    allowed.some((permission) => pathMatchesPermission(REQUIRED_PAGE, permission));

  if (!hasPageAccess) {
    return { ok: false, status: 403, message: "No page access" };
  }

  return {
    ok: true,
    userId,
    role: mongoUser.role || role,
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
