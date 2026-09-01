// components/tasks/AlertCards.tsx
// แถวการ์ดเตือน 4 ใบ (README ② Alert row) — คลิกเพื่อกรองรายการกลุ่มงาน (?alert=)
import React from 'react';
import clsx from 'clsx';
import type { AlertCard, AlertKind, BadgeTone } from '@/lib/tasks/types';

const ACCENT: Record<BadgeTone, { border: string; ink: string; ring: string }> = {
  overdue: { border: 'border-l-tk-overdue', ink: 'text-tk-overdue-ink', ring: 'ring-tk-overdue' },
  due: { border: 'border-l-tk-due', ink: 'text-tk-due-ink', ring: 'ring-tk-due' },
  coord: { border: 'border-l-tk-coord', ink: 'text-tk-coord-ink', ring: 'ring-tk-coord' },
  blocked: { border: 'border-l-tk-blocked', ink: 'text-tk-blocked-ink', ring: 'ring-tk-blocked' },
  unclaimed: { border: 'border-l-tk-unclaimed', ink: 'text-tk-unclaimed-ink', ring: 'ring-tk-unclaimed' },
  done: { border: 'border-l-tk-done', ink: 'text-tk-done-ink', ring: 'ring-tk-done' },
  info: { border: 'border-l-tk-blue', ink: 'text-tk-blue', ring: 'ring-tk-blue' },
  neutral: { border: 'border-l-tk-ink-6', ink: 'text-tk-ink-3', ring: 'ring-tk-ink-6' },
};

export interface AlertCardsProps {
  cards: AlertCard[];
  active: AlertKind | null;
  onSelect: (key: AlertKind | null) => void;
  className?: string;
}

export function AlertCards({ cards, active, onSelect, className }: AlertCardsProps) {
  return (
    <div className={clsx('grid grid-cols-2 gap-3.5 xl:grid-cols-4', className)} role="group" aria-label="ป้ายเตือน">
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
  );
}

export default AlertCards;
