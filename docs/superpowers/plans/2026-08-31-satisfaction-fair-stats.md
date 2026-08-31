# Satisfaction Fair Stats ("1 ผู้แจ้ง = 1 เสียง") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยนค่าเฉลี่ยความพึงพอใจบนแดชบอร์ด/analytics ให้นับต่อผู้แจ้ง (ไม่ใช่ต่อครั้ง) และบังคับโควตา 4 ครั้ง/เรื่องฝั่ง server — ตาม spec `docs/superpowers/specs/2026-08-31-satisfaction-fair-stats-design.md`

**Architecture:** logic ล้วน 3 ไฟล์ใน `lib/satisfaction/` (`fairStats.js` 3 ขั้น เรื่อง→ผู้แจ้ง→รวม, `isoWeek.js` แบ่งถังรายสัปดาห์ Bangkok, `quota.js` ค่าคงที่โควตา) + I/O helper `readStats.js` ที่ 3 endpoint เรียกร่วมกัน · ฝั่งเขียน `record.js` เช็คโควตาก่อนบันทึก → `create.js` ตอบ 429 · หน้าจอโชว์ตัวเลขใหม่เป็น headline และตัวเลขดิบเป็นบรรทัดเล็ก · ไม่มี migration

**Tech Stack:** Next.js 15 Pages Router, Mongoose, vitest (`npm test` / `npx vitest run <path>`), Tailwind+DaisyUI, path alias `@/*`

**Branch:** `satisfaction-fair-stats` (แยกจาก main แล้ว มี spec commit อยู่) — ก่อน commit ทุกครั้งรัน `git branch --show-current` ต้องได้ `satisfaction-fair-stats` (เจ้าของ repo สลับสาขาใน working copy เดียวกันได้)

**ข้อมูลอ้างอิงตอนตรวจรับ** (probe อ่านอย่างเดียว 2026-08-31): 59 คะแนน / 49 เรื่อง / 24 ผู้แจ้ง · เฉลี่ยดิบ 4.407 · ต่อผู้แจ้ง 4.853

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| Create `lib/satisfaction/quota.js` | ค่าคงที่ `MAX_PUBLIC_RATINGS_PER_COMPLAINT = 4`, `isPublicQuotaFull(count)`, `publicQuotaFullMessage()` — logic ล้วน |
| Create `lib/satisfaction/isoWeek.js` | `isoWeekKey(date)` → `{ year, week, label }` ตามเวลา Bangkok ไม่พึ่ง TZ เครื่อง — logic ล้วน |
| Create `lib/satisfaction/fairStats.js` | `reporterKey(report, complaintId)`, `computeFairStats(ratings, reports)` — logic ล้วน |
| Create `lib/satisfaction/readStats.js` | `loadSatisfactionStats({ from })` → `{ ratings, reports }` — I/O เดียวของสถิติ |
| Create `lib/satisfaction/__tests__/{quota,isoWeek,fairStats}.test.js` | เทส vitest ของ 3 ไฟล์ logic |
| Modify `pages/api/satisfaction/stats.js` | ใช้ `readStats` + `computeFairStats` แทนวนรวมเอง |
| Modify `pages/api/analytics/summary.ts` | ใช้ `readStats` + `computeFairStats` แทน `$avg` |
| Modify `pages/api/analytics/satisfaction.ts` | แบ่งถัง `isoWeekKey` ใน JS + `computeFairStats` ต่อถัง แทน `$isoWeek` |
| Modify `lib/satisfaction/record.js` | `recordPublicRating` เช็คโควตา → `quota_exceeded` |
| Modify `pages/api/satisfaction/create.js` | `quota_exceeded` → 429 |
| Modify `components/SatisfactionForm.js` | แสดง `message` จาก server + prop `onQuotaFull` |
| Modify `pages/status/[id].tsx` | import ค่าคงที่ + `onQuotaFull` refetch count |
| Modify `components/complaints/CardOfficail.js` | import ค่าคงที่ + `onQuotaFull` |
| Modify `pages/admin/dashboard.jsx` | บรรทัดเล็ก "ทุกช่วงเวลา · ผู้แจ้ง N ราย · M คะแนน · เฉลี่ยดิบ x.x / 5" |
| Modify `pages/admin/analytics.tsx` | subtitle การ์ด + interface |
| Modify `docs/modules/satisfaction.md`, `CLAUDE.md` | กติกาการนับ + โควตา server |

---

### Task 1: โควตา — `lib/satisfaction/quota.js`

**Files:**
- Create: `lib/satisfaction/quota.js`
- Test: `lib/satisfaction/__tests__/quota.test.js`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
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
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run lib/satisfaction/__tests__/quota.test.js`
Expected: FAIL — `Failed to resolve import "../quota"`

- [ ] **Step 3: เขียนโค้ดขั้นต่ำ**

```js
// lib/satisfaction/quota.js
// โควตาให้คะแนนช่องทางเว็บสาธารณะ (source: public) — logic ล้วน ห้ามมี I/O
// ค่านี้ใช้ทั้งฝั่ง server (record.js) และ client (หน้า /status, CardOfficail) — แก้ที่เดียว
// ช่องทาง LINE ไม่ใช้โควตานี้ (1 คน 1 คะแนน/เรื่อง ด้วย unique index ใน models/Satisfaction.js)

export const MAX_PUBLIC_RATINGS_PER_COMPLAINT = 4;

/** ครบโควตาแล้วหรือยัง — count คือจำนวนคะแนนที่ไม่ใช่ LINE ของเรื่องนั้น */
export function isPublicQuotaFull(count) {
  return Number(count) >= MAX_PUBLIC_RATINGS_PER_COMPLAINT;
}

/** ข้อความตอบประชาชนเมื่อครบโควตา (ใช้ใน API 429 และ Swal ฝั่งฟอร์ม) */
export function publicQuotaFullMessage() {
  return `เรื่องนี้ได้รับการประเมินครบ ${MAX_PUBLIC_RATINGS_PER_COMPLAINT} ครั้งแล้ว`;
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run lib/satisfaction/__tests__/quota.test.js`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # ต้องได้ satisfaction-fair-stats
git add lib/satisfaction/quota.js lib/satisfaction/__tests__/quota.test.js
git commit -m "feat(satisfaction): ค่าคงที่โควตา 4 ครั้ง/เรื่อง + isPublicQuotaFull (logic ล้วน)"
```

---

### Task 2: แบ่งถังรายสัปดาห์ — `lib/satisfaction/isoWeek.js`

**Files:**
- Create: `lib/satisfaction/isoWeek.js`
- Test: `lib/satisfaction/__tests__/isoWeek.test.js`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
// lib/satisfaction/__tests__/isoWeek.test.js
// helper ต้องให้ผลเดิมไม่ว่าเครื่องตั้ง TZ อะไร (dev = Bangkok, Railway = UTC)
import { describe, expect, it } from 'vitest';
import { isoWeekKey } from '../isoWeek';

describe('isoWeekKey (Asia/Bangkok)', () => {
  it('ข้ามสัปดาห์เพราะ timezone: อาทิตย์ 18:00Z = จันทร์ 01:00 Bangkok → สัปดาห์ถัดไป', () => {
    // 2026-09-06 เป็นวันอาทิตย์ (W36 ใน UTC) แต่ Bangkok เป็นจันทร์ 7 ก.ย. → W37
    expect(isoWeekKey(new Date('2026-09-06T18:00:00Z'))).toEqual({ year: 2026, week: 37, label: '2026-W37' });
  });

  it('จันทร์ 31 ส.ค. 2026 อยู่ W36', () => {
    expect(isoWeekKey(new Date('2026-08-31T03:00:00Z')).label).toBe('2026-W36');
  });

  it('ขอบปี: 29 ธ.ค. 2025 เป็นสัปดาห์ 1 ของ 2026', () => {
    expect(isoWeekKey(new Date('2025-12-29T00:00:00Z'))).toEqual({ year: 2026, week: 1, label: '2026-W01' });
  });

  it('ขอบปี: 3 ม.ค. 2027 ยังเป็นสัปดาห์ 53 ของ 2026 (ปี 2026 มี 53 สัปดาห์ ISO)', () => {
    expect(isoWeekKey(new Date('2027-01-03T00:00:00Z'))).toEqual({ year: 2026, week: 53, label: '2026-W53' });
  });

  it('label เติม 0 หน้าสัปดาห์ < 10', () => {
    expect(isoWeekKey(new Date('2026-01-26T00:00:00Z')).label).toBe('2026-W05');
  });

  it('รับ string/timestamp ได้ด้วย', () => {
    expect(isoWeekKey('2026-08-31T03:00:00Z').label).toBe('2026-W36');
    expect(isoWeekKey(Date.parse('2026-08-31T03:00:00Z')).label).toBe('2026-W36');
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run lib/satisfaction/__tests__/isoWeek.test.js`
Expected: FAIL — `Failed to resolve import "../isoWeek"`

- [ ] **Step 3: เขียนโค้ดขั้นต่ำ**

```js
// lib/satisfaction/isoWeek.js
// แบ่งถังรายสัปดาห์ ISO ตามเวลา Asia/Bangkok — logic ล้วน ห้ามมี I/O
// ไม่พึ่ง TZ ของเครื่อง: เลื่อน timestamp +7 ชม. แล้วใช้ UTC getters ทั้งหมด
// (Bangkok ไม่มี DST จึงเลื่อนคงที่ได้ — เซิร์ฟเวอร์ production รัน UTC, เครื่อง dev เป็น Bangkok)

export const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * คืน { year, week, label } ของสัปดาห์ ISO (จันทร์–อาทิตย์) ที่วันนั้นตามเวลา Bangkok อยู่
 * year คือ ISO week-year: 2027-01-03 อยู่สัปดาห์ 53 ของปี 2026 · 2025-12-29 อยู่สัปดาห์ 1 ของปี 2026
 * @param {Date|string|number} date
 */
export function isoWeekKey(date) {
  const t = date instanceof Date ? date.getTime() : new Date(date).getTime();
  // "วันตาม Bangkok" แทนด้วย UTC midnight เพื่อให้ getUTC* ใช้ได้ทุก TZ
  const d = new Date(t + BANGKOK_OFFSET_MS);
  d.setUTCHours(0, 0, 0, 0);
  // กติกา ISO: ปีของสัปดาห์ = ปีของวันพฤหัสในสัปดาห์นั้น
  const day = d.getUTCDay() || 7; // อาทิตย์ = 7 ให้จันทร์เป็นวันแรก
  d.setUTCDate(d.getUTCDate() + 4 - day); // เลื่อนไปวันพฤหัสของสัปดาห์เดียวกัน
  const year = d.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  const label = `${year}-W${week < 10 ? `0${week}` : week}`;
  return { year, week, label };
}
```

- [ ] **Step 4: รันให้ผ่าน — ทั้ง TZ ปกติและ TZ=UTC**

Run: `npx vitest run lib/satisfaction/__tests__/isoWeek.test.js && TZ=UTC npx vitest run lib/satisfaction/__tests__/isoWeek.test.js`
Expected: `6 passed` ทั้งสองครั้ง

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add lib/satisfaction/isoWeek.js lib/satisfaction/__tests__/isoWeek.test.js
git commit -m "feat(satisfaction): isoWeekKey แบ่งถังรายสัปดาห์ตามเวลา Bangkok ไม่พึ่ง TZ เครื่อง"
```

---

### Task 3: กติกาคำนวณ — `lib/satisfaction/fairStats.js`

**Files:**
- Create: `lib/satisfaction/fairStats.js`
- Test: `lib/satisfaction/__tests__/fairStats.test.js`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
// lib/satisfaction/__tests__/fairStats.test.js
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
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run lib/satisfaction/__tests__/fairStats.test.js`
Expected: FAIL — `Failed to resolve import "../fairStats"`

- [ ] **Step 3: เขียนโค้ด**

```js
// lib/satisfaction/fairStats.js
// สถิติความพึงพอใจแบบ "1 ผู้แจ้ง = 1 เสียง" — logic ล้วน ห้ามมี I/O (เทสด้วย vitest)
// spec: docs/superpowers/specs/2026-08-31-satisfaction-fair-stats-design.md
//
// ทำไมไม่เฉลี่ยทุกแถวตรง ๆ: ผู้แจ้งคนเดียวยื่นเรื่องเดิมซ้ำหลายใบแล้วให้คะแนนทุกใบ
// จะถ่วงค่าเฉลี่ยทั้งระบบได้ กติกานี้ให้ทุกคนมีน้ำหนักเท่ากันไม่ว่าจะยื่นกี่เรื่อง
// (เบอร์เจ้าหน้าที่ที่คีย์แทนประชาชนหลายเรื่องก็ยุบเป็น 1 เสียงเช่นกัน — กติกาสมมาตร ไม่มีกรณีพิเศษ)
//
// 3 ขั้น: (1) เฉลี่ยภายในเรื่อง → (2) เฉลี่ยทุกเรื่องของผู้แจ้งเดียวกัน → (3) เฉลี่ยข้ามผู้แจ้ง
// ตัวเลขดิบ (totalRatings, rawAverage, ratingDistribution, bySource) ยังคืนไปด้วยเพื่อความโปร่งใส
//
// เฟส 2 (ผูกเรื่องซ้ำ duplicateOf): เปลี่ยนคีย์ขั้น 1 จาก complaintId เป็น "เรื่องแม่" ที่จุดเดียวตรง perComplaint

export const METHOD = "per-reporter";

const emptyDistribution = () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round4 = (x) => Math.round(x * 10000) / 10000;

/**
 * ตัวระบุผู้แจ้งของเรื่องหนึ่ง — คีย์มี prefix กันชนกันข้ามชนิด
 *   1. tel:<เฉพาะตัวเลข>  ตัดช่องว่าง/ขีดที่พบในข้อมูลจริง · ไม่เติม 0 ให้เบอร์ 9 หลัก (ปล่อยเป็นคนละคน)
 *   2. line:<lineUserId>  เมื่อไม่มีเบอร์
 *   3. complaint:<id>     ไม่มีทั้งคู่ หรือเรื่องถูกลบไปแล้ว (report เป็น null) — เรื่องนั้นเป็นเสียงของตัวเอง
 * @param {{ phone?: string|null, lineUserId?: string|null } | null | undefined} report
 * @param {string} complaintId
 */
export function reporterKey(report, complaintId) {
  const digits = String(report?.phone ?? "").replace(/\D/g, "");
  if (digits) return `tel:${digits}`;
  const line = String(report?.lineUserId ?? "").trim();
  if (line) return `line:${line}`;
  return `complaint:${String(complaintId)}`;
}

/**
 * @param {Array<{ complaintId: any, rating: number, source?: string }>} ratings
 *        complaintId เป็น string หรือ ObjectId (จะ String() ให้)
 * @param {Map<string, { phone?: string|null, lineUserId?: string|null }>} reports
 *        เฉพาะเรื่องที่มีคะแนน key = String(complaintId) · ไม่มี key = เรื่องถูกลบ
 */
export function computeFairStats(ratings, reports = new Map()) {
  const ratingDistribution = emptyDistribution();
  const bySource = {
    public: { count: 0, average: 0 },
    line: { count: 0, average: 0 },
  };

  if (!ratings || ratings.length === 0) {
    return {
      averageRating: 0,
      rawAverage: 0,
      totalRatings: 0,
      ratedComplaints: 0,
      reporters: 0,
      ratingDistribution,
      bySource,
      method: METHOD,
    };
  }

  // ── ส่วนดิบ (คงพฤติกรรมเดิมของ stats.js): histogram + แยกช่องทาง ──
  const sums = { public: 0, line: 0 };
  let rawSum = 0;
  const perComplaint = new Map(); // String(complaintId) → [rating]
  for (const r of ratings) {
    const rating = Number(r.rating);
    rawSum += rating;
    if (ratingDistribution[rating] !== undefined) ratingDistribution[rating]++;
    // แถวที่ไม่มี source (ก่อน backfill) ถือเป็นคะแนนจากหน้าเว็บ — ต้องตรงกับ count.js
    const key = r.source === "line" ? "line" : "public";
    sums[key] += rating;
    bySource[key].count++;
    const cid = String(r.complaintId);
    if (!perComplaint.has(cid)) perComplaint.set(cid, []);
    perComplaint.get(cid).push(rating);
  }
  bySource.public.average = bySource.public.count ? sums.public / bySource.public.count : 0;
  bySource.line.average = bySource.line.count ? sums.line / bySource.line.count : 0;

  // ── ขั้น 1 ต่อเรื่อง → ขั้น 2 ต่อผู้แจ้ง → ขั้น 3 รวม ──
  const perReporter = new Map(); // reporterKey → [ค่าเฉลี่ยต่อเรื่อง]
  for (const [cid, rs] of perComplaint) {
    const key = reporterKey(reports.get(cid) ?? null, cid);
    if (!perReporter.has(key)) perReporter.set(key, []);
    perReporter.get(key).push(mean(rs));
  }
  const reporterMeans = [...perReporter.values()].map(mean);

  return {
    averageRating: round4(mean(reporterMeans)),
    rawAverage: round4(rawSum / ratings.length),
    totalRatings: ratings.length,
    ratedComplaints: perComplaint.size,
    reporters: perReporter.size,
    ratingDistribution,
    bySource,
    method: METHOD,
  };
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run lib/satisfaction/__tests__/fairStats.test.js`
Expected: `13 passed`

- [ ] **Step 5: รันเทสทั้งโปรเจกต์ให้แน่ใจว่าไม่กระทบของเดิม**

Run: `npm test`
Expected: ทุกไฟล์ผ่าน (รวม `lineRating.test.js`, `model.test.js` เดิม)

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add lib/satisfaction/fairStats.js lib/satisfaction/__tests__/fairStats.test.js
git commit -m "feat(satisfaction): computeFairStats นับ \"1 ผู้แจ้ง = 1 เสียง\" 3 ขั้น (logic ล้วน + เทส)"
```

---

### Task 4: ชั้นอ่าน `readStats.js` + rewire `GET /api/satisfaction/stats`

**Files:**
- Create: `lib/satisfaction/readStats.js`
- Modify: `pages/api/satisfaction/stats.js` (แทนทั้งไฟล์)

- [ ] **Step 1: สร้าง I/O helper**

```js
// lib/satisfaction/readStats.js
// จุดรวมการอ่านสถิติความพึงพอใจ (I/O) — ใช้คู่กับ computeFairStats (logic ล้วน)
// ผู้เรียก: pages/api/satisfaction/stats.js, pages/api/analytics/summary.ts, pages/api/analytics/satisfaction.ts
// ห้ามคำนวณค่าเฉลี่ยดิบ ($avg / reduce) เองที่ endpoint อื่น — ให้เรียกที่นี่แล้วส่งเข้า computeFairStats
// (endpoint อ่านรายเรื่อง count.js / [id].js / by-complaint.js / recent-comments.js ไม่เกี่ยวกับสถิติรวม ไม่แตะ)

import dbConnect from "@/lib/dbConnect";
import Satisfaction from "@/models/Satisfaction";
import SubmittedReport from "@/models/SubmittedReport";

/**
 * โหลดแถวคะแนน (+ createdAt ไว้แบ่งถังรายสัปดาห์) และข้อมูลผู้แจ้งของเรื่องที่มีคะแนน
 * @param {{ from?: Date }} [opts] — from = เอาเฉพาะคะแนนตั้งแต่วันนั้น (ไม่ใส่ = ทั้งหมด)
 * @returns {Promise<{
 *   ratings: Array<{ complaintId: string, rating: number, source?: string, createdAt: Date }>,
 *   reports: Map<string, { phone?: string, lineUserId?: string }>
 * }>}
 */
export async function loadSatisfactionStats({ from } = {}) {
  await dbConnect();

  const filter = from ? { createdAt: { $gte: from } } : {};
  const rows = await Satisfaction.find(filter).select("complaintId rating source createdAt").lean();

  const ratings = rows.map((r) => ({
    complaintId: String(r.complaintId),
    rating: r.rating,
    source: r.source,
    createdAt: r.createdAt,
  }));

  const ids = [...new Set(ratings.map((r) => r.complaintId))];
  const reportRows = ids.length
    ? await SubmittedReport.find({ _id: { $in: ids } }).select("_id phone lineUserId").lean()
    : [];
  // เก็บเฉพาะที่ reporterKey ใช้ — ไม่ให้ชื่อ/รายละเอียดผู้แจ้งหลุดไปกับผลลัพธ์
  const reports = new Map(
    reportRows.map((r) => [String(r._id), { phone: r.phone, lineUserId: r.lineUserId }])
  );

  return { ratings, reports };
}
```

- [ ] **Step 2: แทนทั้งไฟล์ `pages/api/satisfaction/stats.js`**

```js
// GET /api/satisfaction/stats — สถิติรวมสำหรับการ์ด "ความพึงพอใจ" บน /admin/dashboard
// averageRating นับแบบ "1 ผู้แจ้ง = 1 เสียง" (lib/satisfaction/fairStats.js) ·
// totalRatings / rawAverage / ratingDistribution / bySource เป็นค่าดิบ (จำนวนครั้ง) เพื่อความโปร่งใส
// endpoint นี้เปิดสาธารณะ — คืนแค่ตัวเลขรวม ห้ามคืนคีย์ผู้แจ้ง/เบอร์โทร
import { loadSatisfactionStats } from '@/lib/satisfaction/readStats';
import { computeFairStats } from '@/lib/satisfaction/fairStats';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { ratings, reports } = await loadSatisfactionStats();
    return res.status(200).json(computeFairStats(ratings, reports));
  } catch (err) {
    console.error('❌ Failed to fetch satisfaction stats:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch satisfaction stats' });
  }
}
```

- [ ] **Step 3: ทดสอบกับฐานข้อมูลจริง (อ่านอย่างเดียว)**

Run (ต้องมี `npm run dev` รันอยู่): `curl -s http://localhost:3000/api/satisfaction/stats`
Expected: JSON มี `"averageRating":4.85xx`, `"rawAverage":4.40xx`, `"totalRatings":59`, `"ratedComplaints":49`, `"reporters":24`, `"method":"per-reporter"`, `ratingDistribution[1] = 7`, `bySource.public.count + bySource.line.count = 59` (ตัวเลขอาจเพิ่มถ้ามีคะแนนใหม่เข้ามาหลัง 2026-08-31 — ให้ดูว่า `averageRating > rawAverage` และ `reporters < ratedComplaints`)

- [ ] **Step 4: Lint**

Run: `npx next lint --file lib/satisfaction/readStats.js --file pages/api/satisfaction/stats.js`
Expected: ไม่มี error

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add lib/satisfaction/readStats.js pages/api/satisfaction/stats.js
git commit -m "feat(satisfaction): readStats รวมศูนย์การอ่าน + stats API นับต่อผู้แจ้ง"
```

---

### Task 5: `GET /api/analytics/summary` ใช้กติกาเดียวกัน

**Files:**
- Modify: `pages/api/analytics/summary.ts`

- [ ] **Step 1: เปลี่ยน import**

แทน
```ts
import Satisfaction from '@/models/Satisfaction';
```
ด้วย
```ts
import { loadSatisfactionStats } from '@/lib/satisfaction/readStats';
import { computeFairStats } from '@/lib/satisfaction/fairStats';
```

- [ ] **Step 2: แทน aggregate ใน `Promise.all`**

แทนบล็อกนี้
```ts
      // คะแนนความพึงพอใจเฉลี่ย
      Satisfaction.aggregate([
        { $group: { _id: null, avg: { $avg: '$rating' }, total: { $sum: 1 } } },
      ]),
```
ด้วย
```ts
      // คะแนนความพึงพอใจ — นับต่อผู้แจ้ง (lib/satisfaction/fairStats.js) ให้ตรงกับการ์ดแดชบอร์ด
      loadSatisfactionStats(),
```
และเปลี่ยนชื่อตัวแปรที่รับผลใน destructuring จาก `satisfactionAgg` เป็น `satisfactionData`

- [ ] **Step 3: แทนการอ่านผล**

แทน
```ts
    const avgSatisfaction = satisfactionAgg[0]?.avg ?? null;
    const totalRatings = satisfactionAgg[0]?.total ?? 0;
```
ด้วย
```ts
    const fair = computeFairStats(satisfactionData.ratings, satisfactionData.reports);
    const avgSatisfaction = fair.totalRatings > 0 ? fair.averageRating : null;
    const totalRatings = fair.totalRatings;
```

- [ ] **Step 4: เพิ่มฟิลด์ในผลลัพธ์**

แทน
```ts
        avgSatisfaction: avgSatisfaction ? parseFloat(avgSatisfaction.toFixed(2)) : null,
        totalRatings,
```
ด้วย
```ts
        avgSatisfaction: avgSatisfaction != null ? parseFloat(avgSatisfaction.toFixed(2)) : null,
        totalRatings,
        satisfactionReporters: fair.reporters,
```

- [ ] **Step 5: ตรวจ type + ทดสอบ**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "summary.ts|readStats|fairStats" ; echo "tsc-done"`
Expected: ไม่มีบรรทัด error ของไฟล์เหล่านี้ (เห็นแค่ `tsc-done`)

Run (login แอดมินในเบราว์เซอร์แล้วเปิด): `http://localhost:3000/api/analytics/summary`
Expected: `summary.avgSatisfaction` ≈ `4.85`, `summary.satisfactionReporters` = 24, `summary.totalRatings` = 59

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add pages/api/analytics/summary.ts
git commit -m "feat(analytics): summary ใช้ค่าเฉลี่ยต่อผู้แจ้ง + satisfactionReporters"
```

---

### Task 6: กราฟรายสัปดาห์ `GET /api/analytics/satisfaction`

**Files:**
- Modify: `pages/api/analytics/satisfaction.ts` (แทนทั้งไฟล์)

- [ ] **Step 1: แทนทั้งไฟล์**

```ts
// GET /api/analytics/satisfaction?days=30
// แนวโน้มความพึงพอใจรายสัปดาห์ (ISO week เวลา Bangkok) — สำหรับ Area Chart
// avgRating ต่อสัปดาห์นับแบบ "1 ผู้แจ้ง = 1 เสียง" เหมือน headline บนแดชบอร์ด
// (ไม่งั้นกราฟจะดิ่งค้านกับตัวเลขรวม) · count และ distribution เป็นจำนวนครั้งดิบ
// แบ่งถังใน JS แทน $isoWeek เพราะกติกาต่อผู้แจ้งต้อง join เบอร์โทร — ข้อมูล ~60 แถว/ช่วง ทำใน JS พอ

import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import { loadSatisfactionStats } from '@/lib/satisfaction/readStats';
import { computeFairStats } from '@/lib/satisfaction/fairStats';
import { isoWeekKey } from '@/lib/satisfaction/isoWeek';

type RatingRow = { complaintId: string; rating: number; source?: string; createdAt: Date };
type ReportMap = Map<string, { phone?: string; lineUserId?: string }>;
type Bucket = { year: number; week: number; label: string; rows: RatingRow[] };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const days = Math.min(parseInt(req.query.days as string) || 90, 365);
  const from = new Date();
  from.setDate(from.getDate() - days);

  try {
    const { ratings, reports } = (await loadSatisfactionStats({ from })) as {
      ratings: RatingRow[];
      reports: ReportMap;
    };

    // แบ่งถังรายสัปดาห์ แล้วใช้กติกาเดียวกับ headline ต่อถัง
    const buckets = new Map<string, Bucket>();
    for (const r of ratings) {
      const k = isoWeekKey(r.createdAt);
      let b = buckets.get(k.label);
      if (!b) {
        b = { year: k.year, week: k.week, label: k.label, rows: [] };
        buckets.set(k.label, b);
      }
      b.rows.push(r);
    }
    const weeklyTrend = [...buckets.values()]
      .sort((a, b) => a.year - b.year || a.week - b.week)
      .map(({ year, week, label, rows }) => {
        const s = computeFairStats(rows, reports);
        return {
          year,
          week,
          label,
          avgRating: Math.round(s.averageRating * 100) / 100,
          count: s.totalRatings,
          reporters: s.reporters,
        };
      });

    // สรุปรายดาวของช่วงเวลา — จำนวนครั้งดิบ (ไม่ซ่อน 1 ดาว)
    const { ratingDistribution: distribution } = computeFairStats(ratings, reports);

    return res.status(200).json({
      success: true,
      weeklyTrend,
      distribution,
      days,
    });
  } catch (error) {
    console.error('satisfaction analytics error:', error);
    return res.status(500).json({ error: 'Failed to fetch satisfaction analytics' });
  }
}
```

- [ ] **Step 2: ตรวจ type + ทดสอบ**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "analytics/satisfaction.ts" ; echo "tsc-done"`
Expected: เห็นแค่ `tsc-done`

Run (login แอดมินแล้วเปิด): `http://localhost:3000/api/analytics/satisfaction?days=90`
Expected: `weeklyTrend` เรียงตาม `label` (เช่น `2026-W24 … 2026-W36`) · สัปดาห์ที่มีคะแนน 1 ดาวหลายเรื่องจากเบอร์เดียว `avgRating` สูงกว่าค่าดิบ (`reporters < count`) · `distribution` รวม = จำนวนคะแนนในช่วง

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add pages/api/analytics/satisfaction.ts
git commit -m "feat(analytics): กราฟรายสัปดาห์นับต่อผู้แจ้ง แบ่งถัง ISO week Bangkok ใน JS"
```

---

### Task 7: บังคับโควตาฝั่ง server — `record.js` + `create.js`

**Files:**
- Modify: `lib/satisfaction/record.js`
- Modify: `pages/api/satisfaction/create.js`

- [ ] **Step 1: import ใน `record.js`**

ใต้บรรทัด
```js
import { commentWindowStart, sanitizeComment } from "@/lib/satisfaction/lineRating";
```
เพิ่ม
```js
import { isPublicQuotaFull } from "@/lib/satisfaction/quota";
```

- [ ] **Step 2: แก้ JSDoc + เพิ่มด่านโควตาใน `recordPublicRating`**

แทน
```js
/** คะแนนจากหน้าเว็บสาธารณะ — พฤติกรรมเดิมทุกอย่าง */
export async function recordPublicRating({ complaintId, rating, comment }) {
  await dbConnect();

  // complaintId มาจาก request body — cast เองก่อน ไม่งั้น id เพี้ยนจะ throw CastError เป็น 500
  if (!mongoose.Types.ObjectId.isValid(complaintId)) {
    return { ok: false, reason: "not_found" };
  }
  const { reason } = await loadRatableComplaint({ _id: complaintId });
  if (reason) return { ok: false, reason };
```
ด้วย
```js
/**
 * คะแนนจากหน้าเว็บสาธารณะ — โควตา 4 ครั้ง/เรื่อง (lib/satisfaction/quota.js)
 * คืน { ok: false, reason } เมื่อ 'not_found' | 'not_closed' | 'quota_exceeded'
 */
export async function recordPublicRating({ complaintId, rating, comment }) {
  await dbConnect();

  // complaintId มาจาก request body — cast เองก่อน ไม่งั้น id เพี้ยนจะ throw CastError เป็น 500
  if (!mongoose.Types.ObjectId.isValid(complaintId)) {
    return { ok: false, reason: "not_found" };
  }
  const { reason } = await loadRatableComplaint({ _id: complaintId });
  if (reason) return { ok: false, reason };

  // โควตาเดิมเช็คแค่ฝั่ง client (หน้า /status) — ต้องกันฝั่ง server ด้วย ไม่งั้นยิง API ตรงให้ได้ไม่อั้น
  // นับแบบ "ไม่ใช่ line" ให้ตรงกับ count.js: แถวเก่าก่อน backfill ไม่มีฟิลด์ source ถือเป็น public
  // ยอมรับ race เล็ก ๆ (สองคำขอชนกันอาจได้ 5 แทน 4) — โควตาแบบ N ต่อเรื่องทำด้วย unique index ไม่ได้
  // และ fairStats เฉลี่ยภายในเรื่องก่อน ครั้งที่ 5 จึงไม่มีน้ำหนักเพิ่มอยู่แล้ว
  const publicCount = await Satisfaction.countDocuments({
    complaintId,
    source: { $ne: "line" },
  });
  if (isPublicQuotaFull(publicCount)) return { ok: false, reason: "quota_exceeded" };
```

- [ ] **Step 3: `create.js` ตอบ 429**

แทนทั้งไฟล์ `pages/api/satisfaction/create.js`
```js
import { recordPublicRating } from "@/lib/satisfaction/record";
import { publicQuotaFullMessage } from "@/lib/satisfaction/quota";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { complaintId, rating, comment } = req.body;

  if (!complaintId || !rating) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const result = await recordPublicRating({ complaintId, rating, comment });

    // ให้คะแนนได้เฉพาะเรื่องที่ปิดงานแล้ว และไม่เกินโควตา — กันคนยิง API ตรง ๆ ข้ามหน้าเว็บ
    if (!result.ok) {
      if (result.reason === "quota_exceeded") {
        return res.status(429).json({ success: false, message: publicQuotaFullMessage() });
      }
      return result.reason === "not_closed"
        ? res.status(409).json({
            success: false,
            message: "ให้คะแนนได้เมื่อเรื่องดำเนินการเสร็จสิ้นแล้ว",
          })
        : res.status(404).json({ success: false, message: "ไม่พบเรื่องร้องเรียนนี้" });
    }

    return res.status(201).json({ success: true, data: result.data });
  } catch (error) {
    console.error("Error saving satisfaction:", error);
    return res.status(500).json({ message: "Server error" });
  }
}
```

- [ ] **Step 4: ทดสอบเส้นทางที่ไม่เขียนข้อมูล**

เส้น 429 ทดสอบสดไม่ได้โดยไม่เขียนคะแนนจริงลงฐานข้อมูล production (ไม่มีเรื่องไหนมีครบ 4 คะแนนอยู่ก่อน) — ตรวจด้วยเทส `quota.test.js` + อ่านโค้ดขั้น 2 ว่า `countDocuments` ใช้เงื่อนไขเดียวกับ `count.js` ส่วนเส้นที่ทดสอบสดได้โดยไม่เขียน:

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/satisfaction/create -H 'Content-Type: application/json' -d '{"complaintId":"000000000000000000000000","rating":5}'`
Expected: `404`

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/satisfaction/create -H 'Content-Type: application/json' -d '{"complaintId":"abc","rating":5}'`
Expected: `404` (id เพี้ยน ไม่ใช่ 500)

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add lib/satisfaction/record.js pages/api/satisfaction/create.js
git commit -m "fix(satisfaction): บังคับโควตา 4 ครั้ง/เรื่องฝั่ง server → 429"
```

---

### Task 8: ฝั่งประชาชน — ฟอร์ม, หน้า /status, CardOfficail

**Files:**
- Modify: `components/SatisfactionForm.js`
- Modify: `pages/status/[id].tsx`
- Modify: `components/complaints/CardOfficail.js`

- [ ] **Step 1: ฟอร์มรับ `onQuotaFull` และแสดงข้อความจาก server**

ใน `components/SatisfactionForm.js` แทน
```js
const SatisfactionForm = ({ onSubmit, complaintId, status }) => {
```
ด้วย
```js
// onQuotaFull: server ตอบ 429 (ครบ 4 ครั้ง/เรื่อง) — ผู้เรียกใช้ refetch count แล้วซ่อนฟอร์ม
// (อย่าเรียก onSubmit ในกรณีนี้ — หน้า /status ใช้ onSubmit บวก count +1 ซึ่งผิดความหมาย)
const SatisfactionForm = ({ onSubmit, onQuotaFull, complaintId, status }) => {
```
และแทน
```js
      if (res.ok) {
        Swal.fire("ส่งสำเร็จ", "ขอบคุณสำหรับความคิดเห็นของคุณ", "success");
        if (onSubmit) onSubmit();
      } else {
        Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถส่งความคิดเห็นได้", "error");
      }
```
ด้วย
```js
      if (res.ok) {
        Swal.fire("ส่งสำเร็จ", "ขอบคุณสำหรับความคิดเห็นของคุณ", "success");
        if (onSubmit) onSubmit();
      } else if (res.status === 429) {
        // ครบโควตาแล้ว (count ฝั่ง client เก่า) — ข้อความจาก server ระบุจำนวนครั้ง
        const body = await res.json().catch(() => null);
        Swal.fire("ประเมินครบแล้ว", body?.message || "เรื่องนี้ได้รับการประเมินครบแล้ว", "info");
        if (onQuotaFull) onQuotaFull();
      } else {
        // 404/409 มีข้อความไทยจาก server อยู่แล้ว — ใช้แทนข้อความกลาง ๆ
        const body = await res.json().catch(() => null);
        Swal.fire("เกิดข้อผิดพลาด", body?.message || "ไม่สามารถส่งความคิดเห็นได้", "error");
      }
```

- [ ] **Step 2: หน้า `/status/[id]` ใช้ค่าคงที่กลาง**

ใน `pages/status/[id].tsx` แทน
```ts
import SatisfactionForm from "@/components/SatisfactionForm";
```
ด้วย
```ts
import SatisfactionForm from "@/components/SatisfactionForm";
import { MAX_PUBLIC_RATINGS_PER_COMPLAINT as MAX_RATINGS } from "@/lib/satisfaction/quota";
```
และลบสองบรรทัดนี้ทิ้ง
```ts
// เพดานให้คะแนนต่อเรื่อง (source public) — ค่าเดียวกับ CardOfficail เดิม
const MAX_RATINGS = 4;
```
(ที่เหลือในไฟล์อ้าง `MAX_RATINGS` เหมือนเดิม ไม่ต้องแก้)

- [ ] **Step 3: หน้า `/status/[id]` refetch count เมื่อครบโควตา**

แทน
```tsx
                        <SatisfactionForm
                          complaintId={complaint._id}
                          status={complaint.status}
                          onSubmit={() => {
                            setShowRating(false);
                            setRatingCount((prev) => (prev == null ? prev : prev + 1));
                            loadRatings(complaint._id); // ให้กราฟ/ความเห็นอัปเดตทันที
                          }}
                        />
```
ด้วย
```tsx
                        <SatisfactionForm
                          complaintId={complaint._id}
                          status={complaint.status}
                          onSubmit={() => {
                            setShowRating(false);
                            setRatingCount((prev) => (prev == null ? prev : prev + 1));
                            loadRatings(complaint._id); // ให้กราฟ/ความเห็นอัปเดตทันที
                          }}
                          onQuotaFull={async () => {
                            // server บอกว่าครบโควตา — count ฝั่ง client เก่า ดึงใหม่ให้การ์ดเปลี่ยนเป็น "ครบแล้ว"
                            setShowRating(false);
                            try {
                              const sj = await fetch(
                                `/api/satisfaction/count?complaintId=${complaint._id}&source=public`
                              ).then((r) => r.json());
                              setRatingCount(sj?.count ?? sj?.data?.count ?? MAX_RATINGS);
                            } catch {
                              setRatingCount(MAX_RATINGS);
                            }
                            loadRatings(complaint._id);
                          }}
                        />
```

- [ ] **Step 4: `CardOfficail.js` ใช้ค่าคงที่กลาง**

แทน
```js
import SatisfactionForm from "@/components/SatisfactionForm";
```
ด้วย
```js
import SatisfactionForm from "@/components/SatisfactionForm";
import { MAX_PUBLIC_RATINGS_PER_COMPLAINT } from "@/lib/satisfaction/quota";
```
และแทน
```js
  const MAX_RATINGS = 4; // จำนวนครั้งสูงสุดที่สามารถประเมินได้
```
ด้วย
```js
  const MAX_RATINGS = MAX_PUBLIC_RATINGS_PER_COMPLAINT; // เพดานเดียวกับ server (lib/satisfaction/quota.js)
```
จากนั้นหา `<SatisfactionForm` ในไฟล์เดียวกัน (ประมาณบรรทัด 322–330) แล้วเพิ่ม prop ต่อจาก `onSubmit={...}`:
```js
            onQuotaFull={() => {
              setShowRating(false);
              setSatisfactionCount(MAX_RATINGS); // server ยืนยันครบแล้ว — ให้การ์ดเปลี่ยนเป็น "ประเมินครบ"
            }}
```

- [ ] **Step 5: ตรวจ type + lint + ดูหน้าจริง**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "status/\[id\]" ; echo "tsc-done"`
Expected: เห็นแค่ `tsc-done`

Run: `npx next lint --file components/SatisfactionForm.js --file components/complaints/CardOfficail.js "--file" "pages/status/[id].tsx"`
Expected: ไม่มี error

เปิด `http://localhost:3000/status/<id เรื่องที่เสร็จสิ้น>` — การ์ด "ให้คะแนนความพึงพอใจ" ยังแสดง "x/4 ครั้ง" และเปิดฟอร์มได้เหมือนเดิม (ไม่ต้องส่งคะแนนจริง)

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add components/SatisfactionForm.js "pages/status/[id].tsx" components/complaints/CardOfficail.js
git commit -m "feat(satisfaction): ฟอร์มรับ 429 + onQuotaFull, ค่าคงที่โควตาจาก lib ที่เดียว"
```

---

### Task 9: หน้าแอดมิน — การ์ดแดชบอร์ด + analytics

**Files:**
- Modify: `pages/admin/dashboard.jsx`
- Modify: `pages/admin/analytics.tsx`

- [ ] **Step 1: `dashboard.jsx` เก็บตัวเลขดิบเพิ่มใน `calculateStats`**

แทน
```js
      satisfaction: satisfactionData.averageRating || 0,
      satisfactionByLine: satisfactionData.bySource?.line || { count: 0, average: 0 },
```
ด้วย
```js
      // averageRating นับต่อผู้แจ้ง (lib/satisfaction/fairStats.js) — headline · ที่เหลือเป็นค่าดิบไว้โชว์บรรทัดเล็ก
      satisfaction: satisfactionData.averageRating || 0,
      satisfactionRaw: satisfactionData.rawAverage || 0,
      satisfactionReporters: satisfactionData.reporters || 0,
      satisfactionTotalRatings: satisfactionData.totalRatings || 0,
      satisfactionByLine: satisfactionData.bySource?.line || { count: 0, average: 0 },
```

- [ ] **Step 2: `dashboard.jsx` บรรทัดเล็กใต้ headline**

แทน
```jsx
            <p className="text-4xl font-bold tracking-tight counter-number">{satisfactionPercent.toFixed(1)}<span className="text-lg font-normal opacity-60">%</span></p>
            {stats.satisfactionByLine?.count > 0 && (
```
ด้วย
```jsx
            <p className="text-4xl font-bold tracking-tight counter-number">{satisfactionPercent.toFixed(1)}<span className="text-lg font-normal opacity-60">%</span></p>
            {stats.satisfactionTotalRatings > 0 && (
              <p className="text-amber-100/80 text-xs mt-1">
                ทุกช่วงเวลา · ผู้แจ้ง {stats.satisfactionReporters} ราย · {stats.satisfactionTotalRatings} คะแนน
                {' '}· เฉลี่ยดิบ {stats.satisfactionRaw.toFixed(1)} / 5
              </p>
            )}
            {stats.satisfactionByLine?.count > 0 && (
```

- [ ] **Step 3: `analytics.tsx` interface + subtitle**

แทน
```ts
  avgSatisfaction: number | null;
  totalRatings: number;
```
ด้วย
```ts
  avgSatisfaction: number | null; // นับต่อผู้แจ้ง (lib/satisfaction/fairStats.js)
  totalRatings: number;
  satisfactionReporters: number;
```
และแทน
```tsx
              sub={`จาก ${summary?.totalRatings ?? 0} การประเมิน`}
```
ด้วย
```tsx
              sub={`ผู้แจ้ง ${summary?.satisfactionReporters ?? 0} ราย · ${summary?.totalRatings ?? 0} การประเมิน`}
```

- [ ] **Step 4: ดูหน้าจริง**

เปิด `http://localhost:3000/admin/dashboard` (login แอดมิน): การ์ด "ความพึงพอใจ" แสดง **97.x%** ดาว 5 ดวงเต็ม บรรทัดเล็ก "ทุกช่วงเวลา · ผู้แจ้ง 24 ราย · 59 คะแนน · เฉลี่ยดิบ 4.4 / 5"
เปิด `http://localhost:3000/admin/analytics`: การ์ด "ความพึงพอใจเฉลี่ย" = **4.85 / 5** subtitle "ผู้แจ้ง 24 ราย · 59 การประเมิน" · กราฟรายสัปดาห์ไม่ดิ่งถึง 1.0 ในสัปดาห์ท้าย ๆ

Run: `npx next lint --file pages/admin/dashboard.jsx --file pages/admin/analytics.tsx`
Expected: ไม่มี error ใหม่ (warning เดิมของไฟล์ใหญ่ไม่นับ)

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add pages/admin/dashboard.jsx pages/admin/analytics.tsx
git commit -m "feat(admin): การ์ดความพึงพอใจโชว์ต่อผู้แจ้งเป็น headline + ตัวเลขดิบบรรทัดเล็ก"
```

---

### Task 10: เอกสาร

**Files:**
- Modify: `docs/modules/satisfaction.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: `docs/modules/satisfaction.md` — หัวข้อ API/Model**

แทนบล็อก
```md
- `pages/api/satisfaction/*` (รวม `[id].js`) — `count.js` และ `stats.js` รับ/คืนค่าแยกตาม `source`
- `models/Satisfaction.js` — `source: 'public' | 'line'`, `lineUserId`
- `lib/satisfaction/lineRating.js` — logic ล้วนของ postback (มีเทส)
- `lib/satisfaction/record.js` — **จุดเดียว**ที่เขียน collection `satisfactions`
  ⚠️ การ**อ่าน**ยังไม่ได้รวมศูนย์ — อ่านตรงจาก model อยู่ที่ `pages/api/satisfaction/{count,stats,[id],by-complaint,recent-comments}.js`,
  `pages/api/analytics/satisfaction.ts`, `pages/api/analytics/summary.ts`, `pages/api/tasks/pending.ts`
  เอนด์พอยต์ที่หน้าสาธารณะเรียกต้อง `.select()` เฉพาะฟิลด์ที่ใช้เสมอ — คืนทั้ง document = ปล่อย `lineUserId` ของประชาชนออกเว็บ
  (`by-complaint.js` ไม่มี caller ในโค้ดแล้ว แต่ยัง deploy อยู่)
```
ด้วย
```md
- `pages/api/satisfaction/*` (รวม `[id].js`) — `count.js` รับ/คืนค่าแยกตาม `source` · `stats.js` คืนสถิติรวม (ดู "กติกาการนับ")
- `models/Satisfaction.js` — `source: 'public' | 'line'`, `lineUserId`
- `lib/satisfaction/lineRating.js` — logic ล้วนของ postback (มีเทส)
- `lib/satisfaction/quota.js` — ค่าคงที่โควตา 4 ครั้ง/เรื่อง + `isPublicQuotaFull` (มีเทส) — ใช้ทั้ง server และ client
- `lib/satisfaction/fairStats.js` — กติกานับ "1 ผู้แจ้ง = 1 เสียง" (logic ล้วน มีเทส) · `lib/satisfaction/isoWeek.js` — แบ่งถังรายสัปดาห์ Bangkok (มีเทส)
- `lib/satisfaction/readStats.js` — **จุดเดียว**ที่อ่านข้อมูลทำสถิติรวม → ผู้เรียก `pages/api/satisfaction/stats.js`,
  `pages/api/analytics/summary.ts`, `pages/api/analytics/satisfaction.ts` — **ห้ามคำนวณ `$avg` ดิบเองที่อื่น**
- `lib/satisfaction/record.js` — **จุดเดียว**ที่เขียน collection `satisfactions` (รวมด่านโควตาฝั่ง server)
  ⚠️ การอ่าน**รายเรื่อง**ยังอ่านตรงจาก model ที่ `pages/api/satisfaction/{count,[id],by-complaint,recent-comments}.js`, `pages/api/tasks/pending.ts`
  เอนด์พอยต์ที่หน้าสาธารณะเรียกต้อง `.select()` เฉพาะฟิลด์ที่ใช้เสมอ — คืนทั้ง document = ปล่อย `lineUserId` ของประชาชนออกเว็บ
  (`by-complaint.js` ไม่มี caller ในโค้ดแล้ว แต่ยัง deploy อยู่)
```

- [ ] **Step 2: `docs/modules/satisfaction.md` — ตารางโควตา**

แทนแถว
```md
| การ์ดหน้า `/status` | ใครก็ได้ที่เปิดเรื่องนั้น | 4 ครั้ง/เรื่อง | `public` |
```
ด้วย
```md
| การ์ดหน้า `/status` | ใครก็ได้ที่เปิดเรื่องนั้น | 4 ครั้ง/เรื่อง — บังคับฝั่ง server ใน `record.js` (2026-08-31) → API ตอบ 429 · ค่าคงที่ `lib/satisfaction/quota.js` | `public` |
```

- [ ] **Step 3: `docs/modules/satisfaction.md` — หัวข้อใหม่ก่อน "## Components"**

แทรกก่อนบรรทัด `## Components (⚠️ ยังอยู่ root — รอเฟส 5)`:
```md
## กติกาการนับ (2026-08-31 — spec `docs/superpowers/specs/2026-08-31-satisfaction-fair-stats-design.md`)

ค่าเฉลี่ยที่เป็น headline (การ์ดแดชบอร์ด %, การ์ด "x / 5" และกราฟรายสัปดาห์บน `/admin/analytics`)
นับแบบ **"1 ผู้แจ้ง = 1 เสียง"** ใน `lib/satisfaction/fairStats.js#computeFairStats`:

1. เฉลี่ยคะแนน**ภายในเรื่อง**เดียวกัน → 1 เรื่อง = 1 ค่า (กดซ้ำ/ปั่นโควตาไม่มีน้ำหนักเพิ่ม)
2. เฉลี่ยค่าของทุกเรื่องที่ `reporterKey` เดียวกัน → 1 ผู้แจ้ง = 1 ค่า
3. เฉลี่ยข้ามผู้แจ้ง → `averageRating`

`reporterKey` = `tel:<เบอร์ตัดอักขระที่ไม่ใช่ตัวเลข>` → ไม่มีเบอร์ `line:<lineUserId>` → ไม่มีทั้งคู่/เรื่องถูกลบ `complaint:<id>`
(ไม่เติม 0 ให้เบอร์ 9 หลัก) · กติกาเดียวใช้กับทุกคน — เบอร์เจ้าหน้าที่ที่คีย์แทนประชาชนหลายเรื่องก็ยุบเป็น 1 เสียง

**ทำไม:** ผู้แจ้งรายเดียวยื่นเรื่องเดิมซ้ำ ~10 ใบแล้วให้ 1 ดาวทุกใบ ทำให้ % รวมตกจาก 97% เหลือ 88%
ทั้งที่ประชาชนที่เหลือพอใจ — ไม่บล็อก/ไม่ลบ/ไม่ซ่อนคะแนนใคร แค่ให้ทุกคนมีน้ำหนักเท่ากัน

**ตัวเลขดิบยังคืนเพื่อความโปร่งใส:** `totalRatings` (ครั้ง), `rawAverage`, `ratingDistribution` (histogram รายดาว **ดิบ** —
แถบ 1 ดาวยังเห็นจำนวนจริง), `bySource` (ดิบ) · ฟิลด์ใหม่ `reporters`, `ratedComplaints`, `method: "per-reporter"`
· กราฟรายสัปดาห์แบ่งถัง ISO week เวลา Bangkok ใน JS (`isoWeek.js`) แล้วใช้กติกาเดียวกันต่อถัง

**เฟส 2 (ยังไม่ทำ):** ผูกเรื่องซ้ำ `duplicateOf` — เปลี่ยนคีย์ขั้น 1 จาก `complaintId` เป็นเรื่องแม่ที่ `computeFairStats` จุดเดียว

```

- [ ] **Step 4: `CLAUDE.md` bullet satisfaction**

ในหัวข้อ "Feature modules" bullet **User satisfaction** แทนท่อน
```md
— **เขียน collection ผ่าน `lib/satisfaction/record.js` ที่เดียวเท่านั้น** อย่าเรียก `Satisfaction.create()` ตรง ๆ ที่อื่น (ส่วนการ**อ่าน**ยังกระจายอยู่หลายไฟล์ เช่น `count.js`, `stats.js`, `[id].js`, `recent-comments.js`, `pages/api/analytics/*`, `pages/api/tasks/pending.ts` — เอนด์พอยต์สาธารณะต้อง `.select()` เสมอ ห้ามคืนทั้ง document เพราะมี `lineUserId`)
```
ด้วย
```md
— **เขียน collection ผ่าน `lib/satisfaction/record.js` ที่เดียวเท่านั้น** อย่าเรียก `Satisfaction.create()` ตรง ๆ ที่อื่น (โควตา 4 ครั้ง/เรื่องบังคับฝั่ง server ที่นี่ ค่าคงที่ใน `lib/satisfaction/quota.js`) · **สถิติรวมนับต่อผู้แจ้ง ("1 ผู้แจ้ง = 1 เสียง") ผ่าน `lib/satisfaction/readStats.js` + `fairStats.js` เท่านั้น — ห้ามคำนวณ `$avg` ดิบเองที่อื่น** (การอ่าน**รายเรื่อง**ยังกระจายที่ `count.js`, `[id].js`, `recent-comments.js`, `pages/api/tasks/pending.ts` — เอนด์พอยต์สาธารณะต้อง `.select()` เสมอ ห้ามคืนทั้ง document เพราะมี `lineUserId`)
```

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add docs/modules/satisfaction.md CLAUDE.md
git commit -m "docs(satisfaction): กติกาการนับต่อผู้แจ้ง + โควตาบังคับฝั่ง server"
```

---

### Task 11: ตรวจรับรวม

**Files:** ไม่มีการแก้ (เว้นแต่พบปัญหา)

- [ ] **Step 1: เทสทั้งชุด**

Run: `npm test`
Expected: ทุกไฟล์ผ่าน รวมเทสใหม่ 3 ไฟล์ (`quota` 4, `isoWeek` 6, `fairStats` 13)

- [ ] **Step 2: Lint ทั้งโปรเจกต์**

Run: `npm run lint`
Expected: ไม่มี error ใหม่ในไฟล์ที่แตะ

- [ ] **Step 3: Build (ปิด dev ก่อน — build ทับ `.next` ของ dev ทำให้ API ตอบ 500 เงียบ ๆ)**

Run: หยุด `npm run dev` แล้ว `rm -rf .next && npm run build`
Expected: `✓ Compiled successfully` ไม่มี type error · เสร็จแล้ว `rm -rf .next` ก่อนเปิด dev ใหม่

- [ ] **Step 4: ตรวจตัวเลขปลายทางอีกครั้งหลัง build**

Run: `npm run dev` แล้ว `curl -s http://localhost:3000/api/satisfaction/stats | python3 -m json.tool`
Expected: `averageRating ≈ 4.85`, `reporters 24`, `totalRatings 59`, `rawAverage ≈ 4.41` (หรือค่าใหม่ถ้ามีคะแนนเพิ่ม — ต้อง `averageRating > rawAverage`)

- [ ] **Step 5: ตรวจสอบสาขาและ log**

Run: `git branch --show-current && git log --oneline main..HEAD`
Expected: `satisfaction-fair-stats` และ commit ตาม Task 1–10 (+ spec) ครบ

- [ ] **Step 6: ส่งมอบ** — ใช้ skill `superpowers:finishing-a-development-branch` (เปิด PR เข้า **main** ไม่ใช่ master · merge = live ทันทีบน Railway)

---

## Self-review notes

- **Spec coverage:** ส่วนที่ 1 (fairStats, reporterKey, เอาต์พุต, กราฟรายสัปดาห์, กรณีขอบ) → Task 2, 3, 6 · ส่วนที่ 2A readStats + 3 endpoint → Task 4, 5, 6 · 2B หน้าจอ → Task 9 · 2C โควตา → Task 1, 7, 8 · 2D เทส → Task 1, 2, 3 · 2E เอกสาร → Task 10 · 2F จุดต่อเฟส 2 → คอมเมนต์ใน `fairStats.js` + เอกสาร · การตรวจรับ → Task 11
- **Type consistency:** `computeFairStats(ratings, reports: Map)` / `loadSatisfactionStats({ from })` → `{ ratings, reports }` / `isoWeekKey(date)` → `{ year, week, label }` / `isPublicQuotaFull(count)` / `publicQuotaFullMessage()` / `MAX_PUBLIC_RATINGS_PER_COMPLAINT` ใช้ชื่อเดียวกันทุก task · ฟิลด์ผลลัพธ์ `averageRating, rawAverage, totalRatings, ratedComplaints, reporters, ratingDistribution, bySource, method` ตรงกันระหว่าง fairStats, stats.js, dashboard, summary
- **ข้อจำกัดที่ยอมรับ:** เส้น 429 ทดสอบสดไม่ได้กับฐาน production โดยไม่เขียนคะแนนจริง — ครอบด้วยเทส logic + ตรวจโค้ด (Task 7 ขั้น 4)
