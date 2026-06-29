import type { Types } from "mongoose";
import type { NormalizedTxn, RejectReason, DocType, ChangeType, Owner, Area } from "../types";
import { buildWorklistItem, type WorklistItem } from "../worklist/buildWorklistItem";

// models เป็น CommonJS (module.exports) — require ตรง ๆ ให้ doc เป็น any
// เลี่ยง mongoose lean()-typing ที่ทำให้ ._id error (ดู mongoose FlattenMaps union)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { M10ImportBatch, M10Transaction, M10Record, M10Reject } = require("../../../models/m10-ingest");

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

export interface WorklistListRow {
  _id: string; recordKey: string; deedNo: string | null;
  changeType: string; txnDate: Date; ownerFullName: string;
}

// รายการ txn ที่ confirmed + เข้าเกณฑ์ + ยังไม่คีย์ (list ไม่ส่งเลขบัตรดิบ)
export async function listWorklistPending(filter: { period?: string; changeType?: string }): Promise<WorklistListRow[]> {
  const q: Record<string, unknown> = {
    reviewStatus: "confirmed",
    ltaxStatus: "pending",
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

export { M10ImportBatch, M10Transaction, M10Record, M10Reject };
