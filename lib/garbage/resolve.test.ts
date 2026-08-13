import { describe, it, expect, vi } from "vitest";
import { buildDaySchedule, buildWeekSchedule, pickLatestVersions } from "./resolve";
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
      { seq: 1, name: "ซ.ตรอกใต้แนว", mode: "truck", served: true, atMin: 240 },
      // ไม่อยู่ใน stopTimes ของงานแทนเบอร์นี้ = วันนั้นไม่ได้เข้าเก็บ
      { seq: 2, name: "ซ.เขาเงาะ 5", mode: "truck", served: false, atMin: null },
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

  it("พาสถานะรอตรวจสอบของสายออกมาด้วย", () => {
    const routesWithFlag: Route[] = [
      { ...routes[0] },
      {
        code: "R5", name: "สาย R5", defaultTruckNumber: 5, active: true,
        needsVerification: true, communityNames: ["ชุมชนเขาใบไม้"],
        stops: [{ seq: 1, name: "จุด X", mode: "truck" }],
      },
    ];
    const a: Assignment[] = [
      { ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 300, stopTimes: [] },
      { ...base, weekday: 1, shiftNo: 1, truckNumber: 5, routeCode: "R5", kind: "normal", startMin: 300, endMin: 400, stopTimes: [] },
    ];
    const out = buildDaySchedule("2026-08-10", 1, a, routesWithFlag, trucks);
    expect(out.assignments[0].routeNeedsVerification).toBe(false); // R1 ไม่ได้ตั้งค่า → false ไม่ใช่ undefined
    expect(out.assignments[1].routeNeedsVerification).toBe(true);
  });

  it("วันหยุดที่ไม่มีสาย ถือว่าไม่ต้องตรวจสอบ", () => {
    const a: Assignment[] = [{
      ...base, weekday: 2, shiftNo: 1, truckNumber: 1, routeCode: null, kind: "day_off",
      startMin: null, endMin: null, stopTimes: [],
    }];
    const out = buildDaySchedule("2026-08-11", 2, a, routes, trucks);
    expect(out.assignments[0].routeNeedsVerification).toBe(false);
  });

  it("พา id ของเอกสารออกมาเป็นสตริง", () => {
    const a = [{
      ...base, _id: { toString: () => "abc123" }, weekday: 1, shiftNo: 1, truckNumber: 1,
      routeCode: "R1", kind: "normal" as const, startMin: 240, endMin: 300, stopTimes: [],
    }];
    const out = buildDaySchedule("2026-08-10", 1, a as never, routes, trucks);
    expect(out.assignments[0].id).toBe("abc123");
  });

  it("เอกสารที่ไม่มี _id (เช่นในเทส) ได้ id เป็นค่าว่าง ไม่พัง", () => {
    const a: Assignment[] = [{
      ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal",
      startMin: 240, endMin: 300, stopTimes: [],
    }];
    const out = buildDaySchedule("2026-08-10", 1, a, routes, trucks);
    expect(out.assignments[0].id).toBe("");
  });

  // updatedAt คือ optimistic lock token ที่ฟอร์มแก้งานต้องส่งกลับไปกับ PUT — ถ้าไม่โผล่มาถึง UI
  // ฟอร์มจะส่งค่าว่างแล้วโดน 400 ทุกครั้ง (หรือแย่กว่า: ปิดล็อกเงียบ ๆ)
  it("พา updatedAt ของเอกสารออกมาเป็น ISO string", () => {
    const a: Assignment[] = [{
      ...base, updatedAt: new Date("2026-08-13T04:05:06.000Z"), weekday: 1, shiftNo: 1,
      truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 300, stopTimes: [],
    }];
    const out = buildDaySchedule("2026-08-10", 1, a, routes, trucks);
    expect(out.assignments[0].updatedAt).toBe("2026-08-13T04:05:06.000Z");
  });

  it("เอกสารที่ไม่มี updatedAt ได้ค่าว่าง ไม่พัง", () => {
    const a: Assignment[] = [{
      ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal",
      startMin: 240, endMin: 300, stopTimes: [],
    }];
    const out = buildDaySchedule("2026-08-10", 1, a, routes, trucks);
    expect(out.assignments[0].updatedAt).toBe("");
  });

  it("แยกสามสถานะของจุดในแต่ละวัน", () => {
    const routesWith3: Route[] = [{
      code: "R1", name: "สาย R1", defaultTruckNumber: 1, active: true,
      communityNames: ["ชุมชนเขาใบไม้"],
      stops: [
        { seq: 1, name: "จุดมีเวลา", mode: "truck" },
        { seq: 2, name: "จุดไม่เก็บวันนี้", mode: "truck" },
        { seq: 3, name: "จุดรอระบุเวลา", mode: "truck" },
      ],
    }];
    const a: Assignment[] = [{
      ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal",
      startMin: 240, endMin: 300,
      // จุด 2 ไม่อยู่ในลิสต์ = วันนี้ไม่เก็บ · จุด 3 อยู่แต่ไม่มีเวลา = รอระบุเวลา
      stopTimes: [{ seq: 1, atMin: 240 }, { seq: 3, atMin: null }],
    }];
    const stops = buildDaySchedule("2026-08-10", 1, a, routesWith3, trucks).assignments[0].stops;
    expect(stops[0]).toMatchObject({ name: "จุดมีเวลา", served: true, atMin: 240 });
    expect(stops[1]).toMatchObject({ name: "จุดไม่เก็บวันนี้", served: false, atMin: null });
    expect(stops[2]).toMatchObject({ name: "จุดรอระบุเวลา", served: true, atMin: null });
  });

  it("งานที่ไม่มีสาย ได้ stops ว่างเหมือนเดิม", () => {
    const a: Assignment[] = [{
      ...base, weekday: 2, shiftNo: 1, truckNumber: 1, routeCode: null, kind: "day_off",
      startMin: null, endMin: null, stopTimes: [],
    }];
    expect(buildDaySchedule("2026-08-11", 2, a, routes, trucks).assignments[0].stops).toEqual([]);
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

describe("buildWeekSchedule", () => {
  const week = [
    "2026-08-09", "2026-08-10", "2026-08-11", "2026-08-12",
    "2026-08-13", "2026-08-14", "2026-08-15",
  ];

  it("คืนครบ 7 วันเรียงตามลำดับที่ส่งเข้ามา", () => {
    const out = buildWeekSchedule(week, [], routes, trucks);
    expect(out).toHaveLength(7);
    expect(out.map((d) => d.date)).toEqual(week);
    expect(out.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("วันที่ไม่มีข้อมูลต้องมีอยู่ในผลลัพธ์ด้วย assignments ว่าง", () => {
    const a: Assignment[] = [
      { ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 300, stopTimes: [] },
    ];
    const out = buildWeekSchedule(week, a, routes, trucks);
    expect(out[1].assignments).toHaveLength(1); // จันทร์
    expect(out[3].assignments).toEqual([]); // พุธ — ยังไม่มีข้อมูล ต้องไม่หายไป
    expect(out.filter((d) => d.assignments.length === 0)).toHaveLength(6);
  });

  // เทส id สองตัวใน describe ของ buildDaySchedule เรียกตรง ๆ จึงข้าม hop ของ pickLatestVersions
  // ที่ production ใช้จริง — ตัวนี้ยึดว่า _id รอดผ่านการเลือกเวอร์ชันมาถึงผลลัพธ์
  it("พา id ผ่าน pickLatestVersions มาถึงผลลัพธ์", () => {
    const a: Array<Assignment & { _id?: unknown }> = [
      { ...base, _id: "abc123", weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 300, stopTimes: [] },
    ];
    const out = buildWeekSchedule(week, a, routes, trucks);
    expect(out[1].assignments[0].id).toBe("abc123");
  });

  it("แยกงานของแต่ละวันไม่ปนกัน", () => {
    const a: Assignment[] = [
      { ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 300, stopTimes: [] },
      { ...base, weekday: 2, shiftNo: 1, truckNumber: 5, routeCode: "R1", kind: "normal", startMin: 250, endMin: 310, stopTimes: [] },
    ];
    const out = buildWeekSchedule(week, a, routes, trucks);
    expect(out[1].assignments.map((x) => x.truckNumber)).toEqual([1]);
    expect(out[2].assignments.map((x) => x.truckNumber)).toEqual([5]);
  });

  it("ตัดงานที่ยังไม่มีผลหรือหมดอายุแล้วออกรายวัน", () => {
    const a: Assignment[] = [
      // เริ่มมีผลวันอังคาร 2026-08-11 → วันจันทร์ต้องไม่เห็น
      { ...base, effectiveFrom: new Date("2026-08-11T00:00:00+07:00"), weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 300, stopTimes: [] },
    ];
    const out = buildWeekSchedule(week, a, routes, trucks);
    expect(out[1].assignments).toEqual([]);

    const b: Assignment[] = [
      // ใช้ได้ถึงวันจันทร์ 2026-08-10 (inclusive) → วันจันทร์เห็น
      { ...base, effectiveTo: new Date("2026-08-10T00:00:00+07:00"), weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 300, stopTimes: [] },
    ];
    expect(buildWeekSchedule(week, b, routes, trucks)[1].assignments).toHaveLength(1);
  });

  it("เลือกเวอร์ชันล่าสุดแยกกันในแต่ละวัน", () => {
    const a: Assignment[] = [
      { ...base, effectiveFrom: new Date("2026-01-01"), weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 300, stopTimes: [] },
      { ...base, effectiveFrom: new Date("2026-07-01"), weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 260, endMin: 320, stopTimes: [] },
    ];
    const out = buildWeekSchedule(week, a, routes, trucks);
    expect(out[1].assignments).toHaveLength(1);
    expect(out[1].assignments[0].startMin).toBe(260);
  });

  // ปักพฤติกรรมที่ผู้เรียกต้องรู้: เมื่อ effectiveFrom เท่ากัน "ตัวแรกในลิสต์ชนะ"
  // → ผู้เรียกต้องส่งลิสต์ที่เรียงใหม่สุดมาก่อน (resolveWeekSchedule sort ด้วย effectiveFrom:-1, _id:-1)
  // ถ้าลบ .sort() นั้นออก การเลือกเวอร์ชันจะขึ้นกับลำดับที่ไดรเวอร์คืนมาแบบเงียบ ๆ
  it("effectiveFrom เท่ากัน → ตัวแรกในลิสต์ชนะ (ผู้เรียกต้อง sort ใหม่สุดมาก่อน)", () => {
    const sameFrom = new Date("2026-07-01T00:00:00+07:00");
    const newestFirst: Assignment[] = [
      { ...base, effectiveFrom: sameFrom, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 260, endMin: 320, stopTimes: [], label: "เวอร์ชันที่สร้างทีหลัง" },
      { ...base, effectiveFrom: sameFrom, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 300, stopTimes: [], label: "เวอร์ชันที่สร้างก่อน" },
    ];
    const out = buildWeekSchedule(week, newestFirst, routes, trucks);
    expect(out[1].assignments).toHaveLength(1);
    expect(out[1].assignments[0].label).toBe("เวอร์ชันที่สร้างทีหลัง");
    expect(out[1].assignments[0].startMin).toBe(260);
  });
});
