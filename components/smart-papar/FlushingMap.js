// แผนที่จุดโบตะกอน — มี leaflet ข้างใน ต้อง import ผ่าน dynamic(..., { ssr: false }) เท่านั้น
// หมุดเขียว = ใสแล้ว, ส้ม = ยังขุ่น · popup ใช้ <Popup> แบบ React (escape ให้เอง) — ห้ามเปลี่ยนเป็น bindPopup(raw HTML)
// ชั้นขอบเขตชุมชน (geojsonfeatures ของแอปพี่น้อง อ่านอย่างเดียว) อยู่ pane ล่างสุด ใต้หมุดเสมอ
import { useEffect, useMemo, useState } from "react";
import { MapContainer, CircleMarker, GeoJSON, Pane, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { BaseLayersControl } from "@/components/MapBaseTileLayers";
import { FLUSHING_RESULT_LABELS } from "@/lib/smart-papar/flushing";

const TAKHLI_CENTER = [15.2605, 100.3555];
const COLORS = { clear: "#10b981", still_turbid: "#f97316" };
const COMMUNITY_STYLE = {
  color: "#2F80FF",
  weight: 2,
  dashArray: "6 4",
  fillColor: "#2F80FF",
  fillOpacity: 0.04,
};

// tooltip ของ leaflet รับ string เป็น HTML — ชื่อชุมชนมาจาก DB ต้อง escape
const escapeHtml = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );

function bindCommunityTooltip(feature, layer) {
  layer.bindTooltip(escapeHtml(feature.properties?.name), { sticky: true });
}

// ขยับกล้องเฉพาะตอนชุดจุดเปลี่ยนจริง (เทียบด้วย key) — ไม่ใช่ทุกครั้งที่ parent re-render
// ไม่มีจุดในช่วงที่เลือก → ซูมให้เห็นทั้งเขตเทศบาล (ขอบชุมชน) แทน
function FitBounds({ points, communities }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (points.length === 0) {
      if (communities?.features?.length) {
        map.fitBounds(L.geoJSON(communities).getBounds(), { padding: [10, 10] });
      }
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 16);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 17 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, communities]);
  return null;
}

export default function FlushingMap({ logs, onSelect }) {
  const [communities, setCommunities] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/smart-papar/communities")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.type === "FeatureCollection") setCommunities(d);
      })
      .catch(() => {}); // ชั้นเสริม — โหลดไม่ได้ก็ยังใช้แผนที่ได้ตามปกติ
    return () => {
      cancelled = true;
    };
  }, []);

  const withCoords = useMemo(
    () => logs.filter((l) => Array.isArray(l.location?.coordinates)),
    [logs]
  );
  const points = useMemo(
    () => withCoords.map((l) => [l.location.coordinates[1], l.location.coordinates[0]]),
    [withCoords]
  );

  return (
    <MapContainer center={TAKHLI_CENTER} zoom={14} className="h-[360px] w-full rounded-2xl" scrollWheelZoom={false}>
      <BaseLayersControl />
      <FitBounds points={points} communities={communities} />
      <Pane name="flushing-communities" style={{ zIndex: 350 }}>
        {communities && (
          <GeoJSON data={communities} style={COMMUNITY_STYLE} onEachFeature={bindCommunityTooltip} />
        )}
      </Pane>
      {withCoords.map((l, i) => (
        <CircleMarker
          key={l._id}
          center={points[i]}
          radius={9}
          pathOptions={{ color: "#fff", weight: 2, fillColor: COLORS[l.result] || "#64748b", fillOpacity: 0.95 }}
        >
          {/* Popup เป็น React (ไม่ใช่ raw HTML) — React escape ข้อความให้เอง */}
          <Popup>
            <div style={{ minWidth: 160 }}>
              <div style={{ fontWeight: 600 }}>{l.locationName}</div>
              <div>ผล: {FLUSHING_RESULT_LABELS[l.result] || "-"}</div>
              <button
                type="button"
                onClick={() => onSelect(l)}
                style={{ marginTop: 4, color: "#0369a1", textDecoration: "underline" }}
              >
                ดูรายละเอียด
              </button>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
