// POST /api/users/update-app-id  { userId, appId }
// กำหนด appId ให้ user = อนุมัติให้ใช้โมดูลของแอปนั้น (เรียกจากหน้า /admin/superadmin เท่านั้น — superadmin only)

import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { requireSuperadmin } from "@/pages/api/permissions/_auth";
import User from "@/pages/api/permissions/_userModel";
import { logAuditEvent } from "@/lib/auditLogger";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    const auth = await requireSuperadmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const { userId, appId } = req.body || {};
    if (typeof userId !== "string" || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "userId ไม่ถูกต้อง" });
    }
    if (typeof appId !== "string" || appId.trim() === "") {
      return res.status(400).json({ success: false, message: "appId ไม่ถูกต้อง" });
    }

    const cleanAppId = appId.trim();

    await dbConnect();
    const before = await User.findById(userId).select("name appId").lean();
    if (!before) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await User.updateOne({ _id: userId }, { $set: { appId: cleanAppId } });

    await logAuditEvent({
      actorClerkId: auth.userId,
      actorName: auth.actorName,
      action: "app_id_assigned",
      resourceType: "user",
      resourceId: userId,
      before: { appId: before.appId || "" },
      after: { appId: cleanAppId },
      description: `กำหนด App "${cleanAppId}" ให้ ${before.name || userId}`,
    });

    return res.status(200).json({ success: true, message: "App ID updated successfully" });
  } catch (e) {
    console.error("update-app-id error:", e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
}
