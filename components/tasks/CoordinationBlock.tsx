// components/tasks/CoordinationBlock.tsx
// บล็อก "ประสานหน่วยงานภายนอก" ⭐ (README หน้าจอ 3 § Coordination block)
// แยกชัด: หน่วยงานผู้ดำเนินการ (เช่น กฟภ.) vs ผู้ประสานงาน (เรา — กอง/เจ้าหน้าที่)
import React from 'react';
import clsx from 'clsx';
import { ChatBubbleLeftRightIcon, PencilSquareIcon, PhoneIcon, PlusIcon } from '@heroicons/react/24/outline';
import type { Badge, CoordinationInfo } from '@/lib/tasks/types';
import { coordinationWaitPill } from '@/lib/tasks/badges';
import { formatThaiDate } from '@/lib/tasks/format';
import { AlertBadge } from './AlertBadge';

export interface CoordinationBlockProps {
  coordination: CoordinationInfo | null;
  /** วันที่รอตอบกลับ (จาก derived.coordinationWaitDays) */
  waitDays?: number | null;
  /** วันติดตามครั้งถัดไปถึงแล้ว (derived.followUpDue) */
  followUpDue?: boolean;
  /** รอบติดตาม (settings.followUpEveryDays) — เกินรอบ pill เป็นสีแดง */
  followUpEveryDays?: number;
  /** ข้อความช่อง "ผู้ประสานงาน (เรา)" เช่น "กองช่าง / สมชาย ใจดี" */
  coordinatorLabel?: string;
  busy?: boolean;
  onLogFollowUp?: () => void;
  onCalled?: () => void;
  onNotifyLine?: () => void;
  /** เริ่มการประสานงาน (แสดงเมื่อยังไม่มี) */
  onStart?: () => void;
  className?: string;
}

const BTN = 'inline-flex items-center justify-center gap-1.5 rounded-[10px] text-[12.5px] font-semibold whitespace-nowrap transition active:scale-[.98] disabled:opacity-60';

function Field({ label, children, mono = false, className }: { label: string; children: React.ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-tk-coord-label">{label}</div>
      <div className={clsx('mt-0.5 truncate text-[12.5px] font-semibold text-tk-coord-ink', mono && 'font-tk-mono font-medium', className)}>
        {children}
      </div>
    </div>
  );
}

export function CoordinationBlock({
  coordination,
  waitDays = null,
  followUpDue = false,
  followUpEveryDays = 7,
  coordinatorLabel,
  busy = false,
  onLogFollowUp,
  onCalled,
  onNotifyLine,
  onStart,
  className,
}: CoordinationBlockProps) {
  if (!coordination) {
    return (
      <div className={clsx('rounded-[15px] border border-dashed border-tk-line-dashed px-4 py-[14px]', className)}>
        <div className="text-[13.5px] font-bold text-tk-ink">ประสานหน่วยงานภายนอก</div>
        <p className="mt-1 text-[12px] text-tk-ink-5">
          ใช้เมื่อหน่วยงานอื่นต้องเป็นผู้ดำเนินการ (เช่น กฟภ. ตัดกิ่งไม้พาดสายไฟ) — ระบบจะบันทึกว่าเราเป็นผู้ประสานและเตือนติดตามให้
        </p>
        {onStart && (
          <button type="button" disabled={busy} onClick={onStart} className={clsx(BTN, 'mt-3 bg-tk-coord-soft px-3 py-2 text-tk-coord-ink hover:bg-tk-coord-btn')}>
            <PlusIcon className="h-4 w-4" strokeWidth={2} />
            เพิ่มการประสานงาน
          </button>
        )}
      </div>
    );
  }

  const wait = coordinationWaitPill(waitDays, followUpEveryDays) as Badge | null;
  const nextFollowUp = formatThaiDate(coordination.nextFollowUpAt);

  return (
    <section className={clsx('rounded-[15px] border-[1.5px] border-tk-coord-line bg-tk-coord-tint px-4 py-[15px]', className)}>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-tk-coord" aria-hidden />
        <h3 className="text-[13.5px] font-bold text-tk-coord-ink">ประสานหน่วยงานภายนอก</h3>
        {wait && (
          <AlertBadge tone={wait.tone} size="md" className="ml-auto">
            {wait.label}
          </AlertBadge>
        )}
      </div>

      <div className="mt-[13px] grid grid-cols-2 gap-3">
        <Field label="หน่วยงานผู้ดำเนินการ">{coordination.agencyName || '—'}</Field>
        <Field label="ผู้ประสานงาน (เรา)">{coordinatorLabel || coordination.coordinatorName || '—'}</Field>
        <Field label="หนังสือเลขที่" mono>
          {coordination.documentNo || '—'}
        </Field>
        <Field label="ติดตามครั้งถัดไป" className={clsx(followUpDue && 'text-tk-overdue-ink')}>
          {nextFollowUp || '—'}
          {followUpDue && ' · ถึงกำหนดแล้ว'}
        </Field>
      </div>

      {coordination.followUpCount > 0 && (
        <p className="mt-2 text-[11px] text-tk-coord-label">
          ติดตามแล้ว {coordination.followUpCount} ครั้ง
          {coordination.lastFollowUpAt && ` · ล่าสุด ${formatThaiDate(coordination.lastFollowUpAt)}`}
        </p>
      )}

      <div className="mt-[14px] flex gap-2">
        <button type="button" disabled={busy} onClick={onLogFollowUp} className={clsx(BTN, 'flex-1 bg-tk-coord py-2.5 text-white hover:brightness-95')}>
          <PencilSquareIcon className="h-4 w-4" strokeWidth={2} />
          บันทึกการติดตาม
        </button>
        <button type="button" disabled={busy} onClick={onCalled} className={clsx(BTN, 'bg-tk-coord-btn px-[13px] py-2.5 text-tk-coord-ink hover:brightness-95')}>
          <PhoneIcon className="h-4 w-4" strokeWidth={2} />
          โทรแล้ว
        </button>
        <button type="button" disabled={busy} onClick={onNotifyLine} className={clsx(BTN, 'bg-tk-coord-btn px-[13px] py-2.5 text-tk-coord-ink hover:brightness-95')}>
          <ChatBubbleLeftRightIcon className="h-4 w-4" strokeWidth={2} />
          แจ้ง LINE กลุ่ม
        </button>
      </div>
    </section>
  );
}

export default CoordinationBlock;
