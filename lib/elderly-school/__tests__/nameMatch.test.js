import { describe, it, expect } from "vitest";
import { nameKey, looseNameKey, buildNameMatcher, resolveMissingCitizenIds } from "../nameMatch";

const people = [
  { _id: "a", citizenId: "3100000000011", fullName: "นาง กมลวรรณ  วรรณสิทธิ์" },
  { _id: "b", citizenId: "3100000000022", fullName: "นางสาวสมคิด กระแสร์สิน" },
  { _id: "c", citizenId: "3100000000033", fullName: "นายน้อย คงเพชร" },
  { _id: "d", citizenId: "3100000000044", fullName: "นายน้อย คงเพชร" },
  { _id: "e", citizenId: "3100000000055", fullName: "ร.ต.ต.ปรีชา น้อยสอน" },
];

describe("nameKey / looseNameKey", () => {
  it("ไม่สนช่องว่าง และตัดคำนำหน้าแบบหลวม (นางสาว ก่อน นาง)", () => {
    expect(nameKey(" นาง กมลวรรณ  วรรณสิทธิ์ ")).toBe("นางกมลวรรณวรรณสิทธิ์");
    expect(looseNameKey("นางสาวสมคิด กระแสร์สิน")).toBe("สมคิดกระแสร์สิน");
    expect(looseNameKey("นาง สมคิด กระแสร์สิน")).toBe("สมคิดกระแสร์สิน");
  });
});

describe("buildNameMatcher", () => {
  const match = buildNameMatcher(people);
  it("ตรงเป๊ะ (ไม่สนช่องว่าง)", () => {
    expect(match("นางกมลวรรณ วรรณสิทธิ์")).toMatchObject({ status: "exact", person: { _id: "a" } });
  });
  it("ต่างแค่คำนำหน้า → loose", () => {
    expect(match("นางสมคิด กระแสร์สิน")).toMatchObject({ status: "loose", person: { _id: "b" } });
  });
  it("ชื่อซ้ำหลายคน → ambiguous", () => {
    expect(match("นายน้อย คงเพชร")).toEqual({ status: "ambiguous", count: 2 });
  });
  it("ยศไม่ถูกตัด → ต้องพิมพ์ตรง", () => {
    expect(match("ร.ต.ต.ปรีชา น้อยสอน").status).toBe("exact");
    expect(match("ปรีชา น้อยสอน").status).toBe("none");
  });
});

describe("resolveMissingCitizenIds", () => {
  const entry = (row, name) => ({
    row,
    parsed: { skip: false, needsNameMatch: true, person: { citizenId: null, fullName: name }, visits: [], issues: [] },
  });
  it("เติมเลขบัตรคนเดิม, ข้ามคนใหม่/ชื่อซ้ำพร้อมเหตุผล, ไม่แตะแถวที่มีเลขบัตร", () => {
    const withId = { row: 9, parsed: { skip: false, person: { citizenId: "3100000000099", fullName: "x" }, issues: [] } };
    const entries = [entry(2, "นางกมลวรรณ วรรณสิทธิ์"), entry(3, "นางสมคิด กระแสร์สิน"), entry(4, "นายน้อย คงเพชร"), entry(5, "นางใหม่ มาเรียน"), withId];
    expect(resolveMissingCitizenIds(entries, people)).toEqual({ matched: 2, unmatched: 2 });
    expect(entries[0].parsed.person).toMatchObject({ citizenId: "3100000000011", fullName: "นาง กมลวรรณ  วรรณสิทธิ์" });
    expect(entries[0].parsed.issues[0]).toContain("จับคู่กับผู้เรียนเดิมจากชื่อ");
    expect(entries[1].parsed.issues[0]).toContain("ไม่นับคำนำหน้า");
    expect(entries[2].parsed).toMatchObject({ skip: true, fullName: "นายน้อย คงเพชร" });
    expect(entries[2].parsed.reasonTh).toContain("2 คน");
    expect(entries[3].parsed.reasonTh).toBe("ไม่มีเลขบัตร และไม่พบชื่อนี้ในระบบ (ผู้เรียนใหม่ต้องมีเลขบัตร)");
    expect(entries[4].parsed.person.citizenId).toBe("3100000000099");
  });
});
