// แผนที่เสาไฟ — เรนเดอร์ 2 ระดับตามซูม: ไกล = bubble รายกลุ่ม, ใกล้ = หมุดรายต้นเฉพาะในกรอบจอ
// ต้อง import ผ่าน dynamic(..., { ssr: false }) เท่านั้น
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  CircleMarker,
  Marker,
  GeoJSON,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  POLE_STATUS,
  POLE_ZOOM_THRESHOLD,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
} from "@/lib/smart-light/constants";
import { BaseTileLayers } from "./MapLayers";

// ป้องกัน marker icon หายในบางระบบ (pattern เดียวกับ MapPoints ของ smart-school)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

// ติดตาม zoom + bounds ปัจจุบัน ส่งขึ้นไปให้ตัดสินใจว่าจะวาดระดับไหน
function ViewTracker({ onChange }) {
  const map = useMapEvents({
    moveend: () => onChange({ zoom: map.getZoom(), bounds: map.getBounds() }),
  });
  useEffect(() => {
    onChange({ zoom: map.getZoom(), bounds: map.getBounds() });
  }, [map, onChange]);
  return null;
}

// fly ไปตำแหน่งเมื่อ focusTarget เปลี่ยน (key กันการ fly ซ้ำ)
function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom || 17);
  }, [map, target]);
  return null;
}

// จับคลิกแผนที่ตอนโหมดเพิ่มเสา
function AddModeClick({ active, onPick }) {
  useMapEvents({
    click: (e) => {
      if (active) onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// HTML popup ชื่อชุมชน (escape กัน injection — ชื่อมาจากข้อมูล GeoJSON)
function communityPopupHtml(name) {
  const safe = String(name).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
  return `<div style="font:700 13px 'Anuphan',sans-serif;color:#211B2E;">🏘️ ${safe}</div>`;
}

function groupBubbleIcon(total) {
  const size = Math.max(36, Math.min(64, 26 + Math.sqrt(total) * 3));
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:rgba(37,99,235,.85);border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.3);">${total}</div>`,
    className: "smart-light-bubble",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function SmartLightMap({
  poles,
  boundaries,
  groups,
  focusTarget,
  selectedPoleId,
  addMode,
  pickedLatLng,
  onPickLocation,
  onSelectPole,
  baseLayer = "street",
}) {
  const [view, setView] = useState(null);

  const showPoles = view && view.zoom >= POLE_ZOOM_THRESHOLD;

  // ซูมใกล้: วาดเฉพาะเสาในกรอบจอ + ขอบเผื่อ 20% — จอหนึ่งเห็นจริงไม่กี่ร้อยต้น
  const visiblePoles = useMemo(() => {
    if (!showPoles) return [];
    const padded = view.bounds.pad(0.2);
    return poles.filter((p) => padded.contains([p.lat, p.lng]));
  }, [poles, view, showPoles]);

  // ขอบเขตชุมชนเป็นพื้นหลัง — วาดใต้หมุด ไม่รับ event (คลิกทะลุไปหมุด/แผนที่ได้)
  const boundaryCollection = useMemo(() => {
    if (!boundaries || boundaries.length === 0) return null;
    return {
      type: "FeatureCollection",
      features: boundaries.map((b) => ({
        type: "Feature",
        geometry: b.geometry,
        properties: { name: b.name, color: b.color || "#3B82F6" },
      })),
    };
  }, [boundaries]);

  return (
    <MapContainer
      center={DEFAULT_MAP_CENTER}
      zoom={DEFAULT_MAP_ZOOM}
      preferCanvas
      zoomControl={false}
      style={{ height: "100%", width: "100%", zIndex: 0 }}
    >
      <BaseTileLayers baseLayer={baseLayer} />
      {/* ขอบเขตชุมชน (จัดการที่ /admin/settings/geojson-map) — key remount เมื่อข้อมูลมา เพราะ GeoJSON layer ตั้ง data ตอนสร้างเท่านั้น */}
      {boundaryCollection && (
        <GeoJSON
          // remount เมื่อข้อมูลมา หรือสลับโหมดเพิ่มเสา (interactive เปลี่ยนตาม addMode)
          key={`boundaries-${boundaries.length}-${addMode ? "add" : "view"}`}
          data={boundaryCollection}
          // interactive เฉพาะตอนไม่ได้เพิ่มเสา — โหมดเพิ่มเสาให้คลิกทะลุไปวางหมุดบนแผนที่
          interactive={!addMode}
          onEachFeature={(feature, layer) => {
            const name = feature?.properties?.name;
            // แตะ/คลิกในเขตชุมชน → popup ชื่อชุมชนนั้น
            if (name)
              layer.bindPopup(communityPopupHtml(name), {
                closeButton: false,
                className: "sl-community-popup",
              });
          }}
          eventHandlers={{
            // กัน race กับหมุดบน canvas เดียวกัน — เข้ามาเมื่อไหร่ก็ถอยไปอยู่ล่างสุดเสมอ
            add: (e) => e.target.bringToBack(),
          }}
          style={(feature) => ({
            color: feature?.properties?.color || "#3B82F6",
            weight: 2,
            opacity: 0.55,
            fillColor: feature?.properties?.color || "#3B82F6",
            fillOpacity: 0.08,
          })}
        />
      )}
      <ViewTracker onChange={setView} />
      <FlyTo target={focusTarget} />
      <AddModeClick active={addMode} onPick={onPickLocation} />

      {/* ซูมไกล: bubble รายกลุ่ม แตะแล้วซูมเข้า */}
      {!showPoles &&
        groups.map((g) => (
          <GroupBubble key={g.group} group={g} />
        ))}

      {/* ซูมใกล้: หมุดรายต้น สีตามสถานะ */}
      {showPoles &&
        visiblePoles.map((p) => (
          <CircleMarker
            key={p._id}
            center={[p.lat, p.lng]}
            radius={p._id === selectedPoleId ? 11 : 7}
            pathOptions={{
              color: "#ffffff",
              weight: p._id === selectedPoleId ? 4 : 2,
              fillColor: (POLE_STATUS[p.status] || POLE_STATUS.unknown).color,
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => !addMode && onSelectPole(p) }}
          />
        ))}

      {/* หมุดร่างตอนเพิ่มเสา — ลากปรับตำแหน่งได้ */}
      {addMode && pickedLatLng && (
        <Marker
          position={[pickedLatLng.lat, pickedLatLng.lng]}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = e.target.getLatLng();
              onPickLocation({ lat: ll.lat, lng: ll.lng });
            },
          }}
        />
      )}
    </MapContainer>
  );
}

// bubble รายกลุ่ม (แยก component เพื่อใช้ useMap สำหรับซูมเข้า)
function GroupBubble({ group }) {
  const map = useMap();
  if (!group.centroid || !Number.isFinite(group.centroid.lat)) return null;
  return (
    <Marker
      position={[group.centroid.lat, group.centroid.lng]}
      icon={groupBubbleIcon(group.total)}
      eventHandlers={{
        click: () => map.flyTo([group.centroid.lat, group.centroid.lng], POLE_ZOOM_THRESHOLD),
      }}
    />
  );
}
