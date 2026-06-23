import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createBatch, insertTransactionDedup, confirmTransaction, rejectTransaction } from "./index";
import type { NormalizedTxn } from "../types";

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });

function txn(over: Partial<NormalizedTxn> = {}): NormalizedTxn {
  return { docType: "PARCEL", recordKey: "K1", deedNo: "31635", rawStatus: "ขาย", changeType: "TRANSFER",
    taxRelevant: true, reviewStatus: "pending", txnDate: "2026-01-05", regAmount: 304000,
    owner: { title: "นาย", name: "ก", surname: "ข", fullName: "นาย ก ข", idHash: "h" },
    area: { rai: 0, ngan: 2, wa: 24, sqm: 896 }, payloadRaw: {}, ...over };
}
const col = (n: string) => mongoose.connection.db!.collection(n);

describe("confirmTransaction -> applyTxnToRecord", () => {
  it("creates record on confirm; reject does not", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const geo: GeoJSON.Polygon = { type: "Polygon", coordinates: [[[100, 15], [100.1, 15], [100.1, 15.1], [100, 15]]] };
    const t = await insertTransactionDedup(b._id, txn(), geo);
    expect(await col("m10_records").countDocuments()).toBe(0); // ยังไม่มีจน confirm

    await confirmTransaction(t.doc._id, "officer1");
    const rec = await col("m10_records").findOne({ recordKey: "K1" });
    expect(rec?.status).toBe("active");
    expect(rec?.hasGeometry).toBe(true);
    expect(rec?.version).toBe(1);
    expect((await col("m10_transactions").findOne({ _id: t.doc._id }))?.reviewStatus).toBe("confirmed");
  });

  it("RETIRED confirm retires record + bumps version", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const t1 = await insertTransactionDedup(b._id, txn());
    await confirmTransaction(t1.doc._id, "o");
    const t2 = await insertTransactionDedup(b._id, txn({ rawStatus: "เอกสารสิทธิที่ยกเลิกระหว่างเดือน", changeType: "RETIRED", txnDate: "2026-01-10" }));
    await confirmTransaction(t2.doc._id, "o");
    const rec = await col("m10_records").findOne({ recordKey: "K1" });
    expect(rec?.status).toBe("retired");
    expect(rec?.version).toBe(2);
    expect(rec?.history).toHaveLength(2);
  });

  it("confirmTransaction is idempotent: double confirm does not re-apply", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const t = await insertTransactionDedup(b._id, txn());
    await confirmTransaction(t.doc._id, "o");
    await confirmTransaction(t.doc._id, "o"); // ซ้ำ → ต้องไม่ bump version / ไม่ throw
    const rec = await col("m10_records").findOne({ recordKey: "K1" });
    expect(rec?.version).toBe(1);
    expect(rec?.history).toHaveLength(1);
  });

  it("rejectTransaction sets rejected, no record", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const t = await insertTransactionDedup(b._id, txn());
    await rejectTransaction(t.doc._id, "o");
    expect(await col("m10_records").countDocuments()).toBe(0);
    expect((await col("m10_transactions").findOne({ _id: t.doc._id }))?.reviewStatus).toBe("rejected");
  });
});
