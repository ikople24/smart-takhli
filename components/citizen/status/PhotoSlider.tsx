// components/citizen/status/PhotoSlider.tsx
// สไลด์รูปแบบปัดนิ้ว (scroll-snap) + จุดบอกตำแหน่ง — ใช้ทั้ง hero หน้ารายละเอียด
// และการ์ดในลิสต์ · มีมากกว่า 1 รูป = เลื่อนอัตโนมัติทุก autoMs (หยุดชั่วคราว
// เมื่อผู้ใช้แตะ/ปัดเอง แล้ววิ่งต่อหลังปล่อย 5 วิ · ปิด auto ตาม prefers-reduced-motion)
import { ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";

export default function PhotoSlider({
  images,
  heightClass = "h-[220px]",
  rounded = "rounded-[18px]",
  counter = false,
  autoMs = 3500,
  dotsClass = "bottom-3 right-3",
  children,
}: {
  images: string[];
  heightClass?: string;
  rounded?: string;
  counter?: boolean;
  autoMs?: number;
  dotsClass?: string; // ตำแหน่งจุดบอกสไลด์ (hero รายละเอียดใช้กลางบนตามแคนวาส)
  children?: ReactNode; // overlay เพิ่มเติม (เช่น ป้ายวันที่/หมวด ของการ์ด)
}) {
  const [slide, setSlide] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const pausedUntil = useRef(0);

  const onScroll = () => {
    const el = ref.current;
    if (el) setSlide(Math.round(el.scrollLeft / el.clientWidth));
  };

  const pause = () => {
    pausedUntil.current = Date.now() + 5000;
  };

  useEffect(() => {
    if (images.length <= 1) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      const el = ref.current;
      if (!el || Date.now() < pausedUntil.current) return;
      const w = el.clientWidth;
      if (!w) return;
      const next = (Math.round(el.scrollLeft / w) + 1) % images.length;
      el.scrollTo({ left: next * w, behavior: "smooth" });
    }, autoMs);
    return () => clearInterval(t);
  }, [images.length, autoMs]);

  if (images.length === 0) return null;

  return (
    <div className={`relative overflow-hidden ${rounded} ${heightClass}`}>
      {images.length === 1 ? (
        <Image src={images[0]} alt="รูปประกอบเรื่อง" fill sizes="480px" className="object-cover" />
      ) : (
        <div
          ref={ref}
          onScroll={onScroll}
          onTouchStart={pause}
          onPointerDown={pause}
          className="flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden"
        >
          {images.map((url, i) => (
            <div key={i} className="relative h-full w-full shrink-0 snap-center">
              <Image src={url} alt={`รูปที่ ${i + 1}`} fill sizes="480px" className="object-cover" />
            </div>
          ))}
        </div>
      )}
      {images.length > 1 && (
        <>
          <div className={`pointer-events-none absolute flex gap-1.5 ${dotsClass}`}>
            {images.map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{ width: i === slide ? 14 : 6, background: i === slide ? "#fff" : "rgba(255,255,255,0.55)" }}
              />
            ))}
          </div>
          {counter && (
            <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10.5px] font-semibold text-white">
              {slide + 1}/{images.length}
            </span>
          )}
        </>
      )}
      {children}
    </div>
  );
}
