import { useEffect, useState } from "react";
import type { LivePosition, TruckColor, AssignmentKind } from "@/types/garbage";
import { formatThaiTime, minutesNowInBangkok } from "@/lib/garbage/time";
import { LIVE_STATUS_TH } from "@/lib/garbage/labels";

interface LiveTruck {
  truckNumber: number;
  truckColor: TruckColor;
  shiftNo: number;
  kind: AssignmentKind;
  routeCode: string | null;
  label: string | null;
  live: LivePosition;
}

const POLL_MS = 60_000;

const STATUS_CLS: Record<string, string> = {
  running: "bg-emerald-100 text-emerald-800",
  upcoming: "bg-sky-100 text-sky-800",
  finished: "bg-slate-200 text-slate-600",
  unknown: "bg-slate-100 text-slate-500",
};

export default function TodayTruckPanel() {
  const [trucks, setTrucks] = useState<LiveTruck[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const res = await fetch("/api/garbage/live");
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(json?.error || "โหลดสถานะไม่สำเร็จ");
        setTrucks(json.trucks ?? []);
        // ใช้ nowMin ที่เซิร์ฟเวอร์คิดมาให้ (เวลาไทย) — นาฬิกาเครื่องผู้ใช้ตั้งเพี้ยนได้ ค่อย fallback มาที่เครื่อง
        setUpdatedAt(formatThaiTime(typeof json.nowMin === "number" ? json.nowMin : minutesNowInBangkok()));
        setFailed(false);
      } catch {
        if (!alive) return;
        // คงข้อมูลเดิมไว้ ชาวบ้านกำลังดูอยู่ — แค่ทำเครื่องหมายว่าอัปเดตล่าสุดไม่สำเร็จ
        setFailed(true);
      }
    };
    run();
    const t = setInterval(run, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (trucks == null) {
    return (
      <section className="rounded-3xl bg-white/80 ring-1 ring-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-800">รถวันนี้</h2>
        <p className="mt-2 text-sm text-slate-500">{failed ? "โหลดสถานะไม่สำเร็จ" : "กำลังโหลด..."}</p>
      </section>
    );
  }

  const working = trucks.filter((t) => t.kind !== "day_off");
  const dayOff = trucks.filter((t) => t.kind === "day_off");

  return (
    <section className="rounded-3xl bg-white/80 ring-1 ring-slate-200 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-800">รถวันนี้</h2>
        {updatedAt && (
          <span className="text-[11px] text-slate-400">
            อัปเดต {updatedAt}{failed ? " (ล่าสุดที่โหลดได้)" : ""}
          </span>
        )}
      </div>

      {working.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">วันนี้ยังไม่มีตารางเดินรถในระบบ</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {working.map((t) => (
            <li key={`${t.truckNumber}-${t.shiftNo}`}
              className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2">
              <div className="flex items-center gap-2">
                <span aria-hidden className={"h-2.5 w-2.5 rounded-full " +
                  (t.truckColor === "yellow" ? "bg-amber-400" : "bg-emerald-500")} />
                <span className="text-sm font-medium text-slate-800">รถ {t.truckNumber}</span>
                {t.routeCode && <span className="text-xs text-slate-500">{t.routeCode}</span>}
                <span className={"ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full " +
                  (STATUS_CLS[t.live.status] ?? STATUS_CLS.unknown)}>
                  {LIVE_STATUS_TH[t.live.status] ?? LIVE_STATUS_TH.unknown}
                  {t.live.status === "upcoming" && t.live.startsInMin != null && ` · อีก ${t.live.startsInMin} นาที`}
                </span>
              </div>
              {t.live.status === "running" && (
                <div className="text-xs text-slate-600 mt-1">
                  {t.live.currentStop ? `กำลังอยู่ ${t.live.currentStop.name}` : "กำลังวิ่งตามเส้นทาง"}
                  {t.live.nextStop && (
                    <> · ถัดไป {t.live.nextStop.name}
                      {t.live.etaNextMin != null && ` (อีก ${t.live.etaNextMin} นาที)`}</>
                  )}
                </div>
              )}
              {t.label && <div className="text-[11px] text-slate-500 mt-0.5">{t.label}</div>}
            </li>
          ))}
        </ul>
      )}

      {dayOff.length > 0 && (
        <p className="mt-2.5 text-xs text-slate-500">
          วันนี้หยุด: รถ {dayOff.map((t) => t.truckNumber).join(", ")}
        </p>
      )}
    </section>
  );
}
