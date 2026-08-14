import type { TruckColor } from "@/types/garbage";
import { weekdayShort } from "@/lib/garbage/labels";
import { formatEta, formatThaiTime } from "@/lib/garbage/time";
import type { TrackedStop } from "@/lib/garbage/trackedStop";
import TruckSprite from "./TruckSprite";

interface Props {
  /** จำนวนรถที่กำลังวิ่งอยู่ตอนนี้ (นับเป็นคัน) · null = ยังโหลดสถานะไม่เสร็จ */
  runningCount: number | null;
  weekdayToday: number;
  tracked: TrackedStop | null;
  /** นาทีก่อนรถถึงจุดที่ติดตาม — คิดจากตารางของวันนี้จริง ไม่ใช่จากค่าที่เก็บไว้ */
  etaMin: number | null;
  /** เวลาที่รถถึงจุดนั้นตามตารางของวันนี้ — โชว์คู่กับการนับถอยหลัง เพราะรอนานเป็นชั่วโมงคนอยากรู้เวลาจริง */
  arriveAtMin: number | null;
  /** วันนี้มีรถวิ่งจริงไหม — ไม่มีต้องซ่อนรูปรถ ไม่ใช่ปล่อยรถวิ่งบนหน้าจอทั้งที่ไม่มีคันไหนออก */
  hasSchedule: boolean;
  spriteTruck: { truckNumber: number; truckColor: TruckColor } | null;
  onClearTracked?: () => void;
}

/**
 * หัวหน้า /garbage — สีเขียวเข้ม ตัวหนังสือขาว ถนนเป็นเส้นขาววิ่ง
 * ของสดที่คนเปิดหน้านี้มาดู: รถกำลังวิ่งกี่คัน + อีกกี่นาทีรถถึงจุดที่ตัวเองติดตามไว้
 */
export default function GarbageHero({
  runningCount,
  weekdayToday,
  tracked,
  etaMin,
  arriveAtMin,
  hasSchedule,
  spriteTruck,
  onClearTracked,
}: Props) {
  const counting = etaMin != null && etaMin > 0;
  const justPassed = etaMin != null && etaMin <= 0;

  return (
    <section className="relative overflow-hidden rounded-[24px] bg-[#065f46] text-emerald-50 shadow-[0_10px_24px_rgba(6,95,70,.28)]">
      <div className="px-4 pt-4 pb-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[.1em] text-emerald-300">
          <span
            aria-hidden
            className={"h-1.5 w-1.5 rounded-full bg-emerald-300" + (runningCount ? " animate-pulse" : "")}
          />
          {runningCount == null
            ? "กำลังโหลดสถานะรถ"
            : runningCount > 0
              ? `รถกำลังวิ่ง ${runningCount} คัน`
              : "ตอนนี้ไม่มีรถกำลังวิ่ง"}
        </span>

        {counting && tracked ? (
          <>
            <h1 className="mt-1 text-white">
              <span className="block text-[13px] font-medium text-emerald-100">
                รถถึง{tracked.stopName}
              </span>
              <span className="block text-[30px] font-extrabold leading-tight">
                {formatEta(etaMin)}
              </span>
            </h1>
            <p className="mt-0.5 text-xs text-emerald-200">
              {arriveAtMin != null && `ถึงประมาณ ${formatThaiTime(arriveAtMin)} · `}
              {tracked.zoneLabel} · รถเบอร์ {tracked.truckNumber}
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-1 text-[22px] font-extrabold leading-tight text-white">ตารางรถเก็บขยะ</h1>
            <p className="mt-0.5 text-xs text-emerald-200">
              {tracked
                ? justPassed
                  ? `รถผ่าน${tracked.stopName}แล้ววันนี้`
                  : `จุดที่ติดตาม: ${tracked.stopName}`
                : "เทศบาลเมืองตาคลี · กองสาธารณสุขและสิ่งแวดล้อม"}
            </p>
          </>
        )}

        {tracked && onClearTracked && (
          <button
            type="button"
            onClick={onClearTracked}
            className="mt-2 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/25"
          >
            เลิกติดตามจุดนี้
          </button>
        )}
      </div>

      {/* แถบ 7 วัน — ข้อมูลครบทุกวันแล้ว แถบนี้จึงบอกว่า "วันนี้คือวันไหน" ไม่ใช่วันไหนมีข้อมูล */}
      <ul className="flex gap-1.5 px-4" aria-hidden>
        {[0, 1, 2, 3, 4, 5, 6].map((w) => (
          <li key={w} className="flex flex-1 flex-col items-center gap-1">
            <span className={"text-[9px] " + (w === weekdayToday ? "font-bold text-amber-300" : "text-emerald-200/70")}>
              {weekdayShort(w)}
            </span>
            <span className={"h-[5px] w-full rounded-[3px] " + (w === weekdayToday ? "bg-amber-400" : "bg-white/25")} />
          </li>
        ))}
      </ul>

      <div className="relative mt-1 h-[70px]">
        <div className="garbage-road absolute inset-x-0 bottom-4 h-1" />
        {hasSchedule && spriteTruck && (
          <div className="animate-truck-drive absolute bottom-1.5">
            <TruckSprite number={spriteTruck.truckNumber} color={spriteTruck.truckColor} size={84} bob={false} />
          </div>
        )}
        <span className="absolute bottom-5 right-3.5 text-[10px] text-emerald-200">
          {hasSchedule ? "แตะจุดในเส้นทางเพื่อติดตาม" : "วันนี้ยังไม่มีตารางในระบบ"}
        </span>
      </div>
    </section>
  );
}
