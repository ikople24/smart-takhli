// components/tasks/AlertCards.tsx
// แถวการ์ดเตือน 4 ใบ (README ② Alert row) — คลิกเพื่อกรองรายการกลุ่มงาน (?alert=)
import React from 'react';
import clsx from 'clsx';
import type { AlertCard, AlertKind, BadgeTone } from '@/lib/tasks/types';

const ACCENT: Record<BadgeTone, { border: string; ink: string; ring: string; tile: string }> = {
  overdue: { border: 'border-l-tk-overdue', ink: 'text-tk-overdue-ink', ring: 'ring-tk-overdue', tile: 'bg-tk-overdue-soft text-tk-overdue-ink' },
  due: { border: 'border-l-tk-due', ink: 'text-tk-due-ink', ring: 'ring-tk-due', tile: 'bg-tk-due-soft text-tk-due-ink' },
  coord: { border: 'border-l-tk-coord', ink: 'text-tk-coord-ink', ring: 'ring-tk-coord', tile: 'bg-tk-coord-soft text-tk-coord-ink' },
  blocked: { border: 'border-l-tk-blocked', ink: 'text-tk-blocked-ink', ring: 'ring-tk-blocked', tile: 'bg-tk-blocked-soft text-tk-blocked-ink' },
  unclaimed: { border: 'border-l-tk-unclaimed', ink: 'text-tk-unclaimed-ink', ring: 'ring-tk-unclaimed', tile: 'bg-tk-unclaimed-soft text-tk-unclaimed-ink' },
  done: { border: 'border-l-tk-done', ink: 'text-tk-done-ink', ring: 'ring-tk-done', tile: 'bg-tk-done-soft text-tk-done-ink' },
  info: { border: 'border-l-tk-blue', ink: 'text-tk-blue', ring: 'ring-tk-blue', tile: 'bg-tk-blue-soft text-tk-blue' },
  neutral: { border: 'border-l-tk-ink-6', ink: 'text-tk-ink-3', ring: 'ring-tk-ink-6', tile: 'bg-tk-line-light text-tk-ink-3' },
};

export interface AlertCardsProps {
  cards: AlertCard[];
  active: AlertKind | null;
  onSelect: (key: AlertKind | null) => void;
  className?: string;
}

export function AlertCards({ cards, active, onSelect, className }: AlertCardsProps) {
  return (
    <>
    {/* มือถือ: การ์ด "ต้องจัดการวันนี้" 2×2 */}
    <section className={clsx('rounded-[18px] bg-tk-surface px-3.5 py-3 shadow-tk-lg md:hidden', className)} aria-label="ต้องจัดการวันนี้">
      <h2 className="mb-2.5 text-[14px] font-bold text-tk-ink">ต้องจัดการวันนี้</h2>
      <div className="grid grid-cols-2 gap-[9px]" role="group">
        {cards.map((card) => {
          const on = active === card.key;
          return (
            <button key={card.key} type="button" aria-pressed={on} onClick={() => onSelect(on ? null : card.key)} className={clsx('touch-feedback flex min-h-12 items-center justify-between rounded-[13px] px-3 py-[11px] text-left', ACCENT[card.tone].tile, on && 'ring-2 ring-offset-1 ring-current')}>
              <span className="text-[11px] font-semibold leading-tight">{card.label}</span>
              <span className="text-[22px] font-bold leading-none">{card.count}</span>
            </button>
          );
        })}
      </div>
    </section>

    {/* เดสก์ท็อป: 4 การ์ดแถวเดียว */}
    <div className={clsx('hidden gap-3.5 md:grid md:grid-cols-2 xl:grid-cols-4', className)} role="group" aria-label="ป้ายเตือน">
      {cards.map((card) => {
        const accent = ACCENT[card.tone];
        const isActive = active === card.key;
        return (
          <button
            key={card.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(isActive ? null : card.key)}
            className={clsx(
              'rounded-[14px] border-l-4 bg-tk-surface px-4 py-3.5 text-left shadow-tk-md transition duration-150',
              'hover:-translate-y-px hover:shadow-tk-xl',
              accent.border,
              isActive && clsx('ring-2 ring-offset-1', accent.ring)
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={clsx('text-[12.5px] font-semibold whitespace-nowrap', accent.ink)}>{card.label}</span>
              <span className={clsx('text-[26px] font-bold leading-none', card.count > 0 ? 'text-tk-ink' : 'text-tk-ink-7')}>{card.count}</span>
            </div>
            <div className="mt-1.5 truncate text-[11.5px] text-tk-ink-5">{card.caption}</div>
          </button>
        );
      })}
    </div>
    </>
  );
}

export default AlertCards;
