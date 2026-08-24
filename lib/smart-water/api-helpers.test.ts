import { describe, it, expect } from 'vitest';
import type { NextApiRequest } from 'next';
import { parseBBox, toFeatureCollection } from './api-helpers';

const reqWith = (bbox: unknown) => ({ query: { bbox } } as unknown as NextApiRequest);

describe('parseBBox', () => {
  it('แปลง bbox ปกติ', () => {
    expect(parseBBox(reqWith('100.3,15.2,100.4,15.3'))).toEqual([100.3, 15.2, 100.4, 15.3]);
  });

  it('ปฏิเสธช่องว่าง (Number("") คือ 0 ห้ามหลุด)', () => {
    expect(parseBBox(reqWith('1,,3,4'))).toBeUndefined();
  });

  it('ปฏิเสธพิกัดนอกช่วงโลก', () => {
    expect(parseBBox(reqWith('-200,-100,200,100'))).toBeUndefined();
  });

  it('ปฏิเสธจำนวนไม่ครบ 4 ค่า', () => {
    expect(parseBBox(reqWith('1,2,3'))).toBeUndefined();
  });
});

describe('toFeatureCollection', () => {
  it('doc ไม่มี geometry ได้ geometry: null (GeoJSON valid)', () => {
    const fc = toFeatureCollection([{ _id: 'x', name: 'a' }]);
    expect(fc.features[0].geometry).toBeNull();
  });
});
