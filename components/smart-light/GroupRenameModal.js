// modal จัดการกลุ่ม — เปลี่ยนชื่อกลุ่มทั้งกลุ่ม (updateMany ฝั่ง server)
// ถ้าชื่อใหม่ชนกลุ่มที่มีอยู่ server ตอบ 409 needsConfirm — ต้องยืนยันรวมกลุ่มก่อนส่งซ้ำ
import { useState } from "react";
import { SL } from "@/lib/smart-light/theme";
import {
  SLModalShell,
  SLCancelButton,
  SLPrimaryButton,
  slLabel,
  slField,
} from "./modalUi";

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
    <SLModalShell
      icon="🏘️"
      title="เปลี่ยนชื่อกลุ่ม/ชุมชน"
      subtitle="เปลี่ยนแล้วมีผลกับเสาทุกต้นในกลุ่ม"
      onClose={onClose}
      disabled={submitting}
      maxWidth={480}
      footer={
        <>
          <SLCancelButton onClick={onClose} disabled={submitting} />
          <SLPrimaryButton onClick={handleRename} disabled={submitting}>
            {submitting ? "กำลังเปลี่ยน…" : "เปลี่ยนชื่อ"}
          </SLPrimaryButton>
        </>
      }
    >
      <p className="text-sm" style={{ color: SL.ink2 }}>
        ไว้แก้ชื่อที่สะกดผิดจากไฟล์เดิม — เลือกกลุ่มเดิมแล้วกรอกชื่อใหม่
      </p>

      <div>
        <span style={slLabel}>กลุ่มเดิม</span>
        <select
          style={{ ...slField, cursor: "pointer" }}
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
      </div>

      <div>
        <span style={slLabel}>ชื่อใหม่</span>
        <input
          style={slField}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="เช่น ชุมชนตาคลี"
        />
      </div>

      {error && <p className="text-error text-sm">{error}</p>}
    </SLModalShell>
  );
}
