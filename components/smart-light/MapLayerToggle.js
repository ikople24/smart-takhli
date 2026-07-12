// ปุ่มไอคอนเลเยอร์เล็ก ๆ — แตะสลับ แผนที่ถนน ↔ ภาพถ่ายดาวเทียม (ลดพื้นที่จอ)
// เปิดดาวเทียม = ปุ่มม่วง, ถนน = ปุ่มขาว · pure UI ไม่พึ่ง leaflet (import ฝั่ง SSR ได้)
import { SL } from "@/lib/smart-light/theme";

export function MapLayerToggle({ value, onChange, className, style }) {
  const satellite = value === "satellite";
  return (
    <button
      type="button"
      onClick={() => onChange(satellite ? "street" : "satellite")}
      title={satellite ? "แผนที่ถนน" : "ภาพถ่ายดาวเทียม"}
      aria-label={satellite ? "สลับเป็นแผนที่ถนน" : "สลับเป็นภาพถ่ายดาวเทียม"}
      aria-pressed={satellite}
      className={className}
      style={{
        display: "grid",
        placeItems: "center",
        width: 38,
        height: 38,
        border: 0,
        cursor: "pointer",
        borderRadius: 11,
        background: satellite ? SL.primary : "rgba(255,255,255,.95)",
        color: satellite ? "#fff" : SL.ink2,
        backdropFilter: "blur(6px)",
        boxShadow: "0 12px 34px -18px rgba(33,27,46,.5)",
        ...style,
      }}
    >
      {/* ไอคอนเลเยอร์ (stacked layers) */}
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    </button>
  );
}
