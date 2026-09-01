// components/tasks/OfficerHeaderCard.tsx
// การ์ดหัวหน้าจอ 1 (README ① Officer header card) — gradient ม่วง, avatar อักษรย่อ, ปุ่มโอนงาน / รับงานจากกอง
import React from 'react';
import Link from 'next/link';
import { ArrowsRightLeftIcon, PlusIcon } from '@heroicons/react/24/outline';
import { initials } from '@/lib/tasks/format';

export interface OfficerHeaderCardProps {
  name: string;
  position?: string;
  department?: string;
  /** รหัสเจ้าหน้าที่ (ถ้ามี) แสดงเป็น mono */
  code?: string | null;
  poolHref: string;
  onTransfer?: () => void;
  transferDisabled?: boolean;
  /** 'โอน / ส่งต่องาน' (หัวหน้า) หรือ 'ขอโอนงาน' (admin ธรรมดา) */
  transferLabel?: string;
}

export function OfficerHeaderCard({ name, position, department, code, poolHref, onTransfer, transferDisabled, transferLabel = 'โอน / ส่งต่องาน' }: OfficerHeaderCardProps) {
  const meta = [position, department].filter(Boolean);
  return (
    <section
      className="flex flex-wrap items-center gap-[18px] rounded-[20px] px-6 py-5 text-white shadow-tk-purple-card"
      style={{
        backgroundImage:
          'linear-gradient(120deg, var(--color-tk-primary) 0%, var(--color-tk-primary-light) 62%, var(--color-tk-primary-lighter) 100%)',
      }}
    >
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-white/20 text-[19px] font-bold" aria-hidden>
        {initials(name)}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[20px] font-bold leading-[1.25]">{name || 'เจ้าหน้าที่'}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-white/80">
          {meta.map((m, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span aria-hidden>·</span>}
              <span>{m}</span>
            </React.Fragment>
          ))}
          {code && (
            <>
              {meta.length > 0 && <span aria-hidden>·</span>}
              <span>
                รหัสเจ้าหน้าที่ <span className="font-tk-mono">{code}</span>
              </span>
            </>
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={onTransfer}
          disabled={transferDisabled}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowsRightLeftIcon className="h-4 w-4" strokeWidth={2} />
          {transferLabel}
        </button>
        <Link
          href={poolHref}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[13px] font-semibold text-tk-primary-dark whitespace-nowrap transition hover:bg-tk-primary-tint"
        >
          <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
          รับงานจากกอง
        </Link>
      </div>
    </section>
  );
}

export default OfficerHeaderCard;
