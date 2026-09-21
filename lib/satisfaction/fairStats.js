// lib/satisfaction/fairStats.js
// สถิติความพึงพอใจแบบ "1 ผู้แจ้ง = 1 เสียง" — logic ล้วน ห้ามมี I/O (เทสด้วย vitest)
// spec: docs/superpowers/specs/2026-08-31-satisfaction-fair-stats-design.md
//
// ทำไมไม่เฉลี่ยทุกแถวตรง ๆ: ผู้แจ้งคนเดียวยื่นเรื่องเดิมซ้ำหลายใบแล้วให้คะแนนทุกใบ
// จะถ่วงค่าเฉลี่ยทั้งระบบได้ กติกานี้ให้ทุกคนมีน้ำหนักเท่ากันไม่ว่าจะยื่นกี่เรื่อง
// (เบอร์เจ้าหน้าที่ที่คีย์แทนประชาชนหลายเรื่องก็ยุบเป็น 1 เสียงเช่นกัน — กติกาสมมาตร ไม่มีกรณีพิเศษ)
//
// 3 ขั้น: (1) เฉลี่ยภายในเรื่อง → (2) เฉลี่ยทุกเรื่องของผู้แจ้งเดียวกัน → (3) เฉลี่ยข้ามผู้แจ้ง
// ตัวเลขดิบ (totalRatings, rawAverage, ratingDistribution, bySource) ยังคืนไปด้วยเพื่อความโปร่งใส
//
// เฟส 2 (ผูกเรื่องซ้ำ duplicateOf): เปลี่ยนคีย์ขั้น 1 จาก complaintId เป็น "เรื่องแม่" ที่จุดเดียวตรง perComplaint

export const METHOD = "per-reporter";

const emptyDistribution = () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round4 = (x) => Math.round(x * 10000) / 10000;

/**
 * ตัวระบุผู้แจ้งของเรื่องหนึ่ง — คีย์มี prefix กันชนกันข้ามชนิด
 *   1. tel:<เฉพาะตัวเลข>  ตัดช่องว่าง/ขีดที่พบในข้อมูลจริง · ไม่เติม 0 ให้เบอร์ 9 หลัก (ปล่อยเป็นคนละคน)
 *   2. line:<lineUserId>  เมื่อไม่มีเบอร์
 *   3. complaint:<id>     ไม่มีทั้งคู่ หรือเรื่องถูกลบไปแล้ว (report เป็น null) — เรื่องนั้นเป็นเสียงของตัวเอง
 * @param {{ phone?: string|null, lineUserId?: string|null } | null | undefined} report
 * @param {string} complaintId
 */
export function reporterKey(report, complaintId) {
  const digits = String(report?.phone ?? "").replace(/\D/g, "");
  if (digits) return `tel:${digits}`;
  const line = String(report?.lineUserId ?? "").trim();
  if (line) return `line:${line}`;
  return `complaint:${String(complaintId)}`;
}

/**
 * @param {Array<{ complaintId: any, rating: number, source?: string }>} ratings
 *        complaintId เป็น string หรือ ObjectId (จะ String() ให้)
 * @param {Map<string, { phone?: string|null, lineUserId?: string|null }> | null | undefined} reports
 *        เฉพาะเรื่องที่มีคะแนน key = String(complaintId) · ไม่มี key = เรื่องถูกลบ
 *        ส่ง null / ไม่ใช่ Map มา = ไม่มีข้อมูลผู้แจ้ง (ทุกเรื่องเป็นเสียงของตัวเอง) — ไม่โยน error
 */
export function computeFairStats(ratings, reports = new Map()) {
  const ratingDistribution = emptyDistribution();
  const bySource = {
    public: { count: 0, average: 0 },
    line: { count: 0, average: 0 },
  };
  // endpoint สาธารณะเรียกฟังก์ชันนี้ — อินพุตเพี้ยนต้องไม่กลายเป็น 500
  const reportMap = reports instanceof Map ? reports : new Map();

  // ── ส่วนดิบ (คงพฤติกรรมเดิมของ stats.js): histogram + แยกช่องทาง ──
  const sums = { public: 0, line: 0 };
  let rawSum = 0;
  let counted = 0;
  const perComplaint = new Map(); // String(complaintId) → [rating]
  for (const r of ratings ?? []) {
    const rating = Number(r?.rating);
    // แถวที่ rating ไม่ใช่ตัวเลข (เขียน DB ตรงโดยไม่ผ่าน schema) ข้ามไป — ไม่ให้แถวเดียวทำทั้งการ์ดเป็น NaN/null
    if (!Number.isFinite(rating)) continue;
    counted++;
    rawSum += rating;
    if (ratingDistribution[rating] !== undefined) ratingDistribution[rating]++;
    // แถวที่ไม่มี source (ก่อน backfill) ถือเป็นคะแนนจากหน้าเว็บ — ต้องตรงกับ count.js
    const sourceKey = r.source === "line" ? "line" : "public";
    sums[sourceKey] += rating;
    bySource[sourceKey].count++;
    const cid = String(r.complaintId);
    if (!perComplaint.has(cid)) perComplaint.set(cid, []);
    perComplaint.get(cid).push(rating);
  }

  if (counted === 0) {
    return {
      averageRating: 0,
      rawAverage: 0,
      totalRatings: 0,
      ratedComplaints: 0,
      reporters: 0,
      ratingDistribution,
      bySource,
      method: METHOD,
    };
  }
  bySource.public.average = bySource.public.count ? round4(sums.public / bySource.public.count) : 0;
  bySource.line.average = bySource.line.count ? round4(sums.line / bySource.line.count) : 0;

  // ── ขั้น 1 ต่อเรื่อง → ขั้น 2 ต่อผู้แจ้ง → ขั้น 3 รวม ──
  const perReporter = new Map(); // reporterKey → [ค่าเฉลี่ยต่อเรื่อง]
  for (const [cid, rs] of perComplaint) {
    const rKey = reporterKey(reportMap.get(cid) ?? null, cid);
    if (!perReporter.has(rKey)) perReporter.set(rKey, []);
    perReporter.get(rKey).push(mean(rs));
  }
  const reporterMeans = [...perReporter.values()].map(mean);

  return {
    averageRating: round4(mean(reporterMeans)),
    rawAverage: round4(rawSum / counted),
    totalRatings: counted,
    ratedComplaints: perComplaint.size,
    reporters: perReporter.size,
    ratingDistribution,
    bySource,
    method: METHOD,
  };
}
