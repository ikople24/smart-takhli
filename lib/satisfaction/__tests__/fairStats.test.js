import { describe, expect, it } from 'vitest';
import { METHOD, computeFairStats, reporterKey } from '../fairStats';

// แถวคะแนนย่อ — ไม่ใส่ source = แถวเก่าก่อน backfill (ต้องนับเป็น public)
const R = (complaintId, rating, source) => ({ complaintId, rating, ...(source ? { source } : {}) });
const reports = (entries) => new Map(Object.entries(entries));

describe('reporterKey', () => {
  it('ใช้เบอร์โทรเป็นหลัก ตัดช่องว่าง/ขีดออก → เบอร์เดียวกันคือคนเดียวกัน', () => {
    expect(reporterKey({ phone: '099-241-4966 ' }, 'c1')).toBe('tel:0992414966');
    expect(reporterKey({ phone: '0992414966' }, 'c2')).toBe('tel:0992414966');
  });

  it('ไม่เติม 0 ให้เบอร์ 9 หลัก — ถือเป็นคนละคน', () => {
    expect(reporterKey({ phone: '992414966' }, 'c1')).toBe('tel:992414966');
    expect(reporterKey({ phone: '992414966' }, 'c1')).not.toBe(reporterKey({ phone: '0992414966' }, 'c2'));
  });

  it('ไม่มีเบอร์ → ใช้ lineUserId', () => {
    expect(reporterKey({ phone: '', lineUserId: 'Uabc' }, 'c1')).toBe('line:Uabc');
    expect(reporterKey({ phone: null, lineUserId: 'Uabc' }, 'c1')).toBe('line:Uabc');
  });

  it('ไม่มีทั้งคู่ หรือเรื่องถูกลบ (report เป็น null) → เรื่องนั้นเป็นเสียงของตัวเอง', () => {
    expect(reporterKey({ phone: '', lineUserId: null }, 'c1')).toBe('complaint:c1');
    expect(reporterKey(null, 'c9')).toBe('complaint:c9');
    expect(reporterKey(undefined, 'c9')).toBe('complaint:c9');
  });
});

describe('computeFairStats', () => {
  it('อินพุตว่าง → ศูนย์ทุกฟิลด์ (พฤติกรรมเดิมของ stats.js)', () => {
    expect(computeFairStats([])).toEqual({
      averageRating: 0,
      rawAverage: 0,
      totalRatings: 0,
      ratedComplaints: 0,
      reporters: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      bySource: { public: { count: 0, average: 0 }, line: { count: 0, average: 0 } },
      method: 'per-reporter',
    });
  });

  it('คนเดียวหลายเรื่อง (เบอร์เดียว) = 1 เสียง', () => {
    // A ยื่น 3 เรื่อง ให้ 1 ดาวทุกเรื่อง · B, C คนละเรื่อง 5 ดาว
    const ratings = [R('a1', 1), R('a2', 1), R('a3', 1), R('b1', 5), R('c1', 5)];
    const s = computeFairStats(
      ratings,
      reports({
        a1: { phone: '0810000001' },
        a2: { phone: '0810000001' },
        a3: { phone: '081-000-0001' },
        b1: { phone: '0810000002' },
        c1: { phone: '0810000003' },
      })
    );
    expect(s.rawAverage).toBeCloseTo(13 / 5, 3); // 2.6 แบบเดิม — A ถ่วง 3 เสียง
    expect(s.averageRating).toBeCloseTo((1 + 5 + 5) / 3, 3); // 3.6667 — A เป็น 1 เสียง
    expect(s.reporters).toBe(3);
    expect(s.ratedComplaints).toBe(5);
    expect(s.totalRatings).toBe(5);
  });

  it('หลายคะแนนในเรื่องเดียวถูกเฉลี่ยก่อน — กดซ้ำ/ปั่นโควตาไม่มีน้ำหนักเพิ่ม', () => {
    const ratings = [R('x', 1), R('x', 1), R('x', 1), R('x', 1), R('y', 5)];
    const s = computeFairStats(ratings, reports({ x: { phone: '0810000001' }, y: { phone: '0810000002' } }));
    expect(s.averageRating).toBeCloseTo(3, 3);
    expect(s.ratedComplaints).toBe(2);
    expect(s.reporters).toBe(2);
    expect(s.totalRatings).toBe(5);
  });

  it('distribution และ bySource ยังเป็นค่าดิบ — แถวไม่มี source นับเป็น public', () => {
    const ratings = [R('x', 1), R('x', 1, 'public'), R('y', 5, 'line'), R('z', 4)];
    const s = computeFairStats(
      ratings,
      reports({ x: { phone: '0810000001' }, y: { phone: '0810000002' }, z: { phone: '0810000003' } })
    );
    expect(s.ratingDistribution).toEqual({ 1: 2, 2: 0, 3: 0, 4: 1, 5: 1 });
    expect(s.bySource.public).toEqual({ count: 3, average: 2 });
    expect(s.bySource.line).toEqual({ count: 1, average: 5 });
  });

  it('เรื่องที่ถูกลบ (ไม่มีใน reports) ยังนับเป็นเสียงของตัวเอง ไม่หายจากสถิติ', () => {
    const s = computeFairStats([R('gone', 2), R('y', 4)], reports({ y: { phone: '0810000002' } }));
    expect(s.reporters).toBe(2);
    expect(s.averageRating).toBeCloseTo(3, 3);
  });

  it('ไม่ส่ง reports มาเลยก็ทำงานได้ (ทุกเรื่องเป็นเสียงของตัวเอง)', () => {
    const s = computeFairStats([R('a', 2), R('b', 4)]);
    expect(s.reporters).toBe(2);
    expect(s.averageRating).toBeCloseTo(3, 3);
  });

  it('รับ complaintId เป็น object ที่ toString ได้ (ObjectId จาก Mongoose)', () => {
    const oid = { toString: () => 'abc' };
    const s = computeFairStats([R(oid, 5), R('abc', 3)], reports({ abc: { phone: '0810000001' } }));
    expect(s.ratedComplaints).toBe(1);
    expect(s.averageRating).toBeCloseTo(4, 3);
  });

  it('เคสย่อจากข้อมูลจริง: 1 คน 7 เรื่อง 1 ดาว + คนอื่น 10 คน 5 ดาว → ค่าใกล้ 5 ไม่ใช่ ~3', () => {
    const ratings = [];
    const map = {};
    for (let i = 0; i < 7; i++) {
      ratings.push(R(`p${i}`, 1));
      map[`p${i}`] = { phone: '0992414966' };
    }
    for (let i = 0; i < 10; i++) {
      ratings.push(R(`o${i}`, 5));
      map[`o${i}`] = { phone: `08100000${i}` };
    }
    const s = computeFairStats(ratings, reports(map));
    expect(s.rawAverage).toBeCloseTo(57 / 17, 3); // ≈ 3.35 แบบเดิม
    expect(s.averageRating).toBeCloseTo(51 / 11, 3); // ≈ 4.64 ต่อผู้แจ้ง
    expect(s.reporters).toBe(11);
    expect(s.ratingDistribution[1]).toBe(7); // histogram ไม่ซ่อน 1 ดาว
  });

  it('method ระบุกติกาที่ใช้ ให้ client รู้ว่าเลขนี้นับแบบไหน', () => {
    expect(METHOD).toBe('per-reporter');
    expect(computeFairStats([R('x', 5)]).method).toBe('per-reporter');
  });
});
