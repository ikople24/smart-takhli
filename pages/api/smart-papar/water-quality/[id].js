import dbConnect from "@/lib/dbConnect";
import WaterQualityDaily from "@/models/smart-papar/WaterQualityDaily";
import { canEditRecordDate, requireSmartPaparAdmin } from "./_auth";

function validateRanges(payload) {
  const errors = [];
  const pick = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
  const check = (label, v, { integer = false, max = 100 } = {}) => {
    const n = pick(v);
    if (n === null) return;
    if (!Number.isFinite(n)) errors.push(`${label} ต้องเป็นตัวเลข`);
    else {
      if (n < 0) errors.push(`${label} ต้องไม่ติดลบ`);
      if (n > max) errors.push(`${label} ต้องไม่เกิน ${max}`);
      if (integer && !Number.isInteger(n)) errors.push(`${label} ต้องเป็นจำนวนเต็ม`);
    }
  };

  check("น้ำดิบ: ความขุ่น", payload?.raw?.turbidityNtu, { max: 999 });
  check("น้ำดิบ: pH", payload?.raw?.ph, { max: 14 });
  check("น้ำดิบ: TDS", payload?.raw?.tdsMgL, { max: 500, integer: true });
  // น้ำประปาจ่ายออก: NTU และ TDS อนุญาตถึง 999
  check("น้ำประปา: ความขุ่น", payload?.tap?.turbidityNtu, { max: 999 });
  check("น้ำประปา: pH", payload?.tap?.ph, { max: 14 });
  check("น้ำประปา: TDS", payload?.tap?.tdsMgL, { max: 500, integer: true });
  check("คลอรีนอิสระ: ต้นทาง", payload?.tap?.freeChlorineSourceMgL, { max: 10 });
  check("คลอรีนอิสระ: ปลายทาง", payload?.tap?.freeChlorineEndMgL, { max: 10 });

  return errors;
}

export default async function handler(req, res) {
  const auth = await requireSmartPaparAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  await dbConnect();

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ success: false, message: "Missing id" });
  }

  if (req.method === "GET") {
    const item = await WaterQualityDaily.findById(id).lean();
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    return res.status(200).json({ success: true, data: item });
  }

  if (req.method === "PUT") {
    try {
      const existing = await WaterQualityDaily.findById(id).lean();
      if (!existing) return res.status(404).json({ success: false, message: "Not found" });

      if (!auth.isSuperAdmin && !canEditRecordDate(existing.recordDate)) {
        return res.status(403).json({ success: false, message: "แก้ไขย้อนหลังได้ไม่เกิน 7 วัน" });
      }

      const payload = req.body || {};
      const errors = validateRanges(payload);
      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: errors.join(" • ") });
      }

      // ไม่ให้เปลี่ยน recordDate ผ่านการแก้ไข (กันสับสน/ชน unique)
      const update = {
        raw: payload.raw || existing.raw || {},
        tap: payload.tap || existing.tap || {},
        note: typeof payload.note === "string" ? payload.note : (existing.note || ""),
        updatedByClerkId: auth.userId,
        updatedByName: auth.name || "",
      };

      const updated = await WaterQualityDaily.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
      }).lean();

      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("smart-papar water-quality PUT error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const existing = await WaterQualityDaily.findById(id).lean();
      if (!existing) return res.status(404).json({ success: false, message: "Not found" });

      // ลบ: อนุญาตเฉพาะ superadmin เพื่อความปลอดภัย
      if (!auth.isSuperAdmin) {
        return res.status(403).json({ success: false, message: "เฉพาะ Super Admin เท่านั้นที่ลบได้" });
      }

      await WaterQualityDaily.deleteOne({ _id: id });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("smart-papar water-quality DELETE error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}


