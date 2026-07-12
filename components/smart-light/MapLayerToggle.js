// pill สลับชั้นแผนที่ ธีมม่วง (แผนที่ถนน ↔ ภาพถ่ายดาวเทียม) — pure UI ไม่พึ่ง leaflet
// แยกจาก MapLayers.js เพื่อให้ import ฝั่ง SSR ได้ (react-leaflet แตะ window ตอน import)
import { SL } from "@/lib/smart-light/theme";

export function MapLayerToggle({ value, onChange, size = "md", className, style }) {
  const pad = size === "sm" ? "5px 9px" : "7px 12px";
  const font = size === "sm" ? "600 11px" : "600 12px";
  const opt = (val, label) => {
    const active = value === val;
    return (
      <button
        type="button"
        onClick={() => onChange(val)}
        style={{
          border: 0,
          cursor: "pointer",
          font: `${font} 'IBM Plex Sans Thai'`,
          padding: pad,
          borderRadius: 9,
          whiteSpace: "nowrap",
          background: active ? SL.primary : "transparent",
          color: active ? "#fff" : SL.ink2,
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div
      className={className}
      style={{
        display: "flex",
        gap: 3,
        background: "rgba(255,255,255,.92)",
        backdropFilter: "blur(6px)",
        padding: 4,
        borderRadius: 12,
        boxShadow: "0 12px 34px -18px rgba(33,27,46,.5)",
        ...style,
      }}
    >
      {opt("street", "🗺️ แผนที่")}
      {opt("satellite", "🛰️ ดาวเทียม")}
    </div>
  );
}
