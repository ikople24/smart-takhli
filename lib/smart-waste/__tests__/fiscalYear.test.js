import { describe, expect, it } from 'vitest';
import {
  bangkokToday,
  fiscalMonths,
  fiscalYearOf,
  fiscalYearRange,
  isValidRecordDate,
  parseSheetName,
} from '../fiscalYear';

describe('fiscalYearOf', () => {
  it('เดือน ต.ค.–ธ.ค. นับเป็นปีงบถัดไป', () => {
    expect(fiscalYearOf('2025-10-01')).toBe(2569);
    expect(fiscalYearOf('2025-12-31')).toBe(2569);
  });

  it('เดือน ม.ค.–ก.ย. นับเป็นปีงบเดียวกับปี พ.ศ.', () => {
    expect(fiscalYearOf('2026-01-01')).toBe(2569);
    expect(fiscalYearOf('2026-08-11')).toBe(2569);
    expect(fiscalYearOf('2026-09-30')).toBe(2569);
  });

  it('รอยต่อ ก.ย. → ต.ค. ข้ามปีงบพอดี', () => {
    expect(fiscalYearOf('2025-09-30')).toBe(2568);
    expect(fiscalYearOf('2025-10-01')).toBe(2569);
  });
});

describe('fiscalYearRange', () => {
  it('ปีงบ 2569 = 1 ต.ค. 2025 ถึง 30 ก.ย. 2026', () => {
    expect(fiscalYearRange(2569)).toEqual({ start: '2025-10-01', end: '2026-09-30' });
  });

  it('ขอบเขตสอดคล้องกับ fiscalYearOf ทั้งสองฝั่ง', () => {
    const { start, end } = fiscalYearRange(2568);
    expect(fiscalYearOf(start)).toBe(2568);
    expect(fiscalYearOf(end)).toBe(2568);
  });
});

describe('fiscalMonths', () => {
  const months = fiscalMonths(2569);

  it('คืน 12 เดือน เริ่ม ต.ค. จบ ก.ย.', () => {
    expect(months).toHaveLength(12);
    expect(months[0].sheetName).toBe('ต.ค.68');
    expect(months[11].sheetName).toBe('ก.ย.69');
  });

  it('เดือน ต.ค.–ธ.ค. อยู่ในปี ค.ศ. ก่อนหน้า', () => {
    expect(months[0].key).toBe('2025-10');
    expect(months[2].key).toBe('2025-12');
    expect(months[3].key).toBe('2026-01');
  });

  it('daysInMonth ถูกต้องรวมถึงเดือน ก.พ.', () => {
    expect(months[0].daysInMonth).toBe(31); // ต.ค. 2025
    expect(months[4].daysInMonth).toBe(28); // ก.พ. 2026
  });

  it('ปีงบ 2567 ครอบ ก.พ. 2567 ที่เป็นปีอธิกสุรทิน (ค.ศ. 2024)', () => {
    const leap = fiscalMonths(2567);
    expect(leap[4].key).toBe('2024-02');
    expect(leap[4].daysInMonth).toBe(29);
  });
});

describe('parseSheetName', () => {
  it('อ่านชีตของไฟล์ปีงบ 2569 ได้ถูกปี ค.ศ.', () => {
    expect(parseSheetName('ต.ค.68')).toEqual({
      month: 10,
      year: 2025,
      beYear: 2568,
      fiscalYear: 2569,
    });
    expect(parseSheetName('ก.ย.69')).toEqual({
      month: 9,
      year: 2026,
      beYear: 2569,
      fiscalYear: 2569,
    });
  });

  it('อ่านชีตของไฟล์ปีงบ 2568 ได้', () => {
    expect(parseSheetName('ต.ค.67').fiscalYear).toBe(2568);
    expect(parseSheetName('ก.ย.68').fiscalYear).toBe(2568);
  });

  it('ไป-กลับกับ fiscalMonths ได้ค่าเดิม', () => {
    for (const month of fiscalMonths(2569)) {
      const parsed = parseSheetName(month.sheetName);
      expect(parsed.year).toBe(month.year);
      expect(parsed.month).toBe(month.month);
      expect(parsed.fiscalYear).toBe(2569);
    }
  });

  it('ชื่อชีตที่ไม่รู้จัก → throw ไม่เดามั่ว', () => {
    expect(() => parseSheetName('รวม')).toThrow();
    expect(() => parseSheetName('Sheet1')).toThrow();
    expect(() => parseSheetName('ม.ค')).toThrow();
  });
});

describe('isValidRecordDate', () => {
  it('รับเฉพาะ YYYY-MM-DD ที่มีอยู่จริง', () => {
    expect(isValidRecordDate('2026-08-11')).toBe(true);
    expect(isValidRecordDate('2024-02-29')).toBe(true);
  });

  it('ปฏิเสธวันที่ไม่มีอยู่จริงและรูปแบบผิด', () => {
    expect(isValidRecordDate('2025-02-30')).toBe(false);
    expect(isValidRecordDate('2025-13-01')).toBe(false);
    expect(isValidRecordDate('2025-1-1')).toBe(false);
    expect(isValidRecordDate('')).toBe(false);
    expect(isValidRecordDate(null)).toBe(false);
  });
});

describe('bangkokToday', () => {
  it('คืนวันที่ตามโซนกรุงเทพ ไม่ใช่ UTC', () => {
    // 2026-08-11T18:30:00Z = 12 ส.ค. 01:30 ที่กรุงเทพ (UTC+7)
    expect(bangkokToday(new Date('2026-08-11T18:30:00Z'))).toBe('2026-08-12');
    expect(bangkokToday(new Date('2026-08-11T02:00:00Z'))).toBe('2026-08-11');
  });
});
