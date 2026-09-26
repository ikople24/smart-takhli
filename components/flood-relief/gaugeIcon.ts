// components/flood-relief/gaugeIcon.ts — client only (import leaflet) · หมุดจุดวัดระดับน้ำ ใช้ทั้งแดชบอร์ดและหน้าสาธารณะ
// มีรูปล่าสุด = วงกลมรูปย่อ · ยังไม่มีรูป = ไอคอนกล้อง · รูปเก่าเกิน 6 ชม. = ขอบเทา (ให้รู้ว่าอาจไม่ใช่สภาพปัจจุบัน)
import L from "leaflet";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function gaugeIcon(photoUrl: string | null, stale: boolean, levelCm: number | null): L.DivIcon {
  const ring = stale ? "#A9A4B8" : "#1D4299";
  // Cloudinary transform ย่อเป็นรูปจิ๋วก่อนโหลด (ไม่ดึงรูปเต็ม 1024px มาทำหมุด)
  const thumb = photoUrl ? photoUrl.replace("/upload/", "/upload/c_fill,w_96,h_96,q_auto,f_auto/") : null;
  const inner = thumb
    ? `<img src="${esc(thumb)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:999px" />`
    : `<span style="font-size:17px">📷</span>`;
  const badge =
    levelCm != null
      ? `<span style="position:absolute;left:50%;bottom:-9px;transform:translateX(-50%);white-space:nowrap;background:${ring};color:#fff;font:700 10px/1 sans-serif;padding:3px 5px;border-radius:999px">${levelCm} ซม.</span>`
      : "";
  return L.divIcon({
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `<span style="position:relative;display:flex;width:40px;height:40px;align-items:center;justify-content:center;border-radius:999px;background:#fff;border:3px solid ${ring};box-shadow:0 2px 8px rgba(0,0,0,.3);overflow:visible">${inner}${badge}</span>`,
  });
}
