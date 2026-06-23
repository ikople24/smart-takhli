import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";

export async function requireM10Admin(req, requiredPage) {
  const { userId } = getAuth(req);
  if (!userId) return { ok: false, status: 401, message: "Unauthorized" };

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const role = clerkUser.publicMetadata?.role || "admin";
  if (role === "superadmin") {
    return { ok: true, userId, role, isSuperAdmin: true, name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() };
  }

  await dbConnect();
  const UserSchema = new mongoose.Schema({
    clerkId: String, role: String, appId: { type: String, default: "" },
    allowedPages: { type: [String], default: [] }, name: String,
  }, { collection: "users", timestamps: true });
  const User = mongoose.models.User || mongoose.model("User", UserSchema);
  const mongoUser = await User.findOne({ clerkId: userId }).lean();

  if (!mongoUser) return { ok: false, status: 403, message: "User not registered" };
  if (!mongoUser.appId || mongoUser.appId !== CURRENT_APP_ID) return { ok: false, status: 403, message: "No app access" };

  const allowed = Array.isArray(mongoUser.allowedPages) ? mongoUser.allowedPages : [];
  const hasPageAccess = allowed.length === 0 || allowed.includes(requiredPage);
  if (!hasPageAccess) return { ok: false, status: 403, message: "No page access" };

  return { ok: true, userId, role: mongoUser.role || role, isSuperAdmin: false, name: mongoUser.name || "" };
}
