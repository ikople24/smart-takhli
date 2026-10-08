// ดูรูปเต็มจอบนหน้าเดิม (ไม่เปิดแท็บใหม่) — ปิดด้วย ×, Esc หรือแตะพื้นหลัง · หลายรูปเลื่อนด้วย ‹ › หรือปุ่มลูกศรคีย์บอร์ด
// z-index สูงกว่า modal รายละเอียด (z-[1000]) เพราะเปิดซ้อนจากในนั้นได้
import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cloudinaryThumb } from "@/lib/smart-papar/cloudinaryThumb";

// images: [{ src, caption? }] · index: รูปที่เปิดอยู่ (null = ปิด)
export default function PhotoLightbox({ images, index, onChange, onClose }) {
  const open = index !== null && index !== undefined && images?.[index];
  const count = images?.length || 0;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && count > 1) onChange((index + 1) % count);
      else if (e.key === "ArrowLeft" && count > 1) onChange((index - 1 + count) % count);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, index, count, onChange, onClose]);

  if (!open) return null;
  const img = images[index];
  const step = (d) => (e) => {
    e.stopPropagation();
    onChange((index + d + count) % count);
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="ดูรูป"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white/90">
        <span>
          {img.caption}
          {count > 1 && <span className="ml-2 text-white/60">{index + 1} / {count}</span>}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดรูป"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <X size={22} aria-hidden />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cloudinaryThumb(img.src, 1600)}
          alt={img.caption || ""}
          className="max-h-full max-w-full rounded-lg object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={step(-1)}
              aria-label="รูปก่อนหน้า"
              className="absolute left-3 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
            >
              <ChevronLeft size={26} aria-hidden />
            </button>
            <button
              type="button"
              onClick={step(1)}
              aria-label="รูปถัดไป"
              className="absolute right-3 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
            >
              <ChevronRight size={26} aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
