import { describe, it, expect } from 'vitest';
import { derivePipeFields } from './service';

const baseGeometry = {
  type: 'LineString' as const,
  coordinates: [
    [100.35, 15.26],
    [100.36, 15.26],
  ] as [number, number][],
};

const base = {
  material: 'PVC' as const,
  diameter: { value: 4, unit: 'inch' as const },
  status: 'existing' as const,
  ownership: 'municipality' as const,
  lengthSource: 'computed' as const,
  geometry: baseGeometry,
};

describe('derivePipeFields', () => {
  it('สร้าง code จาก material + diameter', () => {
    expect(derivePipeFields(base).code).toBe('P4');
  });

  it('คำนวณ diameterMm', () => {
    expect(derivePipeFields(base).diameterMm).toBe(101.6);
  });

  it('คำนวณ lengthM จาก geometry', () => {
    const d = derivePipeFields(base);
    expect(d.lengthM).toBeGreaterThan(1060);
    expect(d.lengthM).toBeLessThan(1085);
  });

  it('เปลี่ยน geometry แล้ว lengthM ต้องเปลี่ยนตาม', () => {
    const short = derivePipeFields(base);
    const long = derivePipeFields({
      ...base,
      geometry: {
        type: 'LineString',
        coordinates: [
          [100.35, 15.26],
          [100.38, 15.26],
        ],
      },
    });
    expect(long.lengthM).toBeGreaterThan(short.lengthM * 2.5);
  });

  it('เปลี่ยน diameter แล้ว code ต้องเปลี่ยนตาม', () => {
    const a = derivePipeFields(base);
    const b = derivePipeFields({ ...base, diameter: { value: 8, unit: 'inch' } });
    expect(a.code).toBe('P4');
    expect(b.code).toBe('P8');
  });

  it('เก็บ bbox ไว้สำหรับ query', () => {
    expect(derivePipeFields(base).bbox).toEqual([100.35, 15.26, 100.36, 15.26]);
  });
});
