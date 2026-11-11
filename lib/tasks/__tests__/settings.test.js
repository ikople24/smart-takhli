// เทสต์การตั้งค่า SLA ต่อประเภทเรื่อง — ค่าที่อ่านจาก Mongo (task_settings) ต้องถูกทำความสะอาดก่อนใช้
// ทุกอย่างเป็น logic ล้วน ไม่มี I/O
import { describe, it, expect } from "vitest";
import { DEFAULT_TASK_SETTINGS, normalizeTaskSettings, slaDaysFor, resolveSla } from "../settings";

describe("DEFAULT_TASK_SETTINGS — ค่าตั้งต้นตรงกับที่ README/ดีไซน์อ้างถึง", () => {
  it("มติประชุม 10/11/69: งานทั่วไป 3 วัน, รอรับ amber ≥12 ชม. / แดง >24 ชม., เตือนก่อน 2 วัน, ติดตามทุก 7 วัน", () => {
    expect(DEFAULT_TASK_SETTINGS).toMatchObject({
      defaultSlaDays: 3,
      warnBeforeDays: 2,
      unclaimedWarnHours: 12,
      unclaimedAlertHours: 24,
      followUpEveryDays: 7,
      slaByCategory: [],
      slaByWorkType: [],
    });
  });
  it("ฟิลด์วันแบบเดิม (unclaimedWarnDays/AlertDays) ยังอยู่ในรูปทรงเพื่อความเข้ากันได้", () => {
    expect(DEFAULT_TASK_SETTINGS).toMatchObject({ unclaimedWarnDays: 3, unclaimedAlertDays: 4 });
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
    expect(s.defaultSlaDays).toBe(3);
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

describe("normalizeTaskSettings — ชั่วโมงรอรับ + slaByWorkType", () => {
  it("ชั่วโมง: string แปลงได้, warn รับ 0, alert ต้อง ≥ 1 ไม่งั้นกลับไป default", () => {
    expect(normalizeTaskSettings({ unclaimedWarnHours: "0", unclaimedAlertHours: "48" })).toMatchObject({ unclaimedWarnHours: 0, unclaimedAlertHours: 48 });
    expect(normalizeTaskSettings({ unclaimedWarnHours: -1, unclaimedAlertHours: 0 })).toMatchObject({ unclaimedWarnHours: 12, unclaimedAlertHours: 24 });
  });

  it("unclaimedWarnHours เกิน unclaimedAlertHours → ปรับลงมาเท่า alert", () => {
    expect(normalizeTaskSettings({ unclaimedWarnHours: 30, unclaimedAlertHours: 24 })).toMatchObject({ unclaimedWarnHours: 24, unclaimedAlertHours: 24 });
    expect(normalizeTaskSettings({ unclaimedAlertHours: 6 })).toMatchObject({ unclaimedWarnHours: 6, unclaimedAlertHours: 6 });
    expect(normalizeTaskSettings({ unclaimedWarnHours: 5, unclaimedAlertHours: 6 })).toMatchObject({ unclaimedWarnHours: 5 });
  });

  it("slaByWorkType: ทิ้ง key ที่ไม่อยู่ในทะเบียน / slaDays ไม่ถูกต้อง, ซ้ำเอาแถวหลังสุด", () => {
    const s = normalizeTaskSettings({
      slaByWorkType: [
        { workType: " tree ", slaDays: "10" },
        { workType: "ไม่มีจริง", slaDays: 5 },
        { workType: "grass", slaDays: 0 },
        { workType: "road_patch", slaDays: 20.9 },
        { workType: "tree", slaDays: 12 },
        null,
      ],
    });
    expect(s.slaByWorkType).toEqual([
      { workType: "tree", slaDays: 12 },
      { workType: "road_patch", slaDays: 20 },
    ]);
  });
});

describe("resolveSla — SLA ตามชนิดงาน (ลำดับความสำคัญ)", () => {
  const tree = { problems: ["กิ่งไม้ล้ำถนน"], category: "ไฟฟ้าส่องสว่าง" };
  const general = { problems: ["ไฟดับ"], category: "ไฟฟ้าส่องสว่าง" };

  it("ไม่มีค่าตั้ง → ทะเบียนชนิดงาน (กิ่งไม้ 15 วัน) / งานทั่วไป = defaultSlaDays 3", () => {
    expect(resolveSla(tree)).toEqual({ slaDays: 15, workType: "tree" });
    expect(resolveSla(general)).toEqual({ slaDays: 3, workType: "general" });
    expect(resolveSla(null)).toEqual({ slaDays: 3, workType: "general" });
  });

  it("Mongoose document (มี toObject) → ใช้ object ที่แปลงแล้ว", () => {
    const doc = { toObject: () => ({ problems: ["กิ่งไม้ล้ำถนน"] }) };
    expect(resolveSla(doc)).toEqual({ slaDays: 15, workType: "tree" });
  });

  it("slaByWorkType ชนะทุกกฎ (รวมถึง slaByCategory)", () => {
    const s = normalizeTaskSettings({
      slaByWorkType: [{ workType: "tree", slaDays: 9 }, { workType: "general", slaDays: 2 }],
      slaByCategory: [{ category: "ไฟฟ้าส่องสว่าง", slaDays: 5 }],
    });
    expect(resolveSla(tree, s).slaDays).toBe(9);
    expect(resolveSla(general, s).slaDays).toBe(2);
  });

  it("slaByCategory ใช้กับงานทั่วไปเท่านั้น — ไม่ทับชนิดงานเฉพาะ", () => {
    const s = normalizeTaskSettings({ slaByCategory: [{ category: "ไฟฟ้าส่องสว่าง", slaDays: 5 }] });
    expect(resolveSla(general, s).slaDays).toBe(5);
    expect(resolveSla(tree, s).slaDays).toBe(15);
  });

  it("defaultSlaDays ที่ตั้งเองมีผลกับงานทั่วไป ไม่มีผลกับชนิดงานอื่น", () => {
    const s = normalizeTaskSettings({ defaultSlaDays: 4 });
    expect(resolveSla(general, s).slaDays).toBe(4);
    expect(resolveSla({ problems: ["ผิวจราจรเป็นหลุม"] }, s)).toEqual({ slaDays: 30, workType: "road_patch" });
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

  it("ไม่ส่ง settings มาเลย → ใช้ default 3 (มติประชุม 10/11/69)", () => {
    expect(slaDaysFor("อะไรก็ได้")).toBe(3);
  });
});

describe("normalizeTaskSettings — วันหยุดราชการ (holidays)", () => {
  it("ไม่มี → [] · ตรวจรูปแบบวันที่ ตัดซ้ำ เรียงตามวันที่", () => {
    expect(normalizeTaskSettings(null).holidays).toEqual([]);
    expect(DEFAULT_TASK_SETTINGS.holidays).toEqual([]);
    const s = normalizeTaskSettings({
      holidays: [
        { date: "2027-12-10", name: "วันรัฐธรรมนูญ" },
        { date: "2027-01-01", name: "ปีใหม่" },
        { date: "10/12/2027", name: "รูปแบบผิด" },
        { date: "2027-01-01", name: "วันขึ้นปีใหม่" },
      ],
    });
    expect(s.holidays).toEqual([
      { date: "2027-01-01", name: "วันขึ้นปีใหม่" },
      { date: "2027-12-10", name: "วันรัฐธรรมนูญ" },
    ]);
  });
});

describe("grassSchedule — ตารางคิวตัดหญ้า", () => {
  it("ค่าตั้งต้น = ยังไม่มีตาราง", () => {
    expect(DEFAULT_TASK_SETTINGS.grassSchedule).toEqual({ url: "", fileName: "", updatedAt: null });
    expect(normalizeTaskSettings({}).grassSchedule).toEqual({ url: "", fileName: "", updatedAt: null });
  });
  it("รับเฉพาะ https — http ถูกล้างเป็นค่าว่าง", () => {
    const ok = normalizeTaskSettings({ grassSchedule: { url: "https://res.cloudinary.com/x/raw/upload/q.pdf", fileName: "q.pdf", updatedAt: "2026-11-10T03:00:00Z" } });
    expect(ok.grassSchedule).toEqual({ url: "https://res.cloudinary.com/x/raw/upload/q.pdf", fileName: "q.pdf", updatedAt: "2026-11-10T03:00:00.000Z" });
    const bad = normalizeTaskSettings({ grassSchedule: { url: "http://evil.example/q.pdf", fileName: "q.pdf" } });
    expect(bad.grassSchedule).toEqual({ url: "", fileName: "", updatedAt: null });
  });
});
