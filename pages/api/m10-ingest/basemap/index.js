import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  const parts = String(req.query.bbox || "").split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return res.status(400).json({ error: "bbox ต้องเป็น minLng,minLat,maxLng,maxLat" });
  }
  await dbConnect();
  const { listBasemapInBbox } = await import("@/lib/m10-ingest/repository/index");
  const limit = Math.min(Number(req.query.limit) || 800, 2000);
  const { features, truncated } = await listBasemapInBbox(parts, limit);
  return res.status(200).json({ type: "FeatureCollection", features, truncated });
}
