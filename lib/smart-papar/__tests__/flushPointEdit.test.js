import { describe, it, expect } from "vitest";
import {
  validateFlushPointInput,
  diffFlushPoint,
  flushPointIssues,
  roadNameOptions,
} from "../flushPointEdit";

const base = { name: "หน้าตลาด", roadName: "ถ.พหลโยธิน", kind: "tee_medium", lat: 15.258, lng: 100.346 };

describe("validateFlushPointInput", () => {
  it("ตัดช่องว่าง แปลงพิกัดเป็นตัวเลข และคืน location GeoJSON", () => {
    const v = validateFlushPointInput({ ...base, name: "  หน้าตลาด  ", lat: "15.258", lng: "100.346" });
    expect(v.ok).toBe(true);
    expect(v.value.name).toBe("หน้าตลาด");
    expect(v.value.location).toEqual({ type: "Point", coordinates: [100.346, 15.258] });
    expect(v.value.active).toBe(true);
  });
  it("ถนน/ซอยว่างได้ แต่ยาวเกิน 120 ไม่ได้", () => {
    expect(validateFlushPointInput({ ...base, roadName: "" }).ok).toBe(true);
    expect(validateFlushPointInput({ ...base, roadName: "ก".repeat(121) }).errors.roadName).toBeTruthy();
  });
  it("ชนิดต้องอยู่ในรายการ", () => {
    expect(validateFlushPointInput({ ...base, kind: "pipe" }).errors.kind).toBeTruthy();
  });
  it("พิกัดผิดช่วงหรือไม่ใช่ตัวเลข", () => {
    expect(validateFlushPointInput({ ...base, lat: 95 }).errors.location).toBeTruthy();
    expect(validateFlushPointInput({ ...base, lng: "abc" }).errors.location).toBeTruthy();
    expect(validateFlushPointInput({ ...base, lat: null }).errors.location).toBeTruthy();
  });
  it("รูปต้องเป็น Cloudinary หรือว่าง", () => {
    expect(validateFlushPointInput({ ...base, photoUrl: "https://evil.example/x.jpg" }).errors.photoUrl).toBeTruthy();
    expect(validateFlushPointInput({ ...base, photoUrl: "https://res.cloudinary.com/x/y.jpg" }).ok).toBe(true);
    expect(validateFlushPointInput({ ...base, photoUrl: "" }).ok).toBe(true);
  });
  it("สร้างใหม่ต้องมีรหัส — แปลงเป็นตัวพิมพ์ใหญ่ และรูปแบบต้องถูก", () => {
    expect(validateFlushPointInput(base, { isCreate: true }).errors.code).toBeTruthy();
    const v = validateFlushPointInput({ ...base, code: " bp-210 " }, { isCreate: true });
    expect(v.ok).toBe(true);
    expect(v.value.code).toBe("BP-210");
    expect(validateFlushPointInput({ ...base, code: "BP 210!" }, { isCreate: true }).errors.code).toBeTruthy();
  });
  it("แก้ไข: ไม่รับรหัสจาก payload (รหัสเปลี่ยนไม่ได้)", () => {
    const v = validateFlushPointInput({ ...base, code: "XX-1" });
    expect(v.ok).toBe(true);
    expect(v.value.code).toBeUndefined();
  });
  it("active ต้องเป็น boolean ถ้าส่งมา", () => {
    expect(validateFlushPointInput({ ...base, active: false }).value.active).toBe(false);
    expect(validateFlushPointInput({ ...base, active: "no" }).errors.active).toBeTruthy();
  });
});

describe("diffFlushPoint", () => {
  const before = {
    name: "ตลาด",
    roadName: "",
    kind: "tee_large",
    active: true,
    photoUrl: "",
    location: { type: "Point", coordinates: [100.346, 15.258] },
  };
  it("คืนเฉพาะช่องที่เปลี่ยน", () => {
    const after = { ...before, name: "หน้าตลาด", roadName: "ถ.พหลโยธิน" };
    expect(diffFlushPoint(before, after).map((c) => c.field)).toEqual(["name", "roadName"]);
  });
  it("ไม่เปลี่ยนอะไร → []", () => {
    expect(diffFlushPoint(before, { ...before })).toEqual([]);
  });
  it("ตำแหน่งเปลี่ยน → บอกระยะที่ย้าย (เมตร)", () => {
    const after = { ...before, location: { type: "Point", coordinates: [100.346, 15.2581] } };
    const [c] = diffFlushPoint(before, after);
    expect(c.field).toBe("location");
    expect(c.movedM).toBe(11);
  });
  it("ขยับน้อยกว่า 0.5 ม. ไม่นับว่าเปลี่ยน", () => {
    const after = { ...before, location: { type: "Point", coordinates: [100.346000001, 15.258] } };
    expect(diffFlushPoint(before, after)).toEqual([]);
  });
});

describe("flushPointIssues", () => {
  it("ระบุช่องที่ยังขาด", () => {
    expect(flushPointIssues({ name: "", roadName: " ", kind: "unknown" })).toEqual(["no_name", "no_road", "unknown_kind"]);
    expect(flushPointIssues({ name: "ก", roadName: "ข", kind: "garland" })).toEqual([]);
  });
});

describe("roadNameOptions", () => {
  it("ชื่อถนนไม่ซ้ำ นับจำนวนหัว เรียงมากไปน้อย", () => {
    const pts = [{ roadName: "ซอย 5" }, { roadName: "ถ.หลวง" }, { roadName: " ซอย 5 " }, { roadName: "" }];
    expect(roadNameOptions(pts)).toEqual([
      { name: "ซอย 5", count: 2 },
      { name: "ถ.หลวง", count: 1 },
    ]);
  });
});
