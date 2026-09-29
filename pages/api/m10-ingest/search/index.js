import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../_auth";

const PER_PAGE = 20;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.status(400).json({ error: "คำค้นต้องมีอย่างน้อย 2 ตัวอักษร" });

  const skip = Math.max(0, Number(req.query.skip) || 0);

  await dbConnect();
  const { searchM10Transactions } = await import("@/lib/m10-ingest/repository/index");
  const { rows, hasMore } = await searchM10Transactions(q, { skip, limit: PER_PAGE });
  return res.status(200).json({ rows, hasMore });
}
