import { describe, it, expect } from "vitest";
import { parseCsv } from "./csv";

const CSV = `สถานะดำเนินการ,ที่ดิน,UTM_MAP4
ขาย,84,7
จำนอง,85,8
`;

describe("parseCsv", () => {
  it("one RawRow per data row with docType+source", () => {
    const rows = parseCsv(CSV, "PARCEL", "parcel.csv");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ docType: "PARCEL", source: "parcel.csv",
      raw: { "สถานะดำเนินการ": "ขาย", "ที่ดิน": "84", "UTM_MAP4": "7" } });
  });
  it("skips blank trailing rows", () => { expect(parseCsv(CSV + "\n\n", "PARCEL", "p.csv")).toHaveLength(2); });
});
