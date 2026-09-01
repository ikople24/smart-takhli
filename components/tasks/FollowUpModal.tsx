// components/tasks/FollowUpModal.tsx
// modal "บันทึกการติดตาม" (README: วันที่ติดตาม / ช่องทาง / ผลการติดตาม / วันติดตามครั้งถัดไป)
// → POST /api/complaints/coordination { action: 'follow_up' }
import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { XMarkIcon } from '@heroicons/react/24/outline';

export type FollowUpChannel = 'phone' | 'document' | 'line' | 'site' | 'other';

export interface FollowUpPayload {
  assignmentId: string;
  channel: FollowUpChannel;
  note: string;
  /** ISO date (YYYY-MM-DD) หรือ '' = ให้ระบบตั้งตามรอบ */
  nextFollowUpAt: string;
}

export interface FollowUpModalProps {
  open: boolean;
  agencyName: string;
  tasks: Array<{ _id: string; code: string | null; title: string }>;
  followUpEveryDays: number;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: FollowUpPayload) => void;
}

const CHANNELS: Array<{ key: FollowUpChannel; label: string }> = [
  { key: 'phone', label: 'โทรศัพท์' },
  { key: 'document', label: 'หนังสือ' },
  { key: 'line', label: 'LINE' },
  { key: 'site', label: 'ลงพื้นที่' },
  { key: 'other', label: 'อื่น ๆ' },
];

const FIELD = 'w-full rounded-[12px] border border-tk-line bg-tk-surface px-3.5 py-2.5 text-[13.5px] text-tk-ink outline-none transition focus:border-tk-coord focus:ring-2 focus:ring-tk-coord/20';
const LABEL = 'mb-1.5 block text-[12px] font-semibold text-tk-ink-4';

export function FollowUpModal({ open, agencyName, tasks, followUpEveryDays, submitting, onClose, onSubmit }: FollowUpModalProps) {
  const [assignmentId, setAssignmentId] = useState('');
  const [channel, setChannel] = useState<FollowUpChannel>('phone');
  const [note, setNote] = useState('');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');

  useEffect(() => {
    if (!open) return;
    setAssignmentId(tasks[0]?._id ?? '');
    setChannel('phone');
    setNote('');
    setNextFollowUpAt('');
  }, [open, tasks]);

  if (!open) return null;

  const canSubmit = !!assignmentId && !submitting;

  return (
    <dialog className="modal modal-open font-tk-sans" aria-label="บันทึกการติดตาม">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit({ assignmentId, channel, note: note.trim(), nextFollowUpAt });
        }}
        className="modal-box max-w-md rounded-[18px] bg-tk-surface p-0 text-tk-ink shadow-tk-xl"
      >
        <div className="flex items-center justify-between border-b border-tk-line-light px-5 py-4">
          <div>
            <h3 className="text-[16px] font-bold">บันทึกการติดตาม</h3>
            <p className="text-[12px] text-tk-ink-5">ประสาน {agencyName}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-tk-ink-5 hover:bg-tk-bg" aria-label="ปิด">
            <XMarkIcon className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          {tasks.length > 1 && (
            <div>
              <label className={LABEL} htmlFor="followup-task">เรื่อง</label>
              <select id="followup-task" className={FIELD} value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>
                {tasks.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.code ? `${t.code} · ` : ''}{t.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <span className={LABEL}>ช่องทางที่ติดตาม</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="ช่องทาง">
              {CHANNELS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  role="radio"
                  aria-checked={channel === c.key}
                  onClick={() => setChannel(c.key)}
                  className={clsx(
                    'rounded-full px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition',
                    channel === c.key ? 'bg-tk-coord text-white' : 'bg-tk-bg text-tk-ink-4 hover:bg-tk-line-light'
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="followup-note">ผลการติดตาม</label>
            <textarea
              id="followup-note"
              className={clsx(FIELD, 'min-h-[78px] resize-y')}
              placeholder="โทรติดตาม กฟภ. สาขาตาคลี คุณ… รับสายแจ้งว่าจะเข้าตัดกิ่งไม้วันที่…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div>
            <label className={LABEL} htmlFor="followup-next">ติดตามครั้งถัดไป</label>
            <input id="followup-next" type="date" className={FIELD} value={nextFollowUpAt} onChange={(e) => setNextFollowUpAt(e.target.value)} />
            <p className="mt-1 text-[11.5px] text-tk-ink-5">เว้นว่าง = ระบบตั้งให้อีก {followUpEveryDays} วัน</p>
          </div>
        </div>

        <div className="flex gap-2.5 border-t border-tk-line-light px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-[12px] px-4 py-2.5 text-[13.5px] font-semibold text-tk-ink-4 hover:bg-tk-bg">
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 rounded-[12px] bg-tk-coord py-2.5 text-[13.5px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'กำลังบันทึก…' : 'บันทึกการติดตาม'}
          </button>
        </div>
      </form>
      <button type="button" className="modal-backdrop" onClick={onClose} aria-label="ปิด" />
    </dialog>
  );
}

export default FollowUpModal;
