// lib/citizen/__tests__/waterLevel.test.js
import { describe, it, expect } from "vitest";
import { waterLevel } from "../waterLevel";

describe("waterLevel", () => {
  it("ค่าว่าง/ไม่ใช่ตัวเลข = ไม่มีข้อมูล", () => {
    expect(waterLevel(null).key).toBe("none");
    expect(waterLevel(undefined).key).toBe("none");
    expect(waterLevel("abc").label).toBe("ไม่มีข้อมูล");
  });
  it("เกณฑ์ตรงกับ getNtuInfo เดิม", () => {
    expect(waterLevel(0).key).toBe("ok");
    expect(waterLevel(4.99).key).toBe("ok");
    expect(waterLevel(5).key).toBe("watch");
    expect(waterLevel(15).key).toBe("watch");
    expect(waterLevel(15.1).key).toBe("sediment");
    expect(waterLevel(20).key).toBe("sediment");
    expect(waterLevel(20.1).key).toBe("turbid");
  });
  it("ป้ายไทยถูกต้อง", () => {
    expect(waterLevel(2).label).toBe("ปกติ");
    expect(waterLevel(10).label).toBe("เฝ้าระวัง");
    expect(waterLevel(18).label).toBe("ตะกอนเล็กน้อย");
    expect(waterLevel(25).label).toBe("เริ่มขุ่น");
  });
  it("ทุกระดับมีสีครบ", () => {
    for (const v of [null, 2, 10, 18, 25]) {
      const lv = waterLevel(v);
      expect(lv.chipBg).toMatch(/^#/);
      expect(lv.chipText).toMatch(/^#/);
      expect(lv.dot).toMatch(/^#/);
    }
  });
});
