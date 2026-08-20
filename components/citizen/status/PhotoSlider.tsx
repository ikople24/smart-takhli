// components/citizen/status/PhotoSlider.tsx
// สไลด์รูปแบบปัดนิ้ว (scroll-snap) + จุดบอกตำแหน่ง — ใช้ใน hero ของหน้ารายละเอียดสถานะ
import { useRef, useState } from "react";
import Image from "next/image";

export default function PhotoSlider({ images, heightClass = "h-[220px]" }: { images: string[]; heightClass?: string }) {
  const [slide, setSlide] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  if (images.length === 0) return null;

  const onScroll = () => {
    const el = ref.current;
    if (el) setSlide(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className={`relative overflow-hidden rounded-[18px] ${heightClass}`}>
      {images.length === 1 ? (
        <Image src={images[0]} alt="รูปประกอบเรื่อง" fill sizes="480px" className="object-cover" />
      ) : (
        <div
          ref={ref}
          onScroll={onScroll}
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
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{ width: i === slide ? 14 : 6, background: i === slide ? "#fff" : "rgba(255,255,255,0.55)" }}
              />
            ))}
          </div>
          <span className="absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10.5px] font-semibold text-white">
            {slide + 1}/{images.length}
          </span>
        </>
      )}
    </div>
  );
}
