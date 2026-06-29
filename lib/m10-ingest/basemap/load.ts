import { rewind, booleanValid, feature } from "@turf/turf";
import type { Feature, Polygon, MultiPolygon } from "geojson";

type Geom = Polygon | MultiPolygon;

export interface BasemapDoc {
  parcelCode: string;
  zoneId: string | null; blockId: string | null; lot: string | null;
  deedNo: string | null; landNo: string | null; survey: string | null;
  landType: string | null;
  area: { rai: number; ngan: number; wa: number; sqm: number };
  geometry: Geom;
}

const str = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim();
};
const num = (v: unknown): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

// ตัด ordinate ที่ 3 (Z) ออกจากทุกพิกัด → เหลือ [lng, lat]
function strip3D(coords: unknown): unknown {
  if (Array.isArray(coords) && typeof coords[0] === "number") return [coords[0], coords[1]];
  if (Array.isArray(coords)) return coords.map(strip3D);
  return coords;
}

export function featureToBasemapDoc(f: Feature): BasemapDoc | null {
  const p = f.properties ?? {};
  const parcelCode = str(p.PARCEL_COD);
  if (!parcelCode) return null;
  const g = f.geometry;
  if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) return null;
  const stripped = { type: g.type, coordinates: strip3D((g as Geom).coordinates) } as Geom;
  let geometry: Geom;
  try {
    const rewound = rewind(feature(stripped), { reverse: false }) as Feature<Geom>;
    if (!booleanValid(rewound.geometry)) return null;
    geometry = rewound.geometry;
  } catch { return null; }
  return {
    parcelCode,
    zoneId: str(p.ZONE_ID), blockId: str(p.BLOCK_ID), lot: str(p.LOT),
    deedNo: str(p.Chanod_no), landNo: str(p.LAND_NO), survey: str(p.SURVEY),
    landType: str(p.land_type),
    area: { rai: num(p.rai), ngan: num(p.ngan), wa: num(p.wa), sqm: num(p.area) },
    geometry,
  };
}
