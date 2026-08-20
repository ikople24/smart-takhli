// เทส KPI ความเร็วจัดการเรื่อง — เกณฑ์ต้องตรงกับการ์ดเดิม CardOfficail.js
import { describe, it, expect } from "vitest";
import { handlingSpeed, handlingDuration } from "../handlingKpi";

const at = (iso) => new Date(iso).toISOString();

describe("handlingSpeed — ป้ายความเร็ว 5 ระดับตามเกณฑ์เดิม", () => {
  it("≤24 ชม → ภายใน 24 ชม (fast)", () => {
    expect(handlingSpeed(at("2026-08-01T08:00:00Z"), at("2026-08-01T20:00:00Z"))).toEqual({
      text: "ภายใน 24 ชม",
      tone: "fast",
    });
    // ครบ 24 ชม พอดียังนับ fast (Math.ceil = 24)
    expect(handlingSpeed(at("2026-08-01T08:00:00Z"), at("2026-08-02T08:00:00Z"))?.tone).toBe("fast");
  });
  it("≤2 วัน → good, ≤7 วัน → ok, ≤15 วัน → slow, เกิน → late", () => {
    expect(handlingSpeed(at("2026-08-01T08:00:00Z"), at("2026-08-03T00:00:00Z"))?.tone).toBe("good");
    expect(handlingSpeed(at("2026-08-01T08:00:00Z"), at("2026-08-07T08:00:00Z"))?.tone).toBe("ok");
    expect(handlingSpeed(at("2026-08-01T08:00:00Z"), at("2026-08-13T08:00:00Z"))?.tone).toBe("slow");
    expect(handlingSpeed(at("2026-08-01T08:00:00Z"), at("2026-08-20T08:00:00Z"))).toEqual({
      text: "เกิน 15 วัน",
      tone: "late",
    });
  });
  it("ข้อมูลไม่ครบ/เพี้ยน → null (การ์ดไม่แสดงป้าย)", () => {
    expect(handlingSpeed(null, at("2026-08-02T00:00:00Z"))).toBeNull();
    expect(handlingSpeed(at("2026-08-01T00:00:00Z"), null)).toBeNull();
    expect(handlingSpeed("ไม่ใช่วันที่", at("2026-08-02T00:00:00Z"))).toBeNull();
  });
  it("วันที่สลับกัน (completed ก่อน assigned) ใช้ค่าสัมบูรณ์เหมือนเดิม", () => {
    expect(handlingSpeed(at("2026-08-02T08:00:00Z"), at("2026-08-01T20:00:00Z"))?.tone).toBe("fast");
  });
});

describe("handlingDuration — เวลาที่ใช้แบบอ่านง่าย", () => {
  it("ต่ำกว่าชั่วโมงเป็นนาที, ต่ำกว่าวันเป็น ชม.+นาที", () => {
    expect(handlingDuration(at("2026-08-01T08:00:00Z"), at("2026-08-01T08:45:00Z"))).toBe("45 นาที");
    expect(handlingDuration(at("2026-08-01T08:00:00Z"), at("2026-08-01T11:20:00Z"))).toBe("3 ชม. 20 นาที");
    expect(handlingDuration(at("2026-08-01T08:00:00Z"), at("2026-08-01T13:00:00Z"))).toBe("5 ชั่วโมง");
  });
  it("เกินวันเป็น วัน+ชม. / วันถ้วน", () => {
    expect(handlingDuration(at("2026-08-01T08:00:00Z"), at("2026-08-03T13:00:00Z"))).toBe("2 วัน 5 ชม.");
    expect(handlingDuration(at("2026-08-01T08:00:00Z"), at("2026-08-04T08:00:00Z"))).toBe("3 วัน");
  });
  it("ข้อมูลไม่ครบ → null", () => {
    expect(handlingDuration(null, null)).toBeNull();
  });
});
