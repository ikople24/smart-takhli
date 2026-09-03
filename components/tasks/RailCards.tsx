// components/tasks/RailCards.tsx
// right rail ของหน้าจอ 1 (README ④ ขวา): ต้องประสานงานต่อ · รอวัสดุ/งบประมาณ · ครบกำหนดสัปดาห์นี้
// ข้อมูลมาจาก lib/tasks/summary.js — component แค่วาด
import React, { type ReactNode } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ChatBubbleLeftRightIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import type { BlockedRailItem, CoordinationRailItem, DueThisWeekItem } from '@/lib/tasks/types';
import { formatThaiShortDate } from '@/lib/tasks/format';
import { AlertBadge } from './AlertBadge';

function RailCard({ dot, title, count, countClass, children, className }: { dot: string; title: string; count?: number; countClass?: string; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('rounded-[18px] bg-tk-surface px-[18px] py-4 shadow-tk-lg', className)}>
      <div className="flex items-center gap-2">
        <span className={clsx('h-2 w-2 shrink-0 rounded-full', dot)} aria-hidden />
        <h3 className="text-[14.5px] font-bold text-tk-ink">{title}</h3>
        {typeof count === 'number' && count > 0 && (
          <span className={clsx('ml-auto rounded-full px-2 py-0.5 text-[11.5px] font-bold', countClass)}>{count}</span>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] text-tk-ink-5">{children}</p>;
}

/* ── a) ต้องประสานงานต่อ ── */

export interface CoordinationRailCardProps {
  items: CoordinationRailItem[];
  /** กองของเจ้าหน้าที่ — แสดง "ผู้ประสาน: กองช่าง (คุณ)" */
  officerDepartment?: string;
  busyAgency?: string | null;
  onLogFollowUp?: (item: CoordinationRailItem) => void;
  onNotifyLine?: (item: CoordinationRailItem) => void;
}

export function CoordinationRailCard({ items, officerDepartment, busyAgency, onLogFollowUp, onNotifyLine }: CoordinationRailCardProps) {
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <RailCard dot="bg-tk-coord" title="ต้องประสานงานต่อ" count={total} countClass="bg-tk-coord-soft text-tk-coord-ink">
      {items.length === 0 ? (
        <Empty>ไม่มีเรื่องรอประสานหน่วยงานภายนอก</Empty>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((item, idx) => {
            const prominent = idx === 0;
            const busy = busyAgency === item.agencyName;
            const coordinator = officerDepartment ? `${officerDepartment} (คุณ)` : 'คุณ';
            return (
              <div
                key={item.agencyName}
                className={clsx(
                  'rounded-[13px] border px-[13px] py-[11px]',
                  prominent ? 'border-tk-coord-line-2 bg-tk-coord-tint' : 'border-tk-line bg-tk-surface'
                )}
              >
                <div className="text-[13px] font-semibold text-tk-ink">{item.agencyName}</div>
                <div className="mt-0.5 text-[11.5px] text-tk-ink-4">
                  {item.count} เรื่อง · ผู้ประสาน: {coordinator}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {item.waitPill && (
                    <AlertBadge tone={item.waitPill.tone} size="sm">
                      {item.waitPill.label}
                    </AlertBadge>
                  )}
                  {item.followUpDue && !item.waitPill && (
                    <AlertBadge tone="due" size="sm">
                      ถึงกำหนดติดตาม
                    </AlertBadge>
                  )}
                  {item.latestSentAt ? (
                    <span className="text-[11px] text-tk-ink-5">ส่งหนังสือ {formatThaiShortDate(item.latestSentAt)}</span>
                  ) : item.nextFollowUpAt ? (
                    <span className="text-[11px] text-tk-ink-5">นัด {formatThaiShortDate(item.nextFollowUpAt)}</span>
                  ) : null}
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onLogFollowUp?.(item)}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-[9px] bg-tk-coord py-[7px] text-[12px] font-semibold text-white whitespace-nowrap transition hover:brightness-95 disabled:opacity-60"
                  >
                    <PencilSquareIcon className="h-3.5 w-3.5" strokeWidth={2} />
                    บันทึกการติดตาม
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onNotifyLine?.(item)}
                    className="inline-flex items-center gap-1 rounded-[9px] bg-tk-coord-soft px-[11px] py-[7px] text-[12px] font-semibold text-tk-coord-ink whitespace-nowrap transition hover:bg-tk-coord-btn disabled:opacity-60"
                  >
                    <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" strokeWidth={2} />
                    แจ้ง LINE
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </RailCard>
  );
}

/* ── b) รอวัสดุ / งบประมาณ ── */

export function BlockedRailCard({ items }: { items: BlockedRailItem[] }) {
  return (
    <RailCard dot="bg-tk-blocked" title="รอวัสดุ / งบประมาณ" count={items.length} countClass="bg-tk-blocked-soft text-tk-blocked-ink">
      {items.length === 0 ? (
        <Empty>ไม่มีงานที่พักรอวัสดุหรืองบประมาณ</Empty>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((item) => {
            const body = (
              <>
                <div className="text-[13px] font-semibold text-tk-ink">{item.itemName || item.title}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-tk-ink-4">
                  {item.code && <span className="font-tk-mono">{item.code}</span>}
                  {item.purchaseRefNo ? (
                    <span>· เสนอจัดซื้อ {item.purchaseRefNo}</span>
                  ) : item.since ? (
                    <span>· พักตั้งแต่ {formatThaiShortDate(item.since)}</span>
                  ) : null}
                </div>
                <div className="mt-2">
                  {item.expectedAt ? (
                    <AlertBadge tone="blocked" size="sm">
                      คาดได้รับ {formatThaiShortDate(item.expectedAt)}
                    </AlertBadge>
                  ) : (
                    <AlertBadge tone="neutral" size="sm">
                      ยังไม่ระบุวันคาดรับ
                    </AlertBadge>
                  )}
                </div>
              </>
            );
            const cls = 'block rounded-[13px] border border-tk-blocked-line bg-tk-primary-tint-3 px-[13px] py-[11px] transition hover:border-tk-primary-line';
            return item.actionUrl ? (
              <Link key={item._id} href={item.actionUrl} className={cls}>
                {body}
              </Link>
            ) : (
              <div key={item._id} className={cls}>
                {body}
              </div>
            );
          })}
        </div>
      )}
    </RailCard>
  );
}

/* ── c) ครบกำหนดสัปดาห์นี้ ── */

const CHIP: Record<DueThisWeekItem['tone'], string> = {
  overdue: 'bg-tk-overdue-soft text-tk-overdue-ink',
  due: 'bg-tk-due-soft text-tk-due-ink',
  neutral: 'bg-tk-bg text-tk-ink-3',
};

function DateChip({ date, tone }: { date: string | null; tone: DueThisWeekItem['tone'] }) {
  const [day, month] = formatThaiShortDate(date).split(' ');
  return (
    <div className={clsx('w-[42px] shrink-0 rounded-[9px] py-[5px] text-center', CHIP[tone])} aria-hidden>
      <div className="text-[15px] font-bold leading-none">{day || '–'}</div>
      <div className="mt-0.5 text-[10px] leading-none">{month || ''}</div>
    </div>
  );
}

export function DueThisWeekCard({ items }: { items: DueThisWeekItem[] }) {
  return (
    <RailCard dot="bg-tk-due" title="ครบกำหนดสัปดาห์นี้" count={items.length} countClass="bg-tk-due-soft text-tk-due-ink">
      {items.length === 0 ? (
        <Empty>ไม่มีงานครบกำหนดใน 7 วันนี้</Empty>
      ) : (
        // README: การ์ดนี้ต้องมี inner scroll
        <ul className="flex max-h-[280px] flex-col gap-2.5 overflow-y-auto pr-1 scrollbar-thin">
          {items.map((item) => {
            const body = (
              <>
                <DateChip date={item.dueDate} tone={item.tone} />
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-semibold text-tk-ink">{item.title}</div>
                  <div className="mt-0.5 truncate text-[11px] text-tk-ink-6">
                    {item.daysToDue < 0
                      ? `เลยกำหนด ${-item.daysToDue} วัน`
                      : item.daysToDue === 0
                        ? 'ครบกำหนดวันนี้'
                        : `อีก ${item.daysToDue} วัน`}
                    {item.caption && ` · ${item.caption}`}
                  </div>
                </div>
              </>
            );
            return (
              <li key={item._id}>
                {item.actionUrl ? (
                  <Link href={item.actionUrl} className="flex items-center gap-[11px] rounded-[10px] transition hover:bg-tk-bg">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-[11px]">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </RailCard>
  );
}
