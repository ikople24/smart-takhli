import { describe, it, expect } from "vitest";
import { buildBook } from "./buildBook";
import type { PrintTxnRow } from "./buildSheet";

const raw: Record<string, string> = {
  UTM_MAP1: "5039", UTM_MAP2: "2", UTM_MAP3: "4682", UTM_MAP4: "7", UTM_SCALE: "1000",
  "ที่ดิน": "84", "ห.สำรวจ": "13725", "13 หลัก": "1234567890123",
  "คำนำหน้า": "นาย", "ชื่อ": "ก", "นามสกุล": "ข",
};

let n = 0;
function row(over: Partial<PrintTxnRow> = {}): PrintTxnRow {
  n += 1;
  return {
    txnId: `t${n}`,
    docType: "PARCEL", changeType: "TRANSFER", rawStatus: "ขาย",
    taxRelevant: true, reviewStatus: "confirmed", ltaxStatus: null,
    txnDate: new Date("2026-01-10T00:00:00.000Z"),
    deedNo: "1", recordKey: "k1",
    area: { rai: 0, ngan: 2, wa: 24, sqm: 896 },
    regAmount: null, payloadRaw: raw, parcelCode: null, oldOwnerName: null,
    ...over,
  };
}

describe("buildBook", () => {
  it("แยกหมวดตาม docType แล้ว changeType ตามลำดับคงที่", () => {
    const book = buildBook(
      [
        row({ docType: "NS3A", changeType: "TRANSFER" }),
        row({ docType: "PARCEL", changeType: "MERGE", rawStatus: "ให้ รวมสองโฉนด" }),
        row({ docType: "PARCEL", changeType: "TRANSFER" }),
        row({ docType: "CONSTRUCTION", changeType: "TRANSFER" }),
      ],
      { period: "2569-01" }
    );
    expect(book.sections.map((s) => `${s.docType}/${s.changeType}`)).toEqual([
      "PARCEL/TRANSFER", "PARCEL/MERGE", "CONSTRUCTION/TRANSFER", "NS3A/TRANSFER",
    ]);
    expect(book.periodLabel).toBe("มกราคม 2569");
  });

  it("หมวดที่ไม่มีรายการไม่โผล่ (ไม่มีใบคั่นหน้าเปล่า)", () => {
    const book = buildBook([row({ changeType: "TRANSFER" })], { period: "2569-01" });
    expect(book.sections).toHaveLength(1);
  });

  it("รายการที่ไม่กระทบภาษีขึ้นบัญชีคุมแต่ไม่มีแผ่นงาน", () => {
    const book = buildBook(
      [
        row({ changeType: "TRANSFER", taxRelevant: true }),
        row({ changeType: "ENCUMBRANCE", rawStatus: "จำนอง", taxRelevant: false }),
        row({ changeType: "NOTE", rawStatus: "หมายเหตุสารบัญ", taxRelevant: false }),
      ],
      { period: "2569-01" }
    );
    expect(book.sections).toHaveLength(1);
    expect(book.sections[0].changeType).toBe("TRANSFER");
    expect(book.cover.rows).toHaveLength(3);
    expect(book.cover.totals).toEqual({ all: 3, taxRelevant: 1, nonTaxRelevant: 2, sheets: 1 });
  });

  it("ยอดบนใบปกตรงกับจำนวนแผ่นงานจริงในเล่ม", () => {
    const rows = [
      ...Array.from({ length: 5 }, () => row({ changeType: "TRANSFER" })),
      ...Array.from({ length: 3 }, () => row({ changeType: "MERGE", rawStatus: "ให้ รวมสองโฉนด" })),
      ...Array.from({ length: 2 }, () => row({ changeType: "ENCUMBRANCE", rawStatus: "จำนอง", taxRelevant: false })),
    ];
    const book = buildBook(rows, { period: "2569-01" });
    const sheetCount = book.sections.reduce((a, s) => a + s.sheets.length, 0);
    expect(sheetCount).toBe(8);
    expect(book.cover.totals.sheets).toBe(8);
    expect(book.cover.totals.all).toBe(10);
  });

  it("บัญชีคุมนับ 1 แถวต่อ (ชนิดเอกสาร × rawStatus) และนับคีย์แล้ว/ค้างคีย์", () => {
    const book = buildBook(
      [
        row({ rawStatus: "ขาย", ltaxStatus: "keyed" }),
        row({ rawStatus: "ขาย", ltaxStatus: null }),
        row({ rawStatus: "โอนมรดก", ltaxStatus: "skipped" }),
      ],
      { period: "2569-01" }
    );
    const sale = book.cover.rows.find((r) => r.rawStatus === "ขาย")!;
    expect(sale.count).toBe(2);
    expect(sale.keyed).toBe(1);
    expect(sale.pendingKey).toBe(1);
    const inherit = book.cover.rows.find((r) => r.rawStatus === "โอนมรดก")!;
    expect(inherit.count).toBe(1);
    expect(inherit.keyed).toBe(0);
    expect(inherit.pendingKey).toBe(0);
  });

  it("เรียงแผ่นในหมวดตามวันที่ แล้ว tie-break ด้วยเลขโฉนด → ผลคงที่ พิมพ์ซ้ำได้เหมือนเดิม", () => {
    const rows = [
      row({ deedNo: "300", txnDate: new Date("2026-01-20T00:00:00.000Z") }),
      row({ deedNo: "200", txnDate: new Date("2026-01-05T00:00:00.000Z") }),
      row({ deedNo: "100", txnDate: new Date("2026-01-05T00:00:00.000Z") }),
    ];
    const a = buildBook(rows, { period: "2569-01" });
    const b = buildBook([...rows].reverse(), { period: "2569-01" });
    const order = (bk: ReturnType<typeof buildBook>) => bk.sections[0].sheets.map((s) => s.deedNo);
    expect(order(a)).toEqual(["100", "200", "300"]);
    expect(order(b)).toEqual(["100", "200", "300"]);
  });

  it("ลำดับหน้าเดินต่อเนื่องข้ามหมวด และลำดับในหมวดเริ่มที่ 1", () => {
    const book = buildBook(
      [
        row({ changeType: "TRANSFER", deedNo: "1" }),
        row({ changeType: "TRANSFER", deedNo: "2" }),
        row({ changeType: "MERGE", rawStatus: "ให้ รวมสองโฉนด", deedNo: "3" }),
      ],
      { period: "2569-01" }
    );
    expect(book.sections[0].sheets.map((s) => [s.seqInSection, s.sectionTotal, s.sheetNo]))
      .toEqual([[1, 2, 1], [2, 2, 2]]);
    expect(book.sections[1].sheets.map((s) => [s.seqInSection, s.sectionTotal, s.sheetNo]))
      .toEqual([[1, 1, 3]]);
  });

  it("ไม่มีรายการเลย → เล่มว่างแต่ไม่ throw", () => {
    const book = buildBook([], { period: "2569-01" });
    expect(book.sections).toHaveLength(0);
    expect(book.cover.rows).toHaveLength(0);
    expect(book.cover.totals).toEqual({ all: 0, taxRelevant: 0, nonTaxRelevant: 0, sheets: 0 });
  });
});
