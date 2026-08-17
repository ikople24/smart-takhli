// components/smart-waste/entry/TypePickerSheet.jsx
import React, { useMemo, useState } from 'react';
import { WASTE_GROUPS } from '@/lib/smart-waste/wasteGroups';
import { inputCls } from '../wasteTheme';

// bottom sheet เลือกประเภทที่ไม่ใช่ "กรอกบ่อย" เข้าฟอร์ม — จัดกลุ่มตามกลุ่มใหญ่
export default function TypePickerSheet({ open, types, selectedKeys, onPick, onClose }) {
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const q = query.trim();
    return WASTE_GROUPS.map((group) => ({
      ...group,
      types: types.filter(
        (type) => type.group === group.key && (!q || type.label.includes(q))
      ),
    })).filter((group) => group.types.length > 0);
  }, [types, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[80vh] bg-white rounded-t-[24px]
        sm:rounded-[24px] flex flex-col">
        <div className="p-4 pb-2 border-b border-[#E7E2F2]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[15px] font-bold text-[#211B2E]">เพิ่มประเภทขยะ</p>
            <button type="button" onClick={onClose} aria-label="ปิด"
              className="grid h-8 w-8 place-items-center rounded-full text-[#8A8398] hover:bg-[#F1ECFB]">✕</button>
          </div>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาประเภท…" className={inputCls} />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {grouped.length === 0 && (
            <p className="text-center text-[13px] text-[#8A8398] py-6">ไม่พบประเภทที่ค้นหา</p>
          )}
          {grouped.map((group) => (
            <div key={group.key}>
              <p className="text-[11px] font-bold text-[#57506A] mb-1.5">{group.label}</p>
              <div className="flex flex-wrap gap-2">
                {group.types.map((type) => {
                  const added = selectedKeys.includes(type.key);
                  return (
                    <button key={type.key} type="button" disabled={added}
                      onClick={() => { onPick(type.key); onClose(); }}
                      className={'text-[13px] px-3.5 py-2 rounded-full font-semibold transition ' +
                        (added
                          ? 'bg-[#F1F1F4] text-[#B9B0C9] cursor-not-allowed'
                          : 'bg-[#EDE7FD] text-[#6D28D9] hover:bg-[#DDD2FB]')}>
                      {added ? '✓ ' : '+ '}{type.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
