// components/citizen/report/PhotoUploader.tsx
// ช่องแนบรูปฉบับ citizen (แคนวาส F2): tile 92px — รูปที่อัปโหลดแล้วมีปุ่ม X,
// ช่องว่างเป็นกรอบประ "เพิ่มรูป" ตามจำนวนที่เหลือ (สูงสุด 3)
// ตัวอัปโหลดใช้ uploadToCloudinary เดิมตัวเดียวกับฟอร์มเก่า
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { uploadToCloudinary } from "@/utils/uploadToCloudinary";

// controlled component: รายการรูปอยู่ที่ parent (state ของหน้า wizard) —
// สลับขั้นไปกลับแล้วรูปไม่หาย (ถือ state เองจะโดนรีเซตตอน unmount)
export default function PhotoUploader({
  value = [],
  onChange,
  onUploadingChange,
  maxImages = 3,
}: {
  value?: string[];
  onChange: (urls: string[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
  maxImages?: number;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onUploadingChange?.(isUploading);
  }, [isUploading, onUploadingChange]);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    setIsUploading(true);
    try {
      const remaining = maxImages - value.length;
      const next = [...value];
      for (const file of selected.slice(0, remaining)) {
        try {
          const url = await uploadToCloudinary(file);
          if (url) next.push(url);
        } catch (err) {
          console.error("Upload error:", err);
        }
      }
      onChange(next);
    } finally {
      setIsUploading(false);
      e.target.value = ""; // เลือกไฟล์เดิมซ้ำได้ (พฤติกรรมเดิม)
    }
  };

  const removeImage = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const emptySlots = Math.max(0, maxImages - value.length);

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" disabled={isUploading} />
      <div className="flex gap-2.5">
        {value.map((url, i) => (
          <div key={url} className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[14px] bg-[#EEF1FB]">
            <Image src={url} alt={`รูปที่ ${i + 1}`} fill sizes="92px" className="object-cover" />
            <button
              type="button"
              onClick={() => removeImage(i)}
              disabled={isUploading}
              aria-label={`ลบรูปที่ ${i + 1}`}
              className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="flex h-[92px] w-[92px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] border-dashed border-[#CFC8DE] bg-white text-[#9590A8] disabled:opacity-60"
          >
            {isUploading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#7C3AED] border-t-transparent" />
            ) : i === 0 && value.length === 0 ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8h3l2-2h6l2 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
            {!isUploading && <span className="text-[10px]">เพิ่มรูป</span>}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-[#9590A8]">รองรับไฟล์ภาพ .jpg, .png ขนาดไม่เกิน 5MB</p>
    </div>
  );
}
