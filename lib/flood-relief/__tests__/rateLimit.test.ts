import { describe, it, expect } from "vitest";
import { clientIp, isRateLimited, rateLimitSince } from "../rateLimit";

describe("clientIp", () => {
  it("ใช้ตัวแรกของ x-forwarded-for", () => {
    expect(clientIp({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })).toBe("1.2.3.4");
    expect(clientIp({ "x-forwarded-for": ["5.6.7.8"] })).toBe("5.6.7.8");
  });

  it("ถอยไป x-real-ip แล้ว socket · ตัด ::ffff: และพอร์ต", () => {
    expect(clientIp({ "x-real-ip": "9.9.9.9" })).toBe("9.9.9.9");
    expect(clientIp({}, "::ffff:127.0.0.1")).toBe("127.0.0.1");
    expect(clientIp({ "x-forwarded-for": "1.2.3.4:5555" })).toBe("1.2.3.4");
    expect(clientIp({})).toBe("");
  });
});

describe("isRateLimited — 5 คำขอ/ชม. ต่อ IP และต่อเบอร์", () => {
  it("ครบ 5 แล้วบล็อก", () => {
    expect(isRateLimited({ byIp: 4, byPhone: 4 })).toBe(false);
    expect(isRateLimited({ byIp: 5, byPhone: 0 })).toBe(true);
    expect(isRateLimited({ byIp: 0, byPhone: 5 })).toBe(true);
  });

  it("หา IP ไม่ได้ไม่นับฝั่ง IP แต่ยังนับเบอร์", () => {
    expect(isRateLimited({ byIp: 99, byPhone: 0 }, false)).toBe(false);
    expect(isRateLimited({ byIp: 0, byPhone: 5 }, false)).toBe(true);
  });

  it("หน้าต่างเวลา 60 นาที", () => {
    const now = new Date("2026-09-26T05:00:00Z");
    expect(rateLimitSince(now).toISOString()).toBe("2026-09-26T04:00:00.000Z");
  });
});
