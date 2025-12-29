import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";

function getBangkokYMD(date = new Date()) {
  // คืนค่า YYYY-MM-DD ตามเวลาไทย
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date);
}

function utcMsFromYMD(ymd) {
  // ymd: YYYY-MM-DD
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  return Date.UTC(y, m - 1, d);
}

export function canEditRecordDate(recordDateYmd, now = new Date(), maxDays = 7) {
  const todayYmd = getBangkokYMD(now);
  const diffDays = Math.floor((utcMsFromYMD(todayYmd) - utcMsFromYMD(recordDateYmd)) / 86400000);
  return diffDays >= 0 && diffDays <= maxDays;
}

export async function requireSmartPaparAdmin(req) {
  const { userId } = getAuth(req);
  if (!userId) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const role = clerkUser.publicMetadata?.role || "admin";
  const isSuperAdmin = role === "superadmin";

  // Superadmin bypass permission checks
  if (isSuperAdmin) {
    return {
      ok: true,
      userId,
      role,
      isSuperAdmin: true,
      name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim(),
    };
  }

  // ตรวจสอบว่ามี user ใน MongoDB, appId ตรง, และ allowedPages มีหน้าที่เกี่ยวข้อง
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

  if (!mongoUser) {
    return { ok: false, status: 403, message: "User not registered" };
  }

  if (!mongoUser.appId || mongoUser.appId !== CURRENT_APP_ID) {
    return { ok: false, status: 403, message: "No app access" };
  }

  const allowed = Array.isArray(mongoUser.allowedPages) ? mongoUser.allowedPages : [];
  const requiredPage = "/admin/smart-papar/water-quality";
  const hasPageAccess = allowed.length === 0 || allowed.includes(requiredPage);

  if (!hasPageAccess) {
    return { ok: false, status: 403, message: "No page access" };
  }

  return {
    ok: true,
    userId,
    role: mongoUser.role || role,
    isSuperAdmin: false,
    name: mongoUser.name || `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim(),
  };
}


