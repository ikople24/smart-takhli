import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { resolveReconcile, reconcileRecord, getReconcileItem, applyBasemapEdit, replayBasemapEdits } from "./index";

const POLY = (x: number, y: number, s = 0.001) => ({
  type: "Polygon", coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]],
});

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

describe("applyBasemapEdit / replayBasemapEdits", () => {
  it("geometry edit collapses fragments to one doc", async () => {
    await col("m10_basemap").insertMany([
      { parcelCode: "07A001", geometry: POLY(100, 15) },
      { parcelCode: "07A001", geometry: POLY(100.002, 15) }, // 2 fragments
    ]);
    await applyBasemapEdit({ parcelCode: "07A001", deedNo: "9", geometry: POLY(100, 15, 0.002), by: "o" });
    const docs = await col("m10_basemap").find({ parcelCode: "07A001" }).toArray();
    expect(docs.length).toBe(1);
    expect(docs[0].deedNo).toBe("9");
    expect(await col("m10_basemap_edit").countDocuments({ parcelCode: "07A001" })).toBe(1);
  });

  it("new code inserts; attribute-only edit keeps geometry", async () => {
    await applyBasemapEdit({ parcelCode: "07A002", geometry: POLY(100, 15), kind: "new", by: "o" });
    expect(await col("m10_basemap").countDocuments({ parcelCode: "07A002" })).toBe(1);
    // attr-only edit
    await applyBasemapEdit({ parcelCode: "07A002", deedNo: "55", by: "o" });
    const d = await col("m10_basemap").findOne({ parcelCode: "07A002" });
    expect(d!.deedNo).toBe("55");
    expect(d!.geometry).toBeTruthy(); // geometry เดิมคงอยู่
  });

  it("replay re-applies edits after a simulated reimport", async () => {
    await applyBasemapEdit({ parcelCode: "07A003", deedNo: "1", geometry: POLY(100, 15), by: "o" });
    await col("m10_basemap").deleteMany({}); // จำลอง import drop
    expect(await col("m10_basemap").countDocuments({ parcelCode: "07A003" })).toBe(0);
    const n = await replayBasemapEdits();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(await col("m10_basemap").countDocuments({ parcelCode: "07A003" })).toBe(1);
  });

  it("resolveReconcile writeBasemap=true writes edit; false does not", async () => {
    await col("m10_records").insertOne({ recordKey: "KB", deedNo: "1", geometry: null, parcelMatch: { status: "ambiguous", candidates: [] } });
    await resolveReconcile("KB", "o", { parcelCode: "09Z001", writeBasemap: false });
    expect(await col("m10_basemap_edit").countDocuments({ parcelCode: "09Z001" })).toBe(0);
    await resolveReconcile("KB", "o", { parcelCode: "09Z001", geometry: POLY(100, 15), writeBasemap: true });
    expect(await col("m10_basemap_edit").countDocuments({ parcelCode: "09Z001" })).toBe(1);
    expect(await col("m10_basemap").countDocuments({ parcelCode: "09Z001" })).toBe(1);
  });
});
