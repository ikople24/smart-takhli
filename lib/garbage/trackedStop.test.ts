import { describe, it, expect } from "vitest";
import { parseTrackedStop, serializeTrackedStop, trackedEta, type TrackedStop } from "./trackedStop";

const tracked: TrackedStop = {
  routeCode: "R1",
  seq: 28,
  stopName: "ถนนมาลัย",
  zoneLabel: "โซน 1",
  truckNumber: 1,
  truckColor: "yellow",
  atMin: 460,
  weekday: 5,
};

describe("parseTrackedStop", () => {
  it("อ่านค่าที่ตัวเองเขียนไว้กลับมาได้ครบ", () => {
    expect(parseTrackedStop(serializeTrackedStop(tracked))).toEqual(tracked);
  });

  it("จุดที่ยังไม่ระบุเวลา (atMin null) ติดตามได้ ไม่ใช่ค่าเสีย", () => {
    const noTime = { ...tracked, atMin: null };
    expect(parseTrackedStop(serializeTrackedStop(noTime))).toEqual(noTime);
  });

  it("ค่าใน localStorage ที่พังหรือมาจากรุ่นเก่าต้องคืน null ไม่ใช่โยน error", () => {
    // localStorage เป็นของผู้ใช้ แก้มือได้ ข้ามรุ่นได้ — หน้าแรกพังทั้งหน้าไม่ได้เพราะค่านี้
    expect(parseTrackedStop(null)).toBeNull();
    expect(parseTrackedStop("")).toBeNull();
    expect(parseTrackedStop("ไม่ใช่ json")).toBeNull();
    expect(parseTrackedStop("[]")).toBeNull();
    expect(parseTrackedStop("null")).toBeNull();
    expect(parseTrackedStop(JSON.stringify({ stopName: "ถนนมาลัย" }))).toBeNull();
  });

  it("ปฏิเสธค่าที่ชนิดผิด — เลขรถเป็นสตริง วันเป็นเลขนอกช่วง สีรถไม่รู้จัก", () => {
    expect(parseTrackedStop(JSON.stringify({ ...tracked, truckNumber: "1" }))).toBeNull();
    expect(parseTrackedStop(JSON.stringify({ ...tracked, weekday: 9 }))).toBeNull();
    expect(parseTrackedStop(JSON.stringify({ ...tracked, truckColor: "ม่วง" }))).toBeNull();
    expect(parseTrackedStop(JSON.stringify({ ...tracked, atMin: 5000 }))).toBeNull();
  });
});

describe("trackedEta", () => {
  it("วันเดียวกันและยังไม่ถึง = จำนวนนาทีที่เหลือ", () => {
    expect(trackedEta(tracked, 5, 448)).toBe(12);
  });

  it("รถผ่านไปแล้ววันนี้ = ค่าติดลบ (ผู้เรียกเลือกเองว่าจะแสดงว่าอะไร)", () => {
    expect(trackedEta(tracked, 5, 470)).toBe(-10);
  });

  it("คนละวันกับที่ติดตามไว้ = null (จุดเดียวกันคนละวันเวลาไม่เหมือนกัน)", () => {
    expect(trackedEta(tracked, 3, 448)).toBeNull();
  });

  it("จุดที่ยังไม่ระบุเวลา = null นับถอยหลังไม่ได้", () => {
    expect(trackedEta({ ...tracked, atMin: null }, 5, 448)).toBeNull();
  });

  it("ไม่มีจุดที่ติดตาม = null", () => {
    expect(trackedEta(null, 5, 448)).toBeNull();
  });
});
