import Image from "next/image";
import Link from "next/link";
import { Prompt, Anuphan } from "next/font/google";

export const promptFont = Prompt({
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const anuphanFont = Anuphan({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function formatThaiDate(dateString) {
  const d = new Date(dateString);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export function thaiDateParts(dateString) {
  const d = new Date(dateString);
  return {
    day: d.getDate(),
    month: THAI_MONTHS[d.getMonth()],
    yearBE: d.getFullYear() + 543,
  };
}

// ป้ายวันที่แบบบล็อกปฏิทิน — เอกลักษณ์ของการ์ดข่าวชุดนี้
export function DateBlock({ dateString }) {
  const { day, month } = thaiDateParts(dateString);
  return (
    <div className={`${promptFont.className} w-12 shrink-0 overflow-hidden rounded-lg border border-slate-900/10 bg-white text-center shadow-sm`}>
      <div className="bg-slate-900 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
        {month}
      </div>
      <div className="py-1 text-xl font-bold leading-none text-slate-900">{day}</div>
    </div>
  );
}

// การ์ดข่าวกิจกรรมสไตล์วารสารเทศบาล: รูปปก + บล็อกวันที่ + พาดหัว Prompt + meta
export default function ActivityFeedCard({ activity, index = 0 }) {
  const cover = activity.images?.[0];
  const stats = activity.stats || { avgRating: null, count: 0 };

  return (
    <Link
      href={`/activities?activity=${activity._id}`}
      className={`${anuphanFont.className} group block overflow-hidden rounded-2xl border border-slate-900/10 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10`}
      style={{ animation: "fadeIn .5s ease-out both", animationDelay: `${index * 90}ms` }}
    >
      <div className="relative aspect-video overflow-hidden bg-slate-100">
        {cover ? (
          <Image
            src={cover}
            alt={activity.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,#0f172a_0%,#1e3a5f_100%)] text-5xl opacity-90">
            📅
          </div>
        )}
        <div className="absolute left-3 top-3">
          <DateBlock dateString={activity.startDate} />
        </div>
      </div>
      <div className="p-4">
        <h3 className={`${promptFont.className} text-base font-semibold leading-snug text-slate-900 line-clamp-2 decoration-amber-400 decoration-2 underline-offset-4 group-hover:underline`}>
          {activity.name}
        </h3>
        {activity.description && (
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500 line-clamp-2">{activity.description}</p>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 pt-3 text-xs text-slate-500">
          <span className="font-medium">
            {stats.count > 0 ? (
              <>
                <span className="text-amber-500">★</span> {stats.avgRating?.toFixed(1)}
                <span className="text-slate-400"> ({stats.count})</span>
              </>
            ) : (
              "ยังไม่มีความเห็น"
            )}
          </span>
          <span className="tabular-nums text-slate-400">👁 {activity.views || 0}</span>
        </div>
        <span className={`${promptFont.className} mt-2 inline-flex items-center gap-1 text-sm font-medium text-slate-900`}>
          อ่านต่อ
          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </span>
      </div>
    </Link>
  );
}
