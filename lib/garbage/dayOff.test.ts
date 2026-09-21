import { describe, it, expect } from "vitest";
import type { ResolvedAssignment } from "@/types/garbage";
import { summarizeDayOff } from "./dayOff";

function a(truckNumber: number, kind: ResolvedAssignment["kind"]): ResolvedAssignment {
  return {
    id: "x", updatedAt: "", truckNumber, truckColor: "green", shiftNo: 1, kind,
    routeCode: null, routeName: null, routeNeedsVerification: false, coverForRouteCode: null,
    startMin: null, endMin: null, label: null, stops: [], communityWindows: [],
  };
}

describe("summarizeDayOff", () => {
  it("แยกคันที่วิ่งกับคันที่หยุด เรียงเลขรถ", () => {
    const s = summarizeDayOff([a(7, "normal"), a(1, "day_off"), a(2, "day_off"), a(5, "normal")]);
    expect(s.workingNumbers).toEqual([5, 7]);
    expect(s.dayOffNumbers).toEqual([1, 2]);
  });

  it("นับเป็นคัน ไม่ใช่รอบ — รถคันเดียวมีหลายรอบต้องไม่ขึ้นชื่อซ้ำ", () => {
    const s = summarizeDayOff([a(1, "normal"), a(1, "normal"), a(1, "special")]);
    expect(s.workingNumbers).toEqual([1]);
  });

  it("คันที่มีทั้งงานหยุดและงานวิ่งวันเดียวกัน ไม่ถือว่าหยุด (ไม่งั้นชื่อรถขึ้นสองฝั่ง)", () => {
    const s = summarizeDayOff([a(6, "day_off"), a(6, "substitute")]);
    expect(s.workingNumbers).toEqual([6]);
    expect(s.dayOffNumbers).toEqual([]);
  });

  it("วันที่ไม่มีตารางเลย = ว่างทั้งสองฝั่ง", () => {
    expect(summarizeDayOff([])).toEqual({ workingNumbers: [], dayOffNumbers: [] });
  });
});
