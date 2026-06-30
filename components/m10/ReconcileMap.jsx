import { MapContainer, TileLayer, GeoJSON, Polygon, Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";
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

// ดึงพิกัดทั้งหมดจาก geometry → [lat,lng][] (อ่านเลขเป็นคู่ lng,lat)
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

// GeoJSON Polygon/MultiPolygon → วงนอก [lng,lat][] (ตัดจุดปิดท้ายที่ซ้ำจุดแรก)
function ringFromGeometry(geom) {
  if (!geom) return [];
  const coords = geom.type === "MultiPolygon" ? geom.coordinates?.[0]?.[0] : geom.coordinates?.[0];
  if (!Array.isArray(coords)) return [];
  const r = coords.map((c) => [c[0], c[1]]);
  if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
  return r;
}
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

  // geometry ที่ใช้ fit = m10 + candidate ทั้งหมด
  const fitGeoms = useMemo(
    () => [m10Geometry, ...(candidates || []).map((c) => c.geometry)].filter(Boolean),
    [m10Geometry, candidates]
  );

  const [ring, setRing] = useState([]);
  useEffect(() => { if (editing) setRing(ringFromGeometry(m10Geometry)); }, [editing, m10Geometry]);

  function commit(next) { setRing(next); onGeometryChange(geometryFromRing(next)); }
  const moveVertex = (i, latlng) => commit(ring.map((p, j) => (j === i ? [latlng.lng, latlng.lat] : p)));
  const addVertex = (lnglat) => commit([...ring, lnglat]);
  const removeVertex = (i) => { if (ring.length > 3) commit(ring.filter((_, j) => j !== i)); };

  return (
    <MapContainer center={center} zoom={19} maxZoom={21} style={{ height: 420, width: "100%" }} scrollWheelZoom>
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxNativeZoom={19} maxZoom={21} />
      {!editing && <FitBounds geoms={fitGeoms} />}
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

      {/* m10: ไม่แก้ = เส้นแดงทึบ · แก้ = Polygon สด + จุดลากได้ */}
      {!editing && m10Geometry && (
        <GeoJSON data={m10Geometry} style={{ color: "#dc2626", weight: 3, fill: false }} />
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
