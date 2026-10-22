import { describe, it, expect } from "vitest";
import { collectProblems, problemsToCsv } from "../importProblems";
import { parseSheetRowToPersonAndVisits, measurementIssue, bpIssue } from "../import";

describe("measurementIssue / bpIssue", () => {
  it("อ่านไม่ได้ / นอกช่วง / ปกติ", () => {
    expect(measurementIssue("weightKg", "abc", null, 3)).toContain("น้ำหนักครั้งที่ 3 อ่านไม่ได้");
    expect(measurementIssue("weightKg", "685", 685, 3)).toContain("ผิดปกติ");
    expect(measurementIssue("weightKg", "68.5", 68.5, 3)).toBeNull();
    expect(measurementIssue("weightKg", "", null, 3)).toBeNull();
    expect(bpIssue("1288/84", { sys: null, dia: null }, 1, 6)).toContain("ความดันรอบ 1 ครั้งที่ 6 อ่านไม่ได้");
    expect(bpIssue("80/120", { sys: 80, dia: 120 }, 2, 1)).toContain("ผิดปกติ");
    expect(bpIssue("120/80", { sys: 120, dia: 80 }, 1, 1)).toBeNull();
  });
});

describe("parseSheetRowToPersonAndVisits — issues", () => {
  const headers = ["ชื่อ-นามสกุล", "เลขประจำตัวประชาชน", "ส่วนสูง", "การวัดความดันโลหิต ครั้งที่ 1"];
  it("แจ้งเตือนแต่ยังนำเข้าค่าอื่น", () => {
    const r = parseSheetRowToPersonAndVisits({ headers, row: ["นางทองใบ", "12345", "155", "1288/84"], yearBE: 2569 });
    expect(r.skip).toBe(false);
    expect(r.issues).toEqual(["เลขบัตรประชาชนไม่ครบ 13 หลัก", 'ความดันรอบ 1 ครั้งที่ 1 อ่านไม่ได้ ("1288/84") — ใช้รูปแบบ 120/80']);
  });
  it("ข้ามแถวพร้อมเหตุผลภาษาไทย", () => {
    const r = parseSheetRowToPersonAndVisits({ headers, row: ["นายประยูร", "", "160", ""], yearBE: 2569 });
    expect(r).toMatchObject({ skip: true, reasonTh: "ไม่มีเลขบัตรประชาชน", fullName: "นายประยูร" });
  });
});

describe("collectProblems / problemsToCsv", () => {
  const ok = (id, name, issues = []) => ({ skip: false, person: { citizenId: id, fullName: name }, issues });
  it("รวมแถวข้าม คำเตือน และเลขบัตรซ้ำ", () => {
    const out = collectProblems([
      { row: 2, parsed: ok("3100000001000", "ก") },
      { row: 3, parsed: { skip: true, reasonTh: "ไม่มีเลขบัตรประชาชน", fullName: "ข" } },
      { row: 4, parsed: ok("3100000001000", "ก ซ้ำ", ["น้ำหนักครั้งที่ 2 685 กก. ผิดปกติ"]) },
    ]);
    expect(out).toMatchObject({ skippedRows: 1, warningRows: 1, warnings: 2, truncated: false });
    expect(out.problems.map((p) => [p.row, p.level])).toEqual([[3, "skip"], [4, "warn"], [4, "warn"]]);
    expect(out.problems[2].message).toBe("เลขบัตรซ้ำกับแถว 2 — ใช้ข้อมูลแถวหลังสุดแทน");
  });
  it("CSV มี BOM และ escape เครื่องหมายคำพูด", () => {
    const csv = problemsToCsv([{ row: 6, level: "warn", fullName: "นาง ก", citizenLast4: "1000", message: 'อ่านไม่ได้ ("1288/84")' }]);
    expect(csv.startsWith("﻿แถวในชีต,")).toBe(true);
    expect(csv).toContain('6,เตือน,นาง ก,1000,"อ่านไม่ได้ (""1288/84"")"');
  });
});
