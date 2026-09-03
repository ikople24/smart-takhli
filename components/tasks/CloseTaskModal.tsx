// components/tasks/CloseTaskModal.tsx
// modal "ปิดเรื่อง" (README หน้าจอ 3): ต้องมี ≥1 ภาพผลงาน + บันทึกสรุป · เลือกวิธีแก้ไขจาก AdminOption ของประเภทเรื่อง
// → PATCH /api/tasks/[assignmentId] { action: 'close' } (เซิร์ฟเวอร์เช็ค closeChecklist ซ้ำอีกชั้น)
import React, { useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import ImageUploads from '@/components/ImageUploads';
import type { SolutionOption } from '@/lib/tasks/types';
import { closeChecklist } from '@/lib/tasks/timeline';
import { SolutionChips } from './SolutionChips';

export interface ClosePayload {
  note: string;
  images: string[];
  solution: string[];
}

export interface CloseTaskModalProps {
  open: boolean;
  options: SolutionOption[];
  /** วิธีแก้ไขที่เลือกไว้แล้วระหว่างดำเนินงาน — prefill */
  initialSolution?: string[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: ClosePayload) => void;
}

export function CloseTaskModal({ open, options, initialSolution = [], submitting, onClose, onSubmit }: CloseTaskModalProps) {
  const [note, setNote] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [solution, setSolution] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [uploaderKey, setUploaderKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setNote('');
    setImages([]);
    setSolution(initialSolution);
    setTouched(false);
    setUploaderKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const check = closeChecklist({ note, images }) as { ok: boolean; errors: string[] };
  const canSubmit = check.ok && !submitting && !uploading;

  return (
    <dialog className="modal modal-open font-tk-sans" aria-label="ปิดเรื่อง">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (canSubmit) onSubmit({ note: note.trim(), images, solution });
        }}
        className="modal-box max-w-lg rounded-[18px] bg-tk-surface p-0 text-tk-ink shadow-tk-xl"
      >
        <div className="flex items-center justify-between border-b border-tk-line-light px-5 py-4">
          <div>
            <h3 className="text-[16px] font-bold">ปิดเรื่อง</h3>
            <p className="text-[12px] text-tk-ink-5">ระบบจะแจ้งผู้แจ้ง (LINE ถ้าผูกไว้) พร้อมส่งลิงก์ประเมินความพึงพอใจ และแจ้งกลุ่มเจ้าหน้าที่</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-tk-ink-5 hover:bg-tk-bg" aria-label="ปิด">
            <XMarkIcon className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          {(options.length > 0 || solution.length > 0) && (
            <div>
              <span className="mb-1.5 block text-[12px] font-semibold text-tk-ink-4">วิธีการแก้ไข (เลือกได้หลายข้อ)</span>
              <SolutionChips options={options} value={solution} onChange={setSolution} tone="done" />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-tk-ink-4" htmlFor="close-note">บันทึกสรุปการดำเนินงาน <span className="text-tk-overdue-ink">*</span></label>
            <textarea id="close-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[90px] w-full resize-y rounded-[12px] border border-tk-line bg-tk-surface px-3.5 py-2.5 text-[13.5px] text-tk-ink outline-none focus:border-tk-done focus:ring-2 focus:ring-tk-done/20" placeholder="สรุปสิ่งที่ทำ ผลที่ได้ และข้อแนะนำต่อผู้แจ้ง (ข้อความนี้จะปรากฏในการ์ดแจ้งผู้แจ้ง)" />
          </div>

          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-tk-ink-4">ภาพผลการดำเนินงาน <span className="text-tk-overdue-ink">*</span> (อย่างน้อย 1 ภาพ)</span>
            <ImageUploads key={uploaderKey} maxImages={3} initialImages={[]} onChange={(urls: string[]) => setImages(urls)} onUploadingChange={setUploading} />
          </div>

          {touched && !check.ok && (
            <ul className="rounded-[10px] bg-tk-overdue-soft px-3 py-2 text-[12.5px] text-tk-overdue-ink">
              {check.errors.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2.5 border-t border-tk-line-light px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-[12px] px-4 py-2.5 text-[13.5px] font-semibold text-tk-ink-4 hover:bg-tk-bg">ยกเลิก</button>
          <button type="submit" disabled={submitting || uploading} className="flex-1 rounded-[12px] bg-tk-done py-2.5 text-[13.5px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">
            {uploading ? 'กำลังอัปโหลดภาพ…' : submitting ? 'กำลังปิดเรื่อง…' : 'ยืนยันปิดเรื่อง'}
          </button>
        </div>
      </form>
      <button type="button" className="modal-backdrop" onClick={onClose} aria-label="ปิด" />
    </dialog>
  );
}

export default CloseTaskModal;
