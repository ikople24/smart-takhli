import { useEffect, useState } from "react";
import Link from "next/link";
import ActivityFeedCard from "./ActivityFeedCard";

// section "ข่าวกิจกรรม" — ใช้บนหน้าหลัก (showViewAll) และหน้าอื่นที่ต้องการฟีด
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
    <section className="w-full max-w-5xl mx-auto px-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-800">📰 ข่าวกิจกรรม</h2>
        {showViewAll && (
          <Link href="/activities" className="text-sm text-blue-600 hover:underline">
            ดูกิจกรรมทั้งหมด →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activities.map((a) => (
          <ActivityFeedCard key={a._id} activity={a} />
        ))}
      </div>
    </section>
  );
}
