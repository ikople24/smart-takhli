// components/tasks/TaskTimeline.tsx
// การ์ด "ไทม์ไลน์การดำเนินงาน" (README หน้าจอ 3 c) — รายการมาจาก lib/tasks/timeline.js#buildTimeline
import React from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import type { BadgeTone, TimelineEntry } from '@/lib/tasks/types';
import { formatThaiDate } from '@/lib/tasks/format';
import { TONE_DOT_CLASSES } from './AlertBadge';

const HOLLOW_BORDER: Partial<Record<BadgeTone, string>> = {
  overdue: 'border-tk-overdue',
  blocked: 'border-tk-blocked',
  coord: 'border-tk-coord',
  neutral: 'border-tk-ink-6',
};

export function TaskTimeline({ entries, className }: { entries: TimelineEntry[]; className?: string }) {
  return (
    <ol className={clsx('flex flex-col', className)} aria-label="ไทม์ไลน์การดำเนินงาน">
      {entries.map((e, i) => {
        const last = i === entries.length - 1;
        return (
          <li key={e.key} className="flex gap-[14px]">
            <div className="flex w-3 shrink-0 flex-col items-center">
              <span
                className={clsx(
                  'mt-1 h-[11px] w-[11px] shrink-0 rounded-full',
                  e.pending ? clsx('border-[2.5px] bg-tk-surface', HOLLOW_BORDER[e.tone] ?? 'border-tk-ink-6') : TONE_DOT_CLASSES[e.tone]
                )}
                aria-hidden
              />
              {!last && <span className="mt-1 w-[2px] flex-1 rounded-full bg-tk-line-light" aria-hidden />}
            </div>
            <div className={clsx('min-w-0 flex-1', !last && 'pb-4')}>
              <div className={clsx('text-[13.5px] font-semibold', e.pending && e.tone === 'overdue' ? 'text-tk-overdue-ink' : 'text-tk-ink')}>{e.title}</div>
              {e.detail && <div className="mt-0.5 whitespace-pre-line text-[12.5px] leading-relaxed text-tk-ink-2">{e.detail}</div>}
              {(e.at || e.by) && (
                <div className="mt-[3px] text-[12px] text-tk-ink-5">
                  {[formatThaiDate(e.at), e.by].filter(Boolean).join(' · ')}
                </div>
              )}
              {e.images && e.images.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {e.images.map((src) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer" className="relative block h-14 w-14 overflow-hidden rounded-[9px] border border-tk-line">
                      <Image src={src} alt="" fill sizes="56px" className="object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default TaskTimeline;
