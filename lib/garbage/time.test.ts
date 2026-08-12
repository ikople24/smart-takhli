import { describe, it, expect } from "vitest";
import { parseThaiTime } from "./time";

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
