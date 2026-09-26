import { describe, it, expect } from "vitest";
import { adminListItem } from "../adminView";

describe("adminListItem", () => {
  it("แปลงพิกัด/ไอดีเป็นค่าที่ client ใช้ และไม่ส่งกุญแจ/IP/lineUserId", () => {
    const now = new Date("2026-09-26T05:00:00Z");
    const item = adminListItem(
      {
        _id: { toString: () => "abc123" },
        ticket: "FL-0001",
        status: "received",
        urgency: "critical",
        createdAt: new Date("2026-09-26T04:40:00Z"),
        location: { type: "Point", coordinates: [100.35, 15.25] },
        zoneId: { toString: () => "z1" },
        accessKey: "secretsecretsecr",
        clientIp: "1.2.3.4",
        lineUserId: "Uxxx",
      },
      now
    ) as Record<string, unknown>;
    expect(item).toMatchObject({ id: "abc123", lat: 15.25, lng: 100.35, zoneId: "z1", lineLinked: true, waitingMinutes: 20, isOverdue: true });
    for (const k of ["accessKey", "clientIp", "lineUserId", "location", "_id"]) expect(item).not.toHaveProperty(k);
  });
});
