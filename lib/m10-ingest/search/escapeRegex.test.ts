import { describe, it, expect } from "vitest";
import { escapeRegex } from "./escapeRegex";

describe("escapeRegex", () => {
  it("ข้อความปกติไม่ถูกแก้", () => {
    expect(escapeRegex("81145")).toBe("81145");
    expect(escapeRegex("สมชาย")).toBe("สมชาย");
  });

  it("อักขระพิเศษของ regex ถูก escape", () => {
    expect(escapeRegex("01A001/002")).toBe("01A001/002");
    expect(escapeRegex("a.b")).toBe("a\\.b");
    expect(escapeRegex("a*b")).toBe("a\\*b");
    expect(escapeRegex("a+b?c")).toBe("a\\+b\\?c");
    expect(escapeRegex("(x)[y]{z}")).toBe("\\(x\\)\\[y\\]\\{z\\}");
  });

  it("ผลลัพธ์เอาไปสร้าง RegExp แล้ว match แบบตัวอักษรตรง ๆ", () => {
    const re = new RegExp(escapeRegex("a.b"), "i");
    expect(re.test("a.b")).toBe(true);
    expect(re.test("axb")).toBe(false);
  });
});
