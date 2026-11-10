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

import { defaultDepartmentForComplaint } from "../departments";

describe("defaultDepartmentForComplaint — งานกิ่งไม้/ต้นไม้ไปงานป้องกันฯ แม้แจ้งผิดหมวด", () => {
  const P = "งานป้องกันและบรรเทาสาธารณภัย";
  it.each([
    ["ประเภทย่อยกิ่งไม้ล้ำถนน ใต้ถนน/ทางเท้า", { category: "ถนน/ทางเท้า", problems: ["กิ่งไม้ล้ำถนน"], detail: "" }],
    ["กิ่งไม้ติดเสาไฟ ใต้อื่นๆ", { category: "อื่นๆ", problems: ["กิ่งไม้ติดเสาไฟ"] }],
    ["ไฟส่องสว่าง แต่กิ่งมะม่วงบังไฟ", { category: "ไฟส่องสว่าง", problems: ["แสงสว่างไม่เพียงพอ"], detail: "กิ่งมะม่วงได้ไป\nบดบัง หลอดไฟ LED" }],
    ["ขอความอนุเคราะห์ตัดกิ่ง", { category: "ถนน/ทางเท้า", problems: ["ขอความอนุเคราะห์"], detail: "ขออนุเคราะห์ ตัดกิ่งให้แนวเดียวกับเสาไฟฟ้า" }],
    ["ตัดหญ้าและต้นไม้ที่ล้ำถนน", { category: "ถนน/ทางเท้า", problems: ["ขอความอนุเคราะห์"], detail: "ตัดหญ้าและต้นไม้ที่ล้ำถนน" }],
  ])("%s → งานป้องกันฯ", (_, c) => {
    expect(defaultDepartmentForComplaint(c)).toBe(P);
  });
  it.each([
    ["หลุมบนถนน", { category: "ถนน/ทางเท้า", problems: ["ผิวจราจรเป็นหลุม"], detail: "ถนนเป็นหลุม" }, "กองช่าง"],
    ["ตัดหญ้าอย่างเดียว ไม่นับ", { category: "ถนน/ทางเท้า", problems: ["ขอความอนุเคราะห์"], detail: "หญ้าข้างทางรก" }, "กองช่าง"],
    ["ไฟดับ ไม่มีต้นไม้", { category: "ไฟส่องสว่าง", problems: ["ไฟดับ"], detail: "ไฟดับทั้งซอย" }, "กองช่าง"],
    ["อื่นๆ ไม่มีข้อมูล", { category: "อื่นๆ" }, null],
    ["เก็บกิ่งไม้ = งานขยะ ไม่ใช่งานตัด", { category: "ถนน/ทางเท้า", problems: ["อื่นๆ(โปรดระบุ)"], detail: "ฝากเก็บกิ่งไม้ ขอบคุณค่ะ" }, "กองช่าง"],
    ["ขยะกิ่งไม้สะสม", { category: "ขยะมูลฝอย", problems: ["ขยะล้นถัง"], detail: "ขยะกิ่งไม้และขยะชิ้นใหญ่สะสมจำนวนมาก" }, "กองสาธารณสุขและสิ่งแวดล้อม"],
    ["null", null, null],
  ])("%s → ตามหมวดเดิม", (_, c, expected) => {
    expect(defaultDepartmentForComplaint(c)).toBe(expected);
  });
});
