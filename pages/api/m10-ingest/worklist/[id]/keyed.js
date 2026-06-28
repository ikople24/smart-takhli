import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../../_auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  await dbConnect();
  const { markKeyed } = await import("@/lib/m10-ingest/repository/index");
  await markKeyed(req.query.id, auth.name || auth.userId);
  return res.status(200).json({ ok: true });
}
