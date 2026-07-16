import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Swal from 'sweetalert2';
import ImageUploads from '@/components/ImageUploads';
import { inputCls, labelCls, ghostBtnCls, successBtnCls } from '@/components/smart-school/adminTheme';
import { normalizeCitizenId, isValidThaiCitizenId } from '@/lib/smart-school/citizenId';

// leaflet ใช้ window — ต้อง ssr:false
const LocationPickerMap = dynamic(() => import('@/components/LocationPickerMap'), { ssr: false });

const FAMILY_STATUS_OPTIONS = [
  'บิดา-มารดาแยกกันอยู่', 'แยกกันอยู่ชั่วคราว', 'หย่าร้าง',
  'บิดาส่งเสีย', 'มารดาส่งเสีย', 'บิดา/มารดาไม่ได้ส่งเสีย',
];

const CHECKBOX_CLS = 'h-3.5 w-3.5 rounded border-[#E7E2F2] accent-[#7C3AED]';
const CHECKBOX_LABEL_CLS = 'flex items-center gap-1 text-xs text-[#57506A] cursor-pointer';

export default function ApplicationEditModal({ row, onClose, onSaved }) {
  const [form, setForm] = useState({
    prefix: row.prefix || '',
    name: row.name || '',
    phone: row.phone || '',
    educationLevel: row.educationLevel || '',
    schoolName: row.schoolName || '',
    gradeLevel: row.gradeLevel || '',
    gpa: row.gpa ?? '',
    address: row.address || '',
    actualAddress: row.actualAddress || '',
    housingStatus: row.housingStatus || 'ไม่ระบุ',
    householdMembers: row.householdMembers || 1,
    annualIncome: row.annualIncome ?? 0,
    familyStatus: row.familyStatus || [],
    incomeSource: row.incomeSource || [],
    receivedScholarship: row.receivedScholarship || [],
    takhliScholarshipHistory: row.takhliScholarshipHistory || [],
    note: row.note || '',
    imageUrl: row.imageUrl || [],
    schoolEligibility: row.schoolEligibility || 'ok',
    residencyOverOneYear: row.residencyOverOneYear ?? null,
    eligibilityChecklist: row.eligibilityChecklist || { residencyVerified: false, schoolVerified: false, documentsVerified: false },
    location: row.location?.lat != null ? { lat: row.location.lat, lng: row.location.lng } : null,
  });
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  // bump เพื่อ remount แผนที่ให้ recenter (MapContainer center ใช้ตอน mount เท่านั้น)
  // — ใช้เฉพาะตอนกด "ใช้ตำแหน่งปัจจุบัน"; ลากหมุดไม่ remount จะได้ไม่กระตุก
  const [mapKey, setMapKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [incomeSourceText, setIncomeSourceText] = useState((row.incomeSource || []).join(', '));
  const [scholarshipText, setScholarshipText] = useState((row.receivedScholarship || []).join(', '));
  // เลขบัตร: server ไม่เคยส่งเลขเต็มมา — แก้ = พิมพ์ใหม่ทั้ง 13 หลัก, ล้าง = ติ๊ก checkbox
  const [citizenIdInput, setCitizenIdInput] = useState('');
  const [clearCitizenId, setClearCitizenId] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // เจ้าหน้าที่สำรวจหน้างาน: ยืนที่บ้านแล้วกดปุ่มนี้บนมือถือ
  const useCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      Swal.fire({ icon: 'error', title: 'อุปกรณ์ไม่รองรับการหาตำแหน่ง' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set({ location: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
        setMapKey((k) => k + 1); // recenter แผนที่ไปตำแหน่งใหม่
        setLocating(false);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setLocating(false);
        Swal.fire({ icon: 'error', title: 'ไม่สามารถเข้าถึงตำแหน่งได้', text: 'ตรวจสอบการอนุญาตตำแหน่งของเบราว์เซอร์' });
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const parseList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
      const citizenDigits = normalizeCitizenId(citizenIdInput);
      if (!clearCitizenId && citizenIdInput.trim() && !isValidThaiCitizenId(citizenDigits)) {
        throw new Error('เลขบัตรประชาชนไม่ถูกต้อง (ต้องครบ 13 หลักและ checksum ผ่าน)');
      }
      const res = await fetch('/api/smart-school/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _id: row._id,
          ...form,
          gpa: form.gpa === '' ? null : form.gpa,
          incomeSource: parseList(incomeSourceText),
          receivedScholarship: parseList(scholarshipText),
          // null = ล้างเลข, undefined (JSON ตัดทิ้ง) = ไม่แตะเลขเดิม
          citizenId: clearCitizenId ? null : citizenDigits || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'บันทึกไม่สำเร็จ');
      Swal.fire({
        icon: 'success',
        title: 'บันทึกแล้ว',
        text: data.imagesChanged ? 'รูปภาพเปลี่ยน — แจ้งเตือน n8n แล้ว' : undefined,
        timer: 1600,
        showConfirmButton: false,
      });
      onSaved();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const input = (label, key, type = 'text', extra = {}) => (
    <div className="space-y-1">
      <label className={labelCls}>{label}</label>
      <input type={type} className={inputCls} value={form[key]}
        onChange={(e) => set({ [key]: e.target.value })}
        {...extra} />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#FAF8FF] rounded-[24px] shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4" style={{ background: '#211B2E' }}>
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-white text-[15px] shrink-0">✎</span>
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-white truncate">แก้ไข · {row.applicationId}</div>
              <div className="text-[12.5px] text-white/70 truncate">{row.prefix}{row.name}</div>
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 text-white/85 hover:text-white transition text-lg leading-none"
            onClick={onClose}
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {input('คำนำหน้า', 'prefix')}
          {input('ชื่อ-นามสกุล', 'name')}
          <div className="space-y-1">
            <label className={labelCls}>เบอร์โทร</label>
            <input type="tel" maxLength={10} className={inputCls}
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '') })} />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>
              เลขบัตรประชาชน {row.citizenIdMasked ? `(ปัจจุบัน ${row.citizenIdMasked})` : '(ยังไม่มี)'}
            </label>
            <input type="text" inputMode="numeric" className={inputCls}
              placeholder={row.citizenIdMasked ? 'พิมพ์เลขใหม่ 13 หลักเพื่อเปลี่ยน' : 'กรอกเลข 13 หลัก'}
              value={citizenIdInput}
              disabled={clearCitizenId}
              onChange={(e) => setCitizenIdInput(normalizeCitizenId(e.target.value).slice(0, 13))} />
            {row.citizenIdMasked && (
              <label className={CHECKBOX_LABEL_CLS}>
                <input type="checkbox" className={CHECKBOX_CLS} checked={clearCitizenId}
                  onChange={(e) => { setClearCitizenId(e.target.checked); if (e.target.checked) setCitizenIdInput(''); }} />
                ล้างเลขบัตร (กรณีผูกผิดคน)
              </label>
            )}
          </div>
          <div className="space-y-1">
            <label className={labelCls}>ระดับการศึกษา</label>
            <select className={inputCls} value={form.educationLevel}
              onChange={(e) => set({ educationLevel: e.target.value })}>
              <option value="">เลือกระดับการศึกษา</option>
              {['อนุบาล', 'ประถม', 'มัธยมต้น', 'มัธยมปลาย', 'ปวช', 'ปวส', 'ปริญญาตรี'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          {input('โรงเรียน', 'schoolName')}
          <div className="space-y-1">
            <label className={labelCls}>เกณฑ์โรงเรียน</label>
            <select className={inputCls} value={form.schoolEligibility}
              onChange={(e) => set({ schoolEligibility: e.target.value })}>
              <option value="ok">ผ่าน (ok)</option>
              <option value="block">ไม่ผ่าน (เอกชน/นอกเขต)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelCls}>ทะเบียนบ้าน ≥1 ปี</label>
            <select className={inputCls}
              value={form.residencyOverOneYear === true ? 'yes' : form.residencyOverOneYear === false ? 'no' : ''}
              onChange={(e) => set({ residencyOverOneYear: e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null })}>
              <option value="">ไม่ระบุ</option>
              <option value="yes">ใช่</option>
              <option value="no">ไม่ใช่/ไม่แน่ใจ</option>
            </select>
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-3">
            {[['residencyVerified', 'ยืนยันทะเบียนบ้าน ≥1 ปี'], ['schoolVerified', 'ยืนยันสถานศึกษา'], ['documentsVerified', 'ยืนยันเอกสารครบ']].map(([k, label]) => (
              <label key={k} className={CHECKBOX_LABEL_CLS}>
                <input type="checkbox" className={CHECKBOX_CLS}
                  checked={form.eligibilityChecklist?.[k] || false}
                  onChange={(e) => set({ eligibilityChecklist: { ...form.eligibilityChecklist, [k]: e.target.checked } })} />
                {label}
              </label>
            ))}
          </div>
          {input('ระดับชั้น', 'gradeLevel')}
          {input('GPA', 'gpa', 'number', { step: '0.01', min: 0, max: 4 })}
          <div className="md:col-span-2 space-y-1">
            <label className={labelCls}>ที่อยู่</label>
            <textarea className={inputCls} value={form.address}
              onChange={(e) => set({ address: e.target.value })} />
          </div>
          {input('ที่อยู่จริง', 'actualAddress')}

          <div className="md:col-span-2 space-y-1.5">
            <label className={labelCls}>ตำแหน่งที่ตั้ง (พิกัด)</label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-[#57506A]">
                {form.location?.lat != null
                  ? `📍 ${form.location.lat.toFixed(5)}, ${form.location.lng.toFixed(5)}`
                  : 'ยังไม่มีพิกัด — คลิกบนแผนที่เพื่อระบุ'}
              </span>
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={locating}
                className="text-[12px] font-bold text-[#7C3AED] bg-[#F1ECFB] rounded-[10px] px-3 py-1.5 transition hover:bg-[#DDD2FB] disabled:opacity-60"
              >
                {locating ? 'กำลังหาตำแหน่ง…' : '📱 ใช้ตำแหน่งปัจจุบัน'}
              </button>
            </div>
            <LocationPickerMap
              key={mapKey}
              initialLocation={form.location || undefined}
              onLocationChange={(loc) => set({ location: loc })}
            />
          </div>

          <div className="space-y-1">
            <label className={labelCls}>สถานภาพที่อยู่</label>
            <select className={inputCls} value={form.housingStatus}
              onChange={(e) => set({ housingStatus: e.target.value })}>
              {['ไม่ระบุ', 'ผู้อาศัย', 'เจ้าของ', 'บ้านเช่า', 'อื่นๆ'].map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          {input('จำนวนสมาชิกในบ้าน', 'householdMembers', 'number', { min: 1 })}
          {input('รายได้/ปี (บาท)', 'annualIncome', 'number', { min: 0 })}
          <div className="md:col-span-2 space-y-1">
            <label className={labelCls}>สถานะครอบครัว</label>
            <div className="flex flex-wrap gap-2">
              {FAMILY_STATUS_OPTIONS.map((opt) => (
                <label key={opt} className={CHECKBOX_LABEL_CLS}>
                  <input type="checkbox" className={CHECKBOX_CLS}
                    checked={form.familyStatus.includes(opt)}
                    onChange={(e) => set({
                      familyStatus: e.target.checked
                        ? [...form.familyStatus, opt]
                        : form.familyStatus.filter((x) => x !== opt),
                    })} />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className={labelCls}>ทุนเทศบาลที่เคยได้ (self-report)</label>
            <div className="flex flex-wrap gap-2">
              {['เคยได้รับทุนการศึกษา ปีงบประมาณ 2565', 'เคยได้รับทุนการศึกษา ปีงบประมาณ 2566',
                'เคยได้รับทุนการศึกษา ปีงบประมาณ 2567', 'เคยได้รับทุนการศึกษา ปีงบประมาณ 2568',
                'ไม่เคยได้รับทุนการศึกษา'].map((opt) => (
                <label key={opt} className={CHECKBOX_LABEL_CLS}>
                  <input type="checkbox" className={CHECKBOX_CLS}
                    checked={form.takhliScholarshipHistory.includes(opt)}
                    onChange={(e) => set({
                      takhliScholarshipHistory: e.target.checked
                        ? [...form.takhliScholarshipHistory, opt]
                        : form.takhliScholarshipHistory.filter((x) => x !== opt),
                    })} />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className={labelCls}>แหล่งรายได้ (คั่นด้วย ,)</label>
            <input type="text" className={inputCls}
              value={incomeSourceText}
              onChange={(e) => setIncomeSourceText(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>ทุนอื่นที่ได้รับ (คั่นด้วย ,)</label>
            <input type="text" className={inputCls}
              value={scholarshipText}
              onChange={(e) => setScholarshipText(e.target.value)} />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className={labelCls}>หมายเหตุ</label>
            <textarea className={inputCls} value={form.note}
              onChange={(e) => set({ note: e.target.value })} />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className={labelCls}>
              รูปภาพ (บันทึกจริง + แจ้ง n8n เมื่อเปลี่ยน)
            </label>
            <ImageUploads
              initialImages={form.imageUrl}
              onChange={(urls) => set({ imageUrl: urls })}
              onUploadingChange={setUploading}
            />
          </div>
        </div>

        <div className="shrink-0 flex gap-2.5 px-5 py-4 border-t border-[#EDE7FD] bg-[#FAF8FF] rounded-b-[24px]">
          <button type="button" className={ghostBtnCls + ' flex-1'} onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button type="button" className={successBtnCls + ' flex-1'} onClick={handleSave} disabled={saving || uploading}>
            {saving ? <span className="loading loading-spinner loading-sm" /> : '✓ บันทึกการแก้ไข'}
          </button>
        </div>
      </div>
    </div>
  );
}
