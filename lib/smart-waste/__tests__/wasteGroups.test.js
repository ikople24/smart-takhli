import { describe, expect, it } from 'vitest';
import {
  WASTE_GROUPS,
  WASTE_GROUP_KEYS,
  isWasteGroupKey,
  wasteGroupLabel,
} from '../wasteGroups';

describe('wasteGroups', () => {
  it('8 กลุ่มแรกเรียงตามลำดับแถวในชีต "รวม" ของไฟล์ต้นฉบับ + electronic ต่อท้าย', () => {
    // electronic เพิ่ม 2026-08 — ต้องอยู่ "ท้ายสุด" เสมอ เพื่อไม่ให้แถวรายงาน
    // 8 กลุ่มเดิมขยับตำแหน่ง (ไฟล์ export ปีเก่าต้องเทียบกับไฟล์ต้นฉบับได้)
    expect(WASTE_GROUP_KEYS).toEqual([
      'paper',
      'plastic',
      'aluminum',
      'steel',
      'mixedMetal',
      'glass',
      'foodWaste',
      'kapok',
      'electronic',
    ]);
  });

  it('key ทุกตัวใช้ camelCase เพราะถูกใช้เป็น field name ของ groupTotals ใน Mongo', () => {
    for (const key of WASTE_GROUP_KEYS) {
      expect(key).toMatch(/^[a-z][a-zA-Z]*$/);
    }
  });

  it('ทุกกลุ่มมี label ภาษาไทย', () => {
    expect(WASTE_GROUPS).toHaveLength(9);
    for (const group of WASTE_GROUPS) {
      expect(group.label.length).toBeGreaterThan(0);
    }
    expect(wasteGroupLabel('foodWaste')).toBe('เศษอาหาร');
    expect(wasteGroupLabel('electronic')).toBe('ขยะอิเล็กทรอนิกส์');
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
