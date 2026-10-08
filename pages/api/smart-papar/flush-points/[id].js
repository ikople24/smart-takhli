// PATCH  /api/smart-papar/flush-points/[id] — แก้ไขหัวโบล์จากหลังบ้าน (แอดมินที่มีสิทธิ์หน้าคุณภาพน้ำ)
// DELETE /api/smart-papar/flush-points/[id] — ลบจริง ได้เฉพาะหัวที่ไม่เคยถูกอ้างในบันทึกโบ (รวมบันทึกที่ลบแล้ว)
//        ถ้ามีบันทึกอ้างอยู่ → 409 ให้ "ปิดใช้งาน" แทน เพื่อไม่ให้ประวัติงานโบชี้ไปหัวที่ไม่มีอยู่
//        ไม่ลบรูปใน Cloudinary (cloud ใช้ร่วมกับแอปพี่น้อง ห้ามลบรูปเอง)
// แก้ได้: ชื่อจุด, ถนน/ซอย, ประเภท, ตำแหน่ง, รูป, สถานะใช้งาน · รหัส (code) เปลี่ยนไม่ได้
// ทุกการแก้ลงประวัติ (history) พร้อมค่าเดิม→ใหม่ เก็บล่าสุด MAX_HISTORY รายการ
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import FlushPoint from "@/models/smart-papar/FlushPoint";
import FlushingLog from "@/models/smart-papar/FlushingLog";
import { validateFlushPointInput, diffFlushPoint, MAX_HISTORY } from "@/lib/smart-papar/flushPointEdit";
import { requireSmartPaparAdmin } from "../water-quality/_auth";

const EDIT_FIELDS = ["name", "roadName", "kind", "photoUrl", "active", "lat", "lng"];

export default async function handler(req, res) {
  if (req.method !== "PATCH" && req.method !== "DELETE") {
    res.setHeader("Allow", "PATCH, DELETE");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const auth = await requireSmartPaparAdmin(req).catch(() => null);
  if (!auth) return res.status(500).json({ success: false, message: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  if (!auth.ok) return res.status(auth.status).json({ success: false, message: auth.message });

  const { id } = req.query;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "รหัสรายการไม่ถูกต้อง" });
  }

  try {
    await dbConnect();
    const existing = await FlushPoint.findById(id).lean();
    if (!existing) return res.status(404).json({ success: false, message: "ไม่พบหัวโบล์" });

    if (req.method === "DELETE") {
      const logCount = await FlushingLog.countDocuments({ flushPointId: existing._id });
      if (logCount > 0) {
        return res.status(409).json({
          success: false,
          message: `หัวนี้มีบันทึกโบ ${logCount} รายการ ลบไม่ได้ — ปิดใช้งานแทน`,
          logCount,
        });
      }
      await FlushPoint.deleteOne({ _id: existing._id });
      console.info(`[smart-papar] ลบหัวโบล์ ${existing.code} โดย ${auth.name || auth.userId}`);
      return res.status(200).json({ success: true, deleted: existing.code });
    }

    // merge ค่าเดิม + payload แล้ว validate ทั้งก้อน (ช่องที่ไม่ได้ส่งมาไม่ถูกรีเซ็ต)
    const body = req.body || {};
    const merged = {
      name: existing.name,
      roadName: existing.roadName,
      kind: existing.kind,
      photoUrl: existing.photoUrl,
      active: existing.active ?? true,
      lng: existing.location?.coordinates?.[0],
      lat: existing.location?.coordinates?.[1],
    };
    for (const k of EDIT_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, k)) merged[k] = body[k];
    }
    const v = validateFlushPointInput(merged);
    if (!v.ok) {
      return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบหรือไม่ถูกต้อง", errors: v.errors });
    }

    const changes = diffFlushPoint(existing, v.value);
    if (changes.length === 0) {
      return res.status(200).json({ success: true, data: existing, changed: false });
    }

    const updated = await FlushPoint.findByIdAndUpdate(
      id,
      {
        $set: { ...v.value, updatedByClerkId: auth.userId, updatedByName: auth.name || "" },
        $push: {
          history: {
            $each: [{ at: new Date(), byClerkId: auth.userId, byName: auth.name || "", action: "update", changes }],
            $slice: -MAX_HISTORY,
          },
        },
      },
      { new: true, runValidators: true }
    ).lean();
    return res.status(200).json({ success: true, data: updated, changed: true });
  } catch (error) {
    console.error("smart-papar flush-points PATCH error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
