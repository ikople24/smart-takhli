import { useEffect, useState } from "react";
import Link from "next/link";
import type { TruckColor } from "@/types/garbage";
import { formatEta, formatThaiTime, minutesNowInBangkok, todayInBangkok, weekdayOf } from "@/lib/garbage/time";
import { truckLabel, weekdayName } from "@/lib/garbage/labels";
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

  const working = (trucks ?? []).filter((t) => t.kind !== "day_off");
  const running = working.filter((t) => t.live?.status === "running");
  const upcoming = working.filter((t) => t.live?.status === "upcoming");
  const weekdayToday = weekdayOf(todayInBangkok());
  const eta = trackedEta(tracked, weekdayToday, nowMin);
  const counting = eta != null && eta > 0;

  /**
   * รูปรถบนการ์ดต้องมีเสมอถ้าวันนี้มีรถออก — เดิมโชว์เฉพาะคันที่กำลังวิ่งหรือคันที่ติดตามไว้
   * ทำให้ช่วงบ่ายที่รถเก็บเสร็จหมดแล้วการ์ดเหลือพื้นเขียวว่างครึ่งใบ ไม่เหมือนแบบ
   * ลำดับ: จุดที่ติดตาม → คันที่กำลังวิ่ง → คันแรกที่มีงานวันนี้ · ไม่มีงานเลยจึงไม่โชว์รถ
   */
  const spriteTruck = tracked ?? running[0] ?? working[0] ?? null;

  /** ป้ายบนสุดบอกสถานะจริง ไม่ใช่ชื่อการ์ด — ชาวบ้านเปิดหน้าแรกมาดูว่า "ตอนนี้รถมาหรือยัง" */
  const statusText =
    trucks == null
      ? "ตารางรถเก็บขยะ"
      : running.length > 0
        ? `รถกำลังวิ่ง ${running.length} คัน`
        : working.length === 0
          ? "วันนี้ยังไม่มีตารางในระบบ"
          : upcoming.length > 0
            ? `วันนี้มีรถออก ${working.length} คัน`
            : "วันนี้รถเก็บครบแล้ว";

  return (
    <Link
      href="/garbage"
      className={
        "relative block overflow-hidden rounded-[20px] bg-[#065f46] text-emerald-50 " +
        "shadow-[0_10px_24px_rgba(6,95,70,.28)] transition hover:shadow-[0_14px_30px_rgba(6,95,70,.36)] " +
        className
      }
    >
      <div className="flex items-start justify-between gap-2.5 px-5 pb-2 pt-4">
        <div className="flex flex-col gap-1.5 text-left">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[.1em] text-emerald-300">
            <span
              aria-hidden
              className={"h-1.5 w-1.5 rounded-full bg-emerald-300" + (running.length > 0 ? " animate-pulse" : "")}
            />
            {statusText}
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

      {/* แถบ 7 วัน — ไฮไลต์วันนี้ (ตารางมีข้อมูลครบทุกวันแล้ว จึงไม่ใช้บอกว่าวันไหนมีข้อมูล)
          ไม่ใส่ตัวอักษรวันตามแบบ — บรรทัดเล็กมุมขวาล่างบอกอยู่แล้วว่าวันนี้วันอะไร */}
      <div className="flex gap-1.5 px-5" aria-hidden>
        {[0, 1, 2, 3, 4, 5, 6].map((w) => (
          <span
            key={w}
            className={"h-[5px] flex-1 rounded-[3px] " + (w === weekdayToday ? "bg-amber-400" : "bg-white/25")}
          />
        ))}
      </div>

      {/* แถบถนน — สูงเท่ารูปรถพอดี (88px) ไม่งั้นรถล้นขึ้นไปทับแถบ 7 วัน
          รูปรถมีช่องว่างโปร่งใสใต้ล้อ ~20-23% ของกรอบ (วัดจากไฟล์: เหลืองจบที่ 74% เขียวจบที่ 78%)
          จึงวางเส้นถนนที่ 20px จากขอบล่าง เพื่อให้เส้นพาดตรงล้อ ไม่ลอยใต้รถ */}
      <div className="relative mt-0.5 h-[88px]">
        <div className="garbage-road absolute inset-x-0 bottom-[20px] h-1" />
        {spriteTruck && (
          <div className="animate-truck-drive absolute bottom-0 left-3">
            <TruckSprite number={spriteTruck.truckNumber} color={spriteTruck.truckColor} size={88} bob={false} />
          </div>
        )}
        <span className="absolute bottom-[26px] right-4 text-[10px] text-emerald-200">
          วันนี้วัน{weekdayName(weekdayToday)}
        </span>
      </div>
    </Link>
  );
}
