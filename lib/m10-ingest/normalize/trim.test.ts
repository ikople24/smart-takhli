import { describe, it, expect } from "vitest";
import { trimAll } from "./trim";

describe("trimAll", () => {
  it("strips keys and values", () => {
    expect(trimAll({ "สถานะดำเนินการ ": "ขาย ", " REG_AMT ": " ฿- " }))
      .toEqual({ "สถานะดำเนินการ": "ขาย", "REG_AMT": "฿-" });
  });
  it("coerces non-strings", () => {
    expect(trimAll({ a: 5 as unknown as string, b: null as unknown as string })).toEqual({ a: "5", b: "" });
  });
});
