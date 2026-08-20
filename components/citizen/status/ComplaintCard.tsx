// components/citizen/status/ComplaintCard.tsx
// การ์ดเรื่องร้องเรียนในลิสต์ติดตามสถานะ (แคนวาสจอ "ติดตามสถานะ"):
// ไอคอนหมวด · ชื่อเรื่อง · เลขเรื่อง mono · ชิปสถานะ · progress 4 ท่อน · อัปเดตล่าสุด
import Image from "next/image";
import Link from "next/link";
import { statusProgress } from "@/lib/citizen/status/progress";
import { formatThaiDate } from "@/components/activities/ActivityFeedCard";

export type ComplaintListItem = {
  _id: string;
  complaintId?: string; // รหัสคำร้องจริง เช่น TKC-690017 (เลขเดียวกับจอส่งสำเร็จ/LINE)
  category?: string;
  problems?: string[];
  images?: string[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AssignmentLite = {
  assignedAt?: string | null;
  completedAt?: string | null;
} | null;

const DONE = "ดำเนินการเสร็จสิ้น";

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
  const done = complaint.status === DONE;
  const title = complaint.problems?.[0] || complaint.category || "เรื่องร้องเรียน";
  const chip = done
    ? { bg: "#E6F6EC", text: "#1B935A", label: "เสร็จสิ้น" }
    : { bg: "#FEF6E0", text: "#C77E10", label: "ดำเนินการ" };

  return (
    <Link
      href={`/status/${complaint._id}`}
      className="block rounded-[16px] bg-white p-3.5 shadow-[0_4px_12px_rgba(60,40,100,0.04)] transition hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-3">
        {/* รูปถ่ายจริงของเรื่อง (PDPA เบลอจาก server แล้ว) — ไม่มีรูปค่อยใช้ไอคอนหมวด */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-[#F1ECFE]">
          {complaint.images?.[0] ? (
            <Image src={complaint.images[0]} alt="" width={56} height={56} className="h-full w-full object-cover" />
          ) : iconUrl ? (
            <Image src={iconUrl} alt="" width={56} height={56} className="h-full w-full object-cover" />
          ) : (
            <span className="text-[16px] font-bold text-[#7C3AED]">{(complaint.category || "ร").slice(0, 1)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-1 text-[14px] font-semibold">{title}</div>
          <div className="mt-0.5 font-mono text-[11px] text-[#9590A8]">
            {complaint.complaintId || complaint._id.slice(-8).toUpperCase()}
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: chip.bg, color: chip.text }}
        >
          {chip.label}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="h-1 flex-1 rounded-full"
            style={{ background: n <= progress.step ? "#7C3AED" : "#E4DEF2" }}
          />
        ))}
      </div>
      <div className="mt-2 text-[11px] text-[#9590A8]">
        อัปเดตล่าสุด · {progress.label}
        {complaint.updatedAt ? ` · ${formatThaiDate(complaint.updatedAt)}` : ""}
      </div>
    </Link>
  );
}
