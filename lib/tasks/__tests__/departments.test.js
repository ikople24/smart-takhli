// เทสต์ทะเบียน "กอง" ของเทศบาล — ข้อมูลจริง users.department สะกดไม่ตรงกัน ต้อง normalize ให้เป็นชื่อมาตรฐาน
import { describe, it, expect } from "vitest";
import { DEPARTMENTS, normalizeDepartment, departmentShort, defaultDepartmentForCategory } from "../departments";

describe("DEPARTMENTS — ทะเบียนกองมาตรฐาน", () => {
  it("มีกองหลักที่ปรากฏในข้อมูลจริง และชื่อไม่ซ้ำ", () => {
    const names = DEPARTMENTS.map((d) => d.name);
    for (const n of ["กองช่าง", "กองสาธารณสุขและสิ่งแวดล้อม", "กองการประปา", "งานป้องกันและบรรเทาสาธารณภัย", "สำนักปลัดเทศบาล", "กองคลัง"]) {
      expect(names).toContain(n);
    }
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("normalizeDepartment — ค่าที่พิมพ์ในโปรไฟล์ → ชื่อมาตรฐาน", () => {
  it("ชื่อเต็ม / ชื่อย่อ / สะกดในข้อมูลจริง → ชื่อมาตรฐานเดียวกัน", () => {
    expect(normalizeDepartment("กองช่าง")).toBe("กองช่าง");
    expect(normalizeDepartment(" กองช่าง ")).toBe("กองช่าง");
    expect(normalizeDepartment("สำนักปลัดฯ")).toBe("สำนักปลัดเทศบาล");
    expect(normalizeDepartment("สำนักปลัดเทศบาล")).toBe("สำนักปลัดเทศบาล");
    expect(normalizeDepartment("ป้องกันฯ")).toBe("งานป้องกันและบรรเทาสาธารณภัย");
    expect(normalizeDepartment("งานป้องกันและบรรเทาสาธารณภัย")).toBe("งานป้องกันและบรรเทาสาธารณภัย");
    expect(normalizeDepartment("กองสาธารณสุขฯ")).toBe("กองสาธารณสุขและสิ่งแวดล้อม");
    expect(normalizeDepartment("กองการประปา")).toBe("กองการประปา");
  });
  it("ไม่รู้จัก / ว่าง → null (ไม่เดา)", () => {
    expect(normalizeDepartment("สารสนเทศ")).toBeNull();
    expect(normalizeDepartment("")).toBeNull();
    expect(normalizeDepartment(null)).toBeNull();
  });
});

describe("departmentShort — ชื่อย่อสำหรับหัวคอลัมน์", () => {
  it("กองยาวมีชื่อย่อ กองสั้นใช้ชื่อเดิม ไม่รู้จักคืนตามที่ส่งมา", () => {
    expect(departmentShort("กองสาธารณสุขและสิ่งแวดล้อม")).toBe("กองสาธารณสุขฯ");
    expect(departmentShort("งานป้องกันและบรรเทาสาธารณภัย")).toBe("งานป้องกันฯ");
    expect(departmentShort("กองช่าง")).toBe("กองช่าง");
    expect(departmentShort("อะไรก็ไม่รู้")).toBe("อะไรก็ไม่รู้");
  });
});

describe("defaultDepartmentForCategory — กองที่น่าจะรับผิดชอบตามประเภทเรื่อง (ค่าเสนอแนะ)", () => {
  it("ประเภทใน menu_list จริง → กอง", () => {
    expect(defaultDepartmentForCategory("ไฟส่องสว่าง")).toBe("กองช่าง");
    expect(defaultDepartmentForCategory("ถนน/ทางเท้า")).toBe("กองช่าง");
    expect(defaultDepartmentForCategory("น้ำประปา")).toBe("กองการประปา");
    expect(defaultDepartmentForCategory("ขยะมูลฝอย")).toBe("กองสาธารณสุขและสิ่งแวดล้อม");
    expect(defaultDepartmentForCategory("สัตว์เลี้ยง")).toBe("กองสาธารณสุขและสิ่งแวดล้อม");
  });
  it("ประเภทที่ตัดสินไม่ได้ (อื่นๆ / ว่าง) → null = ยังไม่ระบุกอง ต้องคัดแยก", () => {
    expect(defaultDepartmentForCategory("อื่นๆ")).toBeNull();
    expect(defaultDepartmentForCategory("")).toBeNull();
    expect(defaultDepartmentForCategory(undefined)).toBeNull();
  });
});
