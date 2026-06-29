import { describe, it, expect } from "vitest";
import { parseArea } from "./area";
import { NormalizeError } from "../types";

describe("parseArea", () => {
  it("row0 of real data: 0 ไร่ 2 งาน 24 วา 0 เศษ = 896 sqm", () => {
    expect(parseArea("0", "2", "24", "0")).toEqual({ rai: 0, ngan: 2, wa: 24, sqm: 896 });
  });
  it("เศษ = ส่วนร้อยของ ตร.ว. (เช่น เศษ 9 → .09); ยืนยันกับ LTAX จริง", () => {
    // 1 ไร่ 2 งาน 30 วา เศษ 9 = 30.09 ตร.ว. → (400+200+30.09)*4
    expect(parseArea("1", "2", "30", "9")).toEqual({ rai: 1, ngan: 2, wa: 30.09, sqm: (400 + 200 + 30.09) * 4 });
  });
  it("empty parts -> zero", () => {
    expect(parseArea("0", "", "", "")).toEqual({ rai: 0, ngan: 0, wa: 0, sqm: 0 });
  });
  it("throws area_parse_failed on non-numeric", () => {
    try { parseArea("หนึ่ง", "0", "0", "0"); throw new Error("no throw"); }
    catch (e) { expect((e as NormalizeError).reason).toBe("area_parse_failed"); }
  });
});
