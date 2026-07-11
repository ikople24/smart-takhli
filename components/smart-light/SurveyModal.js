// modal บันทึกสภาพเสา — ออกแบบให้จบเร็วหน้างาน: ปุ่มสถานะใหญ่ + ถ่ายรูป + หมายเหตุ
// อัปโหลดรูปพังต้องไม่บล็อกงาน: ถามยืนยันแล้วบันทึกต่อโดยไม่มีรูปได้
import { useState } from "react";
import { POLE_STATUS, SURVEY_STATUS_VALUES } from "@/lib/smart-light/constants";
import { uploadImage } from "@/lib/smart-light/uploadImage";
import { SL } from "@/lib/smart-light/theme";
import {
  SLModalShell,
  SLCancelButton,
  SLPrimaryButton,
  slLabel,
  slField,
  slDashed,
} from "./modalUi";

export default function SurveyModal({ pole, onClose, onSaved }) {
  const [status, setStatus] = useState(
    SURVEY_STATUS_VALUES.includes(pole.status) ? pole.status : "normal"
  );
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      let photoUrl = "";
      if (file) {
        try {
          photoUrl = await uploadImage(file);
        } catch {
          const proceed = window.confirm(
            "อัปโหลดรูปไม่สำเร็จ — บันทึกสภาพต่อโดยไม่มีรูปหรือไม่?"
          );
          if (!proceed) {
            setSubmitting(false);
            return;
          }
        }
      }
      const res = await fetch(`/api/smart-light/poles/${pole._id}/survey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, photoUrl, note }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "บันทึกไม่สำเร็จ");
      onSaved();
    } catch (e) {
      setError(e.message || "บันทึกไม่สำเร็จ");
      setSubmitting(false);
    }
  };

  return (
    <SLModalShell
      icon="📋"
      title="บันทึกสภาพเสา"
      subtitle={`${pole.code} · 🏘️ ${pole.group}`}
      onClose={onClose}
      disabled={submitting}
      maxWidth={520}
      bodyGap={18}
      footer={
        <>
          <SLCancelButton onClick={onClose} disabled={submitting} />
          <SLPrimaryButton onClick={handleSubmit} disabled={submitting} color="#16A34A">
            {submitting ? "กำลังบันทึก…" : "✓ บันทึกสภาพ"}
          </SLPrimaryButton>
        </>
      }
    >
      <div>
        <span style={slLabel}>สถานะที่พบหน้างาน</span>
        <div className="grid grid-cols-3 gap-2.5">
          {SURVEY_STATUS_VALUES.map((value) => {
            const active = status === value;
            return (
              <button
                key={value}
                type="button"
                className="border-0"
                style={{
                  height: 66,
                  borderRadius: 16,
                  font: "700 15px 'Anuphan'",
                  cursor: "pointer",
                  background: active ? POLE_STATUS[value].color : SL.soft2,
                  color: active ? "#fff" : SL.muted,
                }}
                onClick={() => setStatus(value)}
              >
                {POLE_STATUS[value].label}
              </button>
            );
          })}
        </div>
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
