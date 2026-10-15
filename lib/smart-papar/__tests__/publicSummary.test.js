import { describe, it, expect } from "vitest";
import {
  WATER_STANDARDS,
  ntuWithin,
  phWithin,
  tdsWithin,
  dailyRow,
  flushingDaily,
} from "../publicSummary";

describe("เกณฑ์มาตรฐาน", () => {
  it("ค่าตามที่เจ้าของยืนยัน", () => {
    expect(WATER_STANDARDS).toEqual({ ntuMax: 5, phMin: 6.5, phMax: 8.5, tdsMax: 600 });
  });

  it("NTU ≤ 5 อยู่ในเกณฑ์ · ไม่มีค่า = null", () => {
    expect(ntuWithin(1.58)).toBe(true);
    expect(ntuWithin(5)).toBe(true);
    expect(ntuWithin(5.01)).toBe(false);
    expect(ntuWithin(null)).toBeNull();
    expect(ntuWithin("")).toBeNull();
  });

  it("pH 6.5–8.5 รวมขอบ", () => {
    expect(phWithin(8.13)).toBe(true);
    expect(phWithin(6.5)).toBe(true);
    expect(phWithin(8.5)).toBe(true);
    expect(phWithin(8.51)).toBe(false);
    expect(phWithin(6.4)).toBe(false);
    expect(phWithin(undefined)).toBeNull();
  });

  it("TDS ≤ 600", () => {
    expect(tdsWithin(141)).toBe(true);
    expect(tdsWithin(600)).toBe(true);
    expect(tdsWithin(601)).toBe(false);
    expect(tdsWithin(null)).toBeNull();
  });
});

describe("dailyRow", () => {
  it("ทุกค่าที่มีอยู่ในเกณฑ์ → ปกติ", () => {
    expect(dailyRow({ recordDate: "2026-10-15", tap: { turbidityNtu: 1.58, ph: 8.13, tdsMgL: 141 } })).toEqual({
      recordDate: "2026-10-15",
      ntu: 1.58,
      ph: 8.13,
      tds: 141,
      status: "ok",
    });
  });

  it("มีค่าเกินเกณฑ์อย่างน้อย 1 ค่า → over", () => {
    expect(dailyRow({ recordDate: "d", tap: { turbidityNtu: 6, ph: 7, tdsMgL: 100 } }).status).toBe("over");
    expect(dailyRow({ recordDate: "d", tap: { turbidityNtu: 1, ph: 9, tdsMgL: null } }).status).toBe("over");
  });

  it("ค่าที่ไม่มีไม่นับ · ไม่มีเลย → none", () => {
    expect(dailyRow({ recordDate: "d", tap: { turbidityNtu: 2, ph: null } }).status).toBe("ok");
    expect(dailyRow({ recordDate: "d", tap: {} }).status).toBe("none");
    expect(dailyRow({ recordDate: "d" }).status).toBe("none");
  });
});

describe("flushingDaily", () => {
  it("รวมรายวันตามวันไทย ใหม่สุดก่อน + % ใสแล้ว (ปัดจำนวนเต็ม)", () => {
    const out = flushingDaily([
      { date: "2026-10-13", total: 26, clear: 25 },
      { date: "2026-10-14", total: 3, clear: 2 },
      { date: "2026-10-12", total: 30, clear: 23 },
    ]);
    expect(out).toEqual([
      { date: "2026-10-14", total: 3, clear: 2, clearPct: 67 },
      { date: "2026-10-13", total: 26, clear: 25, clearPct: 96 },
      { date: "2026-10-12", total: 30, clear: 23, clearPct: 77 },
    ]);
  });

  it("วันที่ไม่มีงาน (total 0) ไม่นับ · ว่าง → []", () => {
    expect(flushingDaily([{ date: "2026-10-14", total: 0, clear: 0 }])).toEqual([]);
    expect(flushingDaily(null)).toEqual([]);
  });
});
