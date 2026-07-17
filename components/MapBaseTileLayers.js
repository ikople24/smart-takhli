// base tile layers ของแผนที่ทั้งระบบ — shared ทุกโมดูล
// มีสองแบบให้เลือกใช้ตามพื้นที่จอ:
//   <BaseLayersControl/>  = พาเนล 3 ตัวเลือก (แผนที่ / ดาวเทียม / ไฮบริด) — ชุดเดียวกับฟอร์มหน้าบ้าน
//   <BaseTileLayers/>     = ปุ่มสลับ 2 ค่า (street ↔ satellite) คู่กับ components/MapLayerToggle.js
import { TileLayer, LayersControl } from "react-leaflet";

const GOOGLE_SUBDOMAINS = ["mt0", "mt1", "mt2", "mt3"];

// พาเนลเลือกพื้นแผนที่ 3 แบบ (ต้องเป็นลูกของ <MapContainer>)
// ใช้ Google tiles ให้ตรงกับฟอร์มกรอกข้อมูลหน้าบ้าน — เจ้าหน้าที่จะได้เห็นภาพพื้นเดียวกันกับตอนปักหมุด
export function BaseLayersControl({ position = "topright" }) {
  return (
    <LayersControl position={position}>
      <LayersControl.BaseLayer checked name="แผนที่">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="ดาวเทียม">
        <TileLayer
          url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
          attribution="&copy; Google Maps"
          subdomains={GOOGLE_SUBDOMAINS}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="ไฮบริด">
        <TileLayer
          url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          attribution="&copy; Google Maps"
          subdomains={GOOGLE_SUBDOMAINS}
        />
      </LayersControl.BaseLayer>
    </LayersControl>
  );
}

// เรนเดอร์ base layer ตามค่า baseLayer ("street" | "satellite") — ใช้กับปุ่ม MapLayerToggle
// ต้องเป็นลูกของ <MapContainer> เท่านั้น
export function BaseTileLayers({ baseLayer }) {
  if (baseLayer === "satellite") {
    // Esri World Imagery — ไม่ตั้ง maxZoom/maxNativeZoom → ใช้ค่า default z18 ที่ Esri มีภาพจริง
    // (ตั้งเองแล้วจะขึ้น "Map data not yet available" ตอนซูมลึก)
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
