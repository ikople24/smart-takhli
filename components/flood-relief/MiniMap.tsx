// components/flood-relief/MiniMap.tsx — client only (import ผ่าน next/dynamic ssr:false)
// แผนที่ย่อในฟอร์ม: หมุดน้ำเงิน (divIcon ไม่ต้องใช้ไฟล์รูป) + วงรัศมีความแม่นยำ GPS · พื้นแผนที่ถนน/ดาวเทียม (BaseTiles)
// ลากหมุด หรือแตะแผนที่ = ย้ายพิกัด (ใช้ทั้ง "ขยับหมุด" และ "ปักหมุดเอง" ตอนไม่ได้ GPS)
import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/flood-relief/geo";
import { FINE_ZOOM, type BaseMap } from "./BaseMapToggle";
import BaseTiles from "./BaseTiles";

const PIN = L.divIcon({
  className: "",
  html: '<span style="display:block;width:22px;height:22px;border-radius:999px;background:#1D4299;border:3px solid #fff;box-shadow:0 2px 6px rgba(8,24,70,.4)"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function Recenter({ point }: { point: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.panTo([point.lat, point.lng], { animate: true });
  }, [map, point.lat, point.lng]);
  return null;
}

function TapToMove({ onMove }: { onMove: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onMove({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** ความสูงแผนที่เปลี่ยนได้ (ย่อ/ขยาย) — Leaflet ต้องรู้ขนาดใหม่ ไม่งั้น tile ขาดเป็นช่อง */
function InvalidateOnResize({ height }: { height: number }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [map, height]);
  return null;
}

export default function MiniMap({
  point,
  accuracyM,
  height,
  onMove,
  baseMap,
}: {
  point: LatLng;
  accuracyM: number | null;
  height: number;
  onMove: (p: LatLng) => void;
  baseMap: BaseMap;
}) {
  const handlers = useMemo(
    () => ({
      dragend: (e: L.LeafletEvent) => {
        const ll = (e.target as L.Marker).getLatLng();
        onMove({ lat: ll.lat, lng: ll.lng });
      },
    }),
    [onMove]
  );

  return (
    <MapContainer
      center={[point.lat, point.lng]}
      zoom={17}
      zoomControl={false}
      attributionControl={false}
      {...FINE_ZOOM}
      style={{ height, width: "100%" }}
    >
      <BaseTiles baseMap={baseMap} />
      {accuracyM != null && accuracyM > 0 && (
        <Circle
          center={[point.lat, point.lng]}
          radius={accuracyM}
          pathOptions={{ color: "#fff", weight: 1.5, fillColor: "#4C8DFF", fillOpacity: 0.18 }}
        />
      )}
      <Marker position={[point.lat, point.lng]} icon={PIN} draggable eventHandlers={handlers} />
      <Recenter point={point} />
      <TapToMove onMove={onMove} />
      <InvalidateOnResize height={height} />
    </MapContainer>
  );
}
