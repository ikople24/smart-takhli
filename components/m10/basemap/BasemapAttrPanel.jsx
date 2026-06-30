import { useState } from "react";
import { formatAreaStr, sqmToParts } from "@/lib/m10-ingest/basemap/area";

const FIELDS = [
  { key: "parcelCode", label: "รหัสแปลง (PARCEL_COD)" },
  { key: "deedNo", label: "เลขโฉนด" },
  { key: "landNo", label: "เลขที่ดิน" },
  { key: "survey", label: "หน้าสำรวจ" },
  { key: "landType", label: "ประเภทที่ดิน" },
  { key: "zoneId", label: "Zone" },
  { key: "blockId", label: "Block" },
  { key: "lot", label: "Lot" },
];

export default function BasemapAttrPanel({
  mode, selected, form, setForm, areaSqm,
  onEdit, onDraw, onSave, onCancel, saving,
  onSearch, searchResults, onPickResult, searching,
}) {
  const [q, setQ] = useState("");
  const editing = mode === "edit" || mode === "draw";
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const areaParts = areaSqm != null ? sqmToParts(areaSqm) : null;

  return (
    <div className="w-80 shrink-0 h-full overflow-y-auto border-l bg-base-100 p-3 space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); onSearch(q); }} className="join w-full">
        <input className="input input-sm input-bordered join-item w-full" placeholder="ค้นหารหัสแปลง / โฉนด"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-sm join-item" type="submit">{searching ? "…" : "ค้นหา"}</button>
      </form>
      {searchResults?.length > 0 && (
        <ul className="menu menu-sm bg-base-200 rounded-box max-h-40 overflow-y-auto flex-nowrap">
          {searchResults.map((r) => (
            <li key={r.parcelCode}>
              <a onClick={() => onPickResult(r)}>{r.parcelCode}{r.deedNo ? ` · โฉนด ${r.deedNo}` : ""}</a>
            </li>
          ))}
        </ul>
      )}

      <div className="divider my-1" />

      {!selected && mode === "view" && (
        <p className="text-sm opacity-60">คลิกแปลงบนแผนที่เพื่อดู/แก้ หรือกด “วาดแปลงใหม่”</p>
      )}

      {(selected || editing) && (
        <>
          <div className="grid grid-cols-1 gap-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="text-xs block">
                <span className="opacity-60">{f.label}</span>
                <input className="input input-sm input-bordered w-full" disabled={!editing}
                  value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
              </label>
            ))}
          </div>
          {/* เนื้อที่ตามเอกสาร — แก้ได้ (ไม่อิงการคำนวณรูป) */}
          <div>
            <span className="text-xs opacity-60">เนื้อที่ตามเอกสาร (ไร่-งาน-วา)</span>
            <div className="flex gap-1">
              <input type="number" className="input input-sm input-bordered w-full" placeholder="ไร่" disabled={!editing}
                value={form.areaRai ?? ""} onChange={(e) => set("areaRai", e.target.value)} />
              <input type="number" className="input input-sm input-bordered w-full" placeholder="งาน" disabled={!editing}
                value={form.areaNgan ?? ""} onChange={(e) => set("areaNgan", e.target.value)} />
              <input type="number" step="0.01" className="input input-sm input-bordered w-full" placeholder="วา" disabled={!editing}
                value={form.areaWa ?? ""} onChange={(e) => set("areaWa", e.target.value)} />
            </div>
          </div>
          {areaParts && (
            <p className="text-[11px] opacity-50">
              พื้นที่จากรูป (อ้างอิง): {formatAreaStr(areaParts)} ≈ {areaParts.sqm} ตร.ม.
              {editing && (
                <button type="button" className="link link-primary ml-1"
                  onClick={() => setForm((f) => ({ ...f, areaRai: areaParts.rai, areaNgan: areaParts.ngan, areaWa: areaParts.wa }))}>
                  ใช้ค่านี้
                </button>
              )}
            </p>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        {mode === "view" && selected && <button className="btn btn-sm btn-primary" onClick={onEdit}>แก้ไข</button>}
        {mode === "view" && <button className="btn btn-sm" onClick={onDraw}>วาดแปลงใหม่</button>}
        {editing && <button className="btn btn-sm btn-success" onClick={onSave} disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึก"}</button>}
        {editing && <button className="btn btn-sm btn-ghost" onClick={onCancel} disabled={saving}>ยกเลิก</button>}
      </div>
    </div>
  );
}
