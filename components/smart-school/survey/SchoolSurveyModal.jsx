import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { z } from 'zod';
import IdentityStep from './IdentityStep';
import InfoStep from './InfoStep';
import MediaStep from './MediaStep';
import {
  StepHeader,
  primaryBtnCls,
  successBtnCls,
  ghostBtnCls,
  FONT_BODY,
  FONT_DISPLAY,
} from './surveyTheme';

const EMPTY_FORM = {
  educationLevel: '',
  prefix: '',
  fullName: '',
  address: '',
  phone: '',
  note: '',
  image: [],
  housingStatus: 'ไม่ระบุ',
  householdMembers: 1,
  annualIncome: '',
  schoolName: '',
  residencyOverOneYear: null,
  gradeLevel: '',
  gpa: '',
  actualAddress: '',
  familyStatus: [],
  incomeSourceText: '',
  receivedScholarshipText: '',
  takhliScholarshipHistoryText: '',
};

const surveySchema = z.object({
  educationLevel: z.string().min(1, 'กรุณาเลือกระดับการศึกษา'),
  prefix: z.string().min(1, 'กรุณาเลือกคำนำหน้า'),
  fullName: z.string().min(2, 'ชื่อ-นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร'),
  address: z.string().min(10, 'ที่อยู่ต้องมีอย่างน้อย 10 ตัวอักษร'),
  phone: z.string().length(10, 'เบอร์โทรศัพท์ต้องมี 10 หลัก'),
  image: z.array(z.string()).min(1, 'กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป'),
  location: z.object({ lat: z.number(), lng: z.number() })
    .nullable()
    .refine((val) => val !== null, 'กรุณาเลือกตำแหน่งที่ตั้ง'),
  annualIncome: z.string().refine((val) => {
    const num = parseInt(val);
    return !isNaN(num) && num >= 0;
  }, 'รายได้ต้องเป็นตัวเลขและไม่ติดลบ'),
});

const fmtBaht = (v) => {
  const n = parseInt(v);
  return isNaN(n) ? '—' : n.toLocaleString('th-TH');
};
const fmtPhone = (p) => (p && p.length === 10 ? `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}` : p || '—');

function SummaryRow({ label, value, valueClass = 'text-[#211B2E]' }) {
  return (
    <div className="flex justify-between gap-3 text-[12px]">
      <span className="shrink-0 text-[#8A8398]">{label}</span>
      <span className={'text-right font-semibold ' + valueClass}>{value}</span>
    </div>
  );
}

// แบบฟอร์มสำรวจการศึกษา — ม่วง/ครีม, wizard: ระบุตัวตน → ข้อมูล → รูป/พิกัด → ตรวจสอบ → สำเร็จ
export default function SchoolSurveyModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1);
  const [review, setReview] = useState(false);
  const [success, setSuccess] = useState(null); // { applicationId, isRenewal }
  const [identity, setIdentity] = useState(null); // { ref, applicant, prevApplication }
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [useCurrent, setUseCurrent] = useState(false);
  const [fullMode, setFullMode] = useState(false); // ติ๊ก "กรอกแบบเต็ม" — เก็บที่นี่ให้ค้างข้ามสเต็ป
  const [location, setLocation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [blockedSchools, setBlockedSchools] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/smart-school/blocked-schools/public')
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => setBlockedSchools(d.items || []))
        .catch(() => {});
    }
  }, [isOpen]);

  // ซ่อน BottomNav + ล็อกสกรอลล์พื้นหลังขณะฟอร์มเปิด (กันกดปุ่ม nav โดนแล้วเด้งออกกลางฟอร์ม)
  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.classList.add('survey-form-open');
    return () => document.body.classList.remove('survey-form-open');
  }, [isOpen]);

  const reset = () => {
    setStep(1);
    setReview(false);
    setSuccess(null);
    setIdentity(null);
    setFormData(EMPTY_FORM);
    setUseCurrent(false);
    setFullMode(false);
    setLocation(null);
    setUploading(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
    reset();
  };

  const handleIdentityDone = ({ ref, applicant, prevApplication }) => {
    setIdentity({ ref, applicant, prevApplication });
    if (applicant) {
      const prev = prevApplication || {};
      setFormData({
        ...EMPTY_FORM,
        educationLevel: prev.educationLevel || '',
        prefix: applicant.prefix || '',
        fullName: applicant.name || '',
        address: prev.address || '',
        phone: applicant.phone || '',
        note: prev.note || '',
        housingStatus: prev.housingStatus || 'ไม่ระบุ',
        householdMembers: prev.householdMembers || 1,
        annualIncome: prev.annualIncome != null ? String(prev.annualIncome) : '',
        schoolName: prev.schoolName || '',
        residencyOverOneYear: prev.residencyOverOneYear ?? null,
        image: Array.isArray(prev.imageUrl) ? prev.imageUrl : [],
        gradeLevel: prev.gradeLevel || '',
        gpa: prev.gpa != null ? String(prev.gpa) : '',
        actualAddress: prev.actualAddress || '',
        familyStatus: Array.isArray(prev.familyStatus) ? prev.familyStatus : [],
        incomeSourceText: (prev.incomeSource || []).join(', '),
        receivedScholarshipText: (prev.receivedScholarship || []).join(', '),
        takhliScholarshipHistoryText: (prev.takhliScholarshipHistory || []).join(', '),
      });
      if (prev.location?.lat) setLocation({ lat: prev.location.lat, lng: prev.location.lng });
    }
    setStep(2);
  };

  const goToMedia = () => {
    const partial = surveySchema.pick({
      educationLevel: true, prefix: true, fullName: true, address: true, phone: true, annualIncome: true,
    }).safeParse(formData);
    if (!partial.success) {
      const messages = partial.error.errors.map((e, i) => `${i + 1}. ${e.message}`).join('\n');
      Swal.fire({ icon: 'warning', title: 'กรอกข้อมูลขั้นนี้ให้ครบก่อน', text: messages, confirmButtonText: 'ตกลง' });
      return;
    }
    setStep(3);
  };

  const goToReview = () => {
    const result = surveySchema.safeParse({ ...formData, location });
    if (!result.success) {
      const messages = result.error.errors.map((err, i) => `${i + 1}. ${err.message}`).join('\n');
      Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบถ้วน', text: messages, confirmButtonText: 'ตกลง' });
      return;
    }
    setReview(true);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const result = surveySchema.safeParse({ ...formData, location });
    if (!result.success) {
      const messages = result.error.errors.map((err, i) => `${i + 1}. ${err.message}`).join('\n');
      Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบถ้วน', text: messages, confirmButtonText: 'ตกลง' });
      setReview(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/smart-school/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          ref: identity?.ref,
          schoolName: formData.schoolName,
          residencyOverOneYear: formData.residencyOverOneYear,
          householdMembers: parseInt(formData.householdMembers) || 1,
          annualIncome: parseInt(formData.annualIncome) || 0,
          gpa: formData.gpa === '' ? null : parseFloat(formData.gpa),
          incomeSource: formData.incomeSourceText.split(',').map((x) => x.trim()).filter(Boolean),
          receivedScholarship: formData.receivedScholarshipText.split(',').map((x) => x.trim()).filter(Boolean),
          takhliScholarshipHistory: formData.takhliScholarshipHistoryText.split(',').map((x) => x.trim()).filter(Boolean),
          location,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess({ applicationId: data.applicationId, isRenewal: !!data.isRenewal });
      } else {
        const errData = await res.json().catch(() => ({}));
        Swal.fire({ icon: 'error', title: 'ไม่สามารถส่งข้อมูลได้', text: errData.message });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาดขณะส่งข้อมูล' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const prevYear = identity?.prevApplication?.surveyYear;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-stretch justify-center p-0 sm:items-center sm:p-4"
      style={{ background: 'rgba(33,27,46,.62)' }}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col overflow-hidden bg-[#FAF8FF]
          shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)] sm:h-auto sm:max-h-[90vh] sm:max-w-[420px] sm:rounded-[28px]"
        style={{
          fontFamily: FONT_BODY,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* ---------- สำเร็จ ---------- */}
        {success ? (
          <div className="flex flex-1 flex-col items-center justify-center px-7 py-10 text-center">
            <div className="mb-5 grid h-[88px] w-[88px] place-items-center rounded-full bg-[#DCFCE7] text-[44px]">
              ✅
            </div>
            <div className="text-[20px] font-bold text-[#211B2E]" style={{ fontFamily: FONT_DISPLAY }}>
              ส่งข้อมูลสำเร็จ
            </div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-[#8A8398]">
              รับเรื่องของ
              <br />
              <b className="text-[#211B2E]">{[formData.prefix, formData.fullName].filter(Boolean).join(' ')}</b>
              <br />
              เจ้าหน้าที่จะตรวจสอบและติดต่อกลับ
            </p>
            <div className="mt-5 rounded-[14px] bg-[#F1ECFB] px-5 py-3">
              <div className="text-[11px] text-[#8A8398]">เลขที่คำร้อง</div>
              <div className="text-[18px] font-bold tracking-wide text-[#7C3AED]" style={{ fontFamily: FONT_DISPLAY }}>
                {success.applicationId}
                {success.isRenewal ? ' · อัปเดตรายเก่า' : ''}
              </div>
            </div>
            <button type="button" onClick={reset} className={primaryBtnCls + ' mt-7'}>
              ⟳ กรอกรายใหม่
            </button>
            <button type="button" onClick={handleClose} className="mt-3 text-[12px] font-semibold text-[#8A8398] hover:text-[#57506A]">
              ปิดหน้าต่าง
            </button>
          </div>
        ) : step === 1 ? (
          /* ---------- ระบุตัวตน ---------- */
          <IdentityStep onDone={handleIdentityDone} onClose={handleClose} disabled={isSubmitting} />
        ) : step === 2 ? (
          /* ---------- ข้อมูลผู้ขอทุน ---------- */
          <>
            <StepHeader
              title="ข้อมูลผู้ขอทุน"
              step={2}
              subtitle="ขั้นที่ 2 จาก 3 · ข้อมูล"
              onBack={() => setStep(1)}
              onClose={handleClose}
            />
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {identity?.applicant && (
                <div className="mb-3.5 flex items-center gap-2 rounded-[12px] bg-[#DCFCE7] px-3 py-2.5 text-[11.5px] text-[#15803D]">
                  <span>↻</span>
                  ดึงข้อมูลปีงบ {prevYear || '-'} มาแล้ว · แก้เฉพาะที่เปลี่ยน
                </div>
              )}
              <InfoStep
                formData={formData}
                setFormData={setFormData}
                prevApplication={identity?.prevApplication}
                prevYear={prevYear}
                disabled={isSubmitting}
                blockedSchools={blockedSchools}
                fullMode={fullMode}
                setFullMode={setFullMode}
              />
            </div>
            <div className="flex shrink-0 gap-2.5 px-5 pb-5 pt-3">
              <button type="button" className={ghostBtnCls} onClick={() => setStep(1)}>กลับ</button>
              <button type="button" className={primaryBtnCls + ' flex-1'} onClick={goToMedia}>ถัดไป →</button>
            </div>
          </>
        ) : review ? (
          /* ---------- ตรวจสอบก่อนส่ง ---------- */
          <>
            <StepHeader
              title="ตรวจสอบความเรียบร้อย"
              subtitle="แตะ “แก้ไข” ถ้าต้องการปรับก่อนส่ง"
              onBack={() => setReview(false)}
              onClose={handleClose}
            />
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              <div className="overflow-hidden rounded-[16px] border-[1.5px] border-[#E7E2F2] bg-white">
                <div className="flex items-center justify-between bg-[#F6F3FD] px-3.5 py-2.5">
                  <span className="text-[12px] font-bold text-[#7C3AED]">ข้อมูลผู้ขอทุน</span>
                  <button type="button" onClick={() => { setReview(false); setStep(2); }} className="text-[11px] font-semibold text-[#7C3AED] hover:underline">
                    ✎ แก้ไข
                  </button>
                </div>
                <div className="flex flex-col gap-2.5 px-3.5 py-3">
                  <SummaryRow label="ระดับ" value={formData.educationLevel || '—'} />
                  <SummaryRow label="ชื่อ-สกุล" value={[formData.prefix, formData.fullName].filter(Boolean).join(' ') || '—'} />
                  <SummaryRow label="ที่อยู่" value={formData.address || '—'} />
                  <SummaryRow label="เบอร์โทร" value={fmtPhone(formData.phone)} />
                  <SummaryRow label="สถานภาพที่อยู่" value={formData.housingStatus} />
                  <SummaryRow label="สมาชิกในบ้าน" value={`${parseInt(formData.householdMembers) || 1} คน`} />
                  <SummaryRow label="รายได้ทั้งปี" value={`${fmtBaht(formData.annualIncome)} บาท`} />
                  <SummaryRow label="สถานศึกษา" value={formData.schoolName || '—'} />
                  <SummaryRow
                    label="ทะเบียนบ้าน >1 ปี"
                    value={formData.residencyOverOneYear ? 'ใช่' : 'ไม่ใช่/ไม่แน่ใจ'}
                    valueClass={formData.residencyOverOneYear ? 'text-[#16A34A]' : 'text-[#57506A]'}
                  />
                  {/* ฟิลด์โหมดเต็ม — โชว์เมื่อติ๊กโหมดเต็ม หรือเมื่อมีค่า (รายเก่า prefill มาก็ถูกส่งไปด้วย ต้องได้ทวน) */}
                  {(fullMode || formData.gradeLevel) && (
                    <SummaryRow label="ระดับชั้น" value={formData.gradeLevel || '—'} />
                  )}
                  {(fullMode || formData.gpa !== '') && (
                    <SummaryRow label="เกรดเฉลี่ย" value={formData.gpa === '' ? '—' : formData.gpa} />
                  )}
                  {(fullMode || formData.actualAddress) && (
                    <SummaryRow label="ที่อยู่จริง" value={formData.actualAddress || '—'} />
                  )}
                  {(fullMode || (formData.familyStatus || []).length > 0) && (
                    <SummaryRow label="สถานะครอบครัว" value={(formData.familyStatus || []).join(', ') || '—'} />
                  )}
                  {(fullMode || formData.incomeSourceText) && (
                    <SummaryRow label="แหล่งรายได้" value={formData.incomeSourceText || '—'} />
                  )}
                  {(fullMode || formData.receivedScholarshipText) && (
                    <SummaryRow label="ทุนอื่นที่ได้รับ" value={formData.receivedScholarshipText || '—'} />
                  )}
                  {(fullMode || formData.takhliScholarshipHistoryText) && (
                    <SummaryRow label="ทุนเทศบาลที่เคยได้" value={formData.takhliScholarshipHistoryText || '—'} />
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-[16px] border-[1.5px] border-[#E7E2F2] bg-white">
                <div className="flex items-center justify-between bg-[#F6F3FD] px-3.5 py-2.5">
                  <span className="text-[12px] font-bold text-[#7C3AED]">รูปภาพ & ตำแหน่ง</span>
                  <button type="button" onClick={() => setReview(false)} className="text-[11px] font-semibold text-[#7C3AED] hover:underline">
                    ✎ แก้ไข
                  </button>
                </div>
                <div className="px-3.5 py-3">
                  <div className="flex gap-2">
                    {(formData.image || []).slice(0, 3).map((url, i) => (
                      <div
                        key={i}
                        className="aspect-square flex-1 rounded-[10px] bg-cover bg-center"
                        style={{ backgroundImage: `url(${url})` }}
                      />
                    ))}
                    {formData.image?.length === 0 && (
                      <div className="flex-1 rounded-[10px] bg-[#EDE7FD] px-3 py-4 text-center text-[11px] text-[#8A8398]">ยังไม่มีรูป</div>
                    )}
                  </div>
                  {location?.lat && (
                    <div className="mt-2.5 flex items-center gap-1.5 rounded-[9px] bg-[#EDE7FD] px-2.5 py-1.5 text-[11px] text-[#5B21B6]">
                      📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[12px] bg-[#FEF3C7] px-3.5 py-2.5 text-[11px] leading-relaxed text-[#92400E]">
                ⚠️ เมื่อกดส่งแล้วจะเข้าสู่ระบบทันที หากต้องแก้ไขให้ติดต่อเจ้าหน้าที่
              </div>
            </div>
            <div className="flex shrink-0 gap-2.5 px-5 pb-5 pt-3">
              <button type="button" className={ghostBtnCls} onClick={() => setReview(false)} disabled={isSubmitting}>แก้ไข</button>
              <button type="button" className={successBtnCls + ' flex-1'} onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : '✓ ยืนยันส่งข้อมูล'}
              </button>
            </div>
          </>
        ) : (
          /* ---------- รูปภาพ & ตำแหน่ง ---------- */
          <>
            <StepHeader
              title="รูปภาพ & ตำแหน่ง"
              step={3}
              subtitle="ขั้นที่ 3 จาก 3 · รูป/พิกัด"
              onBack={() => setStep(2)}
              onClose={handleClose}
            />
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <MediaStep
                formData={formData}
                setFormData={setFormData}
                useCurrent={useCurrent}
                setUseCurrent={setUseCurrent}
                location={location}
                setLocation={setLocation}
                onUploadingChange={setUploading}
              />
            </div>
            <div className="flex shrink-0 gap-2.5 px-5 pb-5 pt-3">
              <button type="button" className={ghostBtnCls} onClick={() => setStep(2)}>กลับ</button>
              <button type="button" className={primaryBtnCls + ' flex-1'} onClick={goToReview} disabled={uploading}>
                {uploading ? <span className="loading loading-spinner loading-sm" /> : 'ตรวจสอบข้อมูล →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
