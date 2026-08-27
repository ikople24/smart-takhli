// POST /api/permissions/repair-user  { mongoId, action }
// ซ่อม user doc ที่พังจากหน้า superadmin (แทน script backfill/one-off):
//   fill_name     เติมชื่อจาก Clerk ให้ doc ที่ "ยังไม่มีชื่อ" เท่านั้น (fallback email)
//   delete_stub   ลบ doc ที่เป็น stub จริงเท่านั้น (guard isStubDoc — ห้ามผ่อน)
//   delete_orphan ลบ doc ของบัญชีที่ถูกลบจาก Clerk แล้ว (server ยืนยัน 404 เอง)
// ใช้ได้กับ doc ทุกแอป (การซ่อมไม่จำกัดแอป)
// ระบุเป้าหมายด้วย mongoId (_id) ไม่ใช่ clerkId — เจาะจง doc เดียวเสมอ กันเคส clerkId ซ้ำ
// การลบ: เขียนสำเนา doc เต็มลง audit log "ก่อน" ลบเสมอ (await ตรง ๆ ไม่ fire-and-forget)

import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { requireSuperadmin } from "./_auth";
import { isStubDoc } from "@/lib/superadmin/usersOverview";
import { logAuditEvent } from "@/lib/auditLogger";
import AuditLog from "@/models/AuditLog";

const User =
  mongoose.models.User ||
  mongoose.model("User", new mongoose.Schema({}, { collection: "users", strict: false }));

const ACTIONS = ["fill_name", "delete_stub", "delete_orphan"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    const auth = await requireSuperadmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const { mongoId, action } = req.body || {};
    if (
      typeof mongoId !== "string" ||
      !mongoose.isValidObjectId(mongoId) ||
      !ACTIONS.includes(action)
    ) {
      return res.status(400).json({ success: false, message: "ต้องระบุ mongoId และ action ที่ถูกต้อง" });
    }

    await dbConnect();
    const doc = await User.findById(mongoId).lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: "ไม่พบ user doc นี้" });
    }
    const docClerkId = typeof doc.clerkId === "string" ? doc.clerkId : "";

    if (action === "fill_name") {
      if ((doc.name || "").trim() !== "") {
        return res.status(400).json({ success: false, message: "doc นี้มีชื่ออยู่แล้ว — fill_name ใช้เติมชื่อที่หายเท่านั้น" });
      }
      if (!docClerkId) {
        return res.status(400).json({ success: false, message: "doc ไม่มี clerkId ให้เทียบกับ Clerk" });
      }
      let cu;
      try {
        cu = await auth.client.users.getUser(docClerkId);
      } catch (e) {
        if (e?.status === 404) {
          return res.status(400).json({ success: false, message: "ไม่พบบัญชี Clerk นี้ — ถ้าบัญชีถูกลบแล้วให้ใช้ 'ลบ orphan' แทน" });
        }
        return res.status(502).json({ success: false, message: "ติดต่อ Clerk ไม่ได้ ลองใหม่ภายหลัง" });
      }
      const name =
        `${cu.firstName || ""} ${cu.lastName || ""}`.trim() ||
        cu.emailAddresses?.[0]?.emailAddress || "";
      if (!name) {
        return res.status(400).json({ success: false, message: "บัญชี Clerk ไม่มีชื่อ/อีเมลให้เติม" });
      }
      await User.updateOne({ _id: doc._id }, { $set: { name } });
      await logAuditEvent({
        actorClerkId: auth.userId,
        actorName: auth.actorName,
        action: "user_repaired",
        resourceType: "user",
        resourceId: docClerkId || mongoId,
        before: { name: doc.name || "" },
        after: { name },
        description: `เติมชื่อ "${name}" จาก Clerk ให้ user doc`,
      });
      return res.status(200).json({ success: true, name });
    }

    if (action === "delete_stub") {
      if (!isStubDoc(doc)) {
        return res.status(400).json({ success: false, message: "doc นี้ไม่ใช่ stub (มี name/appId/timestamps/สิทธิ์ที่เคยตั้ง) — ไม่ลบ" });
      }
    } else {
      // delete_orphan — ยืนยันกับ Clerk เองว่าบัญชีไม่มีจริง ไม่เชื่อสถานะจาก client
      if (!docClerkId) {
        return res.status(400).json({ success: false, message: "doc ไม่มี clerkId — ยืนยันสถานะ orphan ไม่ได้" });
      }
      try {
        await auth.client.users.getUser(docClerkId);
        return res.status(400).json({ success: false, message: "บัญชี Clerk ยังอยู่ — ไม่ใช่ orphan" });
      } catch (e) {
        if (e?.status !== 404) {
          return res.status(502).json({ success: false, message: "ตรวจสอบกับ Clerk ไม่ได้ ลองใหม่ภายหลัง" });
        }
      }
    }

    // สำเนากู้คืนต้องอยู่ใน audit log "ก่อน" ลบ — เขียนตรง ๆ (ถ้าเขียนไม่สำเร็จ โยน error → ไม่ลบ)
    await AuditLog.create({
      actorClerkId: auth.userId,
      actorName: auth.actorName,
      action: "user_doc_deleted",
      resourceType: "user",
      resourceId: docClerkId || mongoId,
      before: doc, // เก็บ doc เต็มไว้กู้คืน/ตรวจย้อนหลัง
      description:
        action === "delete_stub"
          ? `ลบ stub doc ของ ${docClerkId || mongoId}`
          : `ลบ orphan doc (บัญชี Clerk ถูกลบแล้ว) ของ ${docClerkId || mongoId}`,
      meta: { repairAction: action, mongoId },
    });
    const result = await User.deleteOne({ _id: doc._id });
    if (result.deletedCount === 0) {
      return res.status(409).json({ success: false, message: "doc ถูกเปลี่ยน/ลบไปแล้วระหว่างทำรายการ — รีเฟรชแล้วลองใหม่" });
    }
    return res.status(200).json({
      success: true,
      message: action === "delete_stub" ? "ลบ stub doc แล้ว (สำเนาอยู่ใน Audit Log)" : "ลบ orphan doc แล้ว (สำเนาอยู่ใน Audit Log)",
    });
  } catch (error) {
    console.error("repair-user error:", error?.message);
    return res.status(500).json({ success: false, message: error?.message });
  }
}
