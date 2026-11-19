import { describe, expect, it } from 'vitest';
import { normalizeDepositItems, normalizeMemberInput, parseKg } from '../validate';

describe('parseKg', () => {
  it('ปัดทศนิยม 2 ตำแหน่ง และตัดค่าว่าง/ติดลบ/ไม่ใช่ตัวเลข', () => {
    expect(parseKg('2.345')).toBe(2.35);
    expect(parseKg('')).toBeNull();
    expect(parseKg('-1')).toBeNull();
    expect(parseKg('abc')).toBeNull();
  });
});

describe('normalizeDepositItems', () => {
  it('ตัดช่องว่าง/0 ทิ้ง และรวมยอด', () => {
    const r = normalizeDepositItems({ plastic_pet: '2.4', paper_box: '5', metal_can: '', glass_bottle: '0' });
    expect(r.errors).toEqual([]);
    expect(r.totalKg).toBe(7.4);
    expect(r.items.map((i) => i.type)).toEqual(['plastic_pet', 'paper_box']);
  });
  it('ไม่มีปัญหาทศนิยมลอย 0.1 + 0.2', () => {
    expect(normalizeDepositItems({ plastic_pet: '0.1', plastic_hdpe: '0.2' }).totalKg).toBe(0.3);
  });
  it('รวมประเภทซ้ำ (รูปแบบ array)', () => {
    const r = normalizeDepositItems([{ type: 'plastic_pet', kg: 1 }, { type: 'plastic_pet', kg: 2 }]);
    expect(r.items).toEqual([{ type: 'plastic_pet', kg: 3 }]);
  });
  it('แจ้ง error: ว่างทั้งหมด / ไม่รู้จักประเภท / ไม่ใช่ตัวเลข / เกินเพดาน', () => {
    expect(normalizeDepositItems({}).errors).toHaveLength(1);
    expect(normalizeDepositItems({ bogus: '1' }).errors[0]).toMatch(/ไม่รู้จัก/);
    expect(normalizeDepositItems({ plastic_pet: 'abc' }).errors[0]).toMatch(/ไม่ถูกต้อง/);
    expect(normalizeDepositItems({ plastic_pet: '5000' }).errors[0]).toMatch(/ไม่เกิน/);
  });
});

describe('normalizeMemberInput', () => {
  it('ตัดอักขระในเบอร์โทร และตรวจชื่อ/เบอร์', () => {
    const ok = normalizeMemberInput({ fullName: '  สมใจ ', phone: '081-234-5678' });
    expect(ok.errors).toEqual([]);
    expect(ok.data).toMatchObject({ fullName: 'สมใจ', phone: '0812345678' });
    expect(normalizeMemberInput({ fullName: '', phone: '123' }).errors).toHaveLength(2);
  });
});
