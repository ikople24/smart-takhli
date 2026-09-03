// lib/tasks/mobile.js
// logic หน้ามือถือ (README § หน้าจอมือถือ) — logic ล้วน
// ระยะทาง "ใกล้ฉัน" (กองงานรอรับ), จัดอันดับงานด่วนสำหรับ FAB "อัปเดตงานด่วน", ตัวนับ chip
import { SEVERITY_ORDER } from "./derived";

const EARTH_KM = 6371;
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const toRad = (deg) => (deg * Math.PI) / 180;

/** ระยะทางบนผิวโลก (กม.) — พิกัดไม่ครบ/เพี้ยน → null */
export function haversineKm(a, b) {
  const lat1 = num(a?.lat);
  const lng1 = num(a?.lng);
  const lat2 = num(b?.lat);
  const lng2 = num(b?.lng);
  if (lat1 === null || lng1 === null || lat2 === null || lng2 === null) return null;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/** '850 ม. จากคุณ' (ปัด 10 ม.) · '1.2 กม. จากคุณ' · '12 กม. จากคุณ' */
export function formatDistanceLabel(km) {
  const d = num(km);
  if (d === null) return null;
  if (d < 1) return `${Math.round(d * 100) * 10} ม. จากคุณ`;
  if (d < 10) return `${d.toFixed(1)} กม. จากคุณ`;
  return `${Math.round(d)} กม. จากคุณ`;
}

/** เติม distanceKm/distanceLabel แล้วเรียงใกล้ก่อน (ไม่มีพิกัดไปท้าย) · ไม่มีตำแหน่งผู้ใช้ → ลำดับเดิม */
export function withDistance(items, origin) {
  const list = Array.isArray(items) ? items : [];
  if (num(origin?.lat) === null || num(origin?.lng) === null) {
    return list.map((i) => ({ ...i, distanceKm: null, distanceLabel: null }));
  }
  return list
    .map((i, index) => {
      const distanceKm = haversineKm(origin, i?.location);
      return { item: { ...i, distanceKm, distanceLabel: formatDistanceLabel(distanceKm) }, index };
    })
    .sort((x, y) => (x.item.distanceKm ?? Infinity) - (y.item.distanceKm ?? Infinity) || x.index - y.index)
    .map((x) => x.item);
}

const severityIndex = (s) => {
  const i = SEVERITY_ORDER.indexOf(s);
  return i < 0 ? SEVERITY_ORDER.indexOf("normal") : i;
};

/** งานที่ควรอัปเดตก่อน: severity → ใกล้ครบกำหนด → ไม่ได้อัปเดตนาน (ตัดงานที่เสร็จ) */
export function topUrgent(tasks, limit = 5) {
  return (Array.isArray(tasks) ? tasks : [])
    .filter((t) => t && !t.isCompleted)
    .map((t, index) => ({ t, index }))
    .sort(
      (x, y) =>
        severityIndex(x.t.severity) - severityIndex(y.t.severity) ||
        (num(x.t.daysToDue) ?? Infinity) - (num(y.t.daysToDue) ?? Infinity) ||
        (num(y.t.daysSinceUpdate) ?? -1) - (num(x.t.daysSinceUpdate) ?? -1) ||
        x.index - y.index
    )
    .slice(0, limit)
    .map((x) => x.t);
}

/**
 * ตัวเลขบน chip: กองของฉัน / ค้างนาน / ทั้งหมด (เจ้าหน้าที่ไม่ระบุกอง = กองของฉันคือทุกเรื่อง)
 * @param {object[]} items
 * @param {{ officerDepartment?: string | null }} [opts]
 */
export function poolChipCounts(items, { officerDepartment = null } = {}) {
  const list = Array.isArray(items) ? items : [];
  return {
    mine: officerDepartment ? list.filter((i) => i.department === officerDepartment).length : list.length,
    stale: list.filter((i) => i.isStale).length,
    all: list.length,
  };
}
