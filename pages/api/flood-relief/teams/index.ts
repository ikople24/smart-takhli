import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/dbConnect";
import FloodTeam from "@/models/flood-relief/FloodTeam";
import { teamDistanceKm } from "@/lib/flood-relief/derive";
import { fromGeoPoint, parseLatLng } from "@/lib/flood-relief/geo";
import { requireFloodAdmin } from "../_auth";

/**
 * GET /api/flood-relief/teams — รายชื่อทีมที่ใช้งานอยู่ (สำหรับ select มอบหมาย + หมุดทีม)
 * ระยะห่างถึงคำขอคำนวณที่ client ไม่ได้ (กติกา derived fields) → client ส่ง ?lat&lng มา server คิดให้
 * POST/PATCH ทีมอยู่ในขั้น 6
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }
  const auth = await requireFloodAdmin(req).catch(() => null);
  if (!auth) return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    await dbConnect();
    const at = parseLatLng(req.query.lat, req.query.lng);
    const teams = (await FloodTeam.find({ active: true }).sort({ name: 1 }).lean()) as Array<Record<string, unknown>>;
    return res.status(200).json({
      teams: teams.map((t) => {
        const loc = fromGeoPoint(t.lastLocation as { coordinates?: unknown });
        return {
          id: String(t._id),
          name: String(t.name ?? ""),
          department: String(t.department ?? ""),
          equipment: String(t.equipment ?? ""),
          status: t.status === "busy" ? "busy" : "idle",
          lat: loc?.lat ?? null,
          lng: loc?.lng ?? null,
          distanceKm: at ? teamDistanceKm(t as { lastLocation?: { coordinates?: unknown } }, at) : null,
        };
      }),
    });
  } catch (err) {
    console.error("[flood-relief/teams] GET", err);
    return res.status(500).json({ error: "โหลดทีมไม่สำเร็จ" });
  }
}
