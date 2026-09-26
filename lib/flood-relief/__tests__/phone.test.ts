import { describe, it, expect } from "vitest";
import { isValidPhone, maskPhone, normalizePhone } from "../phone";

describe("normalizePhone", () => {
  it("ตัดขีด/ช่องว่าง และแปลง +66 เป็น 0", () => {
    expect(normalizePhone("081-234-4421")).toBe("0812344421");
    expect(normalizePhone("+66 81 234 4421")).toBe("0812344421");
    expect(normalizePhone("6656261500")).toBe("056261500");
  });
});

describe("isValidPhone", () => {
  it("มือถือ 10 หลัก / บ้าน 9 หลัก ขึ้นต้น 0", () => {
    expect(isValidPhone("0812344421")).toBe(true);
    expect(isValidPhone("056-261-500")).toBe(true);
  });

  it("สั้น/ยาวเกิน/ไม่ขึ้นต้น 0 = ไม่ผ่าน", () => {
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("08123444210")).toBe(false);
    expect(isValidPhone("1812344421")).toBe(false);
    expect(isValidPhone(undefined)).toBe(false);
  });
});

describe("maskPhone", () => {
  it("เหลือ 2 ตัวหน้า + 4 ตัวท้าย", () => {
    expect(maskPhone("0812344421")).toBe("08x-xxx-4421");
    expect(maskPhone("056261500")).toBe("05x-xxx-1500");
  });

  it("สั้นผิดปกติไม่เผยตัวเลข", () => {
    expect(maskPhone("1234")).toBe("xxx");
    expect(maskPhone(null)).toBe("xxx");
  });
});
