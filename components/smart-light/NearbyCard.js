import { useCallback, useEffect, useState } from "react";
import { POLE_STATUS } from "@/lib/smart-light/constants";
import { haversineMeters } from "@/lib/smart-light/geo";
import { SL } from "@/lib/smart-light/theme";

// การ์ด "เสาไฟใกล้คุณ" (มือถือ) — ใช้ GPS + haversine หา 3 ต้นใกล้สุด
// แตะการ์ดเพื่อขอสิทธิ์ตำแหน่ง (หรือขอใหม่ถ้าเคยปฏิเสธ)
// หมายเหตุ: เบราว์เซอร์บล็อก GPS บน origin ที่ไม่ปลอดภัย (http ที่ไม่ใช่ localhost) — ต้องเปิดผ่าน HTTPS
export default function NearbyCard({ poles, onSelect }) {
  const [pos, setPos] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const request = useCallback(() => {
    setErr("");
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setErr("ต้องเปิดหน้านี้ผ่าน HTTPS ถึงจะใช้ตำแหน่งได้");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErr("อุปกรณ์นี้ไม่รองรับ GPS");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLoading(false);
      },
      (e) => {
        setLoading(false);
        setErr(
          e && e.code === 1
            ? "ถูกปฏิเสธสิทธิ์ตำแหน่ง — แตะเพื่อลองอีกครั้ง"
            : "อ่านตำแหน่งไม่ได้ — แตะเพื่อลองอีกครั้ง"
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // ลองขอครั้งแรกอัตโนมัติ (ถ้า origin ปลอดภัย)
  useEffect(() => {
    request();
  }, [request]);

  const near = pos
    ? poles
        .map((p) => ({ ...p, dist: haversineMeters(pos.lat, pos.lng, p.lat, p.lng) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3)
    : [];

  const subtitle = loading
    ? "กำลังหาตำแหน่ง…"
    : pos
    ? `ใกล้สุด ${near.length} ต้น`
    : "แตะเพื่อเปิดตำแหน่ง";

  return (
    <div style={{ background: "#fff", border: `1px solid ${SL.line}`, borderRadius: 22, boxShadow: "0 22px 44px -22px rgba(33,27,46,.45)", padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ font: "700 13px 'Anuphan'", color: SL.ink }}>📍 เสาไฟใกล้คุณ</div>
        <div style={{ fontSize: 11, color: SL.muted }}>{subtitle}</div>
      </div>

      {/* ยังไม่มีตำแหน่ง → แตะทั้งแถบเพื่อขอสิทธิ์/ลองใหม่ */}
      {!pos && (
        <button
          type="button"
          onClick={request}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 10,
            border: `1.5px dashed ${SL.line}`,
            background: SL.soft2,
            color: SL.primary,
            font: "600 12px 'IBM Plex Sans Thai'",
            borderRadius: 12,
            padding: "10px 12px",
            cursor: loading ? "default" : "pointer",
            textAlign: "center",
          }}
        >
          {loading ? "กำลังหาตำแหน่ง…" : err || "แตะเพื่อเปิดตำแหน่งและดูเสาใกล้คุณ"}
        </button>
      )}

      {pos && near.length === 0 && (
        <div style={{ fontSize: 11.5, color: SL.muted, marginTop: 8 }}>ยังไม่มีเสาในระบบ</div>
      )}

      {near.map((o) => (
        <div key={o._id} onClick={() => onSelect(o)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${SL.soft2}`, cursor: "pointer" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: (POLE_STATUS[o.status] || POLE_STATUS.unknown).color, flex: "0 0 auto" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "600 12.5px 'IBM Plex Sans Thai'", color: SL.ink }}>{o.code}</div>
            <div style={{ fontSize: 10.5, color: SL.muted }}>{o.group} · ห่าง {Math.round(o.dist)} ม.</div>
          </div>
          <span style={{ font: "600 11px 'IBM Plex Sans Thai'", color: SL.primary }}>เลือก</span>
        </div>
      ))}
    </div>
  );
}
