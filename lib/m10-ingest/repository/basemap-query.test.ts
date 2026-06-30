import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { applyBasemapEdit, listBasemapInBbox, searchBasemap } from "./index";

const POLY = (x: number, y: number, s = 0.001) => ({
  type: "Polygon", coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]],
});

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { const db = mongoose.connection.db; if (db) { const c = await db.collections(); await Promise.all(c.map((x) => x.deleteMany({}))); } });
const col = (n: string) => mongoose.connection.db!.collection(n);

describe("applyBasemapEdit — attrs ใหม่ + reorder", () => {
  it("เก็บ zoneId/blockId/lot/landType ลง effective + edit-row", async () => {
    await applyBasemapEdit({
      parcelCode: "07A001", deedNo: "9", landNo: "12", survey: "3",
      zoneId: "07", blockId: "A", lot: "001", landType: "นา",
      area: { rai: 1, ngan: 0, wa: 0, sqm: 1600 }, geometry: POLY(100, 15), kind: "new", by: "o",
    });
    const eff = await col("m10_basemap").findOne({ parcelCode: "07A001" });
    expect(eff?.zoneId).toBe("07");
    expect(eff?.landType).toBe("นา");
    expect(eff?.area?.sqm).toBe(1600);
    const edit = await col("m10_basemap_edit").findOne({ parcelCode: "07A001" });
    expect(edit?.blockId).toBe("A");
    expect(edit?.lot).toBe("001");
  });

  it("geometry ไม่ถูกต้อง → โยน error และไม่เขียนอะไรเลย (effective-first)", async () => {
    await expect(applyBasemapEdit({
      parcelCode: "07B001", geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [0, 0]]] },
    })).rejects.toThrow();
    expect(await col("m10_basemap").countDocuments({ parcelCode: "07B001" })).toBe(0);
    expect(await col("m10_basemap_edit").countDocuments({ parcelCode: "07B001" })).toBe(0);
  });

  it("geometry edit ยุบ fragment เป็น 1 doc (ลำดับใหม่: create ก่อน ลบทีหลัง)", async () => {
    await col("m10_basemap").insertMany([
      { parcelCode: "07C001", geometry: POLY(100, 15) },
      { parcelCode: "07C001", geometry: POLY(100.002, 15) },
    ]);
    await applyBasemapEdit({ parcelCode: "07C001", deedNo: "9", geometry: POLY(100, 15, 0.002), by: "o" });
    expect(await col("m10_basemap").countDocuments({ parcelCode: "07C001" })).toBe(1);
  });
});

describe("listBasemapInBbox", () => {
  it("คืนเฉพาะแปลงที่ตัดกรอบ + ตั้ง truncated เมื่อเกิน limit", async () => {
    await col("m10_basemap").insertMany([
      { parcelCode: "07A001", deedNo: "1", geometry: POLY(100, 15) },
      { parcelCode: "07A002", deedNo: "2", geometry: POLY(100.001, 15) },
      { parcelCode: "07Z999", deedNo: "9", geometry: POLY(105, 15) }, // ไกลออกนอกกรอบ
    ]);
    const bbox: [number, number, number, number] = [99.9, 14.9, 100.1, 15.1];
    const all = await listBasemapInBbox(bbox, 800);
    expect(all.features.length).toBe(2);
    expect(all.truncated).toBe(false);
    expect(all.features[0].properties!.parcelCode).toBeTruthy();
    const capped = await listBasemapInBbox(bbox, 1);
    expect(capped.features.length).toBe(1);
    expect(capped.truncated).toBe(true);
  });
});

describe("searchBasemap", () => {
  it("ค้นด้วยรหัสแปลง (มี /) แบบ prefix และ deedNo แบบตรง", async () => {
    await col("m10_basemap").insertMany([
      { parcelCode: "07K002/004", deedNo: "49166", geometry: POLY(100, 15) },
      { parcelCode: "07K002/004/01", deedNo: "74241", geometry: POLY(100.001, 15) },
      { parcelCode: "09Z001", deedNo: "555", geometry: POLY(101, 16) },
    ]);
    const byCode = await searchBasemap("07K002/004");
    expect(byCode.results.map((r) => r.parcelCode).sort()).toEqual(["07K002/004", "07K002/004/01"]);
    expect(byCode.results[0].bbox).toHaveLength(4);
    const byDeed = await searchBasemap("555");
    expect(byDeed.results.map((r) => r.parcelCode)).toEqual(["09Z001"]);
  });
});
