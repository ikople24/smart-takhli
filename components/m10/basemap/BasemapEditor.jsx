import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { EditFeature, DrawNew } from "./BasemapGeoman";
import BasemapViewportLoader from "./BasemapViewportLoader";
import BasemapAttrPanel from "./BasemapAttrPanel";
import { parcelColor, LAND_TYPE_COLORS, OTHER_COLOR } from "./landTypeColors";
import { geometryAreaSqm } from "@/lib/m10-ingest/basemap/area";

const MIN_ZOOM = 16;
const CENTER = [15.255, 100.342]; // เทศบาลเมืองตาคลี
const EMPTY_FORM = { parcelCode: "", deedNo: "", landNo: "", survey: "", landType: "", zoneId: "", blockId: "", lot: "" };

// เก็บ ref ของ map ไว้สั่ง flyToBounds จากผลค้นหา
function MapRef({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

export default function BasemapEditor() {
  const mapRef = useRef(null);
  const collectRef = useRef(null);
  const [features, setFeatures] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [lowZoom, setLowZoom] = useState(true);
  const [selectedCode, setSelectedCode] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [mode, setMode] = useState("view"); // view | edit | draw
  const [form, setForm] = useState(EMPTY_FORM);
  const [drawnGeom, setDrawnGeom] = useState(null);
  const [areaSqm, setAreaSqm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [lastBbox, setLastBbox] = useState(null);
  const [curZoom, setCurZoom] = useState(null);
  const [httpStatus, setHttpStatus] = useState(null);
  const [loadErr, setLoadErr] = useState(null);

  const loadBbox = useCallback(async (bbox) => {
    try {
      const r = await fetch(`/api/m10-ingest/basemap?bbox=${bbox.join(",")}`);
      setHttpStatus(r.status);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setLoadErr(j.error || `HTTP ${r.status}`); setFeatures([]); return; }
      setLoadErr(null);
      setFeatures(j.features || []);
      setTruncated(!!j.truncated);
    } catch (e) { setHttpStatus(-1); setLoadErr(String(e?.message || e)); }
  }, []);

  const onViewport = useCallback((bbox, zoom) => {
    setCurZoom(zoom);
    if (!bbox) { setLowZoom(true); setFeatures([]); return; }
    setLowZoom(false); setLastBbox(bbox); loadBbox(bbox);
  }, [loadBbox]);

  const formFromProps = (p) => ({
    parcelCode: p.parcelCode ?? "", deedNo: p.deedNo ?? "", landNo: p.landNo ?? "",
    survey: p.survey ?? "", landType: p.landType ?? "", zoneId: p.zoneId ?? "",
    blockId: p.blockId ?? "", lot: p.lot ?? "",
  });

  const selectFeature = (f) => {
    if (mode !== "view") return;
    setSelectedCode(f.properties.parcelCode);
    setSelectedFeature(f);
    setForm(formFromProps(f.properties));
    setAreaSqm(geometryAreaSqm(f.geometry));
  };

  const onEdit = () => { if (selectedFeature) setMode("edit"); };
  const onDraw = () => {
    setSelectedCode(null); setSelectedFeature(null); setForm(EMPTY_FORM);
    setDrawnGeom(null); setAreaSqm(null); setMode("draw");
  };
  const onCreated = (geom) => { setDrawnGeom(geom); setAreaSqm(geometryAreaSqm(geom)); };
  const onCancel = () => { setMode("view"); setDrawnGeom(null); collectRef.current = null; };

  const onSave = async () => {
    if (!form.parcelCode?.trim()) { alert("ต้องระบุรหัสแปลง"); return; }
    let geometry;
    if (mode === "edit") geometry = collectRef.current ? collectRef.current() : null;
    else if (mode === "draw") geometry = drawnGeom;
    if (mode === "draw" && !geometry) { alert("ยังไม่ได้วาดรูปแปลง"); return; }
    setSaving(true);
    try {
      const body = { ...form, geometry: geometry || undefined, kind: mode === "draw" ? "new" : "edit" };
      const r = await fetch("/api/m10-ingest/basemap/save", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) { alert(j.error || "บันทึกไม่สำเร็จ"); return; }
      setMode("view"); setDrawnGeom(null); collectRef.current = null;
      setSelectedCode(null); setSelectedFeature(null);
      if (lastBbox) loadBbox(lastBbox);
    } finally { setSaving(false); }
  };

  const onSearch = async (q) => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(`/api/m10-ingest/basemap/search?q=${encodeURIComponent(q.trim())}`);
      const j = await r.json();
      setSearchResults(j.results || []);
    } finally { setSearching(false); }
  };
  const onPickResult = (r) => {
    if (mapRef.current && r.bbox && r.bbox[0] !== r.bbox[2]) {
      mapRef.current.flyToBounds([[r.bbox[1], r.bbox[0]], [r.bbox[3], r.bbox[2]]], { maxZoom: 19 });
    }
    setSearchResults([]);
  };

  const fc = useMemo(() => ({ type: "FeatureCollection", features }), [features]);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full">
      <div className="relative flex-1">
        {lowZoom && <div className="absolute z-[1000] top-2 left-1/2 -translate-x-1/2 badge badge-warning">ซูมเข้าเพื่อโหลดแปลง</div>}
        {truncated && !lowZoom && <div className="absolute z-[1000] top-2 left-1/2 -translate-x-1/2 badge badge-error">แปลงเยอะเกิน — ซูมเข้าอีก</div>}
        {/* legend สีตามประเภทเอกสารสิทธิ์ */}
        <div className="absolute z-[1000] top-2 right-2 bg-base-100/90 rounded px-2 py-1 text-[11px] shadow space-y-0.5">
          {LAND_TYPE_COLORS.map((x) => (
            <div key={x.type} className="flex items-center gap-1.5">
              <span style={{ background: x.color }} className="inline-block w-3 h-3 rounded-sm" />{x.type}
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span style={{ background: OTHER_COLOR }} className="inline-block w-3 h-3 rounded-sm" />อื่น ๆ
          </div>
        </div>
        {/* HUD วินิจฉัยชั่วคราว — ลบออกหลังแก้บั๊กเสร็จ */}
        <div className="absolute z-[1000] bottom-2 left-2 bg-base-100/90 rounded px-2 py-1 text-[11px] shadow font-mono">
          zoom {curZoom ?? "–"} · โหลด {features.length}{truncated ? "+" : ""} แปลง · HTTP {httpStatus ?? "–"}
          {loadErr ? <span className="text-error"> · {loadErr}</span> : null}
        </div>
        <MapContainer center={CENTER} zoom={15} maxZoom={21} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxNativeZoom={19} maxZoom={21} />
          <MapRef mapRef={mapRef} />
          <BasemapViewportLoader onViewport={onViewport} minZoom={MIN_ZOOM} />
          {mode !== "edit" && (
            <GeoJSON
              key={features.length + "|" + selectedCode + "|" + mode}
              data={fc}
              style={(f) => {
                const c = parcelColor(f.properties.landType);
                const sel = f.properties.parcelCode === selectedCode;
                return { color: c, weight: sel ? 4 : 1.5, fillColor: c, fillOpacity: sel ? 0.5 : 0.12 };
              }}
              onEachFeature={(f, layer) => {
                layer.on("click", () => selectFeature(f));
                if (f.properties.parcelCode) {
                  layer.bindTooltip(String(f.properties.parcelCode), { permanent: true, direction: "center", className: "parcel-label" });
                }
              }}
            />
          )}
          {mode === "edit" && selectedFeature && <EditFeature feature={selectedFeature} onCollect={collectRef} />}
          {mode === "draw" && <DrawNew onCreated={onCreated} />}
        </MapContainer>
      </div>
      <BasemapAttrPanel
        mode={mode} selected={selectedCode} form={form} setForm={setForm} areaSqm={areaSqm}
        onEdit={onEdit} onDraw={onDraw} onSave={onSave} onCancel={onCancel} saving={saving}
        onSearch={onSearch} searchResults={searchResults} onPickResult={onPickResult} searching={searching}
      />
    </div>
  );
}
