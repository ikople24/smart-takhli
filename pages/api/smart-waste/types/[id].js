import dbConnect from "@/lib/dbConnect";
import WasteType from "@/models/smart-waste/WasteType";
import WasteDaily from "@/models/smart-waste/WasteDaily";
import { requireWasteAdmin } from "../_auth";

export default async function handler(req, res) {
  const auth = await requireWasteAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  await dbConnect();
  const { id } = req.query;
  const type = await WasteType.findById(id);
  if (!type) return res.status(404).json({ message: "ไม่พบประเภทขยะนี้" });

  if (req.method === "PATCH") {
    const { label, isCommon, isHighlighted, active, order } = req.body || {};

    // key และ group แก้ไม่ได้ — WasteDaily.entries snapshot ทั้งคู่ไว้แล้ว
    // เปลี่ยนทีหลังจะทำให้ยอดย้อนหลังกับ master ไม่ตรงกันโดยไม่มีใครรู้
    if (label !== undefined) {
      if (!String(label).trim()) {
        return res.status(400).json({ message: "ชื่อประเภทว่างไม่ได้" });
      }
      type.label = String(label).trim();
    }
    if (isCommon !== undefined) type.isCommon = Boolean(isCommon);
    if (isHighlighted !== undefined) type.isHighlighted = Boolean(isHighlighted);
    if (active !== undefined) type.active = Boolean(active);
    if (order !== undefined && Number.isFinite(Number(order))) {
      type.order = Number(order);
    }

    type.updatedByClerkId = auth.userId;
    type.updatedByName = auth.name;
    await type.save();

    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const usedDays = await WasteDaily.countDocuments({ "entries.typeKey": type.key });
    if (usedDays > 0) {
      return res.status(409).json({
        message: `ลบไม่ได้ — มีข้อมูลอ้างถึงประเภทนี้ ${usedDays} วัน ปิดใช้งานแทนได้`,
        usedDays,
      });
    }
    await type.deleteOne();
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
