// แผนที่ข้างรายการ "งานที่ต้องจัดการ" (แท็บรายงาน) — มี leaflet ข้างใน ต้อง import ผ่าน dynamic(..., { ssr: false })
// จุดในกลุ่มที่เลือก = สีของกลุ่ม · หัวอื่น = จุดเทาเล็ก · focusId = หัวที่กด "ดูบนแผนที่" (ซูมไปหา + วงรอบ)
import { useEffect, useMemo } from "react";
import { MapContainer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { BaseLayersControl } from "@/components/MapBaseTileLayers";

const TAKHLI_CENTER = [15.2605, 100.3555];
const ll = (c) => [c[1], c[0]];

function Fit({ group, focus }) {
  const map = useMap();
  const key = group.map((i) => i.pointId).join("|");
  useEffect(() => {
    if (focus) return;
    const pts = group.filter((i) => i.coordinates).map((i) => ll(i.coordinates));
    if (pts.length === 1) map.setView(pts[0], 17);
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 17 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  useEffect(() => {
    if (focus?.coordinates) map.setView(ll(focus.coordinates), 18, { animate: true });
  }, [map, focus]);
  return null;
}

export default function FlushingWorkMap({ items, group, color, focusId, onSelect, className = "" }) {
  const groupIds = useMemo(() => new Set(group.map((i) => String(i.pointId))), [group]);
  const focus = group.find((i) => String(i.pointId) === String(focusId)) || null;
  return (
    <MapContainer center={TAKHLI_CENTER} zoom={14} maxZoom={21} className={className} scrollWheelZoom={false}>
      <BaseLayersControl />
      <Fit group={group} focus={focus} />
      {items
        .filter((i) => i.coordinates && !groupIds.has(String(i.pointId)))
        .map((i) => (
          <CircleMarker
            key={i.pointId}
            center={ll(i.coordinates)}
            radius={3.5}
            interactive={false}
            pathOptions={{ color: "#94A3B8", weight: 1, fillColor: "#C9D6DE", fillOpacity: 0.9 }}
          />
        ))}
      {group
        .filter((i) => i.coordinates)
        .map((i) => {
          const on = String(i.pointId) === String(focusId);
          return (
            <CircleMarker
              key={i.pointId}
              center={ll(i.coordinates)}
              radius={on ? 11 : 8}
              bubblingMouseEvents={false}
              eventHandlers={{ click: () => onSelect?.(i.pointId) }}
              pathOptions={{ color: on ? "#0B2233" : "#FFFFFF", weight: on ? 3 : 2.5, fillColor: color, fillOpacity: 1 }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                {i.code} {i.name || i.roadName || ""}
              </Tooltip>
            </CircleMarker>
          );
        })}
    </MapContainer>
  );
}
