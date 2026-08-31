// lib/satisfaction/__tests__/quota.test.js
import { describe, expect, it } from 'vitest';
import {
  MAX_PUBLIC_RATINGS_PER_COMPLAINT,
  isPublicQuotaFull,
  publicQuotaFullMessage,
} from '../quota';

describe('quota', () => {
  it('เพดาน 4 ครั้งต่อเรื่อง (ค่าเดียวกับที่หน้า /status และ CardOfficail เคย hardcode)', () => {
    expect(MAX_PUBLIC_RATINGS_PER_COMPLAINT).toBe(4);
  });

  it('ยังไม่ครบเมื่อน้อยกว่าเพดาน', () => {
    expect(isPublicQuotaFull(0)).toBe(false);
    expect(isPublicQuotaFull(3)).toBe(false);
  });

  it('ครบเมื่อเท่ากับหรือเกินเพดาน', () => {
    expect(isPublicQuotaFull(4)).toBe(true);
    expect(isPublicQuotaFull(5)).toBe(true);
  });

  it('ข้อความแจ้งใช้ตัวเลขจากค่าคงที่ ไม่ hardcode', () => {
    expect(publicQuotaFullMessage()).toBe('เรื่องนี้ได้รับการประเมินครบ 4 ครั้งแล้ว');
  });
});
