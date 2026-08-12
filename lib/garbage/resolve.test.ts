import { describe, it, expect, vi } from "vitest";
import { buildDaySchedule, pickLatestVersions } from "./resolve";
import type { Assignment, Route, Truck } from "@/types/garbage";

const trucks: Truck[] = [
  { number: 1, color: "yellow", status: "active" },
  { number: 5, color: "green", status: "active" },
];

const routes: Route[] = [
  {
    code: "R1", name: "สาย R1", defaultTruckNumber: 1, active: true,
    communityNames: ["ชุมชนเขาใบไม้"],
    stops: [
      { seq: 1, name: "ซ.ตรอกใต้แนว", mode: "truck" },
      { seq: 2, name: "ซ.เขาเงาะ 5", mode: "truck" },
    ],
  },
];

const base = {
  effectiveFrom: new Date("2026-01-01"), effectiveTo: null,
  coverForRouteCode: null, label: null, communityWindows: [],
};

describe("buildDaySchedule", () => {
  it("join สาย รถ และเวลาจุดเก็บเข้าด้วยกัน", () => {
    const a: Assignment[] = [{
      ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal",
      startMin: 240, endMin: 560,
      stopTimes: [{ seq: 1, atMin: 240 }, { seq: 2, atMin: 255 }],
    }];
    const out = buildDaySchedule("2026-08-10", 1, a, routes, trucks);
    expect(out.assignments).toHaveLength(1);
    expect(out.assignments[0].truckColor).toBe("yellow");
    expect(out.assignments[0].routeName).toBe("สาย R1");
    expect(out.assignments[0].stops[1]).toMatchObject({ name: "ซ.เขาเงาะ 5", atMin: 255 });
  });

  it("จัดการวันหยุดที่ไม่มีสาย", () => {
    const a: Assignment[] = [{
      ...base, weekday: 2, shiftNo: 1, truckNumber: 1, routeCode: null, kind: "day_off",
      startMin: null, endMin: null, stopTimes: [], label: "วันหยุด",
    }];
    const out = buildDaySchedule("2026-08-11", 2, a, routes, trucks);
    expect(out.assignments[0].kind).toBe("day_off");
    expect(out.assignments[0].stops).toEqual([]);
    expect(out.assignments[0].routeName).toBeNull();
  });

  it("แสดงว่ารถคันไหนแทนเบอร์สายอะไร", () => {
    const a: Assignment[] = [{
      ...base, weekday: 2, shiftNo: 1, truckNumber: 5, routeCode: "R1", kind: "substitute",
      coverForRouteCode: "R1", startMin: 240, endMin: 310, stopTimes: [],
      label: "เก็บแทนเบอร์ 1",
    }];
    const out = buildDaySchedule("2026-08-11", 2, a, routes, trucks);
    expect(out.assignments[0]).toMatchObject({
      truckNumber: 5, kind: "substitute", coverForRouteCode: "R1", label: "เก็บแทนเบอร์ 1",
    });
  });

  it("จุดที่ไม่มีเวลากำหนด ได้ atMin เป็น null ไม่ใช่พัง", () => {
    const a: Assignment[] = [{
      ...base, weekday: 2, shiftNo: 2, truckNumber: 5, routeCode: "R1", kind: "normal",
      startMin: 310, endMin: 810, stopTimes: [],
    }];
    const out = buildDaySchedule("2026-08-11", 2, a, routes, trucks);
    expect(out.assignments[0].stops.every((s) => s.atMin === null)).toBe(true);
  });

  it("เรียงตามเวลาเริ่ม แล้วตามเบอร์รถ", () => {
    const a: Assignment[] = [
      { ...base, weekday: 1, shiftNo: 1, truckNumber: 5, routeCode: "R1", kind: "normal", startMin: 300, endMin: 500, stopTimes: [] },
      { ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 500, stopTimes: [] },
    ];
    const out = buildDaySchedule("2026-08-10", 1, a, routes, trucks);
    expect(out.assignments.map((x) => x.truckNumber)).toEqual([1, 5]);
  });

  it("วันหยุดถูกจัดไว้ท้ายสุด", () => {
    const a: Assignment[] = [
      { ...base, weekday: 2, shiftNo: 1, truckNumber: 1, routeCode: null, kind: "day_off", startMin: null, endMin: null, stopTimes: [] },
      { ...base, weekday: 2, shiftNo: 1, truckNumber: 5, routeCode: "R1", kind: "normal", startMin: 240, endMin: 500, stopTimes: [] },
    ];
    const out = buildDaySchedule("2026-08-11", 2, a, routes, trucks);
    expect(out.assignments.map((x) => x.truckNumber)).toEqual([5, 1]);
  });

  it("เวลาเริ่มเท่ากัน → เรียงตามเบอร์รถ แล้วตามรอบ", () => {
    const a: Assignment[] = [
      { ...base, weekday: 1, shiftNo: 2, truckNumber: 5, routeCode: "R1", kind: "normal", startMin: 240, endMin: 500, stopTimes: [] },
      { ...base, weekday: 1, shiftNo: 1, truckNumber: 5, routeCode: "R1", kind: "normal", startMin: 240, endMin: 500, stopTimes: [] },
      { ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 500, stopTimes: [] },
    ];
    const out = buildDaySchedule("2026-08-10", 1, a, routes, trucks);
    expect(out.assignments.map((x) => [x.truckNumber, x.shiftNo])).toEqual([
      [1, 1],
      [5, 1],
      [5, 2],
    ]);
  });

  it("การแทนเบอร์ที่มี routeCode + stopTimes ได้จุดเก็บ join จากสายตามปกติ", () => {
    const a: Assignment[] = [{
      ...base, weekday: 2, shiftNo: 1, truckNumber: 5, routeCode: "R1", kind: "substitute",
      coverForRouteCode: "R1", startMin: 240, endMin: 310,
      stopTimes: [{ seq: 1, atMin: 240 }],
      label: "เก็บแทนเบอร์ 1",
    }];
    const out = buildDaySchedule("2026-08-11", 2, a, routes, trucks);
    expect(out.assignments[0].stops).toEqual([
      { seq: 1, name: "ซ.ตรอกใต้แนว", mode: "truck", atMin: 240 },
      { seq: 2, name: "ซ.เขาเงาะ 5", mode: "truck", atMin: null },
    ]);
  });

  it("routeCode ที่ไม่รู้จัก → routeName null + stops [] และรถที่ไม่รู้จัก → สีเขียว", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const a: Assignment[] = [{
        ...base, weekday: 1, shiftNo: 1, truckNumber: 99, routeCode: "R99", kind: "normal",
        startMin: 240, endMin: 500, stopTimes: [],
      }];
      const out = buildDaySchedule("2026-08-10", 1, a, routes, trucks);
      expect(out.assignments[0].routeName).toBeNull();
      expect(out.assignments[0].stops).toEqual([]);
      expect(out.assignments[0].truckColor).toBe("green");
    } finally {
      warn.mockRestore();
    }
  });
});

describe("pickLatestVersions", () => {
  it("เลือกเวอร์ชันที่ effectiveFrom ใหม่สุดของแต่ละ (รถ, รอบ)", () => {
    const a: Assignment[] = [
      { ...base, effectiveFrom: new Date("2026-01-01"), weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 500, stopTimes: [] },
      { ...base, effectiveFrom: new Date("2026-07-01"), weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 300, endMin: 560, stopTimes: [] },
    ];
    const out = pickLatestVersions(a);
    expect(out).toHaveLength(1);
    expect(out[0].startMin).toBe(300);
  });

  it("(รถ, รอบ) ต่างกันรอดทั้งคู่", () => {
    const a: Assignment[] = [
      { ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 500, stopTimes: [] },
      { ...base, weekday: 1, shiftNo: 2, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 600, endMin: 700, stopTimes: [] },
      { ...base, weekday: 1, shiftNo: 1, truckNumber: 5, routeCode: "R1", kind: "normal", startMin: 240, endMin: 500, stopTimes: [] },
    ];
    expect(pickLatestVersions(a)).toHaveLength(3);
  });

  it("effectiveFrom เท่ากัน → ตัวแรกในลิสต์ชนะ", () => {
    const a: Assignment[] = [
      { ...base, effectiveFrom: new Date("2026-07-01"), weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 500, stopTimes: [], label: "ตัวแรก" },
      { ...base, effectiveFrom: new Date("2026-07-01"), weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 300, endMin: 560, stopTimes: [], label: "ตัวหลัง" },
    ];
    const out = pickLatestVersions(a);
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("ตัวแรก");
  });

  it("weekday ต่างกันของรถ/รอบเดียวกัน ไม่ถูกยุบรวม (เผื่อ view รายสัปดาห์)", () => {
    const a: Assignment[] = [
      { ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 500, stopTimes: [] },
      { ...base, weekday: 2, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 500, stopTimes: [] },
    ];
    expect(pickLatestVersions(a)).toHaveLength(2);
  });
});
