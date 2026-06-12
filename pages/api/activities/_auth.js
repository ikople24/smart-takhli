import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import { hasPermission } from "@/lib/permissions";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
const REQUIRED_PAGE = "/admin/manage-activities";

// ⚠️ inline User schema (จำเป็นตาม pattern ปัจจุบัน — เฟส 6 จะรวมเป็นที่เดียว)
// ถ้าเพิ่มฟิลด์ใน models/CreateUser.js ต้องตามมาแก้ที่นี่ด้วย
export async function requireActivitiesAdmin(req) {
  const { userId } = getAuth(req);
  if (!userId) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const role = clerkUser.publicMetadata?.role || "admin";
  if (role === "superadmin") {
    return { ok: true, userId, role, isSuperAdmin: true };
  }

  await dbConnect();
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
  const mongoUser = await User.findOne({ clerkId: userId }).lean();

  if (!mongoUser) {
    return { ok: false, status: 403, message: "User not registered" };
  }
  if (!mongoUser.appId || mongoUser.appId !== CURRENT_APP_ID) {
    return { ok: false, status: 403, message: "No app access" };
  }
  if (!hasPermission(mongoUser.role || role, mongoUser.allowedPages, REQUIRED_PAGE)) {
    return { ok: false, status: 403, message: "No page access" };
  }

  return { ok: true, userId, role: mongoUser.role || role, isSuperAdmin: false };
}
