import type { Types } from "mongoose";
import type { NormalizedTxn, RejectReason, DocType, ChangeType } from "../types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { M10ImportBatch, M10Transaction, M10Record, M10Reject } = require("../../../models/m10-ingest");

type Geom = GeoJSON.Polygon | GeoJSON.MultiPolygon;

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
  const filter = { batchId, recordKey: txn.recordKey, rawStatus: txn.rawStatus, txnDate: new Date(txn.txnDate) };
  const existing = await M10Transaction.findOne(filter);
  if (existing) return { inserted: false as const, doc: existing };
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
export async function applyTxnToRecord(txnDoc: any) {
  if (!txnDoc.taxRelevant || !txnDoc.recordKey) return; // construction/encumbrance ไม่ materialize
  const status = (txnDoc.changeType as ChangeType) === "RETIRED" ? "retired" : "active";
  const historyEntry = { txnId: txnDoc._id, changeType: txnDoc.changeType, txnDate: txnDoc.txnDate, at: new Date() };
  const existing = await M10Record.findOne({ recordKey: txnDoc.recordKey });

  const hasGeo = !!txnDoc.geometry;
  if (!existing) {
    await M10Record.create({
      docType: txnDoc.docType, recordKey: txnDoc.recordKey, deedNo: txnDoc.deedNo,
      area: txnDoc.area, owners: [txnDoc.owner],
      geometry: txnDoc.geometry ?? null, hasGeometry: hasGeo,
      status, lastTxnId: txnDoc._id, lastChangeType: txnDoc.changeType, lastTxnDate: txnDoc.txnDate,
      version: 1, history: [historyEntry], updatedAt: new Date(),
    });
    return;
  }
  await M10Record.updateOne({ _id: existing._id }, {
    $set: {
      area: txnDoc.area ?? existing.area, owners: [txnDoc.owner], deedNo: txnDoc.deedNo ?? existing.deedNo,
      ...(hasGeo ? { geometry: txnDoc.geometry, hasGeometry: true } : {}),
      status, lastTxnId: txnDoc._id, lastChangeType: txnDoc.changeType, lastTxnDate: txnDoc.txnDate, updatedAt: new Date(),
    },
    $inc: { version: 1 },
    $push: { history: historyEntry },
  });
}

export async function confirmTransaction(txnId: Types.ObjectId, reviewedBy: string) {
  const doc = await M10Transaction.findById(txnId);
  if (!doc) throw new Error("transaction not found");
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
  owners: any[]; area: any; deedNo: string | null; lastChangeType: string; lastTxnDate: Date; hasGeometry: boolean;
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

export { M10ImportBatch, M10Transaction, M10Record, M10Reject };
