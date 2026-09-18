// components/citizen/report/ConsentScreen.tsx
// จอข้อตกลงก่อนเริ่ม wizard แจ้งเรื่อง (อาร์ตบอร์ด 1a)
// - ติ๊กยอมรับไม่ได้จนกว่าจะเลื่อนอ่านถึงท้ายหน้า (เนื้อหาสั้นกว่าจอ = ถือว่าครบทันที)
// - ปุ่ม "ไม่ยอมรับ" เปิดแผ่นยืนยันยกเลิก
// - ข้อความทุกบรรทัดมาจาก lib/citizen/report/consentContent.js (แก้ที่นั่นที่เดียว)
import { useEffect, useState } from "react";
import ConsentCancelSheet from "./ConsentCancelSheet";
import {
  CONSENT_ACCEPT_LABEL,
  CONSENT_CHECKBOX_LABEL,
  CONSENT_DECLINE_LABEL,
  CONSENT_FOOTER_NOTE,
  CONSENT_HEADER,
  CONSENT_INTRO,
  CONSENT_SCROLL_HINT,
  CONSENT_SECTIONS,
  CONSENT_UPDATED_LABEL,
  EMERGENCY,
} from "@/lib/citizen/report/consentContent";

type Run = { t: string; b?: boolean; danger?: boolean };

function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((run, i) =>
        run.b ? (
          <b key={i} className={`font-semibold ${run.danger ? "text-[#B91C1C]" : "text-[#4A4458]"}`}>
            {run.t}
          </b>
        ) : (
          <span key={i}>{run.t}</span>
        )
      )}
    </>
  );
}

function DenyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#DC2626"
      strokeWidth={2.4}
      strokeLinecap="round"
      className="mt-0.5 shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

export default function ConsentScreen({
  onAccept,
  onExit,
  onCancel,
}: {
  onAccept: () => void;
  onExit: () => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // ด่านเลื่อนอ่าน: ใช้ scroll ของทั้งหน้า (หน้าฝั่งประชาชนเลื่อนทั้งหน้า ไม่ใช่กล่องใน)
  // วัดค่าใน requestAnimationFrame กันอ่าน layout รัวทุก scroll event — เช็คแรกตอน mount
  // ยังเป็น synchronous เพื่อให้เนื้อหาสั้นกว่าจอปลดล็อกได้ทันที ไม่ต้องรอเฟรมแรก
  //
  // ตั้งใจวัดจาก window + document.documentElement เพราะจอนี้เลื่อนทั้งหน้าจริง ๆ (ไม่มีกล่องเลื่อนของตัวเอง)
  // อย่าเปลี่ยนไปวัด element ใดในนี้แทน: ขั้นอื่นของ wizard (StepCategory/StepDetails/StepReporter) มี
  // <div className="flex-1 overflow-auto"> อยู่ ซึ่ง "ไม่ได้เลื่อน" จริง (ไม่ใช่กล่องที่ล้น) — วัดกล่องนั้น
  // จะได้ scrollTop = 0 ตลอด ด่านจึงไม่มีวันปลดล็อกและไม่มีใครติ๊กยอมรับได้เลย
  useEffect(() => {
    let frame: number | null = null;

    const measure = () => {
      frame = null;
      const doc = document.documentElement;
      const done = window.innerHeight + window.scrollY >= doc.scrollHeight - 24;
      setAtEnd((prev) => (prev === done ? prev : done));
    };

    const scheduleMeasure = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", scheduleMeasure, { passive: true });
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <div className="shrink-0 px-4 pb-3.5 pt-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            aria-label="ย้อนกลับ"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-white shadow-[0_2px_8px_rgba(60,40,100,0.06)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A4458" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-bold leading-tight">{CONSENT_HEADER.title}</div>
            <div className="mt-0.5 text-[11px] text-[#9590A8]">{CONSENT_HEADER.subtitle}</div>
          </div>
          <span className="shrink-0 rounded-[8px] bg-[#F1ECFE] px-2.5 py-1.5 text-[10px] font-semibold text-[#7C3AED]">
            {CONSENT_HEADER.badge}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-4 pb-5">
        <div className="flex items-start gap-3 rounded-[16px] bg-white p-3.5 shadow-[0_4px_12px_rgba(60,40,100,0.04)]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#F1ECFE]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M9 15h6" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold">{CONSENT_INTRO.title}</div>
            <p className="mt-1 text-[12px] leading-[1.7] text-[#6B6880]">{CONSENT_INTRO.body}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-[16px] border border-[#FBD5D5] bg-[#FFF5F5] p-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#FEE2E2]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-[#B91C1C]">{EMERGENCY.title}</div>
            <p className="mt-1 text-[12px] leading-[1.7] text-[#7F1D1D]">{EMERGENCY.body}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <a
                href={`tel:${EMERGENCY.phone}`}
                className="flex items-center gap-1.5 rounded-[11px] bg-[#DC2626] px-3 py-2 text-[12px] font-semibold text-white"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.9.36 1.78.7 2.61a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.47-1.27a2 2 0 0 1 2.11-.45c.83.34 1.71.57 2.61.7A2 2 0 0 1 22 16.92Z" />
                </svg>
                {EMERGENCY.phone}
              </a>
              <span className="text-[11px] text-[#9F5B5B]">{EMERGENCY.phoneNote}</span>
            </div>
            <p className="mt-2 text-[11.5px] leading-[1.6] text-[#7F1D1D]">
              {EMERGENCY.animal.label}{" "}
              <a href={`tel:${EMERGENCY.animal.phone}`} className="font-semibold underline">
                {EMERGENCY.animal.phone}
              </a>
            </p>
          </div>
        </div>

        {CONSENT_SECTIONS.map((section) => (
          <div key={section.n} className="rounded-[16px] bg-white p-4 shadow-[0_4px_12px_rgba(60,40,100,0.04)]">
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-bold text-[#7C3AED]">{section.n}.</span>
              <div className="text-[13px] font-bold">{section.title}</div>
            </div>

            {section.paragraphs?.map((runs: Run[], i: number) => (
              <p key={i} className="mt-2 text-[12px] leading-[1.85] text-[#6B6880]">
                <Runs runs={runs} />
              </p>
            ))}

            {section.chips && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {section.chips.map((chip: string) => (
                  <span key={chip} className="rounded-[9px] bg-[#F4F0FE] px-2.5 py-1.5 text-[11px] text-[#7C3AED]">
                    {chip}
                  </span>
                ))}
              </div>
            )}

            {section.denyList && (
              <div className="mt-3 flex flex-col gap-2.5">
                {section.denyList.map((item: string) => (
                  <div key={item} className="flex items-start gap-2.5 rounded-[12px] bg-[#FAF9FC] px-3 py-2.5">
                    <DenyIcon />
                    <div className="text-[12px] leading-[1.7] text-[#4A4458]">{item}</div>
                  </div>
                ))}
              </div>
            )}

            {section.statusChips && (
              <div className="mt-2.5 flex flex-col gap-1.5">
                {section.statusChips.map((chip: string) => (
                  <span
                    key={chip}
                    className="self-start rounded-[10px] border border-dashed border-[#C9BCEC] bg-[#F1ECFE] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#3F3B52]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}

            {section.tailParagraph && (
              <p className="mt-2.5 text-[12px] leading-[1.85] text-[#6B6880]">
                <Runs runs={section.tailParagraph} />
              </p>
            )}
          </div>
        ))}

        <div className="py-1.5 text-center text-[11px] text-[#B9B4C7]">{CONSENT_UPDATED_LABEL}</div>
      </div>

      <div className="sticky bottom-0 z-20 mt-auto shrink-0 border-t border-[#EFEDF4] bg-white px-4 pb-7 pt-3">
        {!atEnd && (
          <div id="consent-scroll-hint" className="flex items-center justify-center gap-1.5 pb-2.5 text-[11px] text-[#9590A8]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9590A8" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="m19 12-7 7-7-7" />
            </svg>
            {CONSENT_SCROLL_HINT}
          </div>
        )}

        {/*
          ใช้ aria-disabled ไม่ใช่ disabled จริง: ปุ่มที่ disabled รับโฟกัสไม่ได้ ผู้ใช้ screen reader
          จึงไม่มีทางได้ยินคำอธิบายใน aria-describedby ว่าทำไมติ๊กไม่ได้ — แบบนี้ยัง Tab มาหยุดได้และ
          อ่านคำใบ้ได้ ส่วนด่านยังเข้มเท่าเดิม (onClick ไม่ทำอะไรจนกว่า atEnd จะเป็นจริง)
        */}
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-disabled={!atEnd}
          aria-describedby={!atEnd ? "consent-scroll-hint" : undefined}
          onClick={() => {
            if (!atEnd) return;
            setChecked((v) => !v);
          }}
          className="flex w-full items-start gap-2.5 rounded-[13px] border border-[#EFEDF4] bg-[#FAF9FC] p-3 text-left aria-disabled:opacity-60"
        >
          {checked ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <rect x="1.5" y="1.5" width="21" height="21" rx="6.5" fill="#7C3AED" />
              <path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <rect x="1.5" y="1.5" width="21" height="21" rx="6.5" fill="#fff" stroke="#CFC8DE" strokeWidth={2} />
            </svg>
          )}
          <span className="text-[12.5px] leading-[1.65] text-[#3F3B52]">{CONSENT_CHECKBOX_LABEL}</span>
        </button>

        <div className="mt-2.5 flex gap-2.5">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="w-[108px] rounded-[15px] bg-[#F1ECFE] py-3.5 text-center text-[15px] font-semibold text-[#7C3AED]"
          >
            {CONSENT_DECLINE_LABEL}
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={!checked}
            className="flex-1 rounded-[15px] bg-gradient-to-br from-[#7C3AED] to-[#9050F0] py-3.5 text-center text-[15px] font-semibold text-white shadow-[0_10px_22px_rgba(124,58,237,0.30)] disabled:opacity-45 disabled:shadow-none"
          >
            {CONSENT_ACCEPT_LABEL}
          </button>
        </div>

        <div className="mt-2 text-center text-[10.5px] text-[#B9B4C7]">{CONSENT_FOOTER_NOTE}</div>
      </div>

      {sheetOpen && <ConsentCancelSheet onBack={() => setSheetOpen(false)} onConfirm={onCancel} />}
    </div>
  );
}
