import React from 'react';
import { inputCls, labelCls, chipCls } from './surveyTheme';

// hint แสดงค่าเดิมของปีที่แล้ว (เฉพาะรายเก่า)
function PrevHint({ year, value }) {
  if (value === undefined || value === null || value === '') return null;
  return <p className="mt-1 text-[11px] text-[#B45309]">ข้อมูลเดิมปี {year}: {String(value)}</p>;
}

function FieldRow({ n, label, children, hint }) {
  return (
    <div>
      <label className={labelCls}>
        {n != null && <span className="text-[#8A8398]">{n}. </span>}
        {label}
      </label>
      {children}
      {hint}
    </div>
  );
}

// ขั้นที่ 2: ข้อมูลผู้ขอทุน — formData/setFormData ถือ state ที่ orchestrator
export default function InfoStep({ formData, setFormData, prevApplication, prevYear, disabled, blockedSchools }) {
  const set = (patch) => setFormData({ ...formData, ...patch });
  const prev = prevApplication || {};
  const cleanSchool = (formData.schoolName || '').replace(/\s+/g, ' ').trim();
  const blockedHit = (blockedSchools || []).some((s) => s.name === cleanSchool);

  return (
    <div className="space-y-4">
      <FieldRow label="ระดับการศึกษา" hint={<PrevHint year={prevYear} value={prev.educationLevel} />}>
        <div className="flex flex-wrap gap-1.5">
          {['อนุบาล', 'ประถม', 'มัธยมต้น', 'มัธยมปลาย', 'ปวช', 'ปวส', 'ปริญญาตรี'].map((level) => (
            <button
              key={level}
              type="button"
              disabled={disabled}
              className={chipCls(formData.educationLevel === level)}
              onClick={() => set({ educationLevel: level })}
            >
              {level}
            </button>
          ))}
        </div>
      </FieldRow>

      <FieldRow n={1} label="คำนำหน้า">
        <div className="flex flex-wrap gap-1.5">
          {['ด.ช.', 'ด.ญ.', 'นาย', 'นางสาว'].map((prefix) => (
            <button
              key={prefix}
              type="button"
              disabled={disabled}
              className={chipCls(formData.prefix === prefix)}
              onClick={() => set({ prefix })}
            >
              {prefix}
            </button>
          ))}
        </div>
      </FieldRow>

      <FieldRow n={2} label="ชื่อ-นามสกุล">
        <input
          type="text"
          placeholder="ชื่อ-นามสกุล"
          value={formData.fullName}
          disabled={disabled}
          onChange={(e) => set({ fullName: e.target.value })}
          className={inputCls}
        />
      </FieldRow>

      <FieldRow n={3} label="ที่อยู่" hint={<PrevHint year={prevYear} value={prev.address} />}>
        <textarea
          placeholder="บ้านเลขที่ / หมู่ / ถนน / ตำบล"
          value={formData.address}
          disabled={disabled}
          onChange={(e) => set({ address: e.target.value })}
          className={inputCls + ' min-h-[52px] resize-none'}
        />
      </FieldRow>

      <FieldRow n={4} label="เบอร์โทร">
        <input
          type="tel"
          inputMode="numeric"
          placeholder="เบอร์โทร 10 หลัก"
          value={formData.phone}
          maxLength={10}
          disabled={disabled}
          onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '') })}
          className={inputCls}
        />
      </FieldRow>

      <FieldRow n={5} label="หมายเหตุ">
        <textarea
          placeholder="หมายเหตุ (ถ้ามี)"
          value={formData.note}
          disabled={disabled}
          onChange={(e) => set({ note: e.target.value })}
          className={inputCls + ' min-h-[44px] resize-none'}
        />
      </FieldRow>

      <FieldRow n={6} label="สถานภาพที่อยู่" hint={<PrevHint year={prevYear} value={prev.housingStatus} />}>
        <div className="relative">
          <select
            value={formData.housingStatus}
            disabled={disabled}
            onChange={(e) => set({ housingStatus: e.target.value })}
            className={inputCls + ' appearance-none pr-10'}
          >
            <option value="ไม่ระบุ">ไม่ระบุ</option>
            <option value="ผู้อาศัย">ผู้อาศัย</option>
            <option value="เจ้าของ">เจ้าของ</option>
            <option value="บ้านเช่า">บ้านเช่า</option>
            <option value="อื่นๆ">อื่นๆ</option>
          </select>
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A8398]">⌄</span>
        </div>
      </FieldRow>

      <FieldRow n={7} label="จำนวนสมาชิกในบ้าน" hint={<PrevHint year={prevYear} value={prev.householdMembers} />}>
        <input
          type="number"
          inputMode="numeric"
          placeholder="จำนวนสมาชิก"
          value={formData.householdMembers}
          min="1"
          disabled={disabled}
          onChange={(e) => set({ householdMembers: e.target.value.replace(/\D/g, '') })}
          className={inputCls}
        />
      </FieldRow>

      <FieldRow n={8} label="รายได้ทั้งปี (บาท)" hint={<PrevHint year={prevYear} value={prev.annualIncome} />}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="รายได้ทั้งปี"
            value={formData.annualIncome}
            min="0"
            disabled={disabled}
            onChange={(e) => set({ annualIncome: e.target.value })}
            className={inputCls + ' flex-1'}
          />
          <button
            type="button"
            disabled={disabled || !formData.annualIncome}
            onClick={() => {
              const v = parseInt(formData.annualIncome) || 0;
              if (v > 0) set({ annualIncome: String(v * 12) });
            }}
            className="shrink-0 rounded-[12px] border-[1.5px] border-[#DDD2FB] bg-[#F1ECFB] px-3 py-3 text-[12px] font-bold text-[#7C3AED] transition hover:bg-[#DDD2FB] disabled:opacity-50"
            title="คูณ 12 (แปลงรายได้ต่อเดือนเป็นต่อปี)"
          >
            ×12
          </button>
        </div>
        {formData.annualIncome ? (
          <p className="mt-1.5 text-[10.5px] text-[#8A8398]">
            💡 หากกรอกรายได้ต่อเดือน กดปุ่ม ×12 เพื่อแปลงเป็นต่อปี
          </p>
        ) : null}
      </FieldRow>

      <FieldRow n={9} label="สถานศึกษา" hint={<PrevHint year={prevYear} value={prev.schoolName} />}>
        <input
          type="text"
          placeholder="ชื่อสถานศึกษา"
          value={formData.schoolName || ''}
          disabled={disabled}
          onChange={(e) => set({ schoolName: e.target.value })}
          className={inputCls}
        />
        {blockedHit && (
          <p className="mt-1 text-[11px] text-[#B91C1C]">
            ⚠️ โรงเรียนนี้เคยไม่ผ่านเกณฑ์ (เอกชน/นอกเขต) — โปรดตรวจสอบกับเจ้าหน้าที่
          </p>
        )}
      </FieldRow>

      <FieldRow n={10} label="ทะเบียนบ้าน">
        <p className="-mt-0.5 mb-2 text-[10.5px] leading-snug text-[#8A8398]">
          มีชื่อในทะเบียนบ้านในเขตเทศบาลเมืองตาคลีเกิน 1 ปีหรือไม่
        </p>
        <div className="flex gap-2">
          {[['ใช่', true], ['ไม่ใช่/ไม่แน่ใจ', false]].map(([label, val]) => (
            <button
              key={label}
              type="button"
              disabled={disabled}
              className={
                'flex-1 rounded-[12px] py-2.5 text-[12px] font-semibold transition ' +
                (formData.residencyOverOneYear === val
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-[#EDE7FD] text-[#8A8398] hover:bg-[#DDD2FB]')
              }
              onClick={() => set({ residencyOverOneYear: val })}
            >
              {label}
            </button>
          ))}
        </div>
      </FieldRow>
    </div>
  );
}
