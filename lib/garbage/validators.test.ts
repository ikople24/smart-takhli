import { describe, it, expect } from "vitest";
import { assignmentSchema } from "./validators";

const base = {
  weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal" as const,
  coverForRouteCode: null, startMin: 240, endMin: 300,
  stopTimes: [] as Array<{ seq: number; atMin: number | null }>,
  communityWindows: [], label: null,
};

describe("assignmentSchema กับเวลาที่เว้นว่าง", () => {
  it("รับ atMin เป็น null ได้", () => {
    const r = assignmentSchema.safeParse({ ...base, stopTimes: [{ seq: 1, atMin: null }] });
    expect(r.success).toBe(true);
  });

  it("กฎเวลาไม่ย้อนกลับต้องข้ามจุดที่ไม่มีเวลา", () => {
    const r = assignmentSchema.safeParse({
      ...base,
      stopTimes: [{ seq: 1, atMin: 240 }, { seq: 2, atMin: null }, { seq: 3, atMin: 260 }],
    });
    expect(r.success).toBe(true);
  });

  it("ยังจับเวลาย้อนกลับของจุดที่มีเวลาได้", () => {
    const r = assignmentSchema.safeParse({
      ...base,
      stopTimes: [{ seq: 1, atMin: 300 }, { seq: 2, atMin: 240 }],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toContain("ย้อนกลับ");
  });

  it("งานพิเศษที่ทุกจุดยังไม่ระบุเวลา บันทึกได้ (รถยกภาชนะ)", () => {
    const r = assignmentSchema.safeParse({
      ...base, kind: "special", routeCode: "R13", startMin: null, endMin: null,
      stopTimes: [{ seq: 1, atMin: null }, { seq: 2, atMin: null }],
    });
    expect(r.success).toBe(true);
  });
});
