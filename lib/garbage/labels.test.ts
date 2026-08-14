import { describe, it, expect } from "vitest";
import { zoneLabel, truckLabel, zoneOrder, weekdayShort } from "./labels";

describe("zoneLabel", () => {
  it("รหัสสายของโซน 1–7 แปลงเป็นคำที่กองสาธารณสุขใช้เรียก", () => {
    expect(zoneLabel("R1")).toBe("โซน 1");
    expect(zoneLabel("R7")).toBe("โซน 7");
  });

  it("R13 ไม่ใช่โซน (รถยกภาชนะรองรับ) — คืนค่าเดิมให้ผู้เรียกไปใช้ชื่อสายแทน", () => {
    expect(zoneLabel("R13")).toBe("R13");
  });

  it("ไม่มีรหัส = ค่าว่าง ผู้เรียกจะได้ซ่อนป้ายได้เลย", () => {
    expect(zoneLabel(null)).toBe("");
    expect(zoneLabel(undefined)).toBe("");
    expect(zoneLabel("")).toBe("");
  });

  it("รหัสที่ไม่เข้ารูปแบบ คืนค่าเดิมโดยไม่ดัดแปลง", () => {
    expect(zoneLabel("XYZ")).toBe("XYZ");
    expect(zoneLabel("R0")).toBe("R0");
    expect(zoneLabel("R8")).toBe("R8");
  });
});

describe("weekdayShort", () => {
  it("ครบ 7 วันเรียงอาทิตย์→เสาร์ ตรงกับ Date.getDay()", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(weekdayShort)).toEqual(["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]);
  });

  it("พุธกับพฤหัสต้องไม่ซ้ำกัน ไม่งั้นแถบ 7 วันอ่านไม่ออก", () => {
    expect(weekdayShort(3)).not.toBe(weekdayShort(4));
  });

  it("เลขวันนอกช่วงคืนค่าว่าง", () => {
    expect(weekdayShort(7)).toBe("");
    expect(weekdayShort(-1)).toBe("");
  });
});

describe("zoneOrder", () => {
  it("เรียงรหัสสายได้เป็นโซน 1 → 7 ไม่ใช่เรียงตามตัวอักษร (R1, R13, R2, ...)", () => {
    const codes = ["R5", "R13", "R1", "R7", "R2"];
    const sorted = [...codes].sort((a, b) => zoneOrder(a) - zoneOrder(b));
    expect(sorted).toEqual(["R1", "R2", "R5", "R7", "R13"]);
  });

  it("สายที่ไม่ใช่โซนอยู่หลังโซนทั้งหมด", () => {
    expect(zoneOrder("R13")).toBeGreaterThan(zoneOrder("R7"));
  });

  it("งานที่ไม่ผูกสาย (วันหยุด) ไปท้ายสุด", () => {
    expect(zoneOrder(null)).toBeGreaterThan(zoneOrder("R13"));
    expect(zoneOrder(undefined)).toBeGreaterThan(zoneOrder("R13"));
    expect(zoneOrder("")).toBeGreaterThan(zoneOrder("R13"));
  });

  it("รหัสรูปแบบอื่นเรียงไว้ก่อน 'ไม่มีสาย' และไม่ทำให้ลำดับพัง", () => {
    expect(zoneOrder("XYZ")).toBeGreaterThan(zoneOrder("R13"));
    expect(zoneOrder("XYZ")).toBeLessThan(zoneOrder(null));
  });
});

describe("truckLabel", () => {
  it("เลขรถแปลงเป็น 'รถเบอร์ N'", () => {
    expect(truckLabel(1)).toBe("รถเบอร์ 1");
    expect(truckLabel(13)).toBe("รถเบอร์ 13");
  });

  it("ไม่มีเลขรถ = ค่าว่าง", () => {
    expect(truckLabel(null)).toBe("");
    expect(truckLabel(undefined)).toBe("");
  });
});
