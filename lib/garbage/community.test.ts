import { describe, it, expect } from "vitest";
import { normalizePlaceName, pickCommunity } from "./community";

describe("normalizePlaceName", () => {
  it("ตัดคำนำหน้าถนน/ซอย/ชุมชนออก", () => {
    expect(normalizePlaceName("ถนนมาลัย")).toBe(normalizePlaceName("มาลัย"));
    expect(normalizePlaceName("ถ.มาลัย")).toBe(normalizePlaceName("มาลัย"));
    expect(normalizePlaceName("ซอยมาลัย")).toBe(normalizePlaceName("มาลัย"));
    expect(normalizePlaceName("ซ.มาลัย")).toBe(normalizePlaceName("มาลัย"));
    expect(normalizePlaceName("ชุมชนมาลัย")).toBe(normalizePlaceName("มาลัย"));
  });

  it("ตัดช่องว่างและแปลงเป็นตัวพิมพ์เล็ก", () => {
    expect(normalizePlaceName("  ซ.เจ้าเงาะ 5  ")).toBe(normalizePlaceName("เจ้าเงาะ5"));
    expect(normalizePlaceName("ABC")).toBe(normalizePlaceName("abc"));
  });

  it("ตัดคำนำหน้าแค่ชั้นเดียว ไม่กินชื่อจริง", () => {
    // "ซอยซ่อนกลิ่น" ตัด "ซอย" แล้วต้องเหลือ "ซ่อนกลิ่น" ไม่ใช่ตัดซ้ำจนเหลือ "อนกลิ่น"
    expect(normalizePlaceName("ซอยซ่อนกลิ่น")).toBe(normalizePlaceName("ซ่อนกลิ่น"));
  });

  it("รับค่าว่างได้", () => {
    expect(normalizePlaceName("")).toBe("");
    expect(normalizePlaceName(null)).toBe("");
  });
});

describe("pickCommunity", () => {
  it("ไม่มี polygon ตรงเลย = null", () => {
    expect(pickCommunity([])).toBeNull();
  });

  it("ตรงอันเดียว = อันนั้น", () => {
    expect(pickCommunity([{ name: "มาลัย" }])).toBe("มาลัย");
  });

  it("ซ้อนกันหลายอัน = เลือกแบบกำหนดแน่นอน (เรียงชื่อแล้วเอาตัวแรก)", () => {
    // จุดที่ตกในพื้นที่ทับซ้อนต้องได้คำตอบเดิมทุกครั้ง ไม่ขึ้นกับลำดับที่ DB คืนมา
    expect(pickCommunity([{ name: "รจนา" }, { name: "มาลัย" }])).toBe("มาลัย");
    expect(pickCommunity([{ name: "มาลัย" }, { name: "รจนา" }])).toBe("มาลัย");
  });
});
