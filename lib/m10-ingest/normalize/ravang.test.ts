import { describe, it, expect } from "vitest";
import { ravangKey, parcelRecordKey, ns3aRecordKey } from "./ravang";

describe("ravangKey", () => {
  it("zero-pads UTM4 to 2, joins with |, coerces numbers", () => {
    expect(ravangKey({ utm1: "5039", utm2: 2 as unknown as string, utm3: "4682", utm4: "7", scale: 1000 as unknown as string }))
      .toBe("5039|2|4682|07|1000");
  });
});
describe("parcelRecordKey", () => {
  it("appends land number", () => {
    expect(parcelRecordKey({ utm1: "5039", utm2: "2", utm3: "4682", utm4: "7", scale: "1000" }, "84"))
      .toBe("5039|2|4682|07|1000|84");
  });
});
describe("ns3aRecordKey", () => {
  it("uses a distinct NS3A-prefixed shape (3 air-map parts)", () => {
    expect(ns3aRecordKey({ a1: "12", a2: "34", a3: "56", scale: "4000" }, "9"))
      .toBe("NS3A|12|34|56|4000|9");
  });
});
