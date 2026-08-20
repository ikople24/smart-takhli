import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import type { ResolvedDaySchedule } from "@/types/garbage";
import GarbageHero from "@/components/garbage/GarbageHero";
import GarbageSearchPanel from "@/components/garbage/GarbageSearchPanel";
import DayOffNotice from "@/components/garbage/DayOffNotice";
import RouteTimeline from "@/components/garbage/RouteTimeline";
import PrepChecklist from "@/components/garbage/PrepChecklist";
import CoverageNote from "@/components/garbage/CoverageNote";
import { minutesNowInBangkok, todayInBangkok, weekdayOf } from "@/lib/garbage/time";
import { weekdayName } from "@/lib/garbage/labels";
import { buildRuns, type TimelineRun, type TimelineStop } from "@/lib/garbage/timeline";
import { summarizeLive, type LiveTruckLite } from "@/lib/garbage/liveSummary";
import {
  parseTrackedStop,
  serializeTrackedStop,
  TRACKED_STOP_KEY,
  type TrackedStop,
} from "@/lib/garbage/trackedStop";

interface Settings {
  contactPhone: string | null;
  contactNote: string | null;
}

const LIVE_POLL_MS = 60_000;

export default function GarbagePage() {
  const [days, setDays] = useState<ResolvedDaySchedule[] | null>(null);
  const [settings, setSettings] = useState<Settings>({ contactPhone: null, contactNote: null });
  const [liveTrucks, setLiveTrucks] = useState<LiveTruckLite[] | null>(null);
  const [nowMin, setNowMin] = useState<number>(() => minutesNowInBangkok());
  const [tracked, setTracked] = useState<TrackedStop | null>(null);

  const today = todayInBangkok();
  const weekdayToday = weekdayOf(today);

  useEffect(() => {
    try {
      setTracked(parseTrackedStop(window.localStorage.getItem(TRACKED_STOP_KEY)));
    } catch {
      /* อ่าน localStorage ไม่ได้ (โหมดส่วนตัว) — ถือว่ายังไม่ได้ติดตามจุดไหน */
    }
  }, []);

  // สองก้อนนี้ต้องพังแยกกันจริง: settings ล่ม (เช่น proxy คืน HTML 502 ทำให้ .json() reject)
  // ต้องไม่ทำให้เส้นทางของวันนี้หายไปด้วย
  useEffect(() => {
    let alive = true;

    const loadWeek = async () => {
      try {
        const res = await fetch("/api/garbage/week");
        const json = await res.json();
        // API ชุดนี้คืน { error } ไม่ใช่ { success, message }
        if (!alive || !res.ok || !Array.isArray(json?.days)) return;
        setDays(json.days as ResolvedDaySchedule[]);
      } catch {
        /* โหลดไม่ได้ก็ยังค้นหาได้ ช่องค้นหายิง API ของตัวเอง */
      }
    };

    const loadSettings = async () => {
      try {
        const res = await fetch("/api/garbage/settings");
        const json = await res.json();
        if (!alive || !res.ok) return;
        setSettings({
          contactPhone: json?.contactPhone ?? null,
          contactNote: json?.contactNote ?? null,
        });
      } catch {
        /* ไม่มีเบอร์ก็แสดงหน้าได้ตามปกติ */
      }
    };

    Promise.all([loadWeek(), loadSettings()]);
    return () => {
      alive = false;
    };
  }, []);

  // สถานะรถต้องสดกว่าตาราง — ยิงซ้ำทุกนาทีเพื่อให้ตำแหน่งรถบนไทม์ไลน์ขยับตามจริง
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const res = await fetch("/api/garbage/live");
        const json = await res.json();
        if (!alive || !res.ok) return;
        setLiveTrucks(json?.trucks ?? []);
        if (typeof json?.nowMin === "number") setNowMin(json.nowMin);
      } catch {
        // คงค่าเดิมไว้ แล้วเดินนาฬิกาต่อจากเครื่องผู้ใช้ — ไทม์ไลน์ต้องไม่ค้าง
        if (alive) setNowMin(minutesNowInBangkok());
      }
    };
    run();
    const t = setInterval(run, LIVE_POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const dayToday = useMemo(() => days?.find((d) => d.date === today) ?? null, [days, today]);
  const runs = useMemo(() => (dayToday ? buildRuns(dayToday) : []), [dayToday]);
  const emptyWeekdays = useMemo(
    () => (days ?? []).filter((d) => d.assignments.length === 0).map((d) => d.weekday),
    [days]
  );

  /**
   * นับถอยหลังคิดจากตารางของ "วันนี้" จริง ไม่ใช่จาก atMin ที่เก็บไว้ตอนกดติดตาม
   * จุดเดียวกันคนละวันรถถึงไม่ตรงกัน (ถนนรจนาเก็บ 6 วัน คนละเวลาทุกวัน)
   */
  const trackedToday = useMemo(() => {
    if (!tracked) return null;
    const run = runs.find((r) => r.routeCode === tracked.routeCode);
    return run?.stops.find((s) => s.seq === tracked.seq) ?? null;
  }, [tracked, runs]);
  const etaMin = trackedToday?.atMin != null ? trackedToday.atMin - nowMin : null;

  // สถานะรถ + คันที่โชว์รูป + ให้ภาพวิ่งไหม คิดที่ lib ตัวเดียวกับการ์ดหน้าแรก
  const live = summarizeLive(liveTrucks);
  const spriteTruck = tracked
    ? { truckNumber: tracked.truckNumber, truckColor: tracked.truckColor }
    : (live.spriteTruck ??
      (runs[0] ? { truckNumber: runs[0].truckNumber, truckColor: runs[0].truckColor } : null));

  const writeTracked = useCallback((next: TrackedStop | null) => {
    setTracked(next);
    try {
      if (next) window.localStorage.setItem(TRACKED_STOP_KEY, serializeTrackedStop(next));
      else window.localStorage.removeItem(TRACKED_STOP_KEY);
    } catch {
      /* เขียนไม่ได้ก็ยังใช้ได้ในหน้านี้ แค่ไม่ถูกจำไว้รอบหน้า */
    }
  }, []);

  // แตะจุดเดิมอีกครั้ง = เลิกติดตาม (ไม่มีปุ่มลบแยก ผู้ใช้เดาได้จากจุดที่ไฮไลต์อยู่)
  const selectStop = useCallback(
    (run: TimelineRun, stop: TimelineStop) => {
      if (tracked && tracked.routeCode === run.routeCode && tracked.seq === stop.seq) {
        writeTracked(null);
        return;
      }
      writeTracked({
        routeCode: run.routeCode,
        seq: stop.seq,
        stopName: stop.name,
        zoneLabel: run.zoneLabel,
        truckNumber: run.truckNumber,
        truckColor: run.truckColor,
        atMin: stop.atMin,
        weekday: weekdayToday,
      });
    },
    [tracked, weekdayToday, writeTracked]
  );

  return (
    <>
      <Head>
        <title>ตารางรถเก็บขยะ | เทศบาลเมืองตาคลี</title>
        <meta name="description" content="ค้นหาว่ารถเก็บขยะเข้าถนนหรือชุมชนของคุณวันไหน เวลาไหน" />
      </Head>

      <div className="mx-auto w-full max-w-screen-sm space-y-4">
        {/* หน้านี้ซ่อน BottomNav เก่าไว้ จึงไม่มีทางกลับเลยถ้าไม่มีปุ่มนี้ (เจ้าของแจ้ง 2026-08-20) */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-100 transition hover:bg-emerald-50"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          กลับหน้าแรก
        </Link>

        <GarbageHero
          statusText={live.statusText}
          moving={live.moving}
          weekdayToday={weekdayToday}
          tracked={tracked}
          etaMin={etaMin}
          arriveAtMin={trackedToday?.atMin ?? null}
          hasSchedule={runs.length > 0}
          spriteTruck={spriteTruck}
          onClearTracked={() => writeTracked(null)}
        />

        <GarbageSearchPanel />

        {dayToday && <DayOffNotice assignments={dayToday.assignments} />}

        {days == null ? (
          <section className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">กำลังโหลดเส้นทางของวันนี้...</p>
          </section>
        ) : (
          <RouteTimeline
            runs={runs}
            nowMin={nowMin}
            dayName={weekdayName(weekdayToday)}
            trackedSeq={tracked ? { routeCode: tracked.routeCode, seq: tracked.seq } : null}
            onSelectStop={selectStop}
          />
        )}

        <PrepChecklist />

        <CoverageNote
          emptyWeekdays={emptyWeekdays}
          contactPhone={settings.contactPhone}
          contactNote={settings.contactNote}
        />
      </div>
    </>
  );
}
