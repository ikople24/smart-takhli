// แท็บ "รายงานและคิวงาน" ในหน้าโบตะกอน (?tab=report) — สำหรับผู้บริหาร/หัวหน้างาน
// 1) สรุปผลรายวัน/รายเดือน แยกทีม · 2) คิวงานโบตะกอนประจำ (ใสแล้ว +15 วัน · ยังขุ่น +5 วัน จากวันโบล่าสุด)
// ตัวเลขทั้งหมดคำนวณฝั่ง server (lib/smart-papar/flushingSchedule.js) — หน้านี้แสดงผลอย่างเดียว
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, ChevronDown, TriangleAlert, Users } from "lucide-react";
import { bangkokYmd } from "@/lib/smart-papar/flushing";
import { CYCLE_DAYS, QUEUE_BUCKET_LABELS } from "@/lib/smart-papar/flushingSchedule";
import FlushingTeamsModal from "./FlushingTeamsModal";

const fmtYmd = (ymd, opts = { day: "numeric", month: "short" }) =>
  new Date(`${ymd}T12:00:00+07:00`).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", ...opts });

const fmtMonth = (month) => fmtYmd(`${month}-01`, { month: "long", year: "numeric" });

// กลุ่มที่เปิดไว้ตั้งแต่แรก — "ภายหลัง" / "ยังไม่เคยโบ" ยาว พับไว้ก่อน
const QUEUE_SECTIONS = [
  { key: "overdue", tone: "text-pp-danger", open: true },
  { key: "today", tone: "text-pp-turbid-ink", open: true },
  { key: "upcoming", tone: "text-pp-ink", open: true },
  { key: "later", tone: "text-pp-muted", open: false },
  { key: "blocked", tone: "text-pp-turbid-ink", open: true },
  { key: "never", tone: "text-pp-muted", open: false },
];

function useJson(url) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const res = await fetch(url);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "โหลดข้อมูลไม่สำเร็จ");
      setState({ loading: false, data, error: "" });
    } catch (e) {
      setState({ loading: false, data: null, error: e instanceof TypeError ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" : e.message });
    }
  }, [url]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

function Kpi({ label, value, unit, cls = "", sub }) {
  return (
    <div className="min-w-0 break-words rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(11,34,51,0.06)]">
      <div className="text-sm text-pp-muted">{label}</div>
      <div className={`font-tk-sans text-4xl font-bold tabular-nums ${cls}`}>
        {value}
        <span className="ml-1 text-base font-semibold text-pp-muted">{unit}</span>
      </div>
      {sub && <div className="text-[13px] text-pp-muted">{sub}</div>}
    </div>
  );
}

function SummarySection({ onOpenTeams, reloadKey }) {
  const today = bangkokYmd(new Date());
  const [period, setPeriod] = useState("month");
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const url =
    period === "month"
      ? `/api/smart-papar/flushing/report?period=month&month=${month}&k=${reloadKey}`
      : `/api/smart-papar/flushing/report?period=day&date=${date}&k=${reloadKey}`;
  const { loading, data, error } = useJson(url);
  const total = data?.summary.total;
  const dash = (v) => (loading || v == null ? "–" : v);
  const clearPct = total?.points ? Math.round((total.clearPoints / total.points) * 100) : null;
  const rows = (data?.summary.rows || []).filter((r) => r.key || r.flushCount > 0);
  const teamCols = (data?.teams || []).concat(rows.some((r) => !r.key) ? [{ key: "", label: "ยังไม่จัดทีม" }] : []);
  const days = (data?.daily || []).filter((d) => d.ymd <= today).reverse();

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-tk-sans text-2xl font-bold">สรุปผลการโบตะกอน</h2>
          <p className="text-sm text-pp-muted">
            {period === "month" ? fmtMonth(month) : fmtYmd(date, { day: "numeric", month: "long", year: "numeric" })} · แยกตามทีมงาน
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="ช่วงรายงาน" className="flex gap-1 rounded-xl border border-pp-line bg-white p-1">
            {[
              { key: "day", label: "รายวัน" },
              { key: "month", label: "รายเดือน" },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={period === p.key}
                onClick={() => setPeriod(p.key)}
                className={`h-9 rounded-lg px-4 text-sm ${
                  period === p.key ? "bg-pp-deep font-semibold text-white" : "text-pp-muted hover:bg-pp-ground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === "month" ? (
            <input
              type="month"
              aria-label="เลือกเดือน"
              value={month}
              max={today.slice(0, 7)}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="h-11 rounded-xl border border-pp-line bg-white px-3 text-[15px]"
            />
          ) : (
            <input
              type="date"
              aria-label="เลือกวันที่"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-11 rounded-xl border border-pp-line bg-white px-3 text-[15px]"
            />
          )}
          <button
            type="button"
            onClick={onOpenTeams}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-pp-line bg-white px-4 text-sm font-semibold hover:bg-pp-ground"
          >
            <Users size={17} aria-hidden />
            ตั้งค่าทีม
          </button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-white px-4 py-3 text-pp-danger">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="โบตะกอนทั้งหมด" value={dash(total?.flushCount)} unit="ครั้ง" />
        <Kpi label="หัวโบล์ที่ระบาย" value={dash(total?.points)} unit="หัว" sub="นับหัวในทะเบียนไม่ซ้ำ" />
        <Kpi
          label="ใสแล้ว"
          value={dash(total?.clearPoints)}
          unit="หัว"
          cls="text-pp-clear-ink"
          sub={clearPct != null ? `${clearPct}% ของหัวที่ระบาย` : "ตามผลครั้งล่าสุดในช่วงนี้"}
        />
        <Kpi label="ยังขุ่น" value={dash(total?.turbidPoints)} unit="หัว" cls="text-pp-turbid-ink" sub="ตามผลครั้งล่าสุดในช่วงนี้" />
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(11,34,51,0.06)]">
        <table className="w-full min-w-[520px] text-[15px]">
          <thead className="border-b border-pp-line text-left text-sm text-pp-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">ทีมงาน</th>
              <th className="px-4 py-3 text-right font-semibold">โบ (ครั้ง)</th>
              <th className="px-4 py-3 text-right font-semibold">ระบาย (หัว)</th>
              <th className="px-4 py-3 text-right font-semibold">ใสแล้ว (หัว)</th>
              <th className="px-4 py-3 text-right font-semibold">ยังขุ่น (หัว)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pp-line tabular-nums">
            {rows.map((r) => (
              <tr key={r.key || "none"} className={r.key ? "" : "text-pp-muted"}>
                <td className="px-4 py-3 font-semibold">{r.label}</td>
                <td className="px-4 py-3 text-right">{dash(r.flushCount)}</td>
                <td className="px-4 py-3 text-right">{dash(r.points)}</td>
                <td className="px-4 py-3 text-right text-pp-clear-ink">{dash(r.clearPoints)}</td>
                <td className="px-4 py-3 text-right text-pp-turbid-ink">{dash(r.turbidPoints)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.some((r) => !r.key && r.flushCount > 0) && (
          <p className="border-t border-pp-line px-4 py-2.5 text-[13px] text-pp-muted">
            &ldquo;ยังไม่จัดทีม&rdquo; = ชื่อคนบันทึกที่ยังไม่ได้เลือกทีม — กด &ldquo;ตั้งค่าทีม&rdquo; เพื่อจัด
          </p>
        )}
      </div>

      {period === "month" && days.length > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(11,34,51,0.06)]">
          <div className="border-b border-pp-line px-4 py-3 font-semibold">รายวัน — {fmtMonth(month)}</div>
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full min-w-[520px] text-[15px]">
              <thead className="sticky top-0 bg-white text-left text-sm text-pp-muted shadow-[0_1px_0_var(--color-pp-line)]">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">วันที่</th>
                  {teamCols.map((t) => (
                    <th key={t.key || "none"} className="px-4 py-2.5 text-right font-semibold">
                      {t.label}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right font-semibold">รวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pp-line tabular-nums">
                {days.map((d) => (
                  <tr key={d.ymd} className={d.total.flushCount ? "" : "text-pp-muted/60"}>
                    <td className="px-4 py-2">{fmtYmd(d.ymd, { weekday: "short", day: "numeric", month: "short" })}</td>
                    {teamCols.map((t) => {
                      const c = d.byTeam[t.key];
                      return (
                        <td key={t.key || "none"} className="px-4 py-2 text-right">
                          {c ? (
                            <>
                              {c.flushCount}
                              <span className="text-[13px] text-pp-muted"> ครั้ง · {c.points} หัว</span>
                            </>
                          ) : (
                            "–"
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-right font-semibold">
                      {d.total.flushCount ? (
                        <>
                          {d.total.flushCount}
                          <span className="text-[13px] font-normal text-pp-muted"> ครั้ง · {d.total.points} หัว</span>
                        </>
                      ) : (
                        "–"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function dueText(i) {
  if (i.bucket === "never") return "ยังไม่เคยโบ";
  if (i.bucket === "blocked") return "แก้ไขก่อนจึงโบได้";
  if (i.daysLeft < 0) return `เลยมา ${-i.daysLeft} วัน`;
  if (i.daysLeft === 0) return "วันนี้";
  return `อีก ${i.daysLeft} วัน`;
}

function QueueRow({ i, teamLabel }) {
  const clear = i.lastResult === "clear";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
      <span className="min-w-0 flex-1 basis-56">
        <span className="font-tk-mono text-sm">{i.code}</span>
        <span className="ml-2 text-[15px]">{i.name || i.roadName || ""}</span>
        <span className="block text-[13px] text-pp-muted">
          {i.lastFlushedAt ? (
            <>
              โบล่าสุด {fmtYmd(i.lastYmd)} ·{" "}
              <span className={clear ? "text-pp-clear-ink" : "text-pp-turbid-ink"}>{clear ? "ใสแล้ว" : "ยังขุ่น"}</span>
              {" · "}
              {teamLabel}
            </>
          ) : (
            "ไม่มีประวัติการโบ"
          )}
        </span>
      </span>
      <span className="flex-none text-right">
        {i.dueYmd && <span className="block text-sm font-semibold">{fmtYmd(i.dueYmd, { weekday: "short", day: "numeric", month: "short" })}</span>}
        <span className={`block text-[13px] ${i.bucket === "overdue" ? "font-semibold text-pp-danger" : "text-pp-muted"}`}>
          {dueText(i)}
        </span>
      </span>
    </li>
  );
}

function QueueSection({ reloadKey }) {
  const { loading, data, error } = useJson(`/api/smart-papar/flushing/queue?k=${reloadKey}`);
  const [team, setTeam] = useState("all");
  const teamLabel = useMemo(() => {
    const m = new Map((data?.teams || []).map((t) => [t.key, t.label]));
    return (k) => m.get(k) || "ยังไม่จัดทีม";
  }, [data]);
  const filters = useMemo(() => {
    const byTeam = data?.counts.byTeam || {};
    return [
      { key: "all", label: "ทุกทีม", count: data?.items.length ?? 0 },
      ...(data?.teams || []).map((t) => ({ key: t.key, label: t.label, count: byTeam[t.key] || 0 })),
      { key: "", label: "ยังไม่มีทีมรับผิดชอบ", count: byTeam[""] || 0 },
    ];
  }, [data]);
  const shown = (data?.items || []).filter((i) => team === "all" || i.teamKey === team);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-tk-sans text-2xl font-bold">คิวงานโบตะกอนประจำ</h2>
        <p className="text-sm text-pp-muted">
          นับจากวันโบครั้งล่าสุดของแต่ละหัว: ใสแล้ว อีก {CYCLE_DAYS.clear} วัน · ยังขุ่น อีก {CYCLE_DAYS.still_turbid} วัน ·
          จ่ายให้ทีมที่โบหัวนั้นครั้งล่าสุด
        </p>
      </div>

      <div role="group" aria-label="กรองตามทีม" className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key || "none"}
            type="button"
            aria-pressed={team === f.key}
            onClick={() => setTeam(f.key)}
            className={`h-10 rounded-full border px-4 text-sm ${
              team === f.key ? "border-pp-deep bg-pp-deep font-semibold text-white" : "border-pp-line bg-white hover:bg-pp-ground"
            }`}
          >
            {f.label} <span className="tabular-nums opacity-75">{f.count}</span>
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-white px-4 py-3 text-pp-danger">{error}</p>}
      {loading && !data && <p className="py-8 text-center text-pp-muted">กำลังโหลด…</p>}

      {data && (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {QUEUE_SECTIONS.map((s) => {
            const items = shown.filter((i) => i.bucket === s.key);
            const Icon = s.key === "blocked" ? TriangleAlert : s.key === "later" || s.key === "never" ? Check : CalendarClock;
            return (
              <details
                key={s.key}
                open={s.open && items.length > 0}
                className="group overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(11,34,51,0.06)]"
              >
                <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3">
                  <Icon size={19} className={s.tone} aria-hidden />
                  <span className={`flex-1 font-semibold ${s.tone}`}>{QUEUE_BUCKET_LABELS[s.key]}</span>
                  <span className="font-tk-sans text-xl font-bold tabular-nums">{items.length}</span>
                  <ChevronDown size={18} className="text-pp-muted transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                {items.length > 0 && (
                  <ul className="max-h-[360px] divide-y divide-pp-line overflow-y-auto border-t border-pp-line">
                    {items.map((i) => (
                      <QueueRow key={i.pointId} i={i} teamLabel={teamLabel(i.teamKey)} />
                    ))}
                  </ul>
                )}
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function FlushingReport() {
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  return (
    <div className="space-y-8">
      <SummarySection onOpenTeams={() => setTeamsOpen(true)} reloadKey={reloadKey} />
      <QueueSection reloadKey={reloadKey} />
      {teamsOpen && (
        <FlushingTeamsModal
          onClose={() => setTeamsOpen(false)}
          onSaved={() => {
            setTeamsOpen(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
