import dbConnect from "@/lib/dbConnect";
import WaterQualityDaily from "@/models/smart-papar/WaterQualityDaily";
import { requireSmartPaparAdmin } from "./_auth";

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

  if (req.method === "GET") {
    try {
      const { start, end, limit } = req.query;

      const query = {};
      if (start || end) {
        query.recordDate = {};
        if (start) query.recordDate.$gte = String(start);
        if (end) query.recordDate.$lte = String(end);
      }

      let q = WaterQualityDaily.find(query).sort({ recordDate: -1, createdAt: -1 });
      const lim = parseInt(limit, 10);
      if (!Number.isNaN(lim) && lim > 0) q = q.limit(lim);

      const items = await q.lean();
      return res.status(200).json({ success: true, data: items });
    } catch (error) {
      console.error("smart-papar water-quality GET error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  if (req.method === "POST") {
    try {
      const payload = req.body || {};
      const recordDate = String(payload.recordDate || "").trim();
      if (!recordDate || !/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
        return res.status(400).json({ success: false, message: "recordDate is required (YYYY-MM-DD)" });
      }

      const errors = validateRanges(payload);
      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: errors.join(" • ") });
      }

      const doc = await WaterQualityDaily.create({
        recordDate,
        raw: payload.raw || {},
        tap: payload.tap || {},
        note: payload.note || "",
        createdByClerkId: auth.userId,
        createdByName: auth.name || "",
        updatedByClerkId: auth.userId,
        updatedByName: auth.name || "",
      });

      return res.status(201).json({ success: true, data: doc });
    } catch (error) {
      // Duplicate key: recordDate already exists
      if (error?.code === 11000) {
        return res.status(409).json({ success: false, message: "มีข้อมูลของวันนี้แล้ว" });
      }
      console.error("smart-papar water-quality POST error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}


