import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "./_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10-records");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  await dbConnect();
  const { asOfMaterialize } = await import("@/lib/m10-ingest/repository/index");
  // asOf ว่าง = ปัจจุบัน (วันนี้)
  const cutoff = req.query.asOf ? new Date(String(req.query.asOf)) : new Date();
  if (isNaN(cutoff.getTime())) return res.status(400).json({ error: "asOf ไม่ใช่วันที่ที่ถูกต้อง (YYYY-MM-DD)" });
  const records = await asOfMaterialize(cutoff);
  return res.status(200).json({ asOf: cutoff.toISOString().slice(0, 10), count: records.length, records });
}
