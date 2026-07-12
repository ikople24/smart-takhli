// base tile layers แผนที่ถนน (OSM) ↔ ภาพถ่ายดาวเทียม (Esri hybrid) — ใช้ร่วมทุกแผนที่ smart-light
// ปุ่มสลับอยู่ที่ MapLayerToggle.js (แยกออกเพราะไฟล์นี้ import react-leaflet ซึ่งแตะ window ตอน SSR)
import { TileLayer } from "react-leaflet";

// เรนเดอร์ base layer ตามค่า baseLayer ("street" | "satellite")
// satellite = ภาพถ่าย Esri + ป้ายถนน/สถานที่โปร่งใสวางทับ (hybrid)
// ต้องเป็นลูกของ <MapContainer> เท่านั้น
export function BaseTileLayers({ baseLayer }) {
  if (baseLayer === "satellite") {
    // Google Satellite (lyrs=s) — แหล่งเดียวกับหน้าแจ้งเหตุ/ร้องเรียน ซูมได้ลึกกว่า Esri
    // subdomains ค่าเริ่มต้น a/b/c (เหมือน LocationPickerModal) — mt0-3 เคยขึ้นเทาบนเครือข่ายนี้
    return (
      <TileLayer
        url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
        attribution="&copy; Google"
        maxZoom={22}
        maxNativeZoom={20}
      />
    );
  }
  return (
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution="&copy; OpenStreetMap contributors"
      maxZoom={22}
      maxNativeZoom={19}
    />
  );
}
