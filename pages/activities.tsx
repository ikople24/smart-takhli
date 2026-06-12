import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import ActivityFeedbackPanel from '@/components/activities/ActivityFeedbackPanel';
import {
  promptFont,
  anuphanFont,
  formatThaiDate,
  DateBlock,
} from '@/components/activities/ActivityFeedCard';

interface Activity {
  _id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isDefault: boolean;
  images?: string[];
  views?: number;
  stats?: { avgRating: number | null; count: number };
}

const ActivitiesPage = () => {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [heroIdx, setHeroIdx] = useState(0);
  const articleRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // นับผู้เข้าชมเมื่อเปิดดูรายละเอียด — 1 ครั้ง/กิจกรรม/session
  // (ผูกกับ _id ไม่ใช่ object เพื่อไม่ให้ refreshStats รีเซ็ต hero/นับซ้ำ)
  useEffect(() => {
    if (!selectedActivity?._id) return;
    setHeroIdx(0);
    const key = `activity-viewed-${selectedActivity._id}`;
    if (typeof window !== 'undefined' && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      fetch(`/api/activities/${selectedActivity._id}/view`, { method: 'POST' }).catch(() => {});
    }
  }, [selectedActivity?._id]);

  // อัปเดตคะแนน/จำนวนความเห็นในหน้า หลังผู้ใช้ส่งความคิดเห็นใหม่ (คงตัวที่เลือกไว้)
  const refreshStats = async () => {
    try {
      const response = await fetch('/api/activities/feed?limit=50');
      const data = await response.json();
      if (data.success) {
        setActivities(data.data);
        setSelectedActivity((prev) =>
          prev ? data.data.find((a: Activity) => a._id === prev._id) || prev : prev
        );
      }
    } catch (error) {
      console.error('Error refreshing stats:', error);
    }
  };

  const fetchActivities = async () => {
    try {
      setLoading(true);
      // ใช้ feed endpoint เพื่อให้ได้ stats (คะแนนเฉลี่ย) และ views มาด้วย
      const response = await fetch('/api/activities/feed?limit=50');
      const data = await response.json();
      if (data.success) {
        setActivities(data.data);
        // เลือกจาก ?activity= ก่อน แล้วค่อย fallback เป็นกิจกรรมเริ่มต้น
        const fromQuery =
          typeof router.query.activity === 'string'
            ? data.data.find((a: Activity) => a._id === router.query.activity)
            : null;
        const defaultActivity =
          fromQuery || data.data.find((a: Activity) => a.isDefault) || data.data[0];
        if (defaultActivity) {
          setSelectedActivity(defaultActivity);
        }
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (activity: Activity) => {
    setSelectedActivity(activity);
    setTimeout(() => {
      articleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const getActivityStatus = (activity: Activity) => {
    const now = new Date();
    const startDate = new Date(activity.startDate);
    const endDate = new Date(activity.endDate);

    if (now < startDate) {
      return { status: 'upcoming', text: 'กำลังจะเริ่ม', color: 'border-amber-300 bg-amber-50 text-amber-700' };
    } else if (now > endDate) {
      return { status: 'ended', text: 'สิ้นสุดแล้ว', color: 'border-rose-200 bg-rose-50 text-rose-600' };
    } else {
      return { status: 'active', text: 'กำลังดำเนินการ', color: 'border-emerald-300 bg-emerald-50 text-emerald-700' };
    }
  };

  const StatusChip = ({ activity }: { activity: Activity }) => {
    const s = getActivityStatus(activity);
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.color}`}>
        {s.status === 'active' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
        {s.text}
      </span>
    );
  };

  const MetaRow = ({ activity }: { activity: Activity }) => (
    <div className="flex items-center gap-3 text-xs text-slate-500">
      <span className="font-medium">
        {activity.stats?.count ? (
          <>
            <span className="text-amber-500">★</span> {activity.stats.avgRating?.toFixed(1)}
            <span className="text-slate-400"> ({activity.stats.count})</span>
          </>
        ) : (
          'ยังไม่มีความเห็น'
        )}
      </span>
      <span className="text-slate-300">|</span>
      <span className="tabular-nums">👁 {activity.views || 0} ผู้เข้าชม</span>
    </div>
  );

  // หมายเหตุ: _app.tsx ครอบทุกหน้าด้วย <Layout> อยู่แล้ว — ห้ามครอบซ้ำที่นี่ (เคยทำให้ navbar ซ้อนสองชั้น)
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center py-12">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      </div>
    );
  }

  const featured = activities[0];
  const rest = activities.slice(1);

  return (
      <div
        className={`${anuphanFont.className} min-h-screen bg-[radial-gradient(circle,rgba(15,23,42,0.04)_1px,transparent_1px)] [background-size:22px_22px]`}
      >
        <div className="container mx-auto max-w-6xl px-4 py-10">
          {/* Masthead แบบหนังสือพิมพ์ */}
          <header className="mb-8 text-center" style={{ animation: 'fadeIn .5s ease-out both' }}>
            <p className={`${promptFont.className} text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400`}>
              เทศบาลเมืองตาคลี · Takhli Municipality
            </p>
            <h1 className={`${promptFont.className} mt-2 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl`}>
              ข่าวกิจกรรม
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
              บันทึกกิจกรรมที่เทศบาลดำเนินการเพื่อประชาชน พร้อมผลประเมินความพึงพอใจจากผู้เข้าร่วมจริง
            </p>
            <div className="mx-auto mt-6 w-full max-w-3xl">
              <div className="border-t-2 border-slate-900" />
              <div className="mt-1 border-t border-slate-300" />
            </div>
          </header>

          {/* ข่าวเด่น (กิจกรรมล่าสุด) */}
          {featured && (
            <div
              onClick={() => handleSelect(featured)}
              className={`group mb-6 cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/10 ${
                selectedActivity?._id === featured._id
                  ? 'border-slate-900 ring-1 ring-slate-900'
                  : 'border-slate-900/10'
              }`}
              style={{ animation: 'fadeIn .5s ease-out both', animationDelay: '80ms' }}
            >
              <div className="grid lg:grid-cols-5">
                <div className="relative aspect-video overflow-hidden bg-slate-100 lg:col-span-3 lg:aspect-auto lg:min-h-[320px]">
                  {featured.images?.[0] ? (
                    <Image
                      src={featured.images[0]}
                      alt={featured.name}
                      fill
                      sizes="(max-width: 1024px) 100vw, 60vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      priority
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,#0f172a_0%,#1e3a5f_100%)] text-6xl opacity-90">📅</div>
                  )}
                </div>
                <div className="flex flex-col justify-center gap-3 p-6 lg:col-span-2 lg:p-8">
                  <div className="flex items-center gap-3">
                    <DateBlock dateString={featured.startDate} />
                    <div>
                      <p className={`${promptFont.className} text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-600`}>
                        ข่าวเด่น
                      </p>
                      <StatusChip activity={featured} />
                    </div>
                  </div>
                  <h2 className={`${promptFont.className} text-2xl font-bold leading-snug text-slate-900 decoration-amber-400 decoration-[3px] underline-offset-4 group-hover:underline lg:text-3xl`}>
                    {featured.name}
                  </h2>
                  {featured.description && (
                    <p className="text-sm leading-relaxed text-slate-500 line-clamp-3">{featured.description}</p>
                  )}
                  <MetaRow activity={featured} />
                  <span className={`${promptFont.className} inline-flex items-center gap-1 text-sm font-semibold text-slate-900`}>
                    อ่านรายละเอียด
                    <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ข่าวอื่น ๆ */}
          {rest.length > 0 && (
            <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {rest.map((activity, i) => (
                <div
                  key={activity._id}
                  onClick={() => handleSelect(activity)}
                  className={`group cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10 ${
                    selectedActivity?._id === activity._id
                      ? 'border-slate-900 ring-1 ring-slate-900'
                      : 'border-slate-900/10'
                  }`}
                  style={{ animation: 'fadeIn .5s ease-out both', animationDelay: `${160 + i * 90}ms` }}
                >
                  <div className="relative aspect-video overflow-hidden bg-slate-100">
                    {activity.images?.[0] ? (
                      <Image
                        src={activity.images[0]}
                        alt={activity.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,#0f172a_0%,#1e3a5f_100%)] text-5xl opacity-90">📅</div>
                    )}
                    <div className="absolute left-3 top-3">
                      <DateBlock dateString={activity.startDate} />
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="mb-1.5"><StatusChip activity={activity} /></div>
                    <h3 className={`${promptFont.className} text-base font-semibold leading-snug text-slate-900 line-clamp-2 decoration-amber-400 decoration-2 underline-offset-4 group-hover:underline`}>
                      {activity.name}
                    </h3>
                    {activity.description && (
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-500 line-clamp-2">{activity.description}</p>
                    )}
                    <div className="mt-3 border-t border-dashed border-slate-200 pt-3">
                      <MetaRow activity={activity} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* บทความ: รายละเอียดกิจกรรมที่เลือก */}
          {selectedActivity && (
            <article
              ref={articleRef}
              className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-900/10 bg-white shadow-sm"
              style={{ animation: 'fadeIn .5s ease-out both', animationDelay: '240ms' }}
            >
              <div className="p-6 sm:p-8">
                <p className={`${promptFont.className} text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400`}>
                  รายละเอียดกิจกรรม
                </p>
                <h2 className={`${promptFont.className} mt-2 text-2xl font-bold leading-snug text-slate-900 sm:text-3xl`}>
                  {selectedActivity.name}
                </h2>

                {/* แถบ meta คั่นด้วยเส้นบน-ล่างแบบบทความ */}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-slate-200 py-3 text-sm text-slate-600">
                  <span>
                    📅 {formatThaiDate(selectedActivity.startDate)} – {formatThaiDate(selectedActivity.endDate)}
                  </span>
                  <span className="tabular-nums">👁 {selectedActivity.views || 0} ผู้เข้าชม</span>
                  {selectedActivity.stats?.count ? (
                    <span className="font-medium">
                      <span className="text-amber-500">★</span> {selectedActivity.stats.avgRating?.toFixed(1)}
                      <span className="text-slate-400"> จาก {selectedActivity.stats.count} ความเห็น</span>
                    </span>
                  ) : null}
                  <StatusChip activity={selectedActivity} />
                </div>

                {/* รูปหลัก + แถบ thumbnail สลับรูปได้ */}
                {selectedActivity.images && selectedActivity.images.length > 0 && (
                  <div className="mt-6">
                    <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      <Image
                        src={selectedActivity.images[Math.min(heroIdx, selectedActivity.images.length - 1)]}
                        alt={selectedActivity.name}
                        fill
                        sizes="(max-width: 1024px) 100vw, 900px"
                        className="object-cover"
                      />
                    </div>
                    {selectedActivity.images.length > 1 && (
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {selectedActivity.images.map((img, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setHeroIdx(i)}
                            className={`relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                              i === heroIdx ? 'border-amber-400' : 'border-transparent opacity-70 hover:opacity-100'
                            }`}
                          >
                            <Image src={img} alt={`${selectedActivity.name} ${i + 1}`} fill sizes="96px" className="object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedActivity.description && (
                  <p className="mt-6 max-w-prose text-base leading-relaxed text-slate-600">
                    {selectedActivity.description}
                  </p>
                )}

                {/* กล่องความคิดเห็น — ไม่แสดงข้อมูลกิจกรรมซ้ำกับบทความด้านบน */}
                <ActivityFeedbackPanel selectedActivity={selectedActivity} onSubmitted={refreshStats} />
              </div>
            </article>
          )}

          {/* ไม่มีกิจกรรม */}
          {activities.length === 0 && (
            <div className="py-16 text-center" style={{ animation: 'fadeIn .5s ease-out both' }}>
              <div className="text-6xl">📰</div>
              <h3 className={`${promptFont.className} mt-4 text-xl font-semibold text-slate-900`}>
                ยังไม่มีข่าวกิจกรรมในขณะนี้
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                กรุณาตรวจสอบอีกครั้งในภายหลัง หรือติดต่อผู้ดูแลระบบเพื่อสอบถามข้อมูลเพิ่มเติม
              </p>
            </div>
          )}
        </div>
      </div>
  );
};

export default ActivitiesPage;
