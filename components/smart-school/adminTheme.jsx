import React from 'react';
import {
  FONT_DISPLAY, FONT_BODY,
  inputCls, labelCls, chipCls,
  primaryBtnCls, ghostBtnCls, successBtnCls,
} from './survey/surveyTheme';

// re-export โทเคนร่วมจาก surveyTheme เพื่อให้ admin import ที่เดียว
export { FONT_DISPLAY, FONT_BODY, inputCls, labelCls, chipCls, primaryBtnCls, ghostBtnCls, successBtnCls };

// การ์ด shell ของ dashboard/แผง (radius 24 + เงานุ่ม)
export const cardCls =
  'bg-[#FAF8FF] border border-[#E7E2F2] rounded-[24px] shadow-[0_20px_50px_-30px_rgba(33,27,46,0.4)]';

// หัวตาราง/แถวโฮเวอร์
export const tableHeadCls = 'bg-[#F6F3FD] text-[12px] font-bold text-[#57506A]';

// สีสถานะใบสมัคร 4 ค่า → คลาส badge
const STATUS_BADGE = {
  'รับคำร้อง': 'bg-[#EDE7FD] text-[#6D28D9]',
  'ตรวจสอบแล้ว': 'bg-[#DDD2FB] text-[#6D28D9]',
  'ได้รับทุน': 'bg-[#DCFCE7] text-[#15803D]',
  'ไม่ผ่านเกณฑ์': 'bg-[#F1F1F4] text-[#6B7280]',
};
export function statusBadgeCls(status) {
  return (
    'inline-block text-[11.5px] font-semibold px-2.5 py-1 rounded-full ' +
    (STATUS_BADGE[status] || 'bg-[#F1F1F4] text-[#6B7280]')
  );
}

// การ์ดสถิติ — tone: 'purple' (เต็ม) | 'green' | 'gray' | 'deep' | 'default'
export function StatCard({ value, label, tone = 'default' }) {
  const filled = tone === 'purple';
  const valueColor = { green: '#16A34A', gray: '#9CA3AF', deep: '#6D28D9' }[tone];
  return (
    <div className={'rounded-[18px] p-4 ' + (filled ? 'bg-[#7C3AED] text-white' : 'bg-white border border-[#E7E2F2]')}>
      <div className="text-[30px] font-bold leading-none"
        style={{ fontFamily: FONT_DISPLAY, color: filled ? undefined : valueColor }}>
        {value}
      </div>
      <div className={'text-[12px] mt-1.5 ' + (filled ? 'text-white/85' : 'text-[#8A8398]')}>{label}</div>
    </div>
  );
}

// แถบแท็บ pill — tabs: [{key,label}]
export function PillTabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 bg-[#F1ECFB] p-1.5 rounded-[14px] w-fit">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button key={t.key} type="button" onClick={() => onChange(t.key)}
            className={'text-[13px] px-4 py-2 rounded-[10px] font-semibold transition ' +
              (on ? 'bg-white text-[#7C3AED] shadow-[0_2px_6px_-2px_rgba(124,58,237,0.3)]' : 'text-[#8A8398] hover:text-[#6D28D9]')}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// pill ปีงบ — years: number[], value: number, onChange(y)
export function YearPills({ years, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-[#8A8398]">ปีงบ:</span>
      {years.map((y) => (
        <button key={y} type="button" onClick={() => onChange(y)}
          className={'text-[13px] px-4 py-1.5 rounded-full font-semibold transition ' +
            (y === value ? 'bg-[#7C3AED] text-white' : 'bg-white border border-[#E7E2F2] text-[#57506A] hover:border-[#7C3AED]')}>
          {y}
        </button>
      ))}
    </div>
  );
}

// หัว dashboard — right = node (เช่น <YearPills/>)
export function DashboardHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-center gap-3.5 mb-5">
      <span className="w-11 h-11 rounded-[14px] bg-[#7C3AED] text-white grid place-items-center text-[22px]"
        style={{ fontFamily: FONT_DISPLAY }}>📚</span>
      <div>
        <div className="text-[19px] font-bold" style={{ fontFamily: FONT_DISPLAY }}>{title}</div>
        {subtitle && <div className="text-[12px] text-[#8A8398]">{subtitle}</div>}
      </div>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}
