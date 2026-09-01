// เทสต์ตัวช่วยวันที่ของโมดูลงานเจ้าหน้าที่ — เซิร์ฟเวอร์ (Railway) รัน UTC
// ทุกอย่างต้องนับตาม Asia/Bangkok — รันเทสต์ด้วย TZ=UTC เสมอ (vitest ตั้งใน test เอง)
import { describe, it, expect, beforeAll } from "vitest";
import {
  toDate,
  bangkokDateKey,
  bangkokMonthKey,
  calendarDaysBetween,
  daysBetween,
  formatThaiShortDate,
  formatThaiDate,
  relativeDaysLabel,
  summarizeText,
  initials,
} from "../format";

beforeAll(() => {
  process.env.TZ = "UTC";
});

describe("toDate — รับ Date / ISO string / timestamp, ค่าเพี้ยนเป็น null", () => {
  it("แปลงได้ทั้ง 3 แบบ และคืน null เมื่อไม่ใช่วันที่", () => {
    expect(toDate("2026-08-12T10:00:00Z")?.toISOString()).toBe("2026-08-12T10:00:00.000Z");
    expect(toDate(new Date("2026-08-12T10:00:00Z"))?.toISOString()).toBe("2026-08-12T10:00:00.000Z");
    expect(toDate(Date.UTC(2026, 7, 12))?.toISOString()).toBe("2026-08-12T00:00:00.000Z");
    expect(toDate("ไม่ใช่วันที่")).toBeNull();
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
  });
});

describe("bangkokDateKey / bangkokMonthKey — ข้ามเที่ยงคืนตามเวลาไทย ไม่ใช่ UTC", () => {
  it("17:30Z = 00:30 วันถัดไปที่กรุงเทพ", () => {
    expect(bangkokDateKey("2026-08-12T17:30:00Z")).toBe("2026-08-13");
    expect(bangkokDateKey("2026-08-12T16:59:00Z")).toBe("2026-08-12");
  });
  it("สิ้นเดือน 31 ส.ค. 17:00Z = 1 ก.ย. ที่กรุงเทพ", () => {
    expect(bangkokMonthKey("2026-08-31T17:00:00Z")).toBe("2026-09");
    expect(bangkokMonthKey("2026-08-31T16:59:59Z")).toBe("2026-08");
  });
  it("ค่าเพี้ยน → null", () => {
    expect(bangkokDateKey("x")).toBeNull();
    expect(bangkokMonthKey(null)).toBeNull();
  });
});

describe("calendarDaysBetween — นับวันตามปฏิทินไทย (ใช้กับ 'ค้าง N วัน' / 'ครบกำหนดใน N วัน')", () => {
  it("23:00 ไทย → 01:00 ไทยวันถัดไป = 1 วัน แม้ห่างกันแค่ 2 ชม.", () => {
    expect(calendarDaysBetween("2026-08-12T16:00:00Z", "2026-08-12T18:00:00Z")).toBe(1);
  });
  it("วันเดียวกัน = 0, ย้อนหลังติดลบ", () => {
    expect(calendarDaysBetween("2026-08-12T01:00:00Z", "2026-08-12T09:00:00Z")).toBe(0);
    expect(calendarDaysBetween("2026-08-15T01:00:00Z", "2026-08-12T09:00:00Z")).toBe(-3);
  });
  it("ค่าเพี้ยน → null", () => {
    expect(calendarDaysBetween("x", "2026-08-12T09:00:00Z")).toBeNull();
  });
});

describe("daysBetween — จำนวนวันเต็ม (floor ของ ms) แบบเดียวกับ resolutionDays เดิม", () => {
  it("47 ชม. = 1 วัน, 48 ชม. = 2 วัน", () => {
    expect(daysBetween("2026-08-10T00:00:00Z", "2026-08-11T23:00:00Z")).toBe(1);
    expect(daysBetween("2026-08-10T00:00:00Z", "2026-08-12T00:00:00Z")).toBe(2);
  });
  it("ค่าเพี้ยน → null", () => {
    expect(daysBetween(null, "2026-08-12T00:00:00Z")).toBeNull();
  });
});

describe("formatThaiShortDate / formatThaiDate — วันที่แบบไทย", () => {
  it("แบบสั้นไม่มีปี, แบบยาวมีปี พ.ศ.", () => {
    expect(formatThaiShortDate("2026-08-12T17:30:00Z")).toBe("13 ส.ค.");
    expect(formatThaiDate("2026-08-12T17:30:00Z")).toBe("13 ส.ค. 2569");
  });
  it("ครบ 12 เดือน", () => {
    const months = Array.from({ length: 12 }, (_, m) =>
      formatThaiShortDate(new Date(Date.UTC(2026, m, 5, 6)))
    );
    expect(months).toEqual([
      "5 ม.ค.", "5 ก.พ.", "5 มี.ค.", "5 เม.ย.", "5 พ.ค.", "5 มิ.ย.",
      "5 ก.ค.", "5 ส.ค.", "5 ก.ย.", "5 ต.ค.", "5 พ.ย.", "5 ธ.ค.",
    ]);
  });
  it("ค่าเพี้ยน → สตริงว่าง (UI ไม่พัง)", () => {
    expect(formatThaiShortDate("x")).toBe("");
    expect(formatThaiDate(undefined)).toBe("");
  });
});

describe("relativeDaysLabel — 'อัปเดตล่าสุด N วันที่แล้ว'", () => {
  it("0 → วันนี้, 1 → เมื่อวาน, n → n วันที่แล้ว, ค่าเพี้ยน/ติดลบ → '-' หรือวันนี้", () => {
    expect(relativeDaysLabel(0)).toBe("วันนี้");
    expect(relativeDaysLabel(1)).toBe("เมื่อวาน");
    expect(relativeDaysLabel(6)).toBe("6 วันที่แล้ว");
    expect(relativeDaysLabel(-2)).toBe("วันนี้");
    expect(relativeDaysLabel(null)).toBe("-");
  });
});

describe("summarizeText — หัวเรื่องจากรายละเอียดที่ประชาชนพิมพ์", () => {
  it("ใช้บรรทัดแรก ตัดช่องว่าง และตัดที่ความยาวสูงสุดพร้อม …", () => {
    expect(summarizeText("  โคมไฟดับหน้าตลาดสด 3 จุด\nรบกวนช่วยด้วยครับ  ")).toBe("โคมไฟดับหน้าตลาดสด 3 จุด");
    expect(summarizeText("ก".repeat(100), 90)).toBe("ก".repeat(90) + "…");
    expect(summarizeText("สั้น", 90)).toBe("สั้น");
  });
  it("ว่าง/ไม่ใช่ข้อความ → สตริงว่าง", () => {
    expect(summarizeText("")).toBe("");
    expect(summarizeText(null)).toBe("");
    expect(summarizeText("\n\n")).toBe("");
  });
});

describe("initials — อักษรย่อบน avatar ของเจ้าหน้าที่", () => {
  it("ตัวแรกของชื่อ + ตัวแรกของนามสกุล ข้ามคำนำหน้าและสระนำ", () => {
    expect(initials("สมชาย ใจดี")).toBe("สจ");
    expect(initials("นางสาว กมลวรรณ เสือใจดี")).toBe("กส");
    expect(initials("นายเอกชัย แสงทอง")).toBe("อส");
    expect(initials("Somchai jaidee")).toBe("SJ");
  });
  it("ชื่อเดียว → 1 ตัว; ว่าง → '?'", () => {
    expect(initials("สมชาย")).toBe("ส");
    expect(initials("")).toBe("?");
    expect(initials(null)).toBe("?");
  });
});
