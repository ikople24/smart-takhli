import { useEffect, useRef, useCallback } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

// แก้ vertex แปลงเดียว: สร้าง native layer + addTo(map) เองแล้วค่อย pm.enable
// (geoman เกาะ native layer ที่ map เป็นเจ้าของ → handle ขึ้น; ต่างจากการใส่บน <Polygon> ของ react-leaflet)
export function EditFeature({ feature, onCollect }) {
  const map = useMap();
  const fgRef = useRef(null);

  useEffect(() => {
    if (!map || !feature) return;
    const fg = L.featureGroup().addTo(map);
    fgRef.current = fg;
    const geoLayer = L.geoJSON(feature, {
      style: () => ({ color: "#f59e0b", weight: 3, fillColor: "#fef3c7", fillOpacity: 0.35 }),
    });
    geoLayer.eachLayer((l) => fg.addLayer(l));
    fg.eachLayer((l) => { if (l.pm) l.pm.enable({ allowSelfIntersection: false }); });
    map.pm.setGlobalOptions({ allowSelfIntersection: false, snappable: true, snapDistance: 15 });
    try {
      const b = fg.getBounds();
      if (b.isValid()) map.fitBounds(b, { padding: [60, 60], maxZoom: 20 });
    } catch { /* noop */ }
    return () => {
      fg.eachLayer((l) => { if (l.pm) l.pm.disable(); });
      map.removeLayer(fg);
      fgRef.current = null;
    };
  }, [map, feature]);

  const collect = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return null;
    let geom = null;
    fg.eachLayer((l) => { geom = l.toGeoJSON()?.geometry ?? null; });
    return geom;
  }, []);

  useEffect(() => { if (onCollect) onCollect.current = collect; }, [collect, onCollect]);
  return null;
}

// วาดแปลงใหม่ → onCreated(geometry)
export function DrawNew({ onCreated }) {
  const map = useMap();
  const createdRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    map.pm.setGlobalOptions({
      allowSelfIntersection: false, snappable: true, snapDistance: 15,
      templineStyle: { color: "#16a34a", weight: 3 },
      hintlineStyle: { color: "#16a34a", dashArray: "5,5", weight: 2 },
      pathOptions: { color: "#16a34a", weight: 3, fillColor: "#bbf7d0", fillOpacity: 0.35 },
    });
    map.pm.enableDraw("Polygon", { finishOn: "dblclick" });
    const handle = (e) => {
      createdRef.current = e.layer;
      const geo = e.layer.toGeoJSON();
      map.pm.disableDraw();
      onCreated(geo.geometry);
    };
    map.on("pm:create", handle);
    return () => {
      map.pm.disableDraw();
      map.off("pm:create", handle);
      if (createdRef.current) { try { map.removeLayer(createdRef.current); } catch { /* noop */ } createdRef.current = null; }
    };
  }, [map, onCreated]);
  return null;
}
