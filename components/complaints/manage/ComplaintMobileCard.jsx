// components/complaints/manage/ComplaintMobileCard.jsx
// การ์ด 1 เรื่อง (จอ 1) — ปุ่มหลักตาม rowState: pending=รับเรื่อง · progress=อัปเดต+ปิดเรื่อง · done=ดูผล
import clsx from "clsx";
import { EllipsisHorizontalIcon, UserIcon } from "@heroicons/react/24/outline";

const PILL = {
  pending: { label: "รอมอบหมาย", cls: "bg-amber-100 text-amber-800" },
  progress: { label: "กำลังดำเนินการ", cls: "bg-blue-100 text-blue-700" },
  done: { label: "เสร็จสิ้น", cls: "bg-emerald-100 text-emerald-800" },
};

export default function ComplaintMobileCard({
  complaint,
  state,
  officer,
  ageText,
  isStale,
  onOpenDetail,
  onAssign,
  onUpdate,
  onCloseComplaint,
  onMore,
}) {
  const pill = PILL[state] || PILL.pending;
  const thumb = Array.isArray(complaint.images) && complaint.images.length > 0 ? complaint.images[0] : null;
  const problems = Array.isArray(complaint.problems) ? complaint.problems.join(", ") : "";
  const meta = [complaint.category, problems, complaint.community].filter(Boolean).join(" · ");
  const officerText = officer ? [officer.name, officer.position].filter(Boolean).join(" · ") : "ยังไม่มีผู้รับเรื่อง";

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <button type="button" onClick={() => onOpenDetail(complaint)} className="block w-full px-3 pt-3 pb-2.5 text-left">
        <span className="mb-2 flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-gray-700">{complaint.complaintId || "—"}</span>
          <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold", pill.cls)}>{pill.label}</span>
          <span className={clsx("ml-auto text-xs font-medium", isStale ? "text-orange-700" : "text-gray-500")}>{ageText}</span>
        </span>
        <span className="flex gap-3">
          <span className="block min-w-0 flex-1">
            {meta && <span className="mb-1 block truncate text-xs text-gray-500">{meta}</span>}
            <span className="line-clamp-2 text-[15px] font-medium leading-snug text-gray-900">{complaint.detail}</span>
          </span>
          {thumb && <img src={thumb} alt="" loading="lazy" className="h-[60px] w-[60px] flex-none rounded-[10px] object-cover" />}
        </span>
        <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-xs text-gray-600">
            <UserIcon className="h-3.5 w-3.5" aria-hidden />
            {officerText}
          </span>
          {complaint.isConfidential && (
            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">เรื่องลับ</span>
          )}
          {complaint.pdpaSensitive && (
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">PDPA</span>
          )}
        </span>
      </button>

      <div className="flex gap-2 border-t border-gray-100 px-3 pt-2.5 pb-3">
        {state === "pending" && (
          <button type="button" onClick={() => onAssign(complaint)} className="h-11 flex-1 rounded-xl bg-blue-600 text-[15px] font-semibold text-white active:bg-blue-700">
            รับเรื่อง
          </button>
        )}
        {state === "progress" && (
          <>
            <button type="button" onClick={() => onUpdate(complaint)} className="h-11 flex-1 rounded-xl border border-blue-200 bg-blue-50 text-[15px] font-semibold text-blue-700 active:bg-blue-100">
              อัปเดต
            </button>
            <button type="button" onClick={() => onCloseComplaint(complaint)} className="h-11 flex-1 rounded-xl bg-emerald-700 text-[15px] font-semibold text-white active:bg-emerald-800">
              ปิดเรื่อง
            </button>
          </>
        )}
        {state === "done" && (
          <button type="button" onClick={() => onOpenDetail(complaint)} className="h-11 flex-1 rounded-xl border border-gray-200 bg-white text-[15px] font-semibold text-gray-700 active:bg-gray-50">
            ดูผลการดำเนินการ
          </button>
        )}
        <button
          type="button"
          onClick={() => onMore(complaint)}
          aria-label={`คำสั่งเพิ่มเติม ${complaint.complaintId || ""}`.trim()}
          className="grid h-11 w-11 flex-none place-items-center rounded-xl border border-gray-200 bg-white text-gray-700 active:bg-gray-50"
        >
          <EllipsisHorizontalIcon className="h-5 w-5" />
        </button>
      </div>
    </article>
  );
}
