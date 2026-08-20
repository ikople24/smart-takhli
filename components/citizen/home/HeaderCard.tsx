// components/citizen/home/HeaderCard.tsx
// การ์ดหัวหน้าแรกโฉมใหม่ — โลโก้ + ชื่อเทศบาล + คำทักทายตามวัน แบบ "hello" ของ
// Apple: ฟอนต์ลายมือ (Sriracha) เขียนโผล่ทีละอักษร ชิดขวา
// · ชื่อวันคำนวณฝั่ง client เท่านั้น (เซิร์ฟเวอร์ UTC วันเพี้ยน + กัน hydration mismatch)
// · แตกอักษรด้วย Intl.Segmenter แบบ grapheme — สระ/วรรณยุกต์ไทยเกาะพยัญชนะ
//   เป็นก้อนเดียว ไม่หลุดจากกันตอนใส่ animation รายตัว
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { sriracha } from "../fonts";

const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

export default function HeaderCard() {
  const [dayName, setDayName] = useState("");

  useEffect(() => {
    setDayName(THAI_DAYS[new Date().getDay()]);
  }, []);

  const graphemes = useMemo(() => {
    if (!dayName) return [];
    const text = `สวัสดีวัน${dayName}`;
    try {
      return Array.from(new Intl.Segmenter("th", { granularity: "grapheme" }).segment(text), (s) => s.segment);
    } catch {
      return [text]; // เบราว์เซอร์เก่าไม่มี Segmenter — โชว์ทั้งคำทีเดียว
    }
  }, [dayName]);

  return (
    <div className="mx-4 mt-4 rounded-[22px] bg-gradient-to-br from-[#7C3AED] to-[#9050F0] px-5 py-4 shadow-[0_12px_26px_rgba(124,58,237,0.28)]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/90">
          <Image src="/logoTK.png" alt="ตราเทศบาลเมืองตาคลี" width={40} height={40} className="h-10 w-10 object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold leading-tight text-white">เทศบาลเมืองตาคลี</div>
          <div className="text-[10px] font-medium tracking-[2px] text-white/75">SMART TAKHLI</div>
        </div>
      </div>

      {graphemes.length > 0 && (
        <div className={`${sriracha.className} greeting mt-2 pb-1 text-right text-[30px] leading-snug text-white`} aria-label={`สวัสดีวัน${dayName}`}>
          {graphemes.map((ch, i) => (
            <span key={i} className="ch" style={{ animationDelay: `${0.25 + i * 0.13}s` }} aria-hidden="true">
              {ch}
            </span>
          ))}
        </div>
      )}

      <style jsx>{`
        .ch {
          display: inline-block;
          opacity: 0;
          animation: write-in 0.5s cubic-bezier(0.2, 0.7, 0.3, 1) both;
          animation-delay: inherit;
        }
        @keyframes write-in {
          0% {
            opacity: 0;
            transform: translateY(6px) rotate(-4deg) scale(0.9);
            filter: blur(4px);
          }
          60% {
            opacity: 1;
            filter: blur(0.5px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) rotate(0deg) scale(1);
            filter: blur(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ch {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
