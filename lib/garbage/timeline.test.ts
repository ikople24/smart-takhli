import { describe, it, expect } from "vitest";
import type { ResolvedAssignment, ResolvedDaySchedule } from "@/types/garbage";
import {
  buildRuns,
  currentStopIndex,
  lastTimedStopIndex,
  runStatus,
  visibleStops,
  type TimelineRun,
} from "./timeline";

/** งานหนึ่งรายการแบบย่อ — ใส่เฉพาะฟิลด์ที่ buildRuns ใช้ ที่เหลือเป็นค่ากลาง ๆ */
function assignment(over: Partial<ResolvedAssignment>): ResolvedAssignment {
  return {
    id: "x",
    updatedAt: "",
    truckNumber: 1,
    truckColor: "yellow",
    shiftNo: 1,
    kind: "normal",
    routeCode: "R1",
    routeName: "โซน 1",
    routeNeedsVerification: false,
    coverForRouteCode: null,
    startMin: 240,
    endMin: 470,
    label: null,
    stops: [],
    communityWindows: [],
    ...over,
  };
}

const stop = (seq: number, name: string, served: boolean, atMin: number | null) => ({
  seq,
  name,
  mode: "truck" as const,
  served,
  atMin,
});

function day(assignments: ResolvedAssignment[]): ResolvedDaySchedule {
  return { date: "2026-08-14", weekday: 5, assignments };
}

describe("buildRuns", () => {
  it("เก็บเฉพาะจุดที่วันนั้นเข้าเก็บจริง — จุดที่ไม่เก็บวันนี้ต้องไม่อยู่ในไทม์ไลน์", () => {
    const runs = buildRuns(
      day([
        assignment({
          stops: [
            stop(1, "ถนนดอกไม้แดง", true, 240),
            stop(2, "ซอยเจ้าเงาะ 5", false, null),
            stop(3, "ถนนบ่อทอง", true, 300),
          ],
        }),
      ])
    );
    expect(runs).toHaveLength(1);
    expect(runs[0].stops.map((s) => s.name)).toEqual(["ถนนดอกไม้แดง", "ถนนบ่อทอง"]);
  });

  it("จุดที่เก็บแต่ยังไม่ระบุเวลา (รถยกภาชนะ) ต้องอยู่ในไทม์ไลน์ ไม่ใช่หายไป", () => {
    const runs = buildRuns(
      day([
        assignment({
          routeCode: "R13",
          routeName: "รถยกภาชนะรองรับ",
          truckNumber: 13,
          kind: "special",
          stops: [stop(1, "โรงพยาบาลตาคลี", true, null)],
        }),
      ])
    );
    expect(runs[0].stops).toEqual([{ seq: 1, name: "โรงพยาบาลตาคลี", atMin: null }]);
  });

  it("ตัดงานวันหยุดออก และตัดงานที่ไม่มีจุดเก็บเลย (ไม่มีอะไรให้ดูในไทม์ไลน์)", () => {
    const runs = buildRuns(
      day([
        assignment({ truckNumber: 1, kind: "day_off", routeCode: null, routeName: null, stops: [] }),
        assignment({ truckNumber: 2, routeCode: "R2", routeName: "โซน 2", stops: [stop(1, "ก", false, null)] }),
        assignment({ truckNumber: 3, routeCode: "R3", routeName: "โซน 3", stops: [stop(1, "ข", true, 250)] }),
      ])
    );
    expect(runs.map((r) => r.truckNumber)).toEqual([3]);
  });

  it("ชื่อสายที่โชว์เป็นคำเรียกจริง — โซนใช้ 'โซน N' ส่วน R13 ใช้ชื่อสายเพราะไม่ใช่โซน", () => {
    const runs = buildRuns(
      day([
        assignment({ routeCode: "R2", routeName: "โซน 2", stops: [stop(1, "ก", true, 240)] }),
        assignment({
          truckNumber: 13,
          routeCode: "R13",
          routeName: "รถยกภาชนะรองรับ",
          stops: [stop(1, "ข", true, 600)],
        }),
      ])
    );
    expect(runs.map((r) => r.zoneLabel)).toEqual(["โซน 2", "รถยกภาชนะรองรับ"]);
  });

  it("ต้องพ่วงเวลาเริ่ม–สิ้นสุดของงานมาด้วย ไม่งั้นไทม์ไลน์ไม่รู้ว่าเลิกงานหรือยัง", () => {
    const runs = buildRuns(
      day([assignment({ startMin: 240, endMin: 720, stops: [stop(1, "ก", true, 240)] })])
    );
    expect(runs[0].startMin).toBe(240);
    expect(runs[0].endMin).toBe(720);
  });

  it("คงลำดับที่ API ส่งมา (หน้าประชาชนเรียงตามเวลาออกวิ่ง)", () => {
    const runs = buildRuns(
      day([
        assignment({ truckNumber: 6, routeCode: "R6", routeName: "โซน 6", stops: [stop(1, "ก", true, 180)] }),
        assignment({ truckNumber: 1, routeCode: "R1", routeName: "โซน 1", stops: [stop(1, "ข", true, 240)] }),
      ])
    );
    expect(runs.map((r) => r.truckNumber)).toEqual([6, 1]);
  });
});

describe("runStatus", () => {
  const run = (over: Partial<TimelineRun> = {}): TimelineRun => ({
    routeCode: "R1",
    zoneLabel: "โซน 1",
    truckNumber: 1,
    truckColor: "yellow",
    startMin: 240,
    endMin: 720,
    stops: [
      { seq: 1, name: "ก", atMin: 240 },
      { seq: 2, name: "ข", atMin: 720 },
    ],
    ...over,
  });

  it("เลยเวลาเลิกงานแล้ว = เก็บครบแล้ว — ห้ามค้างว่ารถยังอยู่จุดสุดท้ายทั้งเย็น", () => {
    expect(runStatus(run(), 915)).toBe("finished");
  });

  it("ยังไม่ถึงเวลาออก = ยังไม่เริ่ม", () => {
    expect(runStatus(run(), 120)).toBe("upcoming");
  });

  it("อยู่ในช่วงเวลาทำงาน = กำลังวิ่ง (นาทีสุดท้ายยังนับว่าวิ่งอยู่)", () => {
    expect(runStatus(run(), 240)).toBe("running");
    expect(runStatus(run(), 500)).toBe("running");
    expect(runStatus(run(), 720)).toBe("running");
    expect(runStatus(run(), 721)).toBe("finished");
  });

  it("ไม่มีเวลาเริ่ม/สิ้นสุด แต่มีเวลารายจุด ให้อนุมานจากจุดแรกกับจุดสุดท้าย", () => {
    const r = run({ startMin: null, endMin: null });
    expect(runStatus(r, 120)).toBe("upcoming");
    expect(runStatus(r, 500)).toBe("running");
    expect(runStatus(r, 915)).toBe("finished");
  });

  it("ไม่มีเวลาเลย (รถยกภาชนะที่ยังไม่กรอกเวลา) = ไม่รู้สถานะ ไม่ใช่เดาว่าเสร็จแล้ว", () => {
    const r = run({
      startMin: null,
      endMin: null,
      stops: [{ seq: 1, name: "รพ.ตาคลี", atMin: null }],
    });
    expect(runStatus(r, 915)).toBe("unknown");
  });
});

describe("currentStopIndex", () => {
  const stops = [
    { seq: 1, name: "ก", atMin: 240 },
    { seq: 2, name: "ข", atMin: 300 },
    { seq: 3, name: "ค", atMin: 360 },
  ];

  it("จุดล่าสุดที่เวลาถึงแล้ว = จุดที่รถกำลังอยู่", () => {
    expect(currentStopIndex(stops, 310)).toBe(1);
    expect(currentStopIndex(stops, 300)).toBe(1);
  });

  it("ยังไม่ถึงเวลาจุดแรก = -1 (รถยังไม่ออก)", () => {
    expect(currentStopIndex(stops, 100)).toBe(-1);
  });

  it("เลยจุดสุดท้ายแล้ว = จุดสุดท้าย", () => {
    expect(currentStopIndex(stops, 1200)).toBe(2);
  });

  it("จุดที่ไม่มีเวลาไม่ถูกนับเป็นจุดปัจจุบัน — ไม่งั้นรถ 13 จะดูเหมือนอยู่ทุกจุดตลอดวัน", () => {
    const noTime = [
      { seq: 1, name: "ก", atMin: null },
      { seq: 2, name: "ข", atMin: null },
    ];
    expect(currentStopIndex(noTime, 800)).toBe(-1);
  });

  it("เวลาเรียงย้อนกลับตามลำดับจุดได้ (ลำดับจุดไม่ใช่ลำดับวิ่ง) — ยึดจุดท้ายสุดที่ถึงแล้ว", () => {
    const zigzag = [
      { seq: 11, name: "ก", atMin: 300 },
      { seq: 7, name: "ข", atMin: 310 },
      { seq: 12, name: "ค", atMin: 400 },
    ];
    expect(currentStopIndex(zigzag, 320)).toBe(1);
  });
});

describe("lastTimedStopIndex", () => {
  it("จุดที่รถไปถึงช้าสุด ไม่ใช่จุดท้ายลิสต์ — ของจริงโซน 3 ท้ายลิสต์เก็บ 6.00 แต่เลิกงาน 11.15", () => {
    const stops = [
      { seq: 1, name: "ก", atMin: 270 },
      { seq: 2, name: "ข", atMin: 675 },
      { seq: 3, name: "ค", atMin: 360 },
    ];
    expect(lastTimedStopIndex(stops)).toBe(1);
  });

  it("เวลาเท่ากันเอาตัวที่อยู่หลังในลิสต์", () => {
    const stops = [
      { seq: 1, name: "ก", atMin: 300 },
      { seq: 2, name: "ข", atMin: 300 },
    ];
    expect(lastTimedStopIndex(stops)).toBe(1);
  });

  it("ข้ามจุดที่ไม่มีเวลา", () => {
    const stops = [
      { seq: 1, name: "ก", atMin: 300 },
      { seq: 2, name: "ข", atMin: null },
    ];
    expect(lastTimedStopIndex(stops)).toBe(0);
  });

  it("ไม่มีจุดไหนมีเวลาเลย = -1", () => {
    expect(lastTimedStopIndex([{ seq: 1, name: "ก", atMin: null }])).toBe(-1);
    expect(lastTimedStopIndex([])).toBe(-1);
  });
});

describe("visibleStops", () => {
  const stops = Array.from({ length: 12 }, (_, i) => ({ seq: i + 1, name: `จุด ${i + 1}`, atMin: 240 + i * 10 }));

  it("ย่อไว้เฉพาะช่วงรอบตัวรถ", () => {
    const vis = visibleStops(stops, 5, -1, false);
    expect(vis.map((s) => s.seq)).toEqual([4, 5, 6, 7, 8, 9]);
  });

  it("จุดที่ติดตามไว้ต้องเห็นเสมอ แม้อยู่ไกลจากรถ", () => {
    const vis = visibleStops(stops, 2, 10, false);
    expect(vis.map((s) => s.seq)).toContain(11);
    // ต้องไม่สลับลำดับ — จุดที่ติดตามอยู่ท้ายสายก็ต้องอยู่ท้ายลิสต์
    expect(vis.map((s) => s.seq)).toEqual([1, 2, 3, 4, 5, 6, 11]);
  });

  it("ปรับช่วงได้ — สายที่เลิกงานแล้วไม่มีจุดถัดไป จึงขอเฉพาะจุดก่อนหน้า", () => {
    const vis = visibleStops(stops, 7, -1, false, { behind: 5, ahead: 0 });
    expect(vis.map((s) => s.seq)).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it("กางแล้วเห็นทั้งสาย", () => {
    expect(visibleStops(stops, 5, -1, true)).toHaveLength(12);
  });

  it("รถยังไม่ออก (curIdx -1) โชว์จุดต้นสาย ไม่ใช่ลิสต์ว่าง", () => {
    expect(visibleStops(stops, -1, -1, false).map((s) => s.seq)).toEqual([1, 2, 3]);
  });
});
