import { describe, it, expect } from "vitest";
import { DEFAULT_FLOOD_SETTINGS, effectiveSituation, normalizeSettings, telHref } from "../settings";

describe("normalizeSettings", () => {
  it("ไม่มีเอกสาร = ค่าเริ่มต้น ศูนย์ฯ ปิด", () => {
    expect(normalizeSettings(null)).toEqual({ ...DEFAULT_FLOOD_SETTINGS });
    expect(normalizeSettings(null).centerOpen).toBe(false);
  });

  it("centerOpen ต้องเป็น true จริง ๆ เท่านั้น", () => {
    expect(normalizeSettings({ centerOpen: "true" }).centerOpen).toBe(false);
    expect(normalizeSettings({ centerOpen: true }).centerOpen).toBe(true);
  });

  it("SLA/เบอร์ที่ผิดรูปแบบถอยไปค่าเริ่มต้น", () => {
    const s = normalizeSettings({ callbackSlaMin: 0, hotline: "  " });
    expect(s.callbackSlaMin).toBe(15);
    expect(s.hotline).toBe("056-261-500");
    expect(normalizeSettings({ callbackSlaMin: 30 }).callbackSlaMin).toBe(30);
  });
});

describe("telHref", () => {
  it("ตัดขีดออก", () => {
    expect(telHref("056-261-500")).toBe("tel:056261500");
  });
});

describe("situationOverride", () => {
  it("ค่าเริ่มต้น/ค่าไม่รู้จัก = auto", () => {
    expect(normalizeSettings(null).situationOverride).toBe("auto");
    expect(normalizeSettings({ situationOverride: "safe" }).situationOverride).toBe("auto");
    expect(normalizeSettings({ situationOverride: "critical" }).situationOverride).toBe("critical");
  });

  it("auto ใช้ระดับตามโซน · ประกาศทับชนะเสมอ (ทั้งขึ้นและลง)", () => {
    expect(effectiveSituation("auto", "danger")).toBe("danger");
    expect(effectiveSituation("critical", "normal")).toBe("critical");
    expect(effectiveSituation("normal", "critical")).toBe("normal");
  });
});
