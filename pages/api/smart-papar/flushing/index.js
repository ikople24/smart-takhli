// บันทึกโบตะกอน — GET รายการตามช่วงวัน (วันไทย) + สรุป · POST บันทึกใหม่
import dbConnect from "@/lib/dbConnect";
import FlushingLog from "@/models/smart-papar/FlushingLog";
import { requireSmartPaparAdmin } from "../water-quality/_auth";
import {
  validateFlushingInput,
  summarizeFlushing,
  bangkokDayRange,
} from "@/lib/smart-papar/flushing";

const LIST_LIMIT = 500;

export default async function handler(req, res) {
  const auth = await requireSmartPaparAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  await dbConnect();

  if (req.method === "GET") {
    try {
      const range = bangkokDayRange(req.query.from, req.query.to);
      if (!range) {
        return res.status(400).json({ success: false, message: "ช่วงวันที่ไม่ถูกต้อง" });
      }
      const items = await FlushingLog.find({
        deletedAt: null,
        flushedAt: { $gte: range.start, $lt: range.end },
      })
        .sort({ flushedAt: -1 })
        .limit(LIST_LIMIT)
        .lean();
      return res.status(200).json({
        success: true,
        data: items,
        summary: summarizeFlushing(items),
        truncated: items.length === LIST_LIMIT,
      });
    } catch (error) {
      console.error("smart-papar flushing GET error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  if (req.method === "POST") {
    try {
      const v = validateFlushingInput(req.body);
      if (!v.ok) {
        return res
          .status(400)
          .json({ success: false, message: "ข้อมูลไม่ครบหรือไม่ถูกต้อง", errors: v.errors });
      }
      const doc = await FlushingLog.create({
        ...v.value,
        createdByClerkId: auth.userId,
        createdByName: auth.name || "",
        updatedByClerkId: auth.userId,
        updatedByName: auth.name || "",
      });
      return res.status(201).json({ success: true, data: doc.toObject() });
    } catch (error) {
      console.error("smart-papar flushing POST error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}
