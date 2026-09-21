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

describe("กฎกลุ่ม — ไม่ต้องไล่ใส่ชื่อทีละอันทุกเดือน", () => {
  it('ลงท้าย "รวม N โฉนด" = รวมโฉนด ไม่ว่าจำนวนจะเขียนเป็นคำไทยอะไร', () => {
    for (const name of [
      "ขาย รวมสิบหกโฉนด",
      "ขาย รวมเก้าโฉนด",
      "จำนองลำดับที่สอง รวมสิบโฉนด",
      "ไถ่ถอนจากจำนอง รวมห้าโฉนด",
      "ระงับจำนอง (ศาลขายบังคับจำนอง) รวมสองโฉนด",
      "ขายตามคำสั่งศาลรวมสองโฉนด", // ไม่มีเว้นวรรคก็ต้องจับได้
      "ไถ่จากขายฝาก รวมสองโฉนด",
    ]) {
      expect(classifyStatus(name), name).toEqual({ changeType: "MERGE", taxRelevant: true });
    }
  });

  it("ชื่อที่ใส่มือไว้เดิมยังให้ผลเหมือนเดิม (กฎใหม่ไม่ทับของเก่า)", () => {
    expect(classifyStatus("ไถ่ถอนจากจำนอง รวมสองโฉนด")).toEqual({ changeType: "MERGE", taxRelevant: true });
    expect(classifyStatus("ขาย")).toEqual({ changeType: "TRANSFER", taxRelevant: true });
    expect(classifyStatus("จำนอง")).toEqual({ changeType: "ENCUMBRANCE", taxRelevant: false });
  });

  it("วงเล็บต่อท้ายเป็นคำขยาย ไม่เปลี่ยนชนิดนิติกรรม", () => {
    expect(classifyStatus("โอนมรดก (ระหว่างจำนอง)")).toEqual(classifyStatus("โอนมรดก"));
    expect(classifyStatus("โอนมรดกเฉพาะส่วน (ระหว่างจำนอง)")).toEqual(classifyStatus("โอนมรดกเฉพาะส่วน"));
  });

  it("ลงท้ายด้วยคำว่าโฉนดเฉย ๆ แต่ไม่มีคำว่ารวม → ไม่เข้ากฎ", () => {
    expect(classifyStatus("ออกใบแทนโฉนด")).toBeNull();
  });

  it("นิติกรรมที่ยังไม่เคยเจอ ยังถูกกักไว้ให้คนตัดสิน ไม่เดาให้", () => {
    expect(classifyStatus("ลงชื่อคู่สมรส")).toBeNull();
    expect(classifyStatus("ปลอดจำนอง")).toBeNull();
    expect(classifyStatus("นิติกรรมที่ไม่มีอยู่จริง")).toBeNull();
  });
});
