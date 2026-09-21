// components/tasks/BlockedCard.tsx
// การ์ด "พักงาน — รอวัสดุ / งบประมาณ" (README หน้าจอ 3): toggle → ฟิลด์ รายการวัสดุ / เลขที่เสนอจัดซื้อ / วันที่คาดว่าจะได้รับ
// เปิดแล้วระบบพักนับ SLA (PATCH /api/tasks/[assignmentId] action: blocked)
import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import type { BlockedInfo } from '@/lib/tasks/types';
import { formatThaiDate } from '@/lib/tasks/format';

export interface BlockedPayload {
  on: boolean;
  itemName?: string;
  purchaseRefNo?: string;
  expectedAt?: string;
  reason?: string;
}

export interface BlockedCardProps {
  blocked: BlockedInfo | null;
  followUpEveryDays: number;
  disabled?: boolean;
  submitting?: boolean;
  onToggle: (payload: BlockedPayload) => void;
}

const FIELD = 'w-full rounded-[10px] border border-tk-line bg-tk-surface px-3 py-2 text-[13px] text-tk-ink outline-none transition focus:border-tk-primary';

export function BlockedCard({ blocked, followUpEveryDays, disabled, submitting, onToggle }: BlockedCardProps) {
  const active = !!blocked?.isBlocked;
  const [draftOpen, setDraftOpen] = useState(false);
  const [itemName, setItemName] = useState('');
  const [purchaseRefNo, setPurchaseRefNo] = useState('');
  const [expectedAt, setExpectedAt] = useState('');

  useEffect(() => {
    // เมื่อสถานะจากเซิร์ฟเวอร์เปลี่ยน (บันทึกแล้ว) ปิดฟอร์มร่าง
    setDraftOpen(false);
    setItemName('');
    setPurchaseRefNo('');
    setExpectedAt('');
  }, [active]);

  const checked = active || draftOpen;

  return (
    <section className="rounded-[15px] border border-tk-line px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13.5px] font-bold text-tk-ink">พักงาน — รอวัสดุ / งบประมาณ</div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled || submitting}
          onClick={() => (active ? onToggle({ on: false }) : setDraftOpen((v) => !v))}
          className={clsx('relative h-[22px] w-[38px] shrink-0 rounded-full transition disabled:opacity-50', checked ? 'bg-tk-primary' : 'bg-tk-line-dashed')}
        >
          <span className={clsx('absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition', checked ? 'left-[18px]' : 'left-[2px]')} />
        </button>
      </div>
      <p className="mt-1 text-[12px] text-tk-ink-5">เปิดเมื่อรอโคมไฟ/อุปกรณ์หรืองบประมาณ — ระบบจะพักนับ SLA และเตือนติดตามทุก {followUpEveryDays} วัน</p>

      {active && blocked && (
        <div className="mt-3 rounded-[12px] border border-tk-blocked-line bg-tk-primary-tint-3 px-3 py-2.5 text-[12.5px]">
          <div className="font-semibold text-tk-blocked-ink">{blocked.itemName || blocked.reason || 'พักงานอยู่'}</div>
          <div className="mt-0.5 text-tk-ink-4">
            {blocked.purchaseRefNo && <>เสนอจัดซื้อ {blocked.purchaseRefNo} · </>}
            {blocked.since && <>พักตั้งแต่ {formatThaiDate(blocked.since)} · </>}
            {blocked.expectedAt ? <>คาดได้รับ {formatThaiDate(blocked.expectedAt)}</> : 'ยังไม่ระบุวันคาดรับ'}
          </div>
          {!disabled && (
            <button type="button" disabled={submitting} onClick={() => onToggle({ on: false })} className="mt-2 rounded-[9px] bg-tk-primary-tint px-3 py-1.5 text-[12px] font-semibold text-tk-primary-dark hover:bg-tk-primary-line-2 disabled:opacity-60">
              กลับมาดำเนินการต่อ (เลิกพัก SLA)
            </button>
          )}
        </div>
      )}

      {!active && draftOpen && (
        <form
          className="mt-3 flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            onToggle({ on: true, itemName: itemName.trim(), purchaseRefNo: purchaseRefNo.trim(), expectedAt });
          }}
        >
          <input className={FIELD} placeholder="รายการวัสดุ / งบประมาณที่รอ เช่น โคมไฟ LED 24 ชุด" value={itemName} onChange={(e) => setItemName(e.target.value)} required aria-label="รายการวัสดุ" />
          <div className="grid grid-cols-2 gap-2.5">
            <input className={FIELD} placeholder="เลขที่เสนอจัดซื้อ" value={purchaseRefNo} onChange={(e) => setPurchaseRefNo(e.target.value)} aria-label="เลขที่เสนอจัดซื้อ" />
            <input className={FIELD} type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} aria-label="วันที่คาดว่าจะได้รับ" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="flex-1 rounded-[10px] bg-tk-primary py-2 text-[12.5px] font-semibold text-white hover:bg-tk-primary-dark disabled:opacity-60">
              {submitting ? 'กำลังบันทึก…' : 'บันทึกการพักงาน'}
            </button>
            <button type="button" onClick={() => setDraftOpen(false)} className="rounded-[10px] px-3 py-2 text-[12.5px] font-semibold text-tk-ink-4 hover:bg-tk-bg">
              ยกเลิก
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default BlockedCard;
