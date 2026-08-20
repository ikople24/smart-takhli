// pages/status/[id].tsx
// จอรายละเอียดสถานะรายเรื่อง (เฟส 3) — timeline 4 ขั้น + ปัญหา/รายละเอียด +
// รูปก่อน-หลัง + การ์ดเจ้าหน้าที่ + ให้คะแนนเมื่อเสร็จสิ้น
// spec: docs/superpowers/specs/2026-08-19-citizen-status-design.md
// ข้อมูลทุกส่วนจาก API สาธารณะเดิม (PDPA sanitize ฝั่ง server) — ไม่เพิ่มการเปิดเผยใหม่
import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import CitizenShell from "@/components/citizen/CitizenShell";
import Timeline from "@/components/citizen/status/Timeline";
import BeforeAfter from "@/components/citizen/status/BeforeAfter";
import PhotoSlider from "@/components/citizen/status/PhotoSlider";
import SatisfactionForm from "@/components/SatisfactionForm";
import { statusTimeline } from "@/lib/citizen/status/progress";
import { formatThaiDate } from "@/components/activities/ActivityFeedCard";

const DONE = "ดำเนินการเสร็จสิ้น";
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
  userId?: string;
  user?: Officer;
} | null;

export default function StatusDetail() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";

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
  const officerPhone = officer?.phone?.replace(/[^0-9+]/g, "") || "";

  return (
    <>
      <Head>
        <title>รายละเอียดสถานะ · Smart Takhli</title>
      </Head>
      <CitizenShell hideNav>
        {/* หัวจอ */}
        <div className="shrink-0 px-4 pb-3 pt-4">
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
              {/* รูปตั้งต้นของเรื่อง — โชว์ทันทีบนสุด (หลายรูปปัดสไลด์ได้) */}
              {(complaint.images?.length ?? 0) > 0 && <PhotoSlider images={complaint.images!} />}

              {/* หัวเรื่อง */}
              <div className="rounded-[18px] bg-white p-4 shadow-[0_4px_14px_rgba(60,40,100,0.05)]">
                <div className="text-[16px] font-bold leading-snug">{title}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[#9590A8]">
                  {complaint.community && <span>ชุมชน{complaint.community}</span>}
                  {complaint.createdAt && <span>แจ้งเมื่อ {formatThaiDate(complaint.createdAt)}</span>}
                </div>
              </div>

              <Timeline rows={statusTimeline(complaint, assignment)} />

              {(complaint.problems?.length ?? 0) > 0 && (
                <div className="rounded-[18px] bg-white p-4 shadow-[0_4px_14px_rgba(60,40,100,0.05)]">
                  <div className="text-[13px] font-bold">ปัญหาที่พบ</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {complaint.problems!.map((p) => (
                      <span key={p} className="rounded-full bg-[#F1ECFE] px-3 py-1 text-[11.5px] font-medium text-[#7C3AED]">
                        {p}
                      </span>
                    ))}
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
                    <div className="text-[13.5px] font-semibold">{officer.name || "เจ้าหน้าที่ผู้รับผิดชอบ"}</div>
                    <div className="text-[11.5px] text-[#9590A8]">
                      {[officer.position, officer.department].filter(Boolean).join(" · ") || "เทศบาลเมืองตาคลี"}
                    </div>
                  </div>
                </div>
              )}

              {/* ให้คะแนนความพึงพอใจ */}
              <div className="rounded-[18px] bg-white p-4 shadow-[0_4px_14px_rgba(60,40,100,0.05)]">
                <div className="text-[13px] font-bold">ให้คะแนนความพึงพอใจ</div>
                {!done ? (
                  <p className="mt-1 text-[12px] text-[#9590A8]">ทำได้เมื่อดำเนินการเสร็จสิ้น</p>
                ) : ratingCount != null && ratingCount >= MAX_RATINGS ? (
                  <p className="mt-1 text-[12px] text-[#1B935A]">เรื่องนี้ได้รับคะแนนครบแล้ว ขอบคุณสำหรับความคิดเห็น</p>
                ) : showRating ? (
                  <div className="mt-2">
                    <SatisfactionForm
                      complaintId={complaint._id}
                      status={complaint.status}
                      onSubmit={() => {
                        setShowRating(false);
                        setRatingCount((prev) => (prev == null ? prev : prev + 1));
                      }}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowRating(true)}
                    className="mt-2.5 rounded-full bg-[#7C3AED] px-4 py-2 text-[12.5px] font-semibold text-white"
                  >
                    ให้คะแนนเรื่องนี้
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* ปุ่มล่าง */}
        {complaint && !notFound && (
          <div className="sticky bottom-0 z-20 flex shrink-0 gap-2.5 border-t border-[#EFEDF4] bg-white px-4 pb-7 pt-3">
            {officerPhone && (
              <a
                href={`tel:${officerPhone}`}
                className="w-[118px] rounded-[15px] bg-[#F1ECFE] py-3.5 text-center text-[14px] font-semibold text-[#7C3AED]"
              >
                ติดต่อ จนท.
              </a>
            )}
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
