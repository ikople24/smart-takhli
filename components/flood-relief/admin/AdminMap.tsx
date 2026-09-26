// components/flood-relief/admin/AdminMap.tsx — client only (import ผ่าน next/dynamic ssr:false)
// แผนที่กลางแดชบอร์ด: หมุดคำขอ (สีตามความเร่งด่วน) · หมุดทีม · ขอบเขตชุมชน 22 (basemap อ่านอย่างเดียว)
// เลือกหมุด ↔ รายการซ้าย ↔ แผงขวา ผ่าน selectedId ใน useFloodReliefStore
// โซนสี/ศูนย์พักพิง/เครื่องมือวาดโซน (Geoman) มาในขั้น 5–6
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Marker, TileLayer, Tooltip, useMap, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FeatureCollection } from "geojson";
import { REQUEST_TYPE_META, isRequestType } from "@/lib/flood-relief/status";
import { TAKHLI_CENTER } from "@/lib/flood-relief/geo";
import { useFloodReliefStore } from "@/stores/useFloodReliefStore";
import { pinColor } from "./labels";
import type { AdminRequest, AdminTeam } from "./types";

function selectedIcon(color: string) {
  return L.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<span style="position:relative;display:block;width:24px;height:24px">
      <span class="flood-sel" style="position:absolute;inset:0;border-radius:999px;background:${color}"></span>
      <span style="position:absolute;inset:0;border-radius:999px;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></span>
    </span>`,
  });
}

const TEAM_ICON = L.divIcon({
  className: "",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  html: `<span style="display:flex;width:30px;height:30px;align-items:center;justify-content:center;border-radius:8px;background:#1D4299;border:2.5px solid #fff;color:#fff;font-size:15px;box-shadow:0 2px 6px rgba(0,0,0,.25)">🚤</span>`,
});

function FlyToSelected({ req }: { req: AdminRequest | null }) {
  const map = useMap();
  useEffect(() => {
    if (req?.lat != null && req.lng != null) map.flyTo([req.lat, req.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [map, req?.id, req?.lat, req?.lng]);
  return null;
}

export default function AdminMap({ items, teams }: { items: AdminRequest[]; teams: AdminTeam[] }) {
  const { selectedId, select, layers, toggleLayer, baseMap, setBaseMap } = useFloodReliefStore();
  const [communities, setCommunities] = useState<FeatureCollection | null>(null);
  const selected = useMemo(() => items.find((r) => r.id === selectedId) ?? null, [items, selectedId]);

  useEffect(() => {
    if (!layers.communities || communities) return;
    fetch("/api/flood-relief/communities")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setCommunities(j))
      .catch(() => {});
  }, [layers.communities, communities]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[TAKHLI_CENTER.lat, TAKHLI_CENTER.lng]}
        zoom={14}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        {/* ปุ่มซูมมุมขวาล่างตามดีไซน์ — ค่าเริ่มต้นมุมซ้ายบนทับแผงชั้นข้อมูล */}
        <ZoomControl position="bottomright" />
        {baseMap === "satellite" ? (
          <>
            {/* ภาพดาวเทียม Esri World Imagery (แหล่งเดียวกับแผนที่อื่นในระบบ) + ชั้นชื่อสถานที่ให้อ่านรู้เรื่อง */}
            <TileLayer
              key="sat"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Imagery &copy; Esri"
              maxNativeZoom={19}
              maxZoom={20}
            />
            <TileLayer
              key="sat-labels"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={19}
              maxZoom={20}
            />
          </>
        ) : (
          <TileLayer
            key="osm"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
          />
        )}
        {layers.communities && communities && (
          <GeoJSON
            data={communities}
            style={{ color: "#6B6880", weight: 1.2, dashArray: "4 3", fillOpacity: 0.03 }}
            onEachFeature={(f, layer) => layer.bindTooltip(String(f.properties?.name ?? ""), { sticky: true })}
          />
        )}
        {layers.requests &&
          items.map((r) =>
            r.lat == null || r.lng == null || r.id === selectedId ? null : (
              <CircleMarker
                key={r.id}
                center={[r.lat, r.lng]}
                radius={8}
                pathOptions={{ color: "#fff", weight: 2.5, fillColor: pinColor(r.status, r.urgency), fillOpacity: 1 }}
                eventHandlers={{ click: () => select(r.id) }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  {r.ticket} · {isRequestType(r.type) ? REQUEST_TYPE_META[r.type].label : r.type}
                </Tooltip>
              </CircleMarker>
            )
          )}
        {selected && selected.lat != null && selected.lng != null && (
          <Marker
            position={[selected.lat, selected.lng]}
            icon={selectedIcon(pinColor(selected.status, selected.urgency))}
            zIndexOffset={1000}
          >
            <Tooltip permanent direction="right" offset={[14, 0]} className="!rounded-lg !border-0 !bg-tk-ink-strong !px-2.5 !py-1.5 !text-white">
              <div className="text-[12px] font-bold">
                {selected.ticket} · {isRequestType(selected.type) ? REQUEST_TYPE_META[selected.type].label : selected.type}
              </div>
              <div className="text-[10.5px] text-tk-line-dashed">
                {[selected.landmark || (selected.communityName ? `ชุมชน${selected.communityName}` : null), `รอ ${selected.waitingMinutes} นาที`]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </Tooltip>
          </Marker>
        )}
        {layers.teams &&
          teams.map((t) =>
            t.lat == null || t.lng == null ? null : (
              <Marker key={t.id} position={[t.lat, t.lng]} icon={TEAM_ICON}>
                <Tooltip direction="right" offset={[16, 0]}>
                  {t.name} · {t.status === "busy" ? "ออกปฏิบัติงาน" : "ว่าง"}
                </Tooltip>
              </Marker>
            )
          )}
        <FlyToSelected req={selected} />
      </MapContainer>

      {/* ชั้นข้อมูล */}
      <div className="absolute left-3.5 top-3.5 z-[500] flex flex-col gap-1 rounded-[14px] bg-white/95 p-2 shadow-tk-xl">
        {/* สลับแผนที่ถนน / ภาพดาวเทียม */}
        <div role="radiogroup" aria-label="รูปแบบแผนที่" className="mb-1 grid grid-cols-2 gap-1 rounded-[10px] bg-tk-unclaimed-soft p-0.5">
          {(
            [
              ["street", "แผนที่"],
              ["satellite", "ดาวเทียม"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={baseMap === k}
              onClick={() => setBaseMap(k)}
              className={`h-7 rounded-lg px-2 text-[11.5px] font-bold ${
                baseMap === k ? "bg-white text-tk-flood shadow-tk-xs" : "text-tk-ink-4"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="px-1.5 pb-1 pt-0.5 text-[10.5px] font-bold tracking-[0.5px] text-tk-ink-4">ชั้นข้อมูล</span>
        {(
          [
            ["requests", "คำขอช่วยเหลือ"],
            ["teams", "ทีมปฏิบัติงาน"],
            ["communities", "ขอบเขตชุมชน (22)"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 px-1.5 py-1 text-[12px] font-semibold">
            <input type="checkbox" checked={layers[k]} onChange={() => toggleLayer(k)} className="h-4 w-4 accent-tk-flood" />
            {label}
          </label>
        ))}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3.5 left-3.5 z-[500] rounded-[14px] bg-white/95 px-3 py-2.5 shadow-tk-xl">
        <div className="text-[10.5px] font-bold tracking-[0.5px] text-tk-ink-4">หมุดคำขอ</div>
        <div className="mt-1.5 flex flex-col gap-1 text-[11.5px] font-semibold">
          {(
            [
              ["#C62839", "ด่วนมาก"],
              ["#E8891D", "ด่วน"],
              ["#6B6880", "ทั่วไป"],
              ["#1B935A", "เสร็จสิ้น"],
            ] as const
          ).map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-white shadow-[0_0_0_1px_#ECEAF2]" style={{ background: c }} />
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
