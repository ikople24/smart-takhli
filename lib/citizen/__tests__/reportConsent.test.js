// lib/citizen/__tests__/reportConsent.test.js
import { describe, it, expect } from "vitest";
import {
  CONSENT_VERSION,
  KNOWN_CONSENT_VERSIONS,
  CONSENT_SECTIONS,
  CONSENT_INTRO,
  EMERGENCY,
  CONSENT_CHECKBOX_LABEL,
  CONSENT_UPDATED_LABEL,
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
      expect((s.paragraphs ?? []).length).toBeGreaterThan(0);
      for (const para of s.paragraphs ?? []) {
        expect(para.length).toBeGreaterThan(0);
        for (const run of para) {
          expect(typeof run.t).toBe("string");
          expect(run.t.length).toBeGreaterThan(0);
        }
      }
      for (const item of s.chips ?? []) {
        expect(typeof item).toBe("string");
        expect(item.length).toBeGreaterThan(0);
      }
      for (const item of s.denyList ?? []) {
        expect(typeof item).toBe("string");
        expect(item.length).toBeGreaterThan(0);
      }
      for (const item of s.statusChips ?? []) {
        expect(typeof item).toBe("string");
        expect(item.length).toBeGreaterThan(0);
      }
      for (const run of s.tailParagraph ?? []) {
        expect(typeof run.t).toBe("string");
        expect(run.t.length).toBeGreaterThan(0);
      }
    }

    // การมีอยู่ของ field (ไม่ใช่แค่เนื้อหาข้างในไม่ว่าง) — for...of บน array ว่างไม่รันเลย
    // จึงต้องเช็คความยาว array เองตรง ๆ ว่าไม่ถูกลบ/ล้างทั้งชุด โดยเฉพาะ denyList ของข้อ 2
    // ที่เป็นรายการข้อยกเว้นตามกฎหมาย
    expect(CONSENT_SECTIONS[0].chips.length).toBeGreaterThan(0);
    expect(CONSENT_SECTIONS[1].denyList.length).toBeGreaterThan(0);
    expect(CONSENT_SECTIONS[2].statusChips.length).toBeGreaterThan(0);
    expect(CONSENT_SECTIONS[2].tailParagraph.length).toBeGreaterThan(0);
  });

  it("ป้ายวันที่อ้างเลขฉบับจากค่าคงที่เดียวกับ CONSENT_VERSION", () => {
    expect(CONSENT_UPDATED_LABEL).toContain(`ฉบับที่ ${CONSENT_VERSION}`);
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
