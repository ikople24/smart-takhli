// components/flood-relief/admin/AdminMap.tsx — client only (import ผ่าน next/dynamic ssr:false)
// แผนที่กลางแดชบอร์ด: โซนสี · หมุดคำขอ (สีตามความเร่งด่วน) · หมุดทีม · ขอบเขตชุมชน 22 (basemap อ่านอย่างเดียว)
// เลือกหมุด ↔ รายการซ้าย ↔ แผงขวา ผ่าน selectedId ใน useFloodReliefStore
// เติมสีโซนทั้งชุมชน — เฉพาะ superadmin (canEditZones) ตามที่เจ้าของตกลง 2026-09-26 (เลิกวาด/วงเอง)
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Marker, Polygon, Tooltip, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import L from "leaflet";
import Swal from "sweetalert2";
import "leaflet/dist/leaflet.css";
import type { FeatureCollection } from "geojson";
import { REQUEST_TYPE_META, isRequestType } from "@/lib/flood-relief/status";
import { TAKHLI_CENTER } from "@/lib/flood-relief/geo";
import { isZoneLevel, ZONE_LEVELS, ZONE_META, type ZoneLevel } from "@/lib/flood-relief/zones";
import { useFloodReliefStore } from "@/stores/useFloodReliefStore";
import BaseMapToggle, { FINE_ZOOM } from "../BaseMapToggle";
import BaseTiles from "../BaseTiles";
import { gaugeIcon } from "../gaugeIcon";
import GaugePanel from "./GaugePanel";
import { pinColor } from "./labels";
import type { AdminGauge, AdminRequest, AdminTeam, AdminZone } from "./types";
import ZoneManager from "./ZoneManager";
import ZoneToolbar, { type FillPaint, type ZoneTool } from "./ZoneToolbar";
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

/** โหมดปักจุดวัดน้ำ: แตะแผนที่ 1 ครั้ง = ตำแหน่งจุดใหม่ */
function PickPoint({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
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
  gauges,
  canDeleteGauges,
  onGaugesChanged,
}: {
  items: AdminRequest[];
  teams: AdminTeam[];
  zones: AdminZone[];
  canEditZones: boolean;
  onZonesChanged: () => void;
  gauges: AdminGauge[];
  canDeleteGauges: boolean;
  onGaugesChanged: () => Promise<void> | void;
}) {
  const { selectedId, select, layers, toggleLayer, baseMap, setBaseMap } = useFloodReliefStore();
  const [communities, setCommunities] = useState<FeatureCollection | null>(null);
  const [tool, setTool] = useState<ZoneTool>("none");
  const [paint, setPaint] = useState<FillPaint>("critical");
  const [managerOpen, setManagerOpen] = useState(false);
  const [focusZone, setFocusZone] = useState<AdminZone | null>(null);
  const [busyCommunity, setBusyCommunity] = useState<string | null>(null);
  const [addingGauge, setAddingGauge] = useState(false);
  const [openGaugeId, setOpenGaugeId] = useState<string | null>(null);
  const openGauge = useMemo(() => gauges.find((g) => g.id === openGaugeId) ?? null, [gauges, openGaugeId]);

  const selected = useMemo(() => items.find((r) => r.id === selectedId) ?? null, [items, selectedId]);
  const activeZones = useMemo(() => zones.filter((z) => z.active && isZoneLevel(z.level)), [zones]);
  const zoneByCommunity = useMemo(
    () => new Map(zones.filter((z) => z.communityName).map((z) => [z.communityName as string, z])),
    [zones]
  );
  const filling = canEditZones && tool === "fill";

  useEffect(() => {
    if ((!layers.communities && !filling) || communities) return;
    fetch("/api/flood-relief/communities")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setCommunities(j))
      .catch(() => {});
  }, [layers.communities, filling, communities]);

  /** ปักจุดวัดน้ำใหม่ → ตั้งชื่อ → เปิดหน้าต่างส่งรูปต่อทันที */
  const addGaugeAt = useCallback(
    async (lat: number, lng: number) => {
      setAddingGauge(false);
      const r = await Swal.fire({
        title: "ตั้งชื่อจุดวัดระดับน้ำ",
        html:
          '<input id="g-name" class="swal2-input" maxlength="60" placeholder="เช่น สะพานข้ามคลองหน้าวัด">' +
          '<input id="g-note" class="swal2-input" maxlength="300" placeholder="คำอธิบาย (ไม่บังคับ) เช่น ดูที่เสาตอม่อ">',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: "ปักจุด",
        cancelButtonText: "ยกเลิก",
        preConfirm: () => {
          const name = (document.getElementById("g-name") as HTMLInputElement).value.trim();
          if (!name) {
            Swal.showValidationMessage("กรุณาตั้งชื่อจุด");
            return false;
          }
          return { name, note: (document.getElementById("g-note") as HTMLInputElement).value.trim() };
        },
      });
      if (!r.isConfirmed || !r.value) return;
      const res = await fetch("/api/flood-relief/gauges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...r.value, lat, lng }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        Swal.fire({ icon: "error", title: "ปักจุดไม่สำเร็จ", text: j?.error || "" });
        return;
      }
      await onGaugesChanged();
      setOpenGaugeId(j.id);
    },
    [onGaugesChanged]
  );

  /** คลิกชุมชนตอนโหมดเติมสี → เติม/เปลี่ยนระดับ หรือล้างสี (ลบโซนของชุมชนนั้น) */
  const fillCommunity = useCallback(
    async (name: string) => {
      if (!name || busyCommunity) return;
      const current = zoneByCommunity.get(name);
      if (paint === "clear") {
        if (!current) return;
        setBusyCommunity(name);
        const ok = await zoneRequest("DELETE", current.id);
        setBusyCommunity(null);
        if (ok) onZonesChanged();
        return;
      }
      if (current && current.active && current.level === paint) return; // สีเดิมอยู่แล้ว
      setBusyCommunity(name);
      const ok = await zoneRequest("POST", null, { communityName: name, level: paint });
      setBusyCommunity(null);
      if (ok) onZonesChanged();
    },
    [busyCommunity, zoneByCommunity, paint, onZonesChanged]
  );


  return (
    <div className="flood-map relative h-full w-full">
      <MapContainer
        center={[TAKHLI_CENTER.lat, TAKHLI_CENTER.lng]}
        zoom={14}
        zoomControl={false}
        {...FINE_ZOOM}
        style={{ height: "100%", width: "100%" }}
      >
        {/* ปุ่มซูมมุมขวาล่างตามดีไซน์ — ค่าเริ่มต้นมุมซ้ายบนทับแผงชั้นข้อมูล */}
        <ZoomControl position="bottomright" />
        <BaseTiles baseMap={baseMap} />
        {/* ขอบเขตชุมชน — โหมดเติมสีแสดงเสมอและคลิกได้ (key เปลี่ยนตามโหมด เพราะ GeoJSON ของ react-leaflet ไม่อัปเดต handler เอง) */}
        {(layers.communities || filling) && communities && (
          <GeoJSON
            key={filling ? `fill-${paint}` : "view"}
            data={communities}
            style={{ color: "#2F80FF", weight: filling ? 2.5 : 2, dashArray: "6 4", fillColor: "#2F80FF", fillOpacity: filling ? 0.08 : 0.04 }}
            onEachFeature={(f, layer) => {
              const name = String(f.properties?.name ?? "");
              layer.bindTooltip(filling ? `คลิกเพื่อ${paint === "clear" ? "ล้างสี" : `เติมสี${ZONE_META[paint].label}`} · ${name}` : name, {
                sticky: true,
              });
              if (!filling) return;
              const path = layer as L.Path;
              layer.on({
                click: () => fillCommunity(name),
                mouseover: () => path.setStyle({ fillOpacity: 0.22, weight: 3.5 }),
                mouseout: () => path.setStyle({ fillOpacity: 0.08, weight: 2.5 }),
              });
            }}
          />
        )}

        {/* โซนสี — ระดับต่ำวาดก่อน ระดับสูงทับด้านบน · ไม่รับคลิก ให้คลิกทะลุไปถึงกรอบชุมชนตอนเติมสี */}
        {layers.zones &&
          [...activeZones]
            .sort((a, b) => ZONE_LEVELS.indexOf(b.level as ZoneLevel) - ZONE_LEVELS.indexOf(a.level as ZoneLevel))
            .map((z) => {
              const m = ZONE_META[z.level as ZoneLevel];
              return (
                <Polygon
                  key={`${z.id}-${z.updatedAt}-${z.level}`}
                  positions={ringLatLng(z.geometry)}
                  interactive={false}
                  pathOptions={{
                    color: m.stroke,
                    weight: m.strokeWidth,
                    dashArray: m.dashed ? "6 4" : undefined,
                    fillColor: m.fill,
                    fillOpacity: m.fillOpacity,
                  }}
                >
                  <Tooltip permanent direction="center" className="flood-zone-label">
                    <span style={{ background: ZONE_LABEL_BG[z.level as ZoneLevel] }}>
                      {/* ไม่มีคำขอค้างในโซน = ไม่ต่อท้าย 0 (เจ้าของขอ) */}
                      {z.name} · {m.label}
                      {z.openCount > 0 ? ` · ${z.openCount}` : ""}
                    </span>
                  </Tooltip>
                </Polygon>
              );
            })}

        {/* จุดวัดระดับน้ำ — หมุดรูปย่อล่าสุด · ปิดใช้งานแสดงจาง (เปิดกลับได้จากหน้าต่างจุด) */}
        {layers.gauges &&
          gauges.map((g) =>
            g.lat == null || g.lng == null ? null : (
              <Marker
                key={`${g.id}-${g.lastPhotoAt}-${g.stale}`}
                position={[g.lat, g.lng]}
                icon={gaugeIcon(g.lastPhotoUrl, g.stale, g.lastLevelCm)}
                opacity={g.active ? 1 : 0.45}
                zIndexOffset={500}
                eventHandlers={{ click: () => setOpenGaugeId(g.id) }}
              >
                <Tooltip direction="top" offset={[0, -22]}>
                  📷 {g.name}
                  {g.lastPhotoAt ? "" : " · ยังไม่มีรูป"}
                </Tooltip>
              </Marker>
            )
          )}
        {addingGauge && <PickPoint onPick={addGaugeAt} />}

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
        <FitZone zone={focusZone} />
      </MapContainer>

      {/* ชั้นข้อมูล */}
      <div className="absolute left-3.5 top-3.5 z-[500] flex flex-col gap-1 rounded-[14px] bg-white/95 p-2 shadow-tk-xl">
        <BaseMapToggle value={baseMap} onChange={setBaseMap} className="mb-1" />
        <span className="px-1.5 pb-1 pt-0.5 text-[10.5px] font-bold tracking-[0.5px] text-tk-ink-4">ชั้นข้อมูล</span>
        {(
          [
            ["zones", `โซนสี (${activeZones.length})`],
            ["gauges", `จุดวัดระดับน้ำ (${gauges.filter((g) => g.active).length})`],
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
        <button
          type="button"
          onClick={() => setAddingGauge((v) => !v)}
          aria-pressed={addingGauge}
          className={`mt-1 h-8 rounded-lg px-2 text-[12px] font-bold ${
            addingGauge ? "bg-tk-flood text-white" : "bg-tk-flood-soft text-tk-flood"
          }`}
        >
          {addingGauge ? "ยกเลิกการปักจุด" : "+ ปักจุดวัดน้ำ"}
        </button>
      </div>

      {addingGauge && (
        <div className="absolute left-1/2 top-3.5 z-[600] -translate-x-1/2 rounded-full bg-tk-ink-strong px-4 py-2 text-[12.5px] text-white shadow-tk-xl">
          📷 แตะแผนที่ตรงจุดที่จะวัดระดับน้ำ
        </div>
      )}

      {openGauge && (
        <GaugePanel
          gauge={openGauge}
          canDelete={canDeleteGauges}
          onClose={() => setOpenGaugeId(null)}
          onChanged={onGaugesChanged}
        />
      )}

      {canEditZones && (
        <ZoneToolbar
          tool={tool}
          setTool={setTool}
          paint={paint}
          setPaint={setPaint}
          zoneCount={zones.length}
          onManage={() => setManagerOpen(true)}
        />
      )}

      {busyCommunity && (
        <div className="absolute left-1/2 top-3.5 z-[600] -translate-x-1/2 rounded-full bg-tk-ink-strong px-4 py-2 text-[12.5px] text-white shadow-tk-xl">
          กำลังบันทึกสีชุมชน{busyCommunity}…
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
