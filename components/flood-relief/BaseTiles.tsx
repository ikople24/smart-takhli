// components/flood-relief/BaseTiles.tsx — client only (ใช้ใน MiniMap และ admin/AdminMap ที่ import ผ่าน dynamic ssr:false)
// ชั้นแผนที่พื้นของโมดูลที่เดียว: ถนน (OSM) / ดาวเทียม Google hybrid (lyrs=y มีชื่อถนนในตัว — ชัดกว่า Esri ในเขตตาคลี)
// แหล่งเดียวกับ components/MapBaseTileLayers.js
import { TileLayer } from "react-leaflet";
import type { BaseMap } from "./BaseMapToggle";

export default function BaseTiles({ baseMap }: { baseMap: BaseMap }) {
  return baseMap === "satellite" ? (
    <TileLayer
      key="sat"
      url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
      subdomains={["mt0", "mt1", "mt2", "mt3"]}
      attribution="Imagery &copy; Google"
      maxNativeZoom={20}
      maxZoom={21}
    />
  ) : (
    <TileLayer
      key="osm"
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
    />
  );
}
