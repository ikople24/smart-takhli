import { describe, it, expect } from "vitest";
import { accessKeyMatches, isAccessKeyShape, newAccessKey } from "../accessKey";

describe("accessKey", () => {
  it("สุ่มได้ 16 ตัวอักษรที่ใส่ URL ได้ และไม่ซ้ำกัน", () => {
    const a = newAccessKey();
    expect(isAccessKeyShape(a)).toBe(true);
    expect(encodeURIComponent(a)).toBe(a);
    expect(newAccessKey()).not.toBe(a);
  });

  it("ตรงกันเท่านั้นถึงผ่าน · รูปแบบผิด/ไม่มีค่า = ไม่ผ่าน", () => {
    const k = newAccessKey();
    expect(accessKeyMatches(k, k)).toBe(true);
    expect(accessKeyMatches(newAccessKey(), k)).toBe(false);
    expect(accessKeyMatches(undefined, k)).toBe(false);
    expect(accessKeyMatches(k, undefined)).toBe(false);
    expect(accessKeyMatches({ $ne: null }, k)).toBe(false);
    expect(accessKeyMatches("short", "short")).toBe(false);
  });
});
