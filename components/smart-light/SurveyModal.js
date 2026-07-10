// modal บันทึกสภาพเสา — ออกแบบให้จบเร็วหน้างาน: ปุ่มสถานะใหญ่ + ถ่ายรูป + หมายเหตุ
// อัปโหลดรูปพังต้องไม่บล็อกงาน: ถามยืนยันแล้วบันทึกต่อโดยไม่มีรูปได้
import { useState } from "react";
import { POLE_STATUS, SURVEY_STATUS_VALUES } from "@/lib/smart-light/constants";
import { uploadImage } from "@/lib/smart-light/uploadImage";

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
      <div className="modal-box">
        <h3 className="font-bold text-lg">📋 บันทึกสภาพ — {pole.code}</h3>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {SURVEY_STATUS_VALUES.map((value) => (
            <button
              key={value}
              className={`btn h-16 text-white border-0 ${status === value ? "" : "opacity-40"}`}
              style={{ backgroundColor: POLE_STATUS[value].color }}
              onClick={() => setStatus(value)}
            >
              {POLE_STATUS[value].label}
            </button>
          ))}
        </div>

        <label className="form-control mt-4">
          <span className="label-text mb-1">รูปถ่าย (ถ่ายจากกล้องได้เลย)</span>
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
            placeholder="เช่น หลอดกระพริบ เสาเอียง"
          />
        </label>

        {error && <p className="text-error text-sm mt-2">{error}</p>}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={submitting ? undefined : onClose} />
    </div>
  );
}
