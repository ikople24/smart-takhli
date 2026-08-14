import { describe, it, expect } from "vitest";
import { summarizeLive, type LiveTruckLite } from "./liveSummary";

const t = (truckNumber: number, status: string | null, kind = "normal"): LiveTruckLite => ({
  truckNumber,
  truckColor: "green",
  kind,
  live: status == null ? null : { status },
});

describe("summarizeLive", () => {
  it("ยังโหลดไม่เสร็จ ยังไม่บอกสถานะ และรถต้องไม่วิ่งบนจอ", () => {
    const s = summarizeLive(null);
    expect(s.statusText).toBe("ตารางรถเก็บขยะ");
    expect(s.moving).toBe(false);
    expect(s.runningCount).toBe(0);
  });

  it("มีรถกำลังวิ่ง = บอกจำนวนคัน และให้ภาพรถวิ่งได้", () => {
    const s = summarizeLive([t(1, "running"), t(2, "running"), t(3, "finished")]);
    expect(s.statusText).toBe("รถกำลังวิ่ง 2 คัน");
    expect(s.moving).toBe(true);
  });

  it("เก็บเสร็จหมดแล้ว = บอกว่าครบแล้ว และรถต้องหยุดวิ่งบนจอ", () => {
    const s = summarizeLive([t(1, "finished"), t(2, "finished")]);
    expect(s.statusText).toBe("วันนี้รถเก็บครบแล้ว");
    expect(s.moving).toBe(false);
  });

  it("ยังไม่ถึงเวลาออก = บอกว่าวันนี้มีรถออกกี่คัน", () => {
    const s = summarizeLive([t(1, "upcoming"), t(2, "upcoming"), t(13, null, "special")]);
    expect(s.statusText).toBe("วันนี้มีรถออก 3 คัน");
    expect(s.moving).toBe(false);
  });

  it("วันหยุดไม่นับเป็นรถของวันนี้ — หยุดหมดทุกคัน = ไม่มีตาราง", () => {
    const s = summarizeLive([t(1, null, "day_off"), t(2, null, "day_off")]);
    expect(s.statusText).toBe("วันนี้ยังไม่มีตารางในระบบ");
    expect(s.workingCount).toBe(0);
  });

  it("รถที่ยังไม่ระบุเวลา (สถานะ unknown) ห้ามกันไม่ให้ขึ้นว่าเก็บครบ", () => {
    // รถ 13 ไม่มีเวลาในระบบจึง unknown ตลอดวัน ถ้าบังคับว่าทุกคันต้อง finished
    // การ์ดจะไม่มีวันขึ้นว่าเก็บครบเลยแม้รถที่มีตารางจะเลิกงานไปแล้ว
    const s = summarizeLive([t(1, "finished"), t(13, "unknown", "special")]);
    expect(s.statusText).toBe("วันนี้รถเก็บครบแล้ว");
  });

  it("มีแต่รถที่ไม่ระบุเวลาเลย ยังสรุปว่าเก็บครบไม่ได้", () => {
    const s = summarizeLive([t(13, "unknown", "special")]);
    expect(s.statusText).toBe("วันนี้มีรถออก 1 คัน");
  });

  it("รถคันเดียวกันหลายรอบนับเป็นคันเดียว", () => {
    const s = summarizeLive([t(1, "running"), t(1, "running")]);
    expect(s.statusText).toBe("รถกำลังวิ่ง 1 คัน");
    expect(s.runningCount).toBe(1);
  });

  it("คันที่จะเอาไปโชว์รูป = คันที่กำลังวิ่งก่อน ไม่มีก็คันแรกที่มีงานวันนี้", () => {
    expect(summarizeLive([t(4, "finished"), t(2, "running")]).spriteTruck?.truckNumber).toBe(2);
    expect(summarizeLive([t(4, "finished"), t(2, "finished")]).spriteTruck?.truckNumber).toBe(4);
    expect(summarizeLive([t(1, null, "day_off")]).spriteTruck).toBeNull();
    expect(summarizeLive(null).spriteTruck).toBeNull();
  });
});
