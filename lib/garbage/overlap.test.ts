import { describe, it, expect } from "vitest";
import { findOverlap } from "./overlap";
import type { Minutes } from "@/types/garbage";

interface Row {
  _id: string;
  weekday: number;
  truckNumber: number;
  shiftNo: number;
  startMin: Minutes | null;
  endMin: Minutes | null;
}

const row = (o: Partial<Row>): Row => ({
  _id: "a1", weekday: 1, truckNumber: 1, shiftNo: 1, startMin: 240, endMin: 300, ...o,
});

describe("findOverlap", () => {
  it("ไม่มีงานอื่นเลย = ไม่ทับ", () => {
    expect(findOverlap([], row({}))).toBeNull();
  });

  it("เวลาทับกันบางส่วน = เจอ", () => {
    const existing = [row({ _id: "old", shiftNo: 1, startMin: 240, endMin: 300 })];
    const hit = findOverlap(existing, row({ _id: "new", shiftNo: 2, startMin: 290, endMin: 400 }));
    expect(hit?._id).toBe("old");
  });

  it("ครอบทั้งช่วง = เจอ", () => {
    const existing = [row({ _id: "old", shiftNo: 1, startMin: 300, endMin: 320 })];
    expect(findOverlap(existing, row({ _id: "new", shiftNo: 2, startMin: 240, endMin: 400 }))?._id).toBe("old");
  });

  it("ประชิดพอดี (จบ 300 เริ่ม 300) = ไม่ทับ", () => {
    const existing = [row({ _id: "old", shiftNo: 1, startMin: 240, endMin: 300 })];
    expect(findOverlap(existing, row({ _id: "new", shiftNo: 2, startMin: 300, endMin: 400 }))).toBeNull();
  });

  it("ข้ามตัวเองตอนแก้งานเดิม", () => {
    const existing = [row({ _id: "same", shiftNo: 1, startMin: 240, endMin: 300 })];
    expect(findOverlap(existing, row({ _id: "same", shiftNo: 1, startMin: 250, endMin: 310 }))).toBeNull();
  });

  it("รถต่างคัน ไม่ถือว่าทับ", () => {
    const existing = [row({ _id: "old", truckNumber: 2, startMin: 240, endMin: 300 })];
    expect(findOverlap(existing, row({ _id: "new", truckNumber: 1, startMin: 240, endMin: 300 }))).toBeNull();
  });

  it("วันต่างกัน ไม่ถือว่าทับ", () => {
    const existing = [row({ _id: "old", weekday: 2, startMin: 240, endMin: 300 })];
    expect(findOverlap(existing, row({ _id: "new", weekday: 1, startMin: 240, endMin: 300 }))).toBeNull();
  });

  it("วันหยุดที่ไม่มีเวลา ข้ามทั้งสองฝั่ง", () => {
    const dayOff = row({ _id: "off", startMin: null, endMin: null });
    expect(findOverlap([dayOff], row({ _id: "new", startMin: 240, endMin: 300 }))).toBeNull();
    expect(findOverlap([row({ _id: "old" })], row({ _id: "new", startMin: null, endMin: null }))).toBeNull();
  });

  it("ทับหลายตัว คืนตัวที่เวลาเริ่มก่อนสุด", () => {
    const existing = [
      row({ _id: "late", shiftNo: 2, startMin: 400, endMin: 500 }),
      row({ _id: "early", shiftNo: 1, startMin: 200, endMin: 500 }),
    ];
    expect(findOverlap(existing, row({ _id: "new", shiftNo: 3, startMin: 250, endMin: 450 }))?._id).toBe("early");
  });
});
