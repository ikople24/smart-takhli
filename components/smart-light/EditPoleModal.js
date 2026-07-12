// modal แก้ไขข้อมูลเสา + ลากหมุดปรับพิกัดบนแผนที่ย่อย + ลบเสา (confirm 2 ชั้น)
// มี leaflet ข้างใน — ต้อง import ผ่าน dynamic(..., { ssr: false }) เท่านั้น
import { useState } from "react";
import { MapContainer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LAMP_TYPE } from "@/lib/smart-light/constants";
import { SL } from "@/lib/smart-light/theme";
import { BaseTileLayers } from "./MapLayers";
import { MapLayerToggle } from "./MapLayerToggle";
import {
  SLModalShell,
  SLCancelButton,
  SLPrimaryButton,
  slLabel,
  slField,
} from "./modalUi";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

export default function EditPoleModal({ pole, groupNames, onClose, onSaved, onDeleted }) {
  const [group, setGroup] = useState(pole.group);
  const [lampType, setLampType] = useState(pole.lampType || "unknown");
  const [name, setName] = useState(pole.name || "");
  const [note, setNote] = useState(pole.note || "");
  const [position, setPosition] = useState({ lat: pole.lat, lng: pole.lng });
  const [baseLayer, setBaseLayer] = useState("street");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/smart-light/poles/${pole._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group,
          lampType,
          name,
          note,
          lat: position.lat,
          lng: position.lng,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "บันทึกไม่สำเร็จ");
      onSaved();
    } catch (e) {
      setError(e.message || "บันทึกไม่สำเร็จ");
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/smart-light/poles/${pole._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "ลบไม่สำเร็จ");
      onDeleted();
    } catch (e) {
      setError(e.message || "ลบไม่สำเร็จ");
      setSubmitting(false);
    }
  };

  return (
    <SLModalShell
      icon="✏️"
      title="แก้ไขข้อมูลเสา"
      subtitle={`${pole.code} · 🏘️ ${pole.group}`}
      onClose={onClose}
      disabled={submitting}
      maxWidth={560}
      footer={
        <>
          <SLCancelButton onClick={onClose} disabled={submitting} />
          <SLPrimaryButton onClick={handleSave} disabled={submitting}>
            {submitting ? "กำลังบันทึก…" : "บันทึก"}
          </SLPrimaryButton>
        </>
      }
    >
      <div>
        <span style={slLabel}>ชุมชน/กลุ่ม</span>
        <input
          style={slField}
          list="smart-light-group-names"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        />
        <datalist id="smart-light-group-names">
          {groupNames.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </div>

      <div>
        <span style={slLabel}>ชนิดโคม</span>
        <select
          style={{ ...slField, cursor: "pointer" }}
          value={lampType}
          onChange={(e) => setLampType(e.target.value)}
        >
          {Object.entries(LAMP_TYPE).map(([value, t]) => (
            <option key={value} value={value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <span style={slLabel}>ชื่อ/เลขเดิม</span>
        <input
          style={slField}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <span style={slLabel}>หมายเหตุ</span>
        <textarea
          style={{ ...slField, resize: "none" }}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div>
        <span style={slLabel}>ตำแหน่ง (ลากหมุดเพื่อปรับ)</span>
        <div className="relative h-56 rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${SL.line}` }}>
          <div className="absolute z-[500] top-2 right-2">
            <MapLayerToggle value={baseLayer} onChange={setBaseLayer} size="sm" />
          </div>
          <MapContainer
            center={[pole.lat, pole.lng]}
            zoom={18}
            zoomControl={false}
            style={{ height: "100%", width: "100%" }}
          >
            <BaseTileLayers baseLayer={baseLayer} />
            <Marker
              position={[position.lat, position.lng]}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const ll = e.target.getLatLng();
                  setPosition({ lat: ll.lat, lng: ll.lng });
                },
              }}
            />
          </MapContainer>
        </div>
        <p className="text-xs mt-1.5" style={{ color: SL.muted }}>
          {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
        </p>
      </div>

      {error && <p className="text-error text-sm">{error}</p>}

      {/* ลบเสา: confirm 2 ชั้น — กดครั้งแรกเปิดกล่องยืนยันแสดงรหัส/กลุ่ม กดปุ่มแดงอีกครั้งจึงลบจริง */}
      {confirmingDelete ? (
        <div className="alert alert-error flex-col items-start">
          <p className="font-semibold">
            ยืนยันลบเสา {pole.code} (กลุ่ม {pole.group})? ลบแล้วกู้คืนไม่ได้
          </p>
          <div className="flex gap-2">
            <button className="btn btn-sm btn-error" onClick={handleDelete} disabled={submitting}>
              ลบถาวร
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setConfirmingDelete(false)}
              disabled={submitting}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-outline btn-error btn-sm self-start"
          onClick={() => setConfirmingDelete(true)}
        >
          🗑 ลบเสานี้
        </button>
      )}
    </SLModalShell>
  );
}
