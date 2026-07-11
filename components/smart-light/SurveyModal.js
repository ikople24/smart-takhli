// modal บันทึกสภาพเสา — ออกแบบให้จบเร็วหน้างาน: ปุ่มสถานะใหญ่ + ถ่ายรูป + หมายเหตุ
// อัปโหลดรูปพังต้องไม่บล็อกงาน: ถามยืนยันแล้วบันทึกต่อโดยไม่มีรูปได้
import { useState } from "react";
import { POLE_STATUS, SURVEY_STATUS_VALUES } from "@/lib/smart-light/constants";
import { uploadImage } from "@/lib/smart-light/uploadImage";
import { SL, SL_FONT_HEAD } from "@/lib/smart-light/theme";

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
    <div className="modal modal-open modal-bottom sm:modal-middle" role="dialog">
      <div className="modal-box p-0 overflow-hidden">
        <div style={{ background: SL.primary, color: "#fff", padding: "16px 20px" }}>
          <div style={{ font: `700 20px ${SL_FONT_HEAD}` }}>🔦 บันทึกสภาพเสา</div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.85)", marginTop: 2 }}>
            {pole.code} · 🏘️ {pole.group}
          </div>
        </div>

        <div className="p-5">
        <div className="grid grid-cols-3 gap-2">
          {SURVEY_STATUS_VALUES.map((value) => {
            const active = status === value;
            return (
              <button
                key={value}
                className="border-0"
                style={{
                  height: 66,
                  borderRadius: 16,
                  font: "700 15px 'Anuphan'",
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

        <label className="form-control mt-4">
          <span style={{ font: "700 12px 'IBM Plex Sans Thai'", color: SL.ink2, marginBottom: 6 }}>
            รูปถ่าย (ถ่ายจากกล้องได้เลย)
          </span>
          <div
            style={{
              border: "1.5px dashed #DDD2FB",
              background: "#fff",
              borderRadius: 14,
              padding: "18px 14px",
              textAlign: "center",
              color: SL.ink2,
            }}
          >
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
          </div>
        </label>

        <label className="form-control mt-3">
          <span style={{ font: "700 12px 'IBM Plex Sans Thai'", color: SL.ink2, marginBottom: 6 }}>
            หมายเหตุ
          </span>
          <textarea
            className="textarea textarea-bordered"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น หลอดกระพริบ เสาเอียง"
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
            {submitting ? "กำลังบันทึก…" : "✓ บันทึกสภาพ"}
          </button>
        </div>
        </div>
      </div>
      <div className="modal-backdrop" onClick={submitting ? undefined : onClose} />
    </div>
  );
}
