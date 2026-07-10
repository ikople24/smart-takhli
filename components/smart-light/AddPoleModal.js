// ฟอร์มเพิ่มเสาใหม่ — เปิดหลังผู้ใช้เลือกตำแหน่งบนแผนที่หลัก (หรือใช้ GPS) แล้ว
import { useState } from "react";
import { LAMP_TYPE } from "@/lib/smart-light/constants";
import { uploadImage } from "@/lib/smart-light/uploadImage";

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
      <div className="modal-box">
        <h3 className="font-bold text-lg">➕ เพิ่มเสาไฟใหม่</h3>
        <p className="text-sm text-gray-500 mt-1">
          ตำแหน่ง: {latLng.lat.toFixed(6)}, {latLng.lng.toFixed(6)}
        </p>

        <label className="form-control mt-3">
          <span className="label-text mb-1">ชุมชน/กลุ่ม *</span>
          <input
            className="input input-bordered w-full"
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
          <span className="label-text mb-1">รูปถ่าย</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="file-input file-input-bordered w-full"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
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

        {error && <p className="text-error text-sm mt-2">{error}</p>}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "กำลังบันทึก…" : "เพิ่มเสา"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={submitting ? undefined : onClose} />
    </div>
  );
}
