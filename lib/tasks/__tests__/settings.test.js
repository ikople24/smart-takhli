// เทสต์การตั้งค่า SLA ต่อประเภทเรื่อง — ค่าที่อ่านจาก Mongo (task_settings) ต้องถูกทำความสะอาดก่อนใช้
// ทุกอย่างเป็น logic ล้วน ไม่มี I/O
import { describe, it, expect } from "vitest";
import { DEFAULT_TASK_SETTINGS, normalizeTaskSettings, slaDaysFor } from "../settings";

describe("DEFAULT_TASK_SETTINGS — ค่าตั้งต้นตรงกับที่ README/ดีไซน์อ้างถึง", () => {
  it("SLA 7 วัน (ตรงกับ hardcode เดิม), เตือนก่อน 2 วัน, ค้างรับ amber 3 / แดง >4, ติดตามทุก 7 วัน", () => {
    expect(DEFAULT_TASK_SETTINGS).toMatchObject({
      defaultSlaDays: 7,
      warnBeforeDays: 2,
      unclaimedWarnDays: 3,
      unclaimedAlertDays: 4,
      followUpEveryDays: 7,
      slaByCategory: [],
    });
  });
});

describe("normalizeTaskSettings — เติมค่า default และกันค่าเพี้ยน", () => {
  it("ไม่มีเอกสาร (null/undefined) → ได้ default ทั้งชุด", () => {
    expect(normalizeTaskSettings(null)).toEqual(DEFAULT_TASK_SETTINGS);
    expect(normalizeTaskSettings(undefined)).toEqual(DEFAULT_TASK_SETTINGS);
  });

  it("ตัวเลขที่มาเป็น string ถูกแปลง และ warnBeforeDays อนุญาตให้เป็น 0", () => {
    const s = normalizeTaskSettings({ defaultSlaDays: "10", warnBeforeDays: 0, unclaimedAlertDays: "6" });
    expect(s.defaultSlaDays).toBe(10);
    expect(s.warnBeforeDays).toBe(0);
    expect(s.unclaimedAlertDays).toBe(6);
  });

  it("ค่าติดลบ / NaN / ไม่ใช่ตัวเลข → กลับไปใช้ default ของฟิลด์นั้น", () => {
    const s = normalizeTaskSettings({ defaultSlaDays: -3, warnBeforeDays: "abc", followUpEveryDays: 0 });
    expect(s.defaultSlaDays).toBe(7);
    expect(s.warnBeforeDays).toBe(2);
    expect(s.followUpEveryDays).toBe(7); // ต้อง ≥ 1
  });

  it("slaByCategory: ตัดช่องว่างชื่อประเภท, ทิ้งแถวไม่มีชื่อ/slaDays ไม่ถูกต้อง, ชื่อซ้ำเอาแถวหลังสุด", () => {
    const s = normalizeTaskSettings({
      slaByCategory: [
        { category: " ไฟฟ้าส่องสว่าง ", slaDays: "3" },
        { category: "", slaDays: 5 },
        { category: "ถนน", slaDays: 0 },
        { category: "น้ำประปา", slaDays: 2.7 },
        { category: "ไฟฟ้าส่องสว่าง", slaDays: 4 },
        null,
      ],
    });
    expect(s.slaByCategory).toEqual([
      { category: "ไฟฟ้าส่องสว่าง", slaDays: 4 },
      { category: "น้ำประปา", slaDays: 2 },
    ]);
  });

  it("ฟิลด์แปลกปลอมจากเอกสาร Mongo (_id, key, updatedBy) ไม่หลุดออกมา", () => {
    const s = normalizeTaskSettings({ _id: "x", key: "default", updatedBy: "u1", defaultSlaDays: 5 });
    expect(Object.keys(s).sort()).toEqual(Object.keys(DEFAULT_TASK_SETTINGS).sort());
  });
});

describe("slaDaysFor — SLA ของประเภทเรื่อง", () => {
  const settings = normalizeTaskSettings({
    defaultSlaDays: 7,
    slaByCategory: [{ category: "ไฟฟ้าส่องสว่าง", slaDays: 3 }],
  });

  it("ประเภทที่ตั้งค่าไว้ได้ค่านั้น (ทนช่องว่างหัวท้าย)", () => {
    expect(slaDaysFor("ไฟฟ้าส่องสว่าง", settings)).toBe(3);
    expect(slaDaysFor("  ไฟฟ้าส่องสว่าง ", settings)).toBe(3);
  });

  it("ประเภทที่ไม่ได้ตั้ง / ไม่มีประเภท → defaultSlaDays", () => {
    expect(slaDaysFor("ขยะมูลฝอย", settings)).toBe(7);
    expect(slaDaysFor(undefined, settings)).toBe(7);
    expect(slaDaysFor(null, settings)).toBe(7);
  });

  it("ไม่ส่ง settings มาเลย → ใช้ default 7", () => {
    expect(slaDaysFor("อะไรก็ได้")).toBe(7);
  });
});
