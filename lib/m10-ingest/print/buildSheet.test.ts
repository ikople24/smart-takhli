import { describe, it, expect } from "vitest";
import { buildSheet, type PrintTxnRow } from "./buildSheet";

const baseRaw: Record<string, string> = {
  OWN_LINE_NO: "1",
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
    coOwnerRows: [],
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
    const byLabel = Object.fromEntries(s.owners[0].fields.map((f) => [f.label, f.value]));
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

describe("buildSheet — เจ้าของร่วม", () => {
  const opt = { seqInSection: 1, sectionTotal: 1, sheetNo: 1 };

  it("มีช่องโทรศัพท์และที่อยู่ครบบนแผ่นงาน — ขึ้นค่าทันทีถ้าไฟล์กรมที่ดินกรอกมา", () => {
    // ข้อมูลจริงงวด 2569-01/02 OWN_TEL ว่างทั้ง 176 รายการ แต่ช่องต้องพร้อมรับค่า
    const s = buildSheet(row({ payloadRaw: { ...baseRaw, OWN_TEL: "0812345678" } }), opt);
    const byLabel = Object.fromEntries(s.owners[0].fields.map((f) => [f.label, f.value]));
    expect(byLabel["โทรศัพท์"]).toBe("0812345678");
    expect(byLabel["บ้านเลขที่"]).toBe("99/1");
    expect(byLabel["ตำบล"]).toBe("ตาคลี");
    expect(byLabel["จังหวัด"]).toBe("นครสวรรค์");
  });

  it("ไม่มีเบอร์โทรในไฟล์ → ช่องยังอยู่แต่ค่าว่าง (แผ่นงานพิมพ์เป็นขีด)", () => {
    const s = buildSheet(row({ payloadRaw: { ...baseRaw, OWN_TEL: "" } }), opt);
    const tel = s.owners[0].fields.find((f) => f.label === "โทรศัพท์");
    expect(tel).toBeDefined();
    expect(tel?.value).toBe("");
  });

  it("เจ้าของคนเดียว → owners มีรายการเดียว พร้อมลำดับที่", () => {
    const s = buildSheet(row(), opt);
    expect(s.owners).toHaveLength(1);
    expect(s.owners[0].lineNo).toBe("1");
    expect(s.hasCoOwners).toBe(false);
  });

  it("เจ้าของร่วมหลายคน → พิมพ์ครบทุกคนเรียงตามลำดับที่ พร้อมเลขบัตรของแต่ละคน", () => {
    const s = buildSheet(
      row({
        coOwnerRows: [
          { ...baseRaw, OWN_LINE_NO: "3", OWN_FNAME: "สาม", OWN_LNAME: "สามสกุล", "OWN_PERS_ID": "3333333333333" },
          { ...baseRaw, OWN_LINE_NO: "2", OWN_FNAME: "สอง", OWN_LNAME: "สองสกุล", "OWN_PERS_ID": "2222222222222" },
        ],
      }),
      opt
    );
    expect(s.owners.map((o) => o.lineNo)).toEqual(["1", "2", "3"]);
    expect(s.hasCoOwners).toBe(true);
    const idOf = (i: number) =>
      s.owners[i].fields.find((f) => f.label === "เลขประจำตัวประชาชน")?.value;
    expect(idOf(0)).toBe("1234567890123");
    expect(idOf(1)).toBe("2222222222222");
    expect(idOf(2)).toBe("3333333333333");
    const nameOf = (i: number) => s.owners[i].fields.find((f) => f.label === "ชื่อ")?.value;
    expect(nameOf(1)).toBe("สอง");
    expect(nameOf(2)).toBe("สาม");
  });

  it("แถวเจ้าของร่วมไม่มี OWN_LINE_NO → ยังพิมพ์ได้ ไม่ throw", () => {
    const noLine = { ...baseRaw };
    delete noLine.OWN_LINE_NO;
    const s = buildSheet(row({ coOwnerRows: [noLine] }), opt);
    expect(s.owners).toHaveLength(2);
    expect(s.hasCoOwners).toBe(true);
  });
});
