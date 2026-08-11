import { describe, expect, it } from 'vitest';
import {
  WASTE_GROUPS,
  WASTE_GROUP_KEYS,
  isWasteGroupKey,
  wasteGroupLabel,
} from '../wasteGroups';

describe('wasteGroups', () => {
  it('มี 8 กลุ่ม เรียงตามลำดับแถวในชีต "รวม" ของไฟล์ต้นฉบับ', () => {
    expect(WASTE_GROUP_KEYS).toEqual([
      'paper',
      'plastic',
      'aluminum',
      'steel',
      'mixedMetal',
      'glass',
      'foodWaste',
      'kapok',
    ]);
  });

  it('key ทุกตัวใช้ camelCase เพราะถูกใช้เป็น field name ของ groupTotals ใน Mongo', () => {
    for (const key of WASTE_GROUP_KEYS) {
      expect(key).toMatch(/^[a-z][a-zA-Z]*$/);
    }
  });

  it('ทุกกลุ่มมี label ภาษาไทย', () => {
    expect(WASTE_GROUPS).toHaveLength(8);
    for (const group of WASTE_GROUPS) {
      expect(group.label.length).toBeGreaterThan(0);
    }
    expect(wasteGroupLabel('foodWaste')).toBe('เศษอาหาร');
  });

  it('isWasteGroupKey คัดกรอง key ที่ไม่รู้จัก', () => {
    expect(isWasteGroupKey('plastic')).toBe(true);
    expect(isWasteGroupKey('copper')).toBe(false);
    expect(isWasteGroupKey('')).toBe(false);
  });

  it('wasteGroupLabel คืน key เดิมเมื่อไม่รู้จัก (ไม่ throw)', () => {
    expect(wasteGroupLabel('copper')).toBe('copper');
  });
});
