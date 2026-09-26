// components/flood-relief/admin/ZoneGeoman.tsx — client only (อยู่ใต้ AdminMap ที่ import แบบ ssr:false)
// ต่อ Geoman เข้ากับ react-leaflet ตาม pattern components/m10/basemap/BasemapGeoman.jsx:
// สร้าง native layer เองแล้วค่อย pm.enable (Geoman เกาะ layer ที่ map เป็นเจ้าของ ไม่ใช่ <Polygon> ของ react-leaflet)
import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { circleToPolygon } from "@/lib/flood-relief/geo";
import { ZONE_META, type ZoneLevel } from "@/lib/flood-relief/zones";

type Polygon = { type: "Polygon"; coordinates: number[][][] };

function styleOf(level: ZoneLevel): L.PathOptions {
  const m = ZONE_META[level];
  return { color: m.stroke, weight: 3, fillColor: m.fill, fillOpacity: Math.max(0.3, m.fillOpacity) };
}

/**
 * วาดโซนใหม่ — polygon: คลิกวางมุมทีละจุด ดับเบิลคลิกปิดรูป · circle: กดจุดศูนย์กลางแล้วลากรัศมี
 * วงกลมแปลงเป็น polygon 32 มุมก่อนส่ง (MongoDB $geoIntersects ไม่รู้จักวงกลม)
 */
export function DrawZone({
  shape,
  level,
  onCreated,
}: {
  shape: "polygon" | "circle";
  level: ZoneLevel;
  onCreated: (geometry: Polygon) => void;
}) {
  const map = useMap();
  useEffect(() => {
    const path = styleOf(level);
    map.pm.setGlobalOptions({
      allowSelfIntersection: false,
      snappable: true,
      snapDistance: 15,
      templineStyle: { color: path.color, weight: 3 },
      hintlineStyle: { color: path.color, dashArray: "5,5", weight: 2 },
      pathOptions: path,
    });
    map.pm.enableDraw(shape === "circle" ? "Circle" : "Polygon", { finishOn: "dblclick" } as L.PM.DrawModeOptions);
    const handle = (e: { layer: L.Layer }) => {
      const layer = e.layer;
      let geometry: Polygon | null = null;
      if (layer instanceof L.Circle) {
        const c = layer.getLatLng();
        geometry = circleToPolygon({ lat: c.lat, lng: c.lng }, layer.getRadius(), 32);
      } else {
        const g = (layer as L.Polygon).toGeoJSON().geometry;
        if (g.type === "Polygon") geometry = g as Polygon;
      }
      map.removeLayer(layer);
      map.pm.disableDraw();
      if (geometry) onCreated(geometry);
    };
    map.on("pm:create", handle as L.LeafletEventHandlerFn);
    return () => {
      map.pm.disableDraw();
      map.off("pm:create", handle as L.LeafletEventHandlerFn);
    };
  }, [map, shape, level, onCreated]);
  return null;
}

/** แก้จุดมุมของโซนเดียว — collectRef.current() คืน geometry ปัจจุบันตอนกดบันทึก */
export function EditZone({
  geometry,
  level,
  collectRef,
}: {
  geometry: Polygon;
  level: ZoneLevel;
  collectRef: MutableRefObject<(() => Polygon | null) | null>;
}) {
  const map = useMap();
  const fgRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    const fg = L.featureGroup().addTo(map);
    fgRef.current = fg;
    L.geoJSON(geometry as GeoJSON.Polygon, { style: () => styleOf(level) }).eachLayer((l) => fg.addLayer(l));
    fg.eachLayer((l) => (l as L.Polygon).pm?.enable({ allowSelfIntersection: false }));
    return () => {
      fg.eachLayer((l) => (l as L.Polygon).pm?.disable());
      map.removeLayer(fg);
      fgRef.current = null;
    };
  }, [map, geometry, level]);

  const collect = useCallback((): Polygon | null => {
    let out: Polygon | null = null;
    fgRef.current?.eachLayer((l) => {
      const g = (l as L.Polygon).toGeoJSON().geometry;
      if (g.type === "Polygon") out = g as Polygon;
    });
    return out;
  }, []);

  useEffect(() => {
    collectRef.current = collect;
    return () => {
      collectRef.current = null;
    };
  }, [collect, collectRef]);
  return null;
}
