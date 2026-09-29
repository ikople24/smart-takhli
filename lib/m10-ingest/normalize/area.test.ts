import { describe, it, expect } from "vitest";
import { parseArea } from "./area";
import { NormalizeError } from "../types";

describe("parseArea", () => {
  it("row0 of real data: 0 ไร่ 2 งาน 24 วา 0 เศษ = 896 sqm", () => {
    expect(parseArea("0", "2", "24", "0")).toEqual({ rai: 0, ngan: 2, wa: 24, sqm: 896 });
  });
  it("เศษ = ส่วนสิบของ ตร.ว. (เช่น เศษ 9 → .9); ยืนยันกับข้อมูลโฉนดจริง", () => {
    // โฉนดเลขที่ 81145 เลขที่ดิน 1100 ระวาง 5039 II 4684-00 (4000): WA=53 SUBWA=6
    // เว็บกรมที่ดินแสดงเนื้อที่จริง = 0-0-53.6 ตร.ว. (ยืนยัน 2026-09-29, ไม่ใช่ 53.06)
    expect(parseArea("0", "0", "53", "6")).toEqual({ rai: 0, ngan: 0, wa: 53.6, sqm: 214.4 });
  });
  it("empty parts -> zero", () => {
    expect(parseArea("0", "", "", "")).toEqual({ rai: 0, ngan: 0, wa: 0, sqm: 0 });
  });
  it("throws area_parse_failed on non-numeric", () => {
    try { parseArea("หนึ่ง", "0", "0", "0"); throw new Error("no throw"); }
    catch (e) { expect((e as NormalizeError).reason).toBe("area_parse_failed"); }
  });
});
