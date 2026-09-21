// ช่องค้นหาช่องเดียว ตรวจรูปแบบอัตโนมัติ:
// - "lat,lng" หรือปุ่มใช้ตำแหน่งปัจจุบัน → 10 เสาใกล้สุดเรียงตามระยะ (haversine ฝั่ง client)
// - ข้อความอื่น → ค้นจากรหัสเสา (บางส่วนได้) และชื่อกลุ่ม
import { useMemo, useState } from "react";
import { POLE_STATUS } from "@/lib/smart-light/constants";
import { haversineMeters, googleMapsDirectionsUrl, parseLatLng } from "@/lib/smart-light/geo";
import { SL } from "@/lib/smart-light/theme";

const MAX_RESULTS = 10;

export default function SearchPanel({ poles, onFocusPole }) {
  const [query, setQuery] = useState("");
  const [gpsError, setGpsError] = useState("");

  const useCurrentLocation = () => {
    setGpsError("");
    if (!navigator.geolocation) {
      setGpsError("อุปกรณ์นี้ไม่รองรับ GPS — พิมพ์พิกัดเองได้");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setQuery(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      },
      () => setGpsError("อ่านตำแหน่งไม่ได้ — เปิดสิทธิ์ GPS หรือพิมพ์พิกัด/แตะแผนที่แทน")
    );
  };

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return { mode: null, items: [] };

    const point = parseLatLng(q);
    if (point) {
      // โหมดพิกัด: เสาใกล้สุด 10 อันดับ
      const items = poles
        .map((p) => ({
          pole: p,
          distance: haversineMeters(point.lat, point.lng, p.lat, p.lng),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, MAX_RESULTS);
      return { mode: "gps", items };
    }

    // โหมดข้อความ: รหัสเสา (บางส่วน) หรือชื่อกลุ่ม
    const lower = q.toLowerCase();
    const items = poles
      .filter(
        (p) =>
          p.code.toLowerCase().includes(lower) ||
          (p.group || "").toLowerCase().includes(lower)
      )
      .slice(0, MAX_RESULTS)
      .map((p) => ({ pole: p, distance: null }));
    return { mode: "text", items };
  }, [query, poles]);

  const formatDistance = (m) =>
    m >= 1000 ? `${(m / 1000).toFixed(1)} กม.` : `${Math.round(m)} ม.`;

  return (
    <div className="w-full" style={{ position: "relative" }}>
      <div
        className="flex items-center gap-1"
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "9px 13px",
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>🔍</span>
        <input
          className="flex-1 min-w-0"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="รหัส / กลุ่ม"
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 13,
            color: SL.ink,
          }}
        />
        <button
          onClick={useCurrentLocation}
          title="ตำแหน่งปัจจุบัน"
          style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14, lineHeight: 1 }}
        >
          📍
        </button>
      </div>
      {gpsError && <p className="text-error text-xs mt-1">{gpsError}</p>}

      {results.items.length > 0 && (
        <ul
          className="menu max-h-64 overflow-y-auto flex-nowrap w-full"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 1200,
            background: "#fff",
            border: `1px solid ${SL.line}`,
            borderRadius: 14,
            boxShadow: "0 22px 44px -22px rgba(33,27,46,.45)",
          }}
        >
          {results.items.map(({ pole, distance }) => (
            <li key={pole._id}>
              <div
                className="flex items-center gap-2 py-2"
                onClick={() => onFocusPole(pole)}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{
                    backgroundColor: (POLE_STATUS[pole.status] || POLE_STATUS.unknown).color,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{pole.code}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {pole.group}
                    {distance !== null ? ` · ห่าง ${formatDistance(distance)}` : ""}
                  </p>
                </div>
                <a
                  className="btn btn-xs btn-outline btn-info shrink-0"
                  href={googleMapsDirectionsUrl(pole.lat, pole.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  🧭 นำทาง
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && results.items.length === 0 && (
        <p
          className="text-xs"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 1200,
            background: "#fff",
            border: `1px solid ${SL.line}`,
            borderRadius: 12,
            padding: "8px 12px",
            color: SL.muted,
            boxShadow: "0 22px 44px -22px rgba(33,27,46,.45)",
          }}
        >
          ไม่พบเสาที่ตรงกับคำค้น
        </p>
      )}
    </div>
  );
}
