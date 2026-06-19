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

// แต่ละเมตริกมีโทนสีของตัวเอง อิงจากธีมหลักของเว็บ (ฟ้า → เขียว)
// สื่อว่าเป็น "มุมมอง" คนละด้านของสถิติ ไม่ใช่การ์ดซ้ำ ๆ สีเดียว
type Accent = {
  bar: string; // gradient ของแถบบน + glow
  ring: string; // วงแสงหลังไอคอน
  icon: string; // สีไอคอน
};

const ACCENTS = {
  sky: {
    bar: "from-sky-400 to-blue-500",
    ring: "bg-sky-400/25",
    icon: "text-sky-600",
  },
  cyan: {
    bar: "from-cyan-400 to-teal-500",
    ring: "bg-cyan-400/25",
    icon: "text-cyan-600",
  },
  emerald: {
    bar: "from-emerald-400 to-green-500",
    ring: "bg-emerald-400/25",
    icon: "text-emerald-600",
  },
  live: {
    bar: "from-green-400 to-emerald-500",
    ring: "bg-green-400/30",
    icon: "text-green-600",
  },
} satisfies Record<string, Accent>;

function StatCard({
  icon,
  label,
  value,
  visible,
  accent,
  live = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  visible: boolean;
  accent: Accent;
  live?: boolean;
}) {
  const display = useCountUp(value, 1200, visible);
  return (
    <div className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/60 bg-white/70 px-4 py-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      {/* แถบไล่สีด้านบน = ลายเซ็นของการ์ด (instrument readout) */}
      <span
        className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent.bar}`}
      />
      {/* glow นุ่ม ๆ มุมบน ให้แต่ละการ์ดมีโทนของตัวเอง */}
      <span
        className={`pointer-events-none absolute -top-8 right-1/2 h-20 w-20 translate-x-1/2 rounded-full blur-2xl ${accent.ring}`}
      />

      <div
        className={`relative mb-3 grid h-11 w-11 place-items-center rounded-xl bg-white/80 shadow-inner ring-1 ring-black/5 ${accent.icon}`}
      >
        {icon}
      </div>

      <div className="relative text-3xl font-extrabold tracking-tight text-gray-800 tabular-nums">
        {display.toLocaleString("th-TH")}
      </div>

      <div className="relative mt-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-500">
        {live && (
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
        )}
        {label}
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
    <section ref={ref} className="mx-auto mb-8 w-full max-w-5xl px-4">
      <div className="relative overflow-hidden rounded-3xl border border-blue-100/70 bg-gradient-to-br from-blue-50/80 via-white to-emerald-50/60 p-5 shadow-sm sm:p-7">
        {/* ลายเซ็นพื้นหลัง: เส้นแสงนุ่ม ๆ ให้แบนด์ดูเป็นแผงข้อมูล ไม่ใช่กล่องเปล่า */}
        <span className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-sky-300/20 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl" />

        <div className="relative mb-5 flex items-center justify-center gap-2">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-blue-300" />
          <h2 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-blue-500/90">
            สถิติการเข้าชมเว็บไซต์
          </h2>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-emerald-300" />
        </div>

        <div className="relative grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <StatCard
            icon={<Eye size={22} />}
            label="เข้าชมทั้งหมด"
            value={stats.total}
            visible={visible}
            accent={ACCENTS.sky}
          />
          <StatCard
            icon={<CalendarDays size={22} />}
            label="วันนี้"
            value={stats.today}
            visible={visible}
            accent={ACCENTS.cyan}
          />
          <StatCard
            icon={<TrendingUp size={22} />}
            label="เดือนนี้"
            value={stats.month}
            visible={visible}
            accent={ACCENTS.emerald}
          />
          <StatCard
            icon={<Radio size={22} />}
            label="กำลังออนไลน์"
            value={stats.online}
            visible={visible}
            accent={ACCENTS.live}
            live
          />
        </div>
      </div>
    </section>
  );
}
