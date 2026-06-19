import { useEffect, useRef, useState } from "react";
import { Eye, CalendarDays, TrendingUp, Radio } from "lucide-react";
import { useCountUp } from "./useCountUp";

interface Stats {
  total: number;
  today: number;
  month: number;
  online: number;
}

const POLL_MS = 60_000;

// โทนไอคอนต่อ metric อิงธีมเว็บ (ฟ้า → เขียว) — ใช้เป็น "สีไอคอน" เท่านั้น
// ไม่มีแถบ/ขอบสี เพื่อให้ดูเรียบ ไม่เหมือนการ์ดสำเร็จรูป
const ICON_COLOR = {
  sky: "text-sky-500",
  cyan: "text-cyan-500",
  emerald: "text-emerald-500",
  live: "text-green-500",
} as const;

function StatItem({
  icon,
  label,
  value,
  visible,
  live = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  visible: boolean;
  live?: boolean;
}) {
  const display = useCountUp(value, 1200, visible);
  return (
    <div className="flex items-center gap-2.5 px-1.5 py-1 md:justify-center md:border-l md:border-gray-100 md:px-2 md:first:border-l-0">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-none text-gray-800 tabular-nums sm:text-2xl">
          {display.toLocaleString("th-TH")}
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-500 sm:text-xs">
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

// แถบสถิติการเข้าชมเว็บไซต์ (แสดงบนหน้าหลัก ส่วนล่าง เหนือ footer)
export default function SiteStatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/site-stats")
        .then((r) => r.json())
        .then((j) => {
          if (j.success) setStats(j.data);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // ผูกกับ stats/visible: section จะ mount หลัง stats โหลด (ก่อนหน้านั้น return null)
    // จึงต้องรอ ref พร้อมแล้วค่อย observe; หยุดเมื่อมองเห็นแล้ว
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [stats, visible]);

  if (!stats) return null;

  return (
    <section ref={ref} className="mx-auto mb-8 w-full max-w-3xl px-4">
      <div className="mb-3 flex items-center justify-center gap-2">
        <span className="h-px w-6 bg-gray-200" />
        <h2 className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
          สถิติการเข้าชมเว็บไซต์
        </h2>
        <span className="h-px w-6 bg-gray-200" />
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-3 rounded-2xl border border-gray-100 bg-white/70 px-3 py-4 md:grid-cols-4 md:gap-0">
        <StatItem
          icon={<Eye className={`h-5 w-5 ${ICON_COLOR.sky}`} />}
          label="เข้าชมทั้งหมด"
          value={stats.total}
          visible={visible}
        />
        <StatItem
          icon={<CalendarDays className={`h-5 w-5 ${ICON_COLOR.cyan}`} />}
          label="วันนี้"
          value={stats.today}
          visible={visible}
        />
        <StatItem
          icon={<TrendingUp className={`h-5 w-5 ${ICON_COLOR.emerald}`} />}
          label="เดือนนี้"
          value={stats.month}
          visible={visible}
        />
        <StatItem
          icon={<Radio className={`h-5 w-5 ${ICON_COLOR.live}`} />}
          label="กำลังออนไลน์"
          value={stats.online}
          visible={visible}
          live
        />
      </div>
    </section>
  );
}
