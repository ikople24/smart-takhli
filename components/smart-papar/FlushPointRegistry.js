// จัดการทะเบียนหัวโบล์ — แท็บ "ทะเบียนหัวโบล์" ในหน้าโบตะกอน (/admin/smart-papar/water-quality/flushing?tab=registry)
// เคยเป็นหน้าแยก แต่เจ้าของให้รวมเป็นแท็บในหน้าเดียว (2026-10-08) · สิทธิ์ตรวจที่หน้าแม่ + API
// เดสก์ท็อป: [รายการ | แผนที่ | ฟอร์ม] · มือถือ: แผนที่ + รายการ, ฟอร์มเป็นแผ่นเต็มจอ (ซ่อนระหว่างย้ายหมุดบนแผนที่)
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Swal from "sweetalert2";
import { Check, Move, Plus, Search, X } from "lucide-react";
import FlushPointEditor, { draftFromPoint } from "@/components/smart-papar/FlushPointEditor";
import { FLUSH_POINT_KIND_COLORS, FLUSH_POINT_KIND_LABELS, distanceM } from "@/lib/smart-papar/flushPoints";
import {
  FLUSH_POINT_ISSUE_LABELS,
  diffFlushPoint,
  flushPointIssues,
  nextFlushPointCode,
  validateFlushPointInput,
} from "@/lib/smart-papar/flushPointEdit";

const FlushPointAdminMap = dynamic(() => import("@/components/smart-papar/FlushPointAdminMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-pp-ground" />,
});

const FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "check", label: "ต้องตรวจข้อมูล" },
  { key: "inactive", label: "ปิดใช้งาน" },
];

export default function FlushPointRegistry() {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(null);
  const [moving, setMoving] = useState(false);
  const [moveBackup, setMoveBackup] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/smart-papar/flush-points?scope=admin");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "โหลดข้อมูลไม่สำเร็จ");
      setPoints(data.data);
    } catch (e) {
      setLoadError(e instanceof TypeError ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" : e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const original = useMemo(
    () => (selectedId ? points.find((p) => String(p._id) === selectedId) || null : null),
    [points, selectedId]
  );
  const editing = Boolean(draft);

  const isDirty = useCallback(() => {
    if (!draft) return false;
    if (creating) return true;
    const v = validateFlushPointInput(draft);
    return !v.ok || diffFlushPoint(original, v.value).length > 0;
  }, [draft, creating, original]);

  const confirmDiscard = async () => {
    if (!isDirty()) return true;
    const r = await Swal.fire({
      icon: "warning",
      title: "ทิ้งการแก้ไขที่ยังไม่บันทึก?",
      showCancelButton: true,
      confirmButtonText: "ทิ้ง",
      cancelButtonText: "กลับไปแก้ต่อ",
      confirmButtonColor: "#B42318",
    });
    return r.isConfirmed;
  };

  const closeEditor = () => {
    setSelectedId(null);
    setCreating(false);
    setDraft(null);
    setMoving(false);
    setMoveBackup(null);
    setErrors({});
  };

  const selectPoint = async (id) => {
    if (id === selectedId && !creating) return;
    if (!(await confirmDiscard())) return;
    const p = points.find((x) => String(x._id) === id);
    setCreating(false);
    setSelectedId(id);
    setDraft(draftFromPoint(p));
    setMoving(false);
    setErrors({});
  };

  const startCreate = async () => {
    if (!(await confirmDiscard())) return;
    setSelectedId(null);
    setCreating(true);
    setDraft({
      ...draftFromPoint(null),
      code: nextFlushPointCode(points.map((p) => p.code), "unknown"),
      codeAuto: true,
    });
    setErrors({});
    setMoveBackup({ lat: null, lng: null });
    setMoving(true); // หัวใหม่ยังไม่มีตำแหน่ง — เริ่มที่โหมดวางหมุดเลย
  };

  const cancelEditor = async () => {
    if (!(await confirmDiscard())) return;
    closeEditor();
  };

  const startMove = () => {
    setMoveBackup({ lat: draft.lat, lng: draft.lng });
    setMoving(true);
  };
  const cancelMove = () => {
    if (moveBackup) setDraft((d) => ({ ...d, lat: moveBackup.lat, lng: moveBackup.lng }));
    setMoving(false);
    setMoveBackup(null);
  };
  const confirmMove = () => {
    setMoving(false);
    setMoveBackup(null);
  };
  const onMove = (lat, lng) => setDraft((d) => ({ ...d, lat, lng }));

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const res = await fetch(creating ? "/api/smart-papar/flush-points" : `/api/smart-papar/flush-points/${selectedId}`, {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setErrors(data?.errors || { form: data?.message || "บันทึกไม่สำเร็จ" });
        return;
      }
      const saved = data.data;
      const id = String(saved._id);
      // อัปเดตรายการในหน้าเลย ไม่ต้องโหลดใหม่ทั้งทะเบียน (คง lastFlushedAt/flushCount เดิมไว้)
      setPoints((prev) => {
        const old = prev.find((p) => String(p._id) === id);
        const merged = { ...old, ...saved, lastFlushedAt: old?.lastFlushedAt ?? null, flushCount: old?.flushCount ?? 0 };
        return old ? prev.map((p) => (String(p._id) === id ? merged : p)) : [...prev, merged].sort((a, b) => a.code.localeCompare(b.code));
      });
      setCreating(false);
      setSelectedId(id);
      setDraft(draftFromPoint(saved));
      Swal.fire({
        icon: "success",
        title: creating ? "เพิ่มหัวโบล์แล้ว" : data.changed === false ? "ไม่มีอะไรเปลี่ยน" : "บันทึกแล้ว",
        timer: 1300,
        showConfirmButton: false,
      });
    } catch {
      setErrors({ form: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ข้อมูลยังอยู่ — ลองกดบันทึกอีกครั้ง" });
    } finally {
      setSaving(false);
    }
  };

  // ลบได้เฉพาะหัวที่ไม่มีบันทึกโบอ้าง — ถ้ามี API ตอบ 409 แล้วเสนอ "ปิดใช้งาน" แทน
  const [deleting, setDeleting] = useState(false);
  const removePoint = async () => {
    if (!original) return;
    const ok = await Swal.fire({
      icon: "warning",
      title: `ลบหัวโบล์ ${original.code}?`,
      text: "ลบแล้วกู้คืนไม่ได้ · หัวที่เคยมีบันทึกโบจะลบไม่ได้ (ให้ปิดใช้งานแทน)",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#B42318",
    });
    if (!ok.isConfirmed) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/smart-papar/flush-points/${original._id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (res.status === 409) {
        const off = await Swal.fire({
          icon: "info",
          title: "ลบไม่ได้",
          text: `${data?.message || "หัวนี้มีบันทึกโบอ้างอยู่"} — ต้องการปิดใช้งานหัวนี้แทนไหม?`,
          showCancelButton: true,
          confirmButtonText: "ปิดใช้งาน",
          cancelButtonText: "ไม่ทำ",
        });
        if (!off.isConfirmed) return;
        const r2 = await fetch(`/api/smart-papar/flush-points/${original._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: false }),
        });
        const d2 = await r2.json().catch(() => null);
        if (!r2.ok || !d2?.success) throw new Error(d2?.message || "ปิดใช้งานไม่สำเร็จ");
        setPoints((prev) => prev.map((p) => (String(p._id) === String(original._id) ? { ...p, ...d2.data } : p)));
        setDraft(draftFromPoint(d2.data));
        Swal.fire({ icon: "success", title: "ปิดใช้งานแล้ว", timer: 1300, showConfirmButton: false });
        return;
      }
      if (!res.ok || !data?.success) throw new Error(data?.message || "ลบไม่สำเร็จ");
      setPoints((prev) => prev.filter((p) => String(p._id) !== String(original._id)));
      closeEditor();
      Swal.fire({ icon: "success", title: `ลบ ${data.deleted} แล้ว`, timer: 1300, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: "error", title: e instanceof TypeError ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" : e.message });
    } finally {
      setDeleting(false);
    }
  };

  const counts = useMemo(
    () => ({
      all: points.length,
      check: points.filter((p) => p.active !== false && flushPointIssues(p).length > 0).length,
      inactive: points.filter((p) => p.active === false).length,
    }),
    [points]
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return points.filter((p) => {
      if (filter === "check" && (p.active === false || flushPointIssues(p).length === 0)) return false;
      if (filter === "inactive" && p.active !== false) return false;
      if (kindFilter && p.kind !== kindFilter) return false;
      if (!q) return true;
      return [p.code, p.name, p.roadName].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [points, query, filter, kindFilter]);

  // หัวที่กำลังแก้ใช้ตำแหน่งจาก draft — แผนที่จึงเห็นหมุดที่ย้ายแล้วทันที
  const draftLatLng = draft && draft.lat != null && draft.lng != null ? [draft.lat, draft.lng] : null;
  const originalLatLng = original?.location?.coordinates
    ? [original.location.coordinates[1], original.location.coordinates[0]]
    : null;
  const movedM =
    draftLatLng && (moveBackup?.lat != null)
      ? Math.round(distanceM(moveBackup.lat, moveBackup.lng, draftLatLng[0], draftLatLng[1]))
      : null;

  return (
    <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px] text-pp-muted">
              {loading ? "กำลังโหลด…" : `${counts.all} หัว`} · แก้ไขตำแหน่ง ชื่อจุด ถนน/ซอย และประเภทได้ที่นี่
            </p>
            <button
              type="button"
              onClick={startCreate}
              className="flex h-11 items-center gap-2 rounded-xl bg-pp-water px-4 font-semibold text-white hover:bg-pp-deep"
            >
              <Plus size={18} strokeWidth={2.4} aria-hidden />
              เพิ่มหัวโบล์
            </button>
          </div>

          {loadError ? (
            <div className="rounded-2xl bg-white p-4 text-pp-danger">
              {loadError}{" "}
              <button type="button" onClick={load} className="font-semibold underline">
                ลองใหม่
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)_400px]">
              {/* รายการ */}
              <section
                aria-label="รายการหัวโบล์"
                className="order-2 flex min-h-0 flex-col gap-2.5 rounded-2xl bg-white p-3.5 lg:order-1 lg:h-[calc(100dvh-190px)] lg:min-h-[560px]"
              >
                <label className="flex h-11 items-center gap-2 rounded-xl bg-pp-ground px-3 text-pp-muted">
                  <Search size={18} aria-hidden />
                  <span className="sr-only">ค้นหา</span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="รหัส / ชื่อจุด / ถนน"
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-pp-ink outline-none"
                  />
                </label>
                <div role="group" aria-label="ตัวกรอง" className="flex flex-wrap gap-1.5">
                  {FILTERS.map((f) => {
                    const on = filter === f.key;
                    const warn = f.key === "check";
                    return (
                      <button
                        key={f.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setFilter(f.key)}
                        className={`h-9 rounded-full border-[1.5px] px-3 text-[13px] ${
                          on
                            ? warn
                              ? "border-pp-turbid-ink bg-pp-turbid-wash font-semibold text-pp-turbid-ink"
                              : "border-pp-ink font-semibold"
                            : "border-pp-line"
                        }`}
                      >
                        {f.label} {!loading && <span className="tabular-nums">{counts[f.key]}</span>}
                      </button>
                    );
                  })}
                  <label className="sr-only" htmlFor="fp-kind-filter">
                    กรองตามประเภท
                  </label>
                  <select
                    id="fp-kind-filter"
                    value={kindFilter}
                    onChange={(e) => setKindFilter(e.target.value)}
                    className="h-9 rounded-full border-[1.5px] border-pp-line bg-white px-2.5 text-[13px]"
                  >
                    <option value="">ทุกประเภท</option>
                    {Object.entries(FLUSH_POINT_KIND_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                {filter === "check" && (
                  <p className="text-xs leading-relaxed text-pp-muted">
                    ต้องตรวจ = ยังไม่มีชื่อจุด · ยังไม่ระบุถนน/ซอย · ชนิดไม่ระบุ
                  </p>
                )}
                <div className="-mx-1 max-h-[50vh] flex-1 overflow-y-auto px-1 lg:max-h-none">
                  {loading ? (
                    <div className="py-10 text-center text-pp-muted">กำลังโหลด…</div>
                  ) : shown.length === 0 ? (
                    <div className="py-10 text-center text-sm text-pp-muted">ไม่พบหัวโบล์ที่ตรงเงื่อนไข</div>
                  ) : (
                    <ul className="space-y-1">
                      {shown.map((p) => {
                        const id = String(p._id);
                        const on = id === selectedId;
                        const issues = flushPointIssues(p);
                        return (
                          <li key={id}>
                            <button
                              type="button"
                              aria-current={on || undefined}
                              onClick={() => selectPoint(id)}
                              className={`flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left ${
                                on ? "bg-pp-tint-2 ring-2 ring-pp-water" : "hover:bg-pp-ground"
                              } ${p.active === false ? "opacity-60" : ""}`}
                            >
                              <span
                                className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full"
                                style={
                                  p.kind === "unknown"
                                    ? { border: `2px solid ${FLUSH_POINT_KIND_COLORS.unknown}` }
                                    : { background: FLUSH_POINT_KIND_COLORS[p.kind] || FLUSH_POINT_KIND_COLORS.unknown }
                                }
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block font-tk-mono text-sm">
                                  {p.code}
                                  {on && <span className="ml-1 font-sans text-xs font-semibold text-pp-water">· กำลังแก้ไข</span>}
                                  {p.active === false && <span className="ml-1 font-sans text-xs text-pp-muted">· ปิดใช้งาน</span>}
                                </span>
                                <span className="block truncate text-[13px] text-pp-muted">{p.name || "—"}</span>
                                {issues.length > 0 ? (
                                  <span className="block text-xs text-pp-turbid-ink">
                                    {issues.map((i) => FLUSH_POINT_ISSUE_LABELS[i]).join(" · ")}
                                  </span>
                                ) : (
                                  <span className="block truncate text-xs text-pp-muted">{p.roadName}</span>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>

              {/* แผนที่ */}
              <section
                aria-label="แผนที่หัวโบล์"
                className="relative order-1 h-[45vh] min-h-[320px] overflow-hidden rounded-2xl bg-white lg:order-2 lg:h-[calc(100dvh-190px)] lg:min-h-[560px]"
              >
                <FlushPointAdminMap
                  points={points}
                  selectedId={selectedId}
                  onSelect={selectPoint}
                  moving={moving}
                  draftLatLng={draftLatLng}
                  originalLatLng={originalLatLng}
                  draftKind={draft?.kind}
                  onMove={onMove}
                  className="h-full w-full"
                />
                {moving && (
                  <>
                    <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex justify-center">
                      <div className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lg">
                        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-pp-tint text-pp-water">
                          <Move size={20} aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-tk-sans font-bold">
                            {creating ? "วางหมุดหัวโบล์ใหม่" : `กำลังย้ายหมุด ${original?.code || ""}`}
                          </span>
                          <span className="block text-[13px] text-pp-muted">
                            {draftLatLng ? "ลากหมุด" : "แตะบนแผนที่เพื่อวางหมุด"} · สลับเป็นภาพดาวเทียมมุมขวาบนเพื่อดูฝาหัวโบล์
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="absolute inset-x-3 bottom-3 z-[500] flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lg">
                      <div className="min-w-0 flex-1 text-sm">
                        {draftLatLng ? (
                          <>
                            <span className="block font-tk-mono">
                              {draftLatLng[0].toFixed(6)}, {draftLatLng[1].toFixed(6)}
                            </span>
                            {movedM != null && <span className="block text-[13px] text-pp-clear-ink">ย้ายจากเดิม {movedM} ม.</span>}
                          </>
                        ) : (
                          <span className="text-pp-muted">ยังไม่ได้วางหมุด</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={creating && moveBackup?.lat == null && !draftLatLng ? cancelEditor : cancelMove}
                        className="flex h-11 items-center gap-1.5 rounded-xl border-[1.5px] border-pp-line-2 px-4 font-semibold"
                      >
                        <X size={18} aria-hidden />
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        onClick={confirmMove}
                        disabled={!draftLatLng}
                        className="flex h-11 items-center gap-1.5 rounded-xl bg-pp-water px-4 font-semibold text-white disabled:bg-pp-water/40"
                      >
                        <Check size={18} strokeWidth={2.6} aria-hidden />
                        ใช้ตำแหน่งนี้
                      </button>
                    </div>
                  </>
                )}
              </section>

              {/* ฟอร์ม — เดสก์ท็อปเป็นคอลัมน์ขวา, มือถือเป็นแผ่นเต็มจอ (ซ่อนตอนย้ายหมุดให้เห็นแผนที่) */}
              <section
                aria-label="แก้ไขหัวโบล์"
                className={`order-3 lg:block ${
                  editing && !moving ? "fixed inset-0 z-[1000] lg:static lg:z-auto" : "hidden"
                } overflow-hidden lg:h-[calc(100dvh-190px)] lg:min-h-[560px] lg:rounded-2xl`}
              >
                {editing ? (
                  <FlushPointEditor
                    key={creating ? "new" : selectedId}
                    draft={draft}
                    setDraft={setDraft}
                    original={creating ? null : original}
                    points={points}
                    errors={errors}
                    saving={saving}
                    moving={moving}
                    onStartMove={startMove}
                    onCancel={cancelEditor}
                    onSave={save}
                    onDelete={removePoint}
                    deleting={deleting}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 bg-white p-6 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-pp-tint text-pp-water">
                      <Move size={22} aria-hidden />
                    </span>
                    <div className="font-semibold">เลือกหัวโบล์เพื่อแก้ไข</div>
                    <p className="text-sm text-pp-muted">คลิกหมุดบนแผนที่ หรือเลือกจากรายการทางซ้าย</p>
                  </div>
                )}
              </section>
            </div>
          )}
    </div>
  );
}
