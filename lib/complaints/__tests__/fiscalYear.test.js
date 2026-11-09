import { describe, it, expect } from "vitest";
import {
  fiscalYearOf,
  currentFiscalYear,
  fiscalYearLabel,
  availableFiscalYears,
  splitByFiscalYear,
} from "../fiscalYear";

describe("fiscalYearOf", () => {
  it("ต.ค. ขึ้นปีงบใหม่", () => {
    expect(fiscalYearOf("2026-10-01T00:00:00+07:00")).toBe(2570);
    expect(fiscalYearOf("2026-09-30T23:59:59+07:00")).toBe(2569);
  });
  it("ใช้เวลากรุงเทพ ไม่ใช่ UTC (30 ก.ย. 17:00Z = 1 ต.ค. ไทย)", () => {
    expect(fiscalYearOf("2026-09-30T17:00:00Z")).toBe(2570);
    expect(fiscalYearOf("2026-09-30T16:59:59Z")).toBe(2569);
  });
  it("วันที่ใช้ไม่ได้ → null", () => {
    expect(fiscalYearOf(null)).toBeNull();
    expect(fiscalYearOf("")).toBeNull();
    expect(fiscalYearOf("not-a-date")).toBeNull();
  });
});

describe("currentFiscalYear / label / available", () => {
  it("ปีปัจจุบัน", () => {
    expect(currentFiscalYear(new Date("2026-11-09T05:00:00Z"))).toBe(2570);
  });
  it("label", () => {
    expect(fiscalYearLabel(2570)).toBe("1 ต.ค. 69 – 30 ก.ย. 70");
  });
  it("รวมปีปัจจุบันเสมอ เรียงใหม่→เก่า", () => {
    const years = availableFiscalYears(
      [{ createdAt: "2025-01-01T00:00:00Z" }, { createdAt: "2026-01-01T00:00:00Z" }, { createdAt: null }],
      new Date("2026-11-09T05:00:00Z")
    );
    expect(years).toEqual([2570, 2569, 2568]);
  });
});

describe("splitByFiscalYear", () => {
  const list = [
    { id: "a", createdAt: "2026-10-05T03:00:00Z", status: "อยู่ระหว่างดำเนินการ" }, // 2570
    { id: "b", createdAt: "2026-10-06T03:00:00Z", status: "ดำเนินการเสร็จสิ้น" }, // 2570
    { id: "c", createdAt: "2026-05-01T03:00:00Z", status: "อยู่ระหว่างดำเนินการ" }, // 2569 ค้าง
    { id: "d", createdAt: "2026-05-02T03:00:00Z", status: "ดำเนินการเสร็จสิ้น" }, // 2569 เสร็จ
    { id: "e", createdAt: "2025-03-01T03:00:00Z", status: "อยู่ระหว่างดำเนินการ" }, // 2568 ค้าง
    { id: "f", createdAt: null, status: "อยู่ระหว่างดำเนินการ" }, // ไม่มีวันที่
  ];
  it("ปี 2570: ในปี 2 เรื่อง, ค้างข้ามปี 2 เรื่อง แยกตามปี", () => {
    const r = splitByFiscalYear(list, 2570);
    expect(r.inYear.map((c) => c.id)).toEqual(["a", "b"]);
    expect(r.carryOver.map((c) => c.id)).toEqual(["c", "e"]);
    expect(r.carryOverByYear).toEqual({ 2569: 1, 2568: 1 });
  });
  it("ดูปีเก่า: เรื่องปีหลังไม่ถูกนับเป็นค้าง", () => {
    const r = splitByFiscalYear(list, 2569);
    expect(r.inYear.map((c) => c.id)).toEqual(["c", "d"]);
    expect(r.carryOver.map((c) => c.id)).toEqual(["e"]);
  });
  it('"all" = ทุกเรื่อง ไม่มีค้างข้ามปี', () => {
    const r = splitByFiscalYear(list, "all");
    expect(r.inYear).toHaveLength(6);
    expect(r.carryOver).toEqual([]);
  });
});
