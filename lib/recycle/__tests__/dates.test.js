import { describe, expect, it } from 'vitest';
import { formatThaiDate, getBangkokYMD, isYMD } from '../dates';

describe('dates', () => {
  it('วันที่ตามเวลาไทย (ไม่ใช่ UTC)', () => {
    // 2026-11-18 20:00 UTC = 2026-11-19 03:00 เวลาไทย
    expect(getBangkokYMD(new Date('2026-11-18T20:00:00Z'))).toBe('2026-11-19');
    expect(isYMD('2026-11-19')).toBe(true);
  });
  it('แสดงวันที่แบบไทย พ.ศ.', () => {
    expect(formatThaiDate('2026-11-18')).toBe('18 พ.ย. 2569');
  });
});
