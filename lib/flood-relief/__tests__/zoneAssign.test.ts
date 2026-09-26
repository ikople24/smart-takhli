import { describe, it, expect } from "vitest";
import { planZoneUpdates } from "../zoneAssign";

const A = { id: "zA", name: "A", level: "critical" };
const B = { id: "zB", name: "B", level: "watch" };

describe("planZoneUpdates", () => {
  it("จุดตกหลายโซน = ระดับสูงสุด · ไม่ตกโซนไหน = ล้างโซน · ค่าเดิม = ไม่เขียน", () => {
    const reqs = [
      { id: "r1", zoneId: null, zoneName: null, zoneLevel: null },
      { id: "r2", zoneId: "zA", zoneName: "A", zoneLevel: "critical" },
      { id: "r3", zoneId: "zB", zoneName: "B", zoneLevel: "watch" },
    ];
    const hits = new Map([
      ["r1", [B, A]],
      ["r2", [A]],
    ]);
    expect(planZoneUpdates(reqs, hits)).toEqual([
      { id: "r1", zoneId: "zA", zoneName: "A", zoneLevel: "critical" },
      { id: "r3", zoneId: null, zoneName: null, zoneLevel: null },
    ]);
  });

  it("เปลี่ยนระดับ/ชื่อโซนเดิม = อัปเดต snapshot", () => {
    const reqs = [{ id: "r1", zoneId: "zA", zoneName: "A", zoneLevel: "danger" }];
    expect(planZoneUpdates(reqs, new Map([["r1", [A]]]))).toEqual([
      { id: "r1", zoneId: "zA", zoneName: "A", zoneLevel: "critical" },
    ]);
  });
});
