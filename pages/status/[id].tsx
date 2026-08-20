// pages/status/[id].tsx
// จอรายละเอียดสถานะรายเรื่อง (เฟส 3) — timeline 4 ขั้น + ปัญหา/รายละเอียด +
// รูปก่อน-หลัง + การ์ดเจ้าหน้าที่ + ให้คะแนนเมื่อเสร็จสิ้น
// spec: docs/superpowers/specs/2026-08-19-citizen-status-design.md
// ข้อมูลทุกส่วนจาก API สาธารณะเดิม (PDPA sanitize ฝั่ง server) — ไม่เพิ่มการเปิดเผยใหม่
import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Image from "next/image";
import CitizenShell from "@/components/citizen/CitizenShell";
import Timeline from "@/components/citizen/status/Timeline";
import { useMenuStore } from "@/stores/useMenuStore";
import { useProblemOptionStore } from "@/stores/useProblemOptionStore";
import { useAdminOptionsStore } from "@/stores/useAdminOptionsStore";
import { maskOfficerName } from "@/lib/citizen/maskName";
import { Calendar, ClipboardList, Heart, MapPin, Star, X } from "lucide-react";
import BeforeAfter from "@/components/citizen/status/BeforeAfter";
import PhotoSlider from "@/components/citizen/status/PhotoSlider";
import SatisfactionForm from "@/components/SatisfactionForm";
import { statusTimeline } from "@/lib/citizen/status/progress";
import { formatThaiDate } from "@/components/activities/ActivityFeedCard";

const DONE = "ดำเนินการเสร็จสิ้น";
// เบอร์กลางเทศบาลเมืองตาคลี — เจ้าของกำหนดให้ใช้เบอร์เดียวทุกเรื่อง (2026-08-20)
const CONTACT_PHONE_DISPLAY = "056-219299";
const CONTACT_PHONE_TEL = "056219299";
// เพดานให้คะแนนต่อเรื่อง (source public) — ค่าเดียวกับ CardOfficail เดิม
const MAX_RATINGS = 4;

type Complaint = {
  _id: string;
  complaintId?: string; // รหัสคำร้องจริง เช่น TKC-690017
  category?: string;
  problems?: string[];
  community?: string;
  detail?: string;
  images?: string[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type Officer = { name?: string; position?: string; department?: string; phone?: string } | null;

type Assignment = {
  assignedAt?: string | null;
  completedAt?: string | null;
  solutionImages?: string[];
  solution?: string[];
  note?: string;
  userId?: string;
  user?: Officer;
} | null;

export default function StatusDetail() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const { menu, fetchMenu, menuLoading } = useMenuStore();
  const { problemOptions, fetchProblemOptions } = useProblemOptionStore();
  const [hasFetchedMenu, setHasFetchedMenu] = useState(false);

  const { adminOptions, fetchAdminOptions } = useAdminOptionsStore();

  useEffect(() => {
    fetchProblemOptions();
    fetchAdminOptions(); // ไอคอนวิธีแก้ของเจ้าหน้าที่ (AdminOption.icon_url)
  }, [fetchProblemOptions, fetchAdminOptions]);

  // ไอคอนหมวดสำหรับ hero (จาก menu เดิม)
  useEffect(() => {
    if (!hasFetchedMenu && menu.length === 0 && !menuLoading) {
      fetchMenu();
      setHasFetchedMenu(true);
    }
  }, [menu.length, fetchMenu, menuLoading, hasFetchedMenu]);

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [assignment, setAssignment] = useState<Assignment>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ratingCount, setRatingCount] = useState<number | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!router.isReady || !id) return;
    let alive = true;
    (async () => {
      try {
        const rows = await fetch(`/api/complaints?complaintId=${encodeURIComponent(id)}`).then((r) => r.json());
        const c: Complaint | undefined = Array.isArray(rows) ? rows[0] : rows?.data?.[0];
        if (!alive) return;
        if (!c) {
          setNotFound(true);
          return;
        }
        setComplaint(c);

        // assignment (sanitize ฝั่ง server: เรื่อง PDPA รูปผลงานถูกเบลอแล้ว)
        try {
          const aj = await fetch("/api/complaints/assignments/by-complaints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ complaintIds: [c._id] }),
          }).then((r) => r.json());
          const a = (aj?.data ?? aj?.assignments ?? {})[c._id] ?? null;
          if (a?.userId) {
            // ข้อมูลเจ้าหน้าที่จาก endpoint สาธารณะเดิม (ทางเดียวกับหน้า /status เก่า)
            try {
              const uj = await fetch(`/api/users/get-by-id?userId=${a.userId}`).then((r) => r.json());
              a.user = uj?.user ?? null;
            } catch {
              a.user = null;
            }
          }
          if (alive) setAssignment(a);
        } catch {
          if (alive) setAssignment(null);
        }

        try {
          const sj = await fetch(`/api/satisfaction/count?complaintId=${c._id}&source=public`).then((r) => r.json());
          if (alive) setRatingCount(sj?.count ?? sj?.data?.count ?? 0);
        } catch {
          if (alive) setRatingCount(null);
        }
      } catch {
        if (alive) setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router.isReady, id]);

  const share = async () => {
    const url = `${window.location.origin}/status/${id}`;
    const title = complaint?.problems?.[0] || complaint?.category || "เรื่องร้องเรียน";
    try {
      if (navigator.share) {
        await navigator.share({ title: `ติดตามเรื่อง: ${title}`, url });
        return;
      }
    } catch {
      return; // ผู้ใช้กดยกเลิก share sheet
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/status");
  };

  const done = complaint?.status === DONE;
  const title = complaint?.problems?.[0] || complaint?.category || "เรื่องร้องเรียน";
  const officer = assignment?.user ?? null;
  const heroImages = complaint?.images ?? [];
  const showHero = !loading && !notFound && !!complaint && heroImages.length > 0;
  const categoryIcon = menu.find((m) => m.Prob_name === complaint?.category)?.Prob_pic;
  const codeText = complaint ? complaint.complaintId || complaint._id.slice(-8).toUpperCase() : "";

  return (
    <>
      <Head>
        <title>รายละเอียดสถานะ · Smart Takhli</title>
      </Head>
      <CitizenShell hideNav>
        {/* ── hero รูปเรื่อง (ตามแคนวาส): X ลอยมุมขวา · จุดสไลด์กลางบน ·
            ไอคอนหมวด(ไม่มีพื้นขาว) + ชุมชน + วันที่ + ชิปสถานะ ซ้อนบนรูป ── */}
        {showHero && (
          <PhotoSlider
            images={heroImages}
            heightClass="h-[250px]"
            rounded="rounded-none"
            dotsClass="top-4 left-1/2 -translate-x-1/2"
          >
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/65 to-transparent" />
            <button
              type="button"
              onClick={goBack}
              aria-label="ปิด"
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white"
            >
              <X size={20} />
            </button>
            <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-2">
              <div className="flex items-center gap-2.5">
                {categoryIcon && (
                  <Image src={categoryIcon} alt={complaint!.category || ""} width={52} height={52} className="h-[52px] w-[52px] rounded-full object-cover" />
                )}
                <div>
                  {complaint!.community && (
                    <div className="flex items-center gap-1.5 text-[13px] font-medium text-white">
                      <MapPin size={13} className="text-[#FBBF24]" />
                      ชุมชน{complaint!.community}
                    </div>
                  )}
                  {complaint!.createdAt && (
                    <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-white/85">
                      <Calendar size={13} />
                      {formatThaiDate(complaint!.createdAt)}
                    </div>
                  )}
                </div>
              </div>
              <span
                className="shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-bold text-white"
                style={{ background: done ? "#27AE60" : "#DB9A28" }}
              >
                {done ? "ดำเนินการเสร็จสิ้น" : "อยู่ระหว่างดำเนินการ"}
              </span>
            </div>
          </PhotoSlider>
        )}

        {/* หัวจอ (เมื่อไม่มี hero: กำลังโหลด/ไม่พบ/ไม่มีรูป) */}
        <div className={showHero ? "hidden" : "shrink-0 px-4 pb-3 pt-4"}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              aria-label="ย้อนกลับ"
              className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white shadow-[0_2px_8px_rgba(60,40,100,0.06)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A4458" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-bold leading-tight">รายละเอียดสถานะ</div>
              {complaint && (
                <div className="font-mono text-[11px] text-[#9590A8]">
                  {complaint.complaintId || complaint._id.slice(-8).toUpperCase()}
                </div>
              )}
            </div>
            {complaint && (
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={done ? { background: "#E6F6EC", color: "#1B935A" } : { background: "#FEF6E0", color: "#C77E10" }}
              >
                {done ? "เสร็จสิ้น" : "ดำเนินการ"}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-3 px-4 pb-6">
          {loading ? (
            <>
              <div className="h-24 skeleton rounded-[18px] bg-[#E9E4F3]" />
              <div className="h-56 skeleton rounded-[18px] bg-[#E9E4F3]" />
            </>
          ) : notFound || !complaint ? (
            <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_4px_14px_rgba(60,40,100,0.05)]">
              <div className="text-[15px] font-bold">ไม่พบเรื่องนี้</div>
              <p className="mt-1 text-[12px] text-[#9590A8]">เรื่องอาจถูกลบ หรือเป็นเรื่องลับที่ไม่เปิดเผยสาธารณะ</p>
              <button
                type="button"
                onClick={() => router.push("/status")}
                className="mt-4 rounded-full bg-[#7C3AED] px-5 py-2 text-[13px] font-semibold text-white"
              >
                กลับหน้าติดตามสถานะ
              </button>
            </div>
          ) : (
            <>
              {/* เลขที่คำร้อง — แถวใต้ hero ตามแคนวาส */}
              <div className="flex items-center justify-between rounded-[18px] bg-white p-4 shadow-[0_4px_14px_rgba(60,40,100,0.05)]">
                <span className="text-[13.5px] text-[#9590A8]">เลขที่คำร้อง</span>
                <span className="rounded-[12px] border border-[#ECEAF2] bg-[#F9F8FC] px-3.5 py-1.5 font-mono text-[15px] font-bold tracking-wide text-[#1B1830]">
                  {codeText}
                </span>
              </div>

              {/* หัวเรื่อง — เฉพาะเมื่อไม่มี hero (มี hero แล้วข้อมูลนี้อยู่บนรูป) */}
              {!showHero && (
                <div className="rounded-[18px] bg-white p-4 shadow-[0_4px_14px_rgba(60,40,100,0.05)]">
                  <div className="text-[16px] font-bold leading-snug">{title}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[#9590A8]">
                    {complaint.community && <span>ชุมชน{complaint.community}</span>}
                    {complaint.createdAt && <span>แจ้งเมื่อ {formatThaiDate(complaint.createdAt)}</span>}
                  </div>
                </div>
              )}

              <Timeline rows={statusTimeline(complaint, assignment)} />

              {(complaint.problems?.length ?? 0) > 0 && (
                <div className="rounded-[18px] bg-white p-4 shadow-[0_4px_14px_rgba(60,40,100,0.05)]">
                  <div className="text-[13px] font-bold">ปัญหาที่พบ</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {complaint.problems!.map((p) => {
                      const iconUrl = problemOptions.find((o: { label: string }) => o.label === p)?.iconUrl;
                      return (
                        <span
                          key={p}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#F1ECFE] py-1 pl-1.5 pr-3 text-[11.5px] font-medium text-[#7C3AED]"
                        >
                          {iconUrl && (
                            <Image src={iconUrl} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-full object-contain" />
                          )}
                          {p}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {complaint.detail && (
                <div className="rounded-[18px] bg-white p-4 shadow-[0_4px_14px_rgba(60,40,100,0.05)]">
                  <div className="text-[13px] font-bold">รายละเอียด</div>
                  <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-[#4A4458]">{complaint.detail}</p>
                </div>
              )}

              {/* เทียบก่อน-หลังเฉพาะเมื่อมีรูปผลงาน (รูปตั้งต้นอยู่ hero ข้างบนแล้ว) */}
              {(assignment?.solutionImages?.length ?? 0) > 0 && (
                <BeforeAfter before={complaint.images ?? []} after={assignment?.solutionImages ?? []} />
              )}

              {officer && (officer.name || officer.department) && (
                <div className="flex items-center gap-3 rounded-[18px] bg-white p-4 shadow-[0_4px_14px_rgba(60,40,100,0.05)]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F1ECFE] text-[#7C3AED]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="3.5" />
                      <path d="M5 20v-1a7 7 0 0 1 14 0v1" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* ไม่แสดงชื่อเต็มเจ้าหน้าที่ — ปิดนามสกุล (เจ้าของสั่ง) */}
                    <div className="text-[13.5px] font-semibold">{maskOfficerName(officer.name) || "เจ้าหน้าที่ผู้รับผิดชอบ"}</div>
                    <div className="text-[11.5px] text-[#9590A8]">
                      {[officer.position, officer.department].filter(Boolean).join(" · ") || "เทศบาลเมืองตาคลี"}
                    </div>
                  </div>
                </div>
              )}

              {/* บันทึกจากเจ้าหน้าที่ — note/solution ใน assignment (ของเดิมที่หายไป) */}
              {((assignment?.note?.trim()?.length ?? 0) > 0 || (assignment?.solution?.length ?? 0) > 0) && (
                <div className="rounded-[18px] bg-white p-4 shadow-[0_4px_14px_rgba(60,40,100,0.05)]">
                  <div className="flex items-center gap-1.5 text-[13px] font-bold">
                    <ClipboardList size={15} className="text-[#7C3AED]" />
                    บันทึกจากเจ้าหน้าที่
                  </div>
                  {(assignment!.solution?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {assignment!.solution!.map((s) => {
                        // ไอคอนวิธีแก้จาก AdminOption (field icon_url) — fallback เดียวกับ UI admin
                        const icon =
                          (adminOptions as { label: string; icon_url?: string }[]).find((o) => o.label === s)
                            ?.icon_url || "/check-icon.png";
                        return (
                          <span
                            key={s}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F6EC] py-1 pl-1.5 pr-3 text-[11.5px] font-medium text-[#1B935A]"
                          >
                            <Image src={icon} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-full object-contain" />
                            {s}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {assignment!.note?.trim() && (
                    <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-[#4A4458]">
                      {assignment!.note}
                    </p>
                  )}
                </div>
              )}

              {/* ให้คะแนนความพึงพอใจ — การ์ดชมพู + หัวใจ + ดาว 5 ดวง (ตามแคนวาส) */}
              {(() => {
                const ratable = done && ratingCount != null && ratingCount < MAX_RATINGS;
                const full = done && ratingCount != null && ratingCount >= MAX_RATINGS;
                const subtitle = !done
                  ? "ทำได้เมื่อดำเนินการเสร็จสิ้น"
                  : full
                    ? "เรื่องนี้ได้รับคะแนนครบแล้ว ขอบคุณสำหรับความคิดเห็น"
                    : "แตะดาวเพื่อให้คะแนนเรื่องนี้";
                return (
                  <div className="rounded-[18px] bg-[#FDF0F4] p-4 shadow-[0_4px_14px_rgba(60,40,100,0.05)]">
                    <button
                      type="button"
                      disabled={!ratable}
                      onClick={() => setShowRating(true)}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#F0527C] to-[#E23A56] shadow-[0_6px_14px_rgba(226,58,86,0.30)]">
                        <Heart size={22} color="#fff" fill="#fff" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-bold text-[#1B1830]">ให้คะแนนความพึงพอใจ</span>
                        <span className={`mt-0.5 block text-[12px] ${full ? "text-[#1B935A]" : "text-[#9590A8]"}`}>{subtitle}</span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={17}
                            color={ratable ? "#F2A93B" : "#EFC7D4"}
                            fill={ratable ? "#F2A93B" : "#EFC7D4"}
                          />
                        ))}
                      </span>
                    </button>
                    {ratable && showRating && (
                      <div className="mt-3">
                        <SatisfactionForm
                          complaintId={complaint._id}
                          status={complaint.status}
                          onSubmit={() => {
                            setShowRating(false);
                            setRatingCount((prev) => (prev == null ? prev : prev + 1));
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* ปุ่มล่าง */}
        {complaint && !notFound && (
          <div className="sticky bottom-0 z-20 flex shrink-0 gap-2.5 border-t border-[#EFEDF4] bg-white px-4 pb-7 pt-3">
            <a
              href={`tel:${CONTACT_PHONE_TEL}`}
              title={`โทร ${CONTACT_PHONE_DISPLAY}`}
              className="w-[118px] rounded-[15px] bg-[#F1ECFE] py-3.5 text-center text-[14px] font-semibold text-[#7C3AED]"
            >
              ติดต่อ จนท.
            </a>
            <button
              type="button"
              onClick={share}
              className="flex-1 rounded-[15px] bg-gradient-to-br from-[#7C3AED] to-[#9050F0] py-3.5 text-center text-[14px] font-semibold text-white shadow-[0_10px_22px_rgba(124,58,237,0.30)]"
            >
              {shared ? "คัดลอกลิงก์แล้ว ✓" : "แชร์เรื่องนี้"}
            </button>
          </div>
        )}
      </CitizenShell>
    </>
  );
}
