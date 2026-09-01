// components/tasks/TransferTaskModal.tsx
// modal "โอน / ส่งต่องาน" (README หน้าจอ 1): เลือกงาน → เลือกเจ้าหน้าที่ปลายทาง → เหตุผล (บังคับ) → POST /api/complaints/assignments/transfer
import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { OfficerTask } from '@/lib/tasks/types';

export interface OfficerOption {
  _id: string;
  name?: string;
  position?: string;
  department?: string;
  isActive?: boolean;
}

export interface TransferPayload {
  assignmentId: string;
  toUserId: string;
  reason: string;
}

export interface TransferTaskModalProps {
  open: boolean;
  tasks: OfficerTask[];
  initialTaskId?: string | null;
  officers: OfficerOption[];
  officersLoading?: boolean;
  /** _id ของเจ้าหน้าที่ที่ล็อกอิน — ตัดออกจากรายชื่อปลายทาง */
  selfId: string;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: TransferPayload) => void;
}

const FIELD = 'w-full rounded-[12px] border border-tk-line bg-tk-surface px-3.5 py-2.5 text-[13.5px] text-tk-ink outline-none transition focus:border-tk-primary focus:ring-2 focus:ring-tk-primary/20';
const LABEL = 'mb-1.5 block text-[12px] font-semibold text-tk-ink-4';

export function TransferTaskModal({ open, tasks, initialTaskId, officers, officersLoading, selfId, submitting, onClose, onSubmit }: TransferTaskModalProps) {
  const [assignmentId, setAssignmentId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAssignmentId(initialTaskId ?? tasks[0]?._id ?? '');
    setToUserId('');
    setReason('');
    setTouched(false);
  }, [open, initialTaskId, tasks]);

  // รายชื่อปลายทางจัดกลุ่มตามกอง — ตัดตัวเอง/คนที่ถูกระงับออก
  const groups = useMemo(() => {
    const map = new Map<string, OfficerOption[]>();
    for (const o of officers) {
      if (o._id === selfId || o.isActive === false) continue;
      const key = o.department?.trim() || 'ไม่ระบุกอง';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'th'));
  }, [officers, selfId]);

  if (!open) return null;

  const reasonOk = reason.trim().length > 0;
  const canSubmit = !!assignmentId && !!toUserId && reasonOk && !submitting;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onSubmit({ assignmentId, toUserId, reason: reason.trim() });
  };

  return (
    <dialog className="modal modal-open font-tk-sans" aria-label="โอน / ส่งต่องาน">
      <form onSubmit={submit} className="modal-box max-w-md rounded-[18px] bg-tk-surface p-0 text-tk-ink shadow-tk-xl">
        <div className="flex items-center justify-between border-b border-tk-line-light px-5 py-4">
          <div>
            <h3 className="text-[16px] font-bold">โอน / ส่งต่องาน</h3>
            <p className="text-[12px] text-tk-ink-5">งานจะย้ายไปอยู่ในกลุ่มงานของผู้รับทันที และบันทึกลงประวัติ</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-tk-ink-5 hover:bg-tk-bg" aria-label="ปิด">
            <XMarkIcon className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div>
            <label className={LABEL} htmlFor="transfer-task">งานที่จะโอน</label>
            <select id="transfer-task" className={FIELD} value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>
              {tasks.length === 0 && <option value="">— ไม่มีงานที่โอนได้ —</option>}
              {tasks.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.code ? `${t.code} · ` : ''}{t.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL} htmlFor="transfer-to">โอนให้</label>
            <select id="transfer-to" className={FIELD} value={toUserId} onChange={(e) => setToUserId(e.target.value)} disabled={officersLoading}>
              <option value="">{officersLoading ? 'กำลังโหลดรายชื่อ…' : '— เลือกเจ้าหน้าที่ —'}</option>
              {groups.map(([dept, list]) => (
                <optgroup key={dept} label={dept}>
                  {list.map((o) => (
                    <option key={o._id} value={o._id}>
                      {o.name || '(ไม่ระบุชื่อ)'}{o.position ? ` · ${o.position}` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {touched && !toUserId && <p className="mt-1 text-[11.5px] text-tk-overdue-ink">เลือกเจ้าหน้าที่ปลายทาง</p>}
          </div>

          <div>
            <label className={LABEL} htmlFor="transfer-reason">เหตุผลการโอน <span className="text-tk-overdue-ink">*</span></label>
            <textarea
              id="transfer-reason"
              className={clsx(FIELD, 'min-h-[78px] resize-y')}
              placeholder="เช่น อยู่นอกเขตรับผิดชอบของงานไฟฟ้า / ลาป่วยสัปดาห์นี้ / ต้องใช้ช่างเฉพาะทาง"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {touched && !reasonOk && <p className="mt-1 text-[11.5px] text-tk-overdue-ink">ต้องระบุเหตุผล — จะบันทึกลงประวัติของเรื่อง</p>}
          </div>
        </div>

        <div className="flex gap-2.5 border-t border-tk-line-light px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-[12px] px-4 py-2.5 text-[13.5px] font-semibold text-tk-ink-4 hover:bg-tk-bg">
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 rounded-[12px] bg-tk-primary py-2.5 text-[13.5px] font-semibold text-white shadow-tk-purple transition hover:bg-tk-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'กำลังโอน…' : 'โอนงาน'}
          </button>
        </div>
      </form>
      <button type="button" className="modal-backdrop" onClick={onClose} aria-label="ปิด" />
    </dialog>
  );
}

export default TransferTaskModal;
