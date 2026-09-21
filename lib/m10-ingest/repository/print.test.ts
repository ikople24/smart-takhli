import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createBatch, insertTransactionDedup, confirmTransaction, listPrintRows } from "./index";
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
    payloadRaw: { "PARCEL_NO": "31635", "OWN_TITLE": "นางสาว", "OWN_FNAME": "วรารีย์", "OWN_LNAME": "ชาลีรัตน์", "OWN_PERS_ID": "1609700018248", OWN_TAMBOL: "ตาคลี" },
    ...over,
  };
}

describe("listPrintRows", () => {
  it("งวดที่ไม่มี batch คืนว่างและ batchCount 0 (ให้ API ตอบ 404 ได้)", async () => {
    const out = await listPrintRows("2569-01");
    expect(out.batchCount).toBe(0);
    expect(out.rows).toHaveLength(0);
  });

  it("คืนทุก txn ของงวดนั้น ไม่กรองตาม reviewStatus (พิมพ์ได้ทันทีหลังอัปโหลด)", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    await insertTransactionDedup(b._id, txn({ recordKey: "K2", deedNo: "2", rawStatus: "จำนอง", changeType: "ENCUMBRANCE", taxRelevant: false, reviewStatus: "auto" }));
    const out = await listPrintRows("2569-01");
    expect(out.batchCount).toBe(1);
    expect(out.rows).toHaveLength(2);
    expect(out.rows.map((r) => r.reviewStatus).sort()).toEqual(["auto", "pending"]);
    // ต้องส่ง payloadRaw มาเต็ม เพราะเลข 13 หลักอยู่ในนี้เท่านั้น
    expect(out.rows[0].payloadRaw["OWN_PERS_ID"]).toBe("1609700018248");
  });

  it("ไม่เอา txn ของงวดอื่นมาปน", async () => {
    const a = await createBatch({ fileHash: "hA", period: "2569-01", files: [], counts: {} });
    const c = await createBatch({ fileHash: "hC", period: "2569-02", files: [], counts: {} });
    await insertTransactionDedup(a._id, txn());
    await insertTransactionDedup(c._id, txn({ recordKey: "K9", deedNo: "9" }));
    expect((await listPrintRows("2569-01")).rows).toHaveLength(1);
    expect((await listPrintRows("2569-02")).rows).toHaveLength(1);
  });

  it("นับ batchCount ทุก batch ของงวดเดียวกัน (กรณี re-import)", async () => {
    const b1 = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    const b2 = await createBatch({ fileHash: "h2", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b1._id, txn());
    await insertTransactionDedup(b2._id, txn({ recordKey: "K2", deedNo: "2" }));
    const out = await listPrintRows("2569-01");
    expect(out.batchCount).toBe(2);
    expect(out.rows).toHaveLength(2);
  });

  it("parcelCode มาจาก m10_records ที่ recordKey ตรงกัน (ไม่มี record → null)", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    const t = await insertTransactionDedup(b._id, txn());
    // ยังไม่ confirm → ยังไม่มี record → parcelCode null
    expect((await listPrintRows("2569-01")).rows[0].parcelCode).toBeNull();
    // confirm แล้ว record เกิด (แต่ยังไม่มี basemap ให้จับคู่ → parcelCode ยัง null)
    await confirmTransaction(t.doc._id, "officer");
    const rows = (await listPrintRows("2569-01")).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].reviewStatus).toBe("confirmed");
  });

  it("เจ้าของเดิมมาจากประวัติที่ยืนยันแล้วก่อนต้นงวด", async () => {
    // งวดเก่า: โอนให้ 'นายเก่า' แล้ว confirm → เป็นเจ้าของตั้งต้น
    const old = await createBatch({ fileHash: "hOld", period: "2568-12", files: [], counts: {} });
    const t0 = await insertTransactionDedup(old._id, txn({
      txnDate: "2025-12-10",
      owner: { title: "นาย", name: "เก่า", surname: "ใจดี", fullName: "นาย เก่า ใจดี", idHash: "h0" },
    }));
    await confirmTransaction(t0.doc._id, "officer");
    // งวดใหม่: โอนแปลงเดิมต่อ
    const cur = await createBatch({ fileHash: "hCur", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(cur._id, txn({ txnDate: "2026-01-05" }));
    const rows = (await listPrintRows("2569-01")).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].oldOwnerName).toBe("นาย เก่า ใจดี");
  });

  it("แถวเจ้าของร่วม (คีย์ซ้ำ) ไม่ถูกทิ้ง — เก็บไว้ใน coOwnerRows ของรายการเดิม", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    const first = await insertTransactionDedup(b._id, txn({
      payloadRaw: { PARCEL_NO: "31635", OWN_LINE_NO: "1", OWN_FNAME: "หนึ่ง", OWN_PERS_ID: "1111111111111" },
    }));
    expect(first.inserted).toBe(true);
    // เจ้าของคนที่ 2 ของนิติกรรมเดียวกัน (recordKey/rawStatus/txnDate เหมือนกันเป๊ะ)
    const second = await insertTransactionDedup(b._id, txn({
      payloadRaw: { PARCEL_NO: "31635", OWN_LINE_NO: "2", OWN_FNAME: "สอง", OWN_PERS_ID: "2222222222222" },
    }));
    expect(second.inserted).toBe(false);

    const { rows } = await listPrintRows("2569-01");
    // ยังนับเป็น 1 รายการ (ยอดในบัญชีคุมไม่เพี้ยน)
    expect(rows).toHaveLength(1);
    // แต่เก็บเจ้าของคนที่ 2 ไว้พิมพ์
    expect(rows[0].payloadRaw.OWN_FNAME).toBe("หนึ่ง");
    expect(rows[0].coOwnerRows).toHaveLength(1);
    expect(rows[0].coOwnerRows[0].OWN_FNAME).toBe("สอง");
    expect(rows[0].coOwnerRows[0].OWN_PERS_ID).toBe("2222222222222");
  });

  it("นำเข้าแถวเจ้าของร่วมซ้ำลำดับเดิม ไม่เพิ่มซ้ำใน coOwnerRows", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    const raw2 = { PARCEL_NO: "31635", OWN_LINE_NO: "2", OWN_FNAME: "สอง", OWN_PERS_ID: "2222222222222" };
    await insertTransactionDedup(b._id, txn({ payloadRaw: { PARCEL_NO: "31635", OWN_LINE_NO: "1" } }));
    await insertTransactionDedup(b._id, txn({ payloadRaw: raw2 }));
    await insertTransactionDedup(b._id, txn({ payloadRaw: raw2 }));
    const { rows } = await listPrintRows("2569-01");
    expect(rows[0].coOwnerRows).toHaveLength(1);
  });
});
