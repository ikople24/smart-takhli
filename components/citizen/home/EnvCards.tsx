// components/citizen/home/EnvCards.tsx
// การ์ดคู่สภาพแวดล้อม (PM2.5 + น้ำประปา) — เลขใหญ่ขวาบน + sparkline แนวโน้ม
// + ชิปสถานะซ้ายล่าง/เวลาขวาล่าง · ดึงจาก endpoint เดิม:
// /api/pm25/dashboard (Mongo cache — แนวโน้ม 7 วันจาก dailyAverages ต่อท้ายด้วย
// ค่าล่าสุดให้จุดปลายตรงกับเลขใหญ่) และ /api/smart-papar/water-quality/public-latest
// (field recent) · กดการ์ด PM เปิด dashboard ตัวเต็มเดิมใน modal
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { pm25Level } from "@/lib/citizen/pm25Level";
import { waterLevel } from "@/lib/citizen/waterLevel";
import { useCountUp } from "@/components/site-stats/useCountUp";
import Sparkline from "./Sparkline";

// modal ข้อมูลคุณภาพอากาศ "ตัวจริง" จากหน้าปัดเดิม (ลาก recharts มาด้วย —
// โหลดเมื่อผู้ใช้กดเปิดเท่านั้น)
const Pm25InfoModalContent = dynamic(
  () => import("@/components/Pmdata").then((m) => m.Pm25InfoModalContent),
  { ssr: false }
);

type Level = { key: string; label: string; chipBg: string; chipText: string; dot: string };

// "2026-08-18" → "18/08"
function dayMonth(ymd: string | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || "");
  return m ? `${m[3]}/${m[2]}` : "";
}

function Chip({ level }: { level: Level }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: level.chipBg, color: level.chipText }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: level.dot }} />
      {level.label}
    </span>
  );
}

function CardBody({
  title,
  icon,
  level,
  display,
  unit,
  trend,
  time,
  trendLabel,
}: {
  title: string;
  icon: React.ReactNode;
  level: Level;
  display: string;
  unit: string;
  trend: number[];
  time: string;
  trendLabel: string;
}) {
  const none = level.key === "none";
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 pt-1 text-[11px] font-semibold text-[#6B6880]">
          {icon}
          {title}
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-[32px] font-bold leading-none tabular-nums transition-colors duration-500"
            style={{ color: none ? "#9590A8" : level.chipText }}
          >
            {display}
          </span>
          <span className="text-[10px] text-[#9590A8]">{unit}</span>
        </div>
      </div>
      <Sparkline points={trend} color={level.dot} className="mt-2 h-7 w-full" label={trendLabel} />
      <div className="mt-2 flex items-center justify-between gap-2">
        <Chip level={level} />
        {time && <span className="text-[10px] tabular-nums text-[#9590A8]">{time}</span>}
      </div>
    </>
  );
}

export default function EnvCards() {
  const [pm, setPm] = useState<string | number | null>(null);
  const [pmTrend, setPmTrend] = useState<number[]>([]);
  const [pmDaily, setPmDaily] = useState<{ date: string; avg: number }[]>([]);
  const [pmMonthly, setPmMonthly] = useState<unknown[]>([]);
  const [pmLatest, setPmLatest] = useState<Record<string, unknown> | null>(null);
  const [pmTime, setPmTime] = useState("");
  const [ntu, setNtu] = useState<string | number | null>(null);
  const [waterTrend, setWaterTrend] = useState<number[]>([]);
  const [waterDate, setWaterDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPmDetail, setShowPmDetail] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const [pmRes, waterRes] = await Promise.allSettled([
        fetch("/api/pm25/dashboard", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/smart-papar/water-quality/public-latest").then((r) => r.json()),
      ]);
      if (!alive) return;
      if (pmRes.status === "fulfilled" && pmRes.value?.success && pmRes.value.latest) {
        const { latest, dailyAverages, monthlyAverages } = pmRes.value;
        setPm(latest.pm25);
        setPmLatest(latest);
        setPmMonthly(monthlyAverages || []);
        setPmTime(latest.Time?.slice(0, 5) || "");
        const rows = (dailyAverages || []).filter((d: { avg: number }) => Number.isFinite(Number(d.avg)));
        setPmDaily(rows);
        const daily = rows.map((d: { avg: number }) => Number(d.avg));
        const latestNum = parseInt(String(latest.pm25), 10);
        setPmTrend(Number.isFinite(latestNum) ? [...daily, latestNum] : daily);
      }
      if (waterRes.status === "fulfilled" && waterRes.value?.success && waterRes.value.data) {
        const data = waterRes.value.data;
        setNtu(data.tapTurbidityNtu);
        setWaterDate(dayMonth(data.recordDate));
        setWaterTrend(
          (data.recent || [])
            .map((r: { ntu: number | null }) => Number(r.ntu))
            .filter(Number.isFinite)
        );
      }
      setLoading(false);
    };
    run();
    const t = setInterval(run, 60 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const pmLv = pm25Level(pm);
  const waterLv = waterLevel(ntu);
  const ntuNum = Number(ntu);
  const hasNtu = ntu != null && Number.isFinite(ntuNum);
  // นับเลขแบบ ease-out ตอนโหลด/ค่าเปลี่ยน — NTU เป็นทศนิยม นับที่สเกล x100
  const pmAnim = useCountUp(pmLv.key === "none" ? 0 : parseInt(String(pm), 10), 1200, !loading);
  const ntuAnim = useCountUp(hasNtu ? Math.round(ntuNum * 100) : 0, 1200, !loading);

  if (loading) {
    return (
      <div className="mx-4 mt-3 flex gap-2.5" role="status" aria-label="กำลังโหลดข้อมูลคุณภาพอากาศและน้ำประปา">
        <div className="h-32 flex-1 animate-pulse rounded-[18px] bg-white/70" />
        <div className="h-32 flex-1 animate-pulse rounded-[18px] bg-white/70" />
        <span className="sr-only">กำลังโหลดข้อมูลคุณภาพอากาศและน้ำประปา</span>
      </div>
    );
  }

  const card = "flex-1 rounded-[18px] bg-white p-3.5 text-left shadow-[0_4px_14px_rgba(60,40,100,0.05)]";

  return (
    <>
      <div className="mx-4 mt-3 flex gap-2.5">
        <button
          type="button"
          onClick={() => setShowPmDetail(true)}
          aria-label="ดูรายละเอียด PM2.5"
          className={`${card} transition hover:-translate-y-0.5`}
        >
          <CardBody
            title="PM2.5"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth={1.8} strokeLinecap="round">
                <path d="M3 8h10a2.5 2.5 0 1 0-2.5-2.5" />
                <path d="M3 12h15a2.5 2.5 0 1 1-2.5 2.5" />
                <path d="M3 16h8a2 2 0 1 1-2 2" />
              </svg>
            }
            level={pmLv}
            display={pmLv.key === "none" ? "–" : String(pmAnim)}
            unit="µg/m³"
            trend={pmTrend}
            time={pmTime}
            trendLabel="แนวโน้ม PM2.5 เฉลี่ยรายวัน 7 วันย้อนหลังถึงค่าล่าสุด"
          />
        </button>
        <div className={card}>
          <CardBody
            title="น้ำประปา"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3BA4F0" strokeWidth={1.8} strokeLinejoin="round">
                <path d="M12 3s6 6 6 11a6 6 0 0 1-12 0c0-5 6-11 6-11Z" />
              </svg>
            }
            level={waterLv}
            display={hasNtu ? (ntuAnim / 100).toFixed(2) : "–"}
            unit="NTU"
            trend={waterTrend}
            time={waterDate}
            trendLabel="แนวโน้มความขุ่นน้ำประปา 7 วันย้อนหลัง"
          />
        </div>
      </div>

      {showPmDetail && (
        <Pm25InfoModalContent
          onClose={() => setShowPmDetail(false)}
          latest={pmLatest}
          dailyAverages={pmDaily}
          monthlyAverages={pmMonthly}
        />
      )}
    </>
  );
}
