import { describe, it, expect } from "vitest";
import { buildSheet, type PrintTxnRow } from "./buildSheet";

const baseRaw: Record<string, string> = {
  UTM_MAP1: "5039", UTM_MAP2: "2", UTM_MAP3: "4682", UTM_MAP4: "7", UTM_SCALE: "1000",
  "LAND_NO": "84", "SURVEY_NO": "13725",
  "OWN_PERS_ID": "1-2345-67890-12-3", "OWN_TITLE": "นางสาว", "OWN_FNAME": "วรารีย์", "OWN_LNAME": "ชาลีรัตน์",
  OWN_HSE_NO: "99/1", OWN_TAMBOL: "ตาคลี", OWN_AMPHUR: "ตาคลี", OWN_PROVINCE: "นครสวรรค์", OWN_TEL: "0812345678",
};

function row(over: Partial<PrintTxnRow> = {}): PrintTxnRow {
  return {
    txnId: "t1",
    docType: "PARCEL",
    changeType: "TRANSFER",
    rawStatus: "ขาย",
    taxRelevant: true,
    reviewStatus: "confirmed",
    ltaxStatus: null,
    txnDate: new Date("2026-01-05T00:00:00.000Z"),
    deedNo: "31635",
    recordKey: "5039|2|4682|07|1000|84",
    area: { rai: 0, ngan: 2, wa: 24, sqm: 896 },
    regAmount: null,
    payloadRaw: baseRaw,
    parcelCode: null,
    oldOwnerName: null,
    ...over,
  };
}

describe("buildSheet", () => {
  it("หัวแผ่นใช้ rawStatus ดิบจากกรมที่ดิน ไม่ใช่ชื่อหมวด", () => {
    const s = buildSheet(row({ rawStatus: "ขายตามคำสั่งศาล" }), { seqInSection: 1, sectionTotal: 19, sheetNo: 1 });
    expect(s.rawStatus).toBe("ขายตามคำสั่งศาล");
    expect(s.docTypeLabel).toBe("โฉนดที่ดิน");
    expect(s.seqInSection).toBe(1);
    expect(s.sectionTotal).toBe(19);
    expect(s.sheetNo).toBe(1);
  });

  it("เลข 13 หลักมาจาก payloadRaw และเป็นเลขล้วน", () => {
    const s = buildSheet(row(), { seqInSection: 1, sectionTotal: 1, sheetNo: 1 });
    const byLabel = Object.fromEntries(s.owner.map((f) => [f.label, f.value]));
    expect(byLabel["เลขประจำตัวประชาชน"]).toBe("1234567890123");
  });

  it("parcelCode ว่างขึ้นป้าย 'ยังไม่จับคู่'", () => {
    expect(buildSheet(row({ parcelCode: null }), { seqInSection: 1, sectionTotal: 1, sheetNo: 1 }).parcelCode)
      .toBe("ยังไม่จับคู่");
    expect(buildSheet(row({ parcelCode: "01-0012-0034" }), { seqInSection: 1, sectionTotal: 1, sheetNo: 1 }).parcelCode)
      .toBe("01-0012-0034");
  });

  it("นิติกรรมที่มีสคริปต์ได้ steps · นิติกรรมอื่นได้กล่องว่าง", () => {
    const withSteps = buildSheet(row({ changeType: "TRANSFER" }), { seqInSection: 1, sectionTotal: 1, sheetNo: 1 });
    expect(Array.isArray(withSteps.steps)).toBe(true);
    expect(withSteps.steps!.length).toBeGreaterThan(0);
    expect(withSteps.blankResultBox).toBe(false);

    for (const ct of ["MERGE", "NEW", "SPLIT", "SPLIT_PUBLIC", "RETIRED"]) {
      const s = buildSheet(row({ changeType: ct }), { seqInSection: 1, sectionTotal: 1, sheetNo: 1 });
      expect(s.steps).toBeNull();
      expect(s.blankResultBox).toBe(true);
      expect(s.identify.length).toBeGreaterThan(0);
    }
  });

  it("ป้ายสถานะยืนยัน", () => {
    const opt = { seqInSection: 1, sectionTotal: 1, sheetNo: 1 };
    expect(buildSheet(row({ reviewStatus: "confirmed" }), opt).reviewLabel).toBe("ยืนยันแล้ว");
    expect(buildSheet(row({ reviewStatus: "pending" }), opt).reviewLabel).toBe("รอยืนยัน");
    expect(buildSheet(row({ reviewStatus: "auto" }), opt).reviewLabel).toBe("รอยืนยัน");
  });

  it("วันที่เป็น Asia/Bangkok ไม่เลื่อนวันแม้เซิร์ฟเวอร์รัน UTC", () => {
    const s = buildSheet(row({ txnDate: new Date("2026-01-05T17:30:00.000Z") }), { seqInSection: 1, sectionTotal: 1, sheetNo: 1 });
    expect(s.txnDateLabel).toBe("6 ม.ค. 2569");
  });

  it("เจ้าของเดิมพิมพ์เฉพาะเมื่อมีข้อมูล ราคาจดทะเบียนเป็น null ไม่พิมพ์", () => {
    const opt = { seqInSection: 1, sectionTotal: 1, sheetNo: 1 };
    expect(buildSheet(row({ oldOwnerName: null }), opt).previousOwner).toBeNull();
    expect(buildSheet(row({ oldOwnerName: "นายเก่า ใจดี" }), opt).previousOwner).toBe("นายเก่า ใจดี");
    expect(buildSheet(row({ regAmount: null }), opt).regAmountLabel).toBeNull();
    expect(buildSheet(row({ regAmount: 1250000 }), opt).regAmountLabel).toBe("1,250,000 บาท");
  });
});
