// components/tasks/TaskRow.tsx
// แถวงานหนึ่งเรื่องใน "กลุ่มงานของฉัน" (README หน้าจอ 1 § Task row)
// แถบซ้าย = severity สูงสุด · รหัส (mono) + หัวเรื่อง + ป้ายเตือน · บรรทัด meta · status pill · ปุ่มลูกศรไปหน้าจอ 3
import React from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import type { OfficerTask, Severity } from '@/lib/tasks/types';
import { formatThaiShortDate, relativeDaysLabel } from '@/lib/tasks/format';
import { AlertBadge, TONE_DOT_CLASSES, SEVERITY_TONE } from './AlertBadge';

/** สีแถบซ้ายตาม severity — export ให้ progress bar ของกลุ่มใช้ชุดเดียวกัน */
export const SEVERITY_BAR_CLASSES: Record<Severity, string> = {
  overdue: TONE_DOT_CLASSES.overdue,
  due_soon: TONE_DOT_CLASSES.due,
  coordinating: TONE_DOT_CLASSES.coord,
  blocked: TONE_DOT_CLASSES.blocked,
  normal: 'bg-tk-line-dashed',
  done: TONE_DOT_CLASSES.done,
};

export interface TaskRowProps {
  task: OfficerTask;
  /** ลิงก์ไปหน้ารายละเอียด (หน้าจอ 3) — ถ้าไม่ส่งใช้ onOpen */
  href?: string;
  onOpen?: (task: OfficerTask) => void;
  className?: string;
}

function MetaLine({ task }: { task: OfficerTask }) {
  const parts: React.ReactNode[] = [];
  if (task.community) parts.push(<span key="community">{task.community}</span>);
  const assigned = formatThaiShortDate(task.assignedAt);
  if (assigned) parts.push(<span key="assigned">รับเมื่อ {assigned}</span>);
  const due = formatThaiShortDate(task.dueDate);
  if (due) {
    parts.push(
      <span key="due" className={clsx(task.isOverdue && 'font-semibold text-tk-overdue-ink')}>
        ครบกำหนด {due}
      </span>
    );
  }
  if (task.daysSinceUpdate !== null && !task.isCompleted) {
    parts.push(<span key="updated">อัปเดตล่าสุด {relativeDaysLabel(task.daysSinceUpdate)}</span>);
  }
  return (
    <div className="mt-[5px] flex flex-wrap items-center gap-x-1.5 text-[12px] text-tk-ink-5">
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span aria-hidden>·</span>}
          {p}
        </React.Fragment>
      ))}
    </div>
  );
}

export function TaskRow({ task, href, onOpen, className }: TaskRowProps) {
  const arrowCls =
    'grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-tk-bg text-tk-ink-4 transition hover:bg-tk-primary-tint hover:text-tk-primary';
  const arrow = href ? (
    <Link href={href} className={arrowCls} aria-label={`เปิดเรื่อง ${task.code ?? task.title}`}>
      <ChevronRightIcon className="h-[17px] w-[17px]" strokeWidth={2} />
    </Link>
  ) : (
    <button type="button" className={arrowCls} onClick={() => onOpen?.(task)} aria-label={`เปิดเรื่อง ${task.code ?? task.title}`}>
      <ChevronRightIcon className="h-[17px] w-[17px]" strokeWidth={2} />
    </button>
  );

  return (
    <div
      className={clsx(
        'flex items-center gap-[14px] rounded-[13px] border border-tk-line-tint bg-tk-surface px-[14px] py-[11px]',
        'transition duration-150 hover:-translate-y-px hover:shadow-tk-md',
        className
      )}
    >
      <div className={clsx('w-1 self-stretch rounded-full', SEVERITY_BAR_CLASSES[task.severity])} aria-hidden />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-[9px]">
          {task.code && <span className="font-tk-mono text-[11.5px] text-tk-ink-6">{task.code}</span>}
          <span className="text-[14px] font-semibold text-tk-ink">{task.title}</span>
          {task.badges.map((b) => (
            <AlertBadge key={`${b.kind}-${b.label}`} tone={b.tone} size="md">
              {b.label}
            </AlertBadge>
          ))}
          {task.transferRequest && (
            <AlertBadge tone="due" size="md" title={`ขอโอน: ${task.transferRequest.reason}`}>
              ขอโอนงาน
            </AlertBadge>
          )}
          {task.assignee?.name && (
            <AlertBadge tone="neutral" size="md" title="ผู้รับผิดชอบ">
              {task.assignee.name}
            </AlertBadge>
          )}
        </div>
        <MetaLine task={task} />
      </div>

      <AlertBadge tone={task.statusPill.tone} size="pill" className="shrink-0">
        {task.statusPill.label}
      </AlertBadge>

      {arrow}
    </div>
  );
}

// ให้ไฟล์อื่นใช้ tone ของ severity ได้โดยไม่ต้อง import AlertBadge
export { SEVERITY_TONE };
export default TaskRow;
