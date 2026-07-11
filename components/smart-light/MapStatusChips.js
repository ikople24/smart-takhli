import { POLE_STATUS } from "@/lib/smart-light/constants";
import { SL } from "@/lib/smart-light/theme";

// pill กรองสถานะลอยเหนือแผนที่ (บนสุดกลางจอ) — เลื่อนแนวนอนได้บนมือถือ
export default function MapStatusChips({ summary, filterStatus, onFilter }) {
  const chip = (value, label, count, color) => {
    const active = filterStatus === value;
    return (
      <button
        key={value}
        onClick={() => onFilter(value === "all" ? "all" : active ? "all" : value)}
        style={{ display: "flex", alignItems: "center", gap: 6, border: 0, cursor: "pointer", font: "600 12px 'IBM Plex Sans Thai'", padding: "6px 11px", borderRadius: 11, whiteSpace: "nowrap", background: active ? SL.soft : "transparent", color: active ? SL.primaryDark : SL.ink2 }}
      >
        {color && <span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />}
        {label} {count}
      </button>
    );
  };
  return (
    <div className="no-scrollbar" style={{ display: "flex", gap: 6, background: "rgba(255,255,255,.92)", backdropFilter: "blur(6px)", padding: 6, borderRadius: 16, boxShadow: "0 12px 34px -18px rgba(33,27,46,.5)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      {chip("all", "ทั้งหมด", summary.total, null)}
      {Object.entries(POLE_STATUS).map(([value, s]) => chip(value, s.label, summary[value], s.color))}
    </div>
  );
}
