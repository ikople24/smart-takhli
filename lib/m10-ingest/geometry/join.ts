import { rewind, booleanValid, feature } from "@turf/turf";
import type { RawGeometry } from "../types";
import { reprojectGeometry } from "./reproject";

type Geom = GeoJSON.Polygon | GeoJSON.MultiPolygon;
export type PreparedGeometry =
  | { ok: true; recordKey: string; geometry: Geom }
  | { ok: false; recordKey: string };

export function prepareGeometry(raw: RawGeometry): PreparedGeometry {
  try {
    const reprojected = reprojectGeometry(raw.geometry);
    const wound = rewind(feature(reprojected), { reverse: false }).geometry as Geom;
    if (!booleanValid(wound)) return { ok: false, recordKey: raw.recordKey };
    return { ok: true, recordKey: raw.recordKey, geometry: wound };
  } catch {
    return { ok: false, recordKey: raw.recordKey };
  }
}

export interface JoinResult {
  matched: Map<string, Geom>;
  invalid: RawGeometry[];
  unmatchedGeometry: string[];
  recordsWithoutGeometry: string[];
}

export function joinGeometry(recordKeys: string[], geometries: RawGeometry[]): JoinResult {
  const keySet = new Set(recordKeys);
  const matched = new Map<string, Geom>();
  const invalid: RawGeometry[] = [];
  const unmatchedGeometry: string[] = [];
  for (const g of geometries) {
    const p = prepareGeometry(g);
    if (!p.ok) { invalid.push(g); continue; }
    if (keySet.has(p.recordKey)) matched.set(p.recordKey, p.geometry);
    else unmatchedGeometry.push(p.recordKey);
  }
  return { matched, invalid, unmatchedGeometry, recordsWithoutGeometry: recordKeys.filter((k) => !matched.has(k)) };
}
