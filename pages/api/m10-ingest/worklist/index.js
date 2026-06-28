import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  await dbConnect();
  const { listWorklistPending } = await import("@/lib/m10-ingest/repository/index");
  const items = await listWorklistPending({
    period: req.query.period || undefined,
    changeType: req.query.changeType || undefined,
  });
  return res.status(200).json({ items });
}
