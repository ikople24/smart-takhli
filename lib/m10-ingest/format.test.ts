import { describe, it, expect } from "vitest";
import { formatRaiNganWa, formatSqm } from "./format";

describe("formatRaiNganWa", () => {
  it("รูปแบบไร่-งาน-วา ตามธรรมเนียมโฉนด", () => {
    expect(formatRaiNganWa({ rai: 0, ngan: 2, wa: 24, sqm: 896 })).toBe("0-2-24");
    expect(formatRaiNganWa({ rai: 12, ngan: 3, wa: 50.5, sqm: 0 })).toBe("12-3-50.5");
  });

  it("ตัดศูนย์ท้ายทศนิยมของตารางวา", () => {
    expect(formatRaiNganWa({ rai: 1, ngan: 0, wa: 24.0 })).toBe("1-0-24");
  });

  it("ไม่มีข้อมูลเนื้อที่ → ขีด (สิ่งปลูกสร้างไม่มีไร่-งาน-วา)", () => {
    expect(formatRaiNganWa(null)).toBe("-");
    expect(formatRaiNganWa(undefined)).toBe("-");
    expect(formatRaiNganWa({})).toBe("-");
  });

  it("ค่าที่ขาดบางช่องนับเป็น 0 ไม่ใช่ทิ้งทั้งแถว", () => {
    expect(formatRaiNganWa({ ngan: 2 })).toBe("0-2-0");
  });
});

describe("formatSqm", () => {
  it("แสดงตารางเมตรของสิ่งปลูกสร้าง", () => {
    expect(formatSqm("197.82")).toBe("197.82 ตร.ม.");
    expect(formatSqm(80)).toBe("80 ตร.ม.");
    expect(formatSqm("80.00")).toBe("80 ตร.ม.");
  });

  it("ค่าว่าง/ไม่ใช่ตัวเลข → ขีด", () => {
    expect(formatSqm("")).toBe("-");
    expect(formatSqm(null)).toBe("-");
    expect(formatSqm("ไม่ระบุ")).toBe("-");
  });
});
