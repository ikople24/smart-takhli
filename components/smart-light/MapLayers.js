// base tile layers แผนที่ถนน (OSM) ↔ ภาพถ่ายดาวเทียม (Esri hybrid) — ใช้ร่วมทุกแผนที่ smart-light
// ปุ่มสลับอยู่ที่ MapLayerToggle.js (แยกออกเพราะไฟล์นี้ import react-leaflet ซึ่งแตะ window ตอน SSR)
import { TileLayer } from "react-leaflet";

// เรนเดอร์ base layer ตามค่า baseLayer ("street" | "satellite")
// satellite = ภาพถ่าย Esri + ป้ายถนน/สถานที่โปร่งใสวางทับ (hybrid)
// ต้องเป็นลูกของ <MapContainer> เท่านั้น
export function BaseTileLayers({ baseLayer }) {
  if (baseLayer === "satellite") {
    // Google hybrid (lyrs=y) — ภาพถ่ายดาวเทียม + ถนน/ป้ายชื่อภาษาไทยในตัว
    return (
      <TileLayer
        url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
        subdomains={["mt0", "mt1", "mt2", "mt3"]}
        attribution="&copy; Google"
        maxZoom={20}
      />
    );
  }
  return (
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution="&copy; OpenStreetMap contributors"
      maxZoom={19}
    />
  );
}
