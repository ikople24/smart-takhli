import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10-review");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  await dbConnect();
  const { M10Transaction } = await import("@/models/m10-ingest");
  const reviewStatus = req.query.reviewStatus || "pending";
  const rows = await M10Transaction.find({ reviewStatus })
    .sort({ txnDate: 1, createdAt: 1 })
    .select("docType recordKey deedNo rawStatus changeType taxRelevant txnDate regAmount owner reviewStatus")
    .limit(500).lean();
  return res.status(200).json({ items: rows });
}
