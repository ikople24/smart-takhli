// เทสต์การนับวันทำการ (จ.–ศ. ไม่รวมวันหยุด) ตามเวลาไทย — ต้องผ่านทั้ง TZ เครื่อง และ TZ=UTC (เซิร์ฟเวอร์ Railway)
import { describe, it, expect } from "vitest";
import {
  SLA_COUNT_MODE,
  isValidDateKey,
  isBusinessDay,
  toHolidaySet,
  endOfBangkokDay,
  addBusinessDays,
  businessDaysBetween,
  businessDaysToDue,
  pauseBusinessDays,
  closedPauseBusinessDays,
  shiftDueByBusinessDays,
} from "../businessDays";

// เวลาไทย → instant (+07:00) — ไม่ขึ้นกับ TZ เครื่อง
const bkk = (s) => new Date(`${s}+07:00`);
// สิ้นวันไทยในรูป ISO
const eod = (d) => new Date(`${d}T23:59:59.999+07:00`).toISOString();

// พ.ย. 2569: 9 จ. · 10 อ. · 11 พ. · 12 พฤ. · 13 ศ. · 14 ส. · 15 อา. · 16 จ.
describe("isValidDateKey / isBusinessDay", () => {
  it("รูปแบบต้องเป็น YYYY-MM-DD และเป็นวันที่มีจริง", () => {
    expect(isValidDateKey("2026-11-11")).toBe(true);
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("2026-1-1")).toBe(false);
    expect(isValidDateKey(null)).toBe(false);
  });

  it("จันทร์–ศุกร์เป็นวันทำการ · เสาร์อาทิตย์ไม่ใช่ · วันหยุดไม่ใช่", () => {
    expect(isBusinessDay("2026-11-13")).toBe(true); // ศุกร์
    expect(isBusinessDay("2026-11-14")).toBe(false); // เสาร์
    expect(isBusinessDay("2026-11-15")).toBe(false); // อาทิตย์
    expect(isBusinessDay("2026-12-10", [{ date: "2026-12-10", name: "วันรัฐธรรมนูญ" }])).toBe(false);
    expect(isBusinessDay("2026-12-10", new Set(["2026-12-10"]))).toBe(false);
    expect(isBusinessDay("2026-12-10", ["2026-12-10"])).toBe(false);
    expect(isBusinessDay("bad")).toBe(false);
  });

  it("toHolidaySet ข้ามแถวเพี้ยน และแคชตามอาร์เรย์เดิม", () => {
    const list = [{ date: "2026-12-10" }, { date: "xx" }, "2026-12-31", null];
    const s = toHolidaySet(list);
    expect([...s]).toEqual(["2026-12-10", "2026-12-31"]);
    expect(toHolidaySet(list)).toBe(s);
    expect(toHolidaySet(undefined).size).toBe(0);
  });

  it("SLA_COUNT_MODE = business (ตายตัว)", () => {
    expect(SLA_COUNT_MODE).toBe("business");
  });
});

describe("endOfBangkokDay", () => {
  it("23:59:59.999 เวลาไทย = 16:59:59.999Z", () => {
    expect(endOfBangkokDay("2026-11-13").toISOString()).toBe("2026-11-13T16:59:59.999Z");
    expect(endOfBangkokDay("nope")).toBeNull();
  });
});

describe("addBusinessDays — เส้นตาย = สิ้นวันของวันทำการที่ n หลังวันแจ้ง", () => {
  it("แจ้งพุธ SLA 3 → พฤ(1) ศ(2) จ(3) → สิ้นวันจันทร์", () => {
    expect(addBusinessDays(bkk("2026-11-11T10:00:00"), 3).toISOString()).toBe(eod("2026-11-16"));
  });

  it("แจ้งศุกร์ SLA 1 → จันทร์ · SLA 3 → พุธ", () => {
    expect(addBusinessDays(bkk("2026-11-13T09:00:00"), 1).toISOString()).toBe(eod("2026-11-16"));
    expect(addBusinessDays(bkk("2026-11-13T09:00:00"), 3).toISOString()).toBe(eod("2026-11-18"));
  });

  it("แจ้งเสาร์/อาทิตย์ → เริ่มนับจากจันทร์ (จันทร์ = วันที่ 1)", () => {
    expect(addBusinessDays(bkk("2026-11-14T10:00:00"), 1).toISOString()).toBe(eod("2026-11-16"));
    expect(addBusinessDays(bkk("2026-11-15T22:00:00"), 3).toISOString()).toBe(eod("2026-11-18"));
  });

  it("ใช้วันไทย ไม่ใช่วัน UTC — แจ้ง 23:30 ศุกร์ไทย (= 16:30Z ศุกร์) · แจ้ง 06:00 จันทร์ไทย (= 23:00Z อาทิตย์)", () => {
    expect(addBusinessDays(bkk("2026-11-13T23:30:00"), 1).toISOString()).toBe(eod("2026-11-16"));
    // 06:00 จันทร์ไทย: วันแจ้ง = จันทร์ (ไม่นับ) → อังคาร
    expect(addBusinessDays(new Date("2026-11-15T23:00:00Z"), 1).toISOString()).toBe(eod("2026-11-17"));
  });

  it("ข้ามวันหยุดราชการ — แจ้ง 3 ธ.ค. (พฤ) SLA 3: 4 ศ. (1) · 5–6 ส.อา. · 7 จ. (2) · 8 อ. (3)", () => {
    expect(addBusinessDays(bkk("2026-12-03T10:00:00"), 3).toISOString()).toBe(eod("2026-12-08"));
    // 7 ธ.ค. เป็นวันหยุดชดเชย (ตั้งเอง) → เลื่อนไป 9 ธ.ค.
    const hol = [{ date: "2026-12-05", name: "วันพ่อ" }, { date: "2026-12-07", name: "ชดเชย" }];
    expect(addBusinessDays(bkk("2026-12-03T10:00:00"), 3, hol).toISOString()).toBe(eod("2026-12-09"));
  });

  it("สงกรานต์ 13–15 เม.ย. 2569 (จ.–พ.) แจ้ง 10 เม.ย. (ศ.) SLA 3 → 16 (1) 17 (2) 20 (3)", () => {
    const hol = ["2026-04-13", "2026-04-14", "2026-04-15"];
    expect(addBusinessDays(bkk("2026-04-10T10:00:00"), 3, hol).toISOString()).toBe(eod("2026-04-20"));
  });

  it("ข้ามปี: แจ้ง 30 ธ.ค. 2569 (พ.) หยุด 31 ธ.ค. + 1 ม.ค. SLA 2 → 2–3 ม.ค. เสาร์อาทิตย์ → 4 (1) 5 (2)", () => {
    const hol = ["2026-12-31", "2027-01-01"];
    expect(addBusinessDays(bkk("2026-12-30T10:00:00"), 2, hol).toISOString()).toBe(eod("2027-01-05"));
  });

  it("SLA 30 วันทำการ = 6 สัปดาห์เต็มเมื่อไม่มีวันหยุด", () => {
    expect(addBusinessDays(bkk("2026-11-11T10:00:00"), 30).toISOString()).toBe(eod("2026-12-23"));
  });

  it("n ≤ 0 → สิ้นวันแจ้ง · ค่าเพี้ยน → null", () => {
    expect(addBusinessDays(bkk("2026-11-14T10:00:00"), 0).toISOString()).toBe(eod("2026-11-14"));
    expect(addBusinessDays(null, 3)).toBeNull();
    expect(addBusinessDays("not a date", 3)).toBeNull();
  });

  it("วันหยุดเพี้ยนทั้งช่วงไม่ทำให้ลูปค้าง", () => {
    const all = [];
    for (let i = 0; i < 800; i += 1) all.push(new Date(Date.UTC(2026, 10, 12 + i)).toISOString().slice(0, 10));
    expect(addBusinessDays(bkk("2026-11-11T10:00:00"), 1, all)).toBeInstanceOf(Date);
  });
});

describe("businessDaysBetween — นับวันทำการใน (from, to] มีเครื่องหมาย", () => {
  it("วันเดียวกัน = 0 · ศุกร์ → จันทร์ = 1 · จันทร์ → ศุกร์ = 4 · ย้อนกลับติดลบ", () => {
    expect(businessDaysBetween(bkk("2026-11-13T08:00:00"), bkk("2026-11-13T20:00:00"))).toBe(0);
    expect(businessDaysBetween(bkk("2026-11-13T08:00:00"), bkk("2026-11-16T08:00:00"))).toBe(1);
    expect(businessDaysBetween(bkk("2026-11-09T08:00:00"), bkk("2026-11-13T08:00:00"))).toBe(4);
    expect(businessDaysBetween(bkk("2026-11-16T08:00:00"), bkk("2026-11-13T08:00:00"))).toBe(-1);
  });

  it("เสาร์ → อาทิตย์ = 0 · ศุกร์ → เสาร์ = 0", () => {
    expect(businessDaysBetween(bkk("2026-11-14T08:00:00"), bkk("2026-11-15T08:00:00"))).toBe(0);
    expect(businessDaysBetween(bkk("2026-11-13T08:00:00"), bkk("2026-11-14T08:00:00"))).toBe(0);
  });

  it("หักวันหยุดที่ตกวันธรรมดาเท่านั้น (วันหยุดวันเสาร์ไม่หักซ้ำ)", () => {
    const hol = ["2026-12-05", "2026-12-10"]; // ส. และ พฤ.
    // 1 ธ.ค. (อ.) → 11 ธ.ค. (ศ.): วันธรรมดา 8 วัน หัก 10 ธ.ค. = 7
    expect(businessDaysBetween(bkk("2026-12-01T10:00:00"), bkk("2026-12-11T10:00:00"), hol)).toBe(7);
    expect(businessDaysBetween(bkk("2026-12-11T10:00:00"), bkk("2026-12-01T10:00:00"), hol)).toBe(-7);
  });

  it("ช่วงยาว (สูตร) ตรงกับการวนนับทีละวัน", () => {
    const hol = ["2026-12-10", "2027-01-01", "2027-04-13"];
    const from = bkk("2026-10-01T10:00:00");
    let brute = 0;
    for (let i = 1; i <= 250; i += 1) {
      const key = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
      if (isBusinessDay(key, hol)) brute += 1;
      const to = new Date(`${key}T12:00:00+07:00`);
      expect(businessDaysBetween(from, to, hol)).toBe(brute);
    }
  });

  it("ใช้วันไทย — 23:30 ศุกร์ไทย → 00:30 เสาร์ไทย = 0 · 23:30 อาทิตย์ → 00:30 จันทร์ = 1", () => {
    expect(businessDaysBetween(bkk("2026-11-13T23:30:00"), bkk("2026-11-14T00:30:00"))).toBe(0);
    expect(businessDaysBetween(bkk("2026-11-15T23:30:00"), bkk("2026-11-16T00:30:00"))).toBe(1);
  });

  it("ค่าเพี้ยน → null", () => {
    expect(businessDaysBetween(null, new Date())).toBeNull();
  });
});

describe("businessDaysToDue — daysToDue ที่ UI แสดง", () => {
  const due = endOfBangkokDay("2026-11-13"); // ครบสิ้นวันศุกร์
  it("ก่อน/วันครบกำหนด ≥ 0", () => {
    expect(businessDaysToDue(bkk("2026-11-11T09:00:00"), due)).toBe(2);
    expect(businessDaysToDue(bkk("2026-11-13T23:00:00"), due)).toBe(0);
  });
  it("เลยกำหนดแล้วติดลบอย่างน้อย 1 แม้เป็นวันหยุด — เสาร์ = -1 · จันทร์ = -1 · อังคาร = -2", () => {
    expect(businessDaysToDue(bkk("2026-11-14T08:00:00"), due)).toBe(-1);
    expect(businessDaysToDue(bkk("2026-11-16T08:00:00"), due)).toBe(-1);
    expect(businessDaysToDue(bkk("2026-11-17T08:00:00"), due)).toBe(-2);
  });
  it("ตอนนี้เสาร์ ครบจันทร์ → 1", () => {
    expect(businessDaysToDue(bkk("2026-11-14T08:00:00"), endOfBangkokDay("2026-11-16"))).toBe(1);
  });
  it("ค่าเดิมที่บันทึกเป็นเวลากลางวัน — ตัดสินด้วยวันไทยเหมือนกัน", () => {
    expect(businessDaysToDue(bkk("2026-11-13T15:00:00"), bkk("2026-11-13T10:00:00"))).toBe(0);
  });
  it("ค่าเพี้ยน → null", () => {
    expect(businessDaysToDue(new Date(), null)).toBeNull();
  });
});

describe("ช่วงพัก SLA เป็นวันทำการ", () => {
  it("pauseBusinessDays: 1 นาที = 0 · ศ. 17:00 → จ. 09:00 = 1 · ศ. 23:59 → ส. 00:01 = 0 · ย้อนเวลา = 0", () => {
    expect(pauseBusinessDays(bkk("2026-11-11T10:00:00"), bkk("2026-11-11T10:01:00"))).toBe(0);
    expect(pauseBusinessDays(bkk("2026-11-13T17:00:00"), bkk("2026-11-16T09:00:00"))).toBe(1);
    expect(pauseBusinessDays(bkk("2026-11-13T23:59:00"), bkk("2026-11-14T00:01:00"))).toBe(0);
    expect(pauseBusinessDays(bkk("2026-11-16T09:00:00"), bkk("2026-11-13T17:00:00"))).toBe(0);
    expect(pauseBusinessDays(null, new Date())).toBe(0);
  });
  it("closedPauseBusinessDays: ค่าใหม่มาก่อน · ข้อมูลเก่า floor(ms/วัน) · ไม่มีเลย 0", () => {
    expect(closedPauseBusinessDays({ slaPausedBusinessDays: 2, slaPausedMs: 9e9 })).toBe(2);
    expect(closedPauseBusinessDays({ slaPausedBusinessDays: 0, slaPausedMs: 9e9 })).toBe(0);
    expect(closedPauseBusinessDays({ slaPausedBusinessDays: null, slaPausedMs: 1.99 * 86400000 })).toBe(1);
    expect(closedPauseBusinessDays({})).toBe(0);
  });
  it("shiftDueByBusinessDays: 0 = ค่าเดิม · > 0 = ยึดสิ้นวันไทย ข้ามเสาร์อาทิตย์", () => {
    const due = bkk("2026-11-13T10:00:00");
    expect(shiftDueByBusinessDays(due, 0)).toBe(due);
    expect(shiftDueByBusinessDays(due, 1).toISOString()).toBe(eod("2026-11-16"));
    expect(shiftDueByBusinessDays(null, 1)).toBeNull();
  });
});
