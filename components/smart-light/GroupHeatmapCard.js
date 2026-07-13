import { groupHeat } from "@/lib/smart-light/metrics";
import { SL } from "@/lib/smart-light/theme";

// ความหนาแน่นปัญหารายกลุ่ม (รายกลุ่ม) — คลิกกรอง+บินไป centroid
export default function GroupHeatmapCard({ groups, filterGroup, onSelectGroup }) {
  const rows = groupHeat(groups);
  return (
    <div style={{ background: "#fff", border: `1px solid ${SL.line}`, borderRadius: 22, padding: 18, boxShadow: "0 20px 50px -34px rgba(33,27,46,.4)" }}>
      <div style={{ font: "700 14px 'Anuphan'", color: SL.ink }}>🔥 ความหนาแน่นปัญหา · รายกลุ่ม</div>
      <div style={{ fontSize: 11, color: SL.muted, marginTop: 2 }}>แตะกลุ่มเพื่อกรองแผนที่</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 13 }}>
        {rows.map((g) => {
          const alpha = (0.06 + g.ratio * 0.86).toFixed(3);
          const strong = g.ratio > 0.42;
          const active = filterGroup === g.name;
          return (
            <button
              key={g.name}
              onClick={() => onSelectGroup(active ? "all" : g.name, g.centroid)}
              style={{ textAlign: "left", cursor: "pointer", border: active ? `2px solid ${SL.primary}` : `1px solid ${SL.line}`, background: `rgba(124,58,237,${alpha})`, color: strong ? "#fff" : "#4A4360", borderRadius: 14, padding: "11px 12px" }}
            >
              <div style={{ font: "600 12px 'IBM Plex Sans Thai'", lineHeight: 1.25 }}>{g.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 6 }}>
                <span style={{ font: "800 20px 'Anuphan'", lineHeight: 1 }}>{g.problem}</span>
                <span style={{ fontSize: 10.5, color: strong ? "rgba(255,255,255,.78)" : SL.muted }}>/ {g.total} ต้น</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
