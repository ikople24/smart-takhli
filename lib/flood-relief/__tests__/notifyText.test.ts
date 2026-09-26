import { describe, it, expect } from "vitest";
import { formatNewRequestText } from "../notifyText";

const base = {
  ticket: "FL-0142",
  type: "evac" as const,
  urgency: "critical" as const,
  point: { lat: 15.25391, lng: 100.35108 },
  communityName: "รจนา",
  zoneName: "A",
  zoneLevel: "critical",
  landmark: "ซ.มาลัย 2 บ้านรั้วเขียว",
  peopleCount: 3,
  createdAt: new Date("2026-09-26T01:32:00Z"), // 08:32 น.
};

describe("formatNewRequestText", () => {
  it("มีเลขที่ ประเภท ความเร่งด่วน ชุมชน/โซน ลิงก์นำทาง และเวลาไทย", () => {
    const t = formatNewRequestText(base, "https://example.go.th/admin/flood-relief?ticket=FL-0142");
    expect(t).toContain("FL-0142");
    expect(t).toContain("อพยพผู้ป่วย · ด่วนมาก");
    expect(t).toContain("ชุมชนรจนา · โซน A (วิกฤต)");
    expect(t).toContain("https://www.google.com/maps/dir/?api=1&destination=15.253910,100.351080");
    expect(t).toContain("เปิดในแดชบอร์ด: https://example.go.th/admin/flood-relief?ticket=FL-0142");
    expect(t).toContain("08:32 น.");
  });

  it("ไม่ทราบชุมชน/ไม่มีโซน/ไม่มีลิงก์แดชบอร์ด ก็ยังส่งได้", () => {
    const t = formatNewRequestText({ ...base, communityName: null, zoneName: null, zoneLevel: null, landmark: "", peopleCount: null });
    expect(t).toContain("📍 ไม่ทราบชุมชน");
    expect(t).not.toContain("โซน");
    expect(t).not.toContain("แดชบอร์ด");
    expect(t).not.toContain("คนในบ้าน");
  });
});
