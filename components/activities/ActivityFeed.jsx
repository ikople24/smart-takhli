import { useEffect, useState } from "react";
import Link from "next/link";
import ActivityFeedCard, { promptFont, anuphanFont } from "./ActivityFeedCard";

// section "ข่าวกิจกรรม" สไตล์วารสารเทศบาล — ใช้บนหน้าหลัก (showViewAll) และหน้าอื่นที่ต้องการฟีด
export default function ActivityFeed({ limit = 3, showViewAll = false }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/activities/feed?limit=${limit}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setActivities(json.data);
      })
      .catch((e) => console.error("Error fetching activity feed:", e))
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading || activities.length === 0) return null;

  return (
    <section className={`${anuphanFont.className} w-full max-w-5xl mx-auto px-2`}>
      {/* หัว section แบบ masthead ย่อ: จุดอำพัน + ชื่อคอลัมน์ + เส้น rule */}
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className={`${promptFont.className} text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400`}>
            Takhli Municipality
          </p>
          <h2 className={`${promptFont.className} mt-0.5 flex items-center gap-2 text-xl font-bold text-slate-900`}>
            <span className="inline-block h-4 w-1.5 rounded-sm bg-amber-400" />
            ข่าวกิจกรรม
          </h2>
        </div>
        {showViewAll && (
          <Link
            href="/activities"
            className={`${promptFont.className} group inline-flex items-center gap-1 pb-1 text-sm font-medium text-slate-700 hover:text-slate-900`}
          >
            ดูกิจกรรมทั้งหมด
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
        )}
      </div>
      <div className="mb-4 border-b-2 border-slate-900/80" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {activities.map((a, i) => (
          <ActivityFeedCard key={a._id} activity={a} index={i} />
        ))}
      </div>
    </section>
  );
}
