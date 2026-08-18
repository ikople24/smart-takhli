// components/citizen/home/EnvCards.tsx
// การ์ดคู่สภาพแวดล้อม (PM2.5 + น้ำประปา) — ดึงจาก endpoint เดิมทั้งคู่:
// /api/pm25/dashboard (Mongo cache) และ /api/smart-papar/water-quality/public-latest
import { useEffect, useState } from "react";
import { pm25Level } from "@/lib/citizen/pm25Level";
import { waterLevel } from "@/lib/citizen/waterLevel";
import { useCountUp } from "@/components/site-stats/useCountUp";

type Level = { label: string; chipBg: string; chipText: string; dot: string };

// "2026-08-18" → "18/08/2569" (แบบเดียวกับ formatThaiDateShort ของ WaterQualityCard เดิม)
function thaiDateShort(ymd: string | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || "");
  return m ? `${m[3]}/${m[2]}/${parseInt(m[1], 10) + 543}` : "";
}

function Chip({ level }: { level: Level }) {
  return (
    <span
      className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: level.chipBg, color: level.chipText }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: level.dot }} />
      {level.label}
    </span>
  );
}

function CardFrame({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex-1 rounded-[18px] bg-white p-3.5 shadow-[0_4px_14px_rgba(60,40,100,0.05)]">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6B6880]">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

export default function EnvCards() {
  const [pm, setPm] = useState<string | number | null>(null);
  const [ntu, setNtu] = useState<string | number | null>(null);
  const [pmSync, setPmSync] = useState("");
  const [waterSync, setWaterSync] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const [pmRes, waterRes] = await Promise.allSettled([
        fetch("/api/pm25/dashboard", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/smart-papar/water-quality/public-latest").then((r) => r.json()),
      ]);
      if (!alive) return;
      if (pmRes.status === "fulfilled" && pmRes.value?.success && pmRes.value.latest) {
        const latest = pmRes.value.latest;
        setPm(latest.pm25);
        // date_select เป็น พ.ศ. จาก API อยู่แล้ว เช่น "18/08/2569" · Time ตัดวินาทีทิ้ง
        setPmSync([latest.date_select, latest.Time?.slice(0, 5)].filter(Boolean).join(" "));
      }
      if (waterRes.status === "fulfilled" && waterRes.value?.success && waterRes.value.data) {
        setNtu(waterRes.value.data.tapTurbidityNtu);
        setWaterSync(thaiDateShort(waterRes.value.data.recordDate));
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
  // นับเลขแบบ ease-out ตอนโหลด/ค่าเปลี่ยน (สไตล์เดียวกับการ์ด PM2.5 เดิม)
  // — NTU เป็นทศนิยม เลยนับที่สเกล x100 แล้วหารกลับตอนแสดง
  const pmAnim = useCountUp(pmLv.key === "none" ? 0 : parseInt(String(pm), 10), 1200, !loading);
  const ntuAnim = useCountUp(hasNtu ? Math.round(ntuNum * 100) : 0, 1200, !loading);

  if (loading) {
    return (
      <div className="mx-4 mt-3 flex gap-2.5">
        <div className="h-28 flex-1 animate-pulse rounded-[18px] bg-white/70" />
        <div className="h-28 flex-1 animate-pulse rounded-[18px] bg-white/70" />
      </div>
    );
  }

  const pmDisplay = pmLv.key === "none" ? "–" : String(pmAnim);
  const ntuDisplay = hasNtu ? (ntuAnim / 100).toFixed(2) : "–";

  return (
    <div className="mx-4 mt-3 flex gap-2.5">
      <CardFrame
        title="PM2.5"
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth={1.8} strokeLinecap="round">
            <path d="M3 8h10a2.5 2.5 0 1 0-2.5-2.5" />
            <path d="M3 12h15a2.5 2.5 0 1 1-2.5 2.5" />
            <path d="M3 16h8a2 2 0 1 1-2 2" />
          </svg>
        }
      >
        <div className="mt-2 flex items-baseline justify-end gap-1.5">
          <span
            className="text-[38px] font-bold leading-none tabular-nums transition-colors duration-500"
            style={{ color: pmLv.key === "none" ? "#9590A8" : pmLv.chipText }}
          >
            {pmDisplay}
          </span>
          <span className="text-[11px] text-[#9590A8]">µg/m³</span>
        </div>
        <Chip level={pmLv} />
        {pmSync && <div className="mt-1.5 text-[9.5px] leading-tight text-[#9590A8]">อัปเดต {pmSync}</div>}
      </CardFrame>
      <CardFrame
        title="น้ำประปา"
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3BA4F0" strokeWidth={1.8} strokeLinejoin="round">
            <path d="M12 3s6 6 6 11a6 6 0 0 1-12 0c0-5 6-11 6-11Z" />
          </svg>
        }
      >
        <div className="mt-2 flex items-baseline justify-end gap-1.5">
          <span
            className="text-[38px] font-bold leading-none tabular-nums transition-colors duration-500"
            style={{ color: waterLv.key === "none" ? "#9590A8" : waterLv.chipText }}
          >
            {ntuDisplay}
          </span>
          <span className="text-[11px] text-[#9590A8]">NTU</span>
        </div>
        <Chip level={waterLv} />
        {waterSync && <div className="mt-1.5 text-[9.5px] leading-tight text-[#9590A8]">อัปเดต {waterSync}</div>}
      </CardFrame>
    </div>
  );
}
