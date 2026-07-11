import { POLE_STATUS } from "@/lib/smart-light/constants";
import { overduePoles } from "@/lib/smart-light/metrics";
import { SL } from "@/lib/smart-light/theme";

// เสาค้างสำรวจนานสุด (top 6) — คลิกเพื่อโฟกัสบนแผนที่
export default function OverdueCard({ poles, onSelect }) {
  const rows = overduePoles(poles, 6);
  return (
    <div style={{ background: "#fff", border: `1px solid ${SL.line}`, borderRadius: 22, padding: 18, boxShadow: "0 20px 50px -34px rgba(33,27,46,.4)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ font: "700 14px 'Anuphan'", color: SL.ink }}>⏱ ค้างสำรวจนานสุด</div>
        <span style={{ fontSize: 11, color: SL.muted }}>เรียงตามวันที่</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
        {rows.length === 0 && <div style={{ fontSize: 12.5, color: SL.muted, padding: "8px 0" }}>ยังไม่มีข้อมูล</div>}
        {rows.map((o) => (
          <div key={o._id} onClick={() => onSelect(o)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderTop: `1px solid ${SL.soft2}`, cursor: "pointer" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: (POLE_STATUS[o.status] || POLE_STATUS.unknown).color, flex: "0 0 auto" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "600 12.5px 'IBM Plex Sans Thai'", color: SL.ink }}>{o.code}</div>
              <div style={{ fontSize: 11, color: SL.muted }}>{o.group}</div>
            </div>
            <span style={{ font: "600 11.5px 'IBM Plex Sans Thai'", color: "#DC2626", whiteSpace: "nowrap" }}>{o.daysLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
