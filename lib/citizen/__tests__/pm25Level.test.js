// lib/citizen/__tests__/pm25Level.test.js
import { describe, it, expect } from "vitest";
import { pm25Level } from "../pm25Level";

describe("pm25Level", () => {
  it("ค่าว่าง/0/ไม่ใช่ตัวเลข = ไม่มีข้อมูล", () => {
    expect(pm25Level(null).key).toBe("none");
    expect(pm25Level(0).key).toBe("none");
    expect(pm25Level("abc").key).toBe("none");
    expect(pm25Level(undefined).label).toBe("ไม่มีข้อมูล");
  });
  it("เกณฑ์ตรงกับ getPm25LevelInfo เดิม (ขอบเขตรวมค่าบน)", () => {
    expect(pm25Level(15).key).toBe("verygood");
    expect(pm25Level(15.1).key).toBe("good");
    expect(pm25Level(25).key).toBe("good");
    expect(pm25Level(25.1).key).toBe("moderate");
    expect(pm25Level(37.5).key).toBe("moderate");
    expect(pm25Level(37.6).key).toBe("unhealthy");
    expect(pm25Level(75).key).toBe("unhealthy");
    expect(pm25Level(75.1).key).toBe("hazardous");
  });
  it("รับค่า string ได้เหมือนของเดิม (latest.pm25 เป็น string)", () => {
    expect(pm25Level("30").label).toBe("ปานกลาง");
    expect(pm25Level("38").label).toBe("มีผลต่อสุขภาพ");
  });
  it("ทุกระดับมี label/chipBg/chipText/dot ครบ", () => {
    for (const v of [null, 10, 20, 30, 50, 100]) {
      const lv = pm25Level(v);
      expect(lv.label).toBeTruthy();
      expect(lv.chipBg).toMatch(/^#/);
      expect(lv.chipText).toMatch(/^#/);
      expect(lv.dot).toMatch(/^#/);
    }
  });
});
