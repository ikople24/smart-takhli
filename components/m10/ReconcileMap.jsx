import { MapContainer, TileLayer, GeoJSON, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useMemo, useEffect } from "react";

// อ่านพิกัดทั้งหมดจาก geometry → [lat,lng][] (เลขเป็นคู่ lng,lat)
function latLngsOf(geom, out) {
  if (!geom) return;
  const nums = JSON.stringify(geom.coordinates).match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i + 1], nums[i]]);
}
function centerOf(geom) {
  const pts = [];
  latLngsOf(geom, pts);
  if (!pts.length) return [15.26, 100.34];
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
}

// fit แผนที่เข้ากับแปลงที่เกี่ยว (zoom เข้าใกล้พอดี)
function FitBounds({ geoms }) {
  const map = useMap();
  useEffect(() => {
    const pts = [];
    for (const g of geoms) latLngsOf(g, pts);
    if (pts.length) {
      try { map.fitBounds(L.latLngBounds(pts), { padding: [10, 10], maxZoom: 21 }); } catch { /* noop */ }
    }
  }, [geoms, map]);
  return null;
}

// แผนที่เทียบ ม.10 ↔ basemap แบบอ่านอย่างเดียว — แก้รูปแปลงทำที่หน้า "แก้รูปแปลง (basemap)"
export default function ReconcileMap({ m10Geometry, candidates, nearby, selectedId, onSelect }) {
  const center = useMemo(() => {
    if (m10Geometry) return centerOf(m10Geometry);
    const g = candidates?.find((c) => c.geometry)?.geometry;
    return g ? centerOf(g) : [15.26, 100.34];
  }, [m10Geometry, candidates]);

  // geometry ที่ใช้ fit = m10 + candidate ทั้งหมด
  const fitGeoms = useMemo(
    () => [m10Geometry, ...(candidates || []).map((c) => c.geometry)].filter(Boolean),
    [m10Geometry, candidates]
  );

  return (
    <MapContainer center={center} zoom={19} maxZoom={21} style={{ height: 420, width: "100%" }} scrollWheelZoom>
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxNativeZoom={19} maxZoom={21} />
      <FitBounds geoms={fitGeoms} />
      {nearby?.map((n, i) => n.geometry && (
        <GeoJSON key={`n${i}`} data={n.geometry} style={{ color: "#9ca3af", weight: 1, fillOpacity: 0.05 }} />
      ))}
      {candidates?.map((c) => c.geometry && (
        <GeoJSON
          key={`${c.basemapId}-${selectedId === c.basemapId ? "s" : "u"}`}
          data={c.geometry}
          style={{ color: selectedId === c.basemapId ? "#16a34a" : "#2563eb", weight: 2, fillOpacity: selectedId === c.basemapId ? 0.35 : 0.1 }}
          eventHandlers={{ click: () => onSelect(c.basemapId) }}
        >
          <Tooltip permanent direction="center" className="parcel-label">{c.parcelCode}</Tooltip>
        </GeoJSON>
      ))}
      {/* รูปแปลง ม.10 — เส้นแดงทึบ (read-only) */}
      {m10Geometry && (
        <GeoJSON data={m10Geometry} style={{ color: "#dc2626", weight: 3, fill: false }} />
      )}
    </MapContainer>
  );
}
