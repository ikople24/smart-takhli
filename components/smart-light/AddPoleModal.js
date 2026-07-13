// ฟอร์มเพิ่มเสาใหม่ — เปิดหลังผู้ใช้เลือกตำแหน่งบนแผนที่หลัก (หรือใช้ GPS) แล้ว
import { useState } from "react";
import { LAMP_TYPE } from "@/lib/smart-light/constants";
import { uploadImage } from "@/lib/smart-light/uploadImage";
import {
  SLModalShell,
  SLCancelButton,
  SLPrimaryButton,
  slLabel,
  slField,
  slDashed,
} from "./modalUi";

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
    <SLModalShell
      icon="➕"
      title="เพิ่มเสาไฟใหม่"
      subtitle={`ตำแหน่ง: ${latLng.lat.toFixed(6)}, ${latLng.lng.toFixed(6)}`}
      onClose={onClose}
      disabled={submitting}
      maxWidth={560}
      footer={
        <>
          <SLCancelButton onClick={onClose} disabled={submitting} />
          <SLPrimaryButton onClick={handleSubmit} disabled={submitting} color="#16A34A">
            {submitting ? "กำลังบันทึก…" : "✓ บันทึกเสาใหม่"}
          </SLPrimaryButton>
        </>
      }
    >
      <div>
        <span style={slLabel}>ชุมชน/กลุ่ม *</span>
        <input
          style={slField}
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
        <span style={slLabel}>รูปถ่าย (ถ่ายจากกล้องได้เลย)</span>
        <label style={{ ...slDashed, display: "block", cursor: "pointer" }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            📷 {file ? file.name : "แตะเพื่อถ่ายรูป หรือเลือกไฟล์"}
          </div>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="file-input file-input-bordered file-input-sm w-full"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
      </div>

      <div>
        <span style={slLabel}>หมายเหตุ</span>
        <textarea
          style={{ ...slField, resize: "none" }}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="เช่น หลอดกระพริบ เสาเอียง"
        />
      </div>

      {error && <p className="text-error text-sm">{error}</p>}
    </SLModalShell>
  );
}
