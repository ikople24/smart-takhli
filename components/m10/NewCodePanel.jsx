import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";

const ReconcileMap = dynamic(() => import("./ReconcileMap"), { ssr: false });

const CONF_BADGE = { high: "badge-success", medium: "badge-warning", low: "badge-ghost" };

export default function NewCodePanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [focusKey, setFocusKey] = useState(null);
  const [detail, setDetail] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/m10-ingest/newcode");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "โหลดข้อมูลล้มเหลว");
      setRows(d.rows);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function openFocus(recordKey) {
    setError(""); setFocusKey(recordKey); setDetail(null); setSelectedId(null);
    try {
      const res = await fetch(`/api/m10-ingest/newcode/${encodeURIComponent(recordKey)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "โหลดรายละเอียดไม่สำเร็จ");
      setDetail(d);
      setCode(d.record.parcelCode || d.suggestion.suggestedCode || "");
    } catch (e) { setError(e.message); }
  }
  function closeFocus() { setFocusKey(null); setDetail(null); }

  async function confirm() {
    if (!code.trim()) { setError("ต้องระบุรหัสแปลง"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/m10-ingest/newcode/${encodeURIComponent(focusKey)}/confirm`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcelCode: code.trim(), deedNo: detail.record.deedNo, landNo: detail.record.landNo, survey: detail.record.survey, area: detail.record.area }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      closeFocus(); await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (focusKey) {
    return (
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-bold">แนะรหัสแปลง · <span className="font-mono text-sm">{focusKey}</span></h2>
          <button className="btn btn-ghost btn-sm" onClick={closeFocus}>← ย้อนกลับ</button>
        </div>
        {error && <div className="alert alert-error mb-3">{error}</div>}
        {!detail ? <span className="loading loading-spinner" /> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <ReconcileMap m10Geometry={detail.record.geometry} candidates={detail.candidates} nearby={detail.nearby} selectedId={selectedId} onSelect={setSelectedId} />
              <p className="text-xs opacity-60 mt-2">
                <span className="text-red-600 font-bold">▬</span> รูปแปลง ม.10 ·
                <span className="text-blue-600 font-bold"> ▬</span> basemap ที่ทับ (คลิกเลือก)
              </p>
            </div>
            <div className="space-y-3">
              <div className="bg-base-200 rounded p-3 space-y-1 text-sm">
                <div>ประเภท: <span className="badge badge-sm">{detail.record.changeType}</span> · โฉนด {detail.record.deedNo || "-"}</div>
                <div>วิธีแนะ: <b>{detail.suggestion.method}</b> · ความมั่นใจ: <span className={`badge badge-xs ${CONF_BADGE[detail.suggestion.confidence] || ""}`}>{detail.suggestion.confidence}</span></div>
                {detail.suggestion.parent && <div>แปลงแม่: <span className="font-mono">{detail.suggestion.parent}</span></div>}
              </div>
              {detail.suggestion.warnings?.map((w, i) => (
                <div key={i} className="alert alert-warning text-sm py-2">⚠ {w}</div>
              ))}
              <div className="bg-base-200 rounded p-3 space-y-2">
                <p className="text-sm font-semibold">รหัสแปลง (PARCEL_COD)</p>
                <input className="input input-bordered input-sm w-full font-mono" placeholder="เช่น 02B121 หรือ 01A001/001"
                  value={code} onChange={(e) => setCode(e.target.value)} />
                <p className="text-xs opacity-60">ยืนยันแล้วจะสร้างแปลงใน basemap ด้วยรูปจาก ม.10 + record เข้าคิวคีย์ LTAX (ปรับรูปละเอียดที่หน้า “แก้รูปแปลง (basemap)” ทีหลัง)</p>
              </div>
              <button className="btn btn-primary w-full" disabled={saving} onClick={confirm}>
                {saving ? "กำลังบันทึก..." : "ยืนยันรหัส & เข้า worklist"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">รหัสแปลงใหม่ (SPLIT / MERGE / NEW)</h2>
      {error && <div className="alert alert-error mb-3">{error}</div>}
      {loading ? <span className="loading loading-spinner" /> : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead><tr><th>recordKey</th><th>โฉนด</th><th>ประเภท</th><th>รหัสที่แนะ</th><th>วิธี</th><th>มั่นใจ</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.recordKey}>
                  <td className="font-mono text-xs">{r.recordKey}</td>
                  <td>{r.deedNo || "-"}</td>
                  <td><span className="badge badge-sm">{r.changeType}</span></td>
                  <td className="font-mono">{r.suggestedCode || "—"}</td>
                  <td className="text-xs">{r.method}</td>
                  <td><span className={`badge badge-xs ${CONF_BADGE[r.confidence] || ""}`}>{r.confidence}</span></td>
                  <td>{r.resolved ? <span className="badge badge-info badge-sm">ยืนยันแล้ว</span> : <span className="badge badge-ghost badge-sm">รอ</span>}</td>
                  <td><button className="btn btn-xs btn-outline" onClick={() => openFocus(r.recordKey)}>เปิด</button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="text-center opacity-60">ไม่มีรายการ</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs opacity-60 mt-3">เอนจินแนะรหัสจากรูปแปลง + basemap + โฉนด — ตรวจก่อนยืนยันทุกครั้ง (ข้อมูลไม่มี key ลิงก์แปลงพี่น้อง)</p>
    </div>
  );
}
