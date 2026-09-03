// components/tasks/StatusStepper.tsx
// stepper 5 ขั้น (รับเรื่อง → ลงพื้นที่ → ประสานงาน → รอตรวจรับ → ปิดเรื่อง) — README หน้าจอ 3 § Stepper
// กฎการคลิกอยู่ที่ lib/tasks/status.js#stageTransition: เดินหน้าได้ทีละขั้น ถอยหลังต้องใส่เหตุผล (parent เป็นคนถาม)
import React from 'react';
import clsx from 'clsx';
import { CheckIcon } from '@heroicons/react/24/outline';
import type { Stage } from '@/lib/tasks/types';
import { STAGES, STAGE_LABELS, stageIndex, stageTransition } from '@/lib/tasks/status';

export interface StatusStepperProps {
  stage: Stage;
  /** ผู้ใช้กดขั้นที่เปลี่ยนได้ — needsReason=true เมื่อถอยหลัง (ให้ parent เปิด dialog ถามเหตุผล) */
  onChange?: (next: Stage, info: { direction: 'forward' | 'backward'; needsReason: boolean }) => void;
  disabled?: boolean;
  className?: string;
}

export function StatusStepper({ stage, onChange, disabled = false, className }: StatusStepperProps) {
  const current = stageIndex(stage);
  const stages = STAGES as readonly Stage[];

  return (
    <ol className={clsx('flex items-center', className)} aria-label="ขั้นตอนการดำเนินงาน">
      {stages.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        const transition = stageTransition(stage, s);
        const clickable = !disabled && !!onChange && transition.ok;
        const label = STAGE_LABELS[s];
        // เส้นเชื่อมก่อนขั้นนี้: ขั้นที่ผ่านแล้ว = เขียว, เข้าสู่ขั้นปัจจุบัน = teal, ยังไม่ถึง = เทา
        const lineCls = i < current ? 'bg-tk-done' : i === current ? 'bg-tk-coord' : 'bg-tk-line-light';

        return (
          <React.Fragment key={s}>
            {i > 0 && <span className={clsx('mb-5 h-[2px] flex-1', lineCls)} aria-hidden />}
            <li className="flex shrink-0 flex-col items-center gap-1.5">
              <button
                type="button"
                disabled={!clickable}
                aria-current={state === 'current' ? 'step' : undefined}
                title={clickable ? (transition.needsReason ? `ถอยกลับไป "${label}" (ต้องระบุเหตุผล)` : `เลื่อนไป "${label}"`) : transition.reason}
                onClick={() =>
                  clickable && onChange?.(s, { direction: transition.direction as 'forward' | 'backward', needsReason: transition.needsReason })
                }
                className={clsx(
                  'grid h-[22px] w-[22px] place-items-center rounded-full transition',
                  state === 'done' && 'bg-tk-done text-white',
                  state === 'current' && 'bg-tk-coord ring-[3px] ring-tk-coord-line',
                  state === 'todo' && 'border-2 border-tk-line-dashed bg-tk-line-light',
                  clickable ? 'cursor-pointer hover:scale-110' : 'cursor-default'
                )}
              >
                {state === 'done' && <CheckIcon className="h-3 w-3" strokeWidth={3} />}
              </button>
              <span
                className={clsx(
                  'text-[10.5px] leading-none whitespace-nowrap',
                  state === 'done' && 'font-semibold text-tk-done',
                  state === 'current' && 'font-bold text-tk-coord-ink',
                  state === 'todo' && 'text-tk-ink-6'
                )}
              >
                {label}
              </span>
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
}

export default StatusStepper;
