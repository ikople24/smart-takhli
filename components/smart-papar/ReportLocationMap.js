// แผนที่ปักหมุดบ้านในฟอร์มแจ้งน้ำ (/papar/report) — มี leaflet ข้างใน ต้อง import ผ่าน dynamic(..., { ssr: false })
// ลากหมุด หรือแตะแผนที่เพื่อย้ายหมุด · ยังไม่มีพิกัด = แสดงกลางเมืองตาคลีและรอให้แตะ
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { BaseTileLayers } from "@/components/MapBaseTileLayers";

const TAKHLI_CENTER = [15.253914, 100.351077];

function pinIcon() {
  return L.divIcon({
    className: "",
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    html: `<svg width="34" height="44" viewBox="0 0 24 32"><path d="M12 31s-10-9-10-18a10 10 0 0 1 20 0c0 9-10 18-10 18z" fill="#7C3AED" stroke="#fff" stroke-width="2"/><circle cx="12" cy="13" r="4" fill="#fff"/></svg>`,
  });
}

function Follow({ point }) {
  const map = useMap();
  const key = point ? `${point[0].toFixed(5)},${point[1].toFixed(5)}` : "none";
  useEffect(() => {
    if (point) map.setView(point, Math.max(map.getZoom(), 17), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

function TapToPlace({ onChange }) {
  useMapEvents({ click: (e) => onChange(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function ReportLocationMap({ point, onChange, className = "" }) {
  const icon = useMemo(() => pinIcon(), []);
  return (
    <MapContainer center={point || TAKHLI_CENTER} zoom={point ? 17 : 14} maxZoom={19} className={className} scrollWheelZoom={false}>
      <BaseTileLayers baseLayer="street" />
      <Follow point={point} />
      <TapToPlace onChange={onChange} />
      {point && (
        <Marker
          position={point}
          icon={icon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = e.target.getLatLng();
              onChange(ll.lat, ll.lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
}
