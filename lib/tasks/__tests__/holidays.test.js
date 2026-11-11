// เทสต์วันหยุดราชการวันที่ตายตัว + ทำความสะอาดรายการวันหยุด
import { describe, it, expect } from "vitest";
import { MAX_HOLIDAYS, FIXED_THAI_HOLIDAYS, beToCe, fixedHolidaysForBeYear, normalizeHolidays, mergeHolidays } from "../holidays";

describe("fixedHolidaysForBeYear", () => {
  it("พ.ศ. 2570 → ค.ศ. 2027 ครบ 14 วัน เรียงตามวันที่", () => {
    const list = fixedHolidaysForBeYear(2570);
    expect(beToCe(2570)).toBe(2027);
    expect(list).toHaveLength(FIXED_THAI_HOLIDAYS.length);
    expect(list.map((h) => h.date)).toEqual([
      "2027-01-01",
      "2027-04-06",
      "2027-04-13",
      "2027-04-14",
      "2027-04-15",
      "2027-05-04",
      "2027-06-03",
      "2027-07-28",
      "2027-08-12",
      "2027-10-13",
      "2027-10-23",
      "2027-12-05",
      "2027-12-10",
      "2027-12-31",
    ]);
    expect(list[0].name).toBe("วันขึ้นปีใหม่");
  });

  it("ไม่มีวันหยุดทางจันทรคติ", () => {
    const names = fixedHolidaysForBeYear(2570).map((h) => h.name).join(" ");
    expect(names).not.toMatch(/บูชา|เข้าพรรษา|ชดเชย/);
  });

  it("ปีเพี้ยน → []", () => {
    expect(fixedHolidaysForBeYear("abc")).toEqual([]);
    expect(fixedHolidaysForBeYear(2570.5)).toEqual([]);
    expect(fixedHolidaysForBeYear(100)).toEqual([]);
  });
});

describe("normalizeHolidays", () => {
  it("ตัดแถวเพี้ยน ตัดช่องว่างชื่อ วันซ้ำ = แถวหลังทับ เรียงตามวันที่", () => {
    expect(
      normalizeHolidays([
        { date: "2027-05-04", name: " ฉัตรมงคล " },
        { date: "2027-01-01", name: "ปีใหม่" },
        { date: "2027-02-30", name: "ไม่มีจริง" },
        { date: "", name: "ว่าง" },
        null,
        "2027-03-01",
        { date: "2027-01-01", name: "ขึ้นปีใหม่" },
      ])
    ).toEqual([
      { date: "2027-01-01", name: "ขึ้นปีใหม่" },
      { date: "2027-03-01", name: "" },
      { date: "2027-05-04", name: "ฉัตรมงคล" },
    ]);
  });

  it("ไม่ใช่อาร์เรย์ → [] · ชื่อยาวตัดที่ 100", () => {
    expect(normalizeHolidays(undefined)).toEqual([]);
    expect(normalizeHolidays([{ date: "2027-01-01", name: "ก".repeat(150) }])[0].name).toHaveLength(100);
  });
});

describe("normalizeHolidays — เพดาน 500 วัน", () => {
  it("เกินเพดาน → เก็บวันล่าสุด 500 วัน", () => {
    const many = [];
    for (let i = 0; i < 700; i += 1) many.push({ date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10) });
    const out = normalizeHolidays(many);
    expect(MAX_HOLIDAYS).toBe(500);
    expect(out).toHaveLength(500);
    expect(out[out.length - 1].date).toBe(many[699].date);
    expect(out[0].date).toBe(many[200].date);
  });
});

describe("mergeHolidays", () => {
  it("เติมเฉพาะวันที่ยังไม่มี — ชื่อที่ตั้งเองไม่ถูกทับ", () => {
    const current = [{ date: "2027-01-01", name: "ปีใหม่ (ตั้งเอง)" }, { date: "2027-02-21", name: "มาฆบูชา" }];
    const { holidays, added } = mergeHolidays(current, fixedHolidaysForBeYear(2570));
    expect(added).toBe(13);
    expect(holidays).toHaveLength(15);
    expect(holidays[0]).toEqual({ date: "2027-01-01", name: "ปีใหม่ (ตั้งเอง)" });
    expect(holidays[1].date).toBe("2027-02-21");
    expect(mergeHolidays(holidays, fixedHolidaysForBeYear(2570)).added).toBe(0);
  });
});
