import { describe, expect, it } from 'vitest';
import {
  computeTotals,
  emptyGroupTotals,
  findHighValueEntries,
  HIGH_KG_WARNING_THRESHOLD,
  normalizeEntries,
  round2,
} from '../aggregate';
import { WASTE_TYPES_SEED } from '../wasteTypesSeed';

const TYPE_BY_KEY = new Map(WASTE_TYPES_SEED.map((type) => [type.key, type]));

// ยอดรวมเดือน ต.ค. 2568 จากไฟล์ "ขยะรีไซเคิลและขยะเปียก - 2569.xlsx" ชีต ต.ค.68 แถว "รวม"
const OCT_2568_TOTALS = {
  paper_mixed: 305,
  paper_carton: 179,
  paper_white_black: 19,
  plastic_mixed: 1312,
  plastic_pet: 1662,
  plastic_bottle_clear: 43,
  glass_clear: 1756,
  glass_amber: 1683,
  glass_green: 657,
  metal_tin_can: 733,
  aluminum_can: 30,
  steel_scrap: 126,
  food_waste_compost: 4626,
  plastic_soft_bag: 5265,
};

function entriesFrom(kgByTypeKey) {
  return Object.entries(kgByTypeKey).map(([typeKey, kg]) => ({
    typeKey,
    group: TYPE_BY_KEY.get(typeKey).group,
    kg,
  }));
}

describe('round2', () => {
  it('ตัดปัญหาทศนิยมลอยของ float', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(18396)).toBe(18396);
  });
});

describe('emptyGroupTotals', () => {
  it('เริ่มต้นทุกกลุ่มเป็น 0 ครบ 8 กลุ่ม', () => {
    const totals = emptyGroupTotals();
    expect(Object.keys(totals)).toHaveLength(8);
    expect(Object.values(totals).every((value) => value === 0)).toBe(true);
  });
});

describe('computeTotals', () => {
  it('ยอดกลุ่มของ ต.ค.68 ตรงกับชีต "รวม" ของไฟล์ต้นฉบับทุกกลุ่ม', () => {
    const { groupTotals, totalKg } = computeTotals(entriesFrom(OCT_2568_TOTALS));
    expect(groupTotals).toEqual({
      paper: 503,
      plastic: 8282,
      aluminum: 30,
      steel: 126,
      mixedMetal: 733,
      glass: 4096,
      foodWaste: 4626,
      kapok: 0,
    });
    expect(totalKg).toBe(18396);
  });

  it('ยอดรวมเท่ากับผลบวกของทุกกลุ่มเสมอ', () => {
    const { groupTotals, totalKg } = computeTotals(entriesFrom(OCT_2568_TOTALS));
    const sum = Object.values(groupTotals).reduce((acc, value) => acc + value, 0);
    expect(round2(sum)).toBe(totalKg);
  });

  it('ถุงอ่อนถูกนับรวมในกลุ่มพลาสติก ไม่แยกเป็นกลุ่มที่ 9', () => {
    const { groupTotals } = computeTotals(
      entriesFrom({ plastic_soft_bag: 100, plastic_pet: 50 })
    );
    expect(groupTotals.plastic).toBe(150);
    expect(Object.keys(groupTotals)).toHaveLength(8);
  });

  it('ข้ามค่าว่าง/ศูนย์/ติดลบ/ไม่ใช่ตัวเลข', () => {
    const { totalKg } = computeTotals([
      { typeKey: 'plastic_pet', group: 'plastic', kg: 10 },
      { typeKey: 'paper_mixed', group: 'paper', kg: 0 },
      { typeKey: 'glass_clear', group: 'glass', kg: -5 },
      { typeKey: 'kapok', group: 'kapok', kg: null },
      { typeKey: 'steel_scrap', group: 'steel', kg: 'abc' },
    ]);
    expect(totalKg).toBe(10);
  });

  it('entries ว่างหรือ undefined → ยอดเป็น 0 ทั้งหมด ไม่ throw', () => {
    expect(computeTotals([]).totalKg).toBe(0);
    expect(computeTotals(undefined).totalKg).toBe(0);
  });

  it('กลุ่มที่ไม่รู้จัก → throw ไม่ปล่อยให้ยอดหายเงียบ', () => {
    expect(() =>
      computeTotals([{ typeKey: 'copper', group: 'copper', kg: 5 }])
    ).toThrow(/copper/);
  });
});

describe('normalizeEntries', () => {
  it('เติม group จาก master และเรียงตาม order ของประเภท', () => {
    const entries = normalizeEntries(
      [
        { typeKey: 'plastic_soft_bag', kg: 223 },
        { typeKey: 'paper_mixed', kg: 64 },
      ],
      TYPE_BY_KEY
    );
    expect(entries).toEqual([
      { typeKey: 'paper_mixed', group: 'paper', kg: 64 },
      { typeKey: 'plastic_soft_bag', group: 'plastic', kg: 223 },
    ]);
  });

  it('ตัดช่องที่ว่าง/0 ทิ้ง ไม่เก็บลงฐานข้อมูล', () => {
    const entries = normalizeEntries(
      [
        { typeKey: 'plastic_pet', kg: 45 },
        { typeKey: 'kapok', kg: 0 },
        { typeKey: 'glass_green', kg: '' },
      ],
      TYPE_BY_KEY
    );
    expect(entries).toEqual([{ typeKey: 'plastic_pet', group: 'plastic', kg: 45 }]);
  });

  it('รวมค่าของ typeKey ที่ส่งซ้ำเข้าด้วยกัน', () => {
    const entries = normalizeEntries(
      [
        { typeKey: 'plastic_pet', kg: 10 },
        { typeKey: 'plastic_pet', kg: 5.5 },
      ],
      TYPE_BY_KEY
    );
    expect(entries).toEqual([{ typeKey: 'plastic_pet', group: 'plastic', kg: 15.5 }]);
  });

  it('typeKey ที่ไม่มีใน master → throw', () => {
    expect(() => normalizeEntries([{ typeKey: 'copper', kg: 5 }], TYPE_BY_KEY)).toThrow(
      /copper/
    );
  });
});

describe('findHighValueEntries', () => {
  it('เกณฑ์ 1,000 กก./ประเภท/วัน — ค่าสูงสุดที่เคยบันทึกจริงใน 2 ปีคือ 415', () => {
    expect(HIGH_KG_WARNING_THRESHOLD).toBe(1000);
  });

  it('คืนเฉพาะรายการที่เกินเกณฑ์', () => {
    const flagged = findHighValueEntries([
      { typeKey: 'plastic_pet', group: 'plastic', kg: 415 },
      { typeKey: 'food_waste_compost', group: 'foodWaste', kg: 4626 },
    ]);
    expect(flagged).toEqual([{ typeKey: 'food_waste_compost', kg: 4626 }]);
  });

  it('ไม่มีรายการเกินเกณฑ์ → array ว่าง', () => {
    expect(findHighValueEntries([{ typeKey: 'plastic_pet', group: 'plastic', kg: 1000 }])).toEqual(
      []
    );
  });
});
