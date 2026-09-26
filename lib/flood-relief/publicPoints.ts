// lib/flood-relief/publicPoints.ts (server-only)
// ประชาชนปักจุดวัดน้ำ/ส่งรูปจากหน้า /flood — นับโควตาต่อ IP จาก flood_gauges ตรง ๆ (ไม่มี store แยก)

import FloodGauge from "@/models/flood-relief/FloodGauge";
import { PUBLIC_POINT_LIMIT } from "./gauge";
import { rateLimitSince } from "./rateLimit";

export async function publicPointQuotaLeft(ip: string, kind: "create" | "photo", now: Date = new Date()): Promise<boolean> {
  if (!ip) return true; // หา IP ไม่ได้ ไม่นับ (เหมือน rate-limit คำขอช่วยเหลือ)
  const since = rateLimitSince(now);
  if (kind === "create") {
    const n = await FloodGauge.countDocuments({ source: "public", clientIp: ip, createdAt: { $gte: since } });
    return n < PUBLIC_POINT_LIMIT.createPerHour;
  }
  const [r] = await FloodGauge.aggregate<{ n: number }>([
    { $match: { "photos.clientIp": ip } },
    { $unwind: "$photos" },
    { $match: { "photos.clientIp": ip, "photos.at": { $gte: since } } },
    { $count: "n" },
  ]);
  return (r?.n ?? 0) < PUBLIC_POINT_LIMIT.photoPerHour;
}
