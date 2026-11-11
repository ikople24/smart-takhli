import { describe, it, expect } from "vitest";
import { WORK_TYPES, workTypeOf, detectWorkType, workTypeOptions } from "../workTypes.js";
import { DEPARTMENTS } from "../departments.js";

const c = (o) => ({ category: "", problems: [], detail: "", ...o });

describe("registry", () => {
  it("มี 8 ชนิด + กองตรงกับ departments.js", () => {
    expect(WORK_TYPES).toHaveLength(8);
    const names = DEPARTMENTS.map((d) => d.name);
    WORK_TYPES.forEach((w) => w.department && expect(names).toContain(w.department));
    expect(workTypeOf("road_patch").slaDays).toBe(30);
    expect(workTypeOf("road_patch").progressEveryDays).toBe(7);
    expect(workTypeOf("nope")).toBeNull();
    expect(workTypeOptions()[0]).toEqual({ key: "road_patch", label: "ปะถนน (ยางมะตอย)", slaDays: 30 });
  });
});

describe("detectWorkType", () => {
  it("แต่ละชนิด", () => {
    expect(detectWorkType(c({ problems: ["ผิวจราจรเป็นหลุม"] }))).toBe("road_patch");
    expect(detectWorkType(c({ category: "ถนน/ทางเท้า", detail: "มีหลุมใหญ่" }))).toBe("road_patch");
    expect(detectWorkType(c({ problems: ["รางระบายน้ำอุดตัน"] }))).toBe("drain_sludge");
    expect(detectWorkType(c({ detail: "ขอลอกท่อหน้าบ้าน" }))).toBe("drain_sludge");
    expect(detectWorkType(c({ problems: ["ฝาท่อชำรุด/สูญหาย"] }))).toBe("manhole_steel");
    expect(detectWorkType(c({ problems: ["ฝาท่อชำรุด/สูญหาย"], detail: "ฝาท่อปูนแตก" }))).toBe("manhole_concrete");
    expect(detectWorkType(c({ problems: ["กิ่งไม้ล้ำถนน"] }))).toBe("tree");
    expect(detectWorkType(c({ problems: ["ขอตัดต้นไม้ใหญ่"] }))).toBe("tree");
    expect(detectWorkType(c({ detail: "หญ้ารกริมทาง" }))).toBe("grass");
    expect(detectWorkType(c({ problems: ["กลิ่นรบกวน"] }))).toBe("nuisance");
    expect(detectWorkType(c({ problems: ["เสียงสัตว์รบกวน"] }))).toBe("nuisance");
    expect(detectWorkType(c({ category: "สัตว์เลี้ยง" }))).toBe("nuisance");
  });
  it("override", () => {
    expect(detectWorkType(c({ workType: "grass", problems: ["กิ่งไม้ล้ำถนน"] }))).toBe("grass");
    expect(detectWorkType(c({ workType: "bogus", problems: ["กิ่งไม้ล้ำถนน"] }))).toBe("tree");
  });
  it("เก็บกิ่งไม้ไม่ใช่ tree", () => {
    expect(detectWorkType(c({ detail: "ช่วยเก็บกิ่งไม้ด้วย" }))).toBe("general");
    expect(detectWorkType(c({ problems: ["ขยะล้นถัง"], detail: "ขยะกิ่งไม้ล้นถัง" }))).toBe("general");
  });
  it("general", () => {
    expect(detectWorkType(c({ category: "น้ำประปา", problems: ["ท่อแตก"] }))).toBe("general");
    expect(detectWorkType(c({ problems: ["น้ำรั่วซึม"] }))).toBe("general");
    expect(detectWorkType(c({ problems: ["ไฟไม่ติด"] }))).toBe("general");
    expect(detectWorkType(c({ problems: ["อื่นๆ(โปรดระบุ)"] }))).toBe("general");
  });
  it("tree ชนะ grass", () => {
    expect(detectWorkType(c({ problems: ["กิ่งไม้ล้ำถนน"], detail: "หญ้ารก" }))).toBe("tree");
  });
  it("ข้อมูลว่าง", () => {
    expect(detectWorkType(null)).toBe("general");
    expect(detectWorkType(undefined)).toBe("general");
    expect(detectWorkType({ problems: null, detail: null })).toBe("general");
  });
});
