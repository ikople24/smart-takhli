// pages/activities.tsx
// ข่าว & กิจกรรมโฉมใหม่ (เฟส 4) — ฟีด + รายละเอียด (?activity=) ในหน้าเดียว
// spec: docs/superpowers/specs/2026-08-19-citizen-activities-design.md
// ข้อมูลจาก /api/activities/feed เดิม · เปิดรายละเอียดนับ views ผ่าน POST /view เดิม
import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import CitizenShell from "@/components/citizen/CitizenShell";
import ActivityCard, { ActivityItem } from "@/components/citizen/activities/ActivityCard";
import { activityPhase } from "@/lib/citizen/activities/phase";
import { formatThaiDate } from "@/components/activities/ActivityFeedCard";

type PhaseFilter = "all" | "upcoming" | "active" | "ended";

const CHIP_LABELS: { key: PhaseFilter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "upcoming", label: "กำลังจะเริ่ม" },
  { key: "active", label: "กำลังดำเนินการ" },
  { key: "ended", label: "สิ้นสุดแล้ว" },
];

export default function ActivitiesPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PhaseFilter>("all");
  const [now, setNow] = useState<Date | null>(null); // client-only กัน hydration/เวลาเซิร์ฟเวอร์เพี้ยน
  const [shared, setShared] = useState(false);
  const viewedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setNow(new Date());
    fetch("/api/activities/feed?limit=50")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setActivities(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectedId = typeof router.query.activity === "string" ? router.query.activity : "";
  const selected = selectedId ? activities.find((a) => a._id === selectedId) ?? null : null;

  // นับยอดอ่านด้วยตัวนับเดิม — ครั้งเดียวต่อการเปิดต่อรายการ
  useEffect(() => {
    if (!selected || viewedRef.current.has(selected._id)) return;
    viewedRef.current.add(selected._id);
    fetch(`/api/activities/${selected._id}/view`, { method: "POST" }).catch(() => {});
  }, [selected]);

  const filtered = useMemo(() => {
    if (!now || filter === "all") return activities;
    return activities.filter((a) => activityPhase(a, now).key === filter);
  }, [activities, filter, now]);

  const countFor = (key: PhaseFilter) =>
    !now ? null : key === "all" ? activities.length : activities.filter((a) => activityPhase(a, now).key === key).length;

  const featured = filtered.find((a) => (a.images?.length ?? 0) > 0) ?? null;
  const rest = filtered.filter((a) => a !== featured);

  const backToFeed = () => router.replace("/activities", undefined, { shallow: true });

  const share = async () => {
    if (!selected) return;
    const url = `${window.location.origin}/activities?activity=${selected._id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: selected.name, url });
        return;
      }
    } catch {
      return;
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  const phase = selected && now ? activityPhase(selected, now) : null;

  return (
    <>
      <Head>
        <title>ข่าว & กิจกรรม · Smart Takhli</title>
        <meta name="description" content="ข่าวสารและกิจกรรมของเทศบาลเมืองตาคลี" />
      </Head>
      <CitizenShell hideNav>
        {/* หัวจอ */}
        <div className="shrink-0 px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (selected ? backToFeed() : router.push("/"))}
              aria-label={selected ? "กลับหน้าฟีดข่าว" : "กลับหน้าแรก"}
              className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white shadow-[0_2px_8px_rgba(60,40,100,0.06)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A4458" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-bold leading-tight">ข่าว & กิจกรรม</div>
              <div className="text-[11px] text-[#9590A8]">ข่าวสารและกิจกรรมของเทศบาล</div>
            </div>
          </div>

          {!selected && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
              {CHIP_LABELS.map((c) => {
                const count = countFor(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setFilter(c.key)}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] ${
                      filter === c.key
                        ? "bg-[#7C3AED] font-semibold text-white"
                        : "border border-[#ECEAF2] bg-white text-[#6B6880]"
                    }`}
                  >
                    {c.label}
                    {count != null ? ` ${count}` : ""}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 px-4 pb-8">
          {loading ? (
            <div className="flex flex-col gap-3" role="status" aria-label="กำลังโหลดข่าวกิจกรรม">
              <div className="h-52 skeleton rounded-[20px] bg-[#E9E4F3]" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-[95px] skeleton rounded-[16px] bg-[#E9E4F3]" />
              ))}
              <span className="sr-only">กำลังโหลดข่าวกิจกรรม</span>
            </div>
          ) : selectedId && !selected ? (
            <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_4px_14px_rgba(60,40,100,0.05)]">
              <div className="text-[15px] font-bold">ไม่พบข่าวหรือกิจกรรมนี้</div>
              <button
                type="button"
                onClick={backToFeed}
                className="mt-4 rounded-full bg-[#7C3AED] px-5 py-2 text-[13px] font-semibold text-white"
              >
                กลับหน้าฟีดข่าว
              </button>
            </div>
          ) : selected ? (
            /* ── รายละเอียด ── */
            <div className="space-y-3">
              {(selected.images?.length ?? 0) > 0 && (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {selected.images!.map((url, i) => (
                    <div
                      key={i}
                      className={`relative shrink-0 overflow-hidden rounded-[16px] bg-[#EEF1FB] ${
                        selected.images!.length === 1 ? "h-[210px] w-full" : "h-[180px] w-[260px]"
                      }`}
                    >
                      <Image src={url} alt={`รูปที่ ${i + 1} ของ ${selected.name}`} fill sizes="260px" className="object-cover" />
                    </div>
                  ))}
                </div>
              )}
              <div className="rounded-[18px] bg-white p-4 shadow-[0_4px_14px_rgba(60,40,100,0.05)]">
                <div className="text-[16px] font-bold leading-snug">{selected.name}</div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {phase && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ background: phase.chipBg, color: phase.chipText }}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${phase.key === "active" ? "animate-pulse" : ""}`}
                        style={{ background: phase.dot }}
                      />
                      {phase.label}
                    </span>
                  )}
                  <span className="text-[11.5px] text-[#9590A8]">
                    {formatThaiDate(selected.startDate)} – {formatThaiDate(selected.endDate)}
                  </span>
                  {typeof selected.views === "number" && (
                    <span className="text-[11.5px] text-[#9590A8]">อ่าน {selected.views}</span>
                  )}
                </div>
                {selected.description && (
                  <p className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-[#4A4458]">
                    {selected.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={share}
                className="w-full rounded-[15px] bg-gradient-to-br from-[#7C3AED] to-[#9050F0] py-3.5 text-center text-[14px] font-semibold text-white shadow-[0_10px_22px_rgba(124,58,237,0.30)]"
              >
                {shared ? "คัดลอกลิงก์แล้ว ✓" : "แชร์ข่าวนี้"}
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-[16px] bg-white p-6 text-center text-[13px] text-[#9590A8]">
              ยังไม่มีข่าวหรือกิจกรรมในหมวดนี้
            </div>
          ) : (
            /* ── ฟีด ── */
            <div className="flex flex-col gap-3">
              {featured && now && (
                <button
                  type="button"
                  onClick={() =>
                    router.replace(`/activities?activity=${featured._id}`, undefined, { shallow: true })
                  }
                  className="overflow-hidden rounded-[20px] bg-white text-left shadow-[0_8px_22px_rgba(60,40,100,0.07)] transition hover:-translate-y-0.5"
                >
                  <div className="relative h-[150px] bg-[#EEF1FB]">
                    <Image src={featured.images![0]} alt="" fill sizes="480px" className="object-cover" />
                    {(() => {
                      const p = activityPhase(featured, now);
                      return (
                        <span
                          className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
                          style={{ background: p.chipBg, color: p.chipText }}
                        >
                          {p.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="p-4">
                    <div className="line-clamp-2 text-[15.5px] font-semibold leading-snug">{featured.name}</div>
                    {featured.description && (
                      <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-[#6B6880]">
                        {featured.description}
                      </p>
                    )}
                    <div className="mt-2.5 text-[11.5px] text-[#9590A8]">{formatThaiDate(featured.startDate)}</div>
                  </div>
                </button>
              )}
              {now && rest.map((a) => <ActivityCard key={a._id} activity={a} now={now} />)}
            </div>
          )}
        </div>
      </CitizenShell>
    </>
  );
}
