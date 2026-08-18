// components/citizen/home/NewsSection.tsx
// ข่าวกิจกรรม 3 รายการจาก endpoint เดิมของโมดูล activities — การ์ดสไตล์แคนวาส
// (ไม่มีชิปหมวดแบบแคนวาส — ข้อมูลจริงไม่มีฟิลด์หมวด ใช้วันที่+ยอดอ่านแทน)
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatThaiDate } from "@/components/activities/ActivityFeedCard";

type Activity = {
  _id: string;
  name: string;
  description?: string;
  images?: string[];
  startDate?: string;
  views?: number;
};

export default function NewsSection() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/activities/feed?limit=3")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setActivities(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || activities.length === 0) return null;

  return (
    <section className="mx-4 mt-6">
      <div className="flex items-end justify-between">
        <h2 className="text-[15px] font-bold">ข่าวกิจกรรม</h2>
        <Link href="/activities" className="text-xs font-medium text-[#8B5CF6]">
          ดูทั้งหมด ›
        </Link>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {activities.map((a) => (
          <Link
            key={a._id}
            href={`/activities?activity=${a._id}`}
            className="flex gap-3 rounded-[16px] bg-white p-2.5 shadow-[0_4px_12px_rgba(60,40,100,0.04)]"
          >
            <div className="relative h-[74px] w-[74px] shrink-0 overflow-hidden rounded-[12px] bg-[#EEF1FB]">
              {a.images?.[0] && (
                <Image src={a.images[0]} alt={a.name} fill sizes="74px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              <div className="line-clamp-2 text-[13.5px] font-semibold leading-snug">{a.name}</div>
              <div className="mt-1.5 text-[11px] text-[#9590A8]">
                {a.startDate ? formatThaiDate(a.startDate) : ""}
                {typeof a.views === "number" ? ` · อ่าน ${a.views}` : ""}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
