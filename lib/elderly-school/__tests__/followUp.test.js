import { describe, it, expect } from "vitest";
import {
  needsCloseFollowUp,
  followUpFlags,
  indicatorTiles,
  sessionStatuses,
  defaultSessionNo,
  nextSession,
} from "../followUp";

describe("needsCloseFollowUp", () => {
  it("ความดันสูง / NCD 3 / 2Q บวก / ชีพจรผิดปกติ = ต้องติดตาม", () => {
    expect(needsCloseFollowUp({ bp: { category: "high" } })).toBe(true);
    expect(needsCloseFollowUp({ metabolicRiskScore: 3 })).toBe(true);
    expect(needsCloseFollowUp({ mentalHealth: { q2Positive: true } })).toBe(true);
    expect(needsCloseFollowUp({ pulseCategory: "high" })).toBe(true);
  });
  it("เสี่ยงระดับกลางไม่นับ", () => {
    expect(needsCloseFollowUp({ bp: { category: "risk" }, metabolicRiskScore: 2 })).toBe(false);
    expect(needsCloseFollowUp(null)).toBe(false);
  });
});

describe("followUpFlags", () => {
  it("สร้างป้ายตามลำดับความสำคัญ", () => {
    const flags = followUpFlags({
      bp: { category: "high", systolic: 168, diastolic: 96 },
      metabolicRiskScore: 3,
      mentalHealth: { q2Positive: true },
      trend: { deltaFromPrevious: { weightKg: -3 } },
    });
    expect(flags.map((f) => f.label)).toEqual(["ความดัน 168/96", "NCD 3/3", "2Q บวก", "น้ำหนักลด 3 กก."]);
    expect(flags[1].tone).toBe("see");
  });
  it("NCD 2/3 เป็นโทนควรดูแล และไม่มีค่าไม่สร้างป้าย", () => {
    expect(followUpFlags({ metabolicRiskScore: 2 })).toEqual([{ key: "ncd", label: "NCD 2/3", tone: "care" }]);
    expect(followUpFlags({ bp: { category: "high" } })).toEqual([]);
  });
});

describe("indicatorTiles", () => {
  it("คำนวณสัดส่วนเกณฑ์ดีของแต่ละการ์ด", () => {
    const tiles = indicatorTiles({
      bp: { normal: 18, low: 1, risk: 15, high: 11, unknown: 3 },
      mentalHealth: { ok: 39, risk: 4, unknown: 5 },
    });
    const bp = tiles.find((t) => t.key === "bp");
    expect(bp.total).toBe(48);
    expect(bp.pct).toBe(38);
    expect(bp.careCount).toBe(27);
    const mh = tiles.find((t) => t.key === "2q");
    expect(mh.careText).toBe("ควรพูดคุยติดตาม 4 คน");
  });
  it("ไม่มีข้อมูล pct = null", () => {
    expect(indicatorTiles({}).every((t) => t.pct === null)).toBe(true);
  });
});

describe("sessionStatuses", () => {
  const sessions = [
    { visitNo: 1, dateISO: "2026-10-01" },
    { visitNo: 2, dateISO: "2026-10-21" },
    { visitNo: 3, dateISO: "2026-11-01" },
    { visitNo: 20, dateISO: "2026-11-02" },
    { visitNo: 4, dateISO: "bad" },
  ];
  it("แยกสถานะตามวันนี้", () => {
    const st = sessionStatuses(sessions, "2026-10-21");
    expect(st).toHaveLength(16);
    expect(st.slice(0, 4).map((s) => s.status)).toEqual(["done", "today", "scheduled", "unset"]);
    expect(defaultSessionNo(st)).toBe(2);
    expect(nextSession(st).visitNo).toBe(2);
  });
  it("ไม่มีวันนี้ เลือกครั้งล่าสุดที่ผ่านมา", () => {
    const st = sessionStatuses(sessions, "2026-10-25");
    expect(defaultSessionNo(st)).toBe(2);
    expect(nextSession(st).visitNo).toBe(3);
    expect(defaultSessionNo(sessionStatuses([], "2026-10-25"))).toBe(1);
  });
});

import { bmiChip, bpChip, ncdChip, mhChip, visitResult, parseBpText, parseNumberField, pulseCategoryOf } from "../followUp";

describe("ป้ายสถานะ", () => {
  it("map หมวดเป็นโทน", () => {
    expect(bmiChip("obese2")).toEqual({ label: "อ้วน 2", tone: "see" });
    expect(bmiChip(undefined).tone).toBe("none");
    expect(bpChip({ category: "high", systolic: 150, diastolic: 95 })).toEqual({ label: "150/95", tone: "see" });
    expect(ncdChip(2).tone).toBe("care");
    expect(ncdChip(null).label).toBe("—");
    expect(mhChip({ q2Positive: true }).tone).toBe("mind");
    expect(mhChip(null).label).toBe("ยังไม่คัดกรอง");
  });
  it("ผลวัดรายครั้ง เรียงความสำคัญ", () => {
    expect(visitResult({ bpCategory: "risk", pulseCategory: "high" }).label).toBe("ชีพจรสูง");
    expect(visitResult({ bpCategory: "unknown", pulseCategory: "unknown" }).tone).toBe("none");
    expect(pulseCategoryOf(112)).toBe("high");
  });
  it("parse ช่องฟอร์ม", () => {
    expect(parseBpText("120 / 80")).toEqual({ sys: 120, dia: 80 });
    expect(parseBpText("1288/84")).toEqual({ sys: null, dia: null });
    expect(parseNumberField("")).toBeNull();
    expect(parseNumberField("68.5")).toBe(68.5);
    expect(parseNumberField("abc")).toBeUndefined();
  });
});
