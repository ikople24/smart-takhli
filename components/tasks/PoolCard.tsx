// components/tasks/PoolCard.tsx
// การ์ดเรื่องในกองงานรอรับ (README หน้าจอ 2 § Pool card) — ปุ่มเปลี่ยนตามความสัมพันธ์ของเรื่องกับกองของเจ้าหน้าที่
// ข้อความ aging pill / context badges มาจาก lib/tasks/badges.js (ใส่มาใน item แล้ว)
import React from 'react';
import clsx from 'clsx';
import type { PoolItem } from '@/lib/tasks/types';
import { AlertBadge } from './AlertBadge';

export type PoolAction =
  | 'claim' // กองของตัวเอง → รับงาน (+ มอบหมาย ถ้าเป็นหัวหน้ากอง)
  | 'coordinate' // กองอื่นแต่เราต้องประสาน → รับเป็นผู้ประสาน
  | 'choose_org' // ยังไม่ระบุกอง → เลือกกอง
  | 'not_yours'; // กองอื่น → ปุ่มปิด

export interface PoolCardProps {
  item: PoolItem;
  action: PoolAction;
  /** เห็นปุ่ม "มอบหมาย" (หัวหน้ากอง / superadmin) */
  canAssign?: boolean;
  busy?: boolean;
  onClaim?: (item: PoolItem) => void;
  onAssign?: (item: PoolItem) => void;
  onCoordinate?: (item: PoolItem) => void;
  onChooseOrg?: (item: PoolItem) => void;
  /** คลิกหัวเรื่อง → ดูรายละเอียด */
  onOpen?: (item: PoolItem) => void;
  className?: string;
}

const BTN = 'rounded-[9px] py-2 text-[12.5px] font-semibold whitespace-nowrap transition active:scale-[.98] disabled:cursor-not-allowed';

export function PoolCard({ item, action, canAssign = false, busy = false, onClaim, onAssign, onCoordinate, onChooseOrg, onOpen, className }: PoolCardProps) {
  const highlight = item.isUrgent || item.isStale;

  let buttons: React.ReactNode;
  switch (action) {
    case 'claim':
      buttons = (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => onClaim?.(item)}
            className={clsx(BTN, 'flex-1 text-white', item.isUrgent ? 'bg-tk-overdue hover:brightness-95' : 'bg-tk-primary hover:bg-tk-primary-dark')}
          >
            {item.isUrgent ? 'รับงานด่วน' : 'รับงาน'}
          </button>
          {canAssign && (
            <button type="button" disabled={busy} onClick={() => onAssign?.(item)} className={clsx(BTN, 'bg-tk-bg px-[11px] text-tk-ink-4 hover:bg-tk-line-light')}>
              มอบหมาย
            </button>
          )}
        </>
      );
      break;
    case 'coordinate':
      buttons = (
        <button type="button" disabled={busy} onClick={() => onCoordinate?.(item)} className={clsx(BTN, 'flex-1 bg-tk-coord-soft text-tk-coord-ink hover:bg-tk-coord-btn')}>
          รับเป็นผู้ประสาน
        </button>
      );
      break;
    case 'choose_org':
      buttons = (
        <button type="button" disabled={busy} onClick={() => onChooseOrg?.(item)} className={clsx(BTN, 'flex-1 bg-tk-ink-3 text-white hover:bg-tk-ink-2')}>
          เลือกกอง
        </button>
      );
      break;
    default:
      buttons = (
        <button type="button" disabled title="เฉพาะเจ้าหน้าที่ในกองนี้" className={clsx(BTN, 'flex-1 bg-tk-bg text-tk-ink-4 opacity-80')}>
          ไม่ใช่กองของคุณ
        </button>
      );
  }

  return (
    <article
      className={clsx(
        'rounded-[13px] border p-3 transition duration-150 hover:-translate-y-px hover:shadow-tk-md',
        highlight ? 'border-tk-overdue-line bg-tk-overdue-tint' : 'border-tk-line bg-tk-surface',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-tk-mono text-[11px] text-tk-ink-6">{item.code ?? '—'}</span>
        {item.agingPill && (
          <AlertBadge tone={item.agingPill.tone} size="xs">
            {item.agingPill.label}
          </AlertBadge>
        )}
      </div>

      {onOpen ? (
        <button type="button" onClick={() => onOpen(item)} className="mt-1.5 block text-left text-[13.5px] font-semibold leading-[1.4] text-tk-ink hover:text-tk-primary">
          {item.title}
        </button>
      ) : (
        <h4 className="mt-1.5 text-[13.5px] font-semibold leading-[1.4] text-tk-ink">{item.title}</h4>
      )}

      <p className="mt-[5px] text-[11.5px] text-tk-ink-5">
        {[item.category, item.community].filter(Boolean).join(' · ') || '—'}
      </p>

      {item.contextBadges.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-[5px]">
          {item.contextBadges.map((b) => (
            <AlertBadge key={`${b.kind}-${b.label}`} tone={b.tone} size="xs">
              {b.label}
            </AlertBadge>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex gap-[7px]">{buttons}</div>
    </article>
  );
}

export default PoolCard;
