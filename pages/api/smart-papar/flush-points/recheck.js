// /api/smart-papar/flush-points/recheck — รีเช็คทะเบียนหัวโบล์จากงานโบหน้างาน (แอดมินที่มีสิทธิ์หน้าคุณภาพน้ำ)
// GET  : บันทึกโบที่ยังไม่ผูกหัวโบล์ (และยังไม่ถูกกด "ไม่ใช่หัวโบล์") — อาจเป็นหัวใหม่ที่ทะเบียนยังไม่มี
// POST : { logId, action: "link", flushPointId, moveFlushPoint? } ผูกบันทึกเข้ากับหัวในทะเบียน
//        moveFlushPoint: true → ย้ายตำแหน่งหัวในทะเบียนมาที่ GPS หน้างานของบันทึกนี้ด้วย (ลง history) — ใช้กับหัวที่
//        ตำแหน่งทะเบียนคลาดไกลจาก GPS สำรวจเดิม
//        { logId, action: "dismiss" }             ยืนยันว่าไม่ใช่หัวโบล์ ไม่ต้องขึ้นรายการอีก
// แก้เฉพาะช่องผูกหัว — ไม่แตะเนื้อหาบันทึกโบ (บันทึกภาคสนามเจ้าของแก้เองไม่ได้ แต่แอดมินผูกหัวให้ได้)
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import FlushPoint from "@/models/smart-papar/FlushPoint";
import FlushingLog from "@/models/smart-papar/FlushingLog";
import { requireSmartPaparAdmin } from "../water-quality/_auth";
import { distanceM } from "@/lib/smart-papar/flushPoints";
import { MAX_HISTORY } from "@/lib/smart-papar/flushPointEdit";

const UNLINKED = { deletedAt: null, flushPointId: null, flushPointReview: { $ne: "dismissed" } };

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  const auth = await requireSmartPaparAdmin(req).catch(() => null);
  if (!auth) return res.status(500).json({ success: false, message: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  if (!auth.ok) return res.status(auth.status).json({ success: false, message: auth.message });

  try {
    await dbConnect();

    if (req.method === "GET") {
      const logs = await FlushingLog.find(UNLINKED)
        .select({ locationName: 1, location: 1, flushedAt: 1, createdByName: 1, source: 1, result: 1, photosBefore: 1, photosAfter: 1, note: 1 })
        .sort({ flushedAt: -1 })
        .limit(500)
        .lean();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ success: true, data: logs });
    }

    const { logId, action, flushPointId } = req.body || {};
    if (!mongoose.isValidObjectId(logId)) {
      return res.status(400).json({ success: false, message: "รหัสบันทึกไม่ถูกต้อง" });
    }
    const log = await FlushingLog.findOne({ _id: logId, ...UNLINKED }).select({ _id: 1, location: 1 }).lean();
    if (!log) {
      return res.status(409).json({ success: false, message: "บันทึกนี้ถูกผูกหัวหรือรีเช็คไปแล้ว — โหลดรายการใหม่" });
    }

    if (action === "dismiss") {
      await FlushingLog.updateOne(
        { _id: logId },
        { $set: { flushPointReview: "dismissed", updatedByClerkId: auth.userId, updatedByName: auth.name || "" } }
      );
      return res.status(200).json({ success: true });
    }

    if (action === "link") {
      if (!mongoose.isValidObjectId(flushPointId)) {
        return res.status(400).json({ success: false, message: "หัวโบล์ไม่ถูกต้อง" });
      }
      const point = await FlushPoint.findById(flushPointId).select({ code: 1, location: 1 }).lean();
      if (!point) return res.status(404).json({ success: false, message: "ไม่พบหัวโบล์" });
      let movedM = null;
      if (req.body?.moveFlushPoint === true) {
        const [lng1, lat1] = point.location.coordinates;
        const [lng2, lat2] = log.location.coordinates;
        movedM = Math.round(distanceM(lat1, lng1, lat2, lng2));
        const ll = (lat, lng) => `${lat.toFixed(6)},${lng.toFixed(6)}`;
        await FlushPoint.updateOne(
          { _id: point._id },
          {
            $set: {
              location: { type: "Point", coordinates: log.location.coordinates },
              updatedByClerkId: auth.userId,
              updatedByName: auth.name || "",
            },
            $push: {
              history: {
                $each: [
                  {
                    at: new Date(),
                    byClerkId: auth.userId,
                    byName: `${auth.name || ""} (ย้ายตามงานโบ)`.trim(),
                    action: "update",
                    changes: [{ field: "location", from: ll(lat1, lng1), to: ll(lat2, lng2), movedM }],
                  },
                ],
                $slice: -MAX_HISTORY,
              },
            },
          }
        );
      }
      await FlushingLog.updateOne(
        { _id: logId },
        {
          $set: {
            flushPointId: point._id,
            flushPointCode: point.code,
            updatedByClerkId: auth.userId,
            updatedByName: auth.name || "",
          },
        }
      );
      return res.status(200).json({
        success: true,
        flushPointCode: point.code,
        movedM,
        location: movedM === null ? point.location : { type: "Point", coordinates: log.location.coordinates },
      });
    }

    return res.status(400).json({ success: false, message: "action ต้องเป็น link หรือ dismiss" });
  } catch (error) {
    console.error("smart-papar flush-points recheck error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
