import { describe, it, expect } from "vitest";
import {
  accuracyTier,
  formatCoords,
  fromGeoPoint,
  googleMapsDirUrl,
  haversineKm,
  parseLatLng,
  pickCommunity,
  polygonError,
  toGeoPoint,
} from "../geo";

describe("parseLatLng", () => {
  it("รับตัวเลขและสตริงตัวเลข", () => {
    expect(parseLatLng(15.25, 100.35)).toEqual({ lat: 15.25, lng: 100.35 });
    expect(parseLatLng("15.25", "100.35")).toEqual({ lat: 15.25, lng: 100.35 });
  });

  it("ค่าว่าง/นอกช่วง/ไม่ใช่ตัวเลข = null", () => {
    expect(parseLatLng("", "100")).toBeNull();
    expect(parseLatLng(null, 100)).toBeNull();
    expect(parseLatLng(91, 100)).toBeNull();
    expect(parseLatLng(15, 181)).toBeNull();
    expect(parseLatLng("abc", 100)).toBeNull();
  });
});

describe("GeoJSON Point", () => {
  it("เรียง [lng, lat] และแปลงกลับได้", () => {
    const p = toGeoPoint({ lat: 15.2539, lng: 100.3511 });
    expect(p).toEqual({ type: "Point", coordinates: [100.3511, 15.2539] });
    expect(fromGeoPoint(p)).toEqual({ lat: 15.2539, lng: 100.3511 });
    expect(fromGeoPoint(null)).toBeNull();
    expect(fromGeoPoint({ coordinates: [] })).toBeNull();
  });
});

describe("haversineKm", () => {
  it("จุดเดียวกัน = 0", () => {
    expect(haversineKm({ lat: 15.25, lng: 100.35 }, { lat: 15.25, lng: 100.35 })).toBe(0);
  });

  it("ละติจูดต่างกัน 0.01° ≈ 1.11 กม.", () => {
    const d = haversineKm({ lat: 15.25, lng: 100.35 }, { lat: 15.26, lng: 100.35 });
    expect(d).toBeCloseTo(1.112, 2);
  });
});

describe("แสดงผลพิกัด", () => {
  it("5 ตำแหน่ง และลิงก์นำทาง Google Maps", () => {
    expect(formatCoords({ lat: 15.2539141, lng: 100.351077 })).toBe("15.25391, 100.35108");
    expect(googleMapsDirUrl({ lat: 15.25, lng: 100.35 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=15.250000,100.350000"
    );
  });
});

describe("accuracyTier", () => {
  it("≤20 เขียว · ≤50 เหลือง · >50 เตือน · ไม่มีค่า = ปักหมุดเอง", () => {
    expect(accuracyTier(8)).toBe("good");
    expect(accuracyTier(20)).toBe("good");
    expect(accuracyTier(35)).toBe("fair");
    expect(accuracyTier(51)).toBe("poor");
    expect(accuracyTier(null)).toBe("manual");
    expect(accuracyTier(NaN)).toBe("manual");
  });
});

describe("pickCommunity (ของกลาง lib/geo)", () => {
  it("ไม่ตก polygon ใด = null · ทับซ้อนเรียงชื่อ", () => {
    expect(pickCommunity([])).toBeNull();
    expect(pickCommunity([{ name: "สามล" }, { name: "รจนา" }])).toBe("รจนา");
  });
});

describe("polygonError", () => {
  const ring = [
    [100.35, 15.25],
    [100.36, 15.25],
    [100.36, 15.26],
    [100.35, 15.25],
  ];

  it("polygon ปิดรูป 3 มุม = ผ่าน", () => {
    expect(polygonError({ type: "Polygon", coordinates: [ring] })).toBeNull();
  });

  it("ไม่ใช่ Polygon / มีรู / มุมไม่พอ / ไม่ปิดรูป / พิกัดเพี้ยน", () => {
    expect(polygonError(null)).toMatch(/Polygon/);
    expect(polygonError({ type: "Point", coordinates: [100, 15] })).toMatch(/Polygon/);
    expect(polygonError({ type: "Polygon", coordinates: [ring, ring] })).toMatch(/รู/);
    expect(polygonError({ type: "Polygon", coordinates: [ring.slice(0, 3)] })).toMatch(/3 มุม/);
    expect(polygonError({ type: "Polygon", coordinates: [[...ring.slice(0, 3), [100.37, 15.27]]] })).toMatch(/ปิดรูป/);
    expect(polygonError({ type: "Polygon", coordinates: [[[200, 15], [100, 15], [100, 16], [200, 15]]] })).toMatch(
      /พิกัด/
    );
  });

  it("มุมซ้ำจนเหลือไม่ถึง 3 จุดจริง = ไม่ผ่าน", () => {
    const flat = [[100.35, 15.25], [100.36, 15.25], [100.36, 15.25], [100.35, 15.25]];
    expect(polygonError({ type: "Polygon", coordinates: [flat] })).toMatch(/3 มุม/);
  });
});
