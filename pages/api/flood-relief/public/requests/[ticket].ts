import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/dbConnect";
import FloodRequest from "@/models/flood-relief/FloodRequest";
import { accessKeyMatches } from "@/lib/flood-relief/accessKey";
import { PUBLIC_REQUEST_SELECT, publicRequest } from "@/lib/flood-relief/derive";
import { loadFloodSettings } from "@/lib/flood-relief/loadSettings";
import { parseTicket } from "@/lib/flood-relief/ticket";

/**
 * GET /api/flood-relief/public/requests/[ticket]?k=<กุญแจ>  — สาธารณะ (หน้าสถานะ ไม่ต้องล็อกอิน)
 * มีกุญแจถูกต้อง = เห็นรายละเอียด (จุดสังเกต ชุมชน จำนวนคน เบอร์ปิดบางส่วน) · ไม่มี = เห็นแค่ความคืบหน้า
 * ห้ามคืน phone เต็ม / lineUserId / notes / reporterName / พิกัด — whitelist อยู่ที่ publicRequest()
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }
  const parsed = parseTicket(req.query.ticket);
  if (!parsed) return res.status(400).json({ error: "เลขที่คำขอไม่ถูกต้อง" });

  try {
    await dbConnect();
    const [doc, settings] = await Promise.all([
      FloodRequest.findOne({ ticket: parsed.ticket }).select(`${PUBLIC_REQUEST_SELECT} +accessKey`).lean(),
      loadFloodSettings(),
    ]);
    if (!doc) return res.status(404).json({ error: "ไม่พบคำขอนี้" });

    const d = doc as Record<string, unknown>;
    const full = accessKeyMatches(req.query.k, d.accessKey);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      request: publicRequest(d as Parameters<typeof publicRequest>[0], full),
      hotline: settings.hotline,
      callbackSlaMin: settings.callbackSlaMin,
    });
  } catch (err) {
    console.error("[flood-relief/public/requests/[ticket]] GET", err);
    return res.status(500).json({ error: "โหลดสถานะไม่สำเร็จ" });
  }
}
