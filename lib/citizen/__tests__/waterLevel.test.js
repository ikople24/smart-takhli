// lib/citizen/__tests__/waterLevel.test.js
import { describe, it, expect } from "vitest";
import { waterLevel, ntuShade } from "../waterLevel";

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
    expect(waterLevel(2).label).toBe("น้ำใส (ปกติ)");
    expect(waterLevel(10).label).toBe("เฝ้าระวัง");
    expect(waterLevel(18).label).toBe("ตะกอนเล็กน้อย");
    expect(waterLevel(25).label).toBe("เริ่มขุ่น");
  });
  it("ชุดสีน้ำไม่เหมือน PM2.5 — เคสปกติเป็นน้ำเงิน (ตาม WaterQualityCard เดิม)", () => {
    expect(waterLevel(2).chipText).toBe("#2563EB");
    expect(waterLevel(2).chipText).not.toBe(waterLevel(2).chipBg);
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

describe("ntuShade (badge ในตาราง ไล่สีตามค่า)", () => {
  it("ช่วงน้ำใส (< 5): ฟ้าอ่อน → ฟ้าเข้มขึ้นตามค่า", () => {
    const low = ntuShade(0.5);
    const high = ntuShade(4.8);
    expect(low.bg).not.toBe(high.bg);
    expect(low.key).toBe("ok");
    expect(high.key).toBe("ok");
  });

  it("ช่วงอื่นใช้สีเดียวกับ waterLevel", () => {
    for (const v of [8, 17, 30]) {
      const lv = waterLevel(v);
      expect(ntuShade(v)).toEqual({ key: lv.key, bg: lv.chipBg, text: lv.chipText });
    }
  });

  it("ไม่มีค่า → none", () => {
    expect(ntuShade(null).key).toBe("none");
  });
});
