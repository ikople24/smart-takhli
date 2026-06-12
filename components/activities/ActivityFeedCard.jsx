import Image from "next/image";
import Link from "next/link";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function formatThaiDate(dateString) {
  const d = new Date(dateString);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// การ์ดข่าวกิจกรรมแนวตั้ง: รูปปก 16:9 + ป้ายวันที่ + พาดหัว + เนื้อหาย่อ + คะแนน/ยอดวิว
export default function ActivityFeedCard({ activity }) {
  const cover = activity.images?.[0];
  const stats = activity.stats || { avgRating: null, count: 0 };

  return (
    <Link
      href={`/activities?activity=${activity._id}`}
      className="block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow"
    >
      <div className="relative aspect-video bg-gradient-to-br from-indigo-100 to-blue-200">
        {cover ? (
          <Image
            src={cover}
            alt={activity.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-5xl">📅</div>
        )}
        <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
          📅 {formatThaiDate(activity.startDate)}
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-2">{activity.name}</h3>
        {activity.description && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{activity.description}</p>
        )}
        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <span>
            {stats.count > 0
              ? `⭐ ${stats.avgRating?.toFixed(1)} (${stats.count} ความเห็น)`
              : "ยังไม่มีความเห็น"}
          </span>
          <span>👁 {activity.views || 0}</span>
        </div>
        <span className="inline-block mt-2 text-sm font-medium text-blue-600">อ่านต่อ →</span>
      </div>
    </Link>
  );
}
