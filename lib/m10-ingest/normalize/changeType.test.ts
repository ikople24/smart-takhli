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
    // กฎกลุ่มครอบเฉพาะรูปแบบที่พิสูจน์แล้ว ชื่อใหม่ล้วน ๆ ต้องไม่ถูกเดาให้
    expect(classifyStatus("นิติกรรมที่ไม่มีอยู่จริง")).toBeNull();
    expect(classifyStatus("โอนตามคำพิพากษาแบบที่ยังไม่เคยเจอ")).toBeNull();
    // วงเล็บท้ายถูกตัดแล้วยังไม่เจอชื่อฐานใน dict → ยังกักอยู่
    expect(classifyStatus("นิติกรรมใหม่ (มีเงื่อนไข)")).toBeNull();
  });
});

describe("นิติกรรมงวด 2569-03..05 (เจ้าของงานยืนยันการจัดหมวด)", () => {
  it("กลุ่มกระทบกรรมสิทธิ์", () => {
    expect(classifyStatus("โอนชำระหนี้จำนอง")).toEqual({ changeType: "TRANSFER", taxRelevant: true });
    expect(classifyStatus("ขายฝาก มีกำหนด หนึ่งปี")).toEqual({ changeType: "TRANSFER", taxRelevant: true });
    expect(classifyStatus("ลงชื่อคู่สมรส")).toEqual({ changeType: "TRANSFER_PARTIAL", taxRelevant: true });
    expect(classifyStatus("กรรมสิทธิ์รวม (ไม่มีค่าตอบแทน)")).toEqual({ changeType: "TRANSFER_PARTIAL", taxRelevant: true });
  });

  it("กลุ่มแก้ชื่อผู้ถือ", () => {
    expect(classifyStatus("แก้คำนำหน้านามและชื่อสกุล")).toEqual({ changeType: "OWNER_CORRECTION", taxRelevant: true });
    expect(classifyStatus("แก้ชื่อสกุล (ราชการให้เปลี่ยนชื่อสกุล)")).toEqual({ changeType: "OWNER_CORRECTION", taxRelevant: true });
  });

  it("กลุ่มภาระผูกพัน — ไม่กระทบฐานภาษี", () => {
    for (const n of [
      "ไถ่ถอนจากจำนองเฉพาะส่วน", "แบ่งไถ่ถอนจากจำนอง", "ปลอดจำนอง",
      "ภาระจำยอม (ไม่มีค่าตอบแทน)", "สิทธิเก็บกิน (ตลอดชีวิตของผู้ทรงสิทธิ)",
    ]) {
      expect(classifyStatus(n), n).toEqual({ changeType: "ENCUMBRANCE", taxRelevant: false });
    }
  });

  it("ขยายเวลาไถ่จากขายฝาก — วงเล็บท้ายถูกตัดด้วยกฎ B แล้วเจอชื่อฐาน", () => {
    expect(classifyStatus("ขยายกำหนดเวลาไถ่จากขายฝากครั้งที่สาม (กำหนดสองปี )"))
      .toEqual({ changeType: "ENCUMBRANCE", taxRelevant: false });
  });
});

describe('กฎกลุ่ม — "ลำดับที่/ครั้งที่" และ "เฉพาะส่วน" (พบในงวด 2569-06..08)', () => {
  it('จำนองลำดับที่เท่าไหร่ก็ยังเป็นจำนอง ไม่กระทบภาษี', () => {
    for (const n of ["จำนองลำดับที่สาม", "จำนองลำดับที่สี่", "จำนองลำดับที่สิบ"]) {
      expect(classifyStatus(n), n).toEqual({ changeType: "ENCUMBRANCE", taxRelevant: false });
    }
    // ต้องตรงกับรายการที่ใส่มือไว้เดิม
    expect(classifyStatus("จำนองลำดับที่สาม")).toEqual(classifyStatus("จำนองลำดับที่สอง"));
  });

  it("ขยายเวลาไถ่จากขายฝาก ครั้งที่เท่าไหร่ก็ครอบหมด (ตัดวงเล็บ + ครั้งที่)", () => {
    for (const n of [
      "ขยายกำหนดเวลาไถ่จากขายฝากครั้งที่หนึ่ง (กำหนดหนึ่งปี )",
      "ขยายกำหนดเวลาไถ่จากขายฝากครั้งที่สอง (กำหนดสามเดือน )",
      "ขยายกำหนดเวลาไถ่จากขายฝากครั้งที่สาม (กำหนดสองปี )",
      "ขยายกำหนดเวลาไถ่จากขายฝากครั้งที่สิบ",
    ]) {
      expect(classifyStatus(n), n).toEqual({ changeType: "ENCUMBRANCE", taxRelevant: false });
    }
  });

  it('"เฉพาะส่วน" ของการโอน → โอนเฉพาะส่วน · ของภาระผูกพัน → คงเป็นภาระผูกพัน', () => {
    expect(classifyStatus("ขายเฉพาะส่วน")).toEqual({ changeType: "TRANSFER_PARTIAL", taxRelevant: true });
    expect(classifyStatus("โอนมรดกเฉพาะส่วน")).toEqual({ changeType: "TRANSFER_PARTIAL", taxRelevant: true });
    // ฐานไม่ใช่การโอน → ไม่แปลงเป็น TRANSFER_PARTIAL
    expect(classifyStatus("ไถ่ถอนจากจำนองเฉพาะส่วน")).toEqual({ changeType: "ENCUMBRANCE", taxRelevant: false });
    expect(classifyStatus("ผู้จัดการมรดกเฉพาะส่วน")).toEqual({ changeType: "OWNER_CORRECTION", taxRelevant: true });
  });

  it("กฎไม่ลามไปเดาของที่ไม่รู้จัก", () => {
    expect(classifyStatus("เฉพาะส่วน")).toBeNull();
    expect(classifyStatus("นิติกรรมใหม่เฉพาะส่วน")).toBeNull();
    expect(classifyStatus("ลำดับที่สอง")).toBeNull();
    expect(classifyStatus("ครั้งที่หนึ่ง")).toBeNull();
  });
});
