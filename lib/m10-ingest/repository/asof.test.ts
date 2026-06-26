import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createBatch, insertTransactionDedup, confirmTransaction, asOfMaterialize } from "./index";
import type { NormalizedTxn } from "../types";

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });

function txn(over: Partial<NormalizedTxn>): NormalizedTxn {
  return { docType: "PARCEL", recordKey: "K1", deedNo: null, rawStatus: "ขาย", changeType: "TRANSFER",
    taxRelevant: true, reviewStatus: "pending", txnDate: "2026-01-05", regAmount: null,
    owner: { title: "", name: "A", surname: "", fullName: "A", idHash: null }, area: null, payloadRaw: {}, ...over };
}

describe("asOfMaterialize", () => {
  it("returns owner as of cutoff, ignoring later transactions", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const t1 = await insertTransactionDedup(b._id, txn({ txnDate: "2026-01-05", owner: { title: "", name: "A", surname: "", fullName: "A", idHash: null } }));
    const t2 = await insertTransactionDedup(b._id, txn({ rawStatus: "โอนมรดก", txnDate: "2026-01-20", owner: { title: "", name: "B", surname: "", fullName: "B", idHash: null } }));
    await confirmTransaction(t1.doc._id, "o");
    await confirmTransaction(t2.doc._id, "o");

    const early = await asOfMaterialize(new Date("2026-01-10"));
    expect(early.find((r) => r.recordKey === "K1")?.owners[0].fullName).toBe("A");
    const late = await asOfMaterialize(new Date("2026-01-31"));
    expect(late.find((r) => r.recordKey === "K1")?.owners[0].fullName).toBe("B");
  });
});
