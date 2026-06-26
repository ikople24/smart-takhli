import type { Feature, FeatureCollection } from "geojson";
import { type RawGeometry, NormalizeError } from "../types";
import { parcelRecordKey } from "../normalize/ravang";

type Geom = GeoJSON.Polygon | GeoJSON.MultiPolygon;
// geojson ที่อาจห่อใน LocationGeospatial
interface WrappedFC { LocationGeospatial?: FeatureCollection }

export function parseGeometryGeoJSON(content: string): RawGeometry[] {
  let parsed: unknown;
  try { parsed = JSON.parse(content); }
  catch { throw new NormalizeError("geometry_invalid", "not valid JSON"); }
  // ไฟล์จริงห่อใน LocationGeospatial; เผื่อกรณี FeatureCollection ตรง ๆ ด้วย
  const fc = ((parsed as WrappedFC)?.LocationGeospatial ?? parsed) as FeatureCollection;
  if (!fc || fc.type !== "FeatureCollection" || !Array.isArray(fc.features))
    throw new NormalizeError("geometry_invalid", "expected a FeatureCollection");
  // ข้าม feature ที่ไม่มี geometry (valid GeoJSON ได้ แต่ผิด contract ของ RawGeometry)
  return fc.features
    .filter((f: Feature) => f && f.geometry)
    .map((f: Feature) => {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const recordKey = parcelRecordKey(
        { utm1: p.LandUTM1, utm2: p.LandUTM2, utm3: p.LandUTM3, utm4: p.LandUTM4, scale: p.LandUTMScale } as Parameters<typeof parcelRecordKey>[0],
        String(p.LandNumber ?? ""));
      return { recordKey, geometry: f.geometry as Geom };
    });
}
