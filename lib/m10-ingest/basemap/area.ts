// แปลงพื้นที่ไร่-งาน-วา ↔ ตร.ม. + พื้นที่ geodesic จาก geometry (pure)
import { area as turfArea } from "@turf/turf";

export const SQM_PER_WA = 4;
export const WA_PER_NGAN = 100;
export const WA_PER_RAI = 400;
export const SQM_PER_NGAN = WA_PER_NGAN * SQM_PER_WA; // 400
export const SQM_PER_RAI = WA_PER_RAI * SQM_PER_WA; // 1600

export interface AreaParts { rai: number; ngan: number; wa: number; sqm: number; }

// {rai,ngan,wa} → ตร.ม.
export function partsToSqm(rai: number, ngan: number, wa: number): number {
  return rai * SQM_PER_RAI + ngan * SQM_PER_NGAN + wa * SQM_PER_WA;
}

// ตร.ม. → {rai,ngan,wa,sqm} (วา ปัด 2 ตำแหน่ง)
export function sqmToParts(sqm: number): AreaParts {
  if (!sqm || sqm <= 0) return { rai: 0, ngan: 0, wa: 0, sqm: 0 };
  const totalWa = sqm / SQM_PER_WA;
  const rai = Math.floor(totalWa / WA_PER_RAI);
  let remain = totalWa - rai * WA_PER_RAI;
  const ngan = Math.floor(remain / WA_PER_NGAN);
  remain -= ngan * WA_PER_NGAN;
  const wa = Math.round(remain * 100) / 100;
  return { rai, ngan, wa, sqm: Math.round(sqm * 100) / 100 };
}

// "R-N-W" → {rai,ngan,wa,sqm} | null
export function parseAreaStr(str: string | null | undefined): AreaParts | null {
  if (!str || typeof str !== "string") return null;
  const p = str.split("-");
  if (p.length !== 3) return null;
  const rai = Number(p[0]), ngan = Number(p[1]), wa = Number(p[2]);
  if (![rai, ngan, wa].every((n) => Number.isFinite(n))) return null;
  return { rai, ngan, wa, sqm: partsToSqm(rai, ngan, wa) };
}

// {rai,ngan,wa} → "R-N-W"
export function formatAreaStr(a: { rai: number; ngan: number; wa: number } | null | undefined): string {
  if (!a) return "";
  return `${a.rai || 0}-${a.ngan || 0}-${a.wa || 0}`;
}

// geometry → ตร.ม. (turf geodesic)
export function geometryAreaSqm(geom: GeoJSON.Geometry | null | undefined): number {
  if (!geom) return 0;
  try { return Math.round(Math.abs(turfArea(geom)) * 100) / 100; } catch { return 0; }
}
