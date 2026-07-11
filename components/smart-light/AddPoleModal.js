// ฟอร์มเพิ่มเสาใหม่ — เปิดหลังผู้ใช้เลือกตำแหน่งบนแผนที่หลัก (หรือใช้ GPS) แล้ว
import { useState } from "react";
import { LAMP_TYPE } from "@/lib/smart-light/constants";
import { uploadImage } from "@/lib/smart-light/uploadImage";
import { SL, SL_FONT_HEAD } from "@/lib/smart-light/theme";

const labelStyle = { font: "700 12px 'IBM Plex Sans Thai'", color: SL.ink2, marginBottom: 6 };
const fieldStyle = {
  background: "#fff",
  border: `1.5px solid ${SL.line}`,
  borderRadius: 14,
  padding: "11px 13px",
};

export default function AddPoleModal({ latLng, groupNames, onClose, onSaved }) {
  const [group, setGroup] = useState("");
  const [lampType, setLampType] = useState("led");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!group.trim()) {
      setError("กรุณาระบุชุมชน/กลุ่ม");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      let photoUrl = "";
      if (file) {
        try {
          photoUrl = await uploadImage(file);
        } catch {
          const proceed = window.confirm(
            "อัปโหลดรูปไม่สำเร็จ — เพิ่มเสาต่อโดยไม่มีรูปหรือไม่?"
          );
          if (!proceed) {
            setSubmitting(false);
            return;
          }
        }
      }
      const res = await fetch("/api/smart-light/poles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: latLng.lat,
          lng: latLng.lng,
          group: group.trim(),
          lampType,
          note,
          photoUrl,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "เพิ่มเสาไม่สำเร็จ");
      onSaved(data.data);
    } catch (e) {
      setError(e.message || "เพิ่มเสาไม่สำเร็จ");
      setSubmitting(false);
    }
  };

  return (
    <div className="modal modal-open modal-bottom sm:modal-middle" role="dialog">
      <div className="modal-box p-0 overflow-hidden">
        <div style={{ background: SL.primary, color: "#fff", padding: "16px 20px" }}>
          <div style={{ font: `700 20px ${SL_FONT_HEAD}` }}>➕ เพิ่มเสาใหม่</div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.85)", marginTop: 2 }}>
            ตำแหน่ง: {latLng.lat.toFixed(6)}, {latLng.lng.toFixed(6)}
          </div>
        </div>

        <div className="p-5">
        <label className="form-control">
          <span style={labelStyle}>ชุมชน/กลุ่ม *</span>
          <input
            className="w-full outline-none"
            style={fieldStyle}
            list="smart-light-add-group-names"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="เลือกจากรายการ หรือพิมพ์กลุ่มใหม่"
          />
          <datalist id="smart-light-add-group-names">
            {groupNames.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>

        <label className="form-control mt-3">
          <span style={labelStyle}>ชนิดโคม</span>
          <select
            className="w-full outline-none"
            style={fieldStyle}
            value={lampType}
            onChange={(e) => setLampType(e.target.value)}
          >
            {Object.entries(LAMP_TYPE).map(([value, t]) => (
              <option key={value} value={value}>{t.label}</option>
            ))}
          </select>
        </label>

        <label className="form-control mt-3">
          <span style={labelStyle}>รูปถ่าย</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="file-input file-input-bordered w-full"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>

        <label className="form-control mt-3">
          <span style={labelStyle}>หมายเหตุ</span>
          <textarea
            className="w-full outline-none"
            style={fieldStyle}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {error && <p className="text-error text-sm mt-2">{error}</p>}

        <div className="modal-action">
          <button
            className="btn border-0"
            style={{ background: SL.soft2, color: SL.primary }}
            onClick={onClose}
            disabled={submitting}
          >
            ยกเลิก
          </button>
          <button
            className="btn border-0 text-white"
            style={{ background: "#16A34A" }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "กำลังบันทึก…" : "เพิ่มเสา"}
          </button>
        </div>
        </div>
      </div>
      <div className="modal-backdrop" onClick={submitting ? undefined : onClose} />
    </div>
  );
}
