import { describe, it, expect } from 'vitest';
import { parsePipeCode, buildPipeCode, toMm } from './pipe-code';

describe('parsePipeCode', () => {
  it('แปลง P4 เป็น PVC 4 นิ้ว', () => {
    const r = parsePipeCode('P4');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.material).toBe('PVC');
    expect(r.diameter).toEqual({ value: 4, unit: 'inch' });
    expect(r.diameterMm).toBe(101.6);
    expect(r.diameterBasis).toBe('nominal');
  });

  it('แปลง S400 เป็น SP 400 มม.', () => {
    const r = parsePipeCode('S400');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.material).toBe('SP');
    expect(r.diameter).toEqual({ value: 400, unit: 'mm' });
    expect(r.diameterMm).toBe(400);
  });

  it('แปลง R30 เป็น RCP 30 ซม. และเป็นขนาดภายใน', () => {
    const r = parsePipeCode('R30');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.material).toBe('RCP');
    expect(r.diameterMm).toBe(300);
    expect(r.diameterBasis).toBe('internal');
  });

  it('รับตัวพิมพ์เล็กและช่องว่าง', () => {
    const r = parsePipeCode('  a12 ');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.material).toBe('AC');
    expect(r.diameter.value).toBe(12);
  });

  it('รับทศนิยม เช่น G1.5', () => {
    const r = parsePipeCode('G1.5');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.diameter.value).toBe(1.5);
  });

  it('ปฏิเสธตัวอักษรที่ไม่รู้จัก', () => {
    expect(parsePipeCode('X4').ok).toBe(false);
  });

  it('ปฏิเสธรหัสที่ไม่มีตัวเลข', () => {
    expect(parsePipeCode('P').ok).toBe(false);
  });

  it('ปฏิเสธค่าว่าง', () => {
    expect(parsePipeCode('').ok).toBe(false);
  });
});

describe('buildPipeCode', () => {
  it('สร้าง P4 จาก PVC 4', () => {
    expect(buildPipeCode('PVC', 4)).toBe('P4');
  });

  it('สร้าง S400 จาก SP 400', () => {
    expect(buildPipeCode('SP', 400)).toBe('S400');
  });

  it('ตัด .0 ออกจากจำนวนเต็ม', () => {
    expect(buildPipeCode('PVC', 6.0)).toBe('P6');
  });

  it('คงทศนิยมไว้ถ้ามีจริง', () => {
    expect(buildPipeCode('GS', 1.5)).toBe('G1.5');
  });

  it('round-trip: parse แล้ว build ต้องได้ค่าเดิม', () => {
    for (const code of ['A6', 'G2', 'H110', 'P4', 'S400', 'R30']) {
      const r = parsePipeCode(code);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(buildPipeCode(r.material, r.diameter.value)).toBe(code);
    }
  });
});

describe('toMm', () => {
  it('นิ้ว → มม.', () => expect(toMm(6, 'inch')).toBe(152.4));
  it('ซม. → มม.', () => expect(toMm(30, 'cm')).toBe(300));
  it('มม. → มม.', () => expect(toMm(110, 'mm')).toBe(110));
});
