// components/tasks/MobileTaskNav.tsx
// bottom nav 5 ช่อง + FAB สำหรับหน้าจอมือถือของโมดูลงานเจ้าหน้าที่ (README § หน้าจอมือถือ) — แสดงเฉพาะ < md
// งานของฉัน · กองงานรอรับ (badge) · [FAB อัปเดตงานด่วน] · สถิติ · โปรไฟล์ · hit target ≥ 48px
import React from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ChartBarIcon, ClipboardDocumentListIcon, PencilIcon, Squares2X2Icon, UserCircleIcon } from '@heroicons/react/24/outline';

export type MobileNavKey = 'my-tasks' | 'task-pool' | 'stats' | 'profile';

export interface MobileTaskNavProps {
  active: MobileNavKey;
  /** จำนวนเรื่องในกองงานรอรับ (badge แดง) */
  poolCount?: number | null;
  onFab?: () => void;
  fabLabel?: string;
}

const ITEMS: Array<{ key: MobileNavKey; label: string; href: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }> = [
  { key: 'my-tasks', label: 'งานของฉัน', href: '/admin/my-tasks', Icon: ClipboardDocumentListIcon },
  { key: 'task-pool', label: 'กองงานรอรับ', href: '/admin/task-pool', Icon: Squares2X2Icon },
  { key: 'stats', label: 'สถิติ', href: '/admin/analytics', Icon: ChartBarIcon },
  { key: 'profile', label: 'โปรไฟล์', href: '/admin/register-user', Icon: UserCircleIcon },
];

export function MobileTaskNav({ active, poolCount, onFab, fabLabel = 'อัปเดตงานด่วน' }: MobileTaskNavProps) {
  const render = (item: (typeof ITEMS)[number]) => {
    const on = item.key === active;
    return (
      <Link
        key={item.key}
        href={item.href}
        aria-current={on ? 'page' : undefined}
        className={clsx('touch-feedback relative flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl', on ? 'text-tk-primary' : 'text-tk-ink-7')}
      >
        <item.Icon className="h-6 w-6" strokeWidth={on ? 2.1 : 1.7} />
        <span className={clsx('text-[10px] leading-none whitespace-nowrap', on && 'font-semibold')}>{item.label}</span>
        {item.key === 'task-pool' && typeof poolCount === 'number' && poolCount > 0 && (
          <span className="absolute right-[calc(50%-22px)] top-0 min-w-[18px] rounded-full bg-tk-overdue px-1 text-center text-[10px] font-bold leading-[18px] text-white">{poolCount > 99 ? '99+' : poolCount}</span>
        )}
      </Link>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-tk-line-lighter bg-tk-surface px-3.5 pt-2 pb-[max(env(safe-area-inset-bottom),10px)] md:hidden" aria-label="เมนูงานเจ้าหน้าที่">
      <div className="flex items-end">
        {ITEMS.slice(0, 2).map(render)}
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={onFab}
            aria-label={fabLabel}
            className="touch-feedback -mt-[30px] grid h-14 w-14 place-items-center rounded-[20px] text-white shadow-tk-purple-fab"
            style={{ backgroundImage: 'linear-gradient(140deg, var(--color-tk-primary), var(--color-tk-primary-light))' }}
          >
            <PencilIcon className="h-[26px] w-[26px]" strokeWidth={2} />
          </button>
        </div>
        {ITEMS.slice(2).map(render)}
      </div>
    </nav>
  );
}

export default MobileTaskNav;
