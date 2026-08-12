// components/smart-waste/wasteTheme.jsx
// จุด import เดียวของธีม smart-waste — token ทั้งหมดยืมจาก smart-school ตามสเปกข้อ 7
// (ไม่ fork ค่าสี ม่วง #7C3AED) · ถ้ามีโมดูลที่ 3 มายืมอีก ให้สกัดเป็น components/ui/adminTheme
// (บันทึกไว้ใน docs/modules/smart-waste.md แล้ว — รอบนี้ YAGNI)

export {
  FONT_DISPLAY, FONT_BODY, inputCls, labelCls, chipCls,
  primaryBtnCls, ghostBtnCls, successBtnCls,
} from '@/components/smart-school/survey/surveyTheme';

export {
  cardCls, tableHeadCls, StatCard, PillTabs, YearPills, DashboardHeader,
} from '@/components/smart-school/adminTheme';

// สีประจำ 8 กลุ่มขยะ — ตามลำดับ WASTE_GROUPS คงที่ ผ่าน dataviz validator บน #FAF8FF แล้ว
// (สี aqua/yellow/magenta contrast < 3:1 → แท็บสรุปต้องมีตารางยอดรายเดือนเป็น relief เสมอ)
// ห้ามเปลี่ยนสี/สลับลำดับโดยไม่รัน validator ใหม่
export const WASTE_GROUP_COLORS = {
  paper: '#2a78d6',
  plastic: '#eb6834',
  aluminum: '#1baf7a',
  steel: '#eda100',
  mixedMetal: '#e87ba4',
  glass: '#008300',
  foodWaste: '#4a3aa7',
  kapok: '#e34948',
};

// เส้นเทียบปีงบต่อปีงบ — ห้ามใช้เทา (fail chroma floor ของ validator)
export const YEAR_LINE_COLORS = { current: '#7C3AED', previous: '#eb6834' };

// ตัวเลขน้ำหนักทั้งโมดูล — คั่นหลักพัน ทศนิยมไม่เกิน 2
export function formatKg(value) {
  return Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
}
