// components/superadmin/BulkGrantModal.jsx
// ให้/ถอนสิทธิ์ 1 หน้าแก่ user หลายคนพร้อมกัน (แทน script ตระกูล scripts/grant-*)
// props:
//   users    OverviewUser[] เฉพาะ status=active (index.jsx กรองมาแล้ว)
//   onClose()  onDone() — เรียกหลังบันทึกสำเร็จ (ให้ parent refetch)
// server ป้องกันเองอีกชั้น: ข้าม user ที่ใช้ default (skippedDefault) และ
// revoke ที่จะทำลิสต์ว่าง (skippedWouldEmpty — ลิสต์ว่าง = เด้งกลับไป default อาจได้สิทธิ์เพิ่ม)
import { useState } from "react";
import Swal from "sweetalert2";
import { X } from "lucide-react";
import { ALL_PAGES } from "@/lib/permissions";

export default function BulkGrantModal({ users, onClose, onDone }) {
  const [pagePath, setPagePath] = useState("");
  const [mode, setMode] = useState("grant");
  const [checked, setChecked] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const eligible = users.filter((u) => u.allowedPages.length > 0);
  const usingDefault = users.filter((u) => u.allowedPages.length === 0);

  const toggle = (id) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    if (mode === "revoke") {
      const pageLabel = ALL_PAGES.find((p) => p.path === pagePath)?.label || pagePath;
      const c = await Swal.fire({
        icon: "warning",
        title: "ยืนยันถอนสิทธิ์?",
        text: `ถอน "${pageLabel}" จาก ${checked.size} คน`,
        showCancelButton: true,
        confirmButtonText: "ถอนสิทธิ์",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#dc2626",
      });
      if (!c.isConfirmed) return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/permissions/bulk-grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagePath, mode, userIds: [...checked] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      const skippedNote = [
        data.skippedDefault?.length ? `ข้าม ${data.skippedDefault.length} คน (ใช้ค่า default)` : "",
        data.skippedWouldEmpty?.length ? `ข้าม ${data.skippedWouldEmpty.length} คน (ถอนแล้วจะเหลือ 0 หน้า — แก้รายคนแทน)` : "",
      ].filter(Boolean).join(" · ");
      const diffNote =
        data.applied !== data.modified
          ? ` จากที่ส่งไป ${data.applied} คน (ที่เหลือมี/ไม่มีสิทธิ์นี้อยู่แล้ว)`
          : "";
      await Swal.fire({
        icon: data.modified > 0 ? "success" : "info",
        title:
          data.applied > 0
            ? mode === "grant" ? "ให้สิทธิ์แล้ว" : "ถอนสิทธิ์แล้ว"
            : "ไม่มีการเปลี่ยนแปลง",
        text: `เปลี่ยนจริง ${data.modified} คน${diffNote}${skippedNote ? ` · ${skippedNote}` : ""}`,
        timer: data.modified > 0 && !skippedNote && !diffNote ? 2000 : undefined,
        showConfirmButton: !(data.modified > 0 && !skippedNote && !diffNote),
      });
      onDone();
    } catch (e) {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={saving ? undefined : onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">ให้สิทธิ์เป็นชุด</h3>
          <button type="button" aria-label="ปิด" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="flex gap-2">
            <select value={pagePath} onChange={(e) => setPagePath(e.target.value)}
              className="select select-sm select-bordered flex-1">
              <option value="">— เลือกหน้า —</option>
              {ALL_PAGES.map((p) => (
                <option key={p.path} value={p.path}>{p.icon} {p.label}</option>
              ))}
            </select>
            <select value={mode}
              onChange={(e) => { setMode(e.target.value); setChecked(new Set()); }}
              className="select select-sm select-bordered">
              <option value="grant">ให้สิทธิ์</option>
              <option value="revoke">ถอนสิทธิ์</option>
            </select>
          </div>

          {mode === "revoke" && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              คนที่ถอนแล้วจะเหลือ 0 หน้า ระบบจะ<strong>ข้าม</strong>ให้อัตโนมัติ
              (ลิสต์ว่าง = กลับไปใช้ค่า default ของ role ซึ่งอาจได้สิทธิ์เพิ่ม) — แก้รายคนแทน
            </p>
          )}

          <div className="space-y-1">
            {eligible.map((u) => (
              <label key={u.mongoId} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" className="checkbox checkbox-sm"
                  checked={checked.has(u.mongoId)} onChange={() => toggle(u.mongoId)} />
                <span className="text-sm text-slate-700">{u.name}</span>
                <span className="text-xs text-slate-400">{u.allowedPages.length} หน้า</span>
                {mode === "revoke" && pagePath && !u.allowedPages.includes(pagePath) && (
                  <span className="text-xs text-slate-400">· ไม่มีสิทธิ์นี้อยู่แล้ว</span>
                )}
                {mode === "revoke" && pagePath &&
                  u.allowedPages.includes(pagePath) &&
                  u.allowedPages.filter((p) => p !== pagePath).length === 0 && (
                  <span className="text-xs text-amber-600">· ถอนแล้วจะเหลือ 0 หน้า — จะถูกข้าม</span>
                )}
              </label>
            ))}
          </div>

          {usingDefault.length > 0 && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs text-slate-500 mb-1">
                ใช้ค่า default อยู่ — เลือกไม่ได้ (การเติมหน้าเดียวจะทำให้ชุด default หายทั้งชุด
                ถ้าต้องการกำหนดให้กางแก้รายคนก่อน):
              </p>
              <p className="text-xs text-slate-400">{usingDefault.map((u) => u.name).join(", ")}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-sm btn-ghost">ยกเลิก</button>
          <button onClick={submit} disabled={saving || !pagePath || checked.size === 0}
            className="btn btn-sm bg-slate-800 hover:bg-slate-900 text-white border-0">
            {saving ? <span className="loading loading-spinner loading-sm" /> : `บันทึก (${checked.size} คน)`}
          </button>
        </div>
      </div>
    </div>
  );
}
