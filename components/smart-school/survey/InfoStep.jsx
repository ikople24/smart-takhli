import React from 'react';
import { inputCls, labelCls, chipCls } from './surveyTheme';
import SchoolPicker from './SchoolPicker';
// import จาก lib ไม่ใช่ models/ — ไฟล์ model นั้น import mongoose ทั้งก้อน ถ้า client component import ตรง ๆ
// mongoose จะถูกลากเข้า client bundle (วัดจริง: First Load JS หน้าแรกพุ่งจาก 328 kB เป็น 586 kB)
import { FAMILY_STATUS_OPTIONS } from '@/lib/smart-school/familyStatusOptions';
import { gradesForLevel, gradeOptionsWithCurrent } from '@/lib/smart-school/gradeLevels';

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
export default function InfoStep({ formData, setFormData, prevApplication, prevYear, disabled, blockedSchools, fullMode, setFullMode }) {
  const set = (patch) => setFormData({ ...formData, ...patch });
  const prev = prevApplication || {};
  // ระดับชั้น: ตัวเลือกกรองตามระดับการศึกษา; ค่าเดิมที่ไม่ตรงมาตรฐาน (ข้อมูลเก่า) โชว์เป็นตัวเลือกเพิ่ม ไม่ให้หาย
  const curGrade = formData.gradeLevel || '';
  const gradeOptions = gradeOptionsWithCurrent(formData.educationLevel, curGrade);

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
        <SchoolPicker
          value={formData.schoolName || ''}
          onChange={(schoolName) => set({ schoolName })}
          level={formData.educationLevel}
          disabled={disabled}
          blockedSchools={blockedSchools}
        />
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

      <label className="flex cursor-pointer items-center gap-2 rounded-[14px] bg-[#F6F3FD] px-3.5 py-3">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-[#E7E2F2] accent-[#7C3AED]"
          checked={!!fullMode}
          disabled={disabled}
          onChange={(e) => setFullMode(e.target.checked)}
        />
        <span className="text-[12px] font-bold text-[#57506A]">กรอกแบบเต็ม (ทวนข้อมูล)</span>
      </label>

      {fullMode && (
        <>
          <FieldRow n={11} label="ระดับชั้น" hint={<PrevHint year={prevYear} value={prev.gradeLevel} />}>
            {gradesForLevel(formData.educationLevel).length === 0 && !curGrade ? (
              <div className="rounded-[14px] bg-[#F6F3FD] px-3.5 py-3 text-[12px] leading-relaxed text-[#8A8398]">
                เลือก<b className="text-[#57506A]"> ระดับการศึกษา </b>ก่อน แล้วจะแสดงระดับชั้นให้เลือก
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {gradeOptions.map((g) => (
                  <button key={g} type="button" disabled={disabled} className={chipCls(curGrade === g)}
                    onClick={() => set({ gradeLevel: curGrade === g ? '' : g })}>
                    {g}
                  </button>
                ))}
              </div>
            )}
          </FieldRow>

          <FieldRow n={12} label="เกรดเฉลี่ย (GPA)" hint={<PrevHint year={prevYear} value={prev.gpa} />}>
            <input type="number" step="0.01" min="0" max="4" placeholder="0.00–4.00" className={inputCls}
              disabled={disabled} value={formData.gpa ?? ''} onChange={(e) => set({ gpa: e.target.value })} />
          </FieldRow>

          <FieldRow n={13} label="ที่อยู่จริง (ถ้าต่างจากทะเบียนบ้าน)" hint={<PrevHint year={prevYear} value={prev.actualAddress} />}>
            <textarea placeholder="ที่อยู่ที่พักอาศัยจริง" className={inputCls} disabled={disabled}
              value={formData.actualAddress || ''} onChange={(e) => set({ actualAddress: e.target.value })} />
          </FieldRow>

          <FieldRow n={14} label="สถานะครอบครัว">
            <div className="flex flex-wrap gap-1.5">
              {FAMILY_STATUS_OPTIONS.map((opt) => {
                const on = (formData.familyStatus || []).includes(opt);
                return (
                  <button key={opt} type="button" disabled={disabled} className={chipCls(on)}
                    onClick={() => set({
                      familyStatus: on
                        ? (formData.familyStatus || []).filter((v) => v !== opt)
                        : [...(formData.familyStatus || []), opt],
                    })}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </FieldRow>

          <FieldRow n={15} label="แหล่งรายได้ (คั่นด้วย ,)" hint={<PrevHint year={prevYear} value={(prev.incomeSource || []).join(', ')} />}>
            <input type="text" placeholder="เช่น รับจ้าง, ค้าขาย" className={inputCls} disabled={disabled}
              value={formData.incomeSourceText || ''} onChange={(e) => set({ incomeSourceText: e.target.value })} />
          </FieldRow>

          <FieldRow n={16} label="ทุนอื่นที่ได้รับ (คั่นด้วย ,)" hint={<PrevHint year={prevYear} value={(prev.receivedScholarship || []).join(', ')} />}>
            <input type="text" placeholder="เช่น กสศ., ทุนโรงเรียน" className={inputCls} disabled={disabled}
              value={formData.receivedScholarshipText || ''} onChange={(e) => set({ receivedScholarshipText: e.target.value })} />
          </FieldRow>

          <FieldRow n={17} label="ทุนเทศบาลที่เคยได้ (คั่นด้วย ,)" hint={<PrevHint year={prevYear} value={(prev.takhliScholarshipHistory || []).join(', ')} />}>
            <input type="text" placeholder="เช่น 2567, 2568" className={inputCls} disabled={disabled}
              value={formData.takhliScholarshipHistoryText || ''} onChange={(e) => set({ takhliScholarshipHistoryText: e.target.value })} />
          </FieldRow>
        </>
      )}
    </div>
  );
}
