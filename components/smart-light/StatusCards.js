import { POLE_STATUS } from "@/lib/smart-light/constants";
import { SL } from "@/lib/smart-light/theme";

// การ์ดสถานะ 2×2 คลิกเพื่อ toggle กรองสถานะ — รับ summary (นับตาม filter กลุ่มปัจจุบัน)
export default function StatusCards({ summary, filterStatus, onFilter }) {
  const items = ["normal", "damaged", "off", "unknown"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {items.map((value) => {
        const s = POLE_STATUS[value];
        const active = filterStatus === value;
        return (
          <button
            key={value}
            onClick={() => onFilter(active ? "all" : value)}
            style={{ textAlign: "left", border: active ? `2px solid ${SL.primary}` : `1px solid ${SL.line}`, cursor: "pointer", background: "#fff", borderRadius: 16, padding: "13px 14px", display: "flex", flexDirection: "column", gap: 7 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color }} />
              <span style={{ font: "600 12px 'IBM Plex Sans Thai'", color: SL.ink2 }}>{s.label}</span>
            </div>
            <div style={{ font: "800 23px 'Anuphan'", color: SL.ink, lineHeight: 1 }}>{summary[value]}</div>
          </button>
        );
      })}
    </div>
  );
}
