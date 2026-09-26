import { describe, it, expect } from "vitest";
import { thaiClock, thaiWhen } from "../time";

const now = new Date("2026-09-26T05:00:00Z"); // 12:00 น. เวลาไทย

describe("thaiClock / thaiWhen — อิงเวลาไทย", () => {
  it("เวลา 24 ชม.", () => {
    expect(thaiClock("2026-09-26T01:32:00Z")).toBe("08:32 น.");
    expect(thaiClock(null)).toBe("");
  });

  it("วันนี้ / เมื่อวาน / วันอื่น", () => {
    expect(thaiWhen("2026-09-26T01:32:00Z", now)).toBe("วันนี้ 08:32 น.");
    // 23:30 UTC ของ 25 ก.ย. = 06:30 น. วันที่ 26 เวลาไทย → ยังเป็น "วันนี้"
    expect(thaiWhen("2026-09-25T23:30:00Z", now)).toBe("วันนี้ 06:30 น.");
    expect(thaiWhen("2026-09-25T14:05:00Z", now)).toBe("เมื่อวาน 21:05 น.");
    expect(thaiWhen("2026-09-24T01:32:00Z", now)).toBe("24 ก.ย. 08:32 น.");
  });
});
