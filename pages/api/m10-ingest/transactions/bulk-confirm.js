import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../_auth";

// ยืนยันหลายรายการในคำขอเดียว — ยิงทีละรายการจากเบราว์เซอร์ช้าเกินไปเมื่อคิวมีเป็นร้อย
const MAX_PER_CALL = 500;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
  if (ids.length === 0) return res.status(400).json({ error: "ไม่ได้เลือกรายการ" });
  if (ids.length > MAX_PER_CALL) {
    return res.status(400).json({ error: `ยืนยันได้ครั้งละไม่เกิน ${MAX_PER_CALL} รายการ` });
  }

  await dbConnect();
  const { confirmTransaction } = await import("@/lib/m10-ingest/repository/index");
  const by = auth.name || auth.userId;

  // ทำทีละรายการ — รายการที่พังต้องไม่ทำให้รายการที่เหลือไม่ถูกยืนยัน
  const confirmed = [];
  const failed = [];
  for (const id of ids) {
    try {
      await confirmTransaction(id, by);
      confirmed.push(id);
    } catch (e) {
      failed.push({ id, error: e?.message || "ยืนยันไม่สำเร็จ" });
    }
  }
  return res.status(200).json({ confirmed, failed });
}
