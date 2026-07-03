import React, { useState } from 'react';
import Swal from 'sweetalert2';
import ImageUploads from '@/components/ImageUploads';

const FAMILY_STATUS_OPTIONS = [
  'บิดา-มารดาแยกกันอยู่', 'แยกกันอยู่ชั่วคราว', 'หย่าร้าง',
  'บิดาส่งเสีย', 'มารดาส่งเสีย', 'บิดา/มารดาไม่ได้ส่งเสีย',
];

export default function ApplicationEditModal({ row, onClose, onSaved }) {
  const [form, setForm] = useState({
    citizenId: row.citizenId || '',
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
  });
  const [saving, setSaving] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/smart-school/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _id: row._id, ...form, gpa: form.gpa === '' ? null : form.gpa }),
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
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input type={type} className="input input-bordered input-sm w-full" value={form[key]}
        onChange={(e) => set({ [key]: type === 'number' ? e.target.value : e.target.value })}
        {...extra} />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-800">แก้ไข {row.applicationId}</h2>
          <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>✕</button>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-gray-700">
              เลขบัตรประชาชน 13 หลัก {!row.citizenId && <span className="text-amber-600">(ยังไม่ผูก — backfill ที่นี่)</span>}
            </label>
            <input type="text" maxLength={13} className="input input-bordered input-sm w-full"
              value={form.citizenId}
              onChange={(e) => set({ citizenId: e.target.value.replace(/\D/g, '') })} />
          </div>
          {input('คำนำหน้า', 'prefix')}
          {input('ชื่อ-นามสกุล', 'name')}
          {input('เบอร์โทร', 'phone', 'tel', { maxLength: 10 })}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">ระดับการศึกษา</label>
            <select className="select select-bordered select-sm w-full" value={form.educationLevel}
              onChange={(e) => set({ educationLevel: e.target.value })}>
              <option value="">เลือกระดับการศึกษา</option>
              {['อนุบาล', 'ประถม', 'มัธยมต้น', 'มัธยมปลาย', 'ปวช', 'ปวส', 'ปริญญาตรี'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          {input('โรงเรียน', 'schoolName')}
          {input('ระดับชั้น', 'gradeLevel')}
          {input('GPA', 'gpa', 'number', { step: '0.01', min: 0, max: 4 })}
          <div className="md:col-span-2 space-y-1">
            <label className="text-sm font-medium text-gray-700">ที่อยู่</label>
            <textarea className="textarea textarea-bordered textarea-sm w-full" value={form.address}
              onChange={(e) => set({ address: e.target.value })} />
          </div>
          {input('ที่อยู่จริง', 'actualAddress')}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">สถานภาพที่อยู่</label>
            <select className="select select-bordered select-sm w-full" value={form.housingStatus}
              onChange={(e) => set({ housingStatus: e.target.value })}>
              {['ไม่ระบุ', 'ผู้อาศัย', 'เจ้าของ', 'บ้านเช่า', 'อื่นๆ'].map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          {input('จำนวนสมาชิกในบ้าน', 'householdMembers', 'number', { min: 1 })}
          {input('รายได้/ปี (บาท)', 'annualIncome', 'number', { min: 0 })}
          <div className="md:col-span-2 space-y-1">
            <label className="text-sm font-medium text-gray-700">สถานะครอบครัว</label>
            <div className="flex flex-wrap gap-2">
              {FAMILY_STATUS_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" className="checkbox checkbox-xs"
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
            <label className="text-sm font-medium text-gray-700">ทุนเทศบาลที่เคยได้ (self-report)</label>
            <div className="flex flex-wrap gap-2">
              {['เคยได้รับทุนการศึกษา ปีงบประมาณ 2565', 'เคยได้รับทุนการศึกษา ปีงบประมาณ 2566',
                'เคยได้รับทุนการศึกษา ปีงบประมาณ 2567', 'เคยได้รับทุนการศึกษา ปีงบประมาณ 2568',
                'ไม่เคยได้รับทุนการศึกษา'].map((opt) => (
                <label key={opt} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" className="checkbox checkbox-xs"
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
            <label className="text-sm font-medium text-gray-700">แหล่งรายได้ (คั่นด้วย ,)</label>
            <input type="text" className="input input-bordered input-sm w-full"
              value={form.incomeSource.join(', ')}
              onChange={(e) => set({
                incomeSource: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              })} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">ทุนอื่นที่ได้รับ (คั่นด้วย ,)</label>
            <input type="text" className="input input-bordered input-sm w-full"
              value={form.receivedScholarship.join(', ')}
              onChange={(e) => set({
                receivedScholarship: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              })} />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-sm font-medium text-gray-700">หมายเหตุ</label>
            <textarea className="textarea textarea-bordered textarea-sm w-full" value={form.note}
              onChange={(e) => set({ note: e.target.value })} />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-sm font-medium text-gray-700">
              รูปภาพ (บันทึกจริง + แจ้ง n8n เมื่อเปลี่ยน)
            </label>
            <ImageUploads
              initialImages={form.imageUrl}
              onChange={(urls) => set({ imageUrl: urls })}
            />
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t sticky bottom-0 bg-white">
          <button className="btn btn-secondary flex-1" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button className="btn btn-primary flex-1" onClick={handleSave} disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-sm" /> : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}
