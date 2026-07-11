import { useEffect, useState } from "react";
import { POLE_STATUS } from "@/lib/smart-light/constants";
import { haversineMeters } from "@/lib/smart-light/geo";
import { SL } from "@/lib/smart-light/theme";

// การ์ด "เสาไฟใกล้คุณ" (มือถือ) — ใช้ GPS + haversine หา 3 ต้นใกล้สุด
export default function NearbyCard({ poles, onSelect }) {
  const [pos, setPos] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) { setErr("อุปกรณ์นี้ไม่รองรับ GPS"); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setErr("เปิดสิทธิ์ตำแหน่งเพื่อดูเสาใกล้คุณ")
    );
  }, []);

  const near = pos
    ? poles
        .map((p) => ({ ...p, dist: haversineMeters(pos.lat, pos.lng, p.lat, p.lng) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3)
    : [];

  return (
    <div style={{ background: "#fff", border: `1px solid ${SL.line}`, borderRadius: 22, boxShadow: "0 22px 44px -22px rgba(33,27,46,.45)", padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ font: "700 13px 'Anuphan'", color: SL.ink }}>📍 เสาไฟใกล้คุณ</div>
        <div style={{ fontSize: 11, color: SL.muted }}>ใกล้สุด 3 ต้น</div>
      </div>
      {err && <div style={{ fontSize: 11.5, color: SL.muted, marginTop: 8 }}>{err}</div>}
      {near.map((o) => (
        <div key={o._id} onClick={() => onSelect(o)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${SL.soft2}`, cursor: "pointer" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: (POLE_STATUS[o.status] || POLE_STATUS.unknown).color, flex: "0 0 auto" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "600 12.5px 'IBM Plex Sans Thai'", color: SL.ink }}>{o.code}</div>
            <div style={{ fontSize: 10.5, color: SL.muted }}>{o.group} · ห่าง {Math.round(o.dist)} ม.</div>
          </div>
          <span style={{ font: "600 11px 'IBM Plex Sans Thai'", color: SL.primary }}>นำทาง</span>
        </div>
      ))}
    </div>
  );
}
