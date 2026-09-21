import React, { useEffect, useState } from 'react';
import { schoolsForLevel } from '@/lib/smart-school/schools';
import { inputCls } from './surveyTheme';

// ช่องเลือกสถานศึกษา — กรองตามระดับ (educationLevel); พิมพ์กรองได้ + "อื่นๆ ระบุเอง"
// ระดับที่ไม่มีในรายการ (ปวช/ปวส/ปริญญาตรี) → โหมดพิมพ์เองอัตโนมัติ
export default function SchoolPicker({ value, onChange, level, disabled, blockedSchools }) {
  const [query, setQuery] = useState('');
  const [forceManual, setForceManual] = useState(false);

  // เปลี่ยนระดับ → รีเซ็ตสถานะ picker (โรงเรียนคนละชุดต่อระดับ)
  useEffect(() => {
    setForceManual(false);
    setQuery('');
  }, [level]);

  // ยังไม่เลือกระดับ
  if (!level) {
    return (
      <div className="rounded-[14px] bg-[#F6F3FD] px-3.5 py-3 text-[12px] leading-relaxed text-[#8A8398]">
        กรุณาเลือก<b className="text-[#57506A]"> ระดับการศึกษา </b>ก่อน แล้วจะแสดงรายชื่อสถานศึกษาให้เลือก
      </div>
    );
  }

  const options = schoolsForLevel(level);
  const hasList = options.length > 0;
  const valueInList = options.includes(value);
  // พิมพ์เอง: ไม่มีรายการระดับนี้ / กดพิมพ์เอง / ค่าเดิมไม่อยู่ในรายการ (รายเก่า prefill)
  const manual = !hasList || forceManual || (!!value && !valueInList);

  if (manual) {
    const cleanSchool = (value || '').replace(/\s+/g, ' ').trim();
    const blockedHit = (blockedSchools || []).some((s) => s.name === cleanSchool);
    return (
      <div className="space-y-1.5">
        <input
          type="text"
          className={inputCls}
          placeholder="พิมพ์ชื่อสถานศึกษา"
          value={value || ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        {hasList && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => { setForceManual(false); setQuery(''); onChange(''); }}
            className="text-[11px] font-semibold text-[#7C3AED] hover:underline"
          >
            ← เลือกจากรายการแทน
          </button>
        )}
        {blockedHit && (
          <p className="mt-1 text-[11px] text-[#B91C1C]">
            ⚠️ โรงเรียนนี้เคยไม่ผ่านเกณฑ์ (เอกชน/นอกเขต) — โปรดตรวจสอบกับเจ้าหน้าที่
          </p>
        )}
      </div>
    );
  }

  // โหมดเลือกจากรายการ
  if (value) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 rounded-[14px] border-[1.5px] border-[#7C3AED] bg-white px-3.5 py-2.5 shadow-[0_0_0_3px_rgba(124,58,237,0.12)]">
          <span className="text-[15px]">🏫</span>
          <span className="flex-1 text-[13px] font-medium text-[#211B2E]">{value}</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange('')}
            className="text-[12px] font-semibold text-[#7C3AED] hover:underline"
          >
            เปลี่ยน
          </button>
        </div>
      </div>
    );
  }

  const q = query.trim();
  const filtered = q ? options.filter((n) => n.includes(q)) : options;
  return (
    <div className="space-y-1.5">
      <input
        type="text"
        className={inputCls}
        placeholder="พิมพ์เพื่อค้นหา หรือเลือกจากรายการ"
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="max-h-52 overflow-y-auto rounded-[14px] border border-[#E7E2F2] divide-y divide-[#F0ECF8]">
        {filtered.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => { onChange(n); setQuery(''); }}
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] text-[#211B2E] transition hover:bg-[#F6F3FD]"
          >
            <span className="text-[14px]">🏫</span>
            {n}
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="px-3.5 py-2.5 text-[12px] text-[#8A8398]">ไม่พบในรายการ</div>
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setForceManual(true)}
        className="text-[11px] font-semibold text-[#7C3AED] hover:underline"
      >
        ไม่พบในรายการ? พิมพ์ชื่อเอง
      </button>
    </div>
  );
}
