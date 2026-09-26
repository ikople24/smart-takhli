import type { NextApiRequest, NextApiResponse } from "next";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import FloodGauge from "@/models/flood-relief/FloodGauge";
import { MAX_GAUGE_PHOTOS, parseGaugePhoto } from "@/lib/flood-relief/gauge";
import { requireFloodAdmin } from "../../_auth";

/**
 * POST /api/flood-relief/gauges/[id]/photos — ส่งรูประดับน้ำล่าสุด { url (Cloudinary), levelCm?, note? } (admin ทุกคน)
 * เก็บประวัติ MAX_GAUGE_PHOTOS รูปล่าสุด + คัดลอกเป็น last* ให้หน้าสาธารณะอ่าน
 * ⚠️ รูปขึ้นหน้าสาธารณะ /flood — เจ้าหน้าที่ควรถ่ายระดับน้ำ ไม่ถ่ายหน้าคน/บ้านเลขที่
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "รองรับเฉพาะ POST" });
  }
  const auth = await requireFloodAdmin(req).catch(() => null);
  if (!auth) return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  const id = String(req.query.id ?? "");
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "รหัสจุดวัดไม่ถูกต้อง" });

  const v = parseGaugePhoto(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });

  try {
    await dbConnect();
    const now = new Date();
    const r = await FloodGauge.updateOne(
      { _id: id },
      {
        $push: {
          photos: {
            $each: [{ url: v.url, at: now, levelCm: v.levelCm, note: v.note, by: auth.name, byClerkId: auth.userId, source: "staff" }],
            $slice: -MAX_GAUGE_PHOTOS,
          },
        },
        $set: { lastPhotoUrl: v.url, lastPhotoAt: now, lastLevelCm: v.levelCm, lastNote: v.note, lastSource: "staff", updatedBy: auth.name },
      }
    );
    return r.matchedCount ? res.status(201).json({ ok: true }) : res.status(404).json({ error: "ไม่พบจุดวัด" });
  } catch (err) {
    console.error("[flood-relief/gauges/[id]/photos]", err);
    return res.status(500).json({ error: "บันทึกรูปไม่สำเร็จ" });
  }
}
