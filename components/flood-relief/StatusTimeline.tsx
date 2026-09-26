// components/flood-relief/StatusTimeline.tsx
// ไทม์ไลน์ 4 ขั้นฝั่งประชาชน (หน้าจอ 3) — ขั้นมาจาก citizenStep ที่ server คำนวณ (client ไม่ตีความสถานะเอง)
import { Check } from "lucide-react";
import { CITIZEN_STEPS } from "@/lib/flood-relief/status";
import { thaiWhen } from "@/lib/flood-relief/time";

type Req = {
  status: string;
  citizenStep: number;
  createdAt: string | null;
  assignedAt: string | null;
  dispatchedAt: string | null;
  onSiteAt: string | null;
  doneAt: string | null;
  zoneLabel?: string | null;
};

export default function StatusTimeline({ request }: { request: Req }) {
  const step = request.citizenStep;
  const subs: Array<string | null> = [
    thaiWhen(request.createdAt),
    request.status === "dispatched"
      ? `ทีมออกเดินทางแล้ว ${thaiWhen(request.dispatchedAt)}`.trim()
      : request.assignedAt
        ? `มอบหมายทีมแล้ว ${thaiWhen(request.assignedAt)}`
        : request.zoneLabel ?? null,
    request.onSiteAt ? thaiWhen(request.onSiteAt) : null,
    request.doneAt ? thaiWhen(request.doneAt) : null,
  ];

  return (
    <ol className="mt-3.5 flex flex-col">
      {CITIZEN_STEPS.map((label, i) => {
        const done = i < step || (i === step && i === CITIZEN_STEPS.length - 1);
        const current = i === step && !done;
        const last = i === CITIZEN_STEPS.length - 1;
        return (
          <li key={label} className="flex gap-3">
            <div className="flex w-[22px] shrink-0 flex-col items-center">
              {done ? (
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-tk-done">
                  <Check size={13} strokeWidth={3} className="text-white" aria-hidden />
                </span>
              ) : current ? (
                <span className="flood-pulse h-[22px] w-[22px] shrink-0 rounded-full border-[3px] border-tk-due bg-white" />
              ) : (
                <span className="h-[22px] w-[22px] shrink-0 rounded-full border-2 border-tk-line-dashed bg-white" />
              )}
              {!last && <span className={`min-h-[22px] w-0.5 flex-1 ${done ? "bg-tk-done" : "bg-tk-line"}`} />}
            </div>
            <div className={last ? "" : "pb-3.5"}>
              <div
                className={`text-[13px] font-semibold leading-[1.3] ${
                  current ? "text-tk-due-ink" : done ? "" : "text-tk-ink-6"
                }`}
              >
                {current && i === 1 ? "กำลังจัดทีมเข้าช่วยเหลือ" : label}
                <span className="sr-only">{done ? " (เสร็จแล้ว)" : current ? " (ขั้นปัจจุบัน)" : ""}</span>
              </div>
              {(done || current) && subs[i] && <div className="text-[11px] text-tk-ink-4">{subs[i]}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
