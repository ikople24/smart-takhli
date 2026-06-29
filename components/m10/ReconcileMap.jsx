import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { useMemo, useEffect, useRef } from "react";
import L from "leaflet";

// center จาก geometry (เฉลี่ยพิกัด) — รองรับ 2D/3D โดยอ่านคู่ lng,lat
function centerOf(geom) {
  try {
    const nums = JSON.stringify(geom.coordinates).match(/-?\d+(\.\d+)?/g).map(Number);
    const lng = [], lat = [];
    for (let i = 0; i + 1 < nums.length; i += 2) { lng.push(nums[i]); lat.push(nums[i + 1]); }
    return [lat.reduce((a, b) => a + b, 0) / lat.length, lng.reduce((a, b) => a + b, 0) / lng.length];
  } catch { return [15.26, 100.34]; }
}

// แก้/วาด vertex ด้วย geoman (ผูกกับ L.map ตรง ๆ ผ่าน useMap)
function GeomanEditor({ editing, m10Geometry, onGeometryChange }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await import("@geoman-io/leaflet-geoman-free");
      if (cancelled || !map.pm) return;
      // เคลียร์ layer/โหมดเดิม
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
      map.pm.disableGlobalEditMode?.();
      map.pm.disableDraw?.();
      if (!editing) return;

      const emit = (layer) => { if (layer?.toGeoJSON) onGeometryChange(layer.toGeoJSON().geometry); };
      if (m10Geometry) {
        const group = L.geoJSON(m10Geometry, { style: { color: "#dc2626", weight: 3 } }).addTo(map);
        const layer = group.getLayers()[0];
        layerRef.current = layer;
        layer.pm.enable({ allowSelfIntersection: false });
        layer.on("pm:edit", (e) => emit(e.layer || layer));
        layer.on("pm:markerdragend", () => emit(layer));
        try { map.fitBounds(layer.getBounds(), { maxZoom: 18 }); } catch { /* noop */ }
      } else {
        map.pm.enableDraw("Polygon", { allowSelfIntersection: false });
        map.on("pm:create", (e) => { layerRef.current = e.layer; emit(e.layer); map.pm.disableDraw(); });
      }
    })();
    return () => {
      cancelled = true;
      if (map.pm) { map.pm.disableGlobalEditMode?.(); map.pm.disableDraw?.(); }
      map.off("pm:create");
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    };
  }, [editing, m10Geometry, map, onGeometryChange]);

  return null;
}

export default function ReconcileMap({ m10Geometry, candidates, nearby, selectedId, onSelect, editing, onGeometryChange }) {
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
      {/* ตอน editing ใช้ layer ของ geoman แทน กันซ้อน 2 รูป */}
      {!editing && m10Geometry && (
        <GeoJSON data={m10Geometry} style={{ color: "#dc2626", weight: 3, dashArray: "6", fill: false }} />
      )}
      <GeomanEditor editing={editing} m10Geometry={m10Geometry} onGeometryChange={onGeometryChange} />
    </MapContainer>
  );
}
