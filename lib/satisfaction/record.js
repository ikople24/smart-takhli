// lib/satisfaction/record.js
// จุดเดียวที่อ่าน/เขียน collection satisfactions — ทั้งฝั่งเว็บสาธารณะและฝั่ง LINE
// (รวมไว้ที่เดียวเพื่อให้ n8n notify และกติกาการนับคะแนนไม่แตกเป็นสองชุด)

import dbConnect from "@/lib/dbConnect";
import Satisfaction from "@/models/Satisfaction";
import SubmittedReport from "@/models/SubmittedReport";
import { n8n } from "@/lib/n8nWebhook";
import { commentWindowStart, sanitizeComment } from "@/lib/satisfaction/lineRating";

/** คะแนนจากหน้าเว็บสาธารณะ — พฤติกรรมเดิมทุกอย่าง */
export async function recordPublicRating({ complaintId, rating, comment }) {
  await dbConnect();
  const created = await Satisfaction.create({
    complaintId,
    rating,
    comment: comment || "",
    source: "public",
    lineUserId: null,
  });
  // fire-and-forget
  n8n.satisfactionSubmitted({ complaintId: String(complaintId), rating, comment: comment || "" });
  return created;
}

/**
 * คะแนนจากปุ่มดาวในแชท LINE — 1 คน 1 คะแนนต่อเรื่อง กดซ้ำ = อัปเดตแถวเดิม
 * คืน { ok: false, reason: 'not_found' } ถ้าไม่พบเลขเรื่อง (เรื่องถูกลบ / cid ปลอม)
 */
export async function recordLineRating({ complaintCode, lineUserId, score }) {
  await dbConnect();

  const report = await SubmittedReport.findOne({ complaintId: complaintCode })
    .select("_id")
    .lean();
  if (!report) return { ok: false, reason: "not_found" };

  const filter = { complaintId: report._id, lineUserId };

  // upsert ใน query เดียว — LINE ยิง webhook ซ้ำได้ถ้าเราตอบช้า ถ้าใช้ findOne แล้วค่อย create
  // สองคำขอจะแซงกันจนชน unique index (E11000)
  // before = null แปลว่าเพิ่งสร้างแถวใหม่ · มีค่า = ของเดิมโดนอัปเดตคะแนน
  let before;
  try {
    before = await Satisfaction.findOneAndUpdate(
      filter,
      {
        $set: { rating: score },
        $setOnInsert: { source: "line", comment: "", createdAt: new Date() },
      },
      { upsert: true, new: false }
    ).lean();
  } catch (err) {
    if (err?.code !== 11000) throw err;
    // แข่งกันสร้างพอดี — อีกฝั่งสร้างสำเร็จไปแล้ว เขียนทับเป็นคะแนนล่าสุดพอ
    await Satisfaction.updateOne(filter, { $set: { rating: score } });
    return { ok: true, updated: true };
  }

  if (!before) {
    n8n.satisfactionSubmitted({ complaintId: String(report._id), rating: score, comment: "" });
  }
  return { ok: true, updated: Boolean(before) };
}

/**
 * เก็บข้อความอิสระเป็นความเห็นของคะแนนที่เพิ่งกด (ถ้ายังอยู่ในช่วงเวลาและยังไม่มีความเห็น)
 * คืน true = เก็บแล้ว · false = ไม่มีคะแนนรอความเห็น ให้ caller ทำงานเดิมต่อ
 */
export async function attachPendingComment({ lineUserId, text, now = new Date() }) {
  if (!lineUserId) return false;
  const comment = sanitizeComment(text);
  if (!comment) return false;

  await dbConnect();

  // หาและเขียนใน query เดียว — LINE ยิง webhook ข้อความซ้ำได้ถ้าเราตอบช้า ถ้าใช้ findOne
  // แล้วค่อย save สองคำขอจะเห็น comment ว่างพร้อมกันแล้วเขียนทับความเห็นที่บันทึกไปแล้ว
  // เงื่อนไข comment: "" อยู่ใน filter จึงถูกตรวจตอนเขียนจริง ผู้แพ้ในการแข่งจะไม่แมตช์
  // sort: คะแนนล่าสุดก่อน · ไม่ใส่ new จึงได้แถวก่อนอัปเดต — null = ไม่มีแถวไหนแมตช์
  const updated = await Satisfaction.findOneAndUpdate(
    {
      lineUserId,
      source: "line",
      comment: "",
      createdAt: { $gte: commentWindowStart(now) },
    },
    { $set: { comment } },
    { sort: { createdAt: -1 } }
  ).lean();
  return Boolean(updated);
}

/** คะแนนที่ LINE user นี้เคยให้เรื่องนี้ — ใช้ตัดสินว่าจะแนบปุ่มดาวหรือแสดงคะแนนเดิม */
export async function findLineRating({ complaintObjectId, lineUserId }) {
  if (!complaintObjectId || !lineUserId) return null;
  await dbConnect();
  return Satisfaction.findOne({
    complaintId: complaintObjectId,
    lineUserId,
    source: "line",
  })
    .select("rating")
    .lean();
}
