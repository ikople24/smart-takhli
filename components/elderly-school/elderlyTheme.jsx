// components/elderly-school/elderlyTheme.jsx
// ธีมของโมดูลโรงเรียนผู้สูงอายุ (ดีไซน์ใหม่ 2026-10 แบบแท็บ) — สีเขียวเทาเข้ม + พื้นครีมอุ่น
// โทนสถานะ (ok/care/see/low/none/mind) ต่างกันทั้งสีและความสว่าง อ่านแยกได้แม้ตาบอดสี
import React, { useEffect } from "react";

export const TONE_STYLES = {
  ok: { bg: "#E5F3EA", fg: "#1B5E3A", bar: "#4E9C8F" },
  care: { bg: "#FBF0DC", fg: "#7A4700", bar: "#E3C37E" },
  see: { bg: "#FBE7E4", fg: "#8E1F18", bar: "#C98F86" },
  low: { bg: "#E6EEF8", fg: "#1F4E86", bar: "#A9C2DE" },
  none: { bg: "#EEEEEA", fg: "#4F5652", bar: "#E4E2DA" },
  mind: { bg: "#EEE8F7", fg: "#4B2E83", bar: "#B9A6DA" },
};

export const cardCls = "bg-white border border-[#E4E2DA] rounded-2xl";
export const btnCls =
  "inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl border border-[#D6D3C8] bg-white text-[15px] font-semibold text-[#1D2421] hover:bg-[#F4F3EE] disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
export const primaryBtnCls =
  "inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl border border-[#0E5A55] bg-[#0E5A55] text-[15px] font-semibold text-white hover:bg-[#083D3A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
export const inputCls =
  "min-h-11 px-3 rounded-xl border border-[#D6D3C8] bg-white text-[15px] text-[#1D2421] placeholder:text-[#8A918D] focus:outline-none focus:ring-2 focus:ring-[#0E5A55]/30 focus:border-[#0E5A55]";
export const labelCls = "text-[13px] font-medium text-[#5B635F]";
export const filterCls = (on) =>
  "min-h-10 px-3.5 rounded-full border text-sm font-semibold transition-colors " +
  (on
    ? "bg-[#1D2421] border-[#1D2421] text-white"
    : "bg-white border-[#D6D3C8] text-[#3C4541] hover:bg-[#F4F3EE]");

export function Chip({ tone = "none", children, className = "" }) {
  const t = TONE_STYLES[tone] || TONE_STYLES.none;
  return (
    <span
      className={"inline-flex items-center gap-1.5 min-h-[26px] px-2.5 rounded-full text-[13px] font-semibold whitespace-nowrap " + className}
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

export function SectionCard({ title, subtitle, action, children, className = "", bodyClassName = "p-5" }) {
  return (
    <section className={cardCls + " " + className}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <div className="flex flex-col gap-0.5 min-w-0">
            {title && <h2 className="m-0 text-lg font-bold text-[#1D2421]">{title}</h2>}
            {subtitle && <p className="m-0 text-[13px] text-[#5B635F]">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function StatTile({ label, value, unit, sub, tone, children }) {
  const color = tone ? TONE_STYLES[tone]?.fg : "#1D2421";
  return (
    <div className={cardCls + " p-5 flex flex-col gap-2"}>
      <span className={labelCls}>{label}</span>
      <span className="text-[32px] font-bold leading-none" style={{ color }}>
        {value}
        {unit && <span className="text-base font-medium text-[#5B635F]"> {unit}</span>}
      </span>
      {children}
      {sub && <span className="text-[13px] text-[#5B635F]">{sub}</span>}
    </div>
  );
}

export function Notice({ tone = "care", children, className = "" }) {
  const t = TONE_STYLES[tone] || TONE_STYLES.care;
  return (
    <div className={"rounded-xl px-4 py-3 text-sm " + className} style={{ background: t.bg, color: t.fg }} role="status">
      {children}
    </div>
  );
}

export function ProgressBar({ value, max, color = "#0E5A55" }) {
  const w = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 rounded-full bg-[#ECEAE3] overflow-hidden" aria-hidden="true">
      <div className="h-full" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

/** modal กลางของโมดูล — ปิดด้วย Esc / คลิกพื้นหลัง */
export function ElderlyModal({ open, title, subtitle, onClose, children, footer, size = "max-w-lg" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"relative w-full " + size + " max-h-[90vh] flex flex-col bg-white rounded-2xl border border-[#E4E2DA] shadow-xl overflow-hidden"}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#E4E2DA]">
          <div className="flex flex-col gap-0.5">
            <p className="m-0 text-lg font-bold text-[#1D2421]">{title}</p>
            {subtitle && <p className="m-0 text-[13px] text-[#5B635F]">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className={btnCls + " !min-h-10 !px-3"} aria-label="ปิด">
            ปิด
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-[#E4E2DA] bg-[#FBFAF7]">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ children }) {
  return <div className="py-10 text-center text-sm text-[#5B635F]">{children}</div>;
}

export function Spinner({ label = "กำลังโหลด..." }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-[#5B635F]" role="status">
      <span className="loading loading-spinner loading-sm text-[#0E5A55]" aria-hidden="true" />
      {label}
    </div>
  );
}

/** ซ่อนเลขบัตร เหลือ 4 ตัวท้าย */
export function maskCitizen(id) {
  const s = String(id || "").replace(/\D/g, "");
  if (!s) return "";
  return `•••• ${s.slice(-4)}`;
}
