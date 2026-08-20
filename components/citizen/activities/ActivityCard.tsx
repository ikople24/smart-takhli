// components/citizen/activities/ActivityCard.tsx
// การ์ดแถวข่าวกิจกรรมในฟีดโฉมใหม่ — รูปย่อ 74px + ชื่อ + วันที่ + ยอดอ่าน + ชิปสถานะ
import Image from "next/image";
import Link from "next/link";
import { activityPhase } from "@/lib/citizen/activities/phase";
import { formatThaiDate } from "@/components/activities/ActivityFeedCard";

export type ActivityItem = {
  _id: string;
  name: string;
  description?: string;
  images?: string[];
  startDate: string;
  endDate: string;
  views?: number;
};

export default function ActivityCard({ activity, now }: { activity: ActivityItem; now: Date }) {
  const phase = activityPhase(activity, now);
  return (
    <Link
      href={`/activities?activity=${activity._id}`}
      className="flex gap-3 rounded-[16px] bg-white p-2.5 shadow-[0_4px_12px_rgba(60,40,100,0.04)] transition hover:-translate-y-0.5"
    >
      <div className="relative h-[74px] w-[74px] shrink-0 overflow-hidden rounded-[12px] bg-[#EEF1FB]">
        {activity.images?.[0] && (
          <Image src={activity.images[0]} alt="" fill sizes="74px" className="object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="line-clamp-2 text-[13.5px] font-semibold leading-snug">{activity.name}</div>
        <div className="mt-1 text-[11px] text-[#9590A8]">
          {formatThaiDate(activity.startDate)}
          {typeof activity.views === "number" ? ` · อ่าน ${activity.views}` : ""}
        </div>
        <span
          className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: phase.chipBg, color: phase.chipText }}
        >
          <span className="h-1 w-1 rounded-full" style={{ background: phase.dot }} />
          {phase.label}
        </span>
      </div>
    </Link>
  );
}
