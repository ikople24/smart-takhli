import { describe, it, expect } from "vitest";
import { zoneLabel, truckLabel } from "./labels";

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
