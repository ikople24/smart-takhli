import { describe, it, expect } from "vitest";
import { findNextPickup } from "./nextPickup";

// จุดนี้เก็บวันจันทร์ 4.00, วันพุธ 5.00, วันเสาร์ 6.00
const slots = [
  { weekday: 1, atMin: 240 },
  { weekday: 3, atMin: 300 },
  { weekday: 6, atMin: 360 },
];

describe("findNextPickup", () => {
  it("วันนี้ยังมาไม่ถึง = รอบนี้แหละ", () => {
    expect(findNextPickup(slots, 1, 200)).toEqual({ weekday: 1, atMin: 240, daysAhead: 0 });
  });

  it("วันนี้ผ่านไปแล้ว = ข้ามไปวันถัดไปที่เก็บ", () => {
    expect(findNextPickup(slots, 1, 300)).toEqual({ weekday: 3, atMin: 300, daysAhead: 2 });
  });

  it("วันที่ไม่เก็บ = บอกวันถัดไปที่เก็บ", () => {
    expect(findNextPickup(slots, 2, 600)).toEqual({ weekday: 3, atMin: 300, daysAhead: 1 });
  });

  it("วนข้ามสัปดาห์ได้", () => {
    expect(findNextPickup(slots, 0, 600)).toEqual({ weekday: 1, atMin: 240, daysAhead: 1 });
    expect(findNextPickup(slots, 6, 400)).toEqual({ weekday: 1, atMin: 240, daysAhead: 2 });
  });

  it("จุดที่ยังไม่ระบุเวลา ถือว่ายังมาได้วันนี้", () => {
    expect(findNextPickup([{ weekday: 2, atMin: null }], 2, 900))
      .toEqual({ weekday: 2, atMin: null, daysAhead: 0 });
  });

  it("ไม่เคยเก็บเลย = null", () => {
    expect(findNextPickup([], 1, 240)).toBeNull();
  });

  it("เก็บวันเดียว วนกลับมาครบสัปดาห์", () => {
    expect(findNextPickup([{ weekday: 1, atMin: 240 }], 1, 300))
      .toEqual({ weekday: 1, atMin: 240, daysAhead: 7 });
  });
});
