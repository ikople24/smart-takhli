// lib/citizen/__tests__/reportSchema.test.js
import { describe, it, expect } from "vitest";
import {
  stepCategorySchema,
  stepDetailsSchema,
  stepReporterSchema,
  fullReportSchema,
  validateStep,
} from "../report/schema";

const validDetails = {
  community: "ชุมชนตลาดเก่า",
  selectedProblems: ["id1"],
  imageUrls: ["https://res.cloudinary.com/x/a.jpg"],
};

const validReporter = {
  prefix: "นาย",
  fullName: "สมชาย ใจดี",
  phone: "0812345678",
  detail: "ไฟดับทั้งซอย",
  location: { lat: 15.26, lng: 100.35 },
};

describe("stepCategorySchema", () => {
  it("หมวดว่างไม่ผ่าน", () => {
    expect(validateStep(stepCategorySchema, { category: "" }).category).toBe("กรุณาเลือกหมวดหมู่");
    expect(validateStep(stepCategorySchema, { category: "ไฟส่องสว่าง" })).toEqual({});
  });
});

describe("stepDetailsSchema — ข้อความ error ตรงฟอร์มเดิม", () => {
  it("ครบ = ผ่าน", () => {
    expect(validateStep(stepDetailsSchema, validDetails)).toEqual({});
  });
  it("ชุมชนว่าง", () => {
    expect(validateStep(stepDetailsSchema, { ...validDetails, community: "" }).community).toBe("กรุณาระบุ 1 ชุมชน");
  });
  it("ไม่เลือกปัญหา", () => {
    expect(validateStep(stepDetailsSchema, { ...validDetails, selectedProblems: [] }).selectedProblems).toBe(
      "กรุณาเลือกรายการปัญหาอย่างน้อย 1 รายการ"
    );
  });
  it("ไม่มีรูป", () => {
    expect(validateStep(stepDetailsSchema, { ...validDetails, imageUrls: [] }).imageUrls).toBe(
      "กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป"
    );
  });
});

describe("stepReporterSchema — ข้อความ error ตรงฟอร์มเดิม", () => {
  it("ครบ = ผ่าน", () => {
    expect(validateStep(stepReporterSchema, validReporter)).toEqual({});
  });
  it("ชื่อ 1 ตัวอักษร", () => {
    expect(validateStep(stepReporterSchema, { ...validReporter, fullName: "ก" }).fullName).toBe(
      "ชื่อ-นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร"
    );
  });
  it("เบอร์ 9 และ 11 หลักไม่ผ่าน", () => {
    expect(validateStep(stepReporterSchema, { ...validReporter, phone: "081234567" }).phone).toBe(
      "เบอร์โทรศัพท์ต้องมี 10 หลัก"
    );
    expect(validateStep(stepReporterSchema, { ...validReporter, phone: "08123456789" }).phone).toBe(
      "เบอร์โทรศัพท์ต้องมี 10 หลัก"
    );
  });
  it("รายละเอียดว่าง", () => {
    expect(validateStep(stepReporterSchema, { ...validReporter, detail: "" }).detail).toBe("กรุณากรอกรายละเอียด");
  });
  it("ไม่มีตำแหน่ง", () => {
    expect(validateStep(stepReporterSchema, { ...validReporter, location: null }).location).toBe(
      "กรุณาเลือกตำแหน่งที่ตั้ง"
    );
  });
  it("คำนำหน้าว่าง", () => {
    expect(validateStep(stepReporterSchema, { ...validReporter, prefix: "" }).prefix).toBe("กรุณาเลือกคำนำหน้า");
  });
});

describe("fullReportSchema", () => {
  it("รวมทุกขั้น — ครบผ่าน ขาดฟิลด์ใดฟิลด์หนึ่งไม่ผ่าน", () => {
    const full = { category: "ไฟส่องสว่าง", ...validDetails, ...validReporter };
    expect(validateStep(fullReportSchema, full)).toEqual({});
    expect(validateStep(fullReportSchema, { ...full, phone: "" }).phone).toBeTruthy();
  });
  it("validateStep คืนข้อความแรกต่อฟิลด์", () => {
    const errors = validateStep(fullReportSchema, { category: "", ...validDetails, ...validReporter, phone: "x" });
    expect(Object.keys(errors).sort()).toEqual(["category", "phone"]);
  });
});
