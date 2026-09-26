// lib/flood-relief/geo.ts
// พิกัด / ระยะทาง / ตรวจรูปร่างโซน (logic ล้วน)
// ชุมชนหาจาก basemap geojsonfeatures เท่านั้น (อ่านอย่างเดียว) ด้วย $geoIntersects แล้วเลือกด้วย
// pickCommunity ของกลาง — ห้ามเดาชุมชนจากชื่อซอย ("ซ.มาลัย 2" อยู่ชุมชนรจนา)

export { pickCommunity } from "@/lib/geo/community";

/** ศูนย์กลางเทศบาลเมืองตาคลี — ค่าเดียวกับแผนที่เดิมในระบบ (LocationPickerMap) ใช้เมื่อผู้ใช้ไม่ให้ GPS */
export const TAKHLI_CENTER = Object.freeze({ lat: 15.253914, lng: 100.351077 });

export type LatLng = { lat: number; lng: number };
export type GeoPoint = { type: "Point"; coordinates: [number, number] };

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return NaN;
}

/** รับค่าจาก query/body — ไม่ใช่ตัวเลข/นอกช่วงโลก = null */
export function parseLatLng(lat: unknown, lng: unknown): LatLng | null {
  const a = toNum(lat);
  const b = toNum(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return { lat: a, lng: b };
}

/** GeoJSON เรียง [lng, lat] — สลับผิดคือบั๊กคลาสสิก จึงสร้างผ่านฟังก์ชันนี้ที่เดียว */
export function toGeoPoint({ lat, lng }: LatLng): GeoPoint {
  return { type: "Point", coordinates: [lng, lat] };
}

export function fromGeoPoint(p: { coordinates?: unknown } | null | undefined): LatLng | null {
  const c = p?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  return parseLatLng(c[1], c[0]);
}

const EARTH_RADIUS_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** ระยะทางเส้นตรง (haversine) หน่วย กม. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** พิกัด 5 ตำแหน่ง (~1 ม.) สำหรับแสดงผล/คัดลอก */
export function formatCoords({ lat, lng }: LatLng): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function googleMapsDirUrl({ lat, lng }: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/**
 * ระดับความแม่นยำ GPS: good ≤ 20 ม. (ชิปเขียว) · fair ≤ 50 ม. (ชิปเหลือง) · poor > 50 ม. (เตือนให้ขยับหมุด)
 * ไม่มีค่า (ปักหมุดเอง) = manual
 */
export function accuracyTier(accuracyM: number | null | undefined): "good" | "fair" | "poor" | "manual" {
  if (accuracyM == null || !Number.isFinite(accuracyM) || accuracyM < 0) return "manual";
  if (accuracyM <= 20) return "good";
  if (accuracyM <= 50) return "fair";
  return "poor";
}

const MAX_RING_POINTS = 500;

/**
 * ตรวจ GeoJSON Polygon ที่มาจาก Geoman ก่อนบันทึก — วงเดียว (ไม่มีรู), ปิดรูป, ≥ 3 มุมจริง, พิกัดอยู่ในช่วงโลก
 * คืน error ภาษาไทย หรือ null ถ้าผ่าน · MongoDB 2dsphere จะปฏิเสธ polygon ตัดตัวเองอีกชั้น
 */
export function polygonError(geometry: unknown): string | null {
  const g = geometry as { type?: unknown; coordinates?: unknown } | null;
  if (!g || g.type !== "Polygon" || !Array.isArray(g.coordinates)) return "รูปร่างโซนต้องเป็น Polygon";
  if (g.coordinates.length !== 1) return "โซนต้องเป็นรูปเดียว ไม่มีรู";
  const ring = g.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) return "โซนต้องมีอย่างน้อย 3 มุม";
  if (ring.length > MAX_RING_POINTS) return `โซนมีจุดมุมเกิน ${MAX_RING_POINTS} จุด`;
  for (const p of ring) {
    if (!Array.isArray(p) || p.length < 2 || !parseLatLng(p[1], p[0])) return "พิกัดมุมโซนไม่ถูกต้อง";
  }
  const first = ring[0] as number[];
  const last = ring[ring.length - 1] as number[];
  if (first[0] !== last[0] || first[1] !== last[1]) return "โซนต้องปิดรูป (จุดแรกและจุดสุดท้ายตรงกัน)";
  const distinct = new Set(ring.slice(0, -1).map((p) => `${(p as number[])[0]},${(p as number[])[1]}`));
  if (distinct.size < 3) return "โซนต้องมีอย่างน้อย 3 มุม";
  return null;
}
