// components/smart-waste/entry/TotalBar.jsx
import React from 'react';
import { primaryBtnCls, formatKg } from '../wasteTheme';

// แถบรวมยอด + ปุ่มบันทึก ติดล่างจอ อัปเดตสดขณะพิมพ์ (สเปกข้อ 7.2)
export default function TotalBar({ totalKg, saving, editing, onSave }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 sm:mx-0 px-4 py-3 bg-white/95 backdrop-blur
      border-t border-[#E7E2F2] sm:rounded-b-[24px] flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-[#8A8398]">รวมทั้งวัน</div>
        <div className="text-[22px] font-bold text-[#211B2E] leading-none truncate">
          {formatKg(totalKg)} กก.
        </div>
      </div>
      <button type="button" onClick={onSave} disabled={saving}
        className={primaryBtnCls + ' min-w-[132px] shrink-0'}>
        {saving ? 'กำลังบันทึก…' : editing ? 'บันทึกการแก้ไข' : 'บันทึก'}
      </button>
    </div>
  );
}
