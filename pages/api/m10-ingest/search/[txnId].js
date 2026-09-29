import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  await dbConnect();
  const { getM10TransactionDetail } = await import("@/lib/m10-ingest/repository/index");
  const detail = await getM10TransactionDetail(String(req.query.txnId || ""));
  if (!detail) return res.status(404).json({ error: "ไม่พบรายการนี้" });
  return res.status(200).json(detail);
}
