// lib/flood-relief/gauge.ts
// จุดวัดระดับน้ำ: ตรวจข้อมูลขาเข้า + รูปแบบข้อมูลส่งออก (logic ล้วน)

import { parseLatLng, type LatLng } from "./geo";

export const GAUGE_NAME_MAX = 60;
export const GAUGE_NOTE_MAX = 300;
export const MAX_GAUGE_PHOTOS = 30;
/** ระดับน้ำที่รับได้ (ซม.) — กันพิมพ์ผิดหลักเป็นหลักหมื่น */
export const MAX_LEVEL_CM = 1000;
/** รูปเก่ากว่านี้ถือว่า "ไม่อัปเดต" — หน้าสาธารณะเตือนให้ระวังว่าอาจไม่ใช่สภาพปัจจุบัน */
export const STALE_PHOTO_HOURS = 6;

const CLOUDINARY_RE = /^https:\/\/res\.cloudinary\.com\//;

type Err = { ok: false; error: string };

export function parseGaugeCreate(body: unknown): { ok: true; name: string; point: LatLng; note: string } | Err {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().slice(0, GAUGE_NAME_MAX) : "";
  if (!name) return { ok: false, error: "กรุณาตั้งชื่อจุดวัด" };
  const point = parseLatLng(b.lat, b.lng);
  if (!point) return { ok: false, error: "พิกัดไม่ถูกต้อง" };
  const note = typeof b.note === "string" ? b.note.trim().slice(0, GAUGE_NOTE_MAX) : "";
  return { ok: true, name, point, note };
}

export function parseGaugePhoto(body: unknown): { ok: true; url: string; levelCm: number | null; note: string } | Err {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const url = typeof b.url === "string" ? b.url.trim() : "";
  if (!CLOUDINARY_RE.test(url)) return { ok: false, error: "รูปต้องอัปโหลดผ่านระบบ" };
  let levelCm: number | null = null;
  if (b.levelCm !== undefined && b.levelCm !== null && b.levelCm !== "") {
    const n = Number(b.levelCm);
    if (!Number.isFinite(n) || n < 0 || n > MAX_LEVEL_CM) return { ok: false, error: `ระดับน้ำต้องอยู่ระหว่าง 0–${MAX_LEVEL_CM} ซม.` };
    levelCm = Math.round(n);
  }
  const note = typeof b.note === "string" ? b.note.trim().slice(0, GAUGE_NOTE_MAX) : "";
  return { ok: true, url, levelCm, note };
}

/** รูปล่าสุดเก่าเกิน STALE_PHOTO_HOURS หรือยังไม่มีรูป */
export function isPhotoStale(lastPhotoAt: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!lastPhotoAt) return true;
  const t = new Date(lastPhotoAt).getTime();
  return Number.isNaN(t) || now.getTime() - t > STALE_PHOTO_HOURS * 60 * 60 * 1000;
}

type GaugeDoc = {
  _id?: unknown;
  name?: string;
  location?: { coordinates?: unknown };
  note?: string;
  lastPhotoUrl?: string | null;
  lastPhotoAt?: Date | string | null;
  lastLevelCm?: number | null;
  lastNote?: string;
};

/**
 * รูปแบบสาธารณะ (/flood) — whitelist ทีละช่อง **ไม่มีชื่อผู้อัปโหลด/ประวัติ/ผู้สร้าง**
 */
export function publicGauge(g: GaugeDoc, now: Date = new Date()) {
  const c = g.location?.coordinates;
  const point = Array.isArray(c) ? parseLatLng(c[1], c[0]) : null;
  return {
    name: g.name ?? "",
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    note: g.note ?? "",
    photoUrl: g.lastPhotoUrl ?? null,
    photoAt: g.lastPhotoAt ?? null,
    levelCm: g.lastLevelCm ?? null,
    photoNote: g.lastNote ?? "",
    stale: isPhotoStale(g.lastPhotoAt, now),
  };
}
