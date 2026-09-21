// components/smart-school/adminTheme.jsx
// จุด import เดิมของ smart-school — โทเคน/คอมโพเนนต์กลางย้ายไป components/ui/adminTheme แล้ว
// ไฟล์นี้เหลือเฉพาะ statusBadgeCls ที่ผูกกับสถานะใบสมัครของโมดูลนี้โดยตรง
export {
  FONT_DISPLAY, FONT_BODY, inputCls, labelCls, chipCls,
  primaryBtnCls, ghostBtnCls, successBtnCls,
  cardCls, tableHeadCls, StatCard, PillTabs, YearPills, DashboardHeader,
} from '@/components/ui/adminTheme';

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
