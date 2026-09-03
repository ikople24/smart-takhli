// components/tasks/SolutionChips.tsx
// chip "วิธีการแก้ไข" (AdminOption ของประเภทเรื่อง) — ใช้ทั้งแผงอัปเดตความคืบหน้าและ modal ปิดเรื่อง
// (ของเดิมอยู่ใน UpdateAssignmentModal ที่ปลดระวาง — เจ้าของทวงกลับมา 2026-09-03)
import React from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import type { SolutionOption } from '@/lib/tasks/types';

export interface SolutionChipsProps {
  options: SolutionOption[];
  value: string[];
  onChange?: (next: string[]) => void;
  disabled?: boolean;
  /** โทนตอนเลือก: ม่วง (ระหว่างทำ) หรือเขียว (ตอนปิดเรื่อง) */
  tone?: 'primary' | 'done';
}

export function SolutionChips({ options, value, onChange, disabled = false, tone = 'primary' }: SolutionChipsProps) {
  if (!options.length && !value.length) return null;
  const onCls = tone === 'done' ? 'border-tk-done bg-tk-done-soft text-tk-done-ink' : 'border-tk-primary bg-tk-primary-tint text-tk-primary-dark';
  const hoverCls = tone === 'done' ? 'hover:border-tk-done' : 'hover:border-tk-primary';
  // ค่าที่เลือกไว้แต่ไม่อยู่ในตัวเลือกของประเภทนี้ (ข้อมูลเก่า/ประเภทถูกแก้) — ยังแสดงให้เอาออกได้
  const orphan = value.filter((v) => !options.some((o) => o.label === v));
  const all = [...options, ...orphan.map((label) => ({ _id: `orphan-${label}`, label }) as SolutionOption)];
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((o) => {
        const on = value.includes(o.label);
        return (
          <button
            key={o._id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange?.(on ? value.filter((x) => x !== o.label) : [...value, o.label])}
            className={clsx(
              'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition disabled:cursor-default',
              on ? onCls : clsx('border-tk-line text-tk-ink-3', !disabled && hoverCls)
            )}
          >
            {o.iconUrl && <Image src={o.iconUrl} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default SolutionChips;
