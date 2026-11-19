// Loading น่ารัก ๆ ของโครงการพระสังข์หอบทอง — ตัวการ์ตูนแบกถุงทองเดินวน 5 ท่า
// sprite: public/recycle/phrasang-loading-strip.webp (5 เฟรมเรียงแนวนอน, เฟรมละ 256×300)
// fullscreen = เต็มจอตอนเข้าระบบ, ไม่ใส่ = กล่องในหน้า (ระหว่างรอข้อมูล)
import { useEffect, useState } from "react";
import { DISPLAY, ICON, Icon, recycleBodyFont } from "@/lib/recycle/theme";

const TIPS = [
  "ล้างขวดพลาสติกแล้วบีบให้แบน ช่วยให้ชั่งและเก็บง่ายขึ้น",
  "แยกกระดาษลังออกจากกระดาษขาว-ดำก่อนนำมาฝาก",
  "น้ำหนักสะสมไว้ นำมาแลกของได้ที่จุดรับของโครงการ",
  "สแกน QR บนบัตรสมาชิกเพื่อดูยอดสะสมของคุณได้ทุกเมื่อ",
];

function Sparkle({ className, size }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
    </svg>
  );
}

export default function RecycleLoading({ fullscreen = false, message = "กำลังขนขยะไปแลกทอง" }) {
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 2800);
    return () => clearInterval(t);
  }, []);

  const mascot = (
    <div className="relative w-[220px] h-[220px] rounded-full bg-[#F5F3EC] flex flex-col items-center justify-end pb-3">
      <Sparkle className="ps-spark absolute left-3 top-7 text-[#F4B740]" size={24} />
      <Sparkle className="ps-spark ps-b absolute -right-1 top-16 text-white" size={18} />
      <Sparkle className="ps-spark ps-c absolute right-5 top-1 text-[#F4B740]" size={14} />
      <div className="ps-mascot" role="img" aria-label="พระสังข์แบกถุงทองกำลังเดินมา" />
      <div className="ps-shadow -mt-2" />
    </div>
  );

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        recycleBodyFont.className,
        "isolate relative overflow-hidden bg-[#146C43] text-white flex flex-col items-center",
        fullscreen ? "fixed inset-0 z-[60] px-7" : "rounded-[28px] px-6 py-10",
      ].join(" ")}
    >
      <div className="absolute -z-10 -left-[90px] -top-[70px] w-[260px] h-[260px] rounded-full bg-[#1B7C4F]" />
      <div className="absolute -z-10 -right-[90px] -bottom-[70px] w-[220px] h-[220px] rounded-full bg-[#1B7C4F]" />
      <span className="ps-coin" style={{ left: 60, top: 120, animationDelay: "0s" }} />
      <span className="ps-coin" style={{ right: 70, top: 100, animationDelay: ".8s" }} />
      <span className="ps-coin" style={{ left: 120, top: 80, animationDelay: "1.6s" }} />

      {fullscreen && <div className="flex-1" />}
      {mascot}
      <p className={`${DISPLAY} mt-6 text-[28px] font-semibold leading-tight text-center`}>พระสังข์หอบทอง</p>
      <p className="mt-1 text-sm text-[#CFE6D8] text-center">ธนาคารขยะรีไซเคิล · เทศบาลเมืองตาคลี</p>
      <div className="mt-6 w-[220px] h-2.5 rounded-full bg-[#0F5A37] relative overflow-hidden">
        <div className="ps-bar" />
      </div>
      <p className="mt-3 text-[15px] font-medium">
        {message}
        <span className="ps-dot">.</span>
        <span className="ps-dot">.</span>
        <span className="ps-dot">.</span>
      </p>
      {fullscreen && <div className="flex-1" />}
      <div className={`${fullscreen ? "mb-9" : "mt-8"} w-full max-w-sm bg-[#0F5A37] rounded-[20px] px-4 py-3.5 flex gap-3 items-center`}>
        <span className="w-10 h-10 rounded-xl bg-[#F4B740] text-[#3D2A00] flex items-center justify-center shrink-0">
          <Icon d={ICON.bulb} size={22} strokeWidth={1.9} />
        </span>
        <div>
          <p className="text-xs text-[#CFE6D8]">รู้หรือไม่</p>
          <p className="text-sm font-medium leading-snug">{TIPS[tip]}</p>
        </div>
      </div>

      <style jsx>{`
        .ps-mascot {
          width: 176px;
          height: 206px;
          background: url(/recycle/phrasang-loading-strip.webp) no-repeat 0 0 / 880px 206px;
          animation: ps-walk 1.5s steps(5) infinite, ps-bob 0.75s ease-in-out infinite;
        }
        .ps-shadow {
          width: 120px;
          height: 14px;
          border-radius: 50%;
          background: rgba(23, 37, 28, 0.14);
          animation: ps-shadow 0.75s ease-in-out infinite;
        }
        :global(.ps-spark) {
          animation: ps-twinkle 1.6s ease-in-out infinite;
        }
        :global(.ps-b) {
          animation-delay: 0.5s;
        }
        :global(.ps-c) {
          animation-delay: 1s;
        }
        .ps-bar {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 40%;
          border-radius: 999px;
          background: #f4b740;
          animation: ps-load 1.4s ease-in-out infinite;
        }
        .ps-dot {
          display: inline-block;
          animation: ps-dots 1.2s infinite;
        }
        .ps-dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        .ps-dot:nth-child(3) {
          animation-delay: 0.4s;
        }
        .ps-coin {
          position: absolute;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #f4b740;
          box-shadow: inset 0 -3px 0 #d9962a;
          animation: ps-fall 2.4s linear infinite;
          opacity: 0;
        }
        @keyframes ps-walk {
          to {
            background-position: -880px 0;
          }
        }
        @keyframes ps-bob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        @keyframes ps-shadow {
          0%,
          100% {
            transform: scaleX(1);
            opacity: 1;
          }
          50% {
            transform: scaleX(0.85);
            opacity: 0.7;
          }
        }
        @keyframes ps-twinkle {
          0%,
          100% {
            transform: scale(0.4) rotate(0);
            opacity: 0;
          }
          50% {
            transform: scale(1) rotate(20deg);
            opacity: 1;
          }
        }
        @keyframes ps-load {
          0% {
            left: -40%;
          }
          100% {
            left: 100%;
          }
        }
        @keyframes ps-dots {
          0%,
          60%,
          100% {
            opacity: 0.2;
          }
          30% {
            opacity: 1;
          }
        }
        @keyframes ps-fall {
          0% {
            transform: translateY(-20px);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform: translateY(300px);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ps-mascot,
          .ps-shadow,
          .ps-bar,
          .ps-dot,
          .ps-coin,
          :global(.ps-spark) {
            animation: none;
          }
          .ps-bar {
            left: 0;
            width: 60%;
          }
          .ps-coin {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
