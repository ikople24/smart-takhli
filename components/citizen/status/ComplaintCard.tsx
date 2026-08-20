// components/citizen/status/ComplaintCard.tsx
// การ์ดเรื่องร้องเรียนแบบหน้าเดิม (ตามที่เจ้าของสั่ง 2026-08-20):
// รูปใหญ่เต็มความกว้าง (หลายรูป = สไลด์ปัดได้ + จุดบอกตำแหน่ง) · ป้ายวันที่มุมบน
// · ไอคอนหมวด+ชื่อหมวด+ชุมชนซ้อนบนรูป · ชิปปัญหา + รหัสคำร้องจริง (TKC-…)
// · รายละเอียดย่อ · ขั้นตอน 4 ไอคอนพร้อมป้าย (รับเรื่อง→มอบหมาย→ดำเนินการ→เสร็จสิ้น)
import Image from "next/image";
import Link from "next/link";
import { FileText, UserCheck, Clock, CheckCircle2, MapPin, Calendar } from "lucide-react";
import { statusProgress } from "@/lib/citizen/status/progress";
import { formatThaiDate } from "@/components/activities/ActivityFeedCard";
import PhotoSlider from "./PhotoSlider";

export type ComplaintListItem = {
  _id: string;
  complaintId?: string; // รหัสคำร้องจริง เช่น TKC-690017 (เลขเดียวกับจอส่งสำเร็จ/LINE)
  category?: string;
  problems?: string[];
  images?: string[];
  detail?: string;
  community?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AssignmentLite = {
  assignedAt?: string | null;
  completedAt?: string | null;
} | null;

const STEPS = [
  { label: "รับเรื่อง", Icon: FileText, color: "#22C55E" },
  { label: "มอบหมาย", Icon: UserCheck, color: "#4F6EF7" },
  { label: "ดำเนินการ", Icon: Clock, color: "#F2A93B" },
  { label: "เสร็จสิ้น", Icon: CheckCircle2, color: "#16A34A" },
];

function StepRow({ step }: { step: number }) {
  return (
    <div className="mt-3 flex items-center rounded-[14px] bg-[#F8F7FB] px-2 py-2.5">
      {STEPS.map(({ label, Icon, color }, i) => {
        const reached = i + 1 <= step;
        return (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-1 flex-col items-center gap-1">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: reached ? color : "#ECE9F3" }}
              >
                <Icon size={17} color={reached ? "#fff" : "#9590A8"} strokeWidth={2.2} />
              </span>
              <span className="text-[10px] font-semibold" style={{ color: reached ? color : "#9590A8" }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className="mb-4 h-[2.5px] w-6 shrink-0 rounded-full"
                style={{ background: i + 2 <= step ? STEPS[i + 1].color : "#ECE9F3" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ComplaintCard({
  complaint,
  assignment,
  iconUrl,
}: {
  complaint: ComplaintListItem;
  assignment: AssignmentLite;
  iconUrl?: string;
}) {
  const progress = statusProgress(complaint, assignment);
  const images = complaint.images ?? [];

  const headOverlay = (
    <>
      {/* ไล่เงาล่างให้ตัวหนังสือบนรูปอ่านออก */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
      {complaint.createdAt && (
        <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11.5px] font-semibold text-[#1B1830]">
          <Calendar size={13} className="text-[#4F6EF7]" />
          {formatThaiDate(complaint.createdAt)}
        </span>
      )}
      <div className="absolute bottom-3 left-3 flex items-center gap-2.5">
        {iconUrl && (
          <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[12px] bg-white p-1">
            <Image src={iconUrl} alt="" width={40} height={40} className="h-full w-full rounded-[8px] object-cover" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-[15px] font-bold leading-tight text-white drop-shadow">{complaint.category || "เรื่องร้องเรียน"}</span>
          {complaint.community && (
            <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-white/90">
              <MapPin size={12} className="text-[#FBBF24]" />
              {complaint.community}
            </span>
          )}
        </span>
      </div>
    </>
  );

  return (
    <Link
      href={`/status/${complaint._id}`}
      className="block overflow-hidden rounded-[18px] bg-white shadow-[0_4px_14px_rgba(60,40,100,0.05)] transition hover:-translate-y-0.5"
    >
      {images.length > 0 ? (
        <PhotoSlider images={images} heightClass="h-[170px]" rounded="rounded-none">
          {headOverlay}
        </PhotoSlider>
      ) : (
        /* ไม่มีรูป — หัวแบบแถบไอคอนหมวดแทน */
        <div className="flex items-center gap-2.5 px-3.5 pt-3.5">
          <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[12px] bg-[#F1ECFE]">
            {iconUrl ? (
              <Image src={iconUrl} alt="" width={44} height={44} className="h-full w-full object-cover" />
            ) : (
              <span className="text-[16px] font-bold text-[#7C3AED]">{(complaint.category || "ร").slice(0, 1)}</span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold leading-tight">{complaint.category || "เรื่องร้องเรียน"}</span>
            {complaint.community && (
              <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-[#9590A8]">
                <MapPin size={12} className="text-[#F2A93B]" />
                {complaint.community}
              </span>
            )}
          </span>
          {complaint.createdAt && (
            <span className="shrink-0 text-[11px] text-[#9590A8]">{formatThaiDate(complaint.createdAt)}</span>
          )}
        </div>
      )}

      <div className="px-3.5 pb-3.5 pt-3">
        <div className="flex items-center justify-between gap-2">
          {complaint.problems?.[0] ? (
            <span className="inline-flex max-w-[65%] items-center rounded-full bg-[#F1ECFE] px-3 py-1 text-[11.5px] font-semibold text-[#7C3AED]">
              <span className="truncate">{complaint.problems[0]}</span>
              {complaint.problems.length > 1 && <span className="ml-1 shrink-0">+{complaint.problems.length - 1}</span>}
            </span>
          ) : (
            <span />
          )}
          <span className="shrink-0 font-mono text-[11px] text-[#9590A8]">
            {complaint.complaintId || complaint._id.slice(-8).toUpperCase()}
          </span>
        </div>
        {complaint.detail && (
          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[#4A4458]">{complaint.detail}</p>
        )}
        <StepRow step={progress.step} />
      </div>
    </Link>
  );
}
