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
  /** จำนวนงานที่ถืออยู่ — มือถือแสดง "ถืองาน N เรื่อง" ในบรรทัด meta */
  openCount?: number;
}

export function OfficerHeaderCard({ name, position, department, code, poolHref, onTransfer, transferDisabled, transferLabel = 'โอน / ส่งต่องาน', openCount }: OfficerHeaderCardProps) {
  const meta = [position, department].filter(Boolean);
  return (
    <section
      className="flex flex-wrap items-center gap-3 rounded-[22px] px-[17px] py-[15px] text-white shadow-tk-purple-card md:gap-[18px] md:rounded-[20px] md:px-6 md:py-5"
      style={{
        backgroundImage:
          'linear-gradient(120deg, var(--color-tk-primary) 0%, var(--color-tk-primary-light) 62%, var(--color-tk-primary-lighter) 100%)',
      }}
    >
      <div className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[14px] bg-white/20 text-[16px] font-bold md:h-14 md:w-14 md:rounded-[18px] md:text-[19px]" aria-hidden>
        {initials(name)}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[16px] font-semibold leading-[1.25] md:text-[20px] md:font-bold">{name || 'เจ้าหน้าที่'}</h1>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-white/80 md:mt-1 md:text-[13px]">
          {meta.map((m, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span aria-hidden>·</span>}
              <span>{m}</span>
            </React.Fragment>
          ))}
          {typeof openCount === 'number' && (
            <>
              {meta.length > 0 && <span aria-hidden>·</span>}
              <span>ถืองาน {openCount} เรื่อง</span>
            </>
          )}
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
      <div className="flex w-full flex-wrap gap-2 md:w-auto md:gap-2.5">
        <button
          type="button"
          onClick={onTransfer}
          disabled={transferDisabled}
          className="touch-feedback inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-[12.5px] font-semibold whitespace-nowrap transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60 md:flex-none md:px-4 md:py-2.5 md:text-[13px]"
        >
          <ArrowsRightLeftIcon className="h-4 w-4" strokeWidth={2} />
          {transferLabel}
        </button>
        <Link
          href={poolHref}
          className="touch-feedback inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[12.5px] font-semibold text-tk-primary-dark whitespace-nowrap transition hover:bg-tk-primary-tint md:flex-none md:px-4 md:py-2.5 md:text-[13px]"
        >
          <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
          รับงานจากกอง
        </Link>
      </div>
    </section>
  );
}

export default OfficerHeaderCard;
