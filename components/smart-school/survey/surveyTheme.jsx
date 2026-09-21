import React from 'react';

// โทเคนดีไซน์ของแบบสำรวจ Smart School (ม่วง–ครีม, "หรู แต่เข้าถึงง่าย")
// รวมสีไว้ที่เดียวเพื่อไม่ให้กระจายทั่วไฟล์ — ใช้เฉพาะโมดูล survey ไม่แตะธีม daisyUI รวม
export const FONT_DISPLAY = "'Anuphan', 'IBM Plex Sans Thai', sans-serif";
export const FONT_BODY = "'IBM Plex Sans Thai', 'Anuphan', sans-serif";

export const HEADER_BG = '#7C3AED';
export const HEADER_STYLE = {
  background: HEADER_BG,
  borderRadius: '0 0 26px 26px',
  fontFamily: FONT_DISPLAY,
};

// คลาสที่ใช้ซ้ำ (Tailwind arbitrary values อิงเลข hex ตรงจาก handoff)
// text-[16px] บนมือถือกัน iOS auto-zoom ตอนโฟกัส · sm:text-[13px] คงความกระชับบนจอใหญ่
export const inputCls =
  'w-full box-border bg-white border-[1.5px] border-[#E7E2F2] rounded-[14px] px-3.5 py-3 ' +
  'text-[16px] sm:text-[13px] font-medium text-[#211B2E] outline-none transition-colors ' +
  'placeholder:text-[#B9B0C9] placeholder:font-normal ' +
  'focus:border-[#7C3AED] focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] ' +
  'disabled:opacity-60 disabled:cursor-not-allowed';

export const labelCls = 'block text-[12px] font-bold text-[#57506A] mb-1.5';

export const primaryBtnCls =
  'inline-flex items-center justify-center gap-2 rounded-[16px] text-center px-4 py-[15px] ' +
  'text-[15px] font-bold text-white bg-[#7C3AED] ' +
  'shadow-[0_12px_24px_-10px_rgba(124,58,237,0.6)] transition active:scale-[0.99] ' +
  'hover:bg-[#6D28D9] disabled:opacity-60 disabled:shadow-none disabled:hover:bg-[#7C3AED]';

export const successBtnCls =
  'inline-flex items-center justify-center gap-2 rounded-[16px] text-center px-4 py-[15px] ' +
  'text-[15px] font-bold text-white bg-[#16A34A] ' +
  'shadow-[0_12px_24px_-10px_rgba(22,163,74,0.55)] transition active:scale-[0.99] ' +
  'hover:bg-[#15803D] disabled:opacity-60 disabled:shadow-none';

export const ghostBtnCls =
  'inline-flex items-center justify-center rounded-[16px] px-5 py-[15px] text-[14px] font-bold ' +
  'text-[#7C3AED] bg-[#F1ECFB] transition active:scale-[0.99] hover:bg-[#DDD2FB] ' +
  'disabled:opacity-60';

// pill เลือกได้ (ระดับการศึกษา / คำนำหน้า / toggle)
export function chipCls(active) {
  return (
    'text-[11.5px] leading-none px-3.5 py-2 rounded-full font-semibold transition ' +
    'disabled:cursor-not-allowed ' +
    (active
      ? 'bg-[#7C3AED] text-white shadow-[0_6px_14px_-8px_rgba(124,58,237,0.8)]'
      : 'bg-[#EDE7FD] text-[#8A8398] hover:bg-[#DDD2FB]')
  );
}

// หัวการ์ดม่วงต่อหน้าจอ — title/subtitle/progress ต่างกันแต่ละสเต็ป
export function StepHeader({ eyebrow, title, subtitle, step, onBack, onClose }) {
  return (
    <div className="relative shrink-0 px-5 pt-4 pb-4 text-white" style={HEADER_STYLE}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดแบบฟอร์ม"
          className="absolute top-3.5 right-4 grid h-7 w-7 place-items-center rounded-full
            text-white/85 hover:text-white hover:bg-white/15 transition
            focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
        >
          ✕
        </button>
      )}
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="text-[12px] font-medium text-white/85 hover:text-white transition"
        >
          ← ย้อนกลับ
        </button>
      ) : eyebrow ? (
        <div className="text-[12px] font-medium tracking-wide text-white/85">{eyebrow}</div>
      ) : null}

      <div className="mt-0.5 pr-8 text-[19px] font-bold leading-tight">{title}</div>

      {step ? (
        <div className="mt-3.5 flex gap-1.5" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className="h-[5px] flex-1 rounded-full"
              style={{ background: n <= step ? '#fff' : 'rgba(255,255,255,.35)' }}
            />
          ))}
        </div>
      ) : null}

      {subtitle && <div className="mt-2 text-[11px] text-white/90">{subtitle}</div>}
    </div>
  );
}
