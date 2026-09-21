import { describe, expect, it } from 'vitest';
import {
  MAX_COMMENT_LENGTH,
  RATING_COMMENT_WINDOW_MS,
  buildRatingPostbackData,
  commentWindowStart,
  parseRatingPostback,
  sanitizeComment,
  starText,
} from '../lineRating';

describe('buildRatingPostbackData / parseRatingPostback', () => {
  it('สร้างแล้วแกะกลับได้ค่าเดิม', () => {
    const data = buildRatingPostbackData('TKC-690006', 4);
    expect(data).toBe('action=sat_rate&cid=TKC-690006&score=4');
    expect(parseRatingPostback(data)).toEqual({ complaintCode: 'TKC-690006', score: 4 });
  });

  it('รับเลขเรื่องตัวพิมพ์เล็กแล้วคืนเป็นตัวพิมพ์ใหญ่', () => {
    expect(parseRatingPostback('action=sat_rate&cid=tkc-690006&score=1')).toEqual({
      complaintCode: 'TKC-690006',
      score: 1,
    });
  });

  it('คืน null เมื่อ action ไม่ใช่ของแบบประเมิน', () => {
    expect(parseRatingPostback('action=other&cid=TKC-690006&score=4')).toBeNull();
  });

  it('คืน null เมื่อคะแนนอยู่นอกช่วง 1-5 หรือไม่ใช่จำนวนเต็ม', () => {
    expect(parseRatingPostback('action=sat_rate&cid=TKC-690006&score=0')).toBeNull();
    expect(parseRatingPostback('action=sat_rate&cid=TKC-690006&score=6')).toBeNull();
    expect(parseRatingPostback('action=sat_rate&cid=TKC-690006&score=4.5')).toBeNull();
    expect(parseRatingPostback('action=sat_rate&cid=TKC-690006&score=ห้า')).toBeNull();
    expect(parseRatingPostback('action=sat_rate&cid=TKC-690006')).toBeNull();
  });

  it('คืน null เมื่อเลขเรื่องผิดรูปแบบหรือไม่มี', () => {
    expect(parseRatingPostback('action=sat_rate&cid=ABC-1&score=4')).toBeNull();
    expect(parseRatingPostback('action=sat_rate&cid=TKC-69&score=4')).toBeNull();
    expect(parseRatingPostback('action=sat_rate&score=4')).toBeNull();
  });

  it('คืน null เมื่อ data ว่างหรือไม่ใช่ string', () => {
    expect(parseRatingPostback('')).toBeNull();
    expect(parseRatingPostback(undefined)).toBeNull();
    expect(parseRatingPostback(null)).toBeNull();
    expect(parseRatingPostback(42)).toBeNull();
  });
});

describe('commentWindowStart', () => {
  it('ย้อนหลังจากเวลาที่ให้มาเท่ากับความกว้างของหน้าต่าง', () => {
    const now = new Date('2026-08-17T10:00:00.000Z');
    expect(commentWindowStart(now).toISOString()).toBe('2026-08-17T09:50:00.000Z');
    expect(RATING_COMMENT_WINDOW_MS).toBe(10 * 60 * 1000);
  });
});

describe('sanitizeComment', () => {
  it('ตัดช่องว่างหัวท้าย', () => {
    expect(sanitizeComment('  ดีมากครับ  ')).toBe('ดีมากครับ');
  });

  it('คืน null เมื่อว่างหรือมีแต่ช่องว่าง', () => {
    expect(sanitizeComment('')).toBeNull();
    expect(sanitizeComment('   \n ')).toBeNull();
    expect(sanitizeComment(undefined)).toBeNull();
    expect(sanitizeComment(123)).toBeNull();
  });

  it('ตัดความยาวส่วนเกินทิ้ง', () => {
    const long = 'ก'.repeat(MAX_COMMENT_LENGTH + 50);
    expect(sanitizeComment(long)).toHaveLength(MAX_COMMENT_LENGTH);
  });

  it('ตัดตาม code point ไม่ตัด emoji ขาดกลางตัวที่ขอบความยาว', () => {
    // emoji เป็น surrogate pair (2 หน่วย UTF-16 แต่ 1 code point) — ถ้าตัดด้วย .slice
    // ตรง ๆ ตอนความยาวพอดีขอบเขต จะได้ high surrogate ค้างเดี่ยว ๆ ท้ายสตริง
    const long = 'ก'.repeat(MAX_COMMENT_LENGTH - 1) + '😀';
    const result = sanitizeComment(long);
    const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    expect(loneSurrogate.test(result)).toBe(false);
    expect(Array.from(result).at(-1)).toBe('😀');
  });
});

describe('starText', () => {
  it('แปลงคะแนนเป็นดาว', () => {
    expect(starText(3)).toBe('⭐⭐⭐');
  });
});
