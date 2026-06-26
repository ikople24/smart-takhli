import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ingestZip } from "./ingest";

const ZIP = readFileSync(join(process.cwd(), "public/60070001_60010000.zip"));
let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });
const col = (n: string) => mongoose.connection.db!.collection(n);

describe("ingestZip (real ม.ค. 2569 batch)", () => {
  it("writes transactions, no records yet; parcel txns carry geometry; geometry 59/59", async () => {
    const res = await ingestZip(ZIP, { period: "2569-01" });
    expect(res.skipped).toBe(false);
    // parcel 87 rows (71 unique after intra-batch dedup) + ns3a 4 + construction 12 = 87
    // dedup key = batchId+recordKey+rawStatus+txnDate → same parcel/tx/date only once
    expect(await col("m10_transactions").countDocuments()).toBeGreaterThanOrEqual(85);
    expect(await col("m10_records").countDocuments()).toBe(0); // ยังไม่ confirm
    const withGeo = await col("m10_transactions").countDocuments({ docType: "PARCEL", geometry: { $ne: null } });
    expect(withGeo).toBeGreaterThan(0);
    expect(res.counts!.geometryMatched).toBe(59);
    // ทุกสถานะ map ได้ → ไม่มี unknown_status
    expect(await col("m10_rejects").countDocuments({ reason: "unknown_status" })).toBe(0);
  });

  it("is idempotent: re-run same ZIP -> skipped, no new txns", async () => {
    await ingestZip(ZIP, { period: "2569-01" });
    const before = await col("m10_transactions").countDocuments();
    const res2 = await ingestZip(ZIP, { period: "2569-01" });
    expect(res2.skipped).toBe(true);
    expect(await col("m10_transactions").countDocuments()).toBe(before);
    expect(await col("m10_import_batches").countDocuments()).toBe(1);
  });
});
