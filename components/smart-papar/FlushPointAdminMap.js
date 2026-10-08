// แผนที่หน้าจัดการทะเบียนหัวโบล์ — มี leaflet ข้างใน ต้อง import ผ่าน dynamic(..., { ssr: false }) เท่านั้น
// โหมดปกติ: คลิกหมุดเพื่อเลือกหัว · โหมดย้าย (moving): ลากหมุดหรือคลิกพื้นแผนที่เพื่อวางตำแหน่งใหม่
// ตำแหน่งเดิมแสดงเป็นวงประ + เส้นประไปยังตำแหน่งใหม่ — กันวางผิดตัวโดยไม่รู้ตัว
import { useEffect, useMemo } from "react";
import { MapContainer, CircleMarker, Marker, Polyline, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { BaseLayersControl } from "@/components/MapBaseTileLayers";
import { FLUSH_POINT_KIND_COLORS } from "@/lib/smart-papar/flushPoints";

const TAKHLI_CENTER = [15.2605, 100.3555];

const latLngOf = (p) => [p.location.coordinates[1], p.location.coordinates[0]];

function dragIcon(color) {
  return L.divIcon({
    className: "",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div style="width:44px;height:44px;border-radius:999px;background:rgba(14,110,134,.22);display:grid;place-items:center;cursor:grab">
      <div style="width:22px;height:22px;border-radius:999px;background:${color};border:4px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div></div>`,
  });
}

// เลือกหัวใหม่ → เลื่อนกล้องไปหา (เฉพาะตอนเปลี่ยน id ไม่ใช่ทุก render)
function FocusSelected({ target, focusKey }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.setView(target, Math.max(map.getZoom(), 18), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focusKey]);
  return null;
}

// เปิดหน้าครั้งแรก → ซูมให้เห็นทุกหัว
function FitAll({ points }) {
  const map = useMap();
  const has = points.length > 0;
  useEffect(() => {
    if (!has) return;
    map.fitBounds(L.latLngBounds(points.map(latLngOf)), { padding: [20, 20] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, has]);
  return null;
}

function ClickToPlace({ enabled, onPlace }) {
  useMapEvents({
    click(e) {
      if (enabled) onPlace(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function FlushPointAdminMap({
  points,
  selectedId,
  onSelect,
  moving = false,
  draftLatLng = null, // [lat, lng] ของ draft (ตำแหน่งใหม่) หรือ null
  originalLatLng = null, // [lat, lng] ก่อนแก้ หรือ null (หัวใหม่)
  draftKind = "unknown",
  onMove,
  className = "",
}) {
  const icon = useMemo(() => dragIcon(FLUSH_POINT_KIND_COLORS[draftKind] || FLUSH_POINT_KIND_COLORS.unknown), [draftKind]);
  const withCoords = useMemo(() => points.filter((p) => Array.isArray(p.location?.coordinates)), [points]);
  const moved =
    draftLatLng &&
    originalLatLng &&
    (draftLatLng[0] !== originalLatLng[0] || draftLatLng[1] !== originalLatLng[1]);

  return (
    <MapContainer center={TAKHLI_CENTER} zoom={15} maxZoom={21} className={className} scrollWheelZoom>
      <BaseLayersControl />
      <FitAll points={withCoords} />
      <FocusSelected target={draftLatLng || originalLatLng} focusKey={selectedId || "none"} />
      <ClickToPlace enabled={moving} onPlace={onMove} />

      {withCoords.map((p) => {
        const id = String(p._id);
        if (id === selectedId) return null; // หัวที่เลือกวาดแยกด้านล่าง
        const color = FLUSH_POINT_KIND_COLORS[p.kind] || FLUSH_POINT_KIND_COLORS.unknown;
        return (
          <CircleMarker
            key={id}
            center={latLngOf(p)}
            radius={6}
            bubblingMouseEvents={false}
            eventHandlers={{ click: () => !moving && onSelect(id) }}
            pathOptions={{
              color: p.active === false ? "#94a3b8" : "#ffffff",
              weight: 2,
              fillColor: p.kind === "unknown" ? "#ffffff" : color,
              fillOpacity: p.active === false ? 0.35 : 1,
              dashArray: p.active === false ? "3 3" : undefined,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              {p.code}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {originalLatLng && (moving || moved) && (
        <CircleMarker
          center={originalLatLng}
          radius={11}
          interactive={false}
          pathOptions={{ color: "#0B2233", weight: 2, dashArray: "4 4", fill: false }}
        />
      )}
      {moved && (
        <Polyline
          positions={[originalLatLng, draftLatLng]}
          interactive={false}
          pathOptions={{ color: "#0B2233", weight: 2, dashArray: "6 6" }}
        />
      )}
      {draftLatLng && (
        <Marker
          position={draftLatLng}
          icon={icon}
          draggable={moving}
          eventHandlers={{
            dragend: (e) => {
              const ll = e.target.getLatLng();
              onMove(ll.lat, ll.lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
}
