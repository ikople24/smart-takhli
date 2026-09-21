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

  it("จุดที่ยังไม่ระบุเวลาปนกับจุดที่ระบุแล้ว บันทึกได้", () => {
    const r = assignmentSchema.safeParse({
      ...base,
      stopTimes: [{ seq: 1, atMin: 240 }, { seq: 2, atMin: null }, { seq: 3, atMin: 260 }],
    });
    expect(r.success).toBe(true);
  });

  /**
   * เคยมีกฎ "เวลาต้องไม่ย้อนกลับตามลำดับ seq" แล้วถอดออกใน M7 เพราะตั้งไว้ผิด:
   * seq คือเลขแถวในรายชื่อสถานที่ของสาย ไม่ใช่ลำดับที่รถวิ่ง และรถวิ่งคนละเส้นทางในแต่ละวัน
   * ตัวอย่างจริงจากตารางกองสาธารณสุข: รถ 1 วันอาทิตย์ เก็บจุดที่ 11 ตอน 5.00 น.
   * หลังจากเก็บจุดที่ 7 ตอน 5.10 น. — ต้องบันทึกได้ ไม่ใช่ถูกปฏิเสธ
   */
  it("เวลาเรียงย้อนตามลำดับ seq บันทึกได้ (seq = เลขรายการ ไม่ใช่ลำดับวิ่ง)", () => {
    const r = assignmentSchema.safeParse({
      ...base,
      stopTimes: [{ seq: 1, atMin: 300 }, { seq: 2, atMin: 240 }],
    });
    expect(r.success).toBe(true);
  });

  it("งานปกติที่ไปเก็บแทนสายอื่นด้วย บันทึกได้ (ทริปเดียวเก็บสองสาย)", () => {
    const r = assignmentSchema.safeParse({ ...base, kind: "normal", coverForRouteCode: "R5" });
    expect(r.success).toBe(true);
  });

  it("ระบุว่าเก็บแทนสายไหน แต่ไม่มีสายที่ตัวเองวิ่ง = ไม่ผ่าน", () => {
    const r = assignmentSchema.safeParse({
      ...base, kind: "special", routeCode: null, coverForRouteCode: "R5",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes("routeCode ของสายที่วิ่งจริง"))).toBe(true);
    }
  });

  it("งานพิเศษที่ทุกจุดยังไม่ระบุเวลา บันทึกได้ (รถยกภาชนะ)", () => {
    const r = assignmentSchema.safeParse({
      ...base, kind: "special", routeCode: "R13", startMin: null, endMin: null,
      stopTimes: [{ seq: 1, atMin: null }, { seq: 2, atMin: null }],
    });
    expect(r.success).toBe(true);
  });
});
