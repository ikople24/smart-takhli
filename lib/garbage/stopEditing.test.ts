import { describe, it, expect } from "vitest";
import { assignSeq, buildSeqMap, remapStopTimes, distributeStopTimes } from "./stopEditing";

describe("assignSeq", () => {
  it("ให้ seq 1..n ตามลำดับที่ส่งมา", () => {
    const out = assignSeq([
      { prevSeq: 3, name: "ค", mode: "truck" },
      { prevSeq: null, name: "ใหม่", mode: "walk" },
      { prevSeq: 1, name: "ก", mode: "truck" },
    ]);
    expect(out.map((s) => s.seq)).toEqual([1, 2, 3]);
    expect(out.map((s) => s.name)).toEqual(["ค", "ใหม่", "ก"]);
    expect(out[1].mode).toBe("walk");
  });

  it("ไม่พา prevSeq ติดไปในผลลัพธ์", () => {
    const out = assignSeq([{ prevSeq: 5, name: "ก", mode: "truck" }]);
    expect(out[0]).toEqual({ seq: 1, name: "ก", mode: "truck", roadId: null });
  });
});

describe("buildSeqMap", () => {
  it("จับคู่ seq เดิมกับ seq ใหม่ ข้ามจุดที่เพิ่มใหม่", () => {
    const map = buildSeqMap([
      { prevSeq: 3, name: "ค", mode: "truck" },
      { prevSeq: null, name: "ใหม่", mode: "truck" },
      { prevSeq: 1, name: "ก", mode: "truck" },
    ]);
    expect(map.get(3)).toBe(1);
    expect(map.get(1)).toBe(3);
    expect(map.has(2)).toBe(false); // จุดที่ 2 ถูกลบ
    expect(map.size).toBe(2);
  });
});

describe("remapStopTimes", () => {
  const map = new Map([
    [1, 2],
    [3, 1],
  ]); // จุด 1 ย้ายไปที่ 2, จุด 3 ย้ายไปที่ 1, จุด 2 ถูกลบ

  it("ย้ายเวลาไปตามจุดเดิม ไม่ใช่ตามตำแหน่ง", () => {
    const out = remapStopTimes(map, [
      { seq: 1, atMin: 240 },
      { seq: 3, atMin: 300 },
    ]);
    expect(out).toEqual([
      { seq: 1, atMin: 300 },
      { seq: 2, atMin: 240 },
    ]);
  });

  it("ตัดเวลาของจุดที่ถูกลบออก", () => {
    const out = remapStopTimes(map, [
      { seq: 1, atMin: 240 },
      { seq: 2, atMin: 260 },
    ]);
    expect(out).toEqual([{ seq: 2, atMin: 240 }]);
  });

  it("เรียงผลลัพธ์ตาม seq ใหม่", () => {
    const out = remapStopTimes(map, [
      { seq: 1, atMin: 240 },
      { seq: 3, atMin: 100 },
    ]);
    expect(out.map((s) => s.seq)).toEqual([1, 2]);
  });

  it("ไม่มีเวลาเดิม = ได้อาเรย์ว่าง", () => {
    expect(remapStopTimes(map, [])).toEqual([]);
  });
});

describe("distributeStopTimes", () => {
  it("กระจายเท่ากันตลอดช่วง จุดแรกที่เวลาเริ่ม จุดสุดท้ายที่เวลาจบ", () => {
    expect(distributeStopTimes(3, 240, 300)).toEqual([
      { seq: 1, atMin: 240 },
      { seq: 2, atMin: 270 },
      { seq: 3, atMin: 300 },
    ]);
  });

  it("จุดเดียว ได้เวลาเริ่ม", () => {
    expect(distributeStopTimes(1, 240, 300)).toEqual([{ seq: 1, atMin: 240 }]);
  });

  it("ช่วงเวลาเป็นศูนย์ ทุกจุดเวลาเดียวกัน", () => {
    expect(distributeStopTimes(3, 300, 300)).toEqual([
      { seq: 1, atMin: 300 },
      { seq: 2, atMin: 300 },
      { seq: 3, atMin: 300 },
    ]);
  });

  it("ปัดเป็นจำนวนเต็มและไม่ย้อนกลับ", () => {
    const out = distributeStopTimes(22, 240, 550);
    expect(out).toHaveLength(22);
    expect(out.every((s) => Number.isInteger(s.atMin))).toBe(true);
    expect(out[0].atMin).toBe(240);
    expect(out[21].atMin).toBe(550);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].atMin).toBeGreaterThanOrEqual(out[i - 1].atMin);
    }
  });

  it("จำนวนจุดไม่ถูกต้อง ได้อาเรย์ว่าง", () => {
    expect(distributeStopTimes(0, 240, 300)).toEqual([]);
    expect(distributeStopTimes(-1, 240, 300)).toEqual([]);
  });
});
