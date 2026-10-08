// แก้ไข/เพิ่มหัวโบล์จากหลังบ้าน — logic ล้วน ใช้ทั้ง API และหน้าเว็บ (เทสต์: __tests__/flushPointEdit.test.js)
// รหัส (code) เปลี่ยนไม่ได้หลังสร้าง เพราะ FlushingLog เก็บ flushPointCode เป็นสำเนา
import { FLUSH_POINT_KIND_LABELS, distanceM } from "./flushPoints";

export const FLUSH_POINT_KINDS = Object.keys(FLUSH_POINT_KIND_LABELS);
export const FLUSH_POINT_FIELD_LABELS = {
  name: "ชื่อจุด",
  roadName: "ถนน/ซอย",
  kind: "ประเภท",
  location: "ตำแหน่ง",
  photoUrl: "รูป",
  active: "สถานะใช้งาน",
};
export const FLUSH_POINT_ISSUE_LABELS = {
  no_name: "ยังไม่มีชื่อจุด",
  no_road: "ยังไม่ระบุถนน/ซอย",
  unknown_kind: "ชนิดไม่ระบุ",
};
export const MAX_HISTORY = 30;

const CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,19}$/;
const CLOUDINARY_PREFIX = "https://res.cloudinary.com/";

const str = (v) => (v === null || v === undefined ? "" : String(v)).trim();
const num = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));

export function validateFlushPointInput(body, { isCreate = false } = {}) {
  const b = body || {};
  const errors = {};
  const value = {};

  if (isCreate) {
    const code = str(b.code).toUpperCase();
    if (!code) errors.code = "กรุณาใส่รหัสหัวโบล์";
    else if (!CODE_RE.test(code)) errors.code = "รหัสใช้ได้เฉพาะ A–Z, 0–9 และ - (2–20 ตัว)";
    else value.code = code;
  }

  value.name = str(b.name);
  if (value.name.length > 200) errors.name = "ชื่อจุดยาวเกิน 200 ตัวอักษร";

  value.roadName = str(b.roadName);
  if (value.roadName.length > 120) errors.roadName = "ชื่อถนน/ซอยยาวเกิน 120 ตัวอักษร";

  value.kind = str(b.kind) || "unknown";
  if (!FLUSH_POINT_KINDS.includes(value.kind)) errors.kind = "ประเภทไม่ถูกต้อง";

  const lat = num(b.lat);
  const lng = num(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    errors.location = "พิกัดไม่ถูกต้อง";
  } else {
    value.location = { type: "Point", coordinates: [lng, lat] };
  }

  value.photoUrl = str(b.photoUrl);
  if (value.photoUrl && !value.photoUrl.startsWith(CLOUDINARY_PREFIX)) errors.photoUrl = "รูปต้องอัปโหลดผ่านระบบ";

  if (b.active === undefined || b.active === null) value.active = true;
  else if (typeof b.active === "boolean") value.active = b.active;
  else errors.active = "สถานะใช้งานไม่ถูกต้อง";

  return { ok: Object.keys(errors).length === 0, value, errors };
}

// รายการช่องที่เปลี่ยน สำหรับบันทึกประวัติ · ตำแหน่งขยับ < 0.5 ม. ถือว่าไม่เปลี่ยน (ปัดเศษทศนิยมจากแผนที่)
export function diffFlushPoint(before, after) {
  const changes = [];
  for (const field of ["name", "roadName", "kind", "active", "photoUrl"]) {
    const from = before?.[field] ?? (field === "active" ? true : "");
    const to = after?.[field] ?? (field === "active" ? true : "");
    if (from !== to) changes.push({ field, from, to });
  }
  const [lng1, lat1] = before?.location?.coordinates || [];
  const [lng2, lat2] = after?.location?.coordinates || [];
  if ([lat1, lng1, lat2, lng2].every(Number.isFinite)) {
    const moved = distanceM(lat1, lng1, lat2, lng2);
    if (moved >= 0.5) {
      changes.push({
        field: "location",
        from: `${lat1.toFixed(6)},${lng1.toFixed(6)}`,
        to: `${lat2.toFixed(6)},${lng2.toFixed(6)}`,
        movedM: Math.round(moved),
      });
    }
  }
  return changes;
}

// ข้อมูลที่ยังไม่ครบ — ใช้กับตัวกรอง "ต้องตรวจข้อมูล"
export function flushPointIssues(p) {
  const out = [];
  if (!str(p?.name)) out.push("no_name");
  if (!str(p?.roadName)) out.push("no_road");
  if (!p?.kind || p.kind === "unknown") out.push("unknown_kind");
  return out;
}

// ตัวเลือกชื่อถนน/ซอยจากที่มีอยู่ — ให้สะกดตรงกันทั้งทะเบียน
export function roadNameOptions(points) {
  const counts = new Map();
  for (const p of points || []) {
    const r = str(p?.roadName);
    if (r) counts.set(r, (counts.get(r) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));
}
