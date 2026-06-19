import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import Swal from "sweetalert2";

function getBangkokYMD(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date);
}

function utcMsFromYMD(ymd) {
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  return Date.UTC(y, m - 1, d);
}

function canEditYmd(ymd, maxDays = 7) {
  const today = getBangkokYMD(new Date());
  const diffDays = Math.floor((utcMsFromYMD(today) - utcMsFromYMD(ymd)) / 86400000);
  return diffDays >= 0 && diffDays <= maxDays;
}

const TH_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

function formatThaiDate(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""))) return "";
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  const by = y + 543;
  return `${d} ${TH_MONTHS[m - 1]} ${by}`;
}

function addDaysYMD(ymd, deltaDays) {
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  const baseUtc = Date.UTC(y, m - 1, d);
  const dt = new Date(baseUtc + deltaDays * 86400000);
  return getBangkokYMD(dt);
}

const emptyForm = (recordDate) => ({
  recordDate,
  raw: { turbidityNtu: "", ph: "", tdsMgL: "" },
  tap: { turbidityNtu: "", ph: "", tdsMgL: "", freeChlorineSourceMgL: "", freeChlorineEndMgL: "" },
  note: "",
});

function toNumberOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDecimal2OrNull(v) {
  const n = toNumberOrNull(v);
  if (n === null) return null;
  return Math.round(n * 100) / 100;
}

function toIntOrNull(v) {
  const n = toNumberOrNull(v);
  if (n === null) return null;
  return Math.trunc(n);
}

function clamp0toMaxOrNull(v, max) {
  const n = toNumberOrNull(v);
  if (n === null) return null;
  return Math.min(max, Math.max(0, n));
}

function formatDecimal2Input(v) {
  if (v === "" || v === null || v === undefined) return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(2);
}

function ymdToDmy(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""))) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

function ymdToThaiDmyBE(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""))) return "";
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`;
}

function format2(v) {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(2);
}

function formatInt(v) {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return String(Math.trunc(n));
}

function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampNumStrTo100(valueStr) {
  if (valueStr === "") return "";
  const n = Number(valueStr);
  if (!Number.isFinite(n)) return "";
  const clamped = Math.min(100, Math.max(0, n));
  // เก็บเป็น string แบบเดิม (ไม่บังคับ fixed ที่นี่ เพื่อไม่รบกวนการพิมพ์)
  return String(clamped);
}

function clampNumStrToMax(valueStr, max) {
  if (valueStr === "") return "";
  const n = Number(valueStr);
  if (!Number.isFinite(n)) return "";
  const clamped = Math.min(max, Math.max(0, n));
  return String(clamped);
}

function normalizeDecimalCandidate(raw) {
  const s = String(raw ?? "").trim().replace(",", ".");
  if (s === "") return "";
  if (s === ".") return "0.";
  if (s.startsWith(".")) return `0${s}`;
  // allow only one dot
  if ((s.match(/\./g) || []).length > 1) return null;
  return s;
}

function clampDecimalInputString(raw, max) {
  const s = normalizeDecimalCandidate(raw);
  if (s === null) return null;
  if (s === "") return "";

  // preserve trailing dot while typing (e.g. "7.")
  if (s.endsWith(".")) {
    const head = s.slice(0, -1);
    if (head === "") return "0.";
    const n = Number(head);
    if (!Number.isFinite(n)) return null;
    if (n > max) return String(max);
    return s;
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n > max) return String(max);
  if (n < 0) return "0";
  return s;
}

function allowDecimal2Input(next) {
  // อนุญาต: "", "1", "1.", "1.2", "1.23"
  return next === "" || /^\d{0,3}(\.\d{0,2})?$/.test(next);
}

function allowIntInput(next) {
  return next === "" || /^\d{0,3}$/.test(next);
}

function normalizePayload(form) {
  return {
    recordDate: form.recordDate,
    raw: {
      // รองรับค่าผิดปกติ (เช่น 106) → allow ถึง 999
      turbidityNtu: toDecimal2OrNull(clamp0toMaxOrNull(form.raw.turbidityNtu, 999)),
      // pH ตามแบบฟอร์ม 0-14
      ph: toDecimal2OrNull(clamp0toMaxOrNull(form.raw.ph, 14)),
      // TDS ตามแบบฟอร์ม < 500 (ให้กรอกได้ถึง 500 เพื่อรองรับกรณีเท่ากับ)
      tdsMgL: toIntOrNull(clamp0toMaxOrNull(form.raw.tdsMgL, 500)),
    },
    tap: {
      turbidityNtu: toDecimal2OrNull(clamp0toMaxOrNull(form.tap.turbidityNtu, 999)),
      // pH ตามแบบฟอร์ม 0-14
      ph: toDecimal2OrNull(clamp0toMaxOrNull(form.tap.ph, 14)),
      // TDS ตามแบบฟอร์ม < 500
      tdsMgL: toIntOrNull(clamp0toMaxOrNull(form.tap.tdsMgL, 500)),
      // คลอรีนอิสระ โดยทั่วไปไม่สูงมาก ให้กรอกได้ถึง 10
      freeChlorineSourceMgL: toDecimal2OrNull(clamp0toMaxOrNull(form.tap.freeChlorineSourceMgL, 10)),
      freeChlorineEndMgL: toDecimal2OrNull(clamp0toMaxOrNull(form.tap.freeChlorineEndMgL, 10)),
    },
    note: form.note || "",
  };
}

export default function SmartPaparWaterQualityPage() {
  const today = useMemo(() => getBangkokYMD(new Date()), []);
  const minDate = useMemo(() => addDaysYMD(today, -7), [today]);
  const rawNtuRef = useRef(null);
  const tapChlorineSourceRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);

  const [form, setForm] = useState(() => emptyForm(today));
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const canEditSelected = useMemo(() => canEditYmd(form.recordDate, 7), [form.recordDate]);
  const latest = useMemo(() => (Array.isArray(items) && items.length > 0 ? items[0] : null), [items]);

  const fetchItems = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/smart-papar/water-quality?limit=60");
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "โหลดข้อมูลไม่สำเร็จ");
      setItems(data.data || []);
    } catch (e) {
      setError(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncFromSheet = async () => {
    try {
      setSyncing(true);
      setError("");
      Swal.fire({
        title: "กำลังซิ้งจาก Google Sheet...",
        text: "โปรดรอสักครู่",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 20000);
      const res = await fetch("/api/smart-papar/water-quality/sync-sheet?maxRows=500", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
      }).finally(() => clearTimeout(t));
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "ซิ้งไม่สำเร็จ");

      const s = data.stats || {};
      Swal.close();
      await Swal.fire({
        icon: "success",
        title: "ซิ้งสำเร็จ",
        html: `
          <div style="text-align:left">
            <div>ประมวลผล: <b>${s.processed ?? 0}</b> วัน</div>
            <div>เพิ่มใหม่: <b>${s.inserted ?? 0}</b> วัน</div>
            <div>อัปเดต: <b>${s.updated ?? 0}</b> วัน</div>
            <div>ข้าม/ผิดพลาด: <b>${s.skipped ?? 0}</b> วัน</div>
          </div>
        `,
        confirmButtonText: "ตกลง",
      });

      await fetchItems();
    } catch (e) {
      Swal.close();
      await Swal.fire({
        icon: "error",
        title: "ซิ้งไม่สำเร็จ",
        text: e.message || "เกิดข้อผิดพลาด",
        confirmButtonText: "ตกลง",
      });
    } finally {
      Swal.close();
      setSyncing(false);
    }
  };

  const startCreateToday = () => {
    setEditingId(null);
    setForm(emptyForm(today));
    setError("");
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setForm({
      recordDate: item.recordDate,
      raw: {
        turbidityNtu: item.raw?.turbidityNtu ?? "",
        ph: item.raw?.ph ?? "",
        tdsMgL: item.raw?.tdsMgL ?? "",
      },
      tap: {
        turbidityNtu: item.tap?.turbidityNtu ?? "",
        ph: item.tap?.ph ?? "",
        tdsMgL: item.tap?.tdsMgL ?? "",
        freeChlorineSourceMgL: item.tap?.freeChlorineSourceMgL ?? "",
        freeChlorineEndMgL: item.tap?.freeChlorineEndMgL ?? "",
      },
      note: item.note || "",
    });
    setError("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!canEditSelected) {
      setError("แก้ไขย้อนหลังได้ไม่เกิน 7 วัน");
      return;
    }

    // Required fields (ตามที่ระบุ: NTU น้ำดิบ + NTU น้ำจ่ายออก)
    if (!String(form.raw?.turbidityNtu ?? "").trim()) {
      await Swal.fire({
        icon: "warning",
        title: "ข้อมูลไม่ครบ",
        text: "กรุณากรอกค่า “น้ำดิบ: ความขุ่น (NTU)”",
        confirmButtonText: "ตกลง",
      });
      rawNtuRef.current?.focus?.();
      return;
    }

    if (!String(form.tap?.freeChlorineSourceMgL ?? "").trim()) {
      await Swal.fire({
        icon: "warning",
        title: "ข้อมูลไม่ครบ",
        text: "กรุณากรอกค่า “น้ำประปา: คลอรีนอิสระ ต้นทาง (mg/L)”",
        confirmButtonText: "ตกลง",
      });
      tapChlorineSourceRef.current?.focus?.();
      return;
    }

    try {
      setSaving(true);
      const payload = normalizePayload(form);

      const res = await fetch(
        editingId ? `/api/smart-papar/water-quality/${editingId}` : "/api/smart-papar/water-quality",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "บันทึกไม่สำเร็จ");

      await fetchItems();
      await Swal.fire({
        icon: "success",
        title: "บันทึกสำเร็จ",
        text: editingId ? "อัปเดตข้อมูลเรียบร้อยแล้ว" : "เพิ่มข้อมูลเรียบร้อยแล้ว",
        timer: 1500,
        showConfirmButton: false,
      });
      startCreateToday();
    } catch (e2) {
      setError(e2.message || "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>smart-papar • บันทึกคุณภาพน้ำ</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="p-4 lg:p-6 max-w-[1200px] mx-auto space-y-4">
          <div className="dashboard-header">
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                  <span className="text-2xl">💧</span>
                </div>
                <div>
                  <div className="text-blue-200 text-sm">Smart Papar • ระบบงานประปา</div>
                  <h1 className="text-2xl lg:text-3xl font-bold">บันทึกคุณภาพน้ำรายวัน</h1>
                  <p className="text-blue-200 text-sm mt-1">จุดเดียว: โรงผลิต • แก้ย้อนหลังได้ไม่เกิน 7 วัน</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="dashboard-section p-5">
              {latest ? (
                <>
                  {(() => {
                    // NTU น้ำจ่าย: <5 ปกติ, 5-15 เฝ้าระวัง, 15-20 ตะกอนเล็กน้อย, >20 เริ่มขุ่น
                    const tapNtu = numOrNull(latest?.tap?.turbidityNtu);
                    const tier =
                      tapNtu === null
                        ? "none"
                        : tapNtu < 5
                          ? "ok"
                          : tapNtu <= 15
                            ? "warn"
                            : tapNtu <= 20
                              ? "warn2"
                              : "bad";

                    const statusText =
                      tier === "ok"
                        ? "น้ำใส (ปกติ)"
                        : tier === "warn2"
                          ? "ตะกอนเล็กน้อย"
                          : tier === "bad"
                            ? "เริ่มขุ่น"
                            : tier === "warn"
                              ? "เฝ้าระวัง"
                              : "ไม่มีข้อมูล";

                    const statusColor =
                      tier === "ok"
                        ? "text-emerald-700"
                        : tier === "warn2"
                          ? "text-orange-700"
                          : tier === "bad"
                            ? "text-rose-700"
                            : tier === "warn"
                              ? "text-amber-700"
                              : "text-slate-500";

                    const dotBg =
                      tier === "ok"
                        ? "bg-emerald-500"
                        : tier === "warn2"
                          ? "bg-orange-500"
                          : tier === "bad"
                            ? "bg-rose-500"
                            : tier === "warn"
                              ? "bg-amber-500"
                              : "bg-slate-300";

                    const valueFancyClass =
                      tier === "ok"
                        ? "bg-gradient-to-br from-sky-600 to-indigo-600 bg-clip-text text-transparent drop-shadow-sm"
                        : "text-slate-900";

                    return (
                      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="w-9 h-9 rounded-2xl bg-white border border-sky-200 flex items-center justify-center shadow-sm flex-shrink-0">
                                <span className="text-base text-sky-700">💧</span>
                              </div>
                              <div className="min-w-0">
                                <div className="text-lg font-bold text-slate-800 truncate">
                                  ค่าคุณภาพน้ำจ่าย
                                </div>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                              <span className={`inline-block w-3 h-3 rounded-full ${dotBg}`} />
                              <span className={`text-sm font-medium ${statusColor}`}>{statusText}</span>
                            </div>

                            <div className="mt-1 text-xs text-slate-400">
                              อัปเดต: {formatThaiDate(latest.recordDate) || (ymdToThaiDmyBE(latest.recordDate) || latest.recordDate)}
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <div className={`tabular-nums font-extrabold leading-none text-[clamp(44px,10vw,72px)] ${valueFancyClass}`}>
                              {tapNtu === null ? "-" : format2(tapNtu)}
                            </div>
                            <div className="mt-1 text-lg font-bold text-slate-900">NTU</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <>
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-2xl bg-white border border-sky-200 flex items-center justify-center shadow-sm">
                          <span className="text-base text-sky-700">💧</span>
                        </div>
                        <div className="text-lg font-bold text-slate-800">ค่าคุณภาพน้ำจ่าย</div>
                      </div>
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-1 rounded-full tracking-wide">ล่าสุด</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูล</div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border shadow-sm p-4">
              <h2 className="font-semibold text-gray-800 mb-3">
                {editingId ? `แก้ไขวันที่ ${form.recordDate}` : `เพิ่มข้อมูลวันที่ ${form.recordDate}`}
              </h2>

              {!canEditSelected && (
                <div className="alert alert-warning mb-3">
                  <span>🔒 แก้ไขย้อนหลังได้ไม่เกิน 7 วัน (วันนี้: {today})</span>
                </div>
              )}

              {error && (
                <div className="alert alert-error mb-3">
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">
                      <span className="label-text">วันที่ (วัน เดือน ปี)</span>
                    </label>
                    <div className="relative">
                      <input
                        className="input input-bordered w-full pr-10 pointer-events-none select-none"
                        value={ymdToDmy(form.recordDate)}
                        readOnly
                        tabIndex={-1}
                      />
                      <div
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                        aria-hidden="true"
                      >
                        📅
                      </div>
                      <input
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        type="date"
                        value={form.recordDate}
                        min={minDate}
                        max={today}
                        disabled={!!editingId}
                        onChange={(e) => setForm((p) => ({ ...p, recordDate: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">
                      <span className="label-text">หมายเหตุ</span>
                    </label>
                    <input
                      className="input input-bordered w-full"
                      value={form.note}
                      onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-sky-900">น้ำดิบ (ก่อนเข้าถังตกตะกอน)</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="label py-1">
                          <span className="label-text text-xs text-sky-900/80">ความขุ่น (NTU)</span>
                        </label>
                        <input
                          className="input input-bordered w-full border-sky-200 bg-white"
                          placeholder="เช่น 82.60"
                      inputMode="decimal"
                      type="text"
                          ref={rawNtuRef}
                      value={form.raw.turbidityNtu}
                      onChange={(e) => {
                        const candidate = normalizeDecimalCandidate(e.target.value);
                        if (candidate === null) return;
                        if (!allowDecimal2Input(candidate)) return;
                        const clamped = clampDecimalInputString(candidate, 999);
                        if (clamped === null) return;
                        setForm((p) => ({ ...p, raw: { ...p.raw, turbidityNtu: clamped } }));
                      }}
                      onBlur={() =>
                        setForm((p) => ({
                          ...p,
                          raw: {
                            ...p.raw,
                            turbidityNtu: formatDecimal2Input(clamp0toMaxOrNull(p.raw.turbidityNtu, 999)),
                          },
                        }))
                      }
                        />
                      </div>
                      <div>
                        <label className="label py-1">
                          <span className="label-text text-xs text-sky-900/80">ค่า pH (0–14)</span>
                        </label>
                        <input
                          className="input input-bordered w-full border-sky-200 bg-white"
                          placeholder="เช่น 7.43"
                      inputMode="decimal"
                      type="text"
                      value={form.raw.ph}
                      onChange={(e) => {
                        const candidate = normalizeDecimalCandidate(e.target.value);
                        if (candidate === null) return;
                        if (!allowDecimal2Input(candidate)) return;
                        const clamped = clampDecimalInputString(candidate, 14);
                        if (clamped === null) return;
                        setForm((p) => ({ ...p, raw: { ...p.raw, ph: clamped } }));
                      }}
                      onBlur={() =>
                        setForm((p) => ({
                          ...p,
                          raw: { ...p.raw, ph: formatDecimal2Input(clamp0toMaxOrNull(p.raw.ph, 14)) },
                        }))
                      }
                        />
                      </div>
                      <div>
                        <label className="label py-1">
                          <span className="label-text text-xs text-sky-900/80">ค่า TDS (mg/L)</span>
                        </label>
                        <input
                          className="input input-bordered w-full border-sky-200 bg-white"
                          placeholder="เช่น 103"
                      inputMode="numeric"
                      type="text"
                      value={form.raw.tdsMgL}
                      onChange={(e) => {
                        const next = e.target.value.trim();
                        if (!allowIntInput(next)) return;
                        const clamped = clampNumStrToMax(next, 500);
                        setForm((p) => ({ ...p, raw: { ...p.raw, tdsMgL: clamped } }));
                      }}
                      onBlur={() =>
                        setForm((p) => ({
                          ...p,
                          raw: {
                            ...p.raw,
                            tdsMgL:
                              p.raw.tdsMgL === ""
                                ? ""
                                : String(toIntOrNull(clamp0toMaxOrNull(p.raw.tdsMgL, 500)) ?? 0),
                          },
                        }))
                      }
                        />
                      </div>
                    </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-emerald-900">น้ำประปา (จ่ายออกให้ครัวเรือน)</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div>
                        <label className="label py-1">
                          <span className="label-text text-xs text-emerald-900/80">ความขุ่น (NTU)</span>
                        </label>
                        <input
                          className="input input-bordered w-full border-emerald-200 bg-white"
                          placeholder="เช่น 4.02"
                      inputMode="decimal"
                      type="text"
                      value={form.tap.turbidityNtu}
                      onChange={(e) => {
                        const candidate = normalizeDecimalCandidate(e.target.value);
                        if (candidate === null) return;
                        if (!allowDecimal2Input(candidate)) return;
                        const clamped = clampDecimalInputString(candidate, 999);
                        if (clamped === null) return;
                        setForm((p) => ({ ...p, tap: { ...p.tap, turbidityNtu: clamped } }));
                      }}
                      onBlur={() =>
                        setForm((p) => ({
                          ...p,
                          tap: {
                            ...p.tap,
                            turbidityNtu: formatDecimal2Input(clamp0toMaxOrNull(p.tap.turbidityNtu, 999)),
                          },
                        }))
                      }
                        />
                      </div>
                      <div>
                        <label className="label py-1">
                          <span className="label-text text-xs text-emerald-900/80">ค่า pH (0–14)</span>
                        </label>
                        <input
                          className="input input-bordered w-full border-emerald-200 bg-white"
                          placeholder="เช่น 7.46"
                      inputMode="decimal"
                      type="text"
                      value={form.tap.ph}
                      onChange={(e) => {
                        const candidate = normalizeDecimalCandidate(e.target.value);
                        if (candidate === null) return;
                        if (!allowDecimal2Input(candidate)) return;
                        const clamped = clampDecimalInputString(candidate, 14);
                        if (clamped === null) return;
                        setForm((p) => ({ ...p, tap: { ...p.tap, ph: clamped } }));
                      }}
                      onBlur={() =>
                        setForm((p) => ({
                          ...p,
                          tap: { ...p.tap, ph: formatDecimal2Input(clamp0toMaxOrNull(p.tap.ph, 14)) },
                        }))
                      }
                        />
                      </div>
                      <div>
                        <label className="label py-1">
                          <span className="label-text text-xs text-emerald-900/80">ค่า TDS (mg/L)</span>
                        </label>
                        <input
                          className="input input-bordered w-full border-emerald-200 bg-white"
                          placeholder="เช่น 125"
                      inputMode="numeric"
                      type="text"
                      value={form.tap.tdsMgL}
                      onChange={(e) => {
                        const next = e.target.value.trim();
                        if (!allowIntInput(next)) return;
                        const clamped = clampNumStrToMax(next, 500);
                        setForm((p) => ({ ...p, tap: { ...p.tap, tdsMgL: clamped } }));
                      }}
                      onBlur={() =>
                        setForm((p) => ({
                          ...p,
                          tap: {
                            ...p.tap,
                            tdsMgL:
                              p.tap.tdsMgL === ""
                                ? ""
                                : String(toIntOrNull(clamp0toMaxOrNull(p.tap.tdsMgL, 500)) ?? 0),
                          },
                        }))
                      }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label py-1">
                          <span className="label-text text-xs text-emerald-900/80">คลอรีนอิสระ ต้นทาง (mg/L)</span>
                        </label>
                        <input
                          className="input input-bordered w-full border-emerald-200 bg-white"
                          placeholder="เช่น 0.10"
                      inputMode="decimal"
                      type="text"
                          ref={tapChlorineSourceRef}
                      value={form.tap.freeChlorineSourceMgL}
                      onChange={(e) => {
                        const candidate = normalizeDecimalCandidate(e.target.value);
                        if (candidate === null) return;
                        if (!allowDecimal2Input(candidate)) return;
                        const clamped = clampDecimalInputString(candidate, 10);
                        if (clamped === null) return;
                        setForm((p) => ({
                          ...p,
                          tap: { ...p.tap, freeChlorineSourceMgL: clamped },
                        }));
                      }}
                      onBlur={() =>
                        setForm((p) => ({
                          ...p,
                          tap: {
                            ...p.tap,
                            freeChlorineSourceMgL: formatDecimal2Input(
                              clamp0toMaxOrNull(p.tap.freeChlorineSourceMgL, 10)
                            ),
                          },
                        }))
                      }
                        />
                      </div>
                      <div>
                        <label className="label py-1">
                          <span className="label-text text-xs text-emerald-900/80">คลอรีนอิสระ ปลายทาง (mg/L)</span>
                        </label>
                        <input
                          className="input input-bordered w-full border-emerald-200 bg-white"
                          placeholder="เช่น 0.20"
                      inputMode="decimal"
                      type="text"
                      value={form.tap.freeChlorineEndMgL}
                      onChange={(e) => {
                        const candidate = normalizeDecimalCandidate(e.target.value);
                        if (candidate === null) return;
                        if (!allowDecimal2Input(candidate)) return;
                        const clamped = clampDecimalInputString(candidate, 10);
                        if (clamped === null) return;
                        setForm((p) => ({
                          ...p,
                          tap: { ...p.tap, freeChlorineEndMgL: clamped },
                        }));
                      }}
                      onBlur={() =>
                        setForm((p) => ({
                          ...p,
                          tap: {
                            ...p.tap,
                            freeChlorineEndMgL: formatDecimal2Input(clamp0toMaxOrNull(p.tap.freeChlorineEndMgL, 10)),
                          },
                        }))
                      }
                        />
                      </div>
                    </div>
                </div>

                <button className="btn btn-primary w-full" disabled={saving || !canEditSelected} type="submit">
                  {saving ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "บันทึกข้อมูล"}
                </button>
              </form>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-800">รายการย้อนหลัง</h2>
                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={syncFromSheet}
                    type="button"
                    disabled={syncing}
                    title="ดึงข้อมูลล่าสุดจาก Google Sheet แล้วบันทึกลงระบบ"
                  >
                    {syncing ? "กำลังซิ้ง..." : "Sync จาก Sheet"}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={fetchItems} type="button" disabled={loading || syncing}>
                    รีเฟรช
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="text-center text-gray-500 py-8">กำลังโหลด...</div>
              ) : items.length === 0 ? (
                <div className="text-center text-gray-500 py-8">ยังไม่มีข้อมูล</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>วันที่</th>
                        <th className="text-center">น้ำดิบ NTU</th>
                        <th className="text-center">คลอรีนต้นทาง</th>
                        <th className="text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => {
                        const editable = canEditYmd(it.recordDate, 7);
                        const rawNtu = numOrNull(it.raw?.turbidityNtu);
                        const srcCl = numOrNull(it.tap?.freeChlorineSourceMgL);
                        const ntuBadge =
                          rawNtu === null
                            ? null
                            : rawNtu >= 100
                              ? "error"
                              : rawNtu >= 81
                                ? "warning"
                                : rawNtu >= 60
                                  ? "success"
                                  : "ghost";

                        const clBadge =
                          srcCl === null
                            ? null
                            : srcCl < 0.2
                              ? "warning"
                              : srcCl <= 0.5
                                ? "success"
                                : "error";
                        return (
                          <tr key={it._id} className={editingId === it._id ? "bg-blue-50" : ""}>
                            <td>{ymdToThaiDmyBE(it.recordDate) || it.recordDate}</td>
                            <td className="text-center">
                              {rawNtu === null || !ntuBadge ? (
                                <span className="text-gray-400">-</span>
                              ) : (
                                <span
                                  className={`badge ${
                                    ntuBadge === "error"
                                      ? "badge-error text-white"
                                      : ntuBadge === "warning"
                                        ? "badge-warning"
                                        : ntuBadge === "success"
                                          ? "badge-success text-white"
                                          : "badge-ghost"
                                  }`}
                                >
                                  {format2(rawNtu)}
                                </span>
                              )}
                            </td>
                            <td className="text-center">
                              {srcCl === null || !clBadge ? (
                                <span className="text-gray-400">-</span>
                              ) : (
                                <span
                                  className={`badge ${
                                    clBadge === "success"
                                      ? "badge-success text-white"
                                      : clBadge === "warning"
                                        ? "badge-warning"
                                        : "badge-error text-white"
                                  }`}
                                >
                                  {format2(srcCl)}
                                </span>
                              )}
                            </td>
                            <td className="text-right">
                              <button
                                className="btn btn-xs btn-outline"
                                type="button"
                                disabled={!editable}
                                title={!editable ? "แก้ไขย้อนหลังได้ไม่เกิน 7 วัน" : "แก้ไข"}
                                onClick={() => startEdit(it)}
                              >
                                แก้ไข
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


