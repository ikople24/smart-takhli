import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { resolveReconcile, reconcileRecord, getReconcileItem } from "./index";

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });
const col = (n: string) => mongoose.connection.db!.collection(n);

describe("resolveReconcile", () => {
  it("stores override resolved + chosen parcelCode wins", async () => {
    await col("m10_records").insertOne({ recordKey: "K1", deedNo: "1", geometry: null, parcelMatch: { status: "ambiguous", candidates: [] } });
    const r = await resolveReconcile("K1", "officer1", { parcelCode: "07A001", note: "เลือกเอง" });
    expect(r.parcelCode).toBe("07A001");
    const rec = await col("m10_records").findOne({ recordKey: "K1" });
    expect(rec?.reconcileOverride?.status).toBe("resolved");
    expect(rec?.reconcileOverride?.by).toBe("officer1");
  });

  it("reconcileRecord skips a resolved record (no clobber)", async () => {
    await col("m10_records").insertOne({ recordKey: "K1", deedNo: "1", geometry: null,
      reconcileOverride: { status: "resolved", parcelCode: "07A001", by: "o", at: new Date() } });
    const doc = await col("m10_records").findOne({ recordKey: "K1" });
    await reconcileRecord({ _id: doc!._id, recordKey: "K1", deedNo: "1", geometry: null });
    const rec = await col("m10_records").findOne({ recordKey: "K1" });
    expect(rec?.reconcileOverride?.parcelCode).toBe("07A001"); // ยังอยู่
    expect(rec?.parcelMatch).toBeUndefined(); // reconcileRecord ออกก่อนเขียน parcelMatch
  });

  it("getReconcileItem returns null for missing", async () => {
    expect(await getReconcileItem("NOPE")).toBeNull();
  });

  it("saves override geometry (validated) + re-matches with it", async () => {
    const poly = { type: "Polygon", coordinates: [[[100, 15], [100.01, 15], [100.01, 15.01], [100, 15.01], [100, 15]]] };
    await col("m10_basemap").insertOne({ parcelCode: "07A001", deedNo: "9", geometry: poly });
    await col("m10_records").insertOne({ recordKey: "K1", deedNo: null, geometry: null, parcelMatch: { status: "unmatched", candidates: [] } });
    const r = await resolveReconcile("K1", "o", { geometry: poly });
    expect(r.status).toBe("resolved");
    const rec = await col("m10_records").findOne({ recordKey: "K1" });
    expect(rec?.reconcileOverride?.geometry?.type).toBe("Polygon");
  });

  it("rejects invalid edited geometry", async () => {
    await col("m10_records").insertOne({ recordKey: "K2", geometry: null });
    await expect(
      resolveReconcile("K2", "o", { geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [0, 0]]] } })
    ).rejects.toThrow();
  });
});
