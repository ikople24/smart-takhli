import { type RawGeometry, NormalizeError } from "../types";
import { parcelRecordKey } from "../normalize/ravang";

export function parseGeometryGeoJSON(content: string): RawGeometry[] {
  let parsed: any;
  try { parsed = JSON.parse(content); }
  catch { throw new NormalizeError("geometry_invalid", "not valid JSON"); }
  // ไฟล์จริงห่อใน LocationGeospatial; เผื่อกรณี FeatureCollection ตรง ๆ ด้วย
  const fc = parsed?.LocationGeospatial ?? parsed;
  if (!fc || fc.type !== "FeatureCollection" || !Array.isArray(fc.features))
    throw new NormalizeError("geometry_invalid", "expected a FeatureCollection");
  // ข้าม feature ที่ไม่มี geometry (valid GeoJSON ได้ แต่ผิด contract ของ RawGeometry)
  return fc.features
    .filter((f: any) => f && f.geometry)
    .map((f: any) => {
      const p = f.properties ?? {};
      const recordKey = parcelRecordKey(
        { utm1: p.LandUTM1, utm2: p.LandUTM2, utm3: p.LandUTM3, utm4: p.LandUTM4, scale: p.LandUTMScale },
        String(p.LandNumber ?? ""));
      return { recordKey, geometry: f.geometry };
    });
}
