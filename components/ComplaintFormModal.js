import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import CommunitySelector from './CommunitySelector';
import ReporterInput from './ReporterInput';

import { useProblemOptionStore } from '@/stores/useProblemOptionStore';
import ImageUploads from './ImageUploads';
import Swal from 'sweetalert2';
import { z } from 'zod';
import Image from 'next/image';
import { initLiff, isLiffLoggedIn, isInLineApp, getLiffProfile, liffLogin } from '@/lib/liff';
const LocationConfirm = dynamic(() => import('./LocationConfirm'), { ssr: false });

// schema สร้างแบบ dynamic ตาม lineProfile (เบอร์โทร optional เมื่อ login LINE)
const makeSchema = (hasLineProfile) => z.object({
  community: z.string().min(1, 'กรุณาระบุ 1 ชุมชน'),
  prefix: z.string().min(1, 'กรุณาเลือกคำนำหน้า'),
  fullName: z.string().min(2, 'ชื่อ-นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร'),
  phone: hasLineProfile
    ? z.string().refine(
        (v) => v === '' || /^[0-9]{10}$/.test(v),
        'เบอร์โทรต้องเป็นตัวเลข 10 หลัก'
      )
    : z.string().length(10, 'เบอร์โทรศัพท์ต้องมี 10 หลัก'),
  detail: z.string().min(1, 'กรุณากรอกรายละเอียด'),
  imageUrls: z.array(z.string()).min(1, 'กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป'),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }).nullable().refine((val) => val !== null, 'กรุณาเลือกตำแหน่งที่ตั้ง'),
  selectedProblems: z.array(z.string()).min(1, 'กรุณาเลือกรายการปัญหาอย่างน้อย 1 รายการ'),
});

const ComplaintFormModal = ({ selectedLabel, onClose }) => {
  const lineOaUrl = process.env.NEXT_PUBLIC_LINE_OA_URL || '';
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID || '';

  // step: 'choice' → 'form' | ข้ามถ้าไม่มี LINE OA URL
  const [step, setStep] = useState(lineOaUrl ? 'choice' : 'form');

  // LINE profile หลัง login (null = ยังไม่ได้ login)
  const [lineProfile, setLineProfile] = useState(null);
  const [liffLoading, setLiffLoading] = useState(false);

  const [selectedCommunity, setSelectedCommunity] = useState('');
  const [prefix, setPrefix] = useState('นาย');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [detail, setDetail] = useState('');
  const [imageUrls, setImageUrls] = useState([]);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [location, setLocation] = useState(null);
  const [selectedProblems, setSelectedProblems] = useState([]);
  const [validateTrigger, setValidateTrigger] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const reporterValidRef = useRef(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  // ── LIFF auto-detect ─────────────────────────────────────────────────
  // เมื่อ modal เปิด: ตรวจว่า user เปิดจากใน LINE app หรือ redirect กลับมาจาก LINE Login
  useEffect(() => {
    if (!liffId) return;
    (async () => {
      const ok = await initLiff();
      if (!ok) return;
      if (isLiffLoggedIn()) {
        // กลับมาจาก LINE Login redirect หรือเปิดใน LINE app
        const profile = await getLiffProfile();
        if (profile) {
          setLineProfile(profile);
          setFullName(profile.displayName);
          setStep('form'); // ข้าม choice screen
        }
      } else if (isInLineApp()) {
        // อยู่ใน LINE app แต่ยังไม่ login → login อัตโนมัติ
        liffLogin();
      }
    })();
  }, [liffId]);

  // ── Handlers ──────────────────────────────────────────────────────────

  // เปิด LINE OA ใน tab ใหม่แล้วไปฟอร์มต่อ
  const handleAddFriend = () => {
    window.open(lineOaUrl, '_blank', 'noopener,noreferrer');
    setStep('form');
  };

  // เข้าสู่ระบบด้วย LINE (LIFF login)
  const handleLineLogin = async () => {
    setLiffLoading(true);
    try {
      const ok = await initLiff();
      if (!ok) {
        await Swal.fire({ icon: 'error', title: 'ไม่สามารถเชื่อมต่อ LINE ได้', text: 'กรุณาลองอีกครั้ง', confirmButtonText: 'ตกลง' });
        return;
      }
      if (isLiffLoggedIn()) {
        const profile = await getLiffProfile();
        if (profile) {
          setLineProfile(profile);
          setFullName(profile.displayName);
          setStep('form');
        }
      } else {
        liffLogin(); // redirect → กลับมาที่หน้านี้พร้อม session
      }
    } finally {
      setLiffLoading(false);
    }
  };

  const { problemOptions, fetchProblemOptions } = useProblemOptionStore();

useEffect(() => {
    fetchProblemOptions();
  }, [fetchProblemOptions]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ป้องกันการกดปุ่มซ้ำ หรือขณะอัปโหลดรูปภาพ
    if (isSubmitting || isUploadingImages) {
      if (isUploadingImages) {
        await Swal.fire({
          icon: 'warning',
          title: 'กรุณารอสักครู่',
          text: 'กำลังอัปโหลดรูปภาพอยู่ กรุณารอจนกว่าจะเสร็จสิ้น',
          confirmButtonText: 'ตกลง',
        });
      }
      return;
    }

    setValidateTrigger(true);
    await new Promise((resolve) => setTimeout(resolve, 0)); // allow validation effect to run

    // Validation ด้วย Zod
    const dataToValidate = {
      community: selectedCommunity,
      prefix,
      fullName: fullName.trim(),
      phone,
      detail: detail.trim(),
      imageUrls,
      location,
      selectedProblems,
    };

    const complaintFormSchema = makeSchema(!!lineProfile);
    const result = complaintFormSchema.safeParse(dataToValidate);
    if (!result.success) {
      // เรียงลำดับ error ตามความสำคัญ
      const errorOrder = [
        'community',
        'fullName', 
        'phone',
        'detail',
        'imageUrls',
        'location',
        'selectedProblems',
        'prefix'
      ];
      
      const sortedErrors = result.error.errors.sort((a, b) => {
        const aIndex = errorOrder.indexOf(a.path[0]);
        const bIndex = errorOrder.indexOf(b.path[0]);
        return aIndex - bIndex;
      });
      
      const errorMessages = sortedErrors.map((err, index) => `${index + 1}. ${err.message}`).join('\n');
      await Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบถ้วน',
        text: errorMessages,
        confirmButtonText: 'ตกลง'
      });
      return;
    }

    setFormErrors({});

    setIsSubmitting(true);

    // NOTE: complaintId will be generated by the backend
    const payload = {
      prefix,
      fullName,
      phone,
      community: selectedCommunity,
      problems: selectedProblems.map(id => {
        const match = problemOptions.find(opt => opt._id === id);
        return match ? match.label : id;
      }),
      category: selectedLabel,
      images: imageUrls,
      detail,
      location,
      status: 'อยู่ระหว่างดำเนินการ',
      officer: '',
      updatedAt: new Date(),
      // เชื่อม LINE userId ถ้า login ด้วย LINE (push notification อัตโนมัติ)
      ...(lineProfile?.userId ? { lineUserId: lineProfile.userId } : {}),
    };


    try {
      const res = await fetch('/api/submittedreports/submit-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-id': process.env.NEXT_PUBLIC_APP_ID || 'app_b',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('ส่งข้อมูลไม่สำเร็จ');

      const data = await res.json();
      const complaintId = data.complaintId;

      // ถ้า login LINE แล้ว → เชื่อมสำเร็จ แจ้งว่ารับ push notification อัตโนมัติ
      // ถ้ายังไม่ login LINE → แสดงปุ่มเพิ่มเพื่อน
      let lineHtml = '';
      if (lineProfile) {
        lineHtml = `
          <div style="margin-top:12px;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:13px;color:#15803d">
            ✅ เชื่อมต่อ LINE สำเร็จ — คุณจะได้รับแจ้งเตือนสถานะผ่าน LINE อัตโนมัติ
          </div>`;
      } else if (lineOaUrl) {
        lineHtml = `
          <p style="margin:12px 0 4px;font-size:14px;color:#555">รับการแจ้งเตือนสถานะผ่าน LINE</p>
          <a href="${lineOaUrl}" target="_blank" rel="noopener noreferrer"
             style="display:inline-flex;align-items:center;gap:8px;background:#06C755;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;margin-top:4px">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
            เพิ่มเพื่อน LINE OA เพื่อรับแจ้งเตือน
          </a>
          <p style="font-size:11px;color:#888;margin-top:8px">เพิ่มเพื่อนแล้วพิมพ์ "สถานะ ${complaintId}" เพื่อตรวจสอบ</p>`;
      }

      await Swal.fire({
        icon: 'success',
        title: 'ส่งเรื่องสำเร็จ',
        html: `<p>เลขที่เรื่องของคุณคือ <strong>${complaintId}</strong></p>${lineHtml}`,
        confirmButtonText: 'ตกลง',
        width: lineHtml ? 420 : undefined,
      });
      handleClearForm();
      onClose?.(); // Close the modal
    } catch (err) {
      console.error('❌ เกิดข้อผิดพลาด:', err);
      await Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: err.message || 'ไม่สามารถส่งข้อมูลได้',
        confirmButtonText: 'ตกลง',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearForm = () => {
    setSelectedCommunity('');
    setPrefix('นาย');
    setFullName('');
    setPhone('');
    setDetail('');
    setImageUrls([]); // Explicitly clear imageUrls
    setUseCurrentLocation(false);
    setLocation(null);
    setSelectedProblems([]);
    setValidateTrigger(false);
    setFormErrors({});
    reporterValidRef.current = true;
  };

  const handleCommunitySelect = (community) => {
    setSelectedCommunity(community);
  };

  useEffect(() => {
  import('leaflet').then(L => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: '/leaflet/marker-icon-2x.png',
      iconUrl: '/leaflet/marker-icon.png',
      shadowUrl: '/leaflet/marker-shadow.png',
    });
  });
}, []);

  if (!selectedLabel) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 overflow-y-auto flex items-center justify-center transition-all">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto transform transition-all duration-300 opacity-0 scale-95 animate-fade-in">

        {/* ─── Header ─────────────────────────────────── */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-gray-800">
            {step === 'choice' ? 'ก่อนส่งเรื่องร้องเรียน' : `ฟอร์มสำหรับ: ${selectedLabel}`}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-sm">
            ✕
          </button>
        </div>

        {/* ─── Step: choice ───────────────────────────── */}
        {step === 'choice' && (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            {/* LINE icon */}
            <div className="w-16 h-16 rounded-full bg-[#06C755] flex items-center justify-center shadow">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
            </div>

            <div>
              <p className="text-base font-semibold text-gray-800">
                ต้องการรับแจ้งเตือนสถานะผ่าน LINE หรือไม่?
              </p>
              <p className="text-sm text-gray-500 mt-1">
                เมื่อเจ้าหน้าที่อัปเดตสถานะ คุณจะได้รับข้อความใน LINE ทันที
              </p>
            </div>

            <div className="flex flex-col gap-2 w-full">

              {/* ปุ่ม 1: เข้าสู่ระบบด้วย LINE (LIFF) — ชื่อ auto-fill + เบอร์ไม่บังคับ */}
              {liffId && (
                <button
                  type="button"
                  onClick={handleLineLogin}
                  disabled={liffLoading}
                  className="btn w-full text-white font-bold"
                  style={{ backgroundColor: '#00B900', borderColor: '#00B900' }}
                >
                  {liffLoading ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                    </svg>
                  )}
                  เข้าสู่ระบบด้วย LINE (ชื่อ auto-fill · เบอร์ไม่บังคับ)
                </button>
              )}

              {/* ปุ่ม 2: เพิ่มเพื่อน LINE OA ก่อนแล้วกรอกฟอร์ม */}
              <button
                type="button"
                onClick={handleAddFriend}
                className="btn w-full text-white font-bold"
                style={{ backgroundColor: '#06C755', borderColor: '#06C755' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
                เพิ่มเพื่อน LINE OA แล้วกรอกฟอร์ม
              </button>

              {/* ปุ่ม 3: กรอกฟอร์มเลยโดยไม่สมัคร */}
              <button
                type="button"
                onClick={() => setStep('form')}
                className="btn btn-outline w-full"
              >
                กรอกฟอร์มเลย (ไม่สมัคร)
              </button>
            </div>

            <p className="text-xs text-gray-400">
              หากเป็นสมาชิกอยู่แล้ว สามารถกรอกฟอร์มได้เลย
            </p>
          </div>
        )}

        {/* ─── Step: form ─────────────────────────────── */}
        {step === 'form' && (
        <form onSubmit={handleSubmit} className="space-y-3">

          {/* LINE profile badge — แสดงเมื่อ login LINE แล้ว */}
          {lineProfile && (
            <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200 text-sm">
              {lineProfile.pictureUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lineProfile.pictureUrl} alt="LINE" className="w-7 h-7 rounded-full shrink-0" />
              )}
              <span className="text-green-700">
                เข้าสู่ระบบ LINE: <strong>{lineProfile.displayName}</strong>
                <span className="ml-1 text-green-500 text-xs">(เบอร์โทรไม่บังคับ · รับแจ้งเตือนอัตโนมัติ)</span>
              </span>
            </div>
          )}

          <CommunitySelector
            selected={selectedCommunity}
            onSelect={handleCommunitySelect}
            error={formErrors.community?.[0]}
          />
          <div>
            <p className="font-semibold text-sm text-gray-700">2.เลือกรายการปัญหา</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {problemOptions
                .filter(option => option.category === selectedLabel)
                .map(option => (
                  <button
                    key={option._id}
                    type="button"
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border whitespace-nowrap ${selectedProblems.includes(option._id) ? 'bg-blue-100 text-black border-blue-300' : 'border-gray-300 text-black hover:bg-gray-100'}`}
                    onClick={() => {
                      setSelectedProblems(prev =>
                        prev.includes(option._id)
                          ? prev.filter(id => id !== option._id)
                          : [...prev, option._id]
                      );
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Image
                        src={option.iconUrl}
                        alt={option.label}
                        width={20}
                        height={20}
                        className="w-5 h-5"
                      />
                      <span>{option.label}</span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
          <p className="font-semibold text-sm text-gray-700">3.แนบรูปภาพ 📁 เลือกรูปภาพ (ไม่เกิน 3 ภาพ)</p>
          <ImageUploads 
            onChange={(urls) => setImageUrls(urls)} 
            onUploadingChange={setIsUploadingImages}
          />
          <ReporterInput
            prefix={prefix}
            setPrefix={setPrefix}
            fullName={fullName}
            setFullName={setFullName}
            phone={phone}
            setPhone={setPhone}
            detail={detail}
            setDetail={setDetail}
            validateTrigger={validateTrigger}
            setValid={(v) => reporterValidRef.current = v}
            phoneOptional={!!lineProfile}
          />
          <LocationConfirm
            useCurrent={useCurrentLocation}
            onToggle={setUseCurrentLocation}
            location={location}
            setLocation={setLocation}
          />
        <div className="flex mb-4 gap-2 justify-end">
          <button
            type="button"
            onClick={handleClearForm}
            className="btn btn-outline btn-warning"
            disabled={isSubmitting || isUploadingImages}
          >
            ล้างฟอร์ม
          </button>
          <button 
            type="submit" 
            className="btn btn-info" 
            disabled={isSubmitting || isUploadingImages}
          >
            {(isSubmitting || isUploadingImages) && <span className="loading loading-infinity loading-xs mr-2" />}
            {isUploadingImages ? 'กำลังอัปโหลดรูป...' : 'ส่งเรื่อง'}
          </button>
        </div>
        </form>
        )}

      </div>
    </div>
  );
};

export default ComplaintFormModal;