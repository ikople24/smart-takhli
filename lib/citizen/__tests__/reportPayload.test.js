// lib/citizen/__tests__/reportPayload.test.js
import { describe, it, expect } from "vitest";
import { buildComplaintPayload } from "../report/payload";

const problemOptions = [
  { _id: "a1", label: "ไฟดับทั้งซอย", category: "ไฟส่องสว่าง" },
  { _id: "a2", label: "ไฟกระพริบ", category: "ไฟส่องสว่าง" },
];

const state = {
  prefix: "นาย",
  fullName: " สมชาย ใจดี ",
  phone: "0812345678",
  community: "ชุมชนตลาดเก่า",
  selectedProblems: ["a1", "unknown-id"],
  category: "ไฟส่องสว่าง",
  imageUrls: ["https://res.cloudinary.com/x/a.jpg"],
  detail: "ไฟดับมา 3 วัน",
  location: { lat: 15.26, lng: 100.35 },
};

describe("buildComplaintPayload — shape ตรง ComplaintFormModal เดิม", () => {
  it("field ครบและค่าตรง (ค่าดิบ ไม่ trim ตามพฤติกรรมเดิม)", () => {
    const p = buildComplaintPayload(state, problemOptions);
    expect(Object.keys(p).sort()).toEqual(
      ["category", "community", "detail", "fullName", "images", "location", "officer", "phone", "prefix", "problems", "status", "updatedAt"]
    );
    expect(p.fullName).toBe(" สมชาย ใจดี ");
    expect(p.images).toEqual(state.imageUrls);
    expect(p.category).toBe("ไฟส่องสว่าง");
    expect(p.location).toEqual({ lat: 15.26, lng: 100.35 });
  });
  it("problems map id→label · id ที่หาไม่เจอคง id ไว้ (ตามเดิม)", () => {
    const p = buildComplaintPayload(state, problemOptions);
    expect(p.problems).toEqual(["ไฟดับทั้งซอย", "unknown-id"]);
  });
  it("ค่าคงที่ตามเดิม", () => {
    const p = buildComplaintPayload(state, problemOptions);
    expect(p.status).toBe("อยู่ระหว่างดำเนินการ");
    expect(p.officer).toBe("");
    expect(p.updatedAt).toBeInstanceOf(Date);
  });
});

describe("buildComplaintPayload — หลักฐานการยอมรับข้อตกลง", () => {
  const consent = { version: "1.0", acceptedAt: "2026-09-16T02:31:00.000Z" };

  it("ไม่มีข้อมูลยินยอม → payload เหมือนเดิมทุกคีย์ (ไม่มีคีย์ consent)", () => {
    const p = buildComplaintPayload(state, problemOptions);
    expect(Object.keys(p)).not.toContain("consent");
  });

  it("มีข้อมูลยินยอมครบ → แนบเฉพาะ version กับ acceptedAt", () => {
    const p = buildComplaintPayload({ ...state, consent }, problemOptions);
    expect(p.consent).toEqual(consent);
  });

  it("ไม่ส่ง deviceId ขึ้นไปกับเรื่อง", () => {
    const p = buildComplaintPayload(
      { ...state, consent: { ...consent, deviceId: "3f1a5c22-1111-4222-8333-444455556666" } },
      problemOptions
    );
    expect(Object.keys(p.consent).sort()).toEqual(["acceptedAt", "version"]);
  });

  it("ข้อมูลยินยอมไม่ครบ → ไม่แนบคีย์ consent", () => {
    expect(buildComplaintPayload({ ...state, consent: { version: "1.0" } }, problemOptions).consent).toBeUndefined();
    expect(buildComplaintPayload({ ...state, consent: null }, problemOptions).consent).toBeUndefined();
  });
});
