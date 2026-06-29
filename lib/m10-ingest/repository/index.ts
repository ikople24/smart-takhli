import type { Types } from "mongoose";
import type { NormalizedTxn, RejectReason, DocType, ChangeType, Owner, Area } from "../types";
import { buildWorklistItem, type WorklistItem } from "../worklist/buildWorklistItem";
import { matchParcel, type BasemapCandidate } from "../basemap/match";
import { normalizeEditedGeometry } from "../basemap/load";
import { bbox as turfBbox, bboxPolygon as turfBboxPolygon } from "@turf/turf";

// models เป็น CommonJS (module.exports) — require ตรง ๆ ให้ doc เป็น any
// เลี่ยง mongoose lean()-typing ที่ทำให้ ._id error (ดู mongoose FlattenMaps union)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { M10ImportBatch, M10Transaction, M10Record, M10Reject, M10Basemap } = require("../../../models/m10-ingest");

type Geom = GeoJSON.Polygon | GeoJSON.MultiPolygon;

// รูปร่างขั้นต่ำของ transaction doc ที่ apply ใช้ (mongoose hydrated/lean)
interface TxnDocLike {
  _id: Types.ObjectId;
  docType: DocType;
  recordKey: string | null;
  deedNo: string | null;
  taxRelevant: boolean;
  changeType: ChangeType;
  txnDate: Date;
  owner: Owner;
  area: Area | null;
  geometry: Geom | null;
  payloadRaw?: Record<string, string>;
}

export interface CreateBatchInput {
  fileHash: string; period: string; optId?: string; optName?: string;
  files: { name: string }[]; counts: Record<string, number>;
}
export async function findBatchByHash(fileHash: string) { return M10ImportBatch.findOne({ fileHash }).lean(); }
export async function createBatch(input: CreateBatchInput) {
  return M10ImportBatch.create({ ...input, status: "processing", importedAt: new Date() });
}
export async function finishBatch(batchId: Types.ObjectId, status: "done" | "failed", counts?: Record<string, number>) {
  await M10ImportBatch.updateOne({ _id: batchId }, { $set: { status, ...(counts ? { counts } : {}) } });
}

export async function insertTransactionDedup(batchId: Types.ObjectId, txn: NormalizedTxn, geometry: Geom | null = null) {
  // dedup ด้วย recordKey+rawStatus+txnDate เฉพาะแถวที่มี recordKey (parcel/ns3a)
  // construction ไม่มี recordKey → insert ตรง ๆ เพราะต่างแปลง แต่ key ซ้ำกันได้
  if (txn.recordKey !== null) {
    const filter = { batchId, recordKey: txn.recordKey, rawStatus: txn.rawStatus, txnDate: new Date(txn.txnDate) };
    const existing = await M10Transaction.findOne(filter);
    if (existing) return { inserted: false as const, doc: existing };
  }
  const doc = await M10Transaction.create({
    batchId, docType: txn.docType, recordKey: txn.recordKey, deedNo: txn.deedNo,
    rawStatus: txn.rawStatus, changeType: txn.changeType, taxRelevant: txn.taxRelevant,
    reviewStatus: txn.reviewStatus, txnDate: new Date(txn.txnDate), regAmount: txn.regAmount,
    owner: txn.owner, area: txn.area ?? undefined, geometry, payloadRaw: txn.payloadRaw,
  });
  return { inserted: true as const, doc };
}

export interface RejectInput { source: string; docType: DocType | string; rawRow: Record<string, unknown>; reason: RejectReason; }
export async function insertReject(batchId: Types.ObjectId, input: RejectInput) {
  await M10Reject.create({ batchId, ...input, createdAt: new Date() });
}

// apply 1 txn (doc จาก mongoose) เข้า records — เรียกตอน confirm
export async function applyTxnToRecord(txnDoc: TxnDocLike) {
  if (!txnDoc.taxRelevant || !txnDoc.recordKey) return; // construction/encumbrance ไม่ materialize
  const status = txnDoc.changeType === "RETIRED" ? "retired" : "active";
  const historyEntry = { txnId: txnDoc._id, changeType: txnDoc.changeType, txnDate: txnDoc.txnDate, at: new Date() };
  // landNo/survey จาก payloadRaw — matcher ชั้น 2 ต้องใช้ (เก็บลง record ตอน materialize)
  const landNo = txnDoc.payloadRaw?.["ที่ดิน"] ?? null;
  const survey = txnDoc.payloadRaw?.["ห.สำรวจ"] ?? null;
  const existing = await M10Record.findOne({ recordKey: txnDoc.recordKey });

  const hasGeo = !!txnDoc.geometry;
  if (!existing) {
    await M10Record.create({
      docType: txnDoc.docType, recordKey: txnDoc.recordKey, deedNo: txnDoc.deedNo, landNo, survey,
      area: txnDoc.area, owners: [txnDoc.owner],
      geometry: txnDoc.geometry ?? null, hasGeometry: hasGeo,
      status, lastTxnId: txnDoc._id, lastChangeType: txnDoc.changeType, lastTxnDate: txnDoc.txnDate,
      version: 1, history: [historyEntry], updatedAt: new Date(),
    });
  } else {
    await M10Record.updateOne({ _id: existing._id }, {
      $set: {
        area: txnDoc.area ?? existing.area, owners: [txnDoc.owner], deedNo: txnDoc.deedNo ?? existing.deedNo,
        landNo: landNo ?? existing.landNo, survey: survey ?? existing.survey,
        ...(hasGeo ? { geometry: txnDoc.geometry, hasGeometry: true } : {}),
        status, lastTxnId: txnDoc._id, lastChangeType: txnDoc.changeType, lastTxnDate: txnDoc.txnDate, updatedAt: new Date(),
      },
      $inc: { version: 1 },
      $push: { history: historyEntry },
    });
  }
  // จับคู่ basemap (ไม่ bump version) — record เพิ่งเขียนเสร็จ
  const saved = await M10Record.findOne({ recordKey: txnDoc.recordKey }).select("_id recordKey deedNo landNo survey geometry").lean();
  if (saved) await reconcileRecord(saved as Parameters<typeof reconcileRecord>[0]);
}

function toCand(d: Record<string, unknown>): BasemapCandidate {
  return { basemapId: String(d._id), parcelCode: d.parcelCode as string,
    deedNo: (d.deedNo as string) ?? null, geometry: (d.geometry as Geom) ?? null };
}

// reconcile 1 record: รัน matcher (resolver ต่อ DB) แล้วเก็บผล (ไม่ bump version)
export async function reconcileRecord(rec: {
  _id: unknown; recordKey: string; deedNo: string | null; landNo?: string | null; survey?: string | null; geometry: Geom | null;
}): Promise<void> {
  // ไม่ทับการตัดสินของคน — record ที่ จนท. resolve แล้ว ให้คง override ไว้
  const cur = await M10Record.findById(rec._id).select("reconcileOverride").lean();
  if (cur?.reconcileOverride?.status === "resolved") return;
  const result = await matchParcel(
    { deedNo: rec.deedNo, landNo: rec.landNo ?? null, survey: rec.survey ?? null, geometry: rec.geometry },
    {
      byDeed: async (deedNo) => (await M10Basemap.find({ deedNo }).lean()).map(toCand),
      byLandSurvey: async (landNo, survey) => (await M10Basemap.find({ landNo, survey }).lean()).map(toCand),
      byGeom: async (geometry) => (await M10Basemap.find({ geometry: { $geoIntersects: { $geometry: geometry } } }).limit(20).lean()).map(toCand),
    }
  );
  await M10Record.updateOne({ _id: rec._id }, { $set: {
    parcelCode: result.parcelCode,
    parcelMatch: { status: result.status, method: result.method, confidence: result.confidence,
      basemapId: result.basemapId, candidates: result.candidates, matchedAt: new Date() },
  } });
}

export async function confirmTransaction(txnId: Types.ObjectId, reviewedBy: string) {
  const doc = await M10Transaction.findById(txnId);
  if (!doc) throw new Error("transaction not found");
  if (doc.reviewStatus === "confirmed") return doc; // idempotent: กด confirm ซ้ำ = no-op (กัน apply ซ้ำ → version เด้ง/E11000)
  doc.reviewStatus = "confirmed"; doc.reviewedBy = reviewedBy; doc.reviewedAt = new Date();
  await doc.save();
  await applyTxnToRecord(doc);
  return doc;
}
export async function rejectTransaction(txnId: Types.ObjectId, reviewedBy: string) {
  await M10Transaction.updateOne({ _id: txnId }, { $set: { reviewStatus: "rejected", reviewedBy, reviewedAt: new Date() } });
}

export interface AsOfRecord {
  recordKey: string; docType: string; status: "active" | "retired";
  owners: Owner[]; area: Area | null; deedNo: string | null; lastChangeType: string; lastTxnDate: Date; hasGeometry: boolean;
}

// replay confirmed txn ที่ txnDate <= cutoff เรียงตามเวลา → สถานะ ณ cutoff (ไม่เขียน DB)
export async function asOfMaterialize(cutoff: Date): Promise<AsOfRecord[]> {
  const txns = await M10Transaction.find({
    reviewStatus: "confirmed", taxRelevant: true, recordKey: { $ne: null }, txnDate: { $lte: cutoff },
  }).sort({ txnDate: 1, createdAt: 1 }).lean();

  const byKey = new Map<string, AsOfRecord>();
  for (const t of txns) {
    byKey.set(t.recordKey, {
      recordKey: t.recordKey, docType: t.docType,
      status: t.changeType === "RETIRED" ? "retired" : "active",
      owners: [t.owner], area: t.area ?? null, deedNo: t.deedNo ?? null,
      lastChangeType: t.changeType, lastTxnDate: t.txnDate, hasGeometry: !!t.geometry,
    });
  }
  return [...byKey.values()];
}

const WORKLIST_CHANGE_TYPES = ["TRANSFER", "TRANSFER_PARTIAL", "OWNER_CORRECTION", "BOUNDARY_CHANGE"];
// แปลงใหม่ที่ยังคีย์ไม่ได้รอบนี้ (ต้องคำนวณ Parcel Code + basemap ก่อน)
const DEFERRED_CHANGE_TYPES = ["SPLIT", "SPLIT_PUBLIC", "MERGE", "NEW"];

export interface PeriodSummaryRow {
  period: string;
  total: number;          // transactions ทั้งหมดในเดือนนั้น
  reviewPending: number;  // รอยืนยัน
  confirmed: number;      // ยืนยันแล้ว
  rejected: number;       // ปฏิเสธ
  wlEligible: number;     // confirmed + เข้าเกณฑ์ worklist
  wlKeyed: number;        // คีย์เข้า LTAX แล้ว
  wlSkipped: number;      // ข้าม
  wlPending: number;      // ค้างคีย์ (ยังไม่คีย์/ไม่มี ltaxStatus)
  deferred: number;       // confirmed + SPLIT/MERGE/NEW (รอรอบ Parcel Code)
}

// สรุปสถานะการนำเข้า/คีย์ รายเดือน (group by batch.period) — สำหรับหน้า dashboard
export async function summaryByPeriod(): Promise<PeriodSummaryRow[]> {
  const wlEligible = { $and: [{ $eq: ["$reviewStatus", "confirmed"] }, { $in: ["$changeType", WORKLIST_CHANGE_TYPES] }] };
  const rows = await M10Transaction.aggregate([
    { $lookup: { from: "m10_import_batches", localField: "batchId", foreignField: "_id", as: "b" } },
    { $unwind: "$b" },
    { $group: {
      _id: "$b.period",
      total: { $sum: 1 },
      reviewPending: { $sum: { $cond: [{ $eq: ["$reviewStatus", "pending"] }, 1, 0] } },
      confirmed: { $sum: { $cond: [{ $eq: ["$reviewStatus", "confirmed"] }, 1, 0] } },
      rejected: { $sum: { $cond: [{ $eq: ["$reviewStatus", "rejected"] }, 1, 0] } },
      wlEligible: { $sum: { $cond: [wlEligible, 1, 0] } },
      wlKeyed: { $sum: { $cond: [{ $and: [wlEligible, { $eq: ["$ltaxStatus", "keyed"] }] }, 1, 0] } },
      wlSkipped: { $sum: { $cond: [{ $and: [wlEligible, { $eq: ["$ltaxStatus", "skipped"] }] }, 1, 0] } },
      // ค้างคีย์ = เข้าเกณฑ์ แต่ ltaxStatus ไม่ใช่ keyed/skipped (รวม null/missing ใน doc เก่า)
      wlPending: { $sum: { $cond: [{ $and: [wlEligible, { $not: [{ $in: ["$ltaxStatus", ["keyed", "skipped"]] }] }] }, 1, 0] } },
      deferred: { $sum: { $cond: [{ $and: [{ $eq: ["$reviewStatus", "confirmed"] }, { $in: ["$changeType", DEFERRED_CHANGE_TYPES] }] }, 1, 0] } },
    } },
    { $sort: { _id: -1 } },
  ]);
  return rows.map((r: Record<string, number | string>) => ({
    period: r._id as string,
    total: (r.total as number) ?? 0,
    reviewPending: (r.reviewPending as number) ?? 0,
    confirmed: (r.confirmed as number) ?? 0,
    rejected: (r.rejected as number) ?? 0,
    wlEligible: (r.wlEligible as number) ?? 0,
    wlKeyed: (r.wlKeyed as number) ?? 0,
    wlSkipped: (r.wlSkipped as number) ?? 0,
    wlPending: (r.wlPending as number) ?? 0,
    deferred: (r.deferred as number) ?? 0,
  }));
}

export interface WorklistListRow {
  _id: string; recordKey: string; deedNo: string | null;
  changeType: string; txnDate: Date; ownerFullName: string;
}

// รายการ txn ที่ confirmed + เข้าเกณฑ์ + ยังไม่คีย์ (list ไม่ส่งเลขบัตรดิบ)
export async function listWorklistPending(filter: { period?: string; changeType?: string }): Promise<WorklistListRow[]> {
  const q: Record<string, unknown> = {
    reviewStatus: "confirmed",
    // ยังไม่คีย์ = pending หรือไม่มี field (doc เก่าที่ confirm ก่อนเพิ่ม ltaxStatus → default ไม่ backfill)
    ltaxStatus: { $nin: ["keyed", "skipped"] },
    changeType: filter.changeType && WORKLIST_CHANGE_TYPES.includes(filter.changeType)
      ? filter.changeType
      : { $in: WORKLIST_CHANGE_TYPES },
  };
  if (filter.period) {
    const batches = await M10ImportBatch.find({ period: filter.period }).select("_id").lean();
    q.batchId = { $in: batches.map((b: { _id: unknown }) => b._id) };
  }
  const rows = await M10Transaction.find(q)
    .sort({ txnDate: 1, createdAt: 1 })
    .select("recordKey deedNo changeType txnDate owner.fullName")
    .limit(1000).lean();
  return rows.map((r: Record<string, unknown>) => ({
    _id: String((r as { _id: unknown })._id),
    recordKey: r.recordKey as string,
    deedNo: (r.deedNo as string) ?? null,
    changeType: r.changeType as string,
    txnDate: r.txnDate as Date,
    ownerFullName: (r as { owner?: { fullName?: string } }).owner?.fullName ?? "",
  }));
}

// สร้างสคริปต์คีย์ของ txn เดียว (focus mode) — ส่งเลขบัตร/ที่อยู่ดิบ
export async function getWorklistItem(txnId: Types.ObjectId | string): Promise<WorklistItem> {
  const doc = await M10Transaction.findById(txnId).lean();
  if (!doc) throw new Error("transaction not found");
  const batch = await M10ImportBatch.findById(doc.batchId).select("period").lean();
  // เจ้าของก่อนหน้า: replay confirmed txn ถึงก่อนวันที่ของ txn นี้ แล้วหา recordKey เดียวกัน
  // หมายเหตุ: txnDate เป็น date-only → กรณีโอนซ้ำวันเดียวกันบนแปลงเดิม oldOwnerName = null (best-effort ตาม spec §5)
  const before = new Date(new Date(doc.txnDate).getTime() - 1);
  const asOf = await asOfMaterialize(before);
  const prior = asOf.find((r) => r.recordKey === doc.recordKey);
  const oldOwnerName = prior?.owners?.[0]?.fullName ?? null;
  return buildWorklistItem(
    {
      _id: String(doc._id),
      recordKey: doc.recordKey,
      deedNo: doc.deedNo ?? null,
      changeType: doc.changeType,
      txnDate: doc.txnDate,
      area: doc.area ?? null,
      payloadRaw: doc.payloadRaw ?? {},
    },
    oldOwnerName,
    batch?.period ?? ""
  );
}

export async function markKeyed(txnId: Types.ObjectId | string, by: string) {
  await M10Transaction.updateOne({ _id: txnId }, { $set: { ltaxStatus: "keyed", ltaxKeyedBy: by, ltaxKeyedAt: new Date() } });
}
export async function markSkip(txnId: Types.ObjectId | string, by: string, note: string) {
  await M10Transaction.updateOne({ _id: txnId }, { $set: { ltaxStatus: "skipped", ltaxKeyedBy: by, ltaxKeyedAt: new Date(), ltaxNote: note } });
}

export interface ReconcileRow {
  recordKey: string; deedNo: string | null; changeType: string;
  status: string | null; method: string | null; confidence: string | null;
  parcelCode: string | null; candidates: { parcelCode: string; overlapPct: number }[];
}

// รายการผลจับคู่ basemap (read-only) — filter ตามสถานะ
export async function listReconcile(filter: { status?: string } = {}): Promise<ReconcileRow[]> {
  const q: Record<string, unknown> = {};
  if (filter.status) q["parcelMatch.status"] = filter.status;
  const rows = await M10Record.find(q)
    .select("recordKey deedNo lastChangeType parcelCode parcelMatch").limit(2000).lean();
  return rows.map((r: Record<string, unknown>) => {
    const pm = (r.parcelMatch ?? {}) as Record<string, unknown>;
    const cands = (pm.candidates as { parcelCode: string; overlapPct: number }[]) ?? [];
    return {
      recordKey: r.recordKey as string, deedNo: (r.deedNo as string) ?? null,
      changeType: (r.lastChangeType as string) ?? "",
      status: (pm.status as string) ?? null, method: (pm.method as string) ?? null,
      confidence: (pm.confidence as string) ?? null, parcelCode: (r.parcelCode as string) ?? null,
      candidates: cands.map((c) => ({ parcelCode: c.parcelCode, overlapPct: c.overlapPct })),
    };
  });
}

function bboxPolygon(g: Geom): GeoJSON.Polygon { return turfBboxPolygon(turfBbox(g)).geometry; }

// detail สำหรับหน้าแผนที่ reconcile: record + candidate(พร้อม geometry) + แปลงข้างเคียง(bbox)
export async function getReconcileItem(recordKey: string) {
  const rec = await M10Record.findOne({ recordKey })
    .select("recordKey deedNo landNo survey area geometry parcelCode parcelMatch reconcileOverride").lean();
  if (!rec) return null;
  // effective geometry = รูปที่ จนท. แก้ (override) ถ้ามี ไม่งั้น canonical — UI แสดงรูปล่าสุด
  const effGeometry = rec.reconcileOverride?.geometry ?? rec.geometry ?? null;
  const pm = (rec.parcelMatch ?? {}) as { candidates?: { basemapId: string; parcelCode: string; deedNo: string | null; overlapPct: number }[]; basemapId?: unknown };
  const cands = pm.candidates ?? [];
  const overlapById = new Map(cands.map((c) => [c.basemapId, c.overlapPct]));
  const deedById = new Map(cands.map((c) => [c.basemapId, c.deedNo]));
  // รวม id ของ candidate + แปลงที่ match สำเร็จ (deed-exact ไม่มี candidates แต่มี basemapId) → ให้เห็นบนแผนที่
  const ids = new Set<string>(cands.map((c) => c.basemapId).filter(Boolean));
  if (pm.basemapId) ids.add(String(pm.basemapId));
  const candDocs = ids.size ? await M10Basemap.find({ _id: { $in: [...ids] } }).select("parcelCode deedNo geometry").lean() : [];
  const candMap = new Map(candDocs.map((d: Record<string, unknown>) => [String(d._id), d]));
  const candidates = [...ids].map((id) => {
    const d = candMap.get(id) as { parcelCode?: string; deedNo?: string; geometry?: unknown } | undefined;
    return {
      parcelCode: d?.parcelCode ?? null, basemapId: id,
      deedNo: d?.deedNo ?? deedById.get(id) ?? null,
      overlapPct: overlapById.get(id) ?? null,
      geometry: d?.geometry ?? null,
    };
  }).filter((c) => c.parcelCode);
  let nearby: { parcelCode: string; geometry: unknown }[] = [];
  if (effGeometry) {
    const near = await M10Basemap.find({ geometry: { $geoIntersects: { $geometry: bboxPolygon(effGeometry as Geom) } } })
      .select("parcelCode geometry").limit(50).lean();
    nearby = near.map((d: Record<string, unknown>) => ({ parcelCode: d.parcelCode as string, geometry: d.geometry }));
  }
  return { record: { ...rec, geometry: effGeometry }, candidates, nearby };
}

// บันทึกการตัดสินของ จนท. เป็น override (กัน replay ทับ) + re-match ด้วยค่าใหม่
export async function resolveReconcile(recordKey: string, by: string, input: {
  parcelCode?: string | null; deedNo?: string | null; landNo?: string | null; survey?: string | null;
  area?: { rai: number; ngan: number; wa: number; sqm: number } | null; note?: string | null;
  geometry?: unknown;
}) {
  const rec = await M10Record.findOne({ recordKey }).lean();
  if (!rec) throw new Error("record not found");
  const deedNo = input.deedNo ?? rec.deedNo;
  const landNo = input.landNo ?? rec.landNo ?? null;
  const survey = input.survey ?? rec.survey ?? null;
  // geometry ที่ จนท. แก้ (เฟส 2): validate ก่อนเก็บ; effective = override ?? canonical
  let overrideGeom: Geom | null = null;
  if (input.geometry != null) {
    overrideGeom = normalizeEditedGeometry(input.geometry);
    if (!overrideGeom) throw new Error("รูปแปลงไม่ถูกต้อง (เส้นตัดกัน/จุดน้อยเกินไป)");
  }
  const effGeom = overrideGeom ?? (rec.geometry as Geom) ?? null;
  // re-match ตรง ๆ (ไม่ผ่าน reconcileRecord จึงไม่ติด guard ข้าม resolved)
  const match = await matchParcel(
    { deedNo, landNo, survey, geometry: effGeom },
    {
      byDeed: async (d) => (await M10Basemap.find({ deedNo: d }).lean()).map(toCand),
      byLandSurvey: async (l, s) => (await M10Basemap.find({ landNo: l, survey: s }).lean()).map(toCand),
      byGeom: async (g) => (await M10Basemap.find({ geometry: { $geoIntersects: { $geometry: g } } }).limit(20).lean()).map(toCand),
    }
  );
  const override = {
    parcelCode: input.parcelCode ?? match.parcelCode,
    deedNo: input.deedNo ?? null, landNo: input.landNo ?? null, survey: input.survey ?? null,
    area: input.area ?? null, geometry: overrideGeom, status: "resolved", note: input.note ?? null, by, at: new Date(),
  };
  await M10Record.updateOne({ recordKey }, { $set: {
    reconcileOverride: override,
    parcelMatch: { status: match.status, method: match.method, confidence: match.confidence,
      basemapId: match.basemapId, candidates: match.candidates, matchedAt: new Date() },
  } });
  return { ok: true, status: "resolved", parcelCode: override.parcelCode };
}

export { M10ImportBatch, M10Transaction, M10Record, M10Reject, M10Basemap };
