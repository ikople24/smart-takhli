// base tile layers แผนที่ถนน (OSM) ↔ ภาพถ่ายดาวเทียม (Esri hybrid) — ใช้ร่วมทุกแผนที่ smart-light
// ปุ่มสลับอยู่ที่ MapLayerToggle.js (แยกออกเพราะไฟล์นี้ import react-leaflet ซึ่งแตะ window ตอน SSR)
import { TileLayer } from "react-leaflet";

// เรนเดอร์ base layer ตามค่า baseLayer ("street" | "satellite")
// satellite = ภาพถ่าย Esri + ป้ายถนน/สถานที่โปร่งใสวางทับ (hybrid)
// ต้องเป็นลูกของ <MapContainer> เท่านั้น
export function BaseTileLayers({ baseLayer }) {
  if (baseLayer === "satellite") {
    // Esri World Imagery — config เดียวกับ smart-namphare (ไม่ตั้ง maxZoom/maxNativeZoom
    // → ใช้ค่า default z18 ที่ Esri มีภาพจริง ภาพคมชัด ไม่ขึ้น "Map data not yet available")
    return (
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="&copy; Esri, Maxar, Earthstar Geographics"
      />
    );
  }
  return (
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution="&copy; OpenStreetMap contributors"
    />
  );
}
