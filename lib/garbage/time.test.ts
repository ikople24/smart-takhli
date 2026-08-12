import { describe, it, expect } from "vitest";
import {
  parseThaiTime,
  formatThaiTime,
  formatRange,
  minutesNowInBangkok,
  weekdayOf,
  todayInBangkok,
} from "./time";

describe("parseThaiTime", () => {
  it("อ่านรูปแบบทางการพร้อม น. ได้", () => {
    expect(parseThaiTime("4:00 น.")).toBe(240);
    expect(parseThaiTime("9:20 น.")).toBe(560);
  });

  it("อ่านรูปแบบจุดแบบโปสเตอร์ได้", () => {
    expect(parseThaiTime("4.00น.")).toBe(240);
    expect(parseThaiTime("13.30น.")).toBe(810);
  });

  it("อ่านเลขนำหน้าศูนย์ได้", () => {
    expect(parseThaiTime("04:30 น.")).toBe(270);
    expect(parseThaiTime("03.40น.")).toBe(220);
  });

  it("ไม่แปลงเที่ยงวันเป็นเที่ยงคืน", () => {
    // บั๊กจริงของระบบเดิม: if (hour === '12') minutes = 0
    expect(parseThaiTime("12:00 น.")).toBe(720);
    expect(parseThaiTime("12.30น.")).toBe(750);
  });

  it("อ่านเวลาช่วงเย็นแบบ 24 ชั่วโมงได้", () => {
    expect(parseThaiTime("20.00น.")).toBe(1200);
    expect(parseThaiTime("23:59")).toBe(1439);
  });

  it("รับได้เมื่อไม่มี น.", () => {
    expect(parseThaiTime("6:15")).toBe(375);
  });

  it("ตัดช่องว่างส่วนเกิน", () => {
    expect(parseThaiTime("  7.05 น.  ")).toBe(425);
  });

  it("คืน null เมื่อ input ไม่ถูกต้อง", () => {
    expect(parseThaiTime("")).toBeNull();
    expect(parseThaiTime("ไม่ใช่เวลา")).toBeNull();
    expect(parseThaiTime("25:00")).toBeNull();
    expect(parseThaiTime("10:60")).toBeNull();
    expect(parseThaiTime("4")).toBeNull();
  });
});

describe("formatThaiTime", () => {
  it("จัดรูปแบบตามโปสเตอร์", () => {
    expect(formatThaiTime(240)).toBe("4.00 น.");
    expect(formatThaiTime(560)).toBe("9.20 น.");
  });

  it("ไม่เพี้ยนที่เที่ยงและเย็น", () => {
    expect(formatThaiTime(720)).toBe("12.00 น.");
    expect(formatThaiTime(810)).toBe("13.30 น.");
    expect(formatThaiTime(1200)).toBe("20.00 น.");
  });

  it("คืนค่าว่างเมื่อ input เป็น null", () => {
    expect(formatThaiTime(null)).toBe("");
  });

  it("คืนค่าว่างเมื่อ input นอกช่วง 0–1439 หรือไม่ใช่จำนวนเต็ม", () => {
    expect(formatThaiTime(-30)).toBe("");
    expect(formatThaiTime(1440)).toBe("");
    expect(formatThaiTime(7.5)).toBe("");
    expect(formatThaiTime(NaN)).toBe("");
  });

  it("ไป-กลับกับ parseThaiTime ได้ค่าเดิม", () => {
    for (const m of [0, 240, 560, 720, 810, 1200, 1439]) {
      expect(parseThaiTime(formatThaiTime(m))).toBe(m);
    }
  });
});

describe("formatRange", () => {
  it("แสดงช่วงเวลา", () => {
    expect(formatRange(240, 560)).toBe("4.00 – 9.20 น.");
  });

  it("คืนค่าว่างเมื่อฝั่งใดฝั่งหนึ่งไม่ถูกต้อง", () => {
    expect(formatRange(null, 560)).toBe("");
    expect(formatRange(240, null)).toBe("");
    expect(formatRange(NaN, 560)).toBe("");
    expect(formatRange(240, 1440)).toBe("");
  });
});

describe("weekdayOf", () => {
  it("คืนวันในสัปดาห์ตามเวลาไทย", () => {
    // 2026-08-12 คือวันพุธ
    expect(weekdayOf("2026-08-12")).toBe(3);
    // 2026-08-10 คือวันจันทร์
    expect(weekdayOf("2026-08-10")).toBe(1);
    // 2026-08-09 คือวันอาทิตย์ — ขอบเขตค่า 0
    expect(weekdayOf("2026-08-09")).toBe(0);
  });

  it("รับ Date object ได้", () => {
    // 2026-08-11 17:05 UTC = 2026-08-12 00:05 เวลาไทย → วันพุธ
    expect(weekdayOf(new Date("2026-08-11T17:05:00Z"))).toBe(3);
  });

  it("โยน error เมื่อรูปแบบวันที่ไม่ถูกต้อง", () => {
    expect(() => weekdayOf("ไม่ใช่วันที่")).toThrow("รูปแบบวันที่ไม่ถูกต้อง");
    expect(() => weekdayOf("2026-8-9")).toThrow("รูปแบบวันที่ไม่ถูกต้อง");
    expect(() => weekdayOf("2026-13-45")).toThrow("รูปแบบวันที่ไม่ถูกต้อง");
    expect(() => weekdayOf(new Date("invalid"))).toThrow("รูปแบบวันที่ไม่ถูกต้อง");
  });
});

describe("todayInBangkok", () => {
  it("คืนรูปแบบ YYYY-MM-DD", () => {
    expect(todayInBangkok()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("minutesNowInBangkok", () => {
  it("คืนค่าอยู่ในช่วง 0–1439", () => {
    const m = minutesNowInBangkok();
    expect(m).toBeGreaterThanOrEqual(0);
    expect(m).toBeLessThanOrEqual(1439);
  });

  it("คำนวณตามเวลาไทยจาก now ที่กำหนด", () => {
    // 17:05 UTC = 00:05 เวลาไทย — ทดสอบขอบเที่ยงคืน (กันเคส hour คืน 24)
    expect(minutesNowInBangkok(new Date("2026-08-11T17:05:00Z"))).toBe(5);
    // 02:30 UTC = 09:30 เวลาไทย
    expect(minutesNowInBangkok(new Date("2026-08-12T02:30:00Z"))).toBe(570);
  });
});
