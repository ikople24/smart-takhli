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

  it("ช่วงเวลาติดลบ (จบก่อนเริ่ม) ได้อาเรย์ว่าง ไม่ใช่เวลาถอยหลัง", () => {
    expect(distributeStopTimes(3, 300, 240)).toEqual([]);
    expect(distributeStopTimes(1, 300, 240)).toEqual([]);
  });
});

/**
 * เทสประกอบร่าง — assignSeq, buildSeqMap, remapStopTimes ต่างพึ่งสมมติฐาน "ตำแหน่งที่ i ได้ seq i+1"
 * ตัวเดียวกัน แต่เทสรายฟังก์ชันข้างบนใช้ map ที่เขียนมือ จึงไม่มีอะไรยึดสองฝั่งให้ตรงกัน
 * เทสนี้รันทั้งสามต่อกันบน drafts ชุดเดียว แล้วยึดว่า "จุดเดิมต้องถือเวลาเดิมไปที่ตำแหน่งใหม่ของมัน"
 * — นี่คือ path ที่กันประชาชนเห็นเวลาผิดหลังเจ้าหน้าที่สลับลำดับจุด
 */
describe("assignSeq + buildSeqMap + remapStopTimes ทำงานร่วมกัน", () => {
  // สายเดิม: 1=ก(04:00) 2=ข(04:20) 3=ค(05:00)
  const prevStopTimes = [
    { seq: 1, atMin: 240 },
    { seq: 2, atMin: 260 },
    { seq: 3, atMin: 300 },
  ];
  // แก้จากฟอร์ม: เอา ค มาไว้หน้า, ลบ ข, เพิ่ม "ใหม่" ต่อท้าย
  const drafts = [
    { prevSeq: 3, name: "ค", mode: "truck" as const },
    { prevSeq: 1, name: "ก", mode: "truck" as const },
    { prevSeq: null, name: "ใหม่", mode: "walk" as const },
  ];

  const stops = assignSeq(drafts);
  const times = remapStopTimes(buildSeqMap(drafts), prevStopTimes);
  const atMinOf = (name: string) => {
    const stop = stops.find((s) => s.name === name);
    return times.find((t) => t.seq === stop?.seq)?.atMin ?? null;
  };

  it("จุด ก ที่เคยมีเวลา 04:00 ยังถือเวลา 04:00 ที่ตำแหน่งใหม่", () => {
    expect(stops.find((s) => s.name === "ก")?.seq).toBe(2); // ย้ายจากที่ 1 ไปที่ 2
    expect(atMinOf("ก")).toBe(240);
  });

  it("จุด ค ที่ถูกเลื่อนมาหน้าสุด พาเวลา 05:00 ของตัวเองมาด้วย", () => {
    expect(stops.find((s) => s.name === "ค")?.seq).toBe(1);
    expect(atMinOf("ค")).toBe(300);
  });

  it("จุดที่เพิ่มใหม่ยังไม่มีเวลา และเวลาของจุดที่ถูกลบหายไปด้วย", () => {
    expect(stops.find((s) => s.name === "ใหม่")?.seq).toBe(3);
    expect(atMinOf("ใหม่")).toBeNull();
    expect(times).toHaveLength(2); // เวลาของ ข ที่ถูกลบไม่เหลือค้าง
  });

  it("seq ของ stops กับ stopTimes อ้างถึงจุดเดียวกัน (ไม่มีเวลาลอยไปจุดผิด)", () => {
    // เวลาที่ออกมาต้องชี้ไปยัง seq ที่มีอยู่จริงในสายใหม่เสมอ
    const validSeqs = new Set(stops.map((s) => s.seq));
    expect(times.every((t) => validSeqs.has(t.seq))).toBe(true);
    expect(times).toEqual([
      { seq: 1, atMin: 300 }, // ค
      { seq: 2, atMin: 240 }, // ก
    ]);
  });
});
