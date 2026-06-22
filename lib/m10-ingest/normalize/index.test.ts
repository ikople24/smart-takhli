import { describe, it, expect } from "vitest";
import { normalizeRow } from "./index";
import { DIRTY_PARCEL_ROW } from "../__fixtures__/sampleRows";
import type { RawRow } from "../types";

const parcel: RawRow = { docType: "PARCEL", source: "parcel.csv", raw: DIRTY_PARCEL_ROW };

describe("normalizeRow PARCEL", () => {
  it("normalizes a dirty parcel row end-to-end", () => {
    const out = normalizeRow(parcel);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.txn.changeType).toBe("TRANSFER");
    expect(out.txn.taxRelevant).toBe(true);
    expect(out.txn.reviewStatus).toBe("pending");
    expect(out.txn.rawStatus).toBe("ขาย");
    expect(out.txn.txnDate).toBe("2026-01-05");
    expect(out.txn.regAmount).toBe(304000);
    expect(out.txn.recordKey).toBe("5039|2|4682|07|1000|84");
    expect(out.txn.deedNo).toBe("31635");
    expect(out.txn.owner.fullName).toBe("นางสาว วรารีย์ ชาลีรัตน์");
    expect(out.txn.area?.sqm).toBe(896);
    expect(out.txn.payloadRaw["สถานะดำเนินการ"]).toBe("ขาย");
  });
  it("encumbrance -> reviewStatus auto", () => {
    const raw: RawRow = { docType: "PARCEL", source: "parcel.csv", raw: { ...DIRTY_PARCEL_ROW, "สถานะดำเนินการ ": "จำนอง" } };
    const out = normalizeRow(raw);
    expect(out.ok && out.txn.reviewStatus).toBe("auto");
  });
  it("quarantines unknown status", () => {
    const raw: RawRow = { docType: "PARCEL", source: "parcel.csv", raw: { ...DIRTY_PARCEL_ROW, "สถานะดำเนินการ ": "แปลกๆ" } };
    expect(normalizeRow(raw)).toEqual({ ok: false, reason: "unknown_status" });
  });
});

describe("normalizeRow CONSTRUCTION", () => {
  it("has null recordKey -> reviewStatus auto", () => {
    const raw: RawRow = { docType: "CONSTRUCTION", source: "construction.csv",
      raw: { "สถานะ": "ขาย", "วันที่": "5/1/2569", "REG_AMT": "฿-", "คำนำหน้า": "นาย", "ชื่อ": "ก", "นามสกุล": "ข", "13 หลัก": "1234567890123" } };
    const out = normalizeRow(raw);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.txn.recordKey).toBeNull();
    expect(out.txn.reviewStatus).toBe("auto");
  });
});
