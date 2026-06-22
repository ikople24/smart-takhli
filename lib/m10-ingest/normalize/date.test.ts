import { describe, it, expect } from "vitest";
import { parseThaiDate } from "./date";
import { NormalizeError } from "../types";

describe("parseThaiDate", () => {
  it("non-padded d/m/yyyy Buddhist -> ISO", () => { expect(parseThaiDate("5/1/2569")).toBe("2026-01-05"); });
  it("padded too", () => { expect(parseThaiDate("05/01/2569")).toBe("2026-01-05"); });
  it("throws on garbage", () => {
    try { parseThaiDate("ไม่ใช่วันที่"); throw new Error("no throw"); }
    catch (e) { expect((e as NormalizeError).reason).toBe("date_parse_failed"); }
  });
  it("throws on impossible month", () => { expect(() => parseThaiDate("5/13/2569")).toThrow(NormalizeError); });
});
