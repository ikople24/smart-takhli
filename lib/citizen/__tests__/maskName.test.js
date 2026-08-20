// lib/citizen/__tests__/maskName.test.js
import { describe, it, expect } from "vitest";
import { maskOfficerName } from "../maskName";

describe("maskOfficerName — ปิดนามสกุลเจ้าหน้าที่ (ตามแคนวาส 'นายวิชัย xxxxxx')", () => {
  it("เก็บคำแรก ปิดส่วนที่เหลือเป็น xxxxxx เดียว", () => {
    expect(maskOfficerName("วิชัย ใจดี")).toBe("วิชัย xxxxxx");
    expect(maskOfficerName("นายวิชัย ใจดี มากมาย")).toBe("นายวิชัย xxxxxx");
  });
  it("ชื่อคำเดียว/username ไม่มีอะไรต้องปิด", () => {
    expect(maskOfficerName("smart-takhli")).toBe("smart-takhli");
  });
  it("ค่าว่าง/undefined คืนค่าว่าง", () => {
    expect(maskOfficerName("")).toBe("");
    expect(maskOfficerName(undefined)).toBe("");
    expect(maskOfficerName("   ")).toBe("");
  });
});
