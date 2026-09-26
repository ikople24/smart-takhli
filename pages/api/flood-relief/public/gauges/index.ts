import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/dbConnect";
import FloodGauge from "@/models/flood-relief/FloodGauge";
import { parseGaugeCreate, parseGaugePhoto } from "@/lib/flood-relief/gauge";
import { toGeoPoint } from "@/lib/flood-relief/geo";
import { loadFloodSettings } from "@/lib/flood-relief/loadSettings";
import { publicPointQuotaLeft } from "@/lib/flood-relief/publicPoints";
import { clientIp } from "@/lib/flood-relief/rateLimit";

/**
 * POST /api/flood-relief/public/gauges — ประชาชนปักจุดวัดน้ำใหม่จากหน้า /flood (ไม่ต้องล็อกอิน — เจ้าของขอ 2026-09-26 "ช่วยกันปัก")
 * { name, lat, lng, note?, url (รูป Cloudinary — บังคับ), levelCm?, photoNote? }
 * กติกา: รับเฉพาะตอนศูนย์ฯ เปิด · kind บังคับเป็น gauge (จุดแจกน้ำ/รับบริจาคปักได้เฉพาะเจ้าหน้าที่) · 3 จุด/ชม./IP
 * ขึ้นหน้าสาธารณะทันทีพร้อมป้าย "ภาพจากประชาชน" — เจ้าหน้าที่ซ่อนได้ที่แดชบอร์ด
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "รองรับเฉพาะ POST" });
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const point = parseGaugeCreate({ name: body.name, lat: body.lat, lng: body.lng, note: body.note });
  if (!point.ok) return res.status(400).json({ error: point.error });
  const photo = parseGaugePhoto({ url: body.url, levelCm: body.levelCm, note: body.photoNote });
  if (!photo.ok) return res.status(400).json({ error: photo.ok === false ? "กรุณาแนบรูประดับน้ำ" : "" });

  try {
    await dbConnect();
    const settings = await loadFloodSettings();
    if (!settings.centerOpen) return res.status(403).json({ error: "ศูนย์ฯ ยังไม่เปิดรับข้อมูลจากประชาชน" });

    const ip = clientIp(req.headers, req.socket?.remoteAddress);
    if (!(await publicPointQuotaLeft(ip, "create"))) {
      return res.status(429).json({ error: "ปักจุดถี่เกินไป กรุณารอสักครู่" });
    }
    const now = new Date();
    const doc = await FloodGauge.create({
      name: point.name,
      kind: "gauge",
      source: "public",
      clientIp: ip,
      location: toGeoPoint(point.point),
      note: point.note,
      photos: [{ url: photo.url, at: now, levelCm: photo.levelCm, note: photo.note, by: "", source: "public", clientIp: ip }],
      lastPhotoUrl: photo.url,
      lastPhotoAt: now,
      lastLevelCm: photo.levelCm,
      lastNote: photo.note,
      lastSource: "public",
      createdBy: "ประชาชน",
      updatedBy: "ประชาชน",
    });
    return res.status(201).json({ id: String(doc._id) });
  } catch (err) {
    console.error("[flood-relief/public/gauges] POST", err);
    return res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
  }
}
