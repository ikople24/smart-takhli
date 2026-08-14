import { useMemo, useState } from "react";
import type { TruckColor } from "@/types/garbage";
import { formatEta, formatThaiTime } from "@/lib/garbage/time";
import {
  currentStopIndex,
  lastTimedStopIndex,
  runStatus,
  visibleStops,
  type TimelineRun,
  type TimelineStop,
} from "@/lib/garbage/timeline";
import TruckSprite from "./TruckSprite";

/** สีของสาย = สีรถที่วิ่งสายนั้น ตามคอนเวนชันจุดสีเดิมของโมดูล (เหลือง #fbbf24 · เขียว #10b981) */
function palette(color: TruckColor) {
  return color === "yellow"
    ? { line: "#fbbf24", accent: "#b45309", cardBg: "#fffbeb", cardBorder: "#fde68a", title: "#78350f", sub: "#92400e" }
    : { line: "#10b981", accent: "#047857", cardBg: "#ecfdf5", cardBorder: "#a7f3d0", title: "#064e3b", sub: "#065f46" };
}

/**
 * เส้นทางแบบสายรถไฟฟ้า: จุดที่ผ่านแล้ว → จุดที่รถกำลังอยู่ → จุดถัดไป
 * - ย่อไว้เฉพาะช่วงรอบตัวรถ (และจุดที่ติดตามไว้) กดขยายดูทั้งสายได้
 * - หลายสายในวันเดียว กดปุ่มก่อนหน้า/ถัดไปเพื่อวนดู
 * - กดแถวจุดใดก็ได้เพื่อติดตาม/เลิกติดตามจุดนั้น (ตัวตัดสินใจอยู่ที่หน้าเรียก)
 */
export default function RouteTimeline({
  runs,
  nowMin,
  dayName,
  trackedSeq,
  onSelectStop,
}: {
  runs: TimelineRun[];
  nowMin: number;
  dayName: string;
  trackedSeq?: { routeCode: string; seq: number } | null;
  onSelectStop?: (run: TimelineRun, stop: TimelineStop) => void;
}) {
  const [i, setI] = useState(0);
  const [expanded, setExpanded] = useState(false);
  // runs เปลี่ยนความยาวได้ระหว่างโหลด (null → มีข้อมูล) จึงหนีบดัชนีไว้ไม่ให้ชี้เกินลิสต์
  const run = runs.length > 0 ? runs[Math.min(i, runs.length - 1)] : null;

  const { status, curIdx, trackedIdx, visible, idxBySeq, passedCount } = useMemo(() => {
    if (!run) {
      return {
        status: "unknown" as const, curIdx: -1, trackedIdx: -1,
        visible: [] as TimelineStop[], idxBySeq: new Map<number, number>(), passedCount: 0,
      };
    }
    const map = new Map(run.stops.map((s, idx) => [s.seq, idx]));
    const st = runStatus(run, nowMin);
    // ตำแหน่งรถมีความหมายเฉพาะตอนกำลังวิ่ง — เลิกงานแล้ว currentStopIndex จะค้างชี้จุดสุดท้าย
    const cur = st === "running" ? currentStopIndex(run.stops, nowMin) : -1;
    // จุดที่ยึดเป็นศูนย์กลางตอนย่อ: กำลังวิ่งยึดตัวรถ · เลิกงานแล้วยึดจุดที่รถไปถึงช้าสุด
    // (ไม่ใช่ท้ายลิสต์ — โซน 3 ท้ายลิสต์เก็บ 6.00 แต่รถเลิกงาน 11.15) · ยังไม่ออกยึดต้นสาย
    const lastTimed = lastTimedStopIndex(run.stops);
    const anchor =
      st === "running" ? cur : st === "finished" ? (lastTimed >= 0 ? lastTimed : run.stops.length - 1) : -1;
    const tracked =
      trackedSeq && trackedSeq.routeCode === run.routeCode ? map.get(trackedSeq.seq) ?? -1 : -1;
    return {
      status: st,
      curIdx: cur,
      trackedIdx: tracked,
      // เลิกงานแล้วไม่มีจุดถัดไป — ขอเฉพาะจุดก่อนหน้าให้จบที่จุดสุดท้ายของวัน
      visible: visibleStops(
        run.stops,
        anchor,
        tracked,
        expanded,
        st === "finished" ? { behind: 5, ahead: 0 } : { behind: 2, ahead: 3 }
      ),
      idxBySeq: map,
      passedCount: st === "finished" ? run.stops.length : Math.max(0, cur + 1),
    };
  }, [run, nowMin, trackedSeq, expanded]);

  if (!run) {
    return (
      <section className="rounded-3xl bg-sky-50 p-4 ring-1 ring-sky-200">
        <p className="text-sm font-medium text-sky-900">วัน{dayName}ยังไม่มีตารางในระบบ</p>
        <p className="mt-1 text-xs text-sky-900/80">กองสาธารณสุขและสิ่งแวดล้อมกำลังจัดทำเพิ่ม</p>
      </section>
    );
  }

  const c = palette(run.truckColor);
  const prev = runs[(i - 1 + runs.length) % runs.length];
  const next = runs[(i + 1) % runs.length];
  const finished = status === "finished";

  return (
    <section className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">
          เส้นทางวัน{dayName} · {run.zoneLabel}
        </h2>
        <span className="text-[11px] text-slate-500">
          {passedCount} จาก {run.stops.length} จุด
        </span>
      </div>

      {/* บอกสถานะของสายตรง ๆ — ตอนกำลังวิ่งไม่ต้องบอก เพราะการ์ด "รถกำลังอยู่จุดนี้" บอกอยู่แล้ว
          รูปรถมาจอดที่แถบนี้ด้วย: แบบวาดรถไว้ในการ์ดตำแหน่งรถที่เดียว พอไม่มีการ์ดนั้น
          รถจะหายไปจากไทม์ไลน์ทั้งใบ ทั้งที่หัวเว็บกับการ์ดหน้าแรกยังมีรถอยู่ · จอดนิ่งไม่กระเพื่อม
          เพราะ bob คือท่า "จอดเก็บขยะอยู่" ซึ่งไม่จริงในสถานะพวกนี้ */}
      {status !== "running" && (
        <div
          className={
            "mt-2 flex items-center justify-between gap-2 rounded-xl pl-3 pr-1 py-1.5 text-[12px] font-semibold " +
            (finished
              ? "bg-slate-100 text-slate-600"
              : status === "upcoming"
                ? "bg-sky-50 text-sky-800"
                : "bg-amber-50 text-amber-800")
          }
        >
          <span>
            {finished
              ? "วันนี้รถเก็บครบทุกจุดแล้ว"
              : status === "upcoming"
                ? `วันนี้รถยังไม่ออกวิ่ง${run.startMin == null ? "" : ` · เริ่ม ${formatThaiTime(run.startMin)}`}`
                : "สายนี้ยังไม่ระบุเวลา รอกองสาธารณสุขกรอกเพิ่ม"}
          </span>
          <span className="-my-2 flex-none">
            <TruckSprite number={run.truckNumber} color={run.truckColor} size={52} bob={false} />
          </span>
        </div>
      )}

      {runs.length > 1 && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => { setI((n) => (n - 1 + runs.length) % runs.length); setExpanded(false); }}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 hover:bg-slate-100"
          >
            <span aria-hidden className="leading-none text-teal-700">‹</span>
            <span className="flex min-w-0 flex-col items-start">
              <span className="text-[9px] text-slate-400">ก่อนหน้า</span>
              <span className="whitespace-nowrap text-xs font-semibold text-slate-700">{prev.zoneLabel}</span>
            </span>
          </button>
          <span className="whitespace-nowrap px-0.5 text-[10px] text-slate-400">
            {i + 1}/{runs.length} สาย
          </span>
          <button
            type="button"
            onClick={() => { setI((n) => (n + 1) % runs.length); setExpanded(false); }}
            className="flex min-w-0 flex-1 items-center justify-end gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 hover:bg-slate-100"
          >
            <span className="flex min-w-0 flex-col items-end">
              <span className="text-[9px] text-slate-400">ถัดไป</span>
              <span className="whitespace-nowrap text-xs font-semibold text-slate-700">{next.zoneLabel}</span>
            </span>
            <span aria-hidden className="leading-none text-teal-700">›</span>
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-col">
        {visible.map((st) => {
          const idx = idxBySeq.get(st.seq) ?? -1;
          const isCurrent = idx === curIdx;
          const isTracked = idx === trackedIdx && !isCurrent;
          // เลิกงานแล้วทุกจุดคือ "ผ่านแล้ว" ไม่ใช่ปล่อยให้ดูเหมือนยังรอรถอยู่
          const isPast = (finished || idx < curIdx) && !isTracked;
          const time = st.atMin == null ? "–" : formatThaiTime(st.atMin).replace(" น.", "");
          const eta = st.atMin == null ? null : st.atMin - nowMin;

          return (
            <button
              type="button"
              key={run.routeCode + "-" + st.seq}
              onClick={() => onSelectStop?.(run, st)}
              aria-label={
                (idx === trackedIdx ? "เลิกติดตาม" : "ติดตาม") +
                `จุด ${st.name}` +
                (st.atMin == null ? " (ยังไม่ระบุเวลา)" : ` รถถึงประมาณ ${formatThaiTime(st.atMin)}`)
              }
              className="grid w-full items-center gap-x-2.5 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              style={{ gridTemplateColumns: "50px 26px 1fr", minHeight: isCurrent ? 60 : isTracked ? 46 : 38 }}
            >
              <span
                className="text-right font-mono text-xs"
                style={{
                  color: isCurrent || isTracked ? c.accent : isPast ? "#94a3b8" : "#64748b",
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {time}
              </span>

              <span aria-hidden className="relative flex h-full w-[26px] items-center justify-center justify-self-center">
                <span
                  className="absolute inset-y-0 w-1"
                  style={{
                    background: isCurrent
                      ? `linear-gradient(${c.line} 52%, #e2e8f0 52%)`
                      : isPast
                        ? c.line
                        : "#e2e8f0",
                  }}
                />
                {isCurrent ? (
                  <span className="relative h-[18px] w-[18px] rounded-full border-[5px] bg-white" style={{ borderColor: c.line }} />
                ) : isTracked ? (
                  <span className="relative h-[15px] w-[15px] rounded-full border-4 bg-white" style={{ borderColor: c.line }} />
                ) : isPast ? (
                  <span className="relative h-[11px] w-[11px] rounded-full" style={{ background: c.line }} />
                ) : (
                  <span className="relative h-[11px] w-[11px] rounded-full border-[3px] border-slate-300 bg-white" />
                )}
              </span>

              {isCurrent ? (
                <span
                  className="flex items-center justify-between gap-2 rounded-2xl px-3 py-2"
                  style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}
                >
                  <span className="flex flex-col">
                    <span className="text-sm font-bold" style={{ color: c.title }}>{st.name}</span>
                    <span className="text-[11px]" style={{ color: c.sub }}>
                      รถกำลังอยู่จุดนี้{idx === trackedIdx ? " · จุดที่คุณติดตาม" : ""}
                    </span>
                  </span>
                  <span className="-my-3.5 -mr-1">
                    <TruckSprite number={run.truckNumber} color={run.truckColor} size={62} />
                  </span>
                </span>
              ) : isTracked ? (
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-slate-800">{st.name}</span>
                  <span className="whitespace-nowrap text-[11px] font-semibold" style={{ color: c.accent }}>
                    จุดของคุณ · {eta == null ? "ยังไม่ระบุเวลา" : eta > 0 ? formatEta(eta) : "รถผ่านแล้ว"}
                  </span>
                </span>
              ) : (
                <span className={"text-[13px] " + (isPast ? "text-slate-400 line-through" : "text-slate-600")}>
                  {st.name}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 w-full rounded-xl bg-teal-50 py-2.5 text-xs font-bold text-teal-700 hover:bg-teal-100"
      >
        {expanded ? "ย่อกลับเฉพาะช่วงที่รถอยู่" : `ดูทั้ง ${run.stops.length} จุด`}
      </button>

      <p className="mt-2 text-center text-[11px] text-slate-400">
        แตะจุดที่ผ่านหน้าบ้านคุณเพื่อติดตาม แล้วหน้าแรกจะนับถอยหลังให้
      </p>
    </section>
  );
}
