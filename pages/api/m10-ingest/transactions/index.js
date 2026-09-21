import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const VALID = ["pending", "confirmed", "rejected", "auto"];
  const reviewStatus = VALID.includes(req.query.reviewStatus) ? req.query.reviewStatus : "pending";

  await dbConnect();
  const { M10Transaction } = await import("@/models/m10-ingest");
  const rows = await M10Transaction.find({ reviewStatus })
    .sort({ txnDate: 1, createdAt: 1 })
    // payloadRaw.AREA = เนื้อที่สิ่งปลูกสร้าง (ตร.ม.) — เจาะจงฟิลด์เดียว ห้ามดึง payloadRaw ทั้งก้อนเพราะมีเลขบัตร
    .select("docType recordKey deedNo rawStatus changeType taxRelevant txnDate regAmount area payloadRaw.AREA owner.title owner.name owner.surname owner.fullName reviewStatus")
    .limit(500).lean();
  return res.status(200).json({ items: rows });
}
