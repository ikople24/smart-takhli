import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "ต้องระบุคำค้น" });
  await dbConnect();
  const { searchBasemap } = await import("@/lib/m10-ingest/repository/index");
  const { results } = await searchBasemap(q);
  return res.status(200).json({ results });
}
