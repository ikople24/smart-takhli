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
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.txn.reviewStatus).toBe("auto");
  });
  it("quarantines unknown status", () => {
    const raw: RawRow = { docType: "PARCEL", source: "parcel.csv", raw: { ...DIRTY_PARCEL_ROW, "สถานะดำเนินการ ": "แปลกๆ" } };
    expect(normalizeRow(raw)).toEqual({ ok: false, reason: "unknown_status" });
  });
  it("missing UTM_MAP1 -> missing_key", () => {
    const raw: RawRow = { docType: "PARCEL", source: "parcel.csv",
      raw: { ...DIRTY_PARCEL_ROW, "UTM_MAP1": "" } };
    expect(normalizeRow(raw)).toEqual({ ok: false, reason: "missing_key" });
  });
});

describe("normalizeRow NS3A", () => {
  const NS3A_ROW: Record<string, string> = {
    "สถานะ": "เอกสารสิทธิที่ยกเลิกระหว่างเดือน",
    "วันที่": "10/3/2569",
    "REG_AMT": "฿-",
    "เลขที่นส3ก": "NS3A-001",
    "UTM_AIRMAP1": "5040",
    "UTM_AIRMAP2": "3",
    "UTM_AIRMAP3": "4700",
    "UTM_SCALE": "4000",
    "ล.ที่ดิน": "12",
    "ไร่": "0", "งาน": "1", "วา": "10", "เศษ": "0",
    "คำนำหน้า": "นาย", "ชื่อ": "สมชาย", "นามสกุล": "ใจดี",
    "OWN_PERS_ID": "1234567890123",
  };

  it("normalizes an NS3A row with RETIRED status", () => {
    const raw: RawRow = { docType: "NS3A", source: "ns3a.csv", raw: NS3A_ROW };
    const out = normalizeRow(raw);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.txn.recordKey).toBe("NS3A|5040|3|4700|4000|12");
    expect(out.txn.deedNo).toBe("NS3A-001");
    expect(out.txn.changeType).toBe("RETIRED");
    expect(out.txn.reviewStatus).toBe("pending");
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
