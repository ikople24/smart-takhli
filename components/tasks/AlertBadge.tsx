// components/tasks/AlertBadge.tsx
// ป้ายเตือน / pill ชุดเดียวใช้ทุกหน้าจอของงานเจ้าหน้าที่ — สี map จาก tone → โทเคน tk-* (styles/globals.css)
// ข้อความมาจาก lib/tasks/badges.js เสมอ (component นี้ไม่แต่งข้อความเอง)
// ⚠️ ข้อความไทยในป้ายต้อง nowrap ไม่งั้นตัดคำหลุดออกจากพื้นหลัง (README § Typography)
import React, { type ReactNode } from 'react';
import clsx from 'clsx';
import type { BadgeTone, Severity } from '@/lib/tasks/types';

/** พื้น + ตัวอักษรของป้ายตามโทน */
export const TONE_CLASSES: Record<BadgeTone, string> = {
  overdue: 'bg-tk-overdue-soft text-tk-overdue-ink',
  due: 'bg-tk-due-soft text-tk-due-ink',
  coord: 'bg-tk-coord-soft text-tk-coord-ink',
  blocked: 'bg-tk-blocked-soft text-tk-blocked-ink',
  unclaimed: 'bg-tk-unclaimed-soft text-tk-unclaimed-ink',
  done: 'bg-tk-done-soft text-tk-done-ink',
  info: 'bg-tk-blue-soft text-tk-blue',
  neutral: 'bg-tk-line-light text-tk-ink-3',
};

/** สี dot / แถบ ตามโทน */
export const TONE_DOT_CLASSES: Record<BadgeTone, string> = {
  overdue: 'bg-tk-overdue',
  due: 'bg-tk-due',
  coord: 'bg-tk-coord',
  blocked: 'bg-tk-blocked',
  unclaimed: 'bg-tk-unclaimed',
  done: 'bg-tk-done',
  info: 'bg-tk-blue',
  neutral: 'bg-tk-ink-6',
};

/** severity → โทนป้าย (ใช้กับแถบซ้ายของ task row / progress bar ของกลุ่ม) */
export const SEVERITY_TONE: Record<Severity, BadgeTone> = {
  overdue: 'overdue',
  due_soon: 'due',
  coordinating: 'coord',
  blocked: 'blocked',
  normal: 'neutral',
  done: 'done',
};

type Size = 'xs' | 'sm' | 'md' | 'pill';

const SIZE_CLASSES: Record<Size, string> = {
  xs: 'text-[10.5px] px-2 py-[3px]', // context badge บนการ์ดกองงานรอรับ
  sm: 'text-[11px] px-2 py-[3px]', // ป้ายสรุปบนแถวกลุ่ม
  md: 'text-[12px] px-2.5 py-1', // ป้ายบน task row / header
  pill: 'text-[12px] px-[11px] py-[5px]', // status pill
};

export interface AlertBadgeProps {
  tone: BadgeTone;
  children: ReactNode;
  size?: Size;
  /** จุดสีหน้าข้อความ */
  dot?: boolean;
  /** tooltip อธิบายเกณฑ์ */
  title?: string;
  onClick?: () => void;
  className?: string;
}

export function AlertBadge({ tone, children, size = 'md', dot = false, title, onClick, className }: AlertBadgeProps) {
  const cls = clsx(
    'inline-flex items-center gap-1.5 rounded-full font-semibold leading-none whitespace-nowrap',
    TONE_CLASSES[tone],
    SIZE_CLASSES[size],
    onClick && 'cursor-pointer transition hover:brightness-95 active:scale-[.98]',
    className
  );
  const body = (
    <>
      {dot && <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT_CLASSES[tone])} aria-hidden />}
      {children}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={cls} title={title} onClick={onClick}>
        {body}
      </button>
    );
  }
  return (
    <span className={cls} title={title}>
      {body}
    </span>
  );
}

export default AlertBadge;
