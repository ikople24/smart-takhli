import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { findBatchByHash, createBatch, insertTransactionDedup, insertReject } from "./index";
import type { NormalizedTxn } from "../types";

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });

function txn(over: Partial<NormalizedTxn> = {}): NormalizedTxn {
  return { docType: "PARCEL", recordKey: "5039|2|4682|07|1000|84", deedNo: "31635",
    rawStatus: "ขาย", changeType: "TRANSFER", taxRelevant: true, reviewStatus: "pending",
    txnDate: "2026-01-05", regAmount: 304000,
    owner: { title: "นางสาว", name: "วรารีย์", surname: "ชาลีรัตน์", fullName: "นางสาว วรารีย์ ชาลีรัตน์", idHash: "h" },
    area: { rai: 0, ngan: 2, wa: 24, sqm: 896 }, payloadRaw: {}, ...over };
}

describe("batch idempotency", () => {
  it("findBatchByHash null then created", async () => {
    expect(await findBatchByHash("h1")).toBeNull();
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    expect((await findBatchByHash("h1"))?._id.toString()).toBe(b._id.toString());
  });
});
describe("insertTransactionDedup", () => {
  it("inserts once, second identical = no-op, stores geometry+reviewStatus", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const geo = { type: "Polygon", coordinates: [[[100, 15], [100.1, 15], [100.1, 15.1], [100, 15]]] };
    const first = await insertTransactionDedup(b._id, txn(), geo as any);
    const second = await insertTransactionDedup(b._id, txn(), geo as any);
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(first.doc.reviewStatus).toBe("pending");
    expect(first.doc.geometry.type).toBe("Polygon");
    expect(await mongoose.connection.db!.collection("m10_transactions").countDocuments()).toBe(1);
  });
});
describe("insertReject", () => {
  it("stores quarantine row", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    await insertReject(b._id, { source: "parcel.csv", docType: "PARCEL", rawRow: { a: "1" }, reason: "unknown_status" });
    expect(await mongoose.connection.db!.collection("m10_rejects").countDocuments()).toBe(1);
  });
});
