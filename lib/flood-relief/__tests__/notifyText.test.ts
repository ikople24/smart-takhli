import { describe, it, expect } from "vitest";
import { formatNewRequestFlex } from "../notifyText";

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
  phone: "0812344421",
  createdAt: new Date("2026-09-26T01:32:00Z"), // 08:32 น.
};

const json = (v: unknown) => JSON.stringify(v);

describe("formatNewRequestFlex — บล็อกพิเศษเข้ากลุ่มเจ้าหน้าที่", () => {
  it("altText สรุปเลขที่ ประเภท ความเร่งด่วน พื้นที่ (โชว์ในแจ้งเตือนมือถือ)", () => {
    const m = formatNewRequestFlex(base);
    expect(m.type).toBe("flex");
    expect(m.altText).toBe("🆘 FL-0142 อพยพผู้ป่วย · ด่วนมาก · ชุมชนรจนา · โซน A (วิกฤต)");
    expect(m.altText.length).toBeLessThanOrEqual(400);
  });

  it("หัวการ์ดสีตามความเร่งด่วน", () => {
    const bg = (u: "critical" | "urgent" | "normal") =>
      (formatNewRequestFlex({ ...base, urgency: u }).contents as { header: { backgroundColor: string } }).header
        .backgroundColor;
    expect(bg("critical")).toBe("#C62839");
    expect(bg("urgent")).toBe("#9E6206");
    expect(bg("normal")).toBe("#4A4458");
  });

  it("มีปุ่มนำทาง Google Maps · ปุ่มแดชบอร์ดมีเมื่อตั้ง URL · เวลาไทย", () => {
    const withUrl = json(formatNewRequestFlex(base, "https://example.go.th/admin/flood-relief?ticket=FL-0142"));
    expect(withUrl).toContain("https://www.google.com/maps/dir/?api=1&destination=15.253910,100.351080");
    expect(withUrl).toContain("https://example.go.th/admin/flood-relief?ticket=FL-0142");
    expect(withUrl).toContain("08:32 น.");
    expect(json(formatNewRequestFlex(base))).not.toContain("แดชบอร์ด");
  });

  it("ไม่ทราบชุมชน/ไม่มีโซน/ช่องไม่บังคับว่าง ก็ยังสร้างการ์ดได้", () => {
    const t = json(
      formatNewRequestFlex({ ...base, communityName: null, zoneName: null, zoneLevel: null, landmark: "", peopleCount: null })
    );
    expect(t).toContain("ไม่ทราบชุมชน");
    expect(t).not.toContain("โซน");
    expect(t).not.toContain("คนในบ้าน");
    expect(t).not.toContain("จุดสังเกต");
  });

  it("ปุ่มโทรหาผู้แจ้ง — เบอร์อยู่ในปุ่มเท่านั้น ไม่อยู่ใน altText/เนื้อการ์ด", () => {
    const m = formatNewRequestFlex(base);
    const s = json(m);
    expect(s).toContain('"uri":"tel:0812344421"');
    expect(s.split("0812344421").length - 1).toBe(1);
    expect(m.altText).not.toContain("0812344421");
  });

  it("ไม่มีข้อความว่างในการ์ด (LINE ปฏิเสธ text ว่างทั้งใบ)", () => {
    expect(json(formatNewRequestFlex({ ...base, landmark: "" }))).not.toMatch(/"text":""/);
  });
});
