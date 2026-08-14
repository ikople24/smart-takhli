import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEta, formatThaiTime, minutesNowInBangkok, todayInBangkok, weekdayOf } from "@/lib/garbage/time";
import { truckLabel, weekdayName } from "@/lib/garbage/labels";
import { parseTrackedStop, trackedEta, TRACKED_STOP_KEY, type TrackedStop } from "@/lib/garbage/trackedStop";
import { summarizeLive, type LiveTruckLite } from "@/lib/garbage/liveSummary";
import TruckSprite from "./TruckSprite";

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

  const weekdayToday = weekdayOf(todayInBangkok());
  const eta = trackedEta(tracked, weekdayToday, nowMin);
  const counting = eta != null && eta > 0;

  // สรุปสถานะ + เลือกรถที่จะโชว์ + ตัดสินว่าให้ภาพรถวิ่งไหม อยู่ที่ lib ที่เดียว
  // เพื่อให้การ์ดนี้กับหัวหน้า /garbage พูดตรงกันเสมอ
  const { runningCount, statusText, moving, spriteTruck: liveTruck } = summarizeLive(trucks);
  // จุดที่ผู้ใช้ติดตามไว้สำคัญกว่ารถคันอื่น จึงเอามาโชว์ก่อน
  const spriteTruck = tracked ?? liveTruck;

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
              className={"h-1.5 w-1.5 rounded-full bg-emerald-300" + (runningCount > 0 ? " animate-pulse" : "")}
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
        <div className={"garbage-road absolute inset-x-0 bottom-[20px] h-1" + (moving ? " garbage-road-moving" : "")} />
        {spriteTruck && (
          <div className={"absolute bottom-0 left-3" + (moving ? " animate-truck-drive" : "")}>
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
