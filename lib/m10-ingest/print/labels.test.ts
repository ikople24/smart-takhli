import { describe, it, expect } from "vitest";
import { docTypeLabel, changeTypeLabel, docTypeRank, changeTypeRank, periodLabel } from "./labels";

describe("labels", () => {
  it("แปลง docType เป็นชื่อไทย", () => {
    expect(docTypeLabel("PARCEL")).toBe("โฉนดที่ดิน");
    expect(docTypeLabel("CONSTRUCTION")).toBe("สิ่งปลูกสร้าง");
    expect(docTypeLabel("NS3A")).toBe("น.ส.3ก");
  });

  it("แปลง changeType เป็นชื่อไทย และกำกับว่าไม่กระทบภาษี", () => {
    expect(changeTypeLabel("TRANSFER")).toBe("โอนกรรมสิทธิ์");
    expect(changeTypeLabel("SPLIT_PUBLIC")).toBe("แบ่งหักเป็นที่สาธารณประโยชน์");
    expect(changeTypeLabel("ENCUMBRANCE")).toBe("จำนอง/ไถ่ถอน (ไม่กระทบภาษี)");
  });

  it("ค่าที่ไม่รู้จักคืนค่าเดิม ไม่ throw (ข้อมูลกรมที่ดินอาจมีของใหม่)", () => {
    expect(docTypeLabel("WEIRD")).toBe("WEIRD");
    expect(changeTypeLabel("WEIRD")).toBe("WEIRD");
    expect(docTypeLabel(null)).toBe("-");
  });

  it("ลำดับหมวดคงที่ ของไม่รู้จักไปท้ายสุด", () => {
    expect(docTypeRank("PARCEL")).toBeLessThan(docTypeRank("CONSTRUCTION"));
    expect(docTypeRank("CONSTRUCTION")).toBeLessThan(docTypeRank("NS3A"));
    expect(docTypeRank("WEIRD")).toBe(99);
    expect(changeTypeRank("TRANSFER")).toBeLessThan(changeTypeRank("MERGE"));
    expect(changeTypeRank("OWNER_CORRECTION")).toBeLessThan(changeTypeRank("ENCUMBRANCE"));
    expect(changeTypeRank("WEIRD")).toBe(99);
  });

  it("periodLabel เป็นชื่อเดือนเต็ม + พ.ศ.", () => {
    expect(periodLabel("2569-01")).toBe("มกราคม 2569");
    expect(periodLabel("2569-12")).toBe("ธันวาคม 2569");
    expect(periodLabel("mangled")).toBe("mangled");
    expect(periodLabel("")).toBe("-");
  });
});
