import { describe, it, expect } from 'vitest';
import { computeLengthM, projectToUTM, bboxOf } from './geo';

describe('computeLengthM', () => {
  it('เส้นแนวตะวันออก-ตก 0.01 องศา ที่ตาคลี ≈ 1074 ม.', () => {
    // 111320 * cos(15.26°) * 0.01 ≈ 1074 ม.
    const len = computeLengthM([
      [100.3500, 15.2600],
      [100.3600, 15.2600],
    ]);
    expect(len).toBeGreaterThan(1060);
    expect(len).toBeLessThan(1085);
  });

  it('เส้นตรงแนวเหนือ-ใต้ 0.01 องศา ≈ 1106 ม.', () => {
    const len = computeLengthM([
      [100.3500, 15.2600],
      [100.3500, 15.2700],
    ]);
    expect(len).toBeGreaterThan(1095);
    expect(len).toBeLessThan(1120);
  });

  it('รวมความยาวหลาย segment', () => {
    const a = computeLengthM([[100.35, 15.26], [100.36, 15.26]]);
    const b = computeLengthM([[100.36, 15.26], [100.36, 15.27]]);
    const both = computeLengthM([
      [100.35, 15.26],
      [100.36, 15.26],
      [100.36, 15.27],
    ]);
    expect(both).toBeCloseTo(a + b, 1);
  });

  it('จุดเดียวได้ 0', () => {
    expect(computeLengthM([[100.35, 15.26]])).toBe(0);
  });

  it('array ว่างได้ 0', () => {
    expect(computeLengthM([])).toBe(0);
  });

  it('ปัดเป็น 2 ตำแหน่ง', () => {
    const len = computeLengthM([[100.35, 15.26], [100.36, 15.27]]);
    expect(Number(len.toFixed(2))).toBe(len);
  });
});

describe('projectToUTM', () => {
  it('ตาคลีอยู่ในโซน 47N → easting ประมาณ 6.4 แสน', () => {
    const [x, y] = projectToUTM([100.35, 15.26]);
    expect(x).toBeGreaterThan(600000);
    expect(x).toBeLessThan(700000);
    expect(y).toBeGreaterThan(1600000);
    expect(y).toBeLessThan(1720000);
  });
});

describe('bboxOf', () => {
  it('หลายจุด', () => {
    expect(
      bboxOf([[100.35, 15.26], [100.36, 15.27], [100.34, 15.20]])
    ).toEqual([100.34, 15.20, 100.36, 15.27]);
  });

  it('จุดเดียว', () => {
    expect(bboxOf([[100.35, 15.26]])).toEqual([100.35, 15.26, 100.35, 15.26]);
  });

  it('array ว่างต้อง throw', () => {
    expect(() => bboxOf([])).toThrow();
  });
});
