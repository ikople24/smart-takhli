import { describe, expect, it } from "vitest";
import { buildDayChips, pickDefaultWeekday } from "./searchDays";

// hits ของจริงมีฟิลด์เยอะ แต่สองฟังก์ชันนี้ใช้แค่ weekday/atMin
const hit = (weekday: number, atMin: number | null = 600) => ({ weekday, atMin });

describe("buildDayChips", () => {
  it("คืน 7 วันเสมอ เรียงจันทร์→อาทิตย์ (ไม่ใช่ 0=อาทิตย์ ตาม index ดิบ)", () => {
    const chips = buildDayChips([hit(1)]);
    expect(chips).toHaveLength(7);
    expect(chips.map((c) => c.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(chips.map((c) => c.shortName)).toEqual(["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"]);
  });

  it("นับจำนวนจุดของแต่ละวัน · วันที่ไม่มีเก็บได้ 0", () => {
    const chips = buildDayChips([hit(1), hit(1), hit(3)]);
    const byWeekday = new Map(chips.map((c) => [c.weekday, c.count]));
    expect(byWeekday.get(1)).toBe(2);
    expect(byWeekday.get(3)).toBe(1);
    expect(byWeekday.get(5)).toBe(0);
  });

  it("ไม่มีผลเลย → ทุกวันเป็น 0 (ยังคืนครบ 7 วัน ให้แถบชิปไม่กระตุก)", () => {
    expect(buildDayChips([]).every((c) => c.count === 0)).toBe(true);
  });
});

describe("pickDefaultWeekday", () => {
  it("วันนี้ยังมีรอบที่ยังไม่ถึง → เปิดวันนี้", () => {
    // วันพุธ (3) เวลา 8:00 (480) · รอบ 9:00 ของวันพุธยังไม่ถึง
    expect(pickDefaultWeekday([hit(3, 540), hit(5, 360)], 3, 480)).toBe(3);
  });

  it("รอบของวันนี้ผ่านไปหมดแล้ว → ข้ามไปวันถัดไปที่มีเก็บ", () => {
    // วันพุธ 10:00 (600) · รอบพุธ 6:00 ผ่านแล้ว → ต้องได้ศุกร์ (5)
    expect(pickDefaultWeekday([hit(3, 360), hit(5, 360)], 3, 600)).toBe(5);
  });

  it("จุดที่ยังไม่ระบุเวลาถือว่ายังมาได้ → ยังเปิดวันนี้", () => {
    expect(pickDefaultWeekday([hit(3, null)], 3, 1400)).toBe(3);
  });

  it("ไม่มีผลเลย → null (ผู้เรียกไม่ต้องเลือกวันไหน)", () => {
    expect(pickDefaultWeekday([], 3, 480)).toBeNull();
  });

  it("เก็บสัปดาห์ละครั้งและรอบวันนี้ผ่านแล้ว → วนกลับมาวันเดิม", () => {
    expect(pickDefaultWeekday([hit(3, 360)], 3, 600)).toBe(3);
  });
});
