import { describe, it, expect } from "vitest";
import { buildHealthHistory, yearlyBpSummary } from "../history";

const visits = [
  { yearBE: 2568, visitNo: 1, weightKg: 60, bp1Sys: 150, bp1Dia: 92, pulseBpm: 80 },
  { yearBE: 2568, visitNo: 2, bp1Sys: null, bp2Sys: 118, bp2Dia: 76 },
  { yearBE: 2569, visitNo: 3, checkinDate: "2026-01-14", weightKg: 61, waistCm: 80 },
  { yearBE: 2569, visitNo: 4 }, // ไม่มีข้อมูล → ไม่แสดง
];
const schedules = [{ yearBE: 2568, sessions: [{ visitNo: 1, dateISO: "2024-11-20" }] }];

describe("buildHealthHistory", () => {
  const h = buildHealthHistory({ person: { heightCm: 155 }, visits, schedules });
  it("แยกรายปี ใหม่→เก่า และข้ามครั้งที่ไม่มีข้อมูล", () => {
    expect(h.years.map((y) => y.yearBE)).toEqual([2569, 2568]);
    expect(h.totalVisits).toBe(3);
    expect(h).toMatchObject({ firstYear: 2568, lastYear: 2569 });
    expect(h.years[1].rows.map((r) => r.visitNo)).toEqual([2, 1]);
  });
  it("วันที่: เช็คอินก่อน แล้วค่อยใช้ตารางเรียนของปีนั้น", () => {
    expect(h.years[0].rows[0].dateISO).toBe("2026-01-14");
    expect(h.years[1].rows[1].dateISO).toBe("2024-11-20");
    expect(h.years[1].rows[0].dateISO).toBeNull();
  });
  it("ความดันใช้รอบ 1 ก่อน ไม่ครบใช้รอบ 2 + BMI จากส่วนสูงในทะเบียน", () => {
    expect(h.years[1].rows[1]).toMatchObject({ bp: "150/92", bpCategory: "high", bpTone: "see", bmi: 25 });
    expect(h.years[1].rows[0]).toMatchObject({ bp: "118/76", bpTone: "ok" });
  });
  it("สรุปความดันรายปี", () => {
    expect(yearlyBpSummary(h)).toEqual([
      { yearBE: 2569, measured: 0, avgSys: null, highCount: 0 },
      { yearBE: 2568, measured: 2, avgSys: 134, highCount: 1 },
    ]);
  });
});
