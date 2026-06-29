import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../../_auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  await dbConnect();
  const { resolveReconcile } = await import("@/lib/m10-ingest/repository/index");
  const by = auth.name || auth.userId;
  try {
    const r = await resolveReconcile(String(req.query.recordKey), by, req.body || {});
    return res.status(200).json(r);
  } catch (e) {
    return res.status(400).json({ error: e?.message || "บันทึกไม่สำเร็จ" });
  }
}
