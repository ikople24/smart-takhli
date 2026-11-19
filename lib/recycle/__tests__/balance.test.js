import { describe, expect, it } from 'vitest';
import { buildRedemptionItems, getBalanceKg, getRewardProgress, normalizeRewardInput } from '../balance';

const rewards = [
  { _id: 'a', name: 'น้ำยาล้างจาน', kgCost: 5, unit: 'ขวด', stock: 2, isActive: true },
  { _id: 'b', name: 'ไข่ไก่', kgCost: 2.5, unit: 'แผง', stock: null, isActive: true },
  { _id: 'c', name: 'ปิดแล้ว', kgCost: 1, isActive: false },
];

describe('getBalanceKg', () => {
  it('คงเหลือ = ฝากทั้งหมด − แลกไปแล้ว', () => {
    expect(getBalanceKg({ totalKg: 10.3, redeemedKg: 5.1 })).toBe(5.2);
    expect(getBalanceKg({ totalKg: 3 })).toBe(3);
  });
});

describe('buildRedemptionItems', () => {
  it('คิดยอดและเก็บ snapshot ชื่อ/ราคา', () => {
    const r = buildRedemptionItems({ a: 1, b: 2 }, rewards);
    expect(r.errors).toEqual([]);
    expect(r.totalKg).toBe(10);
    expect(r.items[0]).toMatchObject({ name: 'น้ำยาล้างจาน', qty: 1, subtotalKg: 5 });
  });
  it('ปฏิเสธ: เกินสต็อก / ปิดแลก / ไม่พบ / จำนวนไม่ใช่จำนวนเต็ม / ไม่เลือกเลย', () => {
    expect(buildRedemptionItems({ a: 3 }, rewards).errors[0]).toMatch(/เหลือ 2/);
    expect(buildRedemptionItems({ c: 1 }, rewards).errors[0]).toMatch(/ปิด/);
    expect(buildRedemptionItems({ zz: 1 }, rewards).errors[0]).toMatch(/ไม่พบ/);
    expect(buildRedemptionItems({ b: 1.5 }, rewards).errors[0]).toMatch(/จำนวน/);
    expect(buildRedemptionItems({ b: 0 }, rewards).errors[0]).toMatch(/อย่างน้อย/);
  });
});

describe('normalizeRewardInput', () => {
  it('stock ว่าง = ไม่จำกัด, หน่วยเริ่มต้น = ชิ้น', () => {
    const r = normalizeRewardInput({ name: 'สบู่', kgCost: '3', stock: '' });
    expect(r.errors).toEqual([]);
    expect(r.data).toMatchObject({ stock: null, unit: 'ชิ้น', kgCost: 3 });
    expect(normalizeRewardInput({ name: '', kgCost: '0', stock: '1.5' }).errors).toHaveLength(3);
  });
});

describe('getRewardProgress', () => {
  const R = [
    { name: 'สบู่', kgCost: 2, stock: 30 },
    { name: 'น้ำมัน', kgCost: 9, stock: 6 },
    { name: 'ข้าว', kgCost: 35, stock: 4 },
    { name: 'ถุงผ้า', kgCost: 3, stock: 0 },
  ];
  it('ของชิ้นถัดไป = ถูกที่สุดที่ยังแลกไม่ได้ (ข้ามของหมด)', () => {
    const p = getRewardProgress(5, R);
    expect(p.next).toMatchObject({ name: 'น้ำมัน', missingKg: 4, pct: 56 });
    expect(p.goal.name).toBe('ข้าว');
  });
  it('ไม่แสดง goal ซ้ำกับ next', () => {
    const p = getRewardProgress(18.6, R);
    expect(p.next.name).toBe('ข้าว');
    expect(p.goal).toBeNull();
  });
  it('แลกได้ทุกชิ้นแล้ว', () => {
    const p = getRewardProgress(50, R);
    expect(p.next).toBeNull();
    expect(p.allAffordable).toBe(true);
  });
});
