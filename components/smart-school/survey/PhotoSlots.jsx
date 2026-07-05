import React, { useRef, useState } from 'react';
import { uploadToCloudinary } from '@/utils/uploadToCloudinary';

// 3 ช่องรูปมีป้ายกำกับตามดีไซน์ — ใช้การอัปโหลด Cloudinary เดิม
// value = array ของ url (formData.image) · onChange รับ array แบบ compact (ตัด null ออก)
const SLOTS = [
  { emoji: '🧑', label: 'ภาพหน้าตรง' },
  { emoji: '🏠', label: 'ที่อยู่อาศัย' },
  { emoji: '👥', label: 'บริเวณที่พัก/ครอบครัว' },
];

export default function PhotoSlots({ value = [], onChange, onUploadingChange, disabled }) {
  const [slots, setSlots] = useState(() => {
    const arr = [null, null, null];
    (value || []).slice(0, 3).forEach((u, i) => { arr[i] = u; });
    return arr;
  });
  const [busy, setBusy] = useState(null); // index ที่กำลังอัปโหลด
  const inputs = useRef([]);

  const emit = (next) => {
    setSlots(next);
    onChange?.(next.filter(Boolean));
  };

  const pick = async (i, file) => {
    if (!file) return;
    setBusy(i);
    onUploadingChange?.(true);
    try {
      const url = await uploadToCloudinary(file);
      if (url) {
        const next = [...slots];
        next[i] = url;
        emit(next);
      }
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setBusy(null);
      onUploadingChange?.(false);
    }
  };

  const clear = (i) => {
    const next = [...slots];
    next[i] = null;
    emit(next);
  };

  const locked = disabled || busy != null;

  return (
    <div className="flex gap-2">
      {SLOTS.map((s, i) => (
        <div key={i} className="flex flex-1 flex-col gap-1.5">
          <div className="relative aspect-square">
            {slots[i] ? (
              <>
                <div
                  className="h-full w-full rounded-[14px] border border-[#E7E2F2] bg-cover bg-center"
                  style={{ backgroundImage: `url(${slots[i]})` }}
                />
                <button
                  type="button"
                  onClick={() => clear(i)}
                  disabled={locked}
                  title="ลบรูป"
                  className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#B91C1C] text-[11px] text-white shadow-[0_2px_6px_-1px_rgba(0,0,0,0.35)] disabled:opacity-50"
                >
                  ✕
                </button>
              </>
            ) : (
              <label
                className={
                  'flex h-full w-full flex-col items-center justify-center gap-1 rounded-[14px] ' +
                  'border-2 border-dashed border-[#C9BCEE] bg-[#FAF8FF] text-[#7C3AED] transition ' +
                  (locked ? 'pointer-events-none opacity-60' : 'cursor-pointer hover:border-[#7C3AED] hover:bg-[#F6F3FD]')
                }
              >
                {busy === i ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <>
                    <span className="text-[22px] leading-none">{s.emoji}</span>
                    <span className="text-[16px] leading-none">+</span>
                  </>
                )}
                <input
                  ref={(el) => (inputs.current[i] = el)}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={locked}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    pick(i, f);
                  }}
                />
              </label>
            )}
          </div>
          <div className="text-center text-[9.5px] font-semibold leading-tight text-[#57506A]">
            {i + 1}. {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
