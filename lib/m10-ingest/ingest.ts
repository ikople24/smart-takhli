import { createHash } from "node:crypto";
import { extractBatch, type ExtractedBatch } from "./adapters/zip";
import { parseCsv } from "./adapters/csv";
import { parseGeometryGeoJSON } from "./adapters/geometry";
import { normalizeRow } from "./normalize/index";
import { joinGeometry } from "./geometry/join";
import { NormalizeError, type RawRow, type RawGeometry } from "./types";
import {
  findBatchByHash, createBatch, finishBatch,
  insertTransactionDedup, insertReject,
} from "./repository/index";

export interface IngestOptions { period: string; optId?: string; optName?: string; }
export interface IngestResult {
  skipped: boolean; batchId?: string;
  counts?: { transactions: number; rejects: number; geometryMatched: number; geometryUnmatched: number };
}

export async function ingestZip(buffer: Buffer, opts: IngestOptions): Promise<IngestResult> {
  const fileHash = createHash("sha256").update(buffer).digest("hex");
  const existing = await findBatchByHash(fileHash);
  if (existing) return { skipped: true, batchId: existing._id.toString() };

  const batchFiles: ExtractedBatch = extractBatch(buffer);
  const batch = await createBatch({
    fileHash, period: opts.period,
    optId: opts.optId ?? batchFiles.optId, optName: opts.optName ?? batchFiles.optName,
    files: batchFiles.fileNames.map((name) => ({ name })), counts: {},
  });

  // geometry fatal ถ้าทั้งไฟล์พัง → ยกเลิก batch
  let geometries: RawGeometry[] = [];
  try {
    if (batchFiles.geometryGeoJSON) geometries = parseGeometryGeoJSON(batchFiles.geometryGeoJSON);
  } catch (e) {
    if (e instanceof NormalizeError) { await finishBatch(batch._id, "failed"); throw new Error(`fatal geometry: ${e.reason}`); }
    throw e;
  }

  const rawRows: RawRow[] = [
    ...(batchFiles.parcelCsv ? parseCsv(batchFiles.parcelCsv, "PARCEL", "parcel.csv") : []),
    ...(batchFiles.ns3aCsv ? parseCsv(batchFiles.ns3aCsv, "NS3A", "ns3a.csv") : []),
    ...(batchFiles.constructionCsv ? parseCsv(batchFiles.constructionCsv, "CONSTRUCTION", "construction.csv") : []),
  ];

  // join geometry กับ recordKey ของ parcel ในรอบเดียว
  const parcelKeys: string[] = [];
  const normalized = rawRows.map((rawRow) => ({ rawRow, outcome: normalizeRow(rawRow) }));
  for (const { outcome } of normalized) {
    if (outcome.ok && outcome.txn.docType === "PARCEL" && outcome.txn.recordKey) parcelKeys.push(outcome.txn.recordKey);
  }
  const join = joinGeometry(parcelKeys, geometries);

  let txCount = 0, rejCount = 0;
  for (const { rawRow, outcome } of normalized) {
    if (!outcome.ok) {
      await insertReject(batch._id, { source: rawRow.source, docType: rawRow.docType, rawRow: rawRow.raw, reason: outcome.reason });
      rejCount++; continue;
    }
    const geom = outcome.txn.recordKey ? join.matched.get(outcome.txn.recordKey) ?? null : null;
    const { inserted } = await insertTransactionDedup(batch._id, outcome.txn, geom);
    if (inserted) txCount++;
  }

  // geometry ที่ join ไม่ติด → quarantine ไม่ทิ้งเงียบ
  for (const key of join.unmatchedGeometry) {
    await insertReject(batch._id, { source: "geometry", docType: "PARCEL", rawRow: { recordKey: key }, reason: "geometry_unmatched" });
    rejCount++;
  }
  for (const bad of join.invalid) {
    await insertReject(batch._id, { source: "geometry", docType: "PARCEL", rawRow: { recordKey: bad.recordKey }, reason: "geometry_invalid" });
    rejCount++;
  }

  const counts = { transactions: txCount, rejects: rejCount, geometryMatched: join.matched.size, geometryUnmatched: join.unmatchedGeometry.length };
  await finishBatch(batch._id, "done", { ...counts, geometry: geometries.length });
  return { skipped: false, batchId: batch._id.toString(), counts };
}
