// components/tasks/DepartmentPickerModal.tsx
// modal "เลือกกอง" — คัดแยกเรื่องในคอลัมน์ "ยังไม่ระบุกอง" (README หน้าจอ 2) → PATCH /api/complaints/[id]/department
import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { PoolItem } from '@/lib/tasks/types';

export interface DepartmentPickerModalProps {
  open: boolean;
  item: PoolItem | null;
  departments: Array<{ name: string; short: string }>;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (department: string) => void;
}

export function DepartmentPickerModal({ open, item, departments, submitting, onClose, onSubmit }: DepartmentPickerModalProps) {
  const [value, setValue] = useState('');
  useEffect(() => {
    if (open) setValue(item?.department ?? '');
  }, [open, item?._id, item?.department]);

  if (!open || !item) return null;

  return (
    <dialog className="modal modal-open font-tk-sans" aria-label="เลือกกอง">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value && !submitting) onSubmit(value);
        }}
        className="modal-box max-w-md rounded-[18px] bg-tk-surface p-0 text-tk-ink shadow-tk-xl"
      >
        <div className="flex items-center justify-between border-b border-tk-line-light px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-[16px] font-bold">เลือกกองที่รับผิดชอบ</h3>
            <p className="truncate text-[12px] text-tk-ink-5">
              {item.code && <span className="font-tk-mono">{item.code} · </span>}
              {item.title}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-tk-ink-5 hover:bg-tk-bg" aria-label="ปิด">
            <XMarkIcon className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-1.5 px-5 py-4 sm:grid-cols-2" role="radiogroup">
          {departments.map((d) => {
            const on = d.name === value;
            return (
              <button
                key={d.name}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setValue(d.name)}
                className={clsx(
                  'rounded-[12px] border px-3 py-2.5 text-left text-[13px] font-semibold transition',
                  on ? 'border-tk-primary bg-tk-primary-tint text-tk-primary-dark' : 'border-tk-line text-tk-ink hover:border-tk-primary-line'
                )}
              >
                {d.name}
              </button>
            );
          })}
        </div>
        {item.departmentSource === 'category' && item.department && (
          <p className="px-5 pb-2 text-[11.5px] text-tk-ink-5">ระบบเดาจากประเภทเรื่องว่าเป็น {item.department} — ยืนยันหรือเลือกใหม่</p>
        )}

        <div className="flex gap-2.5 border-t border-tk-line-light px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-[12px] px-4 py-2.5 text-[13.5px] font-semibold text-tk-ink-4 hover:bg-tk-bg">
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={!value || submitting}
            className="flex-1 rounded-[12px] bg-tk-ink-3 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-tk-ink-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'กำลังบันทึก…' : 'ยืนยันกอง'}
          </button>
        </div>
      </form>
      <button type="button" className="modal-backdrop" onClick={onClose} aria-label="ปิด" />
    </dialog>
  );
}

export default DepartmentPickerModal;
