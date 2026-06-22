import { describe, it, expect } from "vitest";
import { classifyStatus } from "./changeType";
import { REAL_PARCEL_STATUSES, NS3A_EXTRA_STATUSES } from "../__fixtures__/sampleRows";

describe("classifyStatus", () => {
  it("maps a known status", () => {
    expect(classifyStatus("ขาย")).toEqual({ changeType: "TRANSFER", taxRelevant: true });
  });
  it("maps the real 'ครั้งที่หนึ่ง' variant", () => {
    expect(classifyStatus("ขึ้นเงินจากจำนอง ครั้งที่หนึ่ง"))
      .toEqual({ changeType: "ENCUMBRANCE", taxRelevant: false });
  });
  it("returns null for unknown (caller quarantines)", () => {
    expect(classifyStatus("สถานะที่ไม่เคยเห็น")).toBeNull();
  });
  it.each([...REAL_PARCEL_STATUSES, ...NS3A_EXTRA_STATUSES])(
    "maps real status %s", ({ status, changeType, taxRelevant }) => {
      expect(classifyStatus(status)).toEqual({ changeType, taxRelevant });
    });
});
