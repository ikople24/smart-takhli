// components/flood-relief/admin/AdminMap.tsx — client only (import ผ่าน next/dynamic ssr:false)
// แผนที่กลางแดชบอร์ด: โซนสี · หมุดคำขอ (สีตามความเร่งด่วน) · หมุดทีม · ขอบเขตชุมชน 22 (basemap อ่านอย่างเดียว)
// เลือกหมุด ↔ รายการซ้าย ↔ แผงขวา ผ่าน selectedId ใน useFloodReliefStore
// เครื่องมือวาด/แก้/ลบโซน (Geoman) — เฉพาะ superadmin (canEditZones) ตามที่เจ้าของตกลง 2026-09-26
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Marker, Polygon, Tooltip, useMap, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FeatureCollection } from "geojson";
import Swal from "sweetalert2";
import { REQUEST_TYPE_META, isRequestType } from "@/lib/flood-relief/status";
import { TAKHLI_CENTER } from "@/lib/flood-relief/geo";
import { isZoneLevel, nextZoneName, ZONE_LEVELS, ZONE_META, type ZoneLevel } from "@/lib/flood-relief/zones";
import { useFloodReliefStore } from "@/stores/useFloodReliefStore";
import BaseMapToggle from "../BaseMapToggle";
import BaseTiles from "../BaseTiles";
import { pinColor } from "./labels";
import type { AdminRequest, AdminTeam, AdminZone } from "./types";
import { DrawZone, EditZone } from "./ZoneGeoman";
import ZoneManager from "./ZoneManager";
import ZoneToolbar, { type ZoneTool } from "./ZoneToolbar";
import { zoneRequest } from "./zoneApi";

type PolygonGeom = { type: "Polygon"; coordinates: number[][][] };

/** สีป้ายกลางโซน (ตัวขาวบนพื้นเข้ม) ตามดีไซน์ */
const ZONE_LABEL_BG: Record<ZoneLevel, string> = {
  critical: "#B92544",
  danger: "#9E6206",
  watch: "#7A6510",
  safe: "#14714A",
};

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

/** GeoJSON [lng,lat] → Leaflet [lat,lng] */
const ringLatLng = (g: PolygonGeom): [number, number][] => g.coordinates[0].map(([lng, lat]) => [lat, lng]);

function FlyToSelected({ req }: { req: AdminRequest | null }) {
  const map = useMap();
  useEffect(() => {
    if (req?.lat != null && req.lng != null) map.flyTo([req.lat, req.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [map, req?.id, req?.lat, req?.lng]);
  return null;
}

function FitZone({ zone }: { zone: AdminZone | null }) {
  const map = useMap();
  useEffect(() => {
    if (zone) map.fitBounds(L.latLngBounds(ringLatLng(zone.geometry)), { padding: [60, 60], maxZoom: 18 });
  }, [map, zone]);
  return null;
}

export default function AdminMap({
  items,
  teams,
  zones,
  canEditZones,
  onZonesChanged,
}: {
  items: AdminRequest[];
  teams: AdminTeam[];
  zones: AdminZone[];
  canEditZones: boolean;
  onZonesChanged: () => void;
}) {
  const { selectedId, select, layers, toggleLayer, baseMap, setBaseMap } = useFloodReliefStore();
  const [communities, setCommunities] = useState<FeatureCollection | null>(null);
  const [tool, setTool] = useState<ZoneTool>("none");
  const [drawLevel, setDrawLevel] = useState<ZoneLevel>("critical");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [focusZone, setFocusZone] = useState<AdminZone | null>(null);
  const [saving, setSaving] = useState(false);
  const collectRef = useRef<(() => PolygonGeom | null) | null>(null);

  const selected = useMemo(() => items.find((r) => r.id === selectedId) ?? null, [items, selectedId]);
  const activeZones = useMemo(() => zones.filter((z) => z.active && isZoneLevel(z.level)), [zones]);
  const editing = useMemo(() => zones.find((z) => z.id === editingId) ?? null, [zones, editingId]);

  useEffect(() => {
    if (!layers.communities || communities) return;
    fetch("/api/flood-relief/communities")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setCommunities(j))
      .catch(() => {});
  }, [layers.communities, communities]);

  // เปลี่ยนเครื่องมือ = ออกจากโหมดแก้มุมที่ค้างอยู่
  useEffect(() => {
    if (tool !== "edit") setEditingId(null);
  }, [tool]);

  const onCreated = useCallback(
    async (geometry: PolygonGeom) => {
      const suggested = nextZoneName(zones.map((z) => z.name));
      const r = await Swal.fire({
        title: `ตั้งชื่อโซน${ZONE_META[drawLevel].label}`,
        input: "text",
        inputValue: suggested,
        inputAttributes: { maxlength: "20" },
        showCancelButton: true,
        confirmButtonText: "บันทึกโซน",
        cancelButtonText: "ยกเลิก",
      });
      if (!r.isConfirmed) {
        setTool("none");
        return;
      }
      setSaving(true);
      const ok = await zoneRequest("POST", null, { level: drawLevel, geometry, name: String(r.value ?? "").trim() || suggested });
      setSaving(false);
      setTool("none");
      if (ok) onZonesChanged();
    },
    [zones, drawLevel, onZonesChanged]
  );

  const onZoneClick = async (z: AdminZone) => {
    if (tool === "edit") {
      setEditingId(z.id);
      return;
    }
    if (tool === "delete") {
      const ok = await Swal.fire({
        icon: "warning",
        title: `ลบโซน ${z.name}?`,
        text: `${ZONE_META[z.level as ZoneLevel]?.label ?? z.level} · มีคำขอที่ยังเปิด ${z.openCount} รายการ (จะถูกจัดโซนใหม่)`,
        showCancelButton: true,
        confirmButtonText: "ลบ",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#B92544",
      });
      if (!ok.isConfirmed) return;
      if (await zoneRequest("DELETE", z.id)) onZonesChanged();
    }
  };

  const saveEdit = async () => {
    const geometry = collectRef.current?.();
    if (!editing || !geometry) return;
    setSaving(true);
    const ok = await zoneRequest("PATCH", editing.id, { geometry });
    setSaving(false);
    if (ok) {
      setEditingId(null);
      onZonesChanged();
    }
  };

  const zonesInteractive = canEditZones && (tool === "edit" || tool === "delete");

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[TAKHLI_CENTER.lat, TAKHLI_CENTER.lng]}
        zoom={14}
        zoomControl={false}
        doubleClickZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        {/* ปุ่มซูมมุมขวาล่างตามดีไซน์ — ค่าเริ่มต้นมุมซ้ายบนทับแผงชั้นข้อมูล */}
        <ZoomControl position="bottomright" />
        <BaseTiles baseMap={baseMap} />
        {layers.communities && communities && (
          <GeoJSON
            data={communities}
            style={{ color: "#2F80FF", weight: 2, dashArray: "6 4", fillColor: "#2F80FF", fillOpacity: 0.04 }}
            onEachFeature={(f, layer) => layer.bindTooltip(String(f.properties?.name ?? ""), { sticky: true })}
          />
        )}

        {/* โซนสี — ระดับต่ำวาดก่อน ระดับสูงทับด้านบน · interactive เฉพาะตอนแก้/ลบ (ไม่ขวางการคลิกหมุด/วาด) */}
        {layers.zones &&
          [...activeZones]
            .sort((a, b) => ZONE_LEVELS.indexOf(b.level as ZoneLevel) - ZONE_LEVELS.indexOf(a.level as ZoneLevel))
            .map((z) => {
              if (z.id === editingId) return null;
              const m = ZONE_META[z.level as ZoneLevel];
              return (
                <Polygon
                  key={`${z.id}-${z.updatedAt}-${zonesInteractive}`}
                  positions={ringLatLng(z.geometry)}
                  interactive={zonesInteractive}
                  pathOptions={{
                    color: m.stroke,
                    weight: m.strokeWidth,
                    dashArray: m.dashed ? "6 4" : undefined,
                    fillColor: m.fill,
                    fillOpacity: m.fillOpacity,
                  }}
                  eventHandlers={{ click: () => onZoneClick(z) }}
                >
                  <Tooltip permanent direction="center" className="flood-zone-label">
                    <span style={{ background: ZONE_LABEL_BG[z.level as ZoneLevel] }}>
                      {z.name} · {m.label} · {z.openCount}
                    </span>
                  </Tooltip>
                </Polygon>
              );
            })}

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

        {canEditZones && (tool === "polygon" || tool === "circle") && !saving && (
          <DrawZone shape={tool} level={drawLevel} onCreated={onCreated} />
        )}
        {canEditZones && editing && isZoneLevel(editing.level) && (
          <EditZone geometry={editing.geometry} level={editing.level} collectRef={collectRef} />
        )}
        <FlyToSelected req={selected} />
        <FitZone zone={focusZone} />
      </MapContainer>

      {/* ชั้นข้อมูล */}
      <div className="absolute left-3.5 top-3.5 z-[500] flex flex-col gap-1 rounded-[14px] bg-white/95 p-2 shadow-tk-xl">
        <BaseMapToggle value={baseMap} onChange={setBaseMap} className="mb-1" />
        <span className="px-1.5 pb-1 pt-0.5 text-[10.5px] font-bold tracking-[0.5px] text-tk-ink-4">ชั้นข้อมูล</span>
        {(
          [
            ["zones", `โซนสี (${activeZones.length})`],
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

      {canEditZones && (
        <ZoneToolbar
          tool={tool}
          setTool={setTool}
          level={drawLevel}
          setLevel={setDrawLevel}
          zoneCount={zones.length}
          onManage={() => setManagerOpen(true)}
        />
      )}

      {/* แถบบันทึกตอนแก้มุมโซน */}
      {editing && (
        <div className="absolute left-1/2 top-3.5 z-[600] flex -translate-x-1/2 items-center gap-2 rounded-full bg-tk-ink-strong px-4 py-2 text-[12.5px] text-white shadow-tk-xl">
          <span>
            กำลังแก้โซน <b>{editing.name}</b> — ลากจุดมุมเพื่อปรับ
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={saveEdit}
            className="h-8 rounded-full bg-white px-3.5 font-bold text-tk-flood disabled:opacity-60"
          >
            บันทึก
          </button>
          <button type="button" onClick={() => setEditingId(null)} className="h-8 rounded-full px-3 font-semibold text-white/80">
            ยกเลิก
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3.5 left-3.5 z-[500] flex gap-4 rounded-[14px] bg-white/95 px-3 py-2.5 shadow-tk-xl">
        <div>
          <div className="text-[10.5px] font-bold tracking-[0.5px] text-tk-ink-4">ระดับโซน</div>
          <div className="mt-1.5 flex flex-col gap-1 text-[11.5px] font-semibold">
            {ZONE_LEVELS.map((l) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="h-2.5 w-3.5 rounded-[3px]" style={{ background: ZONE_META[l].fill, opacity: 0.7 }} />
                {ZONE_META[l].label} · {ZONE_META[l].meaning}
              </span>
            ))}
          </div>
        </div>
        <div>
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

      {managerOpen && (
        <ZoneManager
          zones={zones}
          onClose={() => setManagerOpen(false)}
          onChanged={onZonesChanged}
          onFocus={(z) => {
            setManagerOpen(false);
            setFocusZone({ ...z });
          }}
        />
      )}
    </div>
  );
}
