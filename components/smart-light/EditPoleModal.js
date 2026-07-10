// modal แก้ไขข้อมูลเสา + ลากหมุดปรับพิกัดบนแผนที่ย่อย + ลบเสา (confirm 2 ชั้น)
// มี leaflet ข้างใน — ต้อง import ผ่าน dynamic(..., { ssr: false }) เท่านั้น
import { useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LAMP_TYPE } from "@/lib/smart-light/constants";

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
    <div className="modal modal-open modal-bottom sm:modal-middle" role="dialog">
      <div className="modal-box max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-lg">✏️ แก้ไขข้อมูล — {pole.code}</h3>

        <label className="form-control mt-3">
          <span className="label-text mb-1">ชุมชน/กลุ่ม</span>
          <input
            className="input input-bordered w-full"
            list="smart-light-group-names"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          />
          <datalist id="smart-light-group-names">
            {groupNames.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>

        <label className="form-control mt-3">
          <span className="label-text mb-1">ชนิดโคม</span>
          <select
            className="select select-bordered w-full"
            value={lampType}
            onChange={(e) => setLampType(e.target.value)}
          >
            {Object.entries(LAMP_TYPE).map(([value, t]) => (
              <option key={value} value={value}>{t.label}</option>
            ))}
          </select>
        </label>

        <label className="form-control mt-3">
          <span className="label-text mb-1">ชื่อ/เลขเดิม</span>
          <input
            className="input input-bordered w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="form-control mt-3">
          <span className="label-text mb-1">หมายเหตุ</span>
          <textarea
            className="textarea textarea-bordered"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <div className="mt-3">
          <span className="label-text">ตำแหน่ง (ลากหมุดเพื่อปรับ)</span>
          <div className="h-56 mt-1 rounded-lg overflow-hidden">
            <MapContainer
              center={[pole.lat, pole.lng]}
              zoom={18}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="© OpenStreetMap contributors"
              />
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
          <p className="text-xs text-gray-400 mt-1">
            {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
          </p>
        </div>

        {error && <p className="text-error text-sm mt-2">{error}</p>}

        {/* ลบเสา: confirm 2 ชั้น — กดครั้งแรกเปิดกล่องยืนยันแสดงรหัส/กลุ่ม กดปุ่มแดงอีกครั้งจึงลบจริง */}
        {confirmingDelete ? (
          <div className="alert alert-error mt-4 flex-col items-start">
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
            className="btn btn-outline btn-error btn-sm mt-4"
            onClick={() => setConfirmingDelete(true)}
          >
            🗑 ลบเสานี้
          </button>
        )}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={submitting}>
            {submitting ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={submitting ? undefined : onClose} />
    </div>
  );
}
