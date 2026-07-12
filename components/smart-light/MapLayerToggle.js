// ปุ่มสลับชั้นแผนที่ — สไตล์เดียวกับฟอร์มร้องเรียน (🗺️ ถนน / 🛰️ ดาวเทียม, btn-xs primary/outline)
// วางลอยเหนือแผนที่ในกล่องขาวโปร่งให้ปุ่ม outline อ่านออกบนภาพถ่าย · pure UI ไม่พึ่ง leaflet
export function MapLayerToggle({ value, onChange, className, style }) {
  const btn = (val, label) => (
    <button
      type="button"
      className={`btn btn-xs ${value === val ? "btn-primary" : "btn-outline"}`}
      onClick={() => onChange(val)}
    >
      {label}
    </button>
  );
  return (
    <div
      className={className}
      style={{
        display: "flex",
        gap: 4,
        background: "rgba(255,255,255,.9)",
        backdropFilter: "blur(6px)",
        padding: 4,
        borderRadius: 10,
        boxShadow: "0 12px 34px -18px rgba(33,27,46,.5)",
        ...style,
      }}
    >
      {btn("street", "🗺️ ถนน")}
      {btn("satellite", "🛰️ ดาวเทียม")}
    </div>
  );
}
