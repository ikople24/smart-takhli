import { describe, it, expect } from "vitest";
import {
  CYCLE_DAYS,
  addDaysYmd,
  daysBetweenYmd,
  teamResolver,
  buildQueue,
  queueCounts,
  summarizeByTeam,
  dailyBreakdown,
  monthRange,
  validateTeamsInput,
} from "../flushingSchedule";

const TEAMS = [
  { key: "water", label: "กองการประปา", members: ["สมชาย ใจดี"] },
  { key: "prevention", label: "ทีมงานป้องกัน", members: [" สมหญิง รักน้ำ "] },
];

const pt = (id, code) => ({ _id: id, code, name: `จุด ${code}`, roadName: "", location: { type: "Point", coordinates: [100.35, 15.26] } });

// เวลาเป็น UTC — 02:00Z = 09:00 น. ไทย (วันเดียวกัน)
const log = (pointId, result, at, by = "สมชาย ใจดี", extra = {}) => ({
  flushPointId: pointId,
  locationName: pointId ? `จุด ${pointId}` : "ไม่ผูกหัว",
  result,
  turbidCause: result === "still_turbid" ? "more_flush" : "",
  flushedAt: at,
  createdByName: by,
  ...extra,
});

describe("วันที่", () => {
  it("addDaysYmd ข้ามเดือน/ปี", () => {
    expect(addDaysYmd("2026-10-29", 5)).toBe("2026-11-03");
    expect(addDaysYmd("2026-12-25", 15)).toBe("2027-01-09");
  });
  it("daysBetweenYmd = b - a", () => {
    expect(daysBetweenYmd("2026-10-29", "2026-11-03")).toBe(5);
    expect(daysBetweenYmd("2026-10-29", "2026-10-27")).toBe(-2);
  });
  it("monthRange คืนวันแรก/วันสุดท้ายของเดือน", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2026-13")).toBeNull();
    expect(monthRange("abc")).toBeNull();
  });
});

describe("teamResolver", () => {
  it("จับชื่อแบบ trim · ไม่อยู่ทีมไหน = ''", () => {
    const of = teamResolver(TEAMS);
    expect(of("สมหญิง รักน้ำ")).toBe("prevention");
    expect(of(" สมชาย ใจดี")).toBe("water");
    expect(of("คนอื่น")).toBe("");
    expect(of(undefined)).toBe("");
  });
});

describe("buildQueue", () => {
  const today = "2026-10-29";

  it("ใสแล้ว → +15 วัน · ยังขุ่น → +5 วัน นับจากวันโบล่าสุด (วันไทย)", () => {
    const items = buildQueue({
      points: [pt("A", "A1"), pt("B", "B1")],
      logs: [
        log("A", "clear", "2026-10-20T02:00:00Z"),
        log("B", "still_turbid", "2026-10-26T02:00:00Z"),
      ],
      teams: TEAMS,
      today,
    });
    const by = Object.fromEntries(items.map((i) => [i.point.code, i]));
    expect(by.A1.dueYmd).toBe(addDaysYmd("2026-10-20", CYCLE_DAYS.clear));
    expect(by.A1.dueYmd).toBe("2026-11-04");
    expect(by.B1.dueYmd).toBe("2026-10-31");
    expect(by.B1.daysLeft).toBe(2);
    expect(by.B1.bucket).toBe("upcoming");
  });

  it("ใช้วันไทย: 18:00Z = ตี 1 วันถัดไปของไทย", () => {
    const [item] = buildQueue({
      points: [pt("A", "A1")],
      logs: [log("A", "still_turbid", "2026-10-23T18:00:00Z")],
      teams: TEAMS,
      today,
    });
    expect(item.lastYmd).toBe("2026-10-24");
    expect(item.dueYmd).toBe("2026-10-29");
    expect(item.bucket).toBe("today");
  });

  it("ใช้บันทึกล่าสุดของหัวนั้น และทีม = ทีมของคนที่โบครั้งล่าสุด", () => {
    const [item] = buildQueue({
      points: [pt("A", "A1")],
      logs: [
        log("A", "still_turbid", "2026-10-10T02:00:00Z", "สมชาย ใจดี"),
        log("A", "clear", "2026-10-25T02:00:00Z", "สมหญิง รักน้ำ"),
      ],
      teams: TEAMS,
      today,
    });
    expect(item.lastLog.result).toBe("clear");
    expect(item.teamKey).toBe("prevention");
    expect(item.dueYmd).toBe("2026-11-09");
    expect(item.bucket).toBe("later");
  });

  it("เลยกำหนด / ติดสิ่งกีดขวาง-หัวชำรุด = blocked / ไม่เคยโบ = never", () => {
    const items = buildQueue({
      points: [pt("A", "A1"), pt("B", "B1"), pt("C", "C1"), pt("D", "D1")],
      logs: [
        log("A", "still_turbid", "2026-10-01T02:00:00Z"),
        log("B", "still_turbid", "2026-10-28T02:00:00Z", "สมชาย ใจดี", { turbidCause: "obstacle" }),
        log("C", "still_turbid", "2026-10-28T02:00:00Z", "สมชาย ใจดี", { turbidCause: "damaged" }),
      ],
      teams: TEAMS,
      today,
    });
    const by = Object.fromEntries(items.map((i) => [i.point.code, i]));
    expect(by.A1.bucket).toBe("overdue");
    expect(by.A1.daysLeft).toBe(-23);
    expect(by.B1.bucket).toBe("blocked");
    expect(by.B1.dueYmd).toBeNull();
    expect(by.C1.bucket).toBe("blocked");
    expect(by.D1).toMatchObject({ bucket: "never", lastLog: null, teamKey: "", dueYmd: null });
  });

  it("ไม่สน log ที่ไม่ผูกหัว และคนโบที่ไม่อยู่ทีม = teamKey ''", () => {
    const [item] = buildQueue({
      points: [pt("A", "A1")],
      logs: [log(null, "clear", "2026-10-28T02:00:00Z"), log("A", "clear", "2026-10-20T02:00:00Z", "คนนอก")],
      teams: TEAMS,
      today,
    });
    expect(item.lastLog.createdByName).toBe("คนนอก");
    expect(item.teamKey).toBe("");
  });

  it("เรียง: เลยกำหนด → วันนี้ → เร็วๆ นี้ → ภายหลัง → รอแก้ไข → ไม่เคยโบ · ในกลุ่มเรียงวันครบกำหนด", () => {
    const items = buildQueue({
      points: [pt("N", "N1"), pt("L", "L1"), pt("O2", "O2"), pt("O1", "O1"), pt("T", "T1"), pt("X", "X1")],
      logs: [
        log("L", "clear", "2026-10-25T02:00:00Z"),
        log("O2", "still_turbid", "2026-10-20T02:00:00Z"),
        log("O1", "still_turbid", "2026-10-10T02:00:00Z"),
        log("T", "still_turbid", "2026-10-24T02:00:00Z"),
        log("X", "still_turbid", "2026-10-24T02:00:00Z", "สมชาย ใจดี", { turbidCause: "obstacle" }),
      ],
      teams: TEAMS,
      today,
    });
    expect(items.map((i) => i.point.code)).toEqual(["O1", "O2", "T1", "L1", "X1", "N1"]);
  });

  it("queueCounts นับตาม bucket และตามทีม", () => {
    const items = buildQueue({
      points: [pt("A", "A1"), pt("B", "B1"), pt("C", "C1")],
      logs: [
        log("A", "still_turbid", "2026-10-01T02:00:00Z"),
        log("B", "still_turbid", "2026-10-01T02:00:00Z", "สมหญิง รักน้ำ"),
      ],
      teams: TEAMS,
      today,
    });
    const c = queueCounts(items);
    expect(c.byBucket).toMatchObject({ overdue: 2, never: 1, today: 0 });
    expect(c.byTeam).toMatchObject({ water: 1, prevention: 1, "": 1 });
  });
});

describe("summarizeByTeam", () => {
  it("นับครั้งรวม log ไม่ผูกหัว · หัวนับครั้งเดียวตามทีมของ log ล่าสุด · ใส/ขุ่นตามผลล่าสุด", () => {
    const s = summarizeByTeam({
      logs: [
        log("A", "still_turbid", "2026-10-10T02:00:00Z", "สมชาย ใจดี"),
        log("A", "clear", "2026-10-11T02:00:00Z", "สมหญิง รักน้ำ"),
        log("B", "still_turbid", "2026-10-11T02:00:00Z", "สมชาย ใจดี"),
        log(null, "clear", "2026-10-11T03:00:00Z", "สมชาย ใจดี"),
        log("C", "clear", "2026-10-11T03:00:00Z", "คนนอก"),
      ],
      teams: TEAMS,
    });
    const by = Object.fromEntries(s.rows.map((r) => [r.key, r]));
    expect(by.water).toMatchObject({ label: "กองการประปา", flushCount: 3, points: 1, clearPoints: 0, turbidPoints: 1 });
    expect(by.prevention).toMatchObject({ flushCount: 1, points: 1, clearPoints: 1, turbidPoints: 0 });
    expect(by[""]).toMatchObject({ label: "ยังไม่จัดทีม", flushCount: 1, points: 1, clearPoints: 1 });
    expect(s.total).toEqual({ flushCount: 5, points: 3, clearPoints: 2, turbidPoints: 1 });
    expect(s.rows.map((r) => r.key)).toEqual(["water", "prevention", ""]);
  });

  it("ไม่มีข้อมูล = ศูนย์ทุกทีม", () => {
    const s = summarizeByTeam({ logs: [], teams: TEAMS });
    expect(s.total).toEqual({ flushCount: 0, points: 0, clearPoints: 0, turbidPoints: 0 });
    expect(s.rows).toHaveLength(3);
  });
});

describe("dailyBreakdown", () => {
  it("ทุกวันในเดือน · ต่อวันต่อทีม นับครั้งและหัวไม่ซ้ำ (วันไทย)", () => {
    const days = dailyBreakdown({
      logs: [
        log("A", "still_turbid", "2026-10-01T02:00:00Z"),
        log("A", "clear", "2026-10-01T05:00:00Z"),
        log("B", "clear", "2026-10-01T18:00:00Z", "สมหญิง รักน้ำ"), // = 2 ต.ค. ไทย
        log(null, "clear", "2026-10-02T03:00:00Z"),
      ],
      teams: TEAMS,
      month: "2026-10",
    });
    expect(days).toHaveLength(31);
    expect(days[0]).toMatchObject({
      ymd: "2026-10-01",
      byTeam: { water: { flushCount: 2, points: 1 } },
      total: { flushCount: 2, points: 1 },
    });
    expect(days[1].byTeam.prevention).toEqual({ flushCount: 1, points: 1 });
    expect(days[1].byTeam.water).toEqual({ flushCount: 1, points: 0 });
    expect(days[1].total).toEqual({ flushCount: 2, points: 1 });
    expect(days[5].total).toEqual({ flushCount: 0, points: 0 });
  });
});

describe("validateTeamsInput", () => {
  it("trim + ตัดซ้ำในทีม + ข้ามช่องว่าง", () => {
    const v = validateTeamsInput({ teams: [{ key: "water", members: [" ก ", "ก", "", "ข"] }] });
    expect(v.ok).toBe(true);
    expect(v.value).toEqual([{ key: "water", members: ["ก", "ข"] }]);
  });
  it("key ไม่รู้จัก / ไม่ใช่ array / ชื่อยาวเกิน = error", () => {
    expect(validateTeamsInput({ teams: [{ key: "hack", members: [] }] }).ok).toBe(false);
    expect(validateTeamsInput({ teams: "x" }).ok).toBe(false);
    expect(validateTeamsInput({ teams: [{ key: "water", members: ["ก".repeat(81)] }] }).ok).toBe(false);
    expect(validateTeamsInput({ teams: [{ key: "water", members: [5] }] }).ok).toBe(false);
  });
  it("ชื่อเดียวกันอยู่ 2 ทีม = error", () => {
    const v = validateTeamsInput({
      teams: [
        { key: "water", members: ["ก"] },
        { key: "prevention", members: [" ก"] },
      ],
    });
    expect(v.ok).toBe(false);
    expect(v.message).toContain("ก");
  });
});
