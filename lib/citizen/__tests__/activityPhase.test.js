// lib/citizen/__tests__/activityPhase.test.js
import { describe, it, expect } from "vitest";
import { activityPhase } from "../activities/phase";

const activity = {
  startDate: "2026-08-10T00:00:00.000Z",
  endDate: "2026-08-20T23:59:59.000Z",
};

describe("activityPhase — เกณฑ์ตรง getActivityStatus ของหน้า /activities เดิม", () => {
  it("ก่อนวันเริ่ม = กำลังจะเริ่ม", () => {
    const p = activityPhase(activity, new Date("2026-08-01T00:00:00.000Z"));
    expect(p.key).toBe("upcoming");
    expect(p.label).toBe("กำลังจะเริ่ม");
  });
  it("ระหว่างช่วงจัด = กำลังดำเนินการ", () => {
    const p = activityPhase(activity, new Date("2026-08-15T12:00:00.000Z"));
    expect(p.key).toBe("active");
    expect(p.label).toBe("กำลังดำเนินการ");
  });
  it("หลังวันสิ้นสุด = สิ้นสุดแล้ว", () => {
    const p = activityPhase(activity, new Date("2026-09-01T00:00:00.000Z"));
    expect(p.key).toBe("ended");
    expect(p.label).toBe("สิ้นสุดแล้ว");
  });
  it("ขอบเวลา: เท่ากับ start/end พอดี = กำลังดำเนินการ (ตามเดิม: ไม่ < และไม่ >)", () => {
    expect(activityPhase(activity, new Date(activity.startDate)).key).toBe("active");
    expect(activityPhase(activity, new Date(activity.endDate)).key).toBe("active");
  });
  it("ทุกช่วงมีชุดสีครบ", () => {
    for (const now of ["2026-08-01", "2026-08-15", "2026-09-01"]) {
      const p = activityPhase(activity, new Date(now));
      expect(p.chipBg).toMatch(/^#/);
      expect(p.chipText).toMatch(/^#/);
      expect(p.dot).toMatch(/^#/);
    }
  });
});
