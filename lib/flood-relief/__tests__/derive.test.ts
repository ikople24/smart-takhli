import { describe, it, expect } from "vitest";
import {
  deriveRequest,
  isOverdue,
  PUBLIC_REQUEST_SELECT,
  publicRequest,
  sortRequests,
  teamDistanceKm,
  waitingMinutes,
} from "../derive";

const T0 = new Date("2026-09-26T01:00:00Z"); // 08:00 น.
const at = (min: number) => new Date(T0.getTime() + min * 60 * 1000);

describe("waitingMinutes", () => {
  it("ยังไม่มอบหมาย = นับถึงตอนนี้", () => {
    expect(waitingMinutes({ status: "received", createdAt: T0 }, at(12))).toBe(12);
  });

  it("มอบหมายแล้ว = หยุดนับที่ assignedAt", () => {
    expect(waitingMinutes({ status: "dispatched", createdAt: T0, assignedAt: at(7) }, at(90))).toBe(7);
  });

  it("ยกเลิกโดยไม่เคยมอบหมาย = หยุดที่เวลายกเลิก", () => {
    expect(waitingMinutes({ status: "cancelled", createdAt: T0, cancelledAt: at(20) }, at(300))).toBe(20);
  });

  it("ไม่มี createdAt = 0 · เวลาเพี้ยนไม่ติดลบ", () => {
    expect(waitingMinutes({ status: "received" }, at(5))).toBe(0);
    expect(waitingMinutes({ status: "received", createdAt: at(10) }, T0)).toBe(0);
  });
});

describe("isOverdue", () => {
  it("ด่วนมาก > 15 นาที ยังไม่มีทีมออกเดินทาง", () => {
    expect(isOverdue({ status: "received", urgency: "critical", createdAt: T0 }, at(15))).toBe(false);
    expect(isOverdue({ status: "received", urgency: "critical", createdAt: T0 }, at(16))).toBe(true);
    expect(isOverdue({ status: "assigning", urgency: "critical", createdAt: T0 }, at(16))).toBe(true);
  });

  it("ด่วน > 60 นาที", () => {
    expect(isOverdue({ status: "received", urgency: "urgent", createdAt: T0 }, at(60))).toBe(false);
    expect(isOverdue({ status: "received", urgency: "urgent", createdAt: T0 }, at(61))).toBe(true);
  });

  it("ทั่วไปไม่มีเกณฑ์ · ทีมออกเดินทางแล้ว/ปิดแล้วไม่นับ", () => {
    expect(isOverdue({ status: "received", urgency: "normal", createdAt: T0 }, at(600))).toBe(false);
    expect(isOverdue({ status: "dispatched", urgency: "critical", createdAt: T0 }, at(600))).toBe(false);
    expect(isOverdue({ status: "done", urgency: "critical", createdAt: T0 }, at(600))).toBe(false);
  });
});

describe("deriveRequest", () => {
  it("เติม derived fields โดยไม่ทิ้งฟิลด์เดิม", () => {
    const d = deriveRequest(
      { ticket: "FL-0001", status: "received", urgency: "critical", createdAt: T0, zoneName: "A" },
      at(20)
    );
    expect(d.ticket).toBe("FL-0001");
    expect(d.waitingMinutes).toBe(20);
    expect(d.isOverdue).toBe(true);
    expect(d.zoneLabel).toBe("โซน A");
    expect(d.communityName).toBeNull();
  });
});

describe("sortRequests", () => {
  it("เปิดก่อนปิด → ด่วนมากก่อนเสมอ → ล่าสุดก่อน", () => {
    const list = [
      { id: "old-urgent", status: "received", urgency: "urgent", createdAt: at(0) },
      { id: "done-critical", status: "done", urgency: "critical", createdAt: at(50) },
      { id: "new-normal", status: "received", urgency: "normal", createdAt: at(40) },
      { id: "old-critical", status: "dispatched", urgency: "critical", createdAt: at(1) },
      { id: "new-critical", status: "received", urgency: "critical", createdAt: at(30) },
      { id: "new-urgent", status: "assigning", urgency: "urgent", createdAt: at(35) },
    ];
    expect(sortRequests(list).map((r) => r.id)).toEqual([
      "new-critical",
      "old-critical",
      "new-urgent",
      "old-urgent",
      "new-normal",
      "done-critical",
    ]);
    expect(list[0].id).toBe("old-urgent"); // ไม่แก้ array เดิม
  });
});

describe("teamDistanceKm", () => {
  it("คำนวณจากตำแหน่งล่าสุดของทีม ปัด 1 ตำแหน่ง", () => {
    const team = { lastLocation: { type: "Point", coordinates: [100.35, 15.25] } };
    expect(teamDistanceKm(team, { lat: 15.26, lng: 100.35 })).toBe(1.1);
  });

  it("ทีมยังไม่มีตำแหน่ง = null", () => {
    expect(teamDistanceKm({}, { lat: 15.26, lng: 100.35 })).toBeNull();
    expect(teamDistanceKm({ lastLocation: null }, { lat: 15.26, lng: 100.35 })).toBeNull();
  });
});

describe("publicRequest — หน้าสถานะสาธารณะ", () => {
  const doc = {
    ticket: "FL-0142",
    type: "evac",
    urgency: "critical",
    status: "dispatched",
    phone: "0812344421",
    lineUserId: "Uxxxxxxxx",
    reporterName: "สมชาย ใจดี",
    notes: [{ by: "จนท.", at: T0, text: "บ้านหลังเหลือง" }],
    location: { type: "Point", coordinates: [100.35, 15.25] },
    clientIp: "1.2.3.4",
    landmark: "ซ.มาลัย 2",
    peopleCount: 3,
    communityName: "รจนา",
    zoneName: "A",
    createdAt: T0,
  };

  it("ไม่หลุดเบอร์เต็ม / lineUserId / notes / ชื่อผู้แจ้ง / พิกัด / IP", () => {
    const p = publicRequest(doc) as Record<string, unknown>;
    for (const k of ["phone", "lineUserId", "notes", "reporterName", "location", "clientIp"]) {
      expect(p).not.toHaveProperty(k);
    }
    expect(JSON.stringify(p)).not.toContain("0812344421");
    expect(p.phoneMasked).toBe("08x-xxx-4421");
  });

  it("แปลงสถานะเป็นขั้นที่ประชาชนเห็น", () => {
    expect(publicRequest(doc).citizenStep).toBe(1);
    expect(publicRequest(doc).zoneLabel).toBe("โซน A");
  });

  it("projection สาธารณะไม่มีฟิลด์ต้องห้าม", () => {
    const fields = PUBLIC_REQUEST_SELECT.split(/\s+/);
    for (const k of ["lineUserId", "notes", "reporterName", "location", "clientIp", "timeline"]) {
      expect(fields).not.toContain(k);
    }
  });
});
