import { describe, it, expect } from "vitest";
import { personalSummary, personalTrend, visitBp } from "../personal";

const visits = [
  { visitNo: 1, weightKg: 69, waistCm: 92, pulseBpm: 78, bp1Sys: 150, bp1Dia: 90 },
  { visitNo: 2 },
  { visitNo: 3, weightKg: 68.5, bp2Sys: 168, bp2Dia: 96 },
];

describe("personalSummary", () => {
  it("ใช้ค่าล่าสุดของแต่ละอย่าง และบอกเรื่องที่ควรพบเจ้าหน้าที่", () => {
    const s = personalSummary(visits, 155);
    const byKey = Object.fromEntries(s.metrics.map((m) => [m.key, m]));
    expect(byKey.bp).toMatchObject({ value: "168/96", tone: "see", visitNo: 3 });
    expect(byKey.weight.sub).toBe("ลดลง 0.5 กก. จากครั้งก่อน");
    expect(byKey.waist).toMatchObject({ value: "92", tone: "care", visitNo: 1 });
    expect(byKey.pulse.tone).toBe("ok");
    expect(s.headline).toBe("มี 1 เรื่องที่ควรพบเจ้าหน้าที่");
    expect(s.attended).toBe(2);
    expect(s.latestVisitNo).toBe(3);
  });
  it("ไม่มีข้อมูล", () => {
    expect(personalSummary([], null)).toMatchObject({ metrics: [], headline: "ยังไม่มีผลวัดในปีนี้", attended: 0 });
  });
  it("ไม่มีส่วนสูง → รอบเอวไม่ประเมิน", () => {
    const s = personalSummary([{ visitNo: 1, waistCm: 80 }], null);
    expect(s.metrics[0]).toMatchObject({ tone: "none", status: "บันทึกแล้ว" });
    expect(s.headline).toBe("ทุกค่าอยู่ในเกณฑ์ดี");
  });
});

describe("personalTrend / visitBp", () => {
  it("แนวโน้มความดันใช้รอบ 2 เมื่อรอบ 1 ไม่ครบ", () => {
    expect(visitBp({ bp1Sys: 120, bp2Sys: 130, bp2Dia: 80 })).toEqual({ sys: 130, dia: 80 });
    expect(personalTrend(visits, "bp").map((t) => t.value)).toEqual([150, 168]);
    expect(personalTrend(visits, "weight").map((t) => t.value)).toEqual([69, 68.5]);
  });
});

describe("headline lead", () => {
  it("ไม่บอกว่าส่วนใหญ่ดี ถ้าค่าดีไม่ถึงครึ่ง", () => {
    const s = personalSummary([{ visitNo: 1, weightKg: 80, waistCm: 92, pulseBpm: 78, bp1Sys: 168, bp1Dia: 96 }], 155);
    expect(s.lead).toBe("");
    const s2 = personalSummary([{ visitNo: 1, waistCm: 70, pulseBpm: 78, bp1Sys: 168, bp1Dia: 96 }], 155);
    expect(s2.lead).toBe("ส่วนใหญ่อยู่ในเกณฑ์ดี");
  });
});
