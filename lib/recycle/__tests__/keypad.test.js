import { describe, expect, it } from 'vitest';
import { applyKey } from '../keypad';

const press = (keys) => keys.reduce((v, k) => applyKey(v, k), '');

describe('applyKey', () => {
  it('พิมพ์ทศนิยมได้ 1 จุด ไม่เกิน 2 ตำแหน่ง', () => {
    expect(press(['2', '.', '4'])).toBe('2.4');
    expect(press(['.', '5'])).toBe('0.5');
    expect(press(['1', '.', '2', '3', '4'])).toBe('1.23');
    expect(press(['1', '.', '.'])).toBe('1.');
  });
  it('ตัด 0 นำหน้า และจำนวนเต็มไม่เกิน 4 หลัก', () => {
    expect(press(['0', '7'])).toBe('7');
    expect(press(['1', '2', '3', '4', '5'])).toBe('1234');
  });
  it('ลบ / ล้าง / ปุ่มที่ไม่รู้จัก', () => {
    expect(press(['5', 'del'])).toBe('');
    expect(press(['5', '6', 'clear'])).toBe('');
    expect(applyKey('3', 'x')).toBe('3');
  });
});
