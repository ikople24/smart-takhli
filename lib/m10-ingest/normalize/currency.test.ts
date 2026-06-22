import { describe, it, expect } from "vitest";
import { parseCurrency } from "./currency";

describe("parseCurrency", () => {
  it("parses baht with separators", () => {
    expect(parseCurrency("฿304,000.00")).toBe(304000);
    expect(parseCurrency(" ฿1,234.50 ")).toBe(1234.5);
  });
  it("dash/empty -> null (real value is ' ฿-   ')", () => {
    expect(parseCurrency(" ฿-   ")).toBeNull();
    expect(parseCurrency("")).toBeNull();
  });
  it("junk -> null", () => { expect(parseCurrency("฿abc")).toBeNull(); });
});
