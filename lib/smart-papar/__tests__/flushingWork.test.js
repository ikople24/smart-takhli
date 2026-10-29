import { describe, it, expect } from "vitest";
import { workGroupOf, groupWork, WORK_GROUPS, buildDueCalendar, fieldTaskOf } from "../flushingWork";

const it_ = (o) => ({ code: "X", bucket: "later", lastResult: "clear", lastTurbidCause: "", lastYmd: "2026-10-20", dueYmd: "2026-11-04", daysLeft: 6, ...o });

describe("workGroupOf", () => {
  it("ยังขุ่น → กลุ่มตามสาเหตุ", () => {
    expect(workGroupOf(it_({ lastResult: "still_turbid", lastTurbidCause: "more_flush", bucket: "upcoming" }))).toBe("reflush");
    expect(workGroupOf(it_({ lastResult: "still_turbid", lastTurbidCause: "damaged", bucket: "blocked" }))).toBe("repair");
    expect(workGroupOf(it_({ lastResult: "still_turbid", lastTurbidCause: "obstacle", bucket: "blocked" }))).toBe("clear_site");
    expect(workGroupOf(it_({ lastResult: "still_turbid", lastTurbidCause: "other", bucket: "overdue" }))).toBe("inspect");
    expect(workGroupOf(it_({ lastResult: "still_turbid", lastTurbidCause: "", bucket: "today" }))).toBe("inspect");
  });
  it("ใสแล้ว → ครบรอบประจำเฉพาะเลยกำหนด/วันนี้/7 วันข้างหน้า", () => {
    expect(workGroupOf(it_({ bucket: "overdue" }))).toBe("routine");
    expect(workGroupOf(it_({ bucket: "today" }))).toBe("routine");
    expect(workGroupOf(it_({ bucket: "upcoming" }))).toBe("routine");
    expect(workGroupOf(it_({ bucket: "later" }))).toBeNull();
  });
  it("ยังไม่เคยโบ → ไม่อยู่ในกลุ่มงาน", () => {
    expect(workGroupOf(it_({ bucket: "never", lastResult: null, lastYmd: null }))).toBeNull();
  });
});

describe("groupWork", () => {
  const items = [
    it_({ code: "A", lastResult: "still_turbid", lastTurbidCause: "more_flush", bucket: "upcoming", dueYmd: "2026-10-31", daysLeft: 2 }),
    it_({ code: "B", lastResult: "still_turbid", lastTurbidCause: "more_flush", bucket: "overdue", dueYmd: "2026-10-25", daysLeft: -4 }),
    it_({ code: "C", lastResult: "still_turbid", lastTurbidCause: "damaged", bucket: "blocked", dueYmd: null, daysLeft: null, lastYmd: "2026-10-26" }),
    it_({ code: "D", lastResult: "still_turbid", lastTurbidCause: "damaged", bucket: "blocked", dueYmd: null, daysLeft: null, lastYmd: "2026-10-20" }),
    it_({ code: "E", bucket: "today", dueYmd: "2026-10-29", daysLeft: 0 }),
    it_({ code: "F", bucket: "later" }),
    it_({ code: "G", bucket: "never", lastResult: null, lastYmd: null, dueYmd: null, daysLeft: null }),
  ];
  const g = groupWork(items, "2026-10-29");

  it("นับตามกลุ่ม + ภาพรวมรวมเท่าจำนวนหัว", () => {
    expect(g.counts).toEqual({ reflush: 2, repair: 2, clear_site: 0, inspect: 0, routine: 1 });
    expect(g.overview).toEqual({ inCycle: 1, routine: 1, followUp: 4, never: 1, total: 7 });
  });
  it("โบซ้ำเรียงเลยกำหนดก่อน + นับเลยกำหนด", () => {
    expect(g.items.reflush.map((i) => i.code)).toEqual(["B", "A"]);
    expect(g.overdue.reflush).toBe(1);
  });
  it("ส่งซ่อมเรียงค้างนานก่อน + ageDays นับจากวันบันทึก", () => {
    expect(g.items.repair.map((i) => [i.code, i.ageDays])).toEqual([["D", 9], ["C", 3]]);
    expect(g.oldestDays.repair).toBe(9);
  });
  it("มีครบทุกกลุ่มตาม WORK_GROUPS แม้ไม่มีรายการ", () => {
    expect(Object.keys(g.items).sort()).toEqual(WORK_GROUPS.map((w) => w.key).sort());
  });
});

describe("buildDueCalendar", () => {
  const mk = (o) => ({ code: "X", bucket: "later", lastResult: "clear", lastTurbidCause: "", lastYmd: "2026-10-15", ...o });
  // 2026-10-29 = วันพฤหัส → สัปดาห์เริ่มวันอาทิตย์ 2026-10-25
  const items = [
    mk({ code: "A", dueYmd: "2026-10-29", bucket: "today" }),
    mk({ code: "B", dueYmd: "2026-10-27", bucket: "overdue" }),
    mk({ code: "C", dueYmd: "2026-11-03", bucket: "upcoming" }),
    mk({ code: "D", dueYmd: "2026-11-20", bucket: "later" }),
    mk({ code: "E", lastResult: "still_turbid", lastTurbidCause: "more_flush", dueYmd: "2026-10-30", bucket: "upcoming" }),
    mk({ code: "F", lastResult: "still_turbid", lastTurbidCause: "damaged", dueYmd: null, bucket: "blocked" }),
    mk({ code: "G", bucket: "never", lastResult: null, dueYmd: null }),
  ];

  it("3 สัปดาห์ เริ่มวันอาทิตย์ของสัปดาห์นี้", () => {
    const c = buildDueCalendar(items, "2026-10-29");
    expect(c.weeks).toHaveLength(3);
    expect(c.weeks[0][0].ymd).toBe("2026-10-25");
    expect(c.weeks[2][6].ymd).toBe("2026-11-14");
    expect(c.weeks[0][4].isToday).toBe(true);
  });
  it("เฉพาะครบรอบประจำ (ใสแล้ว) โดยค่าเริ่มต้น · เลยกำหนดแยกออก · เกินช่วงนับไว้", () => {
    const c = buildDueCalendar(items, "2026-10-29");
    expect(c.overdue.map((i) => i.code)).toEqual(["B"]);
    expect(c.weeks[0][4].items.map((i) => i.code)).toEqual(["A"]);
    expect(c.weeks[1][2].items.map((i) => i.code)).toEqual(["C"]);
    expect(c.weeks[0][5].items).toEqual([]);
    expect(c.after).toBe(1);
  });
  it("รวมโบซ้ำได้ (ไม่รวมงานที่รอแก้ไข/ยังไม่เคยโบ)", () => {
    const c = buildDueCalendar(items, "2026-10-29", { includeReflush: true });
    expect(c.weeks[0][5].items.map((i) => [i.code, i.work])).toEqual([["E", "reflush"]]);
    const all = c.weeks.flat().flatMap((d) => d.items).map((i) => i.code);
    expect(all).not.toContain("F");
    expect(all).not.toContain("G");
  });
});

describe("fieldTaskOf", () => {
  it("แปลงคิวภาคสนามเป็นประเภทงาน", () => {
    expect(fieldTaskOf({ lastResult: "clear", bucket: "today" })).toBe("routine");
    expect(fieldTaskOf({ lastResult: "still_turbid", lastTurbidCause: "more_flush", bucket: "overdue" })).toBe("reflush");
    expect(fieldTaskOf({ lastResult: "still_turbid", lastTurbidCause: "other", bucket: "today" })).toBe("inspect");
    expect(fieldTaskOf({ lastResult: "still_turbid", lastTurbidCause: "", bucket: "upcoming" })).toBe("inspect");
  });
});
