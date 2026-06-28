import { useEffect, useState, useCallback } from "react";

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* ignore */ }
  }
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-48 text-sm text-base-content/60 shrink-0">{label}</span>
      <span className="font-medium flex-1 break-all">{value || <span className="opacity-40">—</span>}</span>
      {value && (
        <button className="btn btn-xs" onClick={copy}>{copied ? "คัดลอกแล้ว" : "คัดลอก"}</button>
      )}
    </div>
  );
}

export default function WorklistPanel() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queue, setQueue] = useState(null); // string[] of txn ids in focus session
  const [pos, setPos] = useState(0);
  const [item, setItem] = useState(null);   // current WorklistItem
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/m10-ingest/worklist");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "โหลดข้อมูลล้มเหลว");
      setItems(d.items); setSelected(new Set());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadItem = useCallback(async (id) => {
    setError(""); setNote("");
    const res = await fetch(`/api/m10-ingest/worklist/${id}`);
    const d = await res.json();
    if (!res.ok) { setError(d.error || "โหลดรายการไม่สำเร็จ"); return; }
    setItem(d);
  }, []);

  function toggle(id) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function start() {
    const ids = items.filter((i) => selected.has(i._id)).map((i) => i._id);
    if (ids.length === 0) return;
    setQueue(ids); setPos(0); loadItem(ids[0]);
  }
  async function advance(action) {
    const id = queue[pos];
    await fetch(`/api/m10-ingest/worklist/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const next = pos + 1;
    if (next >= queue.length) { setQueue(null); setItem(null); await load(); return; }
    setPos(next); loadItem(queue[next]);
  }

  // ── Focus mode ──
  if (queue && item) {
    return (
      <div className="max-w-2xl">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-bold">คีย์เข้า LTAX</h2>
          <span className="badge badge-neutral">{pos + 1}/{queue.length}</span>
        </div>
        {error && <div className="alert alert-error mb-3">{error}</div>}
        <div className="card bg-base-100 shadow p-4 space-y-3">
          <div className="flex gap-2 items-center">
            <span className="badge badge-primary">{item.changeType}</span>
            <span className="text-sm">recordKey <span className="font-mono">{item.recordKey}</span></span>
          </div>
          <div className="bg-base-200 rounded p-3">
            <p className="text-sm font-semibold mb-1">ค้นหาใน LTAX ด้วย:</p>
            <CopyField label="เลขโฉนด" value={item.search.deedNo || ""} />
            <CopyField label="หรือชื่อเจ้าของเดิม" value={item.search.oldOwnerName || ""} />
          </div>
          <div className="divider my-1" />
          {item.steps.map((s, i) => (
            s.copyable
              ? <CopyField key={i} label={s.label} value={s.value} />
              : <p key={i} className="text-sm font-semibold mt-2">{s.label}</p>
          ))}
          <div className="divider my-1" />
          <input className="input input-bordered input-sm w-full" placeholder="หมายเหตุ (ใส่เมื่อข้าม)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn btn-success flex-1" onClick={() => advance("keyed")}>คีย์แล้ว ✓ ถัดไป</button>
            <button className="btn btn-ghost" onClick={() => advance("skip")}>ข้าม</button>
          </div>
        </div>
      </div>
    );
  }

  // ── List mode ──
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Worklist → LTAX (ค้างคีย์ {items.length})</h2>
        <button className="btn btn-primary" disabled={selected.size === 0} onClick={start}>
          เริ่มคีย์ ({selected.size})
        </button>
      </div>
      {error && <div className="alert alert-error mb-3">{error}</div>}
      {loading ? <span className="loading loading-spinner" /> : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead><tr><th></th><th>วันที่</th><th>ประเภท</th><th>โฉนด</th><th>recordKey</th><th>เจ้าของใหม่</th></tr></thead>
            <tbody>
              {items.map((t) => (
                <tr key={t._id}>
                  <td><input type="checkbox" className="checkbox checkbox-sm" checked={selected.has(t._id)} onChange={() => toggle(t._id)} /></td>
                  <td>{String(t.txnDate).slice(0, 10)}</td>
                  <td><span className="badge">{t.changeType}</span></td>
                  <td>{t.deedNo || "-"}</td>
                  <td className="font-mono text-xs">{t.recordKey}</td>
                  <td>{t.ownerFullName}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="text-center opacity-60">ไม่มีรายการค้างคีย์</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
