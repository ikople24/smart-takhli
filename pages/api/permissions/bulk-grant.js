// POST /api/permissions/bulk-grant  { pagePath, userIds, mode: "grant" | "revoke" }
// ให้/ถอนสิทธิ์ 1 หน้าแก่ user หลายคนพร้อมกัน — แทน script ตระกูล scripts/grant-*
//
// กติกา (ดู lib/superadmin/bulkGrant):
//   - pagePath ต้องอยู่ใน ALL_PAGES
//   - user ต่างแอป/หา doc ไม่เจอ → ปฏิเสธทั้ง request (400)
//   - user ที่ allowedPages ว่าง (ใช้ default) → ข้าม + รายงานกลับ
// userIds ถูก dedupe และบังคับเป็น string ก่อนใช้ (กัน id ซ้ำ/injection)

import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { requireSuperadmin } from "./_auth";
import { ALL_PAGES } from "@/lib/permissions";
import { planBulkGrant } from "@/lib/superadmin/bulkGrant";
import { logAuditEvent } from "@/lib/auditLogger";
import User from "./_userModel";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    const auth = await requireSuperadmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    // ถ้า env ไม่ตั้ง APP_ID การเทียบแอปใน planBulkGrant จะเพี้ยนทั้งเส้น — ตัดจบก่อน
    if (!CURRENT_APP_ID) {
      return res.status(500).json({ success: false, message: "NEXT_PUBLIC_APP_ID ไม่ถูกตั้งค่า" });
    }

    const { pagePath, userIds, mode } = req.body || {};
    if (!["grant", "revoke"].includes(mode) || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: "ต้องระบุ mode (grant|revoke) และ userIds" });
    }
    if (!ALL_PAGES.some((p) => p.path === pagePath)) {
      return res.status(400).json({ success: false, message: "pagePath ไม่อยู่ในรายการหน้า (ALL_PAGES)" });
    }

    // dedupe + บังคับเป็น string + ต้องเป็น ObjectId จริง (กัน operator object หลุดเข้า query)
    const ids = [...new Set(userIds.map(String))];
    if (!ids.every((id) => mongoose.isValidObjectId(id))) {
      return res.status(400).json({ success: false, message: "userIds มีค่าที่ไม่ใช่ id ที่ถูกต้อง" });
    }

    await dbConnect();
    const docs = await User.find({ _id: { $in: ids } }).lean();
    const plan = planBulkGrant(docs, ids, CURRENT_APP_ID, { mode, pagePath });

    if (plan.notFound.length > 0 || plan.crossApp.length > 0) {
      return res.status(400).json({
        success: false,
        message: "มี user ที่ไม่ใช่ของแอปนี้หรือหาไม่เจอ — ไม่ทำรายการใด",
        crossApp: plan.crossApp,
        notFound: plan.notFound,
      });
    }

    if (plan.applyIds.length === 0) {
      return res.status(200).json({
        success: true,
        applied: 0,
        modified: 0,
        skippedDefault: plan.skippedDefault,
        skippedWouldEmpty: plan.skippedWouldEmpty,
      });
    }

    const op =
      mode === "grant"
        ? { $addToSet: { allowedPages: pagePath } }
        : { $pull: { allowedPages: pagePath } };
    const result = await User.updateMany(
      {
        _id: { $in: plan.applyIds },
        appId: CURRENT_APP_ID,
        "allowedPages.0": { $exists: true },
        isArchived: { $ne: true },
      },
      op
    );

    await logAuditEvent({
      actorClerkId: auth.userId,
      actorName: auth.actorName,
      action: "permissions_bulk_updated",
      resourceType: "user",
      description: `${mode === "grant" ? "ให้" : "ถอน"}สิทธิ์ ${pagePath} แก่ ${plan.applyIds.length} คน (ข้าม ${plan.skippedDefault.length} คนที่ใช้ default / ข้าม ${plan.skippedWouldEmpty.length} คนที่จะเหลือ 0 หน้า)`,
      meta: { pagePath, mode, applied: plan.applyIds, skippedDefault: plan.skippedDefault, skippedWouldEmpty: plan.skippedWouldEmpty, matchedCount: result.matchedCount, modifiedCount: result.modifiedCount },
    });

    return res.status(200).json({
      success: true,
      applied: plan.applyIds.length,
      modified: result.modifiedCount,
      skippedDefault: plan.skippedDefault,
      skippedWouldEmpty: plan.skippedWouldEmpty,
    });
  } catch (error) {
    console.error("bulk-grant error:", error?.message);
    return res.status(500).json({ success: false, message: error?.message });
  }
}
