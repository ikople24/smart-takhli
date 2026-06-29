import { MapContainer, TileLayer, GeoJSON, Polygon, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useMemo, useState, useEffect } from "react";

// จุด vertex แบบลากได้ (divIcon เลี่ยงปัญหารูป marker เริ่มต้นของ leaflet)
const vertexIcon = L.divIcon({
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  html: '<div style="width:12px;height:12px;background:#fff;border:2px solid #dc2626;border-radius:50%;box-shadow:0 0 2px rgba(0,0,0,.5)"></div>',
});

// center จาก geometry (เฉลี่ยพิกัด) — อ่านคู่ lng,lat
function centerOf(geom) {
  try {
    const nums = JSON.stringify(geom.coordinates).match(/-?\d+(\.\d+)?/g).map(Number);
    const lng = [], lat = [];
    for (let i = 0; i + 1 < nums.length; i += 2) { lng.push(nums[i]); lat.push(nums[i + 1]); }
    return [lat.reduce((a, b) => a + b, 0) / lat.length, lng.reduce((a, b) => a + b, 0) / lng.length];
  } catch { return [15.26, 100.34]; }
}

// GeoJSON Polygon/MultiPolygon → วงนอก [lng,lat][] (ตัดจุดปิดท้ายที่ซ้ำจุดแรก)
function ringFromGeometry(geom) {
  if (!geom) return [];
  const coords = geom.type === "MultiPolygon" ? geom.coordinates?.[0]?.[0] : geom.coordinates?.[0];
  if (!Array.isArray(coords)) return [];
  const r = coords.map((c) => [c[0], c[1]]);
  if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
  return r;
}
// [lng,lat][] → GeoJSON Polygon (ปิดวง) ; < 3 จุด = ยังไม่สมบูรณ์
function geometryFromRing(ring) {
  if (ring.length < 3) return null;
  return { type: "Polygon", coordinates: [[...ring, ring[0]].map(([lng, lat]) => [lng, lat])] };
}

function ClickToAdd({ editing, onAdd }) {
  useMapEvents({ click(e) { if (editing) onAdd([e.latlng.lng, e.latlng.lat]); } });
  return null;
}

export default function ReconcileMap({ m10Geometry, candidates, nearby, selectedId, onSelect, editing, onGeometryChange }) {
  const center = useMemo(() => {
    if (m10Geometry) return centerOf(m10Geometry);
    const g = candidates?.find((c) => c.geometry)?.geometry;
    return g ? centerOf(g) : [15.26, 100.34];
  }, [m10Geometry, candidates]);

  // ring ที่กำลังแก้ (state ภายใน) — init เมื่อเข้าโหมดแก้
  const [ring, setRing] = useState([]);
  useEffect(() => { if (editing) setRing(ringFromGeometry(m10Geometry)); }, [editing, m10Geometry]);

  function commit(next) { setRing(next); onGeometryChange(geometryFromRing(next)); }
  const moveVertex = (i, latlng) => commit(ring.map((p, j) => (j === i ? [latlng.lng, latlng.lat] : p)));
  const addVertex = (lnglat) => commit([...ring, lnglat]);
  const removeVertex = (i) => { if (ring.length > 3) commit(ring.filter((_, j) => j !== i)); };

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
          style={{ color: selectedId === c.basemapId ? "#16a34a" : "#2563eb", weight: 2, fillOpacity: selectedId === c.basemapId ? 0.35 : 0.1 }}
          eventHandlers={{ click: () => onSelect(c.basemapId) }}
        />
      ))}

      {/* แสดงผล m10: ไม่แก้ = GeoJSON เส้นประ · แก้ = Polygon สด + จุดลากได้ */}
      {!editing && m10Geometry && (
        <GeoJSON data={m10Geometry} style={{ color: "#dc2626", weight: 3, dashArray: "6", fill: false }} />
      )}
      {editing && ring.length >= 3 && (
        <Polygon positions={ring.map(([lng, lat]) => [lat, lng])} pathOptions={{ color: "#dc2626", weight: 3 }} />
      )}
      {editing && ring.map(([lng, lat], i) => (
        <Marker
          key={i}
          position={[lat, lng]}
          draggable
          icon={vertexIcon}
          eventHandlers={{
            drag: (e) => moveVertex(i, e.latlng),
            dragend: (e) => moveVertex(i, e.latlng),
            contextmenu: () => removeVertex(i),
          }}
        />
      ))}
      <ClickToAdd editing={editing} onAdd={addVertex} />
    </MapContainer>
  );
}
