import { describe, it, expect } from "vitest";
import { matchParcel, type BasemapCandidate, type MatchResolvers } from "./match";

const SQ = (x: number, y: number, s = 0.001): GeoJSON.Polygon => ({
  type: "Polygon", coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]],
});
const cand = (id: string, code: string, deed: string | null, geom: GeoJSON.Polygon | null): BasemapCandidate =>
  ({ basemapId: id, parcelCode: code, deedNo: deed, geometry: geom });

const none: MatchResolvers = { byDeed: async () => [], byLandSurvey: async () => [], byGeom: async () => [] };
const input = { deedNo: "111", landNo: "5", survey: "9", geometry: SQ(100, 15) };

describe("matchParcel", () => {
  it("deed exact 1 → matched/deed/high", async () => {
    const r = { ...none, byDeed: async () => [cand("b1", "01A001", "111", SQ(100, 15))] };
    const m = await matchParcel(input, r);
    expect(m.status).toBe("matched"); expect(m.method).toBe("deed");
    expect(m.parcelCode).toBe("01A001"); expect(m.basemapId).toBe("b1");
  });

  it("deed multi → geometry ตัดสิน → deed+geom", async () => {
    const r = { ...none, byDeed: async () => [cand("b1", "C1", "111", SQ(0, 0)), cand("b2", "C2", "111", SQ(100, 15))] };
    const m = await matchParcel(input, r);
    expect(m.status).toBe("matched"); expect(m.method).toBe("deed+geom");
    expect(m.parcelCode).toBe("C2");
    expect(m.candidates.length).toBe(2);
  });

  it("deed multi แต่ candidate รหัสเดียวกันหมด → matched (basemap fragment ไม่ใช่ ambiguous จริง)", async () => {
    const r = { ...none, byDeed: async () => [cand("b1", "07K002/004", "111", SQ(0, 0)), cand("b2", "07K002/004", "111", SQ(50, 50))] };
    const m = await matchParcel(input, r);
    expect(m.status).toBe("matched"); expect(m.method).toBe("deed");
    expect(m.parcelCode).toBe("07K002/004");
    expect(m.candidates.length).toBe(2); // เก็บไว้ให้ดู transparency
  });

  it("deed multi + ไม่ทับ → ambiguous", async () => {
    const r = { ...none, byDeed: async () => [cand("b1", "C1", "111", SQ(0, 0)), cand("b2", "C2", "111", SQ(50, 50))] };
    const m = await matchParcel(input, r);
    expect(m.status).toBe("ambiguous"); expect(m.parcelCode).toBeNull();
    expect(m.candidates.length).toBe(2);
  });

  it("ไม่เจอโฉนด → land+survey เจอ 1 → matched/land+survey", async () => {
    const r = { ...none, byLandSurvey: async () => [cand("b3", "C3", "111", SQ(100, 15))] };
    const m = await matchParcel(input, r);
    expect(m.status).toBe("matched"); expect(m.method).toBe("land+survey"); expect(m.parcelCode).toBe("C3");
  });

  it("ตกมาชั้น geom → overlap ≥ 0.5 → matched/geom", async () => {
    const r = { ...none, byGeom: async () => [cand("b4", "C4", null, SQ(100, 15))] };
    const m = await matchParcel(input, r);
    expect(m.status).toBe("matched"); expect(m.method).toBe("geom"); expect(m.parcelCode).toBe("C4");
  });

  it("geom overlap < 0.5 → ambiguous", async () => {
    const r = { ...none, byGeom: async () => [cand("b5", "C5", null, SQ(100.0008, 15.0008))] };
    const m = await matchParcel(input, r);
    expect(m.status).toBe("ambiguous");
  });

  it("ไม่เจออะไรเลย → unmatched", async () => {
    const m = await matchParcel(input, none);
    expect(m.status).toBe("unmatched"); expect(m.method).toBeNull();
  });

  it("ไม่มี geometry + โฉนดหลาย → ambiguous (ตัดสินด้วย geom ไม่ได้)", async () => {
    const r = { ...none, byDeed: async () => [cand("b1", "C1", "111", SQ(0, 0)), cand("b2", "C2", "111", SQ(1, 1))] };
    const m = await matchParcel({ ...input, geometry: null }, r);
    expect(m.status).toBe("ambiguous");
  });
});
