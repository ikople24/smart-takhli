// components/citizen/home/StatsRow.tsx
// สถิติการเข้าชมเว็บไซต์ ฉบับ citizen shell — ออกแบบสำหรับคอลัมน์กว้างคงที่ ~480px
// (SiteStatsBar เดิมใช้ breakpoint md: ตามความกว้างจอ พอไปอยู่ในคอลัมน์แคบบน
// จอคอมจะบีบ 4 คอลัมน์จนเลขล้น) — ตรึง 2x2 เสมอ · ข้อมูลจาก /api/site-stats เดิม
// ส่วน visit/ping tracking อยู่ที่ useSiteTracking ใน _app.tsx ไม่เกี่ยวกับตัวแสดงผลนี้
import { useEffect, useState } from "react";
import { Eye, CalendarDays, TrendingUp, Radio } from "lucide-react";
import { useCountUp } from "@/components/site-stats/useCountUp";

type Stats = { total: number; today: number; month: number; online: number };

const POLL_MS = 60_000;

function StatItem({
  icon,
  label,
  value,
  live = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  live?: boolean;
}) {
  const display = useCountUp(value, 1200, true);
  return (
    <div className="flex items-center gap-2.5 rounded-[16px] bg-white px-3.5 py-3 shadow-[0_4px_12px_rgba(60,40,100,0.04)]">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-none tabular-nums text-[#1B1830]">
          {display.toLocaleString("th-TH")}
        </div>
        <div className="mt-1 flex items-center gap-1 whitespace-nowrap text-[11px] text-[#9590A8]">
          {live && (
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75 motion-reduce:hidden" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
            </span>
          )}
          {label}
        </div>
      </div>
    </div>
  );
}

export default function StatsRow() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      fetch("/api/site-stats")
        .then((r) => r.json())
        .then((j) => {
          if (j.success) setStats(j.data);
        })
        .catch(() => {});
    load().finally(() => setLoading(false));
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <section className="mx-4 mt-6" role="status" aria-label="กำลังโหลดสถิติการเข้าชมเว็บไซต์">
        <div className="h-5 w-40 skeleton rounded-md bg-[#E9E4F3]" />
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[62px] skeleton rounded-[16px] bg-[#E9E4F3]" />
          ))}
        </div>
        <span className="sr-only">กำลังโหลดสถิติการเข้าชมเว็บไซต์</span>
      </section>
    );
  }
  if (!stats) return null;

  return (
    <section className="mx-4 mt-6">
      <h2 className="text-[15px] font-bold">สถิติการเข้าชมเว็บไซต์</h2>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <StatItem icon={<Eye className="h-5 w-5 text-sky-500" />} label="เข้าชมทั้งหมด" value={stats.total} />
        <StatItem icon={<CalendarDays className="h-5 w-5 text-cyan-500" />} label="วันนี้" value={stats.today} />
        <StatItem icon={<TrendingUp className="h-5 w-5 text-emerald-500" />} label="เดือนนี้" value={stats.month} />
        <StatItem icon={<Radio className="h-5 w-5 text-green-500" />} label="กำลังออนไลน์" value={stats.online} live />
      </div>
    </section>
  );
}
