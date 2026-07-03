import React from 'react';

// hint แสดงค่าเดิมของปีที่แล้ว (เฉพาะรายเก่า)
function PrevHint({ year, value }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <p className="text-xs text-amber-600">ข้อมูลเดิมปี {year}: {String(value)}</p>
  );
}

// ขั้นที่ 2: ข้อมูลผู้ขอ — formData/setFormData ถือ state ที่ orchestrator
export default function InfoStep({ formData, setFormData, prevApplication, prevYear, disabled }) {
  const set = (patch) => setFormData({ ...formData, ...patch });
  const prev = prevApplication || {};

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">ระดับการศึกษา</label>
        <div className="flex flex-wrap gap-2 justify-center">
          {['อนุบาล', 'ประถม', 'มัธยมต้น', 'มัธยมปลาย', 'ปวช', 'ปวส', 'ปริญญาตรี'].map((level) => (
            <button key={level} type="button" disabled={disabled}
              className={`btn btn-sm rounded-full ${formData.educationLevel === level ? 'btn-info' : 'btn-outline'}`}
              onClick={() => set({ educationLevel: level })}>
              {level}
            </button>
          ))}
        </div>
        <PrevHint year={prevYear} value={prev.educationLevel} />
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">1. คำนำหน้า</label>
        <div className="flex flex-wrap gap-2 justify-center">
          {['ด.ช.', 'ด.ญ.', 'นาย', 'นางสาว'].map((prefix) => (
            <button key={prefix} type="button" disabled={disabled}
              className={`btn btn-sm rounded-full ${formData.prefix === prefix ? 'btn-info' : 'btn-outline'}`}
              onClick={() => set({ prefix })}>
              {prefix}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">2. ชื่อ-นามสกุล</label>
        <input type="text" placeholder="ชื่อ-นามสกุล" value={formData.fullName} disabled={disabled}
          onChange={(e) => set({ fullName: e.target.value })}
          className="input input-bordered w-full" />
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">3. ที่อยู่</label>
        <textarea placeholder="ที่อยู่" value={formData.address} disabled={disabled}
          onChange={(e) => set({ address: e.target.value })}
          className="textarea textarea-bordered w-full" />
        <PrevHint year={prevYear} value={prev.address} />
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">4. เบอร์โทร</label>
        <input type="tel" placeholder="เบอร์โทร 10 หลัก" value={formData.phone} maxLength={10} disabled={disabled}
          onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '') })}
          className="input input-bordered w-full" />
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">5. หมายเหตุ</label>
        <textarea placeholder="หมายเหตุ (ถ้ามี)" value={formData.note} disabled={disabled}
          onChange={(e) => set({ note: e.target.value })}
          className="textarea textarea-bordered w-full" />
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">6. สถานภาพที่อยู่</label>
        <select value={formData.housingStatus} disabled={disabled}
          onChange={(e) => set({ housingStatus: e.target.value })}
          className="select select-bordered w-full">
          <option value="ไม่ระบุ">ไม่ระบุ</option>
          <option value="ผู้อาศัย">ผู้อาศัย</option>
          <option value="เจ้าของ">เจ้าของ</option>
          <option value="บ้านเช่า">บ้านเช่า</option>
          <option value="อื่นๆ">อื่นๆ</option>
        </select>
        <PrevHint year={prevYear} value={prev.housingStatus} />
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">7. จำนวนสมาชิกในบ้าน</label>
        <input type="number" placeholder="จำนวนสมาชิก" value={formData.householdMembers} min="1" disabled={disabled}
          onChange={(e) => set({ householdMembers: parseInt(e.target.value) || 1 })}
          className="input input-bordered w-full" />
        <PrevHint year={prevYear} value={prev.householdMembers} />
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">8. รายได้ทั้งปี (บาท)</label>
        <div className="relative">
          <input type="number" placeholder="รายได้ทั้งปี" value={formData.annualIncome} min="0" disabled={disabled}
            onChange={(e) => set({ annualIncome: e.target.value })}
            className="input input-bordered w-full pr-16" />
          <button type="button" disabled={disabled || !formData.annualIncome}
            onClick={() => {
              const v = parseInt(formData.annualIncome) || 0;
              if (v > 0) set({ annualIncome: String(v * 12) });
            }}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 btn btn-xs btn-outline btn-primary"
            title="คูณ 12 (แปลงจากรายได้ต่อเดือนเป็นรายได้ต่อปี)">
            ×12
          </button>
        </div>
        {formData.annualIncome && (
          <div className="text-xs text-gray-500 mt-1">
            💡 หมายเหตุ: หากกรอกรายได้ต่อเดือน ให้กดปุ่ม &quot;×12&quot; เพื่อแปลงเป็นรายได้ต่อปี
          </div>
        )}
        <PrevHint year={prevYear} value={prev.annualIncome} />
      </div>
    </div>
  );
}
