// base tile layers แผนที่ถนน (OSM) ↔ ภาพถ่ายดาวเทียม (Esri hybrid) — ใช้ร่วมทุกแผนที่ smart-light
// ปุ่มสลับอยู่ที่ MapLayerToggle.js (แยกออกเพราะไฟล์นี้ import react-leaflet ซึ่งแตะ window ตอน SSR)
import { TileLayer } from "react-leaflet";

// เรนเดอร์ base layer ตามค่า baseLayer ("street" | "satellite")
// satellite = ภาพถ่าย Esri + ป้ายถนน/สถานที่โปร่งใสวางทับ (hybrid)
// ต้องเป็นลูกของ <MapContainer> เท่านั้น
export function BaseTileLayers({ baseLayer }) {
  if (baseLayer === "satellite") {
    // Esri World Imagery เฉพาะภาพถ่าย (Google ขึ้นขาว/ถูกบล็อกบนเครือข่ายนี้)
    // ไม่ใส่ชั้นป้ายกำกับ (World_Transportation/Boundaries) เพราะมันคืน "Map data not yet available" ในพื้นที่ไม่มีข้อมูล
    // maxNativeZoom 18: ซูมเกินระดับที่มีภาพให้ขยายภาพเดิมแทน
    return (
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
        maxZoom={22}
        maxNativeZoom={18}
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
