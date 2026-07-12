// เลือกชนิดแผนที่แบบ dropdown — แผนที่ถนน / ภาพถ่ายดาวเทียม (มุมขวาบนแผนที่)
// pure UI ไม่พึ่ง leaflet (import ฝั่ง SSR ได้)
import { SL } from "@/lib/smart-light/theme";

export function MapLayerToggle({ value, onChange, className, style }) {
  return (
    <select
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="เลือกชนิดแผนที่"
      style={{
        border: `1px solid ${SL.line}`,
        background: "rgba(255,255,255,.95)",
        backdropFilter: "blur(6px)",
        color: SL.ink,
        font: "600 12.5px 'IBM Plex Sans Thai'",
        padding: "7px 30px 7px 11px",
        borderRadius: 10,
        cursor: "pointer",
        boxShadow: "0 12px 34px -18px rgba(33,27,46,.5)",
        outline: "none",
        appearance: "none",
        WebkitAppearance: "none",
        // ลูกศร dropdown เล็ก ๆ
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2357506A' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 9px center",
        ...style,
      }}
    >
      <option value="street">🗺️ แผนที่ถนน</option>
      <option value="satellite">🛰️ ภาพถ่ายดาวเทียม</option>
    </select>
  );
}
