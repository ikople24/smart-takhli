import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { listNewCode, confirmNewCode, summaryByPeriod } from "./index";

const POLY = (x: number, y: number, s = 0.001) => ({
  type: "Polygon", coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]],
});

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });
const col = (n: string) => mongoose.connection.db!.collection(n);

describe("listNewCode", () => {
  it("คืนเฉพาะ confirmed deferred + suggestedCode", async () => {
    await col("m10_basemap").insertOne({ parcelCode: "01A001", deedNo: "9", geometry: POLY(100, 15, 0.01) });
    await col("m10_records").insertOne({ recordKey: "S1", deedNo: "9", landNo: "5", survey: "1", lastChangeType: "SPLIT", geometry: POLY(100, 15) });
    await col("m10_transactions").insertOne({ recordKey: "S1", changeType: "SPLIT", reviewStatus: "confirmed" });
    // TRANSFER ไม่ควรมา
    await col("m10_transactions").insertOne({ recordKey: "T1", changeType: "TRANSFER", reviewStatus: "confirmed" });
    const rows = await listNewCode();
    expect(rows.length).toBe(1);
    expect(rows[0].recordKey).toBe("S1");
    expect(rows[0].changeType).toBe("SPLIT");
    expect(rows[0].suggestedCode).toBe("01A001/001");
  });
});

describe("confirmNewCode → record + basemap + worklist eligible", () => {
  it("ยืนยัน → record มี parcelCode/resolved, basemap มีแปลงใหม่ (รูป m10), summary นับ wlEligible", async () => {
    await col("m10_records").insertOne({ recordKey: "N1", deedNo: "999", lastChangeType: "NEW", geometry: POLY(100, 15) });
    const batch = await col("m10_import_batches").insertOne({ period: "2569-01" });
    await col("m10_transactions").insertOne({ recordKey: "N1", changeType: "NEW", reviewStatus: "confirmed", batchId: batch.insertedId });

    await confirmNewCode("N1", "officer1", { parcelCode: "02B121", deedNo: "999" });

    const rec = await col("m10_records").findOne({ recordKey: "N1" });
    // รหัสที่ยืนยันเก็บใน reconcileOverride (resolveReconcile ไม่แตะ canonical parcelCode)
    expect(rec?.reconcileOverride?.parcelCode).toBe("02B121");
    expect(rec?.reconcileOverride?.status).toBe("resolved");
    expect(await col("m10_basemap").countDocuments({ parcelCode: "02B121" })).toBe(1);
    const bm = await col("m10_basemap").findOne({ parcelCode: "02B121" });
    expect(bm?.geometry?.type).toBe("Polygon"); // ได้รูปจาก m10

    const sum = await summaryByPeriod();
    const row = sum.find((s) => s.period === "2569-01");
    expect(row?.wlEligible).toBe(1); // deferred resolved นับเป็น eligible
    expect(row?.deferred).toBe(0);   // ไม่ค้างแล้ว
  });
});
