import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../../_auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10-review");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  await dbConnect();
  const { rejectTransaction } = await import("@/lib/m10-ingest/repository/index");
  try {
    await rejectTransaction(req.query.id, auth.name || auth.userId);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: e?.message || "reject ล้มเหลว" });
  }
}
