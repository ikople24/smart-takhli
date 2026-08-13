import { describe, it, expect } from "vitest";
import { getLivePosition } from "./live";
import type { ResolvedAssignment } from "@/types/garbage";

const ra: ResolvedAssignment = {
  truckNumber: 1, truckColor: "yellow", shiftNo: 1, kind: "normal",
  routeCode: "R1", routeName: "สาย R1", routeNeedsVerification: false, coverForRouteCode: null,
  startMin: 240, endMin: 300, label: null,
  stops: [
    { seq: 1, name: "จุด A", mode: "truck", atMin: 240 },
    { seq: 2, name: "จุด B", mode: "truck", atMin: 270 },
    { seq: 3, name: "จุด C", mode: "truck", atMin: 300 },
  ],
  communityWindows: [
    { communityNames: ["ชุมชน ก"], startMin: 240, endMin: 270 },
    { communityNames: ["ชุมชน ข"], startMin: 270, endMin: 300 },
  ],
};

describe("getLivePosition", () => {
  it("ก่อนเริ่ม บอกว่าอีกกี่นาทีจะเริ่ม", () => {
    const p = getLivePosition(ra, 200);
    expect(p.status).toBe("upcoming");
    expect(p.startsInMin).toBe(40);
  });

  it("หลังจบ บอกว่าเสร็จแล้ว", () => {
    expect(getLivePosition(ra, 400).status).toBe("finished");
  });

  it("ระหว่างวิ่ง บอกจุดปัจจุบันและจุดถัดไป", () => {
    const p = getLivePosition(ra, 280);
    expect(p.status).toBe("running");
    expect(p.currentStop?.name).toBe("จุด B");
    expect(p.nextStop?.name).toBe("จุด C");
    expect(p.etaNextMin).toBe(20);
    expect(p.currentWindow?.communityNames).toEqual(["ชุมชน ข"]);
  });

  it("ณ นาทีสุดท้ายของงาน ต้องได้จุดสุดท้าย ไม่ใช่จุดแรก", () => {
    // บั๊กของระบบเดิม: Math.floor(progress * len) ได้ index เกินขอบ แล้ว fallback ไป stops[0]
    const p = getLivePosition(ra, 300);
    expect(p.currentStop?.name).toBe("จุด C");
    expect(p.nextStop).toBeNull();
    expect(p.progress).toBe(1);
  });

  it("ใช้เวลาจริงของแต่ละจุด ไม่ใช่สัดส่วนของเส้นทาง", () => {
    const uneven: ResolvedAssignment = {
      ...ra, startMin: 240, endMin: 840,
      stops: [
        { seq: 1, name: "เข้า 1", mode: "truck", atMin: 240 },
        { seq: 2, name: "เข้า 2", mode: "truck", atMin: 260 },
        { seq: 3, name: "สาย", mode: "truck", atMin: 840 },
      ],
      communityWindows: [],
    };
    // ที่นาที 300 ผ่านมา 10% ของเวลา แต่ผ่านไปแล้ว 2 จุดจาก 3
    // ถ้าใช้สัดส่วนจะได้ index 0 ซึ่งผิด
    expect(getLivePosition(uneven, 300).currentStop?.name).toBe("เข้า 2");
  });

  it("stops ที่มาไม่เรียงตามเวลา ยังได้จุดปัจจุบัน/ถัดไปถูกต้อง", () => {
    const shuffled: ResolvedAssignment = {
      ...ra,
      stops: [
        { seq: 2, name: "จุด B", mode: "truck", atMin: 270 },
        { seq: 1, name: "จุด A", mode: "truck", atMin: 240 },
        { seq: 3, name: "จุด C", mode: "truck", atMin: 300 },
      ],
    };
    const p = getLivePosition(shuffled, 280);
    expect(p.currentStop?.name).toBe("จุด B");
    expect(p.nextStop?.name).toBe("จุด C");
    expect(p.etaNextMin).toBe(20);
  });

  it("ณ นาทีแรกของงาน คือ running ที่จุดแรก progress 0", () => {
    const p = getLivePosition(ra, 240);
    expect(p.status).toBe("running");
    expect(p.currentStop?.name).toBe("จุด A");
    expect(p.progress).toBe(0);
  });

  it("กลางงานพอดี progress = 0.5", () => {
    expect(getLivePosition(ra, 270).progress).toBe(0.5);
  });

  it("วันหยุดที่ไม่มีเวลา คือ unknown", () => {
    const off = { ...ra, startMin: null, endMin: null, kind: "day_off" as const, stops: [] };
    expect(getLivePosition(off, 300).status).toBe("unknown");
  });

  it("ไม่มี stopTimes เลย ยังบอกสถานะได้", () => {
    const noTimes = { ...ra, stops: ra.stops.map((s) => ({ ...s, atMin: null })) };
    const p = getLivePosition(noTimes, 280);
    expect(p.status).toBe("running");
    expect(p.currentStop).toBeNull();
    expect(p.currentWindow?.communityNames).toEqual(["ชุมชน ข"]);
  });
});
