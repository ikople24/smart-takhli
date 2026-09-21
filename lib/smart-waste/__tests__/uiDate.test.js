import { describe, expect, it } from 'vitest';
import {
  addDays, thaiDateLabel, nextEntryDate, listFiscalYears, mergeFiscalYears, draftKey,
  FIRST_FISCAL_YEAR,
} from '../uiDate';

describe('mergeFiscalYears', () => {
  it('รวมปีจากข้อมูลจริง (เช่น คีย์ย้อนหลังปี 2566-2567) เข้ากับช่วงมาตรฐาน เรียงใหม่→เก่า', () => {
    expect(mergeFiscalYears([2566, 2567], '2026-08-12')).toEqual([2569, 2568, 2567, 2566]);
  });
  it('ไม่มีปีนอกช่วง → ได้ช่วงมาตรฐานเดิม', () => {
    expect(mergeFiscalYears([], '2026-08-12')).toEqual([2569, 2568]);
    expect(mergeFiscalYears([2569, 2568], '2026-08-12')).toEqual([2569, 2568]);
  });
  it('ปีอนาคต/ค่าขยะจาก DB ถูกกรองทิ้ง ไม่ทำ pills พัง', () => {
    expect(mergeFiscalYears([2599, null, '2566', 2567.5], '2026-08-12')).toEqual([2569, 2568]);
  });
});

describe('addDays', () => {
  it('ข้ามเดือน/ปีถูกต้อง (คิดแบบ UTC ไม่โดน timezone)', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29'); // leap year
  });
});

describe('thaiDateLabel', () => {
  it('แสดง วัน เดือนย่อไทย ปี พ.ศ.', () => {
    expect(thaiDateLabel('2026-08-11')).toBe('11 ส.ค. 2569');
    expect(thaiDateLabel('2025-10-01')).toBe('1 ต.ค. 2568');
  });
});

describe('nextEntryDate', () => {
  it('บันทึกวันย้อนหลัง → เลื่อนไปวันถัดไป', () => {
    expect(nextEntryDate('2026-08-01', '2026-08-11')).toBe('2026-08-02');
  });
  it('บันทึกวันนี้ → ค้างที่วันนี้ (ห้ามเลื่อนเป็นวันอนาคต)', () => {
    expect(nextEntryDate('2026-08-11', '2026-08-11')).toBe('2026-08-11');
  });
  it('เมื่อวาน → วันนี้', () => {
    expect(nextEntryDate('2026-08-10', '2026-08-11')).toBe('2026-08-11');
  });
});

describe('listFiscalYears', () => {
  it('ไล่จากปีงบปัจจุบันลงไปถึงปีแรกที่มีข้อมูล (2568)', () => {
    expect(listFiscalYears('2026-08-12')).toEqual([2569, 2568]);
    expect(listFiscalYears('2026-10-01')).toEqual([2570, 2569, 2568]); // ต.ค. = ขึ้นปีงบใหม่
  });
  it('FIRST_FISCAL_YEAR คือ 2568', () => {
    expect(FIRST_FISCAL_YEAR).toBe(2568);
  });
});

describe('draftKey', () => {
  it('ตรงรูปแบบ key ใน localStorage ตามสเปกข้อ 7.2', () => {
    expect(draftKey('2026-08-11')).toBe('smart-waste-draft-2026-08-11');
  });
});
