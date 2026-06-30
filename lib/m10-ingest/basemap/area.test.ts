import { describe, it, expect } from "vitest";
import { partsToSqm, sqmToParts, parseAreaStr, formatAreaStr, geometryAreaSqm } from "./area";

describe("area conversions", () => {
  it("partsToSqm: ไร่/งาน/วา → ตร.ม.", () => {
    expect(partsToSqm(1, 0, 0)).toBe(1600);
    expect(partsToSqm(0, 1, 0)).toBe(400);
    expect(partsToSqm(0, 0, 1)).toBe(4);
    expect(partsToSqm(1, 2, 3)).toBe(2412);
  });
  it("sqmToParts: ตร.ม. → ไร่/งาน/วา", () => {
    expect(sqmToParts(2412)).toEqual({ rai: 1, ngan: 2, wa: 3, sqm: 2412 });
    expect(sqmToParts(0)).toEqual({ rai: 0, ngan: 0, wa: 0, sqm: 0 });
  });
  it("parseAreaStr / formatAreaStr round-trip", () => {
    expect(parseAreaStr("1-2-3")).toEqual({ rai: 1, ngan: 2, wa: 3, sqm: 2412 });
    expect(parseAreaStr("bad")).toBeNull();
    expect(parseAreaStr("1-2")).toBeNull();
    expect(formatAreaStr({ rai: 1, ngan: 2, wa: 3 })).toBe("1-2-3");
    expect(formatAreaStr(null)).toBe("");
  });
  it("geometryAreaSqm: รูปสามจุดขึ้นไปได้พื้นที่ > 0, ไม่ถูกต้อง = 0", () => {
    const sq = { type: "Polygon", coordinates: [[[100, 15], [100.001, 15], [100.001, 15.001], [100, 15.001], [100, 15]]] } as const;
    expect(geometryAreaSqm(sq as unknown as GeoJSON.Polygon)).toBeGreaterThan(0);
    expect(geometryAreaSqm(null)).toBe(0);
  });
});
