import { describe, it, expect } from "vitest";
import { isPhotoStale, parseGaugeCreate, parseGaugePhoto, publicGauge } from "../gauge";

describe("parseGaugeCreate", () => {
  it("ต้องมีชื่อ + พิกัด", () => {
    expect(parseGaugeCreate({ name: " สะพานหน้าวัด ", lat: 15.25, lng: 100.35 })).toEqual({
      ok: true,
      name: "สะพานหน้าวัด",
      point: { lat: 15.25, lng: 100.35 },
      note: "",
    });
    expect(parseGaugeCreate({ lat: 15.25, lng: 100.35 })).toMatchObject({ ok: false });
    expect(parseGaugeCreate({ name: "x", lat: "abc", lng: 1 })).toMatchObject({ ok: false });
    expect(parseGaugeCreate({ name: { $ne: 1 }, lat: 15, lng: 100 })).toMatchObject({ ok: false });
  });
});

describe("parseGaugePhoto", () => {
  const url = "https://res.cloudinary.com/demo/image/upload/a.jpg";
  it("รับเฉพาะรูป Cloudinary · ระดับน้ำไม่บังคับ", () => {
    expect(parseGaugePhoto({ url })).toEqual({ ok: true, url, levelCm: null, note: "" });
    expect(parseGaugePhoto({ url, levelCm: "45.6", note: "ท่วมถึงเข่า" })).toEqual({ ok: true, url, levelCm: 46, note: "ท่วมถึงเข่า" });
    expect(parseGaugePhoto({ url: "https://evil.example/x.jpg" })).toMatchObject({ ok: false });
  });

  it("ระดับน้ำติดลบ/เกิน 1000 ซม. = ไม่ผ่าน", () => {
    expect(parseGaugePhoto({ url, levelCm: -1 })).toMatchObject({ ok: false });
    expect(parseGaugePhoto({ url, levelCm: 5000 })).toMatchObject({ ok: false });
  });
});

describe("isPhotoStale / publicGauge", () => {
  const now = new Date("2026-09-26T10:00:00Z");
  it("เก่าเกิน 6 ชม. หรือยังไม่มีรูป = stale", () => {
    expect(isPhotoStale("2026-09-26T05:00:00Z", now)).toBe(false);
    expect(isPhotoStale("2026-09-26T03:00:00Z", now)).toBe(true);
    expect(isPhotoStale(null, now)).toBe(true);
  });

  it("ส่งออกสาธารณะไม่มีชื่อผู้อัปโหลด/ประวัติ", () => {
    const p = publicGauge(
      {
        name: "สะพาน",
        location: { coordinates: [100.35, 15.25] },
        lastPhotoUrl: "https://res.cloudinary.com/x.jpg",
        lastPhotoAt: "2026-09-26T09:00:00Z",
        lastLevelCm: 40,
        // ช่องที่ไม่ควรหลุด
        ...({ createdBy: "สมชาย", photos: [{ by: "สมชาย" }], updatedBy: "สมหญิง" } as object),
      },
      now
    ) as Record<string, unknown>;
    expect(p).toMatchObject({ name: "สะพาน", lat: 15.25, lng: 100.35, levelCm: 40, stale: false });
    expect(JSON.stringify(p)).not.toMatch(/สมชาย|สมหญิง|photos|createdBy/);
  });
});
