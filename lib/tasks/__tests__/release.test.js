import { describe, it, expect } from "vitest";
import { releaseCheck, departmentToRestore } from "../release";

const fresh = { stage: "received", completedAt: null, solution: [], solutionImages: [], timeline: [{ kind: "created" }] };

describe("releaseCheck — คืนงานเข้ากองงานรอรับ", () => {
  it("เจ้าของงานที่ยังไม่เริ่มทำ → คืนได้ (มีโน้ต/คำขอโอนใน timeline ก็ยังคืนได้)", () => {
    expect(releaseCheck({ assignment: { ...fresh, timeline: [{ kind: "created" }, { kind: "transfer" }] }, isOwner: true })).toEqual({ ok: true });
  });
  it("superadmin คืนแทนได้ · คนอื่นคืนไม่ได้", () => {
    expect(releaseCheck({ assignment: fresh, isSuperAdmin: true }).ok).toBe(true);
    expect(releaseCheck({ assignment: fresh }).ok).toBe(false);
  });
  it("งานเก่าที่ไม่มี stage ถือว่ายังรับเรื่อง", () => {
    expect(releaseCheck({ assignment: { completedAt: null }, isOwner: true }).ok).toBe(true);
  });
  it.each([
    ["ปิดแล้ว", { completedAt: new Date() }],
    ["ลงพื้นที่แล้ว", { stage: "site_visit" }],
    ["มีผลการแก้ไข", { solution: ["ตัดกิ่ง"] }],
    ["มีภาพผลงาน", { solutionImages: ["https://x"] }],
    ["ประสานหน่วยงานภายนอก", { coordination: { agencyName: "กฟภ." } }],
    ["รอวัสดุ", { blocked: { isBlocked: true } }],
  ])("%s → คืนไม่ได้", (_, over) => {
    const r = releaseCheck({ assignment: { ...fresh, ...over }, isOwner: true });
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });
});

describe("departmentToRestore — คืนกองเดิมถ้าตอนรับย้ายกองไว้", () => {
  it("ไม่มีการย้าย → ไม่แตะ", () => {
    expect(departmentToRestore({ currentDepartment: "กองช่าง", moves: [] })).toEqual({ restore: false });
  });
  it("ย้ายตอนรับ และกองยังเป็นกองที่ย้ายเข้า → คืนกองเดิม", () => {
    expect(
      departmentToRestore({ currentDepartment: "กองการประปา", moves: [{ before: { department: "กองช่าง" }, after: { department: "กองการประปา" } }] })
    ).toEqual({ restore: true, department: "กองช่าง" });
  });
  it('เดิมไม่ได้ระบุกอง → คืนเป็น "" (ให้ระบบเดาจากหมวด)', () => {
    expect(departmentToRestore({ currentDepartment: "กองการประปา", moves: [{ before: { department: "" }, after: { department: "กองการประปา" } }] })).toEqual({
      restore: true,
      department: "",
    });
  });
  it("มีคนเปลี่ยนกองเองทีหลัง → ไม่แตะ", () => {
    expect(departmentToRestore({ currentDepartment: "กองคลัง", moves: [{ before: { department: "กองช่าง" }, after: { department: "กองการประปา" } }] })).toEqual({
      restore: false,
    });
  });
});
