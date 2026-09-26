import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/dbConnect";
import FloodRequest from "@/models/flood-relief/FloodRequest";
import { toGeoPoint } from "@/lib/flood-relief/geo";
import { locate } from "@/lib/flood-relief/locate";
import { nextTicket } from "@/lib/flood-relief/nextTicket";
import { notifyNewRequest } from "@/lib/flood-relief/notify";
import { clientIp, isRateLimited, rateLimitSince } from "@/lib/flood-relief/rateLimit";
import { validateRequestInput } from "@/lib/flood-relief/validate";

/**
 * POST /api/flood-relief/public/requests — สาธารณะ (ผู้ประสบภัยไม่ต้องล็อกอิน) + rate-limit ต่อ IP/เบอร์
 * body: { type, lat, lng, phone, accuracyM?, urgency?, landmark?, peopleCount?, reporterName?, detail?, images? }
 * สร้างคำขอ → จัดชุมชน/โซนจากพิกัดฝั่ง server → แจ้ง LINE กลุ่มศูนย์ฯ → คืน { ticket } เท่านั้น
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "รองรับเฉพาะ POST" });
  }

  const v = validateRequestInput(req.body);
  if (!v.ok) return res.status(400).json({ error: "กรอกข้อมูลไม่ครบ", fields: v.errors });
  const input = v.value;

  try {
    await dbConnect();

    const ip = clientIp(req.headers, req.socket?.remoteAddress);
    const since = rateLimitSince();
    const [byIp, byPhone] = await Promise.all([
      ip ? FloodRequest.countDocuments({ clientIp: ip, createdAt: { $gte: since } }) : 0,
      FloodRequest.countDocuments({ phone: input.phone, createdAt: { $gte: since } }),
    ]);
    if (isRateLimited({ byIp, byPhone }, Boolean(ip))) {
      return res.status(429).json({ error: "ส่งคำขอถี่เกินไป กรุณาโทรศูนย์ฯ 056-261-500" });
    }

    const [{ communityName, zone }, ticket] = await Promise.all([locate(input.point), nextTicket()]);
    const now = new Date();

    await FloodRequest.create({
      ticket,
      type: input.type,
      urgency: input.urgency,
      status: "received",
      location: toGeoPoint(input.point),
      accuracyM: input.accuracyM,
      landmark: input.landmark,
      peopleCount: input.peopleCount,
      reporterName: input.reporterName,
      phone: input.phone,
      detail: input.detail,
      images: input.images,
      communityName,
      communitySource: "auto",
      zoneId: zone?._id ?? null,
      zoneName: zone?.name ?? null,
      zoneLevel: zone?.level ?? null,
      timeline: [{ at: now, event: "รับเรื่องผ่านฟอร์มหน้าเว็บ", by: "" }],
      source: "web",
      clientIp: ip,
    });

    notifyNewRequest({
      ticket,
      type: input.type,
      urgency: input.urgency,
      point: input.point,
      communityName,
      zoneName: zone?.name ?? null,
      zoneLevel: zone?.level ?? null,
      landmark: input.landmark,
      peopleCount: input.peopleCount,
      createdAt: now,
    });

    return res.status(201).json({ ticket });
  } catch (err) {
    console.error("[flood-relief/public/requests] POST", err);
    return res.status(500).json({ error: "บันทึกคำขอไม่สำเร็จ กรุณาโทรศูนย์ฯ 056-261-500" });
  }
}
