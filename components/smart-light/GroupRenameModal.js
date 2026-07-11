// modal จัดการกลุ่ม — เปลี่ยนชื่อกลุ่มทั้งกลุ่ม (updateMany ฝั่ง server)
// ถ้าชื่อใหม่ชนกลุ่มที่มีอยู่ server ตอบ 409 needsConfirm — ต้องยืนยันรวมกลุ่มก่อนส่งซ้ำ
import { useState } from "react";
import { SL, SL_FONT_HEAD } from "@/lib/smart-light/theme";

export default function GroupRenameModal({ groups, onClose, onRenamed }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const requestRename = async (confirmMerge) => {
    const res = await fetch("/api/smart-light/groups/rename", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        confirmMerge ? { from, to: to.trim(), confirmMerge: true } : { from, to: to.trim() }
      ),
    });
    return res.json();
  };

  const handleRename = async () => {
    if (!from || !to.trim()) {
      setError("กรุณาเลือกกลุ่มเดิมและกรอกชื่อใหม่");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      let data = await requestRename(false);
      if (!data.success && data.needsConfirm) {
        // ชื่อใหม่ชนกลุ่มที่มีอยู่ = รวมกลุ่ม — ให้ผู้ใช้ยืนยันก่อน
        const proceed = window.confirm(data.message);
        if (!proceed) {
          setSubmitting(false);
          return;
        }
        data = await requestRename(true);
      }
      if (!data.success) throw new Error(data.message || "เปลี่ยนชื่อไม่สำเร็จ");
      onRenamed();
    } catch (e) {
      setError(e.message || "เปลี่ยนชื่อไม่สำเร็จ");
      setSubmitting(false);
    }
  };

  return (
    <div className="modal modal-open modal-bottom sm:modal-middle" role="dialog">
      <div className="modal-box p-0">
        <h3
          className="px-6 py-4"
          style={{
            background: SL.primary,
            color: "#fff",
            font: `700 18px ${SL_FONT_HEAD}`,
          }}
        >
          🏘️ เปลี่ยนชื่อกลุ่ม/ชุมชน
        </h3>

        <div className="px-6 pb-6 pt-4">
        <p className="text-sm text-gray-500 mt-1">
          เปลี่ยนแล้วมีผลกับเสาทุกต้นในกลุ่ม (ไว้แก้ชื่อที่สะกดผิดจากไฟล์เดิม)
        </p>

        <label className="form-control mt-3">
          <span className="label-text mb-1">กลุ่มเดิม</span>
          <select
            className="select select-bordered w-full"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            <option value="">— เลือกกลุ่ม —</option>
            {groups.map((g) => (
              <option key={g.group} value={g.group}>
                {g.group} ({g.total} ต้น)
              </option>
            ))}
          </select>
        </label>

        <label className="form-control mt-3">
          <span className="label-text mb-1">ชื่อใหม่</span>
          <input
            className="input input-bordered w-full"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="เช่น ชุมชนตาคลี"
          />
        </label>

        {error && <p className="text-error text-sm mt-2">{error}</p>}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </button>
          <button
            className="btn"
            onClick={handleRename}
            disabled={submitting}
            style={{ background: SL.primary, color: "#fff", border: "none" }}
          >
            {submitting ? "กำลังเปลี่ยน…" : "เปลี่ยนชื่อ"}
          </button>
        </div>
        </div>
      </div>
      <div className="modal-backdrop" onClick={submitting ? undefined : onClose} />
    </div>
  );
}
