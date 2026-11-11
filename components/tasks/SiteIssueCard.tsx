// components/tasks/SiteIssueCard.tsx
// "แจ้งปัญหาหน้างาน" (มติประชุม 2026-11 — lib/tasks/siteIssue.js): ลงพื้นที่แล้วพบว่าเทศบาลทำไม่ได้ เช่น ต้นไม้อยู่ในบ้านผู้แจ้ง
// ส่งแล้วระบบพัก SLA + แจ้งหัวหน้ากอง/superadmin (PATCH /api/tasks/[assignmentId] action: site_issue)
// ฟอร์มแบบ inline เหมือน BlockedCard · ภาพใช้ ImageUploads ตัวเดียวกับบันทึกความคืบหน้า
import React, { useState } from 'react';
import ImageUploads from '@/components/ImageUploads';
import type { SiteIssueReason } from '@/lib/tasks/types';

export interface SiteIssuePayload {
  reasonCode: string;
  note: string;
  images: string[];
}

export interface SiteIssueCardProps {
  reasons: SiteIssueReason[];
  submitting?: boolean;
  onSubmit: (payload: SiteIssuePayload) => void;
}

const FIELD = 'w-full rounded-[10px] border border-tk-line bg-tk-surface px-3 py-2 text-[13px] text-tk-ink outline-none transition focus:border-tk-primary';
const NOTE_MAX = 500;
const MAX_IMAGES = 5;

export function SiteIssueCard({ reasons, submitting, onSubmit }: SiteIssueCardProps) {
  const [open, setOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const noteRequired = reasonCode === 'other';
  const reset = () => {
    setOpen(false);
    setReasonCode('');
    setNote('');
    setImages([]);
  };

  return (
    <section className="rounded-[15px] border border-tk-line px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13.5px] font-bold text-tk-ink">พบปัญหาหน้างาน</div>
        {!open && (
          <button
            type="button"
            disabled={submitting}
            onClick={() => setOpen(true)}
            className="rounded-[9px] bg-tk-blocked-soft px-3 py-1.5 text-[12px] font-semibold text-tk-blocked-ink hover:brightness-95 disabled:opacity-60"
          >
            แจ้งปัญหาหน้างาน
          </button>
        )}
      </div>
      <p className="mt-1 text-[12px] text-tk-ink-5">
        ลงพื้นที่แล้วพบว่าดำเนินการไม่ได้ เช่น อยู่ในพื้นที่ส่วนบุคคล — ระบบจะพักนับ SLA และแจ้งหัวหน้ากองให้พิจารณา (ดำเนินการต่อ หรือปิดเรื่อง)
      </p>

      {open && (
        <form
          className="mt-3 flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reasonCode || (noteRequired && !note.trim()) || uploading) return;
            onSubmit({ reasonCode, note: note.trim(), images });
          }}
        >
          <select className={FIELD} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} required aria-label="เหตุผลที่พบหน้างาน">
            <option value="" disabled>
              เลือกเหตุผล…
            </option>
            {reasons.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
          <textarea
            className={`${FIELD} min-h-[70px] resize-y`}
            value={note}
            maxLength={NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            required={noteRequired}
            aria-label="รายละเอียดปัญหาที่พบ"
            placeholder={noteRequired ? 'อธิบายปัญหาที่พบ (จำเป็น)' : 'รายละเอียดเพิ่มเติม เช่น ต้นมะม่วงอยู่ในรั้วบ้านผู้แจ้ง กิ่งพาดสายไฟ'}
          />
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-tk-ink-4">ภาพหน้างาน (ไม่บังคับ สูงสุด {MAX_IMAGES} ภาพ)</span>
            <ImageUploads maxImages={MAX_IMAGES} initialImages={[]} onChange={(urls: string[]) => setImages(urls)} onUploadingChange={setUploading} />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || uploading || !reasonCode || (noteRequired && !note.trim())}
              className="flex-1 rounded-[10px] bg-tk-primary py-2 text-[12.5px] font-semibold text-white hover:bg-tk-primary-dark disabled:opacity-60"
            >
              {uploading ? 'กำลังอัปโหลดภาพ…' : submitting ? 'กำลังบันทึก…' : 'ส่งแจ้งหัวหน้า + พักงาน'}
            </button>
            <button type="button" onClick={reset} className="rounded-[10px] px-3 py-2 text-[12.5px] font-semibold text-tk-ink-4 hover:bg-tk-bg">
              ยกเลิก
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default SiteIssueCard;
