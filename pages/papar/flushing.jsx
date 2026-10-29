// หน้าบันทึกโบตะกอนสำหรับเจ้าหน้าที่ภาคสนาม — ไม่ต้องล็อกอิน ใส่รหัสครั้งเดียวแล้วเครื่องจำไว้ (cookie 180 วัน)
// อยู่นอก /admin โดยตั้งใจ (_app ไม่บังคับ Clerk) · สิทธิ์จริงตรวจที่ /api/smart-papar/field/*
// สรุป "รอบนี้" นับจากสิ่งที่ส่งในหน้านี้เท่านั้น (เจ้าหน้าที่ภาคสนามไม่มีสิทธิ์อ่านรายการจาก API)
import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { CalendarClock, Check, ChevronLeft, ChevronRight, Droplet, Navigation, Plus, TriangleAlert } from "lucide-react";
import FlushingForm from "@/components/smart-papar/FlushingForm";
import { durationText, ntuChangePct } from "@/lib/smart-papar/flushing";
import { fieldTaskOf } from "@/lib/smart-papar/flushingWork";

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

const inputCls =
  "h-[52px] w-full rounded-xl border-[1.5px] border-pp-line-2 bg-white px-3.5 text-[17px] text-pp-ink focus:border-pp-water focus:outline-none focus:ring-4 focus:ring-pp-tint";

function pointTitle(s) {
  const code = s.flushPointCode;
  const name = code ? String(s.locationName || "").replace(` (${code})`, "").trim() : s.locationName;
  return { code, name };
}

function ResultChip({ result }) {
  const clear = result === "clear";
  const Icon = clear ? Check : TriangleAlert;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${
        clear ? "bg-pp-clear-tint text-pp-clear-ink" : "bg-pp-turbid-tint text-pp-turbid-ink"
      }`}
    >
      <Icon size={14} strokeWidth={2.6} aria-hidden />
      {clear ? "ใสแล้ว" : "ยังขุ่น"}
    </span>
  );
}

const fmtDue = (ymd) =>
  new Date(`${ymd}T12:00:00+07:00`).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });

const UPCOMING_PREVIEW = 3;

// ประเภทงานในคิวทีม (lib/smart-papar/flushingWork.js#fieldTaskOf) — สีต่างกันที่ความสว่าง + มีป้ายข้อความเสมอ
const TASKS = {
  reflush: { label: "โบซ้ำ", hint: "ครั้งก่อนยังขุ่น ระบายให้นานขึ้น", chip: "bg-pp-turbid-tint text-pp-turbid-ink" },
  inspect: { label: "ตรวจสอบ", hint: "ครั้งก่อนยังขุ่น ดูสภาพหน้างานก่อน", chip: "bg-[#E7ECF0] text-pp-ink" },
  routine: { label: "ครบรอบ", hint: "ใสแล้ว ระบายตามรอบ 15 วัน", chip: "bg-pp-tint text-pp-water" },
};
const mapsUrl = (c) => `https://www.google.com/maps/dir/?api=1&destination=${c[1]},${c[0]}`;

function TaskCard({ i, onPick }) {
  const t = TASKS[fieldTaskOf(i)];
  const late = i.bucket === "overdue";
  const due = late ? `เลยกำหนด ${-i.daysLeft} วัน` : i.bucket === "today" ? "ครบวันนี้" : `ครบ ${fmtDue(i.dueYmd)} (อีก ${i.daysLeft} วัน)`;
  const last =
    i.lastResult === "clear"
      ? "ใสแล้ว"
      : `ยังขุ่น${i.lastNtuAfter !== null && i.lastNtuAfter !== undefined ? ` ${i.lastNtuAfter} NTU` : ""}`;
  return (
    <li className="space-y-2.5 rounded-2xl bg-white p-3.5">
      <div className="flex items-start gap-2.5">
        <span className={`flex-none rounded-full px-2.5 py-1 text-[13px] font-semibold ${t.chip}`}>{t.label}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">
            <span className="font-tk-mono text-sm">{i.code}</span>
            {i.name && ` · ${i.name}`}
          </span>
          {i.roadName && <span className="block truncate text-[13px] text-pp-muted">{i.roadName}</span>}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-pp-muted">
        <span className={late ? "font-semibold text-pp-danger" : "font-semibold text-pp-ink"}>{due}</span>
        {i.lastYmd && ` · ครั้งก่อน ${fmtDue(i.lastYmd)} ${last}`}
        <span className="block">{t.hint}</span>
      </p>
      <div className="flex gap-2">
        {i.coordinates && (
          <a
            href={mapsUrl(i.coordinates)}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-pp-line-2 text-sm font-semibold text-pp-ink"
          >
            <Navigation size={17} aria-hidden />
            นำทาง
          </a>
        )}
        <button
          type="button"
          onClick={() => onPick(i.pointId)}
          className="flex h-11 flex-[1.4] items-center justify-center gap-1.5 rounded-xl bg-pp-water text-sm font-semibold text-white"
        >
          <Plus size={17} strokeWidth={2.4} aria-hidden />
          บันทึกผลหัวนี้
        </button>
      </div>
    </li>
  );
}

// งานที่ต้องไป — คิวของทีมที่ชื่อนี้สังกัด (โบซ้ำ / ตรวจสอบ: รอบ 5 วัน · ครบรอบ: ใสแล้ว 15 วัน)
// หัวที่รอแก้ไข (สิ่งกีดขวาง/หัวชำรุด) ไม่อยู่ในคิวภาคสนาม — หัวหน้าจัดการจากแท็บรายงาน
function TeamQueue({ queue, onPick }) {
  const [type, setType] = useState("all");
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  if (!queue) return null;
  if (!queue.team) {
    return (
      <div className="rounded-2xl border-[1.5px] border-dashed border-pp-line-2 bg-white px-4 py-3 text-sm text-pp-muted">
        ชื่อนี้ยังไม่ได้จัดทีม จึงยังไม่มีรายการงาน — แจ้งแอดมินให้จัดทีมในระบบ
      </div>
    );
  }
  const counts = { all: queue.items.length, reflush: 0, inspect: 0, routine: 0 };
  for (const i of queue.items) counts[fieldTaskOf(i)] += 1;
  const shown = queue.items.filter((i) => type === "all" || fieldTaskOf(i) === type);
  const now = shown.filter((i) => i.bucket === "overdue" || i.bucket === "today");
  const upcoming = shown.filter((i) => i.bucket === "upcoming");
  const upcomingList = showAllUpcoming ? upcoming : upcoming.slice(0, UPCOMING_PREVIEW);

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <h2 className="font-tk-sans text-lg font-semibold">งานที่ต้องไป</h2>
        <span className="text-[13px] text-pp-muted">{queue.team.label}</span>
      </div>
      {queue.items.length === 0 ? (
        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-pp-muted">ไม่มีหัวที่ต้องไปใน 7 วันนี้</div>
      ) : (
        <>
          <div role="group" aria-label="ประเภทงาน" className="flex gap-1.5 overflow-x-auto pb-0.5">
            {[
              { key: "all", label: "ทั้งหมด" },
              { key: "reflush", label: TASKS.reflush.label },
              { key: "inspect", label: TASKS.inspect.label },
              { key: "routine", label: TASKS.routine.label },
            ]
              .filter((f) => f.key === "all" || counts[f.key] > 0)
              .map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={type === f.key}
                  onClick={() => setType(f.key)}
                  className={`h-10 flex-none rounded-full border-[1.5px] px-3.5 text-sm ${
                    type === f.key ? "border-pp-deep bg-pp-deep font-semibold text-white" : "border-pp-line bg-white"
                  }`}
                >
                  {f.label} <span className="tabular-nums opacity-75">{counts[f.key]}</span>
                </button>
              ))}
          </div>

          <section className="space-y-2" aria-label="ต้องไปวันนี้">
            <h3 className="flex items-center gap-1.5 text-[15px] font-semibold">
              <CalendarClock size={18} className="text-pp-turbid-ink" aria-hidden />
              ต้องไปวันนี้ <span className="tabular-nums text-pp-muted">{now.length}</span>
            </h3>
            {now.length === 0 ? (
              <p className="rounded-2xl bg-white px-4 py-3 text-sm text-pp-muted">วันนี้ไม่มีหัวที่ครบรอบ</p>
            ) : (
              <ul className="space-y-2">
                {now.map((i) => (
                  <TaskCard key={i.pointId} i={i} onPick={onPick} />
                ))}
              </ul>
            )}
          </section>

          {upcoming.length > 0 && (
            <section className="space-y-2" aria-label="7 วันข้างหน้า">
              <h3 className="text-[15px] font-semibold">
                7 วันข้างหน้า <span className="tabular-nums text-pp-muted">{upcoming.length}</span>
              </h3>
              <ul className="space-y-2">
                {upcomingList.map((i) => (
                  <TaskCard key={i.pointId} i={i} onPick={onPick} />
                ))}
              </ul>
              {upcoming.length > UPCOMING_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAllUpcoming((v) => !v)}
                  className="min-h-11 w-full text-sm font-semibold text-pp-water"
                >
                  {showAllUpcoming ? "ย่อรายการ" : `ดูทั้งหมด ${upcoming.length} หัว`}
                </button>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function UnlockForm({ onUnlocked }) {
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/smart-papar/field/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.message || "ยืนยันไม่สำเร็จ");
        return;
      }
      onUnlocked(data.name);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-76px)] flex-col gap-6">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <span className="grid h-[72px] w-[72px] place-items-center rounded-3xl bg-pp-deep text-pp-sky">
          <Droplet size={36} strokeWidth={1.8} aria-hidden />
        </span>
        <div className="text-sm text-pp-muted">กองการประปา · เทศบาลเมืองตาคลี</div>
        <h1 className="font-tk-sans text-3xl font-bold">บันทึกโบตะกอน</h1>
        <p className="max-w-[300px] text-[15px] leading-relaxed text-pp-muted">
          ใส่รหัสเจ้าหน้าที่ครั้งเดียว เครื่องนี้จะจำไว้ ครั้งต่อไปกดบันทึกได้ทันที
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(11,34,51,0.06)]">
        <div className="space-y-1.5">
          <label htmlFor="field-name" className="block text-sm font-semibold">ชื่อเจ้าหน้าที่</label>
          <input
            id="field-name"
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="field-pin" className="block text-sm font-semibold">รหัสเจ้าหน้าที่</label>
          <input
            id="field-pin"
            className={`${inputCls} text-[22px] tracking-[8px]`}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-pp-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="h-14 w-full rounded-2xl bg-pp-water font-tk-sans text-[19px] font-bold text-white disabled:opacity-60"
        >
          {busy ? "กำลังตรวจสอบ…" : "ยืนยัน"}
        </button>
      </form>

      {/* การ์ดน้ำประปาบนหน้าแรกพาทุกคนมาที่นี่ — ประชาชนที่เจอน้ำขุ่นต้องมีทางไปแจ้งเรื่อง */}
      <div className="mt-auto flex items-start gap-3 rounded-2xl border-[1.5px] border-pp-turbid-line bg-white px-4 py-3.5">
        <Droplet size={22} className="mt-0.5 flex-none text-pp-turbid-ink" aria-hidden />
        <span className="text-sm leading-relaxed">
          <span className="block font-semibold">ประชาชนพบน้ำขุ่นหรือน้ำไม่ไหล?</span>
          <Link href="/report" className="font-semibold text-pp-turbid-ink underline">
            แจ้งเรื่องร้องเรียนที่นี่
          </Link>
        </span>
      </div>
    </div>
  );
}

function SavedScreen({ last, count, onNext, onHome }) {
  const { code, name } = pointTitle(last);
  const pct = ntuChangePct(last.turbidityBeforeNtu, last.turbidityAfterNtu);
  const hasNtu = (v) => v !== null && v !== undefined && v !== "";
  const Shot = ({ url, label, ntu, ntuCls }) => (
    <div className="space-y-1.5">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="h-24 w-full rounded-xl object-cover" />
      ) : (
        <div className="grid h-24 place-items-center rounded-xl bg-pp-ground text-[13px] text-pp-muted">ไม่มีรูป</div>
      )}
      <span className="block text-[13px] text-pp-muted">
        {label}
        {hasNtu(ntu) && (
          <>
            {" · "}
            <span className={`font-semibold ${ntuCls}`}>{ntu} NTU</span>
          </>
        )}
      </span>
    </div>
  );
  return (
    <div className="flex min-h-[calc(100dvh-76px)] flex-col gap-6 pt-6">
      <div className="flex flex-col items-center gap-3.5 text-center">
        <span className="grid h-[104px] w-[104px] place-items-center rounded-full bg-pp-clear-tint">
          <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-pp-clear text-white">
            <Check size={38} strokeWidth={2.8} aria-hidden />
          </span>
        </span>
        <h1 className="font-tk-sans text-3xl font-bold" aria-live="polite">บันทึกแล้ว</h1>
        <p className="text-[15px] text-pp-muted">
          รอบนี้คุณส่งงานแล้ว <span className="font-semibold text-pp-ink">{count} รายการ</span>
        </p>
      </div>

      <div className="space-y-3.5 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(11,34,51,0.06)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {code && <div className="font-tk-mono">{code}</div>}
            <div className="truncate text-sm text-pp-muted">
              {name} · {fmtTime(last.flushedAt || Date.now())} · {durationText(last)}
            </div>
          </div>
          <ResultChip result={last.result} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Shot url={last.photosBefore?.[0]} label="ก่อน" ntu={last.turbidityBeforeNtu} ntuCls="text-pp-turbid-ink" />
          <Shot
            url={last.photosAfter?.[0]}
            label="หลัง"
            ntu={last.turbidityAfterNtu}
            ntuCls={last.result === "clear" ? "text-pp-clear-ink" : "text-pp-turbid-ink"}
          />
        </div>
        {pct != null && pct > 0 && <div className="text-[13px] text-pp-clear-ink">ความขุ่นลดลง {pct}%</div>}
      </div>

      <div className="mt-auto space-y-2.5">
        <button
          type="button"
          onClick={onNext}
          className="flex h-[58px] w-full items-center justify-center gap-2.5 rounded-2xl bg-pp-water font-tk-sans text-[19px] font-bold text-white"
        >
          <Plus size={22} strokeWidth={2.4} aria-hidden />
          บันทึกจุดถัดไป
        </button>
        <button
          type="button"
          onClick={onHome}
          className="h-[52px] w-full rounded-2xl border-[1.5px] border-pp-line-2 bg-white font-semibold text-pp-ink"
        >
          กลับหน้าหลัก
        </button>
      </div>
    </div>
  );
}

export default function FieldFlushingPage() {
  const [state, setState] = useState({ loading: true, unlocked: false, name: "" });
  const [formOpen, setFormOpen] = useState(false);
  const [formPointId, setFormPointId] = useState("");
  const [queue, setQueue] = useState(null); // null = ยังไม่โหลด/โหลดไม่ได้ → ไม่แสดงกล่องคิว
  const [saved, setSaved] = useState([]); // สิ่งที่ส่งในรอบนี้ ใหม่สุดก่อน
  const [showSaved, setShowSaved] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/smart-papar/field/me");
      const data = await res.json();
      setState({ loading: false, unlocked: Boolean(data?.unlocked), name: data?.name || "" });
    } catch {
      setState({ loading: false, unlocked: false, name: "" });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/smart-papar/field/queue");
      const data = await res.json();
      setQueue(res.ok && data?.success ? data : null);
    } catch {
      setQueue(null);
    }
  }, []);

  useEffect(() => {
    if (state.unlocked) loadQueue();
  }, [state.unlocked, loadQueue]);

  const openForm = (pointId = "") => {
    setFormPointId(pointId);
    setFormOpen(true);
  };

  const logout = async () => {
    await fetch("/api/smart-papar/field/me", { method: "DELETE" }).catch(() => {});
    setSaved([]);
    setShowSaved(false);
    refresh();
  };

  const clearCount = saved.filter((s) => s.result === "clear").length;
  const turbidCount = saved.length - clearCount;
  const initials = (state.name || "").trim().slice(0, 2);

  return (
    <>
      <Head>
        <title>บันทึกโบตะกอน | เทศบาลเมืองตาคลี</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-pp-ground text-pp-ink">
        <div className="mx-auto max-w-lg">
          {state.loading ? (
            <div className="py-20 text-center text-pp-muted">กำลังโหลด…</div>
          ) : !state.unlocked ? (
            <div className="px-5 pb-7 pt-4">
              <Link href="/" className="mb-4 inline-flex min-h-11 items-center gap-1 text-[15px] text-pp-water">
                <ChevronLeft size={20} aria-hidden />
                หน้าแรก
              </Link>
              <UnlockForm onUnlocked={() => refresh()} />
            </div>
          ) : showSaved && saved[0] ? (
            <div className="px-5 pb-7">
              <SavedScreen
                last={saved[0]}
                count={saved.length}
                onNext={() => {
                  setShowSaved(false);
                  openForm();
                }}
                onHome={() => setShowSaved(false)}
              />
            </div>
          ) : (
            <div className="flex min-h-screen flex-col">
              <div className="relative space-y-5 bg-pp-deep px-5 pb-8 pt-4 text-white">
                <div className="flex items-center justify-between">
                  <Link href="/" className="inline-flex min-h-11 items-center gap-1 text-[15px] text-pp-sky-2">
                    <ChevronLeft size={20} aria-hidden />
                    หน้าแรก
                  </Link>
                  <span className="flex items-center gap-2 rounded-full bg-white/10 py-1.5 pl-1.5 pr-3 text-sm">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-pp-sky-2 text-[13px] font-semibold text-pp-deep">
                      {initials}
                    </span>
                    {state.name}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-pp-sky">กองการประปา · เทศบาลเมืองตาคลี</div>
                  <h1 className="font-tk-sans text-[34px] font-bold leading-tight">โบตะกอน</h1>
                </div>
                <svg
                  className="absolute -bottom-px left-0 block h-[18px] w-full"
                  viewBox="0 0 390 18"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M0 10 C 40 2, 80 2, 120 10 S 200 18, 240 10 S 320 2, 390 10 L390 18 L0 18 Z"
                    className="fill-pp-ground"
                  />
                </svg>
              </div>

              <div className="flex flex-1 flex-col gap-4 px-5 pb-7 pt-3">
                <div className="space-y-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(11,34,51,0.06)]">
                  <div className="text-[15px] text-pp-muted">รอบนี้คุณบันทึกแล้ว</div>
                  <div className="flex items-end gap-4">
                    <div className="font-tk-sans text-5xl font-bold leading-none">
                      {saved.length}
                      <span className="ml-1.5 text-lg font-semibold text-pp-muted">จุด</span>
                    </div>
                    {saved.length > 0 && (
                      <div className="ml-auto flex gap-2 pb-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-pp-clear-tint px-2.5 py-1 text-sm font-semibold text-pp-clear-ink">
                          <Check size={14} strokeWidth={2.6} aria-hidden />ใส {clearCount}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-pp-turbid-tint px-2.5 py-1 text-sm font-semibold text-pp-turbid-ink">
                          <TriangleAlert size={14} strokeWidth={2.6} aria-hidden />ขุ่น {turbidCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openForm()}
                  className="flex items-center gap-4 rounded-2xl bg-pp-water p-5 text-left text-white shadow-[0_8px_20px_rgba(14,110,134,0.28)]"
                >
                  <span className="grid h-[52px] w-[52px] flex-none place-items-center rounded-2xl bg-white/15">
                    <Plus size={28} strokeWidth={2.4} aria-hidden />
                  </span>
                  <span className="flex-1">
                    <span className="block font-tk-sans text-[22px] font-bold">บันทึกโบตะกอน</span>
                    <span className="block text-sm text-pp-sky-2">ตำแหน่ง · รูปก่อน/หลัง · ผล</span>
                  </span>
                  <ChevronRight size={22} aria-hidden />
                </button>

                <TeamQueue queue={queue} onPick={openForm} />

                {saved.length > 0 && (
                  <div className="space-y-2.5">
                    <h2 className="font-tk-sans text-lg font-semibold">ที่ส่งไปในรอบนี้</h2>
                    {saved.map((s, i) => {
                      const { code, name } = pointTitle(s);
                      const clear = s.result === "clear";
                      return (
                        <div key={i} className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3">
                          <span
                            className={`grid h-10 w-10 flex-none place-items-center rounded-xl ${
                              clear ? "bg-pp-clear-tint text-pp-clear-ink" : "bg-pp-turbid-tint text-pp-turbid-ink"
                            }`}
                          >
                            {clear ? <Droplet size={20} aria-hidden /> : <TriangleAlert size={20} aria-hidden />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">
                              {code && <span className="font-tk-mono text-sm">{code} · </span>}
                              {name}
                            </span>
                            <span className={`block text-[13px] ${clear ? "text-pp-muted" : "text-pp-turbid-ink"}`}>
                              {fmtTime(s.flushedAt || Date.now())} · {durationText(s)} · {clear ? "ใสแล้ว" : "ยังขุ่น"}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-auto flex flex-col items-center gap-1 pt-4 text-center text-[13px] text-pp-muted">
                  <span>กรอกผิด แจ้งหัวหน้าให้แก้ไขในระบบ (เจ้าหน้าที่ภาคสนามแก้/ลบเองไม่ได้)</span>
                  <button type="button" onClick={logout} className="min-h-11 underline">
                    ออกจากโหมดเจ้าหน้าที่
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {formOpen && (
        <FlushingForm
          log={null}
          createEndpoint="/api/smart-papar/field/flushing"
          initialFlushPointId={formPointId}
          onClose={() => setFormOpen(false)}
          onSaved={(_data, submitted) => {
            setFormOpen(false);
            loadQueue();
            setSaved((prev) => [submitted || {}, ...prev]);
            setShowSaved(true);
            window.scrollTo?.(0, 0);
          }}
        />
      )}
    </>
  );
}
