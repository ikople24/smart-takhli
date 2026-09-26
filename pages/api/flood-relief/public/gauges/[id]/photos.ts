import type { NextApiRequest, NextApiResponse } from "next";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import FloodGauge from "@/models/flood-relief/FloodGauge";
import { MAX_GAUGE_PHOTOS, parseGaugePhoto } from "@/lib/flood-relief/gauge";
import { loadFloodSettings } from "@/lib/flood-relief/loadSettings";
import { publicPointQuotaLeft } from "@/lib/flood-relief/publicPoints";
import { clientIp } from "@/lib/flood-relief/rateLimit";

/**
 * POST /api/flood-relief/public/gauges/[id]/photos — ประชาชนส่งรูปอัปเดตเข้าจุดวัดน้ำเดิม (ไม่ต้องล็อกอิน)
 * { url (Cloudinary), levelCm?, note? } · เฉพาะจุดวัดน้ำที่เปิดใช้งาน (ไม่ใช่จุดแจกน้ำ/รับบริจาค) · ศูนย์ฯ ต้องเปิด · 10 รูป/ชม./IP
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "รองรับเฉพาะ POST" });
  }
  const id = String(req.query.id ?? "");
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "รหัสจุดไม่ถูกต้อง" });
  const v = parseGaugePhoto(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });

  try {
    await dbConnect();
    const settings = await loadFloodSettings();
    if (!settings.centerOpen) return res.status(403).json({ error: "ศูนย์ฯ ยังไม่เปิดรับข้อมูลจากประชาชน" });
    const ip = clientIp(req.headers, req.socket?.remoteAddress);
    if (!(await publicPointQuotaLeft(ip, "photo"))) return res.status(429).json({ error: "ส่งรูปถี่เกินไป กรุณารอสักครู่" });

    const now = new Date();
    // kind ไม่มีค่า (เอกสารเก่า) = จุดวัดน้ำ
    const r = await FloodGauge.updateOne(
      { _id: id, active: true, kind: { $in: ["gauge", null] } },
      {
        $push: {
          photos: {
            $each: [{ url: v.url, at: now, levelCm: v.levelCm, note: v.note, by: "", source: "public", clientIp: ip }],
            $slice: -MAX_GAUGE_PHOTOS,
          },
        },
        $set: { lastPhotoUrl: v.url, lastPhotoAt: now, lastLevelCm: v.levelCm, lastNote: v.note, lastSource: "public" },
      }
    );
    return r.matchedCount ? res.status(201).json({ ok: true }) : res.status(404).json({ error: "ไม่พบจุดวัดน้ำนี้" });
  } catch (err) {
    console.error("[flood-relief/public/gauges/[id]/photos] POST", err);
    return res.status(500).json({ error: "บันทึกรูปไม่สำเร็จ" });
  }
}
