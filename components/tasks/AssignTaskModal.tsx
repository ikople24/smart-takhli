// components/tasks/AssignTaskModal.tsx
// modal "มอบหมาย" (หัวหน้ากอง/superadmin) — เลือกเจ้าหน้าที่ในกอง พร้อมจำนวนงานที่แต่ละคนถืออยู่ (README หน้าจอ 2)
import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { PoolItem } from '@/lib/tasks/types';
import { normalizeDepartment } from '@/lib/tasks/departments';
import type { OfficerOption } from './TransferTaskModal';

export interface AssignTaskModalProps {
  open: boolean;
  item: PoolItem | null;
  officers: OfficerOption[];
  officersLoading?: boolean;
  /** userId → จำนวนงานเปิดที่ถืออยู่ */
  workload: Record<string, number>;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (toUserId: string) => void;
}

export function AssignTaskModal({ open, item, officers, officersLoading, workload, submitting, onClose, onSubmit }: AssignTaskModalProps) {
  const [toUserId, setToUserId] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!open) return;
    setToUserId('');
    setShowAll(false);
  }, [open, item?._id]);

  // เจ้าหน้าที่ในกองเดียวกับเรื่องมาก่อน (เรียงงานน้อย → มาก) — กดดูทั้งหมดได้
  const list = useMemo(() => {
    const active = officers.filter((o) => o.isActive !== false);
    const dept = item?.department ?? null;
    const same = dept ? active.filter((o) => normalizeDepartment(o.department) === dept) : [];
    const pool = showAll || !same.length ? active : same;
    return [...pool].sort((a, b) => (workload[a._id] ?? 0) - (workload[b._id] ?? 0) || String(a.name ?? '').localeCompare(String(b.name ?? ''), 'th'));
  }, [officers, item, showAll, workload]);

  if (!open || !item) return null;

  return (
    <dialog className="modal modal-open font-tk-sans" aria-label="มอบหมายงาน">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (toUserId && !submitting) onSubmit(toUserId);
        }}
        className="modal-box max-w-md rounded-[18px] bg-tk-surface p-0 text-tk-ink shadow-tk-xl"
      >
        <div className="flex items-center justify-between border-b border-tk-line-light px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-[16px] font-bold">มอบหมายงาน</h3>
            <p className="truncate text-[12px] text-tk-ink-5">
              {item.code && <span className="font-tk-mono">{item.code} · </span>}
              {item.title}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-tk-ink-5 hover:bg-tk-bg" aria-label="ปิด">
            <XMarkIcon className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-tk-ink-4">
              {item.department && !showAll ? `เจ้าหน้าที่ใน${item.department}` : 'เจ้าหน้าที่ทั้งหมด'}
            </span>
            {item.department && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[12px] font-semibold text-tk-primary hover:underline">
                {showAll ? 'เฉพาะกองนี้' : 'ดูทุกกอง'}
              </button>
            )}
          </div>
          {officersLoading ? (
            <p className="py-6 text-center text-[12.5px] text-tk-ink-5">กำลังโหลดรายชื่อ…</p>
          ) : list.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-tk-ink-5">ไม่พบเจ้าหน้าที่</p>
          ) : (
            <ul className="flex max-h-[320px] flex-col gap-1.5 overflow-y-auto scrollbar-thin" role="radiogroup">
              {list.map((o) => {
                const on = o._id === toUserId;
                const n = workload[o._id] ?? 0;
                return (
                  <li key={o._id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setToUserId(o._id)}
                      className={clsx(
                        'flex w-full items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition',
                        on ? 'border-tk-primary bg-tk-primary-tint' : 'border-tk-line hover:border-tk-primary-line'
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-tk-ink">{o.name || '(ไม่ระบุชื่อ)'}</span>
                        <span className="block truncate text-[11.5px] text-tk-ink-5">{[o.position, o.department].filter(Boolean).join(' · ') || '—'}</span>
                      </span>
                      <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', n >= 8 ? 'bg-tk-overdue-soft text-tk-overdue-ink' : n >= 4 ? 'bg-tk-due-soft text-tk-due-ink' : 'bg-tk-done-soft text-tk-done-ink')}>
                        ถือ {n} งาน
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex gap-2.5 border-t border-tk-line-light px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-[12px] px-4 py-2.5 text-[13.5px] font-semibold text-tk-ink-4 hover:bg-tk-bg">
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={!toUserId || submitting}
            className="flex-1 rounded-[12px] bg-tk-primary py-2.5 text-[13.5px] font-semibold text-white shadow-tk-purple transition hover:bg-tk-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'กำลังมอบหมาย…' : 'มอบหมายงาน'}
          </button>
        </div>
      </form>
      <button type="button" className="modal-backdrop" onClick={onClose} aria-label="ปิด" />
    </dialog>
  );
}

export default AssignTaskModal;
