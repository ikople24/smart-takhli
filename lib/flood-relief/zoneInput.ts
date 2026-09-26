// lib/flood-relief/zoneInput.ts
// ตรวจ body ของ POST/PATCH zones (logic ล้วน) — ใช้ร่วมกับ polygonError / isZoneLevel

import { polygonError } from "./geo";
import { isZoneLevel, ZONE_META, type ZoneLevel } from "./zones";

export const ZONE_NAME_MAX = 20;

export type ZonePatch = { name?: string; level?: ZoneLevel; geometry?: unknown; active?: boolean };

/** คืน { ok, value } หรือ { ok:false, error } · requireAll = ตอนสร้าง (ต้องมี level + geometry) */
export function parseZoneInput(
  body: unknown,
  requireAll: boolean
): { ok: true; value: ZonePatch } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const value: ZonePatch = {};

  if (b.name !== undefined) {
    const name = String(b.name ?? "").trim().slice(0, ZONE_NAME_MAX);
    if (name) value.name = name;
  }
  if (b.level !== undefined || requireAll) {
    if (!isZoneLevel(b.level)) return { ok: false, error: "กรุณาเลือกระดับโซน" };
    value.level = b.level;
  }
  if (b.geometry !== undefined || requireAll) {
    const err = polygonError(b.geometry);
    if (err) return { ok: false, error: err };
    value.geometry = b.geometry;
  }
  if (b.active !== undefined) value.active = b.active === true;

  if (!requireAll && Object.keys(value).length === 0) return { ok: false, error: "ไม่มีข้อมูลที่จะแก้" };
  return { ok: true, value };
}

/** ข้อความลง history/audit เช่น "เปลี่ยนระดับเป็น วิกฤต · แก้รูปโซน" */
export function describeZonePatch(p: ZonePatch): string {
  const parts: string[] = [];
  if (p.name) parts.push(`เปลี่ยนชื่อเป็น ${p.name}`);
  if (p.level) parts.push(`เปลี่ยนระดับเป็น ${ZONE_META[p.level].label}`);
  if (p.geometry) parts.push("แก้รูปโซน");
  if (p.active === true) parts.push("เปิดใช้งาน");
  if (p.active === false) parts.push("ปิดใช้งาน");
  return parts.join(" · ");
}
