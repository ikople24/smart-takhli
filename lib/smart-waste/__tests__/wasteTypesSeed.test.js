import { describe, expect, it } from 'vitest';
import { WASTE_TYPES_SEED, LEGACY_HEADER_ALIASES } from '../wasteTypesSeed';
import { isWasteGroupKey } from '../wasteGroups';

describe('wasteTypesSeed', () => {
  it('มี 24 ประเภท ตรงกับจำนวนคอลัมน์ในไฟล์ต้นฉบับ', () => {
    expect(WASTE_TYPES_SEED).toHaveLength(24);
  });

  it('order เป็น 1..24 ไม่ซ้ำ ไม่ข้าม (คุมลำดับคอลัมน์ตอน export)', () => {
    const orders = WASTE_TYPES_SEED.map((type) => type.order).sort((a, b) => a - b);
    expect(orders).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });

  it('key ไม่ซ้ำ และ label ไม่ซ้ำ', () => {
    expect(new Set(WASTE_TYPES_SEED.map((t) => t.key)).size).toBe(24);
    expect(new Set(WASTE_TYPES_SEED.map((t) => t.label)).size).toBe(24);
  });

  it('ทุกประเภทอยู่ในกลุ่มที่มีอยู่จริง', () => {
    for (const type of WASTE_TYPES_SEED) {
      expect(isWasteGroupKey(type.group), `${type.key} → ${type.group}`).toBe(true);
    }
  });

  it('มี 7 ประเภทที่ติดธง isCommon ตามพฤติกรรมการกรอกจริง', () => {
    const common = WASTE_TYPES_SEED.filter((t) => t.isCommon).map((t) => t.key);
    expect(common.sort()).toEqual(
      [
        'plastic_mixed',
        'plastic_pet',
        'glass_clear',
        'glass_amber',
        'metal_tin_can',
        'food_waste_compost',
        'plastic_soft_bag',
      ].sort()
    );
  });

  it('ถุงอ่อนเป็นประเภทเดียวที่ติดธง isHighlighted ตอนเริ่มระบบ', () => {
    const highlighted = WASTE_TYPES_SEED.filter((t) => t.isHighlighted).map((t) => t.key);
    expect(highlighted).toEqual(['plastic_soft_bag']);
  });

  it('ถุงอ่อนอยู่ในกลุ่มพลาสติก (ไม่ใช่กลุ่มที่ 9)', () => {
    const softBag = WASTE_TYPES_SEED.find((t) => t.key === 'plastic_soft_bag');
    expect(softBag.group).toBe('plastic');
  });

  it('ใช้ชื่อ "เปลือกสายไฟ" ไม่ใช่ "สายไฟ" — คอลัมน์นี้ถูกนับเป็นพลาสติกในไฟล์ต้นฉบับ', () => {
    const sheath = WASTE_TYPES_SEED.find((t) => t.key === 'plastic_wire_sheath');
    expect(sheath.label).toBe('เปลือกสายไฟ');
    expect(sheath.group).toBe('plastic');
    expect(WASTE_TYPES_SEED.some((t) => t.label === 'สายไฟ')).toBe(false);
  });

  it('alias ของหัวคอลัมน์ในไฟล์เก่าชี้ไปที่ประเภทที่มีอยู่จริง', () => {
    expect(LEGACY_HEADER_ALIASES['สายไฟ']).toBe('plastic_wire_sheath');
    for (const key of Object.values(LEGACY_HEADER_ALIASES)) {
      expect(WASTE_TYPES_SEED.some((t) => t.key === key)).toBe(true);
    }
  });
});
