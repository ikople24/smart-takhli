// lib/flood-relief/gaugeView.ts — รูปแบบจุดวัดระดับน้ำสำหรับ API แอดมิน (มีชื่อผู้อัปโหลด — ห้ามใช้กับ endpoint สาธารณะ)
import { fromGeoPoint } from "./geo";
import { isPhotoStale } from "./gauge";

type Photo = { url: string; at: Date | string; levelCm?: number | null; note?: string; by?: string };
type GaugeDoc = Record<string, unknown> & { _id?: unknown; location?: { coordinates?: unknown }; photos?: Photo[] };

const HISTORY_IN_LIST = 12;

export function adminGauge(g: GaugeDoc, now: Date = new Date()) {
  const p = fromGeoPoint(g.location);
  const photos = Array.isArray(g.photos) ? g.photos : [];
  return {
    id: String(g._id),
    name: String(g.name ?? ""),
    lat: p?.lat ?? null,
    lng: p?.lng ?? null,
    note: String(g.note ?? ""),
    active: g.active !== false,
    lastPhotoUrl: (g.lastPhotoUrl as string) ?? null,
    lastPhotoAt: (g.lastPhotoAt as Date) ?? null,
    lastLevelCm: (g.lastLevelCm as number) ?? null,
    lastNote: String(g.lastNote ?? ""),
    stale: isPhotoStale(g.lastPhotoAt as Date, now),
    // ใหม่สุดก่อน
    photos: photos
      .slice(-HISTORY_IN_LIST)
      .reverse()
      .map((x) => ({ url: x.url, at: x.at, levelCm: x.levelCm ?? null, note: x.note ?? "", by: x.by ?? "" })),
    createdBy: String(g.createdBy ?? ""),
    updatedAt: (g.updatedAt as Date) ?? null,
  };
}
