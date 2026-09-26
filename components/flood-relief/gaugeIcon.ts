// components/flood-relief/gaugeIcon.ts — client only (import leaflet) · หมุดจุดบนแผนที่ ใช้ทั้งแดชบอร์ดและหน้าสาธารณะ
// จุดวัดน้ำ: มีรูปล่าสุด = วงกลมรูปย่อ + ป้าย ซม. · ยังไม่มีรูป = 📷 · รูปเก่าเกิน 6 ชม. = ขอบเทา
// จุดแจกน้ำดื่ม 💧 / จุดรับบริจาค 🎁: ไอคอนสีประจำประเภท (จำง่ายกว่ารูปย่อ)
import L from "leaflet";
import { POINT_KIND_META, type PointKind } from "@/lib/flood-relief/gauge";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function gaugeIcon(p: { kind?: PointKind; photoUrl: string | null; stale: boolean; levelCm: number | null }): L.DivIcon {
  const kind = p.kind ?? "gauge";
  const meta = POINT_KIND_META[kind];
  if (kind !== "gauge") {
    return L.divIcon({
      className: "",
      iconSize: [38, 38],
      iconAnchor: [19, 19],
      html: `<span style="display:flex;width:38px;height:38px;align-items:center;justify-content:center;border-radius:12px;background:${meta.color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);font-size:18px">${meta.icon}</span>`,
    });
  }
  const ring = p.stale ? "#A9A4B8" : meta.color;
  // Cloudinary transform ย่อเป็นรูปจิ๋วก่อนโหลด (ไม่ดึงรูปเต็ม 1024px มาทำหมุด)
  const thumb = p.photoUrl ? p.photoUrl.replace("/upload/", "/upload/c_fill,w_96,h_96,q_auto,f_auto/") : null;
  const inner = thumb
    ? `<img src="${esc(thumb)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:999px" />`
    : `<span style="font-size:17px">📷</span>`;
  const badge =
    p.levelCm != null
      ? `<span style="position:absolute;left:50%;bottom:-9px;transform:translateX(-50%);white-space:nowrap;background:${ring};color:#fff;font:700 10px/1 sans-serif;padding:3px 5px;border-radius:999px">${p.levelCm} ซม.</span>`
      : "";
  return L.divIcon({
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `<span style="position:relative;display:flex;width:40px;height:40px;align-items:center;justify-content:center;border-radius:999px;background:#fff;border:3px solid ${ring};box-shadow:0 2px 8px rgba(0,0,0,.3);overflow:visible">${inner}${badge}</span>`,
  });
}
