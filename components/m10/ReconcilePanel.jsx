import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";

const ReconcileMap = dynamic(() => import("./ReconcileMap"), { ssr: false });

const STATUS_BADGE = { matched: "badge-success", ambiguous: "badge-warning", unmatched: "badge-error", resolved: "badge-info" };
const FILTERS = ["", "ambiguous", "unmatched", "resolved", "matched"];

// record ที่ จนท. ต้องเปิดแผนที่จัดการ
const NEEDS_REVIEW = new Set(["ambiguous", "unmatched", "resolved"]);

export default function ReconcilePanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  // focus mode
  const [focusKey, setFocusKey] = useState(null);
  const [detail, setDetail] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({ deedNo: "", landNo: "", survey: "", rai: "", ngan: "", wa: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const url = filter ? `/api/m10-ingest/reconcile?status=${filter}` : "/api/m10-ingest/reconcile";
      const res = await fetch(url);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "โหลดข้อมูลล้มเหลว");
      setRows(d.rows);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const count = (s) => rows.filter((r) => r.status === s).length;

  async function openFocus(recordKey) {
    setError(""); setFocusKey(recordKey); setDetail(null); setSelectedId(null);
    try {
      const res = await fetch(`/api/m10-ingest/reconcile/${encodeURIComponent(recordKey)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "โหลดรายละเอียดไม่สำเร็จ");
      setDetail(d);
      const ov = d.record.reconcileOverride || {};
      const a = ov.area || d.record.area || {};
      setForm({
        deedNo: ov.deedNo ?? d.record.deedNo ?? "",
        landNo: ov.landNo ?? d.record.landNo ?? "",
        survey: ov.survey ?? d.record.survey ?? "",
        rai: a.rai ?? "", ngan: a.ngan ?? "", wa: a.wa ?? "",
      });
      // ถ้ามี override parcelCode เดิม → preselect candidate ที่ตรง
      const pre = d.candidates.find((c) => c.parcelCode === (ov.parcelCode ?? d.record.parcelCode));
      if (pre) setSelectedId(pre.basemapId);
    } catch (e) { setError(e.message); }
  }
  function closeFocus() { setFocusKey(null); setDetail(null); }

  async function save() {
    if (!detail) return;
    setSaving(true); setError("");
    const sel = detail.candidates.find((c) => c.basemapId === selectedId);
    const rai = Number(form.rai) || 0, ngan = Number(form.ngan) || 0, wa = Number(form.wa) || 0;
    const body = {
      parcelCode: sel ? sel.parcelCode : null,
      deedNo: form.deedNo || null, landNo: form.landNo || null, survey: form.survey || null,
      area: (form.rai !== "" || form.ngan !== "" || form.wa !== "")
        ? { rai, ngan, wa, sqm: (rai * 400 + ngan * 100 + wa) * 4 } : null,
    };
    try {
      const res = await fetch(`/api/m10-ingest/reconcile/${encodeURIComponent(focusKey)}/resolve`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      closeFocus(); await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  // ── Focus mode (map + edit) ──
  if (focusKey) {
    return (
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-bold">ตรวจรูปแปลง · <span className="font-mono text-sm">{focusKey}</span></h2>
          <button className="btn btn-ghost btn-sm" onClick={closeFocus}>← ย้อนกลับ</button>
        </div>
        {error && <div className="alert alert-error mb-3">{error}</div>}
        {!detail ? <span className="loading loading-spinner" /> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <ReconcileMap
                m10Geometry={detail.record.geometry}
                candidates={detail.candidates}
                nearby={detail.nearby}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
              <p className="text-xs opacity-60 mt-2">
                <span className="text-red-600 font-bold">▬</span> รูปแปลง ม.10 (ข้อมูลดิบ) ·
                <span className="text-blue-600 font-bold"> ▬</span> basemap candidate (คลิกเลือก) ·
                <span className="text-green-600 font-bold"> ▬</span> ที่เลือก ·
                <span className="text-gray-400 font-bold"> ▬</span> แปลงข้างเคียง
              </p>
            </div>
            <div className="space-y-3">
              <div className="bg-base-200 rounded p-3">
                <p className="text-sm font-semibold mb-2">เลือกแปลง basemap ที่ถูกต้อง</p>
                {detail.candidates.length === 0 && <p className="text-sm opacity-60">ไม่มี candidate (unmatched) — แก้ attribute แล้วเช็คใหม่</p>}
                {detail.candidates.map((c) => (
                  <label key={c.basemapId} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input type="radio" name="cand" className="radio radio-sm" checked={selectedId === c.basemapId} onChange={() => setSelectedId(c.basemapId)} />
                    <span className="font-mono">{c.parcelCode}</span>
                    <span className="text-xs opacity-60">โฉนด {c.deedNo || "-"} · ทับ {Math.round(c.overlapPct * 100)}%</span>
                  </label>
                ))}
              </div>
              <div className="bg-base-200 rounded p-3 space-y-2">
                <p className="text-sm font-semibold">แก้ข้อมูล (ถ้าต้อง)</p>
                {[["deedNo", "โฉนด"], ["landNo", "เลขที่ดิน"], ["survey", "หน้าสำรวจ"]].map(([k, label]) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="w-24 text-sm opacity-70">{label}</span>
                    <input className="input input-bordered input-sm flex-1" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <span className="w-24 text-sm opacity-70">เนื้อที่</span>
                  <input className="input input-bordered input-sm w-16" placeholder="ไร่" value={form.rai} onChange={(e) => setForm({ ...form, rai: e.target.value })} />
                  <input className="input input-bordered input-sm w-16" placeholder="งาน" value={form.ngan} onChange={(e) => setForm({ ...form, ngan: e.target.value })} />
                  <input className="input input-bordered input-sm w-16" placeholder="ว." value={form.wa} onChange={(e) => setForm({ ...form, wa: e.target.value })} />
                </div>
              </div>
              <button className="btn btn-primary w-full" disabled={saving} onClick={save}>
                {saving ? "กำลังบันทึก..." : "บันทึก & เช็คใหม่"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── List mode ──
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">จับคู่ basemap (Reconcile)</h2>
      {error && <div className="alert alert-error mb-3">{error}</div>}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map((s) => (
          <button key={s} className={`btn btn-sm ${filter === s ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(s)}>
            {s === "" ? "ทั้งหมด" : s}{s && ` (${count(s)})`}
          </button>
        ))}
      </div>
      {loading ? <span className="loading loading-spinner" /> : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead><tr><th>recordKey</th><th>โฉนด</th><th>ประเภท</th><th>สถานะ</th><th>วิธี</th><th>PARCEL_COD</th><th>candidates</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.recordKey}>
                  <td className="font-mono text-xs">{r.recordKey}</td>
                  <td>{r.deedNo || "-"}</td>
                  <td><span className="badge badge-sm">{r.changeType}</span></td>
                  <td><span className={`badge badge-sm ${STATUS_BADGE[r.status] || ""}`}>{r.status || "-"}</span></td>
                  <td className="text-xs">{r.method || "-"}</td>
                  <td className="font-mono">{r.parcelCode || "-"}</td>
                  <td className="text-xs">{r.candidates.map((c) => `${c.parcelCode}(${Math.round(c.overlapPct * 100)}%)`).join(", ") || "-"}</td>
                  <td>{NEEDS_REVIEW.has(r.status) && <button className="btn btn-xs btn-outline" onClick={() => openFocus(r.recordKey)}>เปิดแผนที่</button>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="text-center opacity-60">ไม่มีข้อมูล</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs opacity-60 mt-3">เปิดแผนที่เพื่อเทียบรูปแปลง ม.10 ↔ basemap, เลือกแปลงที่ถูก + แก้ข้อมูล (วาด vertex = เฟสถัดไป)</p>
    </div>
  );
}
