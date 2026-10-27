import { describe, it, expect } from "vitest";
import { citizenDigits, formatCitizenId, isValidCitizenChecksum, resolveCitizenIds } from "../citizenId";
import { parseSheetRowToPersonAndVisits } from "../import";

// เลขบัตรสมมติทั้งหมด (checksum ผ่านแต่ไม่ใช่ของคนจริง) — repo นี้ public ห้ามใช้เลขจริง
const VALID_A = "1234567890121";
const VALID_B = "3100000000012";
const VALID_C = "3100000000021";

const existing = [
  { _id: "p1", citizenId: "1-2345-67890-12-1", fullName: "นางสมศรี ใจดี" },
  { _id: "p2", citizenId: "3-1000-00000-01-2", fullName: "นายทองดี มีสุข" },
];

const entry = (citizenId, fullName) => ({ row: 2, parsed: { skip: false, person: { citizenId, fullName }, visits: [], issues: [] } });

describe("formatCitizenId / checksum", () => {
  it("แปลงทุกรูปแบบเป็นรูปแบบในระบบ", () => {
    expect(formatCitizenId(VALID_A)).toBe("1-2345-67890-12-1");
    expect(formatCitizenId("1,234,567,890,121")).toBe("1-2345-67890-12-1");
    expect(formatCitizenId("12345")).toBeNull();
    expect(citizenDigits("1-2345-67890-12-1")).toBe(VALID_A);
    expect(isValidCitizenChecksum(VALID_A)).toBe(true);
    expect(isValidCitizenChecksum("1234567890123")).toBe(false);
  });
});

describe("resolveCitizenIds", () => {
  it("คนเดิม: เลขไม่มีขีด/มีจุลภาค ยังจับคู่ได้ และใช้เลขตามที่เก็บในระบบ", () => {
    const es = [entry(VALID_A, "นางสมศรี ใจดี"), entry("3,100,000,000,012", "นายทองดี มีสุข")];
    expect(resolveCitizenIds(es, existing)).toEqual({ existing: 2, created: 0, changed: 0 });
    expect(es[0].parsed.person.citizenId).toBe("1-2345-67890-12-1");
    expect(es[1].parsed.person.citizenId).toBe("3-1000-00000-01-2");
    expect(es[0].parsed.isNew).toBe(false);
  });

  it("คนใหม่: เก็บเป็นรูปแบบมีขีด", () => {
    const es = [entry(VALID_C, "นางมาลี ใหม่เอี่ยม")];
    expect(resolveCitizenIds(es, existing)).toEqual({ existing: 0, created: 1, changed: 0 });
    expect(es[0].parsed.person.citizenId).toBe("3-1000-00000-02-1");
    expect(es[0].parsed.isNew).toBe(true);
    expect(es[0].parsed.issues).toEqual([]);
  });

  it("เลขไม่ครบ 13 หลัก หรือเป็นทศนิยม → ข้ามพร้อมเหตุผล", () => {
    const es = [entry("31000000000123", "นางก ข"), entry("3.10000000001", "นางค ง")];
    resolveCitizenIds(es, existing);
    expect(es[0].parsed.skip).toBe(true);
    expect(es[0].parsed.reasonTh).toContain("14 หลัก");
    expect(es[1].parsed.reasonTh).toContain("ทศนิยม");
  });

  it("ชื่อตรงคนเดิมแต่เลขบัตรต่าง → ผูกคนเดิม ใช้เลขจากชีตล่าสุด + เก็บเลขเดิม (ไม่สร้างคนซ้ำ)", () => {
    const es = [entry(VALID_C, "นางสมศรี  ใจดี")];
    expect(resolveCitizenIds(es, existing)).toEqual({ existing: 1, created: 0, changed: 1 });
    const p = es[0].parsed;
    expect(p.skip).toBe(false);
    expect(p.isNew).toBe(false);
    expect(p.person.citizenId).toBe("3-1000-00000-02-1");
    expect(p.person.fullName).toBe("นางสมศรี ใจดี");
    expect(p.replacesCitizenId).toBe("1-2345-67890-12-1");
    expect(p.existingPersonId).toBe("p1");
    expect(p.issues.join()).toContain("ใช้เลขจากชีตนี้แทน");
  });

  it("checksum ไม่ผ่าน → ยังนำเข้า แต่เตือน", () => {
    const es = [entry("1234567890123", "นางใหม่ ทดสอบ")];
    resolveCitizenIds(es, existing);
    expect(es[0].parsed.skip).toBe(false);
    expect(es[0].parsed.issues.join()).toContain("checksum");
  });
});

describe("parseSheetRowToPersonAndVisits — ชีตใบสมัคร (ชื่อ/สกุลแยก)", () => {
  const headers = [
    "เลขที่", "ชื่อ", "สกุล", "วัน", "เดือน", "ปี", "เลขบัตรประจำตัวประชาชน", "อายุ",
    "ชุมชน", "เลขที่", "ถนน/ซอย", "เบอร์โทร", "โรคประจำตัว", "หมายเหตุ",
  ];
  it("รวมชื่อ วันเกิด ที่อยู่ และเก็บชุมชน/โรคประจำตัว", () => {
    const row = ["1", "นางสมศรี", "ใจดี", "1", "เม.ย.", "2502", VALID_B, "68", "ตีคลี", "99/21", "ซอยตีคลี 6", "0812345678", "ความดัน", "เก่า"];
    const r = parseSheetRowToPersonAndVisits({ headers, row, yearBE: 2570 });
    expect(r.skip).toBe(false);
    expect(r.person).toMatchObject({
      fullName: "นางสมศรี ใจดี",
      citizenId: VALID_B,
      ageYears: 68,
      birthDateText: "1 เม.ย. 2502",
      address: "99/21 ซอยตีคลี 6",
      community: "ตีคลี",
      chronicDiseases: "ความดัน",
      phone: "0812345678",
    });
    expect(r.visits).toEqual([]);
  });

  it('ช่อง "-" ไม่ถือเป็นข้อมูล (ไม่ทับค่าเดิม)', () => {
    const row = ["2", "นายทองดี", "มีสุข", "", "-", "2493", VALID_A, "76", "เขาใบไม้", "14", "", "-", "", ""];
    const r = parseSheetRowToPersonAndVisits({ headers, row, yearBE: 2570 });
    expect(r.person.birthDateText).toBe("2493");
    expect(r.person.phone).toBeNull();
    expect(r.person.address).toBe("14");
    expect(r.person.chronicDiseases).toBeNull();
  });
});
