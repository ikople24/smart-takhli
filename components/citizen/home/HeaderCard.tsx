// components/citizen/home/HeaderCard.tsx
// การ์ดหัวหน้าแรกโฉมใหม่ — โลโก้ + ชื่อเทศบาล + คำทักทายตามวัน (shimmer สไตล์
// "Hello" ของ iOS) · ชื่อวันคำนวณฝั่ง client เท่านั้น (ใน useEffect) เพราะ
// เซิร์ฟเวอร์รัน UTC — SSR ไปคนละวันแล้วจะ hydration mismatch
import { useEffect, useState } from "react";
import Image from "next/image";

const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

export default function HeaderCard() {
  const [dayName, setDayName] = useState("");

  useEffect(() => {
    setDayName(THAI_DAYS[new Date().getDay()]);
  }, []);

  return (
    <div className="mx-4 mt-4 rounded-[22px] bg-gradient-to-br from-[#7C3AED] to-[#9050F0] px-4 py-4 shadow-[0_12px_26px_rgba(124,58,237,0.28)]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/90">
          <Image src="/logoTK.png" alt="ตราเทศบาลเมืองตาคลี" width={40} height={40} className="h-10 w-10 object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold leading-tight text-white">เทศบาลเมืองตาคลี</div>
          <div className="text-[10px] font-medium tracking-[2px] text-white/75">SMART TAKHLI</div>
        </div>
      </div>

      {dayName && (
        <div className="greeting mt-3 pb-1 text-[26px] font-light leading-tight tracking-[0.3px]">
          สวัสดีวัน{dayName}
        </div>
      )}

      <style jsx>{`
        .greeting {
          background: linear-gradient(
            105deg,
            #ffffff 25%,
            rgba(255, 255, 255, 0.45) 45%,
            #f3e8ff 50%,
            rgba(255, 255, 255, 0.45) 55%,
            #ffffff 75%
          );
          background-size: 250% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: greeting-in 0.9s ease-out both, greeting-shimmer 3.2s linear 0.9s infinite;
        }
        @keyframes greeting-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes greeting-shimmer {
          from {
            background-position: 125% 0;
          }
          to {
            background-position: -125% 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .greeting {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
