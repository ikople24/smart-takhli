// PUT    /api/recycle/rewards/:id  แก้ไขของรางวัล (ราคา กก. / จำนวนคงเหลือ / เปิด-ปิด)
// DELETE /api/recycle/rewards/:id  ปิดการแลก (soft) — ประวัติการแลกเดิมเก็บ snapshot ไว้แล้ว
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import RecycleReward from "@/models/recycle/RecycleReward";
import { withRecycleAuth } from "../_auth";
import { normalizeRewardInput } from "@/lib/recycle/balance";

export default async function handler(req, res) {
  const auth = await withRecycleAuth(req, res);
  if (!auth) return;
  await dbConnect();

  const { id } = req.query;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "รหัสของรางวัลไม่ถูกต้อง" });
  }

  if (req.method === "PUT") {
    const { data, errors } = normalizeRewardInput(req.body);
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(", ") });
    const reward = await RecycleReward.findByIdAndUpdate(id, data, { new: true }).lean();
    if (!reward) return res.status(404).json({ success: false, message: "ไม่พบของรางวัล" });
    return res.json({ success: true, reward });
  }

  if (req.method === "DELETE") {
    const reward = await RecycleReward.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean();
    if (!reward) return res.status(404).json({ success: false, message: "ไม่พบของรางวัล" });
    return res.json({ success: true, reward });
  }

  res.setHeader("Allow", "PUT, DELETE");
  return res.status(405).json({ success: false, message: "Method not allowed" });
}
