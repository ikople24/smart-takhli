import dbConnect from "@/lib/dbConnect";
import StreetLightPole from "@/models/smart-light/StreetLightPole";
import { requireSmartLightAdmin } from "../_auth";

// PUT /api/smart-light/groups/rename — เปลี่ยนชื่อกลุ่มทั้งกลุ่ม (updateMany)
// ไว้แก้ชื่อพิมพ์ผิดจากไฟล์ KMZ เดิม เช่น "ตลีคลี", "เอื่ออารี"
export default async function handler(req, res) {
  const auth = await requireSmartLightAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  if (req.method !== "PUT") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  await dbConnect();

  try {
    const from = String(req.body?.from || "").trim();
    const to = String(req.body?.to || "").trim();
    if (!from || !to) {
      return res
        .status(400)
        .json({ success: false, message: "กรุณาระบุชื่อกลุ่มเดิมและชื่อกลุ่มใหม่" });
    }
    if (from === to) {
      return res.status(400).json({ success: false, message: "ชื่อกลุ่มใหม่ซ้ำกับชื่อเดิม" });
    }

    // ถ้าชื่อใหม่ชนกับกลุ่มที่มีอยู่ = การรวมกลุ่ม — ต้องยืนยันชัดเจนก่อน (bulk write ย้อนกลับยาก)
    const confirmMerge = req.body?.confirmMerge === true;
    if (!confirmMerge) {
      const targetCount = await StreetLightPole.countDocuments({ group: to });
      if (targetCount > 0) {
        return res.status(409).json({
          success: false,
          needsConfirm: true,
          message: `กลุ่ม "${to}" มีอยู่แล้ว (${targetCount} ต้น) — ยืนยันอีกครั้งเพื่อรวมกลุ่ม`,
        });
      }
    }

    const result = await StreetLightPole.updateMany(
      { group: from },
      { $set: { group: to } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: `ไม่พบกลุ่ม "${from}"` });
    }
    return res
      .status(200)
      .json({ success: true, data: { modified: result.modifiedCount } });
  } catch (error) {
    console.error("smart-light groups rename error:", error);
    return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
  }
}
