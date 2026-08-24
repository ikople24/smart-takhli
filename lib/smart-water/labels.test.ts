import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  pipeStatusLabel,
  nodeTypeLabel,
  nodeConditionLabel,
} from './labels';

describe('escapeHtml', () => {
  it('escape อักขระ HTML กัน XSS ใน popup', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
  });

  it('null/undefined เป็นข้อความว่าง', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('ตัวเลขแปลงเป็นข้อความ', () => {
    expect(escapeHtml(4)).toBe('4');
  });
});

describe('ป้ายภาษาไทย', () => {
  it('สถานะท่อ', () => expect(pipeStatusLabel('abandoned')).toBe('ยกเลิกใช้งาน'));
  it('ชนิดอุปกรณ์', () => expect(nodeTypeLabel('gate_valve')).toBe('ประตูน้ำลิ้นแบบเปิด'));
  it('สภาพอุปกรณ์', () => expect(nodeConditionLabel('damaged')).toBe('ชำรุด'));
  it('ค่าที่ไม่รู้จักคืนค่าดิบ', () => expect(pipeStatusLabel('weird')).toBe('weird'));
});
