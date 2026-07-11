import { useMemo, useState } from "react";
import { POLE_STATUS } from "@/lib/smart-light/constants";
import { daysSince } from "@/lib/smart-light/metrics";
import { SL } from "@/lib/smart-light/theme";

// ตารางเสาทั้งหมด — ค้นหา (รหัส/กลุ่ม) + เรียงคอลัมน์; คลิกแถวโฟกัสบนแผนที่แล้วปิด
export default function DataTableModal({ poles, onSelectRow, onClose }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "code", dir: 1 });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const days = (p) => { const d = daysSince(p.lastSurveyedAt); return d === null ? Infinity : d; };
    const val = (p, key) => (key === "days" ? days(p) : String(p[key] ?? "").toLowerCase());
    return poles
      .filter((p) => !term || p.code.toLowerCase().includes(term) || (p.group || "").toLowerCase().includes(term))
      .sort((a, b) => {
        const av = val(a, sort.key), bv = val(b, sort.key);
        if (av < bv) return -1 * sort.dir;
        if (av > bv) return 1 * sort.dir;
        return 0;
      });
  }, [poles, q, sort]);

  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));
  const th = (key, label, align) => (
    <button onClick={() => toggleSort(key)} style={{ textAlign: align || "left", border: 0, background: "transparent", cursor: "pointer", font: "700 12px 'IBM Plex Sans Thai'", color: SL.ink2, padding: 0 }}>
      {label}{sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </button>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(33,27,46,.42)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 940, height: "100%", maxHeight: 800, background: SL.surface, borderRadius: 26, boxShadow: "0 40px 90px -40px rgba(33,27,46,.7)", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "'IBM Plex Sans Thai'" }}>
        <div style={{ padding: "18px 24px", display: "flex", alignItems: "center", gap: 14, borderBottom: `1px solid ${SL.line}`, background: "#fff" }}>
          <div>
            <div style={{ font: "700 19px 'Anuphan'", color: SL.ink }}>📋 ตารางทะเบียนเสาไฟ</div>
            <div style={{ fontSize: 12, color: SL.muted, marginTop: 2 }}>ทั้งหมด {poles.length} ต้น · แตะแถวเพื่อดูบนแผนที่</div>
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 ค้นหารหัส / กลุ่ม" style={{ marginLeft: "auto", background: "#F6F3FD", border: `1px solid ${SL.line}`, borderRadius: 12, padding: "9px 13px", width: 240, font: "500 12.5px 'IBM Plex Sans Thai'", color: SL.ink, outline: "none" }} />
          <button onClick={onClose} style={{ cursor: "pointer", width: 34, height: 34, borderRadius: "50%", background: SL.soft2, color: SL.primary, border: 0, fontSize: 15 }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.9fr 1fr", gap: 8, padding: "13px 24px", background: "#F6F3FD", borderBottom: `1px solid ${SL.line}` }}>
          {th("code", "รหัสเสา")}{th("group", "กลุ่ม / ชุมชน")}{th("status", "สถานะ")}{th("days", "สำรวจล่าสุด", "right")}
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {rows.map((p) => {
            const s = POLE_STATUS[p.status] || POLE_STATUS.unknown;
            const d = daysSince(p.lastSurveyedAt);
            return (
              <div key={p._id} onClick={() => onSelectRow(p)} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.9fr 1fr", gap: 8, padding: "12px 24px", alignItems: "center", borderBottom: `1px solid #F4F1FB`, cursor: "pointer", fontSize: 12.5, color: SL.ink }}>
                <div style={{ fontWeight: 600 }}>{p.code}</div>
                <div style={{ color: SL.ink2 }}>{p.group}</div>
                <div><span style={{ font: "600 11px 'IBM Plex Sans Thai'", color: "#fff", background: s.color, padding: "2px 10px", borderRadius: 20 }}>{s.label}</span></div>
                <div style={{ textAlign: "right", color: SL.muted }}>{d === null ? "—" : `${d} วัน`}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
