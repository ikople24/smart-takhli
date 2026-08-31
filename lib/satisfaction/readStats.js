// lib/satisfaction/readStats.js
// จุดรวมการอ่านสถิติความพึงพอใจ (I/O) — ใช้คู่กับ computeFairStats (logic ล้วน)
// ผู้เรียก: pages/api/satisfaction/stats.js, pages/api/analytics/summary.ts, pages/api/analytics/satisfaction.ts
// ห้ามคำนวณค่าเฉลี่ยดิบ ($avg / reduce) เองที่ endpoint อื่น — ให้เรียกที่นี่แล้วส่งเข้า computeFairStats
// (endpoint อ่านรายเรื่อง count.js / [id].js / by-complaint.js / recent-comments.js ไม่เกี่ยวกับสถิติรวม ไม่แตะ)

import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Satisfaction from "@/models/Satisfaction";
import SubmittedReport from "@/models/SubmittedReport";

/**
 * โหลดแถวคะแนน (+ createdAt ไว้แบ่งถังรายสัปดาห์) และข้อมูลผู้แจ้งของเรื่องที่มีคะแนน
 * @param {{ from?: Date }} [opts] — from = เอาเฉพาะคะแนนตั้งแต่วันนั้น (ไม่ใส่ = ทั้งหมด)
 * @returns {Promise<{
 *   ratings: Array<{ complaintId: string, rating: number, source?: string, createdAt: Date }>,
 *   reports: Map<string, { phone?: string, lineUserId?: string }>
 * }>}
 */
export async function loadSatisfactionStats({ from } = {}) {
  await dbConnect();

  const filter = from ? { createdAt: { $gte: from } } : {};
  const rows = await Satisfaction.find(filter).select("complaintId rating source createdAt").lean();

  const ratings = rows.map((r) => ({
    complaintId: String(r.complaintId),
    rating: r.rating,
    source: r.source,
    createdAt: r.createdAt,
  }));

  // กัน id เพี้ยน 1 แถวทำทั้ง endpoint ล้ม (CastError) — แถวนั้นจะไม่มี report → นับเป็นเสียงของตัวเองใน fairStats
  const ids = [...new Set(ratings.map((r) => r.complaintId))].filter((id) =>
    mongoose.Types.ObjectId.isValid(id)
  );
  const reportRows = ids.length
    ? await SubmittedReport.find({ _id: { $in: ids } }).select("_id phone lineUserId").lean()
    : [];
  // เก็บเฉพาะที่ reporterKey ใช้ — ไม่ให้ชื่อ/รายละเอียดผู้แจ้งหลุดไปกับผลลัพธ์
  const reports = new Map(
    reportRows.map((r) => [String(r._id), { phone: r.phone, lineUserId: r.lineUserId }])
  );

  return { ratings, reports };
}
