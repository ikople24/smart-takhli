import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createBatch, insertTransactionDedup, searchM10Transactions, getM10TransactionDetail, M10Record, M10Transaction } from "./index";
import type { NormalizedTxn } from "../types";

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });

function txn(over: Partial<NormalizedTxn> = {}): NormalizedTxn {
  return {
    docType: "PARCEL", recordKey: "K1", deedNo: "81145", rawStatus: "ขาย",
    changeType: "TRANSFER", taxRelevant: true, reviewStatus: "pending",
    txnDate: "2026-01-05", regAmount: null,
    owner: { title: "นางสาว", name: "วรารีย์", surname: "ชาลีรัตน์", fullName: "นางสาว วรารีย์ ชาลีรัตน์", idHash: "h" },
    area: { rai: 0, ngan: 0, wa: 53.6, sqm: 214.4 },
    payloadRaw: { PARCEL_NO: "81145", LAND_NO: "1100", OWN_PERS_ID: "1234567890123" },
    ...over,
  };
}

describe("searchM10Transactions", () => {
  it("ค้นด้วยเลขโฉนด", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    await insertTransactionDedup(b._id, txn({ recordKey: "K2", deedNo: "99999", payloadRaw: { LAND_NO: "2200" } }));

    const out = await searchM10Transactions("81145");
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].deedNo).toBe("81145");
    expect(out.rows[0].period).toBe("2569-01");
    expect(out.hasMore).toBe(false);
  });

  it("ค้นด้วยเลขที่ดิน (payloadRaw.LAND_NO)", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    const out = await searchM10Transactions("1100");
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].deedNo).toBe("81145");
    expect(out.rows[0].landNo).toBe("1100");
  });

  it("ค้นด้วยชื่อเจ้าของบางส่วน", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    const out = await searchM10Transactions("วรารีย์");
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].ownerName).toBe("นางสาว วรารีย์ ชาลีรัตน์");
  });

  it("ค้นด้วย parcelCode (join จาก m10_records)", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    await M10Record.create({ recordKey: "K1", parcelCode: "01A001" });

    const out = await searchM10Transactions("01A001");
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].recordKey).toBe("K1");
    expect(out.rows[0].parcelCode).toBe("01A001");
  });

  it("parcelCode ที่ จนท. แก้ (reconcileOverride) ชนะค่า auto", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    await M10Record.create({ recordKey: "K1", parcelCode: "01A001", reconcileOverride: { parcelCode: "02B120", status: "resolved" } });

    const out = await searchM10Transactions("81145");
    expect(out.rows[0].parcelCode).toBe("02B120");
    const byOverride = await searchM10Transactions("02B120");
    expect(byOverride.rows).toHaveLength(1);
  });

  it("ผลลัพธ์ข้ามงวดมารวมกัน เรียงวันที่ใหม่→เก่า", async () => {
    const jan = await createBatch({ fileHash: "hJan", period: "2569-01", files: [], counts: {} });
    const feb = await createBatch({ fileHash: "hFeb", period: "2569-02", files: [], counts: {} });
    await insertTransactionDedup(jan._id, txn({ txnDate: "2026-01-05" }));
    await insertTransactionDedup(feb._id, txn({ txnDate: "2026-02-09", rawStatus: "ให้" }));

    const out = await searchM10Transactions("81145");
    expect(out.rows).toHaveLength(2);
    expect(out.rows.map((r) => r.period)).toEqual(["2569-02", "2569-01"]);
  });

  it("ไม่กรองตาม reviewStatus — เห็นทั้ง confirmed/rejected/auto", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn({ reviewStatus: "rejected", rawStatus: "ขาย" }));
    await insertTransactionDedup(b._id, txn({ reviewStatus: "auto", rawStatus: "จำนอง", taxRelevant: false }));

    const out = await searchM10Transactions("81145");
    expect(out.rows).toHaveLength(2);
    expect(out.rows.map((r) => r.reviewStatus).sort()).toEqual(["auto", "rejected"]);
  });

  it("แบ่งหน้าด้วย skip/limit และบอก hasMore", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    for (let i = 0; i < 3; i++) {
      await insertTransactionDedup(b._id, txn({ recordKey: `K${i}`, txnDate: `2026-01-0${i + 1}` }));
    }
    const p1 = await searchM10Transactions("81145", { limit: 2 });
    expect(p1.rows).toHaveLength(2);
    expect(p1.hasMore).toBe(true);

    const p2 = await searchM10Transactions("81145", { skip: 2, limit: 2 });
    expect(p2.rows).toHaveLength(1);
    expect(p2.hasMore).toBe(false);
  });

  it("txnDate/createdAt ชนกัน — แบ่งหน้าไม่ซ้ำไม่หาย ด้วย _id เป็น tiebreaker", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    for (let i = 0; i < 4; i++) {
      await insertTransactionDedup(b._id, txn({ recordKey: `K${i}`, txnDate: "2026-01-05" }));
    }
    // บังคับ createdAt ให้เท่ากันเป๊ะทุกแถว (แค่ txnDate ตรงกันไม่พอ — insert เรียงกันจริง
    // มักได้ createdAt คนละ ms กัน sort จะไม่ชนกันจริง) ให้ sort key 2 ตัวแรกเหมือนกันหมด
    // MongoDB จึงต้องพึ่ง _id เป็นตัวตัดสินลำดับเท่านั้น
    await M10Transaction.updateMany({}, { $set: { createdAt: new Date("2026-01-05T00:00:00.000Z") } });

    const p1 = await searchM10Transactions("81145", { limit: 2 });
    expect(p1.rows).toHaveLength(2);
    expect(p1.hasMore).toBe(true);

    const p2 = await searchM10Transactions("81145", { skip: 2, limit: 2 });
    expect(p2.rows).toHaveLength(2);
    expect(p2.hasMore).toBe(false);

    const ids = [...p1.rows, ...p2.rows].map((r) => r.txnId);
    expect(new Set(ids).size).toBe(4); // ไม่มีแถวซ้ำข้ามหน้า
    expect(ids).toHaveLength(4);       // ครบทุกแถวที่ใส่ไว้ ไม่มีตกหล่น
  });

  it("ไม่พบ → คืน array ว่าง ไม่ throw", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    const out = await searchM10Transactions("ไม่มีคำนี้");
    expect(out.rows).toEqual([]);
    expect(out.hasMore).toBe(false);
  });

  it("คำค้นที่มีอักขระ regex พิเศษไม่ทำให้ query พัง", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    const out = await searchM10Transactions("8.1145");
    expect(out.rows).toEqual([]);
  });

  it("ไม่ส่ง payloadRaw/เลขบัตรออกมาในผลลัพธ์รายการ", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn());
    const out = await searchM10Transactions("81145");
    expect(JSON.stringify(out.rows)).not.toContain("1234567890123");
  });

  it("สิ่งปลูกสร้างเอาเนื้อที่ ตร.ม. จาก payloadRaw.AREA มาด้วย", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    await insertTransactionDedup(b._id, txn({
      docType: "CONSTRUCTION", recordKey: null, deedNo: null, area: null,
      payloadRaw: { AREA: "120.50", OWN_FNAME: "วรารีย์" },
    }));
    const out = await searchM10Transactions("วรารีย์");
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].constructionArea).toBe("120.50");
    expect(out.rows[0].area).toBeNull();
  });
});

describe("getM10TransactionDetail", () => {
  it("คืนรายละเอียดเต็มรวม payloadRaw, งวด และ parcelCode", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    const t = await insertTransactionDedup(b._id, txn());
    await M10Record.create({ recordKey: "K1", parcelCode: "01A001" });

    const detail = await getM10TransactionDetail(String(t.doc._id));
    expect(detail).not.toBeNull();
    expect(detail!.period).toBe("2569-01");
    expect(detail!.deedNo).toBe("81145");
    expect(detail!.parcelCode).toBe("01A001");
    expect(detail!.payloadRaw.OWN_PERS_ID).toBe("1234567890123");
    expect(detail!.area).toEqual({ rai: 0, ngan: 0, wa: 53.6, sqm: 214.4 });
    expect(detail!.reviewStatus).toBe("pending");
  });

  it("parcelCode ที่ จนท. แก้ ชนะค่า auto", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    const t = await insertTransactionDedup(b._id, txn());
    await M10Record.create({ recordKey: "K1", parcelCode: "01A001", reconcileOverride: { parcelCode: "02B120", status: "resolved" } });

    const detail = await getM10TransactionDetail(String(t.doc._id));
    expect(detail!.parcelCode).toBe("02B120");
  });

  it("เก็บเจ้าของร่วมมาด้วย", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    const first = await insertTransactionDedup(b._id, txn({
      payloadRaw: { PARCEL_NO: "81145", LAND_NO: "1100", OWN_LINE_NO: "1", OWN_FNAME: "หนึ่ง" },
    }));
    await insertTransactionDedup(b._id, txn({
      payloadRaw: { PARCEL_NO: "81145", LAND_NO: "1100", OWN_LINE_NO: "2", OWN_FNAME: "สอง" },
    }));

    const detail = await getM10TransactionDetail(String(first.doc._id));
    expect(detail!.coOwnerRows).toHaveLength(1);
    expect(detail!.coOwnerRows[0].OWN_FNAME).toBe("สอง");
  });

  it("สิ่งปลูกสร้างไม่มี recordKey → parcelCode เป็น null ไม่ throw", async () => {
    const b = await createBatch({ fileHash: "h1", period: "2569-01", files: [], counts: {} });
    const t = await insertTransactionDedup(b._id, txn({
      docType: "CONSTRUCTION", recordKey: null, deedNo: null, area: null,
      payloadRaw: { AREA: "120.50" },
    }));
    const detail = await getM10TransactionDetail(String(t.doc._id));
    expect(detail!.parcelCode).toBeNull();
    expect(detail!.recordKey).toBeNull();
    expect(detail!.payloadRaw.AREA).toBe("120.50");
  });

  it("ไม่มีรายการนี้ → null (ให้ API ตอบ 404 ได้)", async () => {
    const detail = await getM10TransactionDetail("000000000000000000000000");
    expect(detail).toBeNull();
  });

  it("txnId ที่ไม่ใช่ ObjectId → null ไม่ throw", async () => {
    const detail = await getM10TransactionDetail("ไม่ใช่ไอดี");
    expect(detail).toBeNull();
  });
});
