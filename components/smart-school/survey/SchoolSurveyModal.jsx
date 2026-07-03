import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { z } from 'zod';
import IdentityStep from './IdentityStep';
import InfoStep from './InfoStep';
import MediaStep from './MediaStep';

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

// แบบฟอร์มสำรวจการศึกษา wizard 3 ขั้น (แทน EducationFormModal เดิม)
// ขั้น 1 ระบุตัวตนด้วยเลข 13 หลัก → ขั้น 2 ข้อมูล (prefill ถ้ารายเก่า) → ขั้น 3 รูป+พิกัด
export default function SchoolSurveyModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1);
  const [identity, setIdentity] = useState(null); // { citizenId, applicant, prevApplication }
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [useCurrent, setUseCurrent] = useState(false);
  const [location, setLocation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setStep(1);
    setIdentity(null);
    setFormData(EMPTY_FORM);
    setUseCurrent(false);
    setLocation(null);
    setUploading(false);
  };

  const handleIdentityDone = ({ citizenId, applicant, prevApplication }) => {
    setIdentity({ citizenId, applicant, prevApplication });
    if (applicant) {
      // รายเก่า: prefill จากปีล่าสุด (รูปไม่ prefill — ถ่ายใหม่ทุกปี)
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
      });
      if (prev.location?.lat) { setLocation({ lat: prev.location.lat, lng: prev.location.lng }); setUseCurrent(true); }
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

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const result = surveySchema.safeParse({ ...formData, location });
    if (!result.success) {
      const messages = result.error.errors
        .map((err, i) => `${i + 1}. ${err.message}`)
        .join('\n');
      Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบถ้วน', text: messages, confirmButtonText: 'ตกลง' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/smart-school/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          citizenId: identity.citizenId,
          annualIncome: parseInt(formData.annualIncome) || 0,
          location,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        Swal.fire({
          icon: 'success',
          title: 'ส่งข้อมูลเรียบร้อยแล้ว',
          text: `รหัสใบสมัคร: ${data.applicationId}${data.isRenewal ? ' (อัปเดตข้อมูลรายเก่า)' : ''}`,
        });
        onClose();
        reset();
      } else {
        const errData = await res.json();
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
    <div className="fixed inset-0 bg-white/10 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4 relative">
        <button className="absolute top-2 right-2 text-gray-500" disabled={isSubmitting}
          onClick={() => { onClose(); reset(); }}>✕</button>
        <h2 className="text-lg font-semibold text-center text-blue-600">แบบฟอร์มสำรวจการศึกษา</h2>

        <ul className="steps steps-horizontal w-full text-xs">
          <li className={`step ${step >= 1 ? 'step-primary' : ''}`}>ระบุตัวตน</li>
          <li className={`step ${step >= 2 ? 'step-primary' : ''}`}>ข้อมูล</li>
          <li className={`step ${step >= 3 ? 'step-primary' : ''}`}>รูป/พิกัด</li>
        </ul>

        {step === 1 && <IdentityStep onDone={handleIdentityDone} disabled={isSubmitting} />}

        {step === 2 && (
          <>
            {identity?.applicant && (
              <div className="alert alert-success text-xs">
                รายเก่า: ดึงข้อมูลปีงบ {prevYear || '-'} มาให้แล้ว แก้ไขเฉพาะที่เปลี่ยน
              </div>
            )}
            <InfoStep
              formData={formData}
              setFormData={setFormData}
              prevApplication={identity?.prevApplication}
              prevYear={prevYear}
              disabled={isSubmitting}
            />
            <div className="flex gap-2 pt-2">
              <button className="btn btn-secondary flex-1" disabled={isSubmitting}
                onClick={() => setStep(1)}>ย้อนกลับ</button>
              <button className="btn btn-primary flex-1" disabled={isSubmitting}
                onClick={goToMedia}>ถัดไป</button>
            </div>
          </>
        )}

        {step === 3 && (
          <MediaStep
            formData={formData}
            setFormData={setFormData}
            useCurrent={useCurrent}
            setUseCurrent={setUseCurrent}
            location={location}
            setLocation={setLocation}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onBack={() => setStep(2)}
            uploading={uploading}
            onUploadingChange={setUploading}
          />
        )}
      </div>
    </div>
  );
}
