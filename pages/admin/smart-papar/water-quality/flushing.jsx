// บันทึกโบตะกอน — หน้าลูกของ /admin/smart-papar/water-quality
// อยู่ใต้ path หน้าแม่เพื่อใช้สิทธิ์เดียวกัน (_app ตรวจด้วย router.pathname แบบ prefix) — ห้ามย้ายออกไปนอก water-quality/
import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import { useUser } from "@clerk/nextjs";
import { ClipboardList, MapPin, Plus, Search, TriangleAlert } from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";
import FlushingForm from "@/components/smart-papar/FlushingForm";
import { FlushingList, FlushingDetail } from "@/components/smart-papar/FlushingList";
import { bangkokYmd, canModifyFlushingLog, summarizeFlushing } from "@/lib/smart-papar/flushing";

// แท็บทะเบียนหัวโบล์ (แผนที่แก้ไข + leaflet) — โหลดเมื่อเปิดแท็บเท่านั้น
const FlushPointRegistry = dynamic(() => import("@/components/smart-papar/FlushPointRegistry"), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-pp-muted">กำลังโหลด…</div>,
});

const TABS = [
  { key: "logs", label: "งานโบตะกอน", icon: ClipboardList },
  { key: "registry", label: "ทะเบียนหัวโบล์", icon: MapPin },
];

const FlushingMap = dynamic(() => import("@/components/smart-papar/FlushingMap"), {
  ssr: false,
  loading: () => <div className="h-[380px] animate-pulse rounded-2xl bg-white lg:h-[520px]" />,
});

const RANGES = [
  { key: "today", label: "วันนี้", days: 0 },
  { key: "7d", label: "7 วัน", days: 6 },
  { key: "30d", label: "30 วัน", days: 29 },
];

const RESULT_FILTERS = [
  { key: "all", label: "ทั้งหมด", cls: "text-pp-ink" },
  { key: "clear", label: "ใสแล้ว", cls: "text-pp-clear-ink" },
  { key: "still_turbid", label: "ยังขุ่น", cls: "text-pp-turbid-ink" },
];

function rangeOf(days) {
  const now = new Date();
  return { from: bangkokYmd(new Date(now.getTime() - days * 86400000)), to: bangkokYmd(now) };
}

const pointKey = (l) => (l.flushPointId ? String(l.flushPointId) : `name:${l.locationName}`);

const fmtShort = (d) =>
  new Date(d).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function SmartPaparFlushingPage() {
  // แท็บจำไว้ใน URL (?tab=registry) — รีเฟรช/ส่งลิงก์แล้วเปิดแท็บเดิม
  const router = useRouter();
  const tab = router.query.tab === "registry" ? "registry" : "logs";
  const setTab = (key) =>
    router.replace(
      { pathname: router.pathname, query: key === "logs" ? {} : { tab: key } },
      undefined,
      { shallow: true }
    );
  const { user } = useUser();
  const actor = {
    userId: user?.id,
    isSuperAdmin: user?.publicMetadata?.role === "superadmin",
  };

  const [rangeKey, setRangeKey] = useState("today");
  const [resultFilter, setResultFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({ total: 0, clear: 0, stillTurbid: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formLog, setFormLog] = useState(null); // null = ปิด, {} = สร้างใหม่, log = แก้ไข
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    const { from, to } = rangeOf(RANGES.find((r) => r.key === rangeKey).days);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/smart-papar/flushing?from=${from}&to=${to}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "โหลดข้อมูลไม่สำเร็จ");
      setLogs(data.data);
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof TypeError ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" : e.message);
    } finally {
      setLoading(false);
    }
  }, [rangeKey]);

  useEffect(() => {
    load();
  }, [load]);

  // กรองผล/ค้นหาฝั่ง client จากชุดที่โหลดมาแล้ว (API จำกัด 500 รายการต่อช่วง)
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (resultFilter !== "all" && l.result !== resultFilter) return false;
      if (!q) return true;
      return [l.locationName, l.flushPointCode, l.createdByName].some((v) =>
        String(v || "").toLowerCase().includes(q)
      );
    });
  }, [logs, resultFilter, query]);
  const filtered = resultFilter !== "all" || query.trim() !== "";
  const shownSummary = filtered ? summarizeFlushing(shown) : summary;

  const stats = useMemo(() => {
    const officers = new Set(logs.map((l) => l.createdByName).filter(Boolean)).size;
    const avgMin = logs.length
      ? Math.round(logs.reduce((s, l) => s + (Number(l.durationMin) || 0), 0) / logs.length)
      : 0;
    const turbidPoints = new Set(logs.filter((l) => l.result === "still_turbid").map(pointKey)).size;
    return { officers, avgMin, turbidPoints };
  }, [logs]);

  // จุดที่ "ล่าสุด" ยังขุ่น — ถ้าโบซ้ำแล้วใส จุดนั้นหลุดจากรายการตามซ้ำเอง (logs เรียงใหม่สุดก่อนจาก API)
  const followUps = useMemo(() => {
    const latest = new Map();
    const counts = new Map();
    for (const l of logs) {
      const k = pointKey(l);
      counts.set(k, (counts.get(k) || 0) + 1);
      if (!latest.has(k)) latest.set(k, l);
    }
    return [...latest.entries()]
      .filter(([, l]) => l.result === "still_turbid")
      .map(([k, l]) => ({ log: l, times: counts.get(k) }));
  }, [logs]);

  const historyOf = (log) => logs.filter((l) => pointKey(l) === pointKey(log));

  const onSaved = () => {
    setFormLog(null);
    setSelected(null);
    Swal.fire({ icon: "success", title: "บันทึกแล้ว", timer: 1400, showConfirmButton: false });
    load();
  };

  const onDelete = async (log) => {
    const ok = await Swal.fire({
      icon: "warning",
      title: "ลบบันทึกนี้?",
      text: log.locationName,
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#B42318",
    });
    if (!ok.isConfirmed) return;
    const res = await fetch(`/api/smart-papar/flushing/${log._id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      Swal.fire({ icon: "error", title: data?.message || "ลบไม่สำเร็จ" });
      return;
    }
    setSelected(null);
    load();
  };

  const clearPct = shownSummary.total ? Math.round((shownSummary.clear / shownSummary.total) * 100) : 0;
  const dash = (v) => (loading ? "–" : v);

  return (
    <PermissionGuard requiredPath="/admin/smart-papar/water-quality">
      <Head>
        <title>smart-papar • บันทึกโบตะกอน</title>
      </Head>

      <div className="min-h-screen bg-pp-ground text-pp-ink">
        <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <nav aria-label="breadcrumb" className="flex flex-wrap gap-1.5 text-sm text-pp-muted">
                <span>Smart Papar</span>
                <span>/</span>
                <Link href="/admin/smart-papar/water-quality" className="hover:underline">
                  คุณภาพน้ำรายวัน
                </Link>
                <span>/</span>
                <span className="text-pp-ink">โบตะกอน</span>
              </nav>
              <h1 className="font-tk-sans text-3xl font-bold leading-tight lg:text-[34px]">โบตะกอน</h1>
              <p className="text-[15px] text-pp-muted">งานระบายตะกอนในท่อ บันทึกจากหน้างานพร้อมรูปก่อน/หลัง</p>
            </div>
            {tab === "logs" && (
              <button
                type="button"
                onClick={() => setFormLog({})}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-pp-water px-5 text-base font-semibold text-white shadow-[0_6px_16px_rgba(14,110,134,0.25)] hover:bg-pp-deep sm:w-auto"
              >
                <Plus size={20} strokeWidth={2.4} aria-hidden />
                บันทึกโบตะกอน
              </button>
            )}
          </header>

          <div role="tablist" aria-label="ส่วนของหน้าโบตะกอน" className="flex gap-1 border-b border-pp-line">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`-mb-px flex h-11 items-center gap-2 border-b-2 px-4 text-[15px] ${
                  tab === key
                    ? "border-pp-water font-semibold text-pp-ink"
                    : "border-transparent text-pp-muted hover:text-pp-ink"
                }`}
              >
                <Icon size={18} aria-hidden />
                {label}
              </button>
            ))}
          </div>

          {tab === "registry" ? (
            <FlushPointRegistry />
          ) : (
          <>
          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="ช่วงเวลา" className="flex gap-1 rounded-xl border border-pp-line bg-white p-1">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  aria-pressed={rangeKey === r.key}
                  onClick={() => setRangeKey(r.key)}
                  className={`h-9 rounded-lg px-4 text-sm ${
                    rangeKey === r.key ? "bg-pp-deep font-semibold text-white" : "text-pp-muted hover:bg-pp-ground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div role="group" aria-label="ผล" className="flex gap-1.5">
              {RESULT_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={resultFilter === f.key}
                  onClick={() => setResultFilter(f.key)}
                  className={`h-10 rounded-full border-[1.5px] bg-white px-3.5 text-sm ${f.cls} ${
                    resultFilter === f.key ? "border-pp-ink font-semibold" : "border-pp-line"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label className="flex h-11 min-w-0 flex-[1_1_260px] items-center gap-2 rounded-xl border border-pp-line bg-white px-3 text-pp-muted sm:ml-auto sm:max-w-[360px]">
              <Search size={18} aria-hidden />
              <span className="sr-only">ค้นหา</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหารหัสหัวโบล์ / ถนน / ผู้บันทึก"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-pp-ink outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="space-y-1 rounded-2xl bg-white p-4">
              <div className="text-sm text-pp-muted">{filtered ? "ตรงเงื่อนไข" : "บันทึกทั้งหมด"}</div>
              <div className="font-tk-sans text-4xl font-bold tabular-nums">{dash(shownSummary.total)}</div>
              <div className="text-[13px] text-pp-muted">จาก {dash(stats.officers)} เจ้าหน้าที่</div>
            </div>
            <div className="space-y-1 rounded-2xl bg-white p-4">
              <div className="text-sm text-pp-muted">ใสแล้ว</div>
              <div className="font-tk-sans text-4xl font-bold tabular-nums text-pp-clear-ink">{dash(shownSummary.clear)}</div>
              <div className="h-1.5 overflow-hidden rounded-full bg-pp-clear-tint">
                <div className="h-full bg-pp-clear" style={{ width: `${clearPct}%` }} />
              </div>
              <div className="text-[13px] text-pp-muted">{clearPct}% ของทั้งหมด</div>
            </div>
            <div className="space-y-1 rounded-2xl bg-white p-4 ring-[1.5px] ring-inset ring-pp-turbid-line">
              <div className="text-sm font-semibold text-pp-turbid-ink">ยังขุ่น</div>
              <div className="font-tk-sans text-4xl font-bold tabular-nums text-pp-turbid-ink">
                {dash(shownSummary.stillTurbid)}
              </div>
              <div className="text-[13px] text-pp-muted">ใน {dash(stats.turbidPoints)} จุด</div>
            </div>
            <div className="space-y-1 rounded-2xl bg-white p-4">
              <div className="text-sm text-pp-muted">เวลาโบเฉลี่ย</div>
              <div className="font-tk-sans text-4xl font-bold tabular-nums">
                {dash(stats.avgMin)}
                <span className="ml-1 text-lg font-semibold text-pp-muted">นาที</span>
              </div>
              <div className="text-[13px] text-pp-muted">ต่อครั้ง</div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl bg-white p-4 text-pp-danger">
              {error}{" "}
              <button type="button" onClick={load} className="font-semibold underline">
                ลองใหม่
              </button>
            </div>
          ) : (
            <>
              {!loading && followUps.length > 0 && (
                <section className="space-y-3 rounded-2xl bg-white p-4">
                  <div className="flex items-center gap-2">
                    <TriangleAlert size={20} className="text-pp-turbid-ink" aria-hidden />
                    <h2 className="flex-1 font-tk-sans text-lg font-semibold">จุดที่ยังขุ่น · ต้องตามซ้ำ</h2>
                    <span className="text-[13px] text-pp-muted">{followUps.length} จุด</span>
                  </div>
                  <div className="flex gap-2.5 overflow-x-auto pb-1">
                    {followUps.map(({ log, times }) => (
                      <button
                        key={log._id}
                        type="button"
                        onClick={() => setSelected(log)}
                        className="flex min-w-[240px] flex-col gap-0.5 rounded-xl bg-pp-turbid-wash px-3.5 py-3 text-left"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold">
                            {log.flushPointCode && <span className="font-tk-mono text-sm">{log.flushPointCode} · </span>}
                            {String(log.locationName || "").replace(` (${log.flushPointCode})`, "")}
                          </span>
                          {times > 1 && (
                            <span className="flex-none rounded-full bg-pp-turbid-tint px-2 py-0.5 text-xs font-semibold text-pp-turbid-ink">
                              {times} ครั้ง
                            </span>
                          )}
                        </span>
                        <span className="text-[13px] text-pp-muted">ล่าสุด {fmtShort(log.flushedAt)}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <FlushingMap logs={shown} onSelect={setSelected} />

              <section className="space-y-3 md:rounded-2xl md:bg-white md:p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-tk-sans text-lg font-semibold">รายการบันทึก</h2>
                  <span className="text-[13px] text-pp-muted">{loading ? "กำลังโหลด…" : `${shown.length} รายการ`}</span>
                </div>
                {loading ? (
                  <div className="py-10 text-center text-pp-muted">กำลังโหลด…</div>
                ) : (
                  <FlushingList logs={shown} onSelect={setSelected} />
                )}
              </section>
            </>
          )}
          </>
          )}
        </div>
      </div>

      {selected && !formLog && (
        <FlushingDetail
          log={selected}
          history={historyOf(selected)}
          canModify={canModifyFlushingLog(selected, actor)}
          onClose={() => setSelected(null)}
          onEdit={() => setFormLog(selected)}
          onDelete={() => onDelete(selected)}
        />
      )}
      {formLog && (
        <FlushingForm
          key={formLog._id || "new"}
          log={formLog._id ? formLog : null}
          onClose={() => setFormLog(null)}
          onSaved={onSaved}
        />
      )}
    </PermissionGuard>
  );
}
