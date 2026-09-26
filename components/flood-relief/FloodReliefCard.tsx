// components/flood-relief/FloodReliefCard.tsx
// บล็อกปุ่มใหญ่บนหน้าแรก (หน้าจอ 1) — อยู่ใต้การ์ด "สวัสดีวัน…" แสดงเฉพาะเมื่อศูนย์ฯ เปิด
// ปิดศูนย์ฯ / โหลด summary ไม่ได้ = ไม่แสดงเลย (ไม่ให้หน้าแรกรก และไม่ชวนส่งคำขอที่ server จะปฏิเสธ)
// โทนแดงฉุกเฉิน (เจ้าของสั่ง 2026-09-26 — ดีไซน์เดิมเป็นน้ำเงิน tk-flood) ให้เด่นเป็นเรื่องเร่งด่วนบนหน้าแรก
// ตัวขาวบน #C62839 ผ่าน 4.5:1 · หน้าฟอร์ม/สถานะยังเป็นน้ำเงินประจำโมดูลตามเดิม
import Link from "next/link";
import { ChevronRight, Clock, Phone, TriangleAlert } from "lucide-react";
import { REQUEST_TYPES, type RequestType } from "@/lib/flood-relief/status";
import { SITUATION_META } from "@/lib/flood-relief/zones";
import { telHref } from "@/lib/flood-relief/settings";
import { thaiClock } from "@/lib/flood-relief/time";
import { TypeIcon } from "./icons";
import { useFloodSummary } from "./useFloodSummary";

/** ป้ายบนปุ่มวงกลม — ตัด 2 บรรทัดตามดีไซน์ */
const TILE_LABEL: Record<RequestType, [string, string]> = {
  evac: ["การอพยพ", "ผู้ป่วย"],
  drain: ["การระบาย", "น้ำ"],
  sand: ["ขอรับ", "กระสอบทราย"],
  other: ["ผลกระทบ", "อื่นๆ"],
};

export default function FloodReliefCard() {
  const { summary } = useFloodSummary();
  if (!summary?.centerOpen) return null;

  const situation = SITUATION_META[summary.level] ?? SITUATION_META.normal;

  return (
    <section
      aria-labelledby="flood-title"
      className="relative mx-4 mt-3 overflow-hidden rounded-[22px] bg-tk-emergency p-4 shadow-tk-emergency-card"
    >
      {/* คลื่นน้ำ 2 ชั้นที่ก้นการ์ด */}
      <svg
        aria-hidden
        viewBox="0 0 358 104"
        preserveAspectRatio="none"
        className="pointer-events-none absolute bottom-0 left-0 h-[104px] w-full"
      >
        <path d="M0 36 C 45 22 90 50 135 36 S 225 22 270 36 S 330 46 358 34 V104 H0 Z" fill="var(--color-tk-emergency-wave)" />
        <path d="M0 62 C 50 50 100 74 150 62 S 250 50 300 62 S 340 68 358 60 V104 H0 Z" fill="var(--color-tk-emergency-wave-2)" />
      </svg>

      <div className="relative flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 py-[5px] pl-2.5 pr-[11px] text-[11.5px] font-semibold text-white">
            <span className="relative inline-block h-2 w-2">
              <span className="flood-ring absolute inset-0 rounded-full" style={{ background: situation.dot }} />
              <span className="absolute inset-0 rounded-full ring-[1.5px] ring-white" style={{ background: situation.dot }} />
            </span>
            สถานการณ์น้ำ · {situation.label}
          </span>
          {summary.updatedAt && (
            <span className="text-[10.5px] text-white/80">อัปเดต {thaiClock(summary.updatedAt)}</span>
          )}
        </div>

        <h2 id="flood-title" className="mt-3 text-[18px] font-bold leading-[1.3] text-white">
          ศูนย์ช่วยเหลือผู้ประสบภัยน้ำท่วม
        </h2>
        <p className="mt-0.5 text-[12.5px] leading-normal text-white/85">แตะเรื่องที่ต้องการ ส่งตำแหน่งถึงเจ้าหน้าที่ได้ทันที</p>
        {summary.announcement && (
          <p className="mt-2 rounded-xl bg-black/15 px-3 py-2 text-[12px] leading-normal text-white">{summary.announcement}</p>
        )}

        <div className="mt-3.5 grid grid-cols-4 gap-1">
          {REQUEST_TYPES.map((t) => (
            <Link
              key={t}
              href={`/flood/request?type=${t}`}
              className="flood-tile flex flex-col items-center gap-2 py-0.5 text-white"
            >
              <span className="flood-disc flex h-[62px] w-[62px] items-center justify-center rounded-full bg-white text-tk-emergency shadow-[0_4px_10px_rgba(90,10,20,0.28)]">
                <TypeIcon type={t} size={32} />
              </span>
              <span className="text-center text-[11.5px] font-semibold leading-[1.3]">
                {TILE_LABEL[t][0]}
                <br />
                {TILE_LABEL[t][1]}
              </span>
            </Link>
          ))}
        </div>

        <Link
          href="/flood/request"
          className="mt-4 flex h-[54px] items-center justify-center gap-2.5 rounded-2xl bg-white text-[16.5px] font-bold text-tk-emergency-dark shadow-[0_6px_14px_rgba(90,10,20,0.3)] transition hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          <TriangleAlert size={22} strokeWidth={2.2} className="text-tk-emergency" aria-hidden />
          ขอความช่วยเหลือด่วน
          <ChevronRight size={18} strokeWidth={2.4} aria-hidden />
        </Link>

        <div className="mt-2.5 flex items-center justify-center gap-4">
          <Link href="/flood/status" className="inline-flex min-h-9 items-center gap-1.5 text-[12.5px] font-semibold text-white">
            <Clock size={16} aria-hidden />
            ติดตามคำขอของฉัน
          </Link>
          <span aria-hidden className="h-3.5 w-px bg-white/40" />
          <a href={telHref(summary.hotline)} className="inline-flex min-h-9 items-center gap-1.5 text-[12.5px] font-semibold text-white">
            <Phone size={16} aria-hidden />
            โทรศูนย์ฯ {summary.hotline}
          </a>
        </div>
      </div>
    </section>
  );
}
