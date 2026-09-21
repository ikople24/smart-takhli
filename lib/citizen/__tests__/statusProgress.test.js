// lib/citizen/__tests__/statusProgress.test.js
import { describe, it, expect } from "vitest";
import { statusProgress, statusTimeline } from "../status/progress";

const base = {
  status: "อยู่ระหว่างดำเนินการ",
  createdAt: "2026-06-24T02:12:00.000Z",
  updatedAt: "2026-06-27T05:00:00.000Z",
};

const assignment = {
  assignedAt: "2026-06-25T03:30:00.000Z",
  completedAt: null,
  user: { name: "วิชัย", department: "กองช่าง", position: "นายช่างโยธา" },
};

describe("statusProgress", () => {
  it("ยังไม่มอบหมาย = ขั้น 1 รับเรื่อง", () => {
    const p = statusProgress(base, null);
    expect(p.step).toBe(1);
    expect(p.label).toBe("รับเรื่องร้องเรียน");
    expect(p.at).toBe(base.createdAt);
  });
  it("มอบหมายแล้วยังไม่เสร็จ = ขั้น 3 กำลังแก้ไข", () => {
    const p = statusProgress(base, assignment);
    expect(p.step).toBe(3);
    expect(p.label).toBe("ดำเนินการแก้ไข");
  });
  it("สถานะเสร็จสิ้น = ขั้น 4 · at ใช้ completedAt ก่อน แล้วค่อย updatedAt", () => {
    const done = { ...base, status: "ดำเนินการเสร็จสิ้น" };
    expect(statusProgress(done, { ...assignment, completedAt: "2026-06-27T04:00:00.000Z" })).toMatchObject({
      step: 4,
      at: "2026-06-27T04:00:00.000Z",
    });
    expect(statusProgress(done, assignment).at).toBe(base.updatedAt);
    expect(statusProgress(done, null).step).toBe(4); // เสร็จโดยไม่มี assignment ก็ต้องขั้น 4
  });
});

describe("statusTimeline", () => {
  it("คืน 4 แถวเสมอ เรียงขั้น 1→4 พร้อม reached", () => {
    const rows = statusTimeline(base, assignment);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.reached)).toEqual([true, true, true, false]);
    expect(rows[1].detail).toContain("กองช่าง");
    expect(rows[1].at).toBe(assignment.assignedAt);
  });
  it("ยังไม่มอบหมาย: ขั้น 2-4 ยังไม่ถึง", () => {
    const rows = statusTimeline(base, null);
    expect(rows.map((r) => r.reached)).toEqual([true, false, false, false]);
  });
  it("เสร็จสิ้น: ครบทุกขั้น", () => {
    const rows = statusTimeline({ ...base, status: "ดำเนินการเสร็จสิ้น" }, assignment);
    expect(rows.map((r) => r.reached)).toEqual([true, true, true, true]);
  });
});
