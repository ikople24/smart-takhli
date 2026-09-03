// components/tasks/QuickTaskSheet.tsx
// bottom sheet "อัปเดตงานด่วน" (FAB มือถือ) — งานที่ควรอัปเดตก่อน (lib/tasks/mobile.js#topUrgent) → หน้าจอ 3
import React from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { OfficerTask } from '@/lib/tasks/types';
import { topUrgent } from '@/lib/tasks/mobile';
import { AlertBadge } from './AlertBadge';
import { SEVERITY_BAR_CLASSES } from './TaskRow';

export interface QuickTaskSheetProps {
  open: boolean;
  tasks: OfficerTask[];
  loading?: boolean;
  limit?: number;
  onClose: () => void;
}

export function QuickTaskSheet({ open, tasks, loading, limit = 5, onClose }: QuickTaskSheetProps) {
  if (!open) return null;
  const list = topUrgent(tasks, limit) as OfficerTask[];
  return (
    <div className="fixed inset-0 z-40 font-tk-sans" role="dialog" aria-modal="true" aria-label="อัปเดตงานด่วน">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="ปิด" />
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-[22px] bg-tk-surface px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] shadow-tk-xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-tk-line-dashed" aria-hidden />
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-tk-ink">อัปเดตงานด่วน</h2>
            <p className="text-[12px] text-tk-ink-5">งานที่ควรอัปเดตก่อน — แตะเพื่อเปิดหน้าอัปเดต</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl text-tk-ink-5 hover:bg-tk-bg" aria-label="ปิด">
            <XMarkIcon className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        {loading ? (
          <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-[14px]" />)}</div>
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-tk-ink-5">ไม่มีงานค้าง — เยี่ยม!</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((t) => (
              <li key={t._id}>
                <Link href={t.actionUrl ?? `/admin/my-tasks/${t._id}`} className="touch-feedback flex min-h-14 items-center gap-3 rounded-[14px] border border-tk-line px-3 py-2.5">
                  <span className={clsx('w-1 self-stretch rounded-full', SEVERITY_BAR_CLASSES[t.severity])} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {t.code && <span className="font-tk-mono text-[11px] text-tk-ink-6">{t.code}</span>}
                      {t.badges[0] && <AlertBadge tone={t.badges[0].tone} size="xs">{t.badges[0].label}</AlertBadge>}
                    </span>
                    <span className="mt-0.5 block truncate text-[13.5px] font-semibold text-tk-ink">{t.title}</span>
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-tk-ink-6" strokeWidth={2} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default QuickTaskSheet;
