import { useEffect, useState } from "react";
import Link from "next/link";
import type { TruckColor } from "@/types/garbage";
import { formatEta, formatThaiTime, minutesNowInBangkok, todayInBangkok, weekdayOf } from "@/lib/garbage/time";
import { truckLabel, weekdayShort } from "@/lib/garbage/labels";
import { parseTrackedStop, trackedEta, TRACKED_STOP_KEY, type TrackedStop } from "@/lib/garbage/trackedStop";
import TruckSprite from "./TruckSprite";

interface LiveTruckLite {
  truckNumber: number;
  truckColor: TruckColor;
  kind: string;
  live: { status: string };
}

const CLOCK_MS = 60_000;

/**
 * การ์ดทางเข้าหน้า /garbage บนหน้าแรก
 * เหตุผลที่คนกด = ของสด 2 อย่าง: มีรถกำลังวิ่งกี่คัน + รอบถัดไปของจุดที่ตัวเองติดตามไว้
 * โหลดพลาดหรือยังไม่ได้ติดตามจุดไหน → ถอยไปเป็นข้อความชวนค้นหา ไม่มีกล่อง error บนหน้าแรก
 *
 * นับถอยหลังได้เฉพาะวันเดียวกับที่กดติดตาม เพราะการ์ดนี้ยิงแค่ /live (ไม่มีตารางทั้งวัน)
 * จุดเดียวกันคนละวันรถถึงไม่ตรงกัน จึงเดาข้ามวันไม่ได้ — หน้า /garbage ที่มีตารางจริงคิดให้ทุกวัน
 */
export default function GarbageHomeCard({ className = "" }: { className?: string }) {
  const [trucks, setTrucks] = useState<LiveTruckLite[] | null>(null);
  const [tracked, setTracked] = useState<TrackedStop | null>(null);
  const [nowMin, setNowMin] = useState<number>(() => minutesNowInBangkok());

  useEffect(() => {
    try {
      setTracked(parseTrackedStop(window.localStorage.getItem(TRACKED_STOP_KEY)));
    } catch {
      /* โหมดส่วนตัวอ่าน localStorage ไม่ได้ — ถือว่าไม่มีจุดที่ติดตาม */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/garbage/live");
        const json = await res.json();
        if (!alive || !res.ok) return;
        setTrucks(json?.trucks ?? []);
        // ใช้ nowMin ที่เซิร์ฟเวอร์คิดมาให้ (เวลาไทย) — นาฬิกาเครื่องผู้ใช้ตั้งเพี้ยนได้
        if (typeof json?.nowMin === "number") setNowMin(json.nowMin);
      } catch {
        /* เงียบไว้ */
      }
    })();
    const t = setInterval(() => setNowMin(minutesNowInBangkok()), CLOCK_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const running = (trucks ?? []).filter((t) => t.live?.status === "running");
  const weekdayToday = weekdayOf(todayInBangkok());
  const eta = trackedEta(tracked, weekdayToday, nowMin);
  const counting = eta != null && eta > 0;
  // โชว์รถของจุดที่ติดตามก่อน ไม่มีก็เอาคันแรกที่กำลังวิ่ง ไม่มีเลยก็ไม่โชว์รถ
  const spriteTruck = tracked ?? running[0] ?? null;

  return (
    <Link
      href="/garbage"
      className={
        "relative block overflow-hidden rounded-[20px] bg-[#065f46] text-emerald-50 " +
        "shadow-[0_10px_24px_rgba(6,95,70,.28)] transition hover:shadow-[0_14px_30px_rgba(6,95,70,.36)] " +
        className
      }
    >
      <div className="flex items-start justify-between gap-2.5 px-4 pb-2 pt-4">
        <div className="flex flex-col gap-1.5 text-left">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[.1em] text-emerald-300">
            <span
              aria-hidden
              className={"h-1.5 w-1.5 rounded-full bg-emerald-300" + (running.length > 0 ? " animate-pulse" : "")}
            />
            {running.length > 0 ? `รถกำลังวิ่ง ${running.length} คัน` : "ตารางรถเก็บขยะ"}
          </span>
          <span className="text-[19px] font-extrabold leading-tight text-white">
            {counting ? `รถถึง${tracked?.stopName} ${formatEta(eta)}` : "ค้นหาว่ารถเข้าถนนของคุณวันไหน"}
          </span>
          <span className="text-xs text-emerald-200">
            {counting && tracked
              ? `ถึงประมาณ ${formatThaiTime(tracked.atMin)} · ${tracked.zoneLabel} · ${truckLabel(tracked.truckNumber)}`
              : tracked
                ? `จุดที่ติดตาม: ${tracked.stopName} · กดดูเวลาของวันนี้`
                : "กดดูรอบเก็บของถนนหรือชุมชนของคุณ"}
          </span>
        </div>
        <span className="whitespace-nowrap rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold">
          ดูตาราง ›
        </span>
      </div>

      {/* แถบ 7 วัน — ไฮไลต์วันนี้ (ตารางมีข้อมูลครบทุกวันแล้ว) */}
      <div className="flex gap-1.5 px-4" aria-hidden>
        {[0, 1, 2, 3, 4, 5, 6].map((w) => (
          <span key={w} className="flex flex-1 flex-col items-center gap-1">
            <span className={"text-[9px] " + (w === weekdayToday ? "font-bold text-amber-300" : "text-emerald-200/70")}>
              {weekdayShort(w)}
            </span>
            <span className={"h-[5px] w-full rounded-[3px] " + (w === weekdayToday ? "bg-amber-400" : "bg-white/25")} />
          </span>
        ))}
      </div>

      <div className="relative mt-0.5 h-[74px]">
        <div className="garbage-road absolute inset-x-0 bottom-4 h-1" />
        {spriteTruck && (
          <div className="animate-truck-drive absolute bottom-1.5">
            <TruckSprite number={spriteTruck.truckNumber} color={spriteTruck.truckColor} size={88} bob={false} />
          </div>
        )}
        <span className="absolute bottom-5 right-3.5 text-[10px] text-emerald-200">
          กองสาธารณสุขและสิ่งแวดล้อม
        </span>
      </div>
    </Link>
  );
}
