// components/flood-relief/BaseTiles.tsx — client only (ใช้ใน MiniMap และ admin/AdminMap ที่ import ผ่าน dynamic ssr:false)
// ชั้นแผนที่พื้นของโมดูลที่เดียว: ถนน (OSM) / ดาวเทียม Google hybrid (lyrs=y มีชื่อถนนในตัว — ชัดกว่า Esri ในเขตตาคลี)
// แหล่งเดียวกับ components/MapBaseTileLayers.js
import { TileLayer } from "react-leaflet";

export type BaseMap = "street" | "satellite";

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

/** ปุ่มสลับ แผนที่/ดาวเทียม — segmented control ขนาดแตะได้บนมือถือ */
export function BaseMapToggle({
  value,
  onChange,
  className = "",
}: {
  value: BaseMap;
  onChange: (v: BaseMap) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label="รูปแบบแผนที่" className={`grid grid-cols-2 gap-1 rounded-[10px] bg-tk-unclaimed-soft p-0.5 ${className}`}>
      {(
        [
          ["street", "แผนที่"],
          ["satellite", "ดาวเทียม"],
        ] as const
      ).map(([k, label]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={`h-7 rounded-lg px-2 text-[11.5px] font-bold ${
            value === k ? "bg-white text-tk-flood shadow-tk-xs" : "text-tk-ink-4"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
