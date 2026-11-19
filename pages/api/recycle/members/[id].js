// GET    /api/recycle/members/:id  → สมาชิก + ประวัติการฝากล่าสุด
// PUT    /api/recycle/members/:id  { fullName, phone, community, groupName, address, note, isActive }
// DELETE /api/recycle/members/:id  → ปิดการใช้งาน (soft) ไม่ลบข้อมูล
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import RecycleMember from "@/models/recycle/RecycleMember";
import RecycleDeposit from "@/models/recycle/RecycleDeposit";
import { withRecycleAuth } from "../_auth";
import { normalizeMemberInput } from "@/lib/recycle/validate";

export default async function handler(req, res) {
  const auth = await withRecycleAuth(req, res);
  if (!auth) return;
  await dbConnect();

  const { id } = req.query;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "รหัสสมาชิกไม่ถูกต้อง" });
  }

  if (req.method === "GET") {
    const member = await RecycleMember.findById(id).lean();
    if (!member) return res.status(404).json({ success: false, message: "ไม่พบสมาชิก" });
    const deposits = await RecycleDeposit.find({ memberId: id, voided: false })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return res.json({ success: true, member, deposits });
  }

  if (req.method === "PUT") {
    const { data, errors } = normalizeMemberInput(req.body);
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(", ") });

    if (data.phone) {
      const dup = await RecycleMember.findOne({ phone: data.phone, isActive: true, _id: { $ne: id } }).lean();
      if (dup) {
        return res.status(409).json({ success: false, message: `เบอร์นี้เป็นของ ${dup.fullName} (${dup.code})` });
      }
    }

    const update = { ...data };
    if (typeof req.body?.isActive === "boolean") update.isActive = req.body.isActive;
    const member = await RecycleMember.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!member) return res.status(404).json({ success: false, message: "ไม่พบสมาชิก" });

    // ชื่อ/ชุมชนเปลี่ยน → ไม่แก้ snapshot ในประวัติการฝากเดิม (ตั้งใจ)
    return res.json({ success: true, member });
  }

  if (req.method === "DELETE") {
    const member = await RecycleMember.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean();
    if (!member) return res.status(404).json({ success: false, message: "ไม่พบสมาชิก" });
    return res.json({ success: true, member });
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ success: false, message: "Method not allowed" });
}
