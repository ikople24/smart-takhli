import { SL } from "@/lib/smart-light/theme";

// การ์ดโดนัทสุขภาพเสาไฟรวม (% ปกติ) + legend — รับผล healthSummary(groups)
export default function HealthSummaryCard({ health }) {
  const { total, normal, problem, unknown, pct } = health;
  const deg = Math.round(pct * 3.6);
  const ring = `conic-gradient(#ffffff ${deg}deg, rgba(255,255,255,.22) 0)`;
  const rows = [
    { c: "#4ADE80", label: "ใช้งานได้", val: normal },
    { c: "#FCD34D", label: "ต้องซ่อม", val: problem },
    { c: "rgba(255,255,255,.55)", label: "ยังไม่สำรวจ", val: unknown },
  ];
  return (
    <div style={{ background: SL.primary, borderRadius: 22, padding: 20, color: "#fff", boxShadow: "0 22px 46px -26px rgba(124,58,237,.85)" }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,.85)" }}>สถานะเสาไฟรวม</div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 14 }}>
        <div style={{ position: "relative", width: 106, height: 106, borderRadius: "50%", background: ring, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
          <div style={{ width: 78, height: 78, borderRadius: "50%", background: SL.primary, display: "grid", placeItems: "center" }}>
            <div style={{ font: "800 27px 'Anuphan'", lineHeight: 1 }}>{pct}%</div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11 }}>
          {rows.map((r) => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: r.c }} />
              <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.85)", flex: 1 }}>{r.label}</span>
              <span style={{ font: "700 15px 'Anuphan'" }}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,.7)" }}>ทั้งหมด {total} ต้น</div>
    </div>
  );
}
