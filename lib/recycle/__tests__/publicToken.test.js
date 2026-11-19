import { describe, expect, it } from 'vitest';
import { generatePublicToken, isPublicToken } from '../publicToken';

describe('publicToken', () => {
  it('สุ่มได้รูปแบบถูกต้องและไม่ซ้ำ', () => {
    const seen = new Set();
    for (let i = 0; i < 2000; i++) {
      const t = generatePublicToken();
      expect(isPublicToken(t)).toBe(true);
      seen.add(t);
    }
    expect(seen.size).toBe(2000);
  });
  it('ไม่รับรหัสเรียงเลขหรือรูปแบบอื่น', () => {
    expect(isPublicToken('PS-0001')).toBe(false);
    expect(isPublicToken('abc')).toBe(false);
    expect(isPublicToken('0000000000O0')).toBe(false);
  });
});
