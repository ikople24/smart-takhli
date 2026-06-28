import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  createBatch, insertTransactionDedup, confirmTransaction,
  listWorklistPending, getWorklistItem, markKeyed, markSkip,
} from "./index";
import type { NormalizedTxn } from "../types";

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });

function txn(over: Partial<NormalizedTxn> = {}): NormalizedTxn {
  return {
    docType: "PARCEL", recordKey: "K1", deedNo: "31635", rawStatus: "ขาย",
    changeType: "TRANSFER", taxRelevant: true, reviewStatus: "pending",
    txnDate: "2026-01-05", regAmount: null,
    owner: { title: "นางสาว", name: "วรารีย์", surname: "ชาลีรัตน์", fullName: "นางสาว วรารีย์ ชาลีรัตน์", idHash: "h" },
    area: { rai: 0, ngan: 2, wa: 24, sqm: 896 },
    payloadRaw: { "โฉนด": "31635", "คำนำหน้า": "นางสาว", "ชื่อ": "วรารีย์", "นามสกุล": "ชาลีรัตน์", "13 หลัก": "1609700018248", "OWN_TAMBOL": "ตาคลี" },
    ...over,
  };
}

describe("worklist repository", () => {
  it("listWorklistPending returns only confirmed eligible pending txns", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const t1 = await insertTransactionDedup(b._id, txn());                                   // TRANSFER -> eligible
    await insertTransactionDedup(b._id, txn({ recordKey: "K2", rawStatus: "จำนอง", changeType: "ENCUMBRANCE", reviewStatus: "auto" })); // not eligible
    // before confirm: nothing pending in worklist
    expect(await listWorklistPending({})).toHaveLength(0);
    await confirmTransaction(t1.doc._id, "o");
    const pending = await listWorklistPending({});
    expect(pending).toHaveLength(1);
    expect(pending[0].changeType).toBe("TRANSFER");
  });

  it("markKeyed removes it from pending and records who/when", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const t = await insertTransactionDedup(b._id, txn());
    await confirmTransaction(t.doc._id, "o");
    await markKeyed(t.doc._id, "officer1");
    expect(await listWorklistPending({})).toHaveLength(0);
    const doc = await mongoose.connection.db!.collection("m10_transactions").findOne({ _id: t.doc._id });
    expect(doc?.ltaxStatus).toBe("keyed");
    expect(doc?.ltaxKeyedBy).toBe("officer1");
  });

  it("markSkip stores note", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    const t = await insertTransactionDedup(b._id, txn());
    await confirmTransaction(t.doc._id, "o");
    await markSkip(t.doc._id, "officer1", "ข้อมูลไม่ครบ");
    const doc = await mongoose.connection.db!.collection("m10_transactions").findOne({ _id: t.doc._id });
    expect(doc?.ltaxStatus).toBe("skipped");
    expect(doc?.ltaxNote).toBe("ข้อมูลไม่ครบ");
    expect(await listWorklistPending({})).toHaveLength(0);
  });

  it("getWorklistItem builds the keying script and resolves oldOwnerName from prior confirmed txn", async () => {
    const b = await createBatch({ fileHash: "h", period: "2569-01", files: [], counts: {} });
    // prior owner on same parcel (earlier date)
    const t0 = await insertTransactionDedup(b._id, txn({ rawStatus: "โอนมรดก", txnDate: "2025-12-01", owner: { title: "นาย", name: "เก่า", surname: "ก", fullName: "นาย เก่า ก", idHash: "h0" } }));
    await confirmTransaction(t0.doc._id, "o");
    const t1 = await insertTransactionDedup(b._id, txn());
    await confirmTransaction(t1.doc._id, "o");

    const item = await getWorklistItem(t1.doc._id);
    expect(item.changeType).toBe("TRANSFER");
    expect(item.search.deedNo).toBe("31635");
    expect(item.search.oldOwnerName).toBe("นาย เก่า ก"); // จาก as-of ก่อนวันที่ของ t1
    expect(item.steps.find((s) => s.label === "ชื่อ")?.value).toBe("วรารีย์");
  });
});
