import { describe, it, expect } from "vitest";
import {
  signFieldToken,
  verifyFieldToken,
  pinMatches,
  createAttemptLimiter,
  validateFieldName,
  FIELD_TOKEN_MAX_AGE_SEC,
} from "../fieldAuth";

const KEY = { serverSecret: "sk_test_abc", pin: "500" };
const NOW = new Date("2026-10-06T03:00:00Z");

describe("signFieldToken / verifyFieldToken", () => {
  it("เซ็นแล้วตรวจผ่าน ได้ชื่อ + deviceId คืน", () => {
    const t = signFieldToken({ name: "สมชาย", deviceId: "d1" }, KEY, NOW);
    expect(verifyFieldToken(t, KEY, NOW)).toEqual({
      name: "สมชาย",
      deviceId: "d1",
      iat: Math.floor(NOW.getTime() / 1000),
    });
  });

  it("แก้ payload → ไม่ผ่าน", () => {
    const t = signFieldToken({ name: "สมชาย", deviceId: "d1" }, KEY, NOW);
    const [, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ name: "x", deviceId: "d1", iat: 1 })).toString("base64url");
    expect(verifyFieldToken(`${forged}.${sig}`, KEY, NOW)).toBeNull();
  });

  it("เปลี่ยนรหัส PIN → token เก่าใช้ไม่ได้ทุกเครื่อง", () => {
    const t = signFieldToken({ name: "a", deviceId: "d1" }, KEY, NOW);
    expect(verifyFieldToken(t, { ...KEY, pin: "501" }, NOW)).toBeNull();
  });

  it("หมดอายุหลัง 180 วัน", () => {
    const t = signFieldToken({ name: "a", deviceId: "d1" }, KEY, NOW);
    const later = new Date(NOW.getTime() + (FIELD_TOKEN_MAX_AGE_SEC + 1) * 1000);
    expect(verifyFieldToken(t, KEY, later)).toBeNull();
  });

  it("ค่าเพี้ยน/ว่าง/ไม่มี secret → null", () => {
    expect(verifyFieldToken("", KEY, NOW)).toBeNull();
    expect(verifyFieldToken("abc", KEY, NOW)).toBeNull();
    expect(verifyFieldToken("a.b.c", KEY, NOW)).toBeNull();
    const t = signFieldToken({ name: "a", deviceId: "d1" }, KEY, NOW);
    expect(verifyFieldToken(t, { serverSecret: "", pin: "500" }, NOW)).toBeNull();
    expect(verifyFieldToken(t, { serverSecret: "sk_test_abc", pin: "" }, NOW)).toBeNull();
  });
});

describe("pinMatches", () => {
  it("ตรงเท่านั้น (ตัดช่องว่าง)", () => {
    expect(pinMatches(" 500 ", "500")).toBe(true);
    expect(pinMatches("5000", "500")).toBe(false);
    expect(pinMatches("", "500")).toBe(false);
    expect(pinMatches(undefined, "500")).toBe(false);
  });

  it("ยังไม่ตั้ง PIN ฝั่งเซิร์ฟเวอร์ → ไม่ผ่านเสมอ", () => {
    expect(pinMatches("", "")).toBe(false);
    expect(pinMatches("500", undefined)).toBe(false);
  });
});

describe("createAttemptLimiter", () => {
  it("ผิดครบ 5 ครั้ง → ล็อก 15 นาที แล้วปลดเอง", () => {
    const lim = createAttemptLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) lim.fail("ip1", t0);
    expect(lim.isLocked("ip1", t0)).toBe(false);
    lim.fail("ip1", t0);
    expect(lim.isLocked("ip1", t0)).toBe(true);
    expect(lim.isLocked("ip2", t0)).toBe(false);
    expect(lim.isLocked("ip1", t0 + 15 * 60 * 1000 + 1)).toBe(false);
  });

  it("สำเร็จแล้วล้างตัวนับ", () => {
    const lim = createAttemptLimiter({ max: 2, windowMs: 1000 });
    lim.fail("ip", 0);
    lim.succeed("ip");
    lim.fail("ip", 0);
    expect(lim.isLocked("ip", 0)).toBe(false);
  });
});

describe("validateFieldName", () => {
  it("ต้องมีชื่อ 2–60 ตัวอักษร", () => {
    expect(validateFieldName("  สมชาย  ")).toBe("สมชาย");
    expect(validateFieldName("ก")).toBeNull();
    expect(validateFieldName("")).toBeNull();
    expect(validateFieldName("ก".repeat(61))).toBeNull();
    expect(validateFieldName(123)).toBeNull();
  });
});
