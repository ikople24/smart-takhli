// แท็บ "รายงานและคิวงาน" ในหน้าโบตะกอน (?tab=report) — สำหรับผู้บริหาร/หัวหน้างาน
// ดีไซน์ 2026-10-29: งานที่ต้องจัดการก่อน (โบซ้ำ / ส่งซ่อม / เคลียร์พื้นที่ / ตรวจสอบ / ครบรอบประจำ) → ผลงานรายวัน/รายเดือนแยกทีม
// คิวและสรุปคำนวณฝั่ง server (lib/smart-papar/flushingSchedule.js) · การแบ่งกลุ่มงาน lib/smart-papar/flushingWork.js
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { CalendarDays, ChevronDown, Image as ImageIcon, List, MapPin, Users } from "lucide-react";
import { bangkokYmd, TURBID_CAUSE_LABELS } from "@/lib/smart-papar/flushing";
import { CYCLE_DAYS } from "@/lib/smart-papar/flushingSchedule";
import { WORK_GROUPS, groupWork } from "@/lib/smart-papar/flushingWork";
import FlushingDueCalendar from "./FlushingDueCalendar";
import FlushingTeamsModal from "./FlushingTeamsModal";
import MonthPicker from "./MonthPicker";
import PhotoLightbox from "./PhotoLightbox";

const FlushingWorkMap = dynamic(() => import("./FlushingWorkMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-pp-ground" />,
});

const fmtYmd = (ymd, opts = { day: "numeric", month: "short" }) =>
  new Date(`${ymd}T12:00:00+07:00`).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", ...opts });
const fmtMonth = (month) => fmtYmd(`${month}-01`, { month: "long", year: "numeric" });
const hasVal = (v) => v !== null && v !== undefined && v !== "";

// สีทีมในกราฟ — ตามลำดับทีม · ยังไม่จัดทีม = เทา (ต่างกันที่ความสว่าง ไม่พึ่งสีอย่างเดียว)
const TEAM_COLORS = ["#08465A", "#6FB3C4", "#A7B4BE"];
const NO_TEAM_COLOR = "#C9D6DE";
const HOT_AGE_DAYS = 5;

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

function Pill({ on, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-10 rounded-full border-[1.5px] px-3.5 text-sm ${
        on ? "border-pp-deep bg-pp-deep font-semibold text-white" : "border-pp-line bg-white hover:bg-pp-ground"
      }`}
    >
      {children}
    </button>
  );
}

// ---------- งานที่ต้องจัดการ ----------

function badgeOf(g, i) {
  if (g.sort === "due") {
    const d = i.daysLeft;
    if (d == null) return { text: "–", hot: false };
    if (d < 0) return { text: `เลย ${-d} วัน`, hot: true };
    if (d === 0) return { text: "วันนี้", hot: false };
    return { text: `อีก ${d} วัน`, hot: false };
  }
  return { text: `ค้าง ${i.ageDays ?? 0} วัน`, hot: (i.ageDays ?? 0) >= HOT_AGE_DAYS };
}

function metaOf(g, i) {
  const date = i.lastYmd ? fmtYmd(i.lastYmd) : "-";
  if (g.sort === "due") {
    const ntu =
      hasVal(i.lastNtuBefore) || hasVal(i.lastNtuAfter)
        ? `${hasVal(i.lastNtuBefore) ? i.lastNtuBefore : "-"} → ${hasVal(i.lastNtuAfter) ? i.lastNtuAfter : "-"} NTU`
        : "ไม่ได้วัด NTU";
    return [`โบล่าสุด ${date}`, i.lastResult === "clear" ? "ใสแล้ว" : ntu, i.times > 1 ? `ครั้งที่ ${i.times}` : null]
      .filter(Boolean)
      .join(" · ");
  }
  const cause = TURBID_CAUSE_LABELS[i.lastTurbidCause] || "ไม่ระบุสาเหตุ";
  const note = i.lastNote ? ` · ${i.lastNote.length > 60 ? `${i.lastNote.slice(0, 60)}…` : i.lastNote}` : "";
  return `แจ้ง ${date} · ${cause}${note}`;
}

function WorkTile({ g, count, flag, on, onClick, loading }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="flex min-h-[150px] flex-col items-start gap-1.5 rounded-[18px] border-2 p-4 text-left"
      style={on ? { background: g.tint, borderColor: g.color } : { background: "#FFFFFF", borderColor: "transparent" }}
    >
      <span className="flex w-full items-center gap-2">
        <span className="h-3 w-3 flex-none rounded" style={{ background: g.color }} />
        <span className="flex-1 text-[15px] font-semibold">{g.label}</span>
      </span>
      <span className="flex items-baseline gap-1.5">
        <span
          className="font-tk-sans text-[40px] font-bold leading-none tabular-nums"
          style={{ color: g.key === "routine" || g.key === "inspect" ? "#0B2233" : g.color }}
        >
          {loading ? "–" : count}
        </span>
        <span className="text-[15px] text-pp-muted">จุด</span>
      </span>
      <span className="text-[13px] leading-normal text-pp-muted">{g.hint}</span>
      {flag && (
        <span className="mt-auto rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ background: g.color }}>
          {flag}
        </span>
      )}
    </button>
  );
}

function WorkSection({ reloadKey }) {
  const today = bangkokYmd(new Date());
  const { loading, data, error } = useJson(`/api/smart-papar/flushing/queue?k=${reloadKey}`);
  const [team, setTeam] = useState("all");
  const [groupKey, setGroupKey] = useState("reflush");
  const [focusId, setFocusId] = useState(null);
  const [photos, setPhotos] = useState({ list: [], index: null });
  const [routineView, setRoutineView] = useState("calendar"); // ครบรอบประจำ: calendar | list

  const teamLabel = useMemo(() => {
    const m = new Map((data?.teams || []).map((t) => [t.key, t.label]));
    return (k) => m.get(k) || "ยังไม่จัดทีม";
  }, [data]);
  // สีทีมเดียวกับกราฟผลงานด้านล่าง
  const teamColor = useMemo(() => {
    const m = new Map((data?.teams || []).map((t, idx) => [t.key, TEAM_COLORS[idx] || TEAM_COLORS[TEAM_COLORS.length - 1]]));
    return (k) => m.get(k) || NO_TEAM_COLOR;
  }, [data]);

  const allItems = useMemo(() => data?.items || [], [data]);
  const hasNoTeam = allItems.some((i) => !i.teamKey && i.bucket !== "never");
  const teamFilters = [
    { key: "all", label: "ทุกทีม" },
    ...(data?.teams || []).map((t) => ({ key: t.key, label: t.label })),
    ...(hasNoTeam ? [{ key: "", label: "ยังไม่จัดทีม" }] : []),
  ];
  const activeTeam = teamFilters.some((f) => f.key === team) ? team : "all";
  const filtered = useMemo(
    () =>
      activeTeam === "all" ? allItems : allItems.filter((i) => i.teamKey === activeTeam && i.bucket !== "never"),
    [allItems, activeTeam]
  );
  const work = useMemo(() => groupWork(filtered, today), [filtered, today]);
  const g = WORK_GROUPS.find((w) => w.key === groupKey) || WORK_GROUPS[0];
  const list = work.items[g.key];
  const o = work.overview;

  const flagOf = (w) => {
    if (w.sort === "due") return work.overdue[w.key] ? `เลยกำหนด ${work.overdue[w.key]} จุด` : "";
    return work.oldestDays[w.key] ? `ค้างนานสุด ${work.oldestDays[w.key]} วัน` : "";
  };

  const overviewParts = [
    { key: "inCycle", label: "ใส อยู่ในรอบ", value: o.inCycle, color: "#0B6E75" },
    { key: "routine", label: "ครบรอบประจำ", value: o.routine, color: "rgba(14,110,134,0.45)" },
    { key: "followUp", label: "ต้องตามซ้ำ/แก้ไข", value: o.followUp, color: "#B45309" },
    ...(activeTeam === "all" ? [{ key: "never", label: "ยังไม่เคยโบ", value: o.never, color: "#DCE5EB" }] : []),
  ];

  return (
    <section aria-label="งานที่ต้องจัดการ" className="space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-tk-sans text-2xl font-bold">งานที่ต้องจัดการ</h2>
          <p className="text-sm text-pp-muted">
            ข้อมูล ณ วันนี้ {fmtYmd(today, { day: "numeric", month: "short", year: "2-digit" })} · จากผลโบครั้งล่าสุดของแต่ละหัว
            (รอบ: ใสแล้ว {CYCLE_DAYS.clear} วัน · ยังขุ่น {CYCLE_DAYS.still_turbid} วัน)
          </p>
        </div>
        <div role="group" aria-label="กรองทีม" className="flex flex-wrap gap-1.5">
          {teamFilters.map((f) => (
            <Pill key={f.key || "none"} on={activeTeam === f.key} onClick={() => setTeam(f.key)}>
              {f.label}
            </Pill>
          ))}
        </div>
      </div>

      {error && <p className="rounded-xl bg-white px-4 py-3 text-pp-danger">{error}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {WORK_GROUPS.map((w) => (
          <WorkTile
            key={w.key}
            g={w}
            count={work.counts[w.key]}
            flag={loading ? "" : flagOf(w)}
            loading={loading && !data}
            on={w.key === g.key}
            onClick={() => {
              setGroupKey(w.key);
              setFocusId(null);
            }}
          />
        ))}
      </div>

      {data && o.total > 0 && (
        <div className="space-y-2 rounded-2xl bg-white px-4 py-3.5">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <span className="font-semibold">
              {activeTeam === "all" ? `ภาพรวมหัวโบล์ทั้งหมด ${o.total} หัว` : `หัวที่${teamLabel(activeTeam)}โบล่าสุด ${o.total - o.never} หัว`}
            </span>
            <span className="flex flex-wrap gap-3.5 text-[13px] text-pp-muted">
              {overviewParts.map((p) => (
                <span key={p.key} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
                  {p.label} {p.value}
                </span>
              ))}
            </span>
          </div>
          <div role="img" aria-label="สัดส่วนสถานะหัวโบล์" className="flex h-3.5 gap-0.5 overflow-hidden rounded-lg">
            {overviewParts
              .filter((p) => p.value > 0)
              .map((p) => (
                <span key={p.key} className="block" style={{ flex: p.value, background: p.color }} />
              ))}
          </div>
        </div>
      )}

      {g.key === "routine" && (
        <div role="group" aria-label="มุมมองครบรอบประจำ" className="flex gap-1 self-start rounded-xl border border-pp-line bg-white p-1">
          {[
            { key: "calendar", label: "ปฏิทินทีม", Icon: CalendarDays },
            { key: "list", label: "รายการ + แผนที่", Icon: List },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={routineView === key}
              onClick={() => setRoutineView(key)}
              className={`flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm ${
                routineView === key ? "bg-pp-deep font-semibold text-white" : "text-pp-muted hover:bg-pp-ground"
              }`}
            >
              <Icon size={16} aria-hidden />
              {label}
            </button>
          ))}
        </div>
      )}

      {g.key === "routine" && routineView === "calendar" ? (
        <div className="overflow-hidden rounded-[20px] bg-white">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-pp-line px-4 py-3.5">
            <span className="h-3 w-3 flex-none rounded" style={{ background: g.color }} />
            <h3 className="flex-1 font-tk-sans text-lg font-semibold">ปฏิทินครบรอบ — ทีมไหนต้องไปจุดไหน</h3>
            <span className="text-[13px] text-pp-muted">ใสแล้วครบ {CYCLE_DAYS.clear} วัน · แตะวันเพื่อดูรายชื่อหัว</span>
          </div>
          {loading && !data ? (
            <p className="py-10 text-center text-pp-muted">กำลังโหลด…</p>
          ) : (
            <FlushingDueCalendar
              items={filtered}
              today={today}
              teams={[
                ...(data?.teams || []),
                ...(filtered.some((i) => !i.teamKey && i.bucket !== "never") ? [{ key: "", label: "ยังไม่จัดทีม" }] : []),
              ]}
              teamLabel={teamLabel}
              teamColor={teamColor}
            />
          )}
        </div>
      ) : (
      <div className="flex flex-wrap items-stretch gap-4">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col overflow-hidden rounded-[20px] bg-white">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-pp-line px-4 py-3.5">
            <span className="h-3 w-3 flex-none rounded" style={{ background: g.color }} />
            <h3 className="flex-1 font-tk-sans text-lg font-semibold">
              {g.label} · {loading && !data ? "–" : list.length} จุด
            </h3>
            <span className="text-[13px] text-pp-muted">{g.sort === "due" ? "เรียงตามวันครบกำหนด" : "เรียงค้างนานก่อน"}</span>
          </div>
          {loading && !data ? (
            <p className="py-10 text-center text-pp-muted">กำลังโหลด…</p>
          ) : list.length === 0 ? (
            <p className="py-10 text-center text-pp-muted">ไม่มีจุดในกลุ่มนี้</p>
          ) : (
            <ul className="max-h-[560px] divide-y divide-pp-line/70 overflow-y-auto">
              {list.map((i) => {
                const b = badgeOf(g, i);
                const on = String(i.pointId) === String(focusId);
                return (
                  <li
                    key={i.pointId}
                    className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${on ? "bg-pp-tint-2" : ""}`}
                  >
                    <span
                      className="min-w-[84px] flex-none rounded-full px-2.5 py-1 text-center text-[13px] font-semibold"
                      style={
                        b.hot
                          ? { background: g.color, color: "#FFFFFF" }
                          : { background: g.tint, color: g.color, boxShadow: `inset 0 0 0 1px ${g.color}33` }
                      }
                    >
                      {b.text}
                    </span>
                    <span className="min-w-0 flex-[1_1_240px]">
                      <span className="block text-[15px]">
                        <span className="font-tk-mono text-sm">{i.code}</span>
                        {(i.name || i.roadName) && ` · ${i.name || i.roadName}`}
                      </span>
                      <span className="block text-[13px] text-pp-muted">{metaOf(g, i)}</span>
                    </span>
                    <span className="min-w-[110px] text-[13px] text-pp-muted">{teamLabel(i.teamKey)}</span>
                    <span className="flex gap-1.5">
                      {i.lastPhotos?.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setPhotos({ list: i.lastPhotos.map((src) => ({ src, caption: `${i.code} · ${fmtYmd(i.lastYmd)}` })), index: 0 })
                          }
                          className="flex h-9 items-center gap-1 rounded-[10px] border-[1.5px] border-pp-line px-3 text-[13px]"
                        >
                          <ImageIcon size={15} aria-hidden />
                          รูปล่าสุด
                        </button>
                      )}
                      {i.coordinates && (
                        <button
                          type="button"
                          onClick={() => setFocusId(i.pointId)}
                          className="flex h-9 items-center gap-1 rounded-[10px] border-[1.5px] border-pp-line px-3 text-[13px] font-semibold text-pp-water"
                        >
                          <MapPin size={15} aria-hidden />
                          ดูบนแผนที่
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-auto px-4 py-3 text-[13px] text-pp-muted">
            {g.key === "reflush"
              ? `ครบกำหนด = ${CYCLE_DAYS.still_turbid} วันหลังโบครั้งล่าสุด · โบแล้วใส หัวนั้นจะออกจากรายการเอง`
              : g.key === "routine"
              ? `ใสแล้วครบ ${CYCLE_DAYS.clear} วัน (แสดงที่เลยกำหนด/วันนี้/7 วันข้างหน้า)`
              : "แก้ไขแล้วให้ทีมไปโบใหม่ 1 ครั้ง ผลใหม่จะพาหัวออกจากกลุ่มนี้เอง"}
          </p>
        </div>

        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-2 rounded-[20px] bg-white p-2">
          <div className="relative h-[420px] overflow-hidden rounded-[14px] lg:h-[480px]">
            {data && (
              <FlushingWorkMap
                items={allItems}
                group={list}
                color={g.color}
                focusId={focusId}
                onSelect={setFocusId}
                className="h-full w-full"
              />
            )}
          </div>
          <span className="px-2 pb-1.5 text-[13px] text-pp-muted">จุดสี = {g.label} · จุดเทา = หัวอื่น · กดหมุดเพื่อไฮไลต์รายการ</span>
        </div>
      </div>
      )}

      <PhotoLightbox
        images={photos.list}
        index={photos.index}
        onChange={(index) => setPhotos((p) => ({ ...p, index }))}
        onClose={() => setPhotos({ list: [], index: null })}
      />
    </section>
  );
}

// ---------- ผลงาน ----------

function PerformanceSection({ onOpenTeams, reloadKey }) {
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
  const maxPoints = Math.max(1, ...rows.map((r) => r.points || 0));
  const teamCols = (data?.teams || [])
    .map((t, idx) => ({ ...t, color: TEAM_COLORS[idx] || TEAM_COLORS[TEAM_COLORS.length - 1] }))
    .concat(rows.some((r) => !r.key) ? [{ key: "", label: "ยังไม่จัดทีม", color: NO_TEAM_COLOR }] : []);
  const days = (data?.daily || []).filter((d) => d.ymd <= today);
  const maxDay = Math.max(1, ...days.map((d) => d.total.flushCount || 0));

  return (
    <section aria-label="ผลงานโบตะกอน" className="space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-tk-sans text-2xl font-bold">ผลงาน</h2>
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
            <MonthPicker value={month} max={today.slice(0, 7)} onChange={setMonth} />
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

      <div className="flex flex-wrap items-stretch gap-4">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4 rounded-[20px] bg-white p-[18px]">
          <div className="grid grid-cols-2 gap-3.5">
            {[
              { label: "โบทั้งหมด", value: dash(total?.flushCount), unit: "ครั้ง" },
              { label: "หัวที่ระบาย", value: dash(total?.points), unit: "หัว" },
              {
                label: "ใสแล้ว",
                value: dash(total?.clearPoints),
                unit: clearPct != null ? `หัว · ${clearPct}%` : "หัว",
                cls: "text-pp-clear-ink",
              },
              { label: "ยังขุ่น", value: dash(total?.turbidPoints), unit: "หัว", cls: "text-pp-turbid-ink" },
            ].map((k) => (
              <div key={k.label} className="min-w-0">
                <div className="text-[13px] text-pp-muted">{k.label}</div>
                <div className={`font-tk-sans text-[34px] font-bold leading-tight tabular-nums ${k.cls || ""}`}>
                  {k.value} <span className="text-[15px] font-semibold text-pp-muted">{k.unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="h-px bg-pp-line" />
          <div className="space-y-3">
            <span className="block text-sm font-semibold">เทียบทีม (หัวที่ระบาย)</span>
            {rows.length === 0 && !loading && <p className="text-sm text-pp-muted">ยังไม่มีงานในช่วงนี้</p>}
            {rows.map((r) => (
              <div key={r.key || "none"} className="space-y-1.5">
                <div className="flex justify-between gap-2 text-sm">
                  <span className={r.key ? "" : "text-pp-muted"}>{r.label}</span>
                  <span className="text-pp-muted">
                    {r.flushCount} ครั้ง · <b className="text-pp-ink">{r.points} หัว</b>
                  </span>
                </div>
                <div
                  className="flex h-3 overflow-hidden rounded-md bg-pp-ground"
                  role="img"
                  aria-label={`${r.label} ใสแล้ว ${r.clearPoints} หัว ยังขุ่น ${r.turbidPoints} หัว`}
                >
                  <span className="block bg-pp-clear" style={{ width: `${((r.clearPoints || 0) / maxPoints) * 100}%` }} />
                  <span className="block bg-pp-turbid" style={{ width: `${((r.turbidPoints || 0) / maxPoints) * 100}%` }} />
                </div>
              </div>
            ))}
            <span className="block text-xs text-pp-muted">
              แท่งเขียว = ใสแล้ว · แท่งอำพัน = ยังขุ่น (ตามผลล่าสุดของหัวในช่วงนี้)
              {rows.some((r) => !r.key) && " · “ยังไม่จัดทีม” = คนบันทึกที่ยังไม่ได้เลือกทีม กด “ตั้งค่าทีม”"}
            </span>
          </div>
        </div>

        {period === "month" && (
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3 rounded-[20px] bg-white p-[18px]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[15px] font-semibold">จำนวนครั้งที่โบ รายวัน</span>
              <span className="flex flex-wrap gap-3.5 text-[13px] text-pp-muted">
                {teamCols.map((t) => (
                  <span key={t.key || "none"} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} />
                    {t.label}
                  </span>
                ))}
              </span>
            </div>
            {days.length === 0 ? (
              <p className="py-10 text-center text-pp-muted">{loading ? "กำลังโหลด…" : "ยังไม่มีข้อมูล"}</p>
            ) : (
              <>
                <div className="flex h-[200px] items-end gap-1 border-b border-pp-line">
                  {days.map((d) => (
                    <div
                      key={d.ymd}
                      className="flex h-full min-w-0 flex-1 flex-col-reverse"
                      title={`${fmtYmd(d.ymd, { weekday: "short", day: "numeric", month: "short" })} · ${d.total.flushCount} ครั้ง`}
                    >
                      {teamCols.map((t) => {
                        const c = d.byTeam[t.key]?.flushCount || 0;
                        return c ? (
                          <span key={t.key || "none"} className="block" style={{ height: `${(c / maxDay) * 100}%`, background: t.color }} />
                        ) : null;
                      })}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-pp-muted">
                  <span>{fmtYmd(days[0].ymd)}</span>
                  <span>{fmtYmd(days[days.length - 1].ymd)}</span>
                </div>
                <details className="group">
                  <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-pp-water">
                    ดูตารางรายวันแยกทีม
                    <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="max-h-[420px] overflow-auto">
                    <table className="w-full min-w-[520px] text-[15px]">
                      <thead className="sticky top-0 bg-white text-left text-sm text-pp-muted shadow-[0_1px_0_var(--color-pp-line)]">
                        <tr>
                          <th className="px-3 py-2 font-semibold">วันที่</th>
                          {teamCols.map((t) => (
                            <th key={t.key || "none"} className="px-3 py-2 text-right font-semibold">
                              {t.label}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-right font-semibold">รวม</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-pp-line tabular-nums">
                        {[...days].reverse().map((d) => (
                          <tr key={d.ymd} className={d.total.flushCount ? "" : "text-pp-muted/60"}>
                            <td className="px-3 py-2">{fmtYmd(d.ymd, { weekday: "short", day: "numeric", month: "short" })}</td>
                            {teamCols.map((t) => {
                              const c = d.byTeam[t.key];
                              return (
                                <td key={t.key || "none"} className="px-3 py-2 text-right">
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
                            <td className="px-3 py-2 text-right font-semibold">
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
                </details>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default function FlushingReport() {
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  return (
    <div className="space-y-8">
      <WorkSection reloadKey={reloadKey} />
      <PerformanceSection onOpenTeams={() => setTeamsOpen(true)} reloadKey={reloadKey} />
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
