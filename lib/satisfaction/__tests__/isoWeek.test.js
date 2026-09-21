// lib/satisfaction/__tests__/isoWeek.test.js
// helper ต้องให้ผลเดิมไม่ว่าเครื่องตั้ง TZ อะไร (dev = Bangkok, Railway = UTC)
import { describe, expect, it } from 'vitest';
import { isoWeekKey } from '../isoWeek';

describe('isoWeekKey (Asia/Bangkok)', () => {
  it('ข้ามสัปดาห์เพราะ timezone: อาทิตย์ 18:00Z = จันทร์ 01:00 Bangkok → สัปดาห์ถัดไป', () => {
    // 2026-09-06 เป็นวันอาทิตย์ (W36 ใน UTC) แต่ Bangkok เป็นจันทร์ 7 ก.ย. → W37
    expect(isoWeekKey(new Date('2026-09-06T18:00:00Z'))).toEqual({ year: 2026, week: 37, label: '2026-W37' });
  });

  it('จันทร์ 31 ส.ค. 2026 อยู่ W36', () => {
    expect(isoWeekKey(new Date('2026-08-31T03:00:00Z')).label).toBe('2026-W36');
  });

  it('ขอบปี: 29 ธ.ค. 2025 เป็นสัปดาห์ 1 ของ 2026', () => {
    expect(isoWeekKey(new Date('2025-12-29T00:00:00Z'))).toEqual({ year: 2026, week: 1, label: '2026-W01' });
  });

  it('ขอบปี: 3 ม.ค. 2027 ยังเป็นสัปดาห์ 53 ของ 2026 (ปี 2026 มี 53 สัปดาห์ ISO)', () => {
    expect(isoWeekKey(new Date('2027-01-03T00:00:00Z'))).toEqual({ year: 2026, week: 53, label: '2026-W53' });
  });

  it('label เติม 0 หน้าสัปดาห์ < 10', () => {
    expect(isoWeekKey(new Date('2026-01-26T00:00:00Z')).label).toBe('2026-W05');
  });

  it('รับ string/timestamp ได้ด้วย', () => {
    expect(isoWeekKey('2026-08-31T03:00:00Z').label).toBe('2026-W36');
    expect(isoWeekKey(Date.parse('2026-08-31T03:00:00Z')).label).toBe('2026-W36');
  });
});
