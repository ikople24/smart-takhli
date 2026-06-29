import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useMemo } from "react";

// center จาก geometry (เฉลี่ยพิกัด) — รองรับ 2D/3D โดยอ่านคู่ lng,lat
function centerOf(geom) {
  try {
    const nums = JSON.stringify(geom.coordinates).match(/-?\d+(\.\d+)?/g).map(Number);
    const lng = [], lat = [];
    // โครง parcel เป็น [lng,lat] (2D) — เดินทีละ 2
    for (let i = 0; i + 1 < nums.length; i += 2) { lng.push(nums[i]); lat.push(nums[i + 1]); }
    return [lat.reduce((a, b) => a + b, 0) / lat.length, lng.reduce((a, b) => a + b, 0) / lng.length];
  } catch { return [15.26, 100.34]; }
}

export default function ReconcileMap({ m10Geometry, candidates, nearby, selectedId, onSelect }) {
  const center = useMemo(() => {
    if (m10Geometry) return centerOf(m10Geometry);
    const g = candidates?.find((c) => c.geometry)?.geometry;
    return g ? centerOf(g) : [15.26, 100.34];
  }, [m10Geometry, candidates]);

  return (
    <MapContainer center={center} zoom={17} style={{ height: 420, width: "100%" }} scrollWheelZoom>
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {nearby?.map((n, i) => n.geometry && (
        <GeoJSON key={`n${i}`} data={n.geometry} style={{ color: "#9ca3af", weight: 1, fillOpacity: 0.05 }} />
      ))}
      {candidates?.map((c) => c.geometry && (
        <GeoJSON
          key={`${c.basemapId}-${selectedId === c.basemapId ? "s" : "u"}`}
          data={c.geometry}
          style={{
            color: selectedId === c.basemapId ? "#16a34a" : "#2563eb",
            weight: 2,
            fillOpacity: selectedId === c.basemapId ? 0.35 : 0.1,
          }}
          eventHandlers={{ click: () => onSelect(c.basemapId) }}
        />
      ))}
      {m10Geometry && (
        <GeoJSON data={m10Geometry} style={{ color: "#dc2626", weight: 3, dashArray: "6", fill: false }} />
      )}
    </MapContainer>
  );
}
