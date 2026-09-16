// lib/citizen/__tests__/reportConsent.test.js
import { describe, it, expect } from "vitest";
import {
  CONSENT_VERSION,
  KNOWN_CONSENT_VERSIONS,
  CONSENT_SECTIONS,
  CONSENT_INTRO,
  EMERGENCY,
  CONSENT_CHECKBOX_LABEL,
} from "../report/consentContent";

describe("consentContent — เนื้อหาข้อตกลงฉบับปัจจุบัน", () => {
  it("เลขฉบับเป็นรูปแบบ x.y และอยู่ในรายชื่อฉบับที่ระบบรู้จัก", () => {
    expect(CONSENT_VERSION).toMatch(/^\d+\.\d+$/);
    expect(KNOWN_CONSENT_VERSIONS).toContain(CONSENT_VERSION);
  });

  it("มีครบ 4 หัวข้อ เรียงเลข 1-4 และมีชื่อหัวข้อทุกอัน", () => {
    expect(CONSENT_SECTIONS).toHaveLength(4);
    expect(CONSENT_SECTIONS.map((s) => s.n)).toEqual([1, 2, 3, 4]);
    for (const s of CONSENT_SECTIONS) {
      expect(typeof s.title).toBe("string");
      expect(s.title.length).toBeGreaterThan(0);
    }
  });

  it("ทุก run ของทุกย่อหน้ามีข้อความจริง (กันพิมพ์ตกหล่น)", () => {
    for (const s of CONSENT_SECTIONS) {
      for (const para of s.paragraphs ?? []) {
        expect(para.length).toBeGreaterThan(0);
        for (const run of para) expect(typeof run.t).toBe("string");
      }
    }
  });

  it("การ์ดฉุกเฉินใช้เบอร์ 191 และมีบรรทัดงานจับสัตว์เลื้อยคลาน", () => {
    expect(EMERGENCY.phone).toBe("191");
    expect(EMERGENCY.animal.phone).toBe("056261500");
    expect(EMERGENCY.animal.label).toContain("สัตว์เลื้อยคลาน");
  });

  it("มีข้อความแนะนำระบบและข้อความข้างช่องติ๊ก", () => {
    expect(CONSENT_INTRO.title.length).toBeGreaterThan(0);
    expect(CONSENT_CHECKBOX_LABEL).toContain("ยอมรับ");
  });
});
