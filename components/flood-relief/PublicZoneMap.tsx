// components/flood-relief/PublicZoneMap.tsx — client only (import ผ่าน next/dynamic ssr:false)
// แผนที่หน้าสถานการณ์สาธารณะ /flood: โซนสีทั้งชุมชน + จุดวัดระดับน้ำ (รูปล่าสุด)
// **ไม่มีหมุดคำขอ** (ตำแหน่งบ้านผู้ขอความช่วยเหลือเป็นข้อมูลอ่อนไหว)
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polygon, Tooltip, useMap, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TAKHLI_CENTER } from "@/lib/flood-relief/geo";
import { isZoneLevel, ZONE_LEVELS, ZONE_META, type ZoneLevel } from "@/lib/flood-relief/zones";
import { FINE_ZOOM, type BaseMap } from "./BaseMapToggle";
import BaseTiles from "./BaseTiles";
import { gaugeIcon } from "./gaugeIcon";

export type PublicZone = { name: string; level: string; geometry: { type: "Polygon"; coordinates: number[][][] } };
/** ตรงกับ lib/flood-relief/gauge#publicGauge */
export type PublicGauge = {
  name: string;
  lat: number | null;
  lng: number | null;
  note: string;
  photoUrl: string | null;
  photoAt: string | null;
  levelCm: number | null;
  photoNote: string;
  stale: boolean;
};

const LABEL_BG: Record<ZoneLevel, string> = { critical: "#B92544", danger: "#9E6206", watch: "#7A6510", safe: "#14714A" };
const ring = (z: PublicZone): [number, number][] => z.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);

/** ซูมให้เห็นทุกโซนครั้งแรกที่มีข้อมูล */
function FitOnce({ zones }: { zones: PublicZone[] }) {
  const map = useMap();
  const key = zones.length;
  useEffect(() => {
    if (!zones.length) return;
    const b = L.latLngBounds(zones.flatMap(ring));
    if (b.isValid()) map.fitBounds(b, { padding: [24, 24], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ซูมแค่ตอนจำนวนโซนเปลี่ยน ไม่ใช่ทุกครั้งที่โพล
  }, [map, key]);
  return null;
}

export default function PublicZoneMap({
  zones,
  gauges,
  baseMap,
  onGauge,
}: {
  zones: PublicZone[];
  gauges: PublicGauge[];
  baseMap: BaseMap;
  onGauge: (g: PublicGauge) => void;
}) {
  const sorted = useMemo(
    () =>
      zones
        .filter((z) => isZoneLevel(z.level))
        .sort((a, b) => ZONE_LEVELS.indexOf(b.level as ZoneLevel) - ZONE_LEVELS.indexOf(a.level as ZoneLevel)),
    [zones]
  );
  return (
    <MapContainer
      className="flood-map"
      center={[TAKHLI_CENTER.lat, TAKHLI_CENTER.lng]}
      zoom={14}
      zoomControl={false}
      {...FINE_ZOOM}
      style={{ height: "100%", width: "100%" }}
    >
      <ZoomControl position="bottomright" />
      <BaseTiles baseMap={baseMap} />
      {sorted.map((z) => {
        const m = ZONE_META[z.level as ZoneLevel];
        return (
          <Polygon
            key={`${z.name}-${z.level}`}
            positions={ring(z)}
            interactive={false}
            pathOptions={{ color: m.stroke, weight: m.strokeWidth, dashArray: m.dashed ? "6 4" : undefined, fillColor: m.fill, fillOpacity: m.fillOpacity }}
          >
            <Tooltip permanent direction="center" className="flood-zone-label">
              <span style={{ background: LABEL_BG[z.level as ZoneLevel] }}>
                {z.name} · {m.label}
              </span>
            </Tooltip>
          </Polygon>
        );
      })}
      {gauges.map((g) =>
        g.lat == null || g.lng == null ? null : (
          <Marker
            key={`${g.name}-${g.photoAt}`}
            position={[g.lat, g.lng]}
            icon={gaugeIcon(g.photoUrl, g.stale, g.levelCm)}
            zIndexOffset={500}
            eventHandlers={{ click: () => onGauge(g) }}
          >
            <Tooltip direction="top" offset={[0, -22]}>
              📷 {g.name}
            </Tooltip>
          </Marker>
        )
      )}
      <FitOnce zones={sorted} />
    </MapContainer>
  );
}
