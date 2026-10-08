// บันทึกโบตะกอนรายตัว — PATCH แก้ไข · DELETE ลบ (soft delete)
// เจ้าของแก้/ลบได้ภายใน 7 วัน · superadmin ได้เสมอ (canModifyFlushingLog)
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import FlushingLog from "@/models/smart-papar/FlushingLog";
import { requireSmartPaparAdmin } from "../water-quality/_auth";
import { validateFlushingInput, canModifyFlushingLog } from "@/lib/smart-papar/flushing";
import { attachFlushPoint } from "@/lib/smart-papar/attachFlushPoint";

const EDIT_FIELDS = [
  "flushedAt",
  "locationName",
  "durationMin",
  "turbidityBeforeNtu",
  "turbidityAfterNtu",
  "result",
  "photosBefore",
  "photosAfter",
  "note",
  "flushPointId",
];

export default async function handler(req, res) {
  const auth = await requireSmartPaparAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  const { id } = req.query;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "รหัสรายการไม่ถูกต้อง" });
  }

  await dbConnect();

  try {
    const existing = await FlushingLog.findOne({ _id: id, deletedAt: null }).lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: "ไม่พบรายการ" });
    }
    if (!canModifyFlushingLog(existing, auth)) {
      return res
        .status(403)
        .json({ success: false, message: "แก้ไขได้เฉพาะผู้บันทึก ภายใน 7 วันหลังบันทึก" });
    }

    if (req.method === "PATCH") {
      // merge ข้อมูลเดิม + payload แล้ว validate ทั้งก้อน (กันช่องที่ไม่ได้ส่งมาถูกรีเซ็ต)
      const body = req.body || {};
      const merged = {
        ...Object.fromEntries(EDIT_FIELDS.map((k) => [k, existing[k]])),
        lng: existing.location?.coordinates?.[0],
        lat: existing.location?.coordinates?.[1],
      };
      for (const k of [...EDIT_FIELDS, "lat", "lng"]) {
        if (Object.prototype.hasOwnProperty.call(body, k)) merged[k] = body[k];
      }
      const v = validateFlushingInput(merged);
      if (!v.ok) {
        return res
          .status(400)
          .json({ success: false, message: "ข้อมูลไม่ครบหรือไม่ถูกต้อง", errors: v.errors });
      }
      const fp = await attachFlushPoint(v.value);
      if (!fp.ok) {
        return res
          .status(400)
          .json({ success: false, message: "ข้อมูลไม่ครบหรือไม่ถูกต้อง", errors: fp.errors });
      }
      const updated = await FlushingLog.findByIdAndUpdate(
        id,
        { $set: { ...fp.value, updatedByClerkId: auth.userId, updatedByName: auth.name || "" } },
        { new: true }
      ).lean();
      return res.status(200).json({ success: true, data: updated });
    }

    if (req.method === "DELETE") {
      await FlushingLog.updateOne(
        { _id: id },
        {
          $set: {
            deletedAt: new Date(),
            updatedByClerkId: auth.userId,
            updatedByName: auth.name || "",
          },
        }
      );
      return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", ["PATCH", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("smart-papar flushing [id] error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
