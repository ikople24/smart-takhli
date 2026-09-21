// components/tasks/CoordinationSetModal.tsx
// modal ตั้ง/แก้ข้อมูลการประสานหน่วยงานภายนอก → POST /api/complaints/coordination { action: 'set' }
import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { CoordinationInfo } from '@/lib/tasks/types';

export interface CoordinationSetPayload {
  agencyName: string;
  documentNo: string;
  sentAt: string;
  nextFollowUpAt: string;
}

export interface CoordinationSetModalProps {
  open: boolean;
  initial: CoordinationInfo | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: CoordinationSetPayload) => void;
}

// หน่วยงานที่เทศบาลประสานบ่อย — พิมพ์เองได้
const AGENCY_SUGGESTIONS = [
  'การไฟฟ้าส่วนภูมิภาค สาขาตาคลี',
  'การประปาส่วนภูมิภาค',
  'แขวงทางหลวงนครสวรรค์ที่ 1',
  'แขวงทางหลวงชนบทนครสวรรค์',
  'องค์การบริหารส่วนจังหวัดนครสวรรค์',
  'สถานีตำรวจภูธรตาคลี',
  'บริษัท โทรคมนาคมแห่งชาติ จำกัด (มหาชน)',
  'กองสาธารณสุขและสิ่งแวดล้อม',
  'กองช่าง',
  'กองการประปา',
];

const FIELD = 'w-full rounded-[12px] border border-tk-line bg-tk-surface px-3.5 py-2.5 text-[13.5px] text-tk-ink outline-none transition focus:border-tk-coord focus:ring-2 focus:ring-tk-coord/20';
const LABEL = 'mb-1.5 block text-[12px] font-semibold text-tk-ink-4';
const toDateInput = (v: string | null | undefined) => (v ? v.slice(0, 10) : '');

export function CoordinationSetModal({ open, initial, submitting, onClose, onSubmit }: CoordinationSetModalProps) {
  const [agencyName, setAgencyName] = useState('');
  const [documentNo, setDocumentNo] = useState('');
  const [sentAt, setSentAt] = useState('');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');

  useEffect(() => {
    if (!open) return;
    setAgencyName(initial?.agencyName ?? '');
    setDocumentNo(initial?.documentNo ?? '');
    setSentAt(toDateInput(initial?.sentAt));
    setNextFollowUpAt(toDateInput(initial?.nextFollowUpAt));
  }, [open, initial]);

  if (!open) return null;
  const canSubmit = agencyName.trim().length > 0 && !submitting;

  return (
    <dialog className="modal modal-open font-tk-sans" aria-label="ประสานหน่วยงานภายนอก">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit({ agencyName: agencyName.trim(), documentNo: documentNo.trim(), sentAt, nextFollowUpAt });
        }}
        className="modal-box max-w-md rounded-[18px] bg-tk-surface p-0 text-tk-ink shadow-tk-xl"
      >
        <div className="flex items-center justify-between border-b border-tk-line-light px-5 py-4">
          <div>
            <h3 className="text-[16px] font-bold">{initial ? 'แก้ข้อมูลการประสานงาน' : 'ประสานหน่วยงานภายนอก'}</h3>
            <p className="text-[12px] text-tk-ink-5">หน่วยงานภายนอกเป็นผู้ดำเนินการ — เราเป็นผู้ประสานและติดตาม</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-tk-ink-5 hover:bg-tk-bg" aria-label="ปิด">
            <XMarkIcon className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <div className="flex flex-col gap-4 px-5 py-4">
          <div>
            <label className={LABEL} htmlFor="coord-agency">หน่วยงานผู้ดำเนินการ <span className="text-tk-overdue-ink">*</span></label>
            <input id="coord-agency" list="coord-agency-list" className={FIELD} value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="เช่น การไฟฟ้าส่วนภูมิภาค สาขาตาคลี" />
            <datalist id="coord-agency-list">
              {AGENCY_SUGGESTIONS.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={LABEL} htmlFor="coord-doc">หนังสือเลขที่</label>
            <input id="coord-doc" className={clsx(FIELD, 'font-tk-mono')} value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} placeholder="ทต.ตค 0417/2569" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="coord-sent">วันที่ส่งหนังสือ / แจ้ง</label>
              <input id="coord-sent" type="date" className={FIELD} value={sentAt} onChange={(e) => setSentAt(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="coord-next">ติดตามครั้งถัดไป</label>
              <input id="coord-next" type="date" className={FIELD} value={nextFollowUpAt} onChange={(e) => setNextFollowUpAt(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-2.5 border-t border-tk-line-light px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-[12px] px-4 py-2.5 text-[13.5px] font-semibold text-tk-ink-4 hover:bg-tk-bg">ยกเลิก</button>
          <button type="submit" disabled={!canSubmit} className="flex-1 rounded-[12px] bg-tk-coord py-2.5 text-[13.5px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? 'กำลังบันทึก…' : 'บันทึกการประสานงาน'}
          </button>
        </div>
      </form>
      <button type="button" className="modal-backdrop" onClick={onClose} aria-label="ปิด" />
    </dialog>
  );
}

export default CoordinationSetModal;
