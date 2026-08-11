# Smart Waste — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างชั้นข้อมูลและ API ของโมดูล `smart-waste` ให้ครบ พร้อมนำเข้าข้อมูลจริงจากไฟล์ Excel ปีงบ 2568–2569 และตรวจยอดว่าตรงกับต้นฉบับ

**Architecture:** Logic ล้วนทั้งหมดอยู่ใน `lib/smart-waste/*.js` เป็นฟังก์ชัน pure ที่ทดสอบด้วย vitest ได้โดยไม่ต้องมี Mongo หรือ HTTP · Mongoose models 2 ตัว (`WasteType` master data, `WasteDaily` 1 doc = 1 วัน) · API routes ใต้ `pages/api/smart-waste/` ทุกตัวผ่าน `requireWasteAdmin` ตาม pattern ของ `pages/api/pm25/_auth.js` · การนำเข้าไฟล์เก่าทำผ่าน endpoint อัปโหลด ไม่ใช่ standalone script (เหตุผลอยู่ในสเปกข้อ 9)

**Tech Stack:** Next.js 15 Pages Router · Mongoose 8 · Clerk · `xlsx@0.18` (มีอยู่แล้ว) · `zod@3` (มีอยู่แล้ว) · `formidable@3` (มีอยู่แล้ว) · **vitest (ติดตั้งใหม่)**

**Spec:** [`docs/superpowers/specs/2026-08-11-smart-waste-design.md`](../specs/2026-08-11-smart-waste-design.md)

**Branch:** `feat/smart-waste` (สร้างไว้แล้ว)

---

## หมายเหตุก่อนเริ่ม

**ข้อจำกัดของ repo ที่ต้องรู้:**

1. `lib/**/*.js` ทุกไฟล์เป็น **ESM** (`export`) และ `package.json` **ไม่มี** `"type": "module"`
   → ไฟล์ใน `scripts/` (CommonJS, รันด้วย `node` ตรง ๆ) **import ของจาก `lib/` ไม่ได้**
   นี่คือเหตุผลที่การนำเข้าไฟล์ Excel ทำเป็น API endpoint ไม่ใช่ script
2. `tsconfig.json` `include` มีแค่ `**/*.ts`, `**/*.tsx` และไฟล์ `.js` 3 ไฟล์ที่ระบุชื่อ
   → ไฟล์ `.js`/`.jsx` ใหม่ที่เราสร้าง **ไม่ถูก type-check ตอน `next build`** และไฟล์เทสต์ก็เช่นกัน
   ไม่ต้องแก้ `tsconfig.json`
3. `lib/dbConnect.js` อ่าน env **`MONGO_URI`** (ไม่ใช่ `MONGODB_URI`)
4. Mongoose model ทุกตัวต้องระบุ **ชื่อ collection เป็น argument ที่สาม** เสมอ

**Convention ของ import ในโมดูลนี้:** ไฟล์ใน `lib/smart-waste/` import กันเองด้วย path
สัมพัทธ์ (`./wasteGroups`) ส่วนไฟล์นอกโมดูล (API routes) ใช้ alias `@/lib/smart-waste/...`

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `vitest.config.mjs` | ตั้งค่า test runner + alias `@` |
| `lib/smart-waste/wasteGroups.js` | 8 กลุ่มใหญ่ (fixed) + helper ตรวจ/แปลง key |
| `lib/smart-waste/wasteTypesSeed.js` | 24 ประเภทตั้งต้น (ตารางสเปกข้อ 2.2) |
| `lib/smart-waste/fiscalYear.js` | แปลงวันที่ ↔ ปีงบประมาณ ↔ ชื่อชีตไทย |
| `lib/smart-waste/aggregate.js` | `round2` / `computeTotals` / `normalizeEntries` — แหล่งความจริงเดียวของสูตรรวม |
| `lib/smart-waste/importWorkbook.js` | workbook เก่า → `{ records, verification }` |
| `lib/smart-waste/exportWorkbook.js` | records → workbook หน้าตาเหมือนไฟล์เดิม |
| `models/smart-waste/WasteType.js` | collection `smart_waste_types` |
| `models/smart-waste/WasteDaily.js` | collection `smart_waste_daily` |
| `pages/api/smart-waste/_auth.js` | `requireWasteAdmin` / `requireWasteSuperadmin` |
| `pages/api/smart-waste/types/index.js` | GET list (+ auto-seed) · POST create |
| `pages/api/smart-waste/types/[id].js` | PATCH · DELETE (soft) |
| `pages/api/smart-waste/daily/index.js` | GET list ตามช่วงวัน |
| `pages/api/smart-waste/daily/[date].js` | GET วันเดียว · PUT upsert |
| `pages/api/smart-waste/summary.js` | GET สรุปรายเดือนต่อปีงบ |
| `pages/api/smart-waste/import.js` | POST อัปโหลด xlsx (superadmin) |
| `pages/api/smart-waste/export.js` | GET ไฟล์ .xlsx |

เทสต์ทั้งหมดอยู่ที่ `lib/smart-waste/__tests__/*.test.js`

---

## Task 1: ติดตั้ง vitest

**Files:**
- Create: `vitest.config.mjs`
- Modify: `package.json`
- Test: `lib/smart-waste/__tests__/setup.test.js`

- [ ] **Step 1: ติดตั้ง vitest**

```bash
npm install --save-dev vitest@^3
```

- [ ] **Step 2: สร้าง `vitest.config.mjs`**

ใช้นามสกุล `.mjs` ให้ตรงกับ config ไฟล์อื่นใน repo (`eslint.config.mjs`, `postcss.config.mjs`)

```js
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// เทสต์ของโปรเจกต์นี้ครอบเฉพาะ logic ล้วนใน lib/ (ไม่มี React/DOM/Mongo)
// — environment 'node' จึงพอ และไม่ต้องติดตั้ง jsdom
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(process.cwd()) },
  },
  test: {
    environment: 'node',
    include: ['lib/**/__tests__/**/*.test.js'],
  },
});
```

- [ ] **Step 3: เพิ่ม script ใน `package.json`**

แก้บล็อก `"scripts"` โดยเพิ่ม 2 บรรทัดนี้ต่อจาก `"lint"`:

```json
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 4: เขียนเทสต์ smoke ที่ต้องผ่าน**

สร้าง `lib/smart-waste/__tests__/setup.test.js`:

```js
import { describe, expect, it } from 'vitest';

describe('vitest setup', () => {
  it('รันเทสต์ได้', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: รันเทสต์**

Run: `npm test`
Expected: PASS — `Test Files 1 passed (1)` / `Tests 1 passed (1)`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.mjs lib/smart-waste/__tests__/setup.test.js
git commit -m "chore: ติดตั้ง vitest สำหรับทดสอบ logic ล้วนของ smart-waste"
```

---

## Task 2: กลุ่มขยะ 8 กลุ่ม

**Files:**
- Create: `lib/smart-waste/wasteGroups.js`
- Test: `lib/smart-waste/__tests__/wasteGroups.test.js`

- [ ] **Step 1: เขียนเทสต์ที่ต้องพัง**

สร้าง `lib/smart-waste/__tests__/wasteGroups.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  WASTE_GROUPS,
  WASTE_GROUP_KEYS,
  isWasteGroupKey,
  wasteGroupLabel,
} from '../wasteGroups';

describe('wasteGroups', () => {
  it('มี 8 กลุ่ม เรียงตามลำดับแถวในชีต "รวม" ของไฟล์ต้นฉบับ', () => {
    expect(WASTE_GROUP_KEYS).toEqual([
      'paper',
      'plastic',
      'aluminum',
      'steel',
      'mixedMetal',
      'glass',
      'foodWaste',
      'kapok',
    ]);
  });

  it('key ทุกตัวใช้ camelCase เพราะถูกใช้เป็น field name ของ groupTotals ใน Mongo', () => {
    for (const key of WASTE_GROUP_KEYS) {
      expect(key).toMatch(/^[a-z][a-zA-Z]*$/);
    }
  });

  it('ทุกกลุ่มมี label ภาษาไทย', () => {
    expect(WASTE_GROUPS).toHaveLength(8);
    for (const group of WASTE_GROUPS) {
      expect(group.label.length).toBeGreaterThan(0);
    }
    expect(wasteGroupLabel('foodWaste')).toBe('เศษอาหาร');
  });

  it('isWasteGroupKey คัดกรอง key ที่ไม่รู้จัก', () => {
    expect(isWasteGroupKey('plastic')).toBe(true);
    expect(isWasteGroupKey('copper')).toBe(false);
    expect(isWasteGroupKey('')).toBe(false);
  });

  it('wasteGroupLabel คืน key เดิมเมื่อไม่รู้จัก (ไม่ throw)', () => {
    expect(wasteGroupLabel('copper')).toBe('copper');
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run lib/smart-waste/__tests__/wasteGroups.test.js`
Expected: FAIL — `Failed to resolve import "../wasteGroups"`

- [ ] **Step 3: เขียน implementation**

สร้าง `lib/smart-waste/wasteGroups.js`:

```js
// 8 กลุ่มใหญ่ของขยะ — ลำดับตรงกับลำดับแถวในชีต "รวม" ของไฟล์ Excel ต้นฉบับ
//
// กลุ่มเป็น fixed ในโค้ด (ไม่ใช่ master data ที่แอดมินแก้ได้) เพราะเป็นหัวข้อรายงาน
// ที่ส่งหน่วยงานภายนอก — เปลี่ยนเมื่อไรรายงานย้อนหลังเทียบกันไม่ได้
//
// key ใช้ camelCase เพราะถูกใช้เป็น field name ของ WasteDaily.groupTotals ใน MongoDB
// โดยตรง (จะได้ไม่ต้องแปลงกลับไปกลับมาระหว่าง snake_case กับ camelCase)

export const WASTE_GROUPS = [
  { key: 'paper', label: 'กระดาษ' },
  { key: 'plastic', label: 'พลาสติก' },
  { key: 'aluminum', label: 'อะลูมิเนียม' },
  { key: 'steel', label: 'เหล็ก' },
  { key: 'mixedMetal', label: 'โลหะผสม' },
  { key: 'glass', label: 'แก้ว' },
  { key: 'foodWaste', label: 'เศษอาหาร' },
  { key: 'kapok', label: 'นุ่น' },
];

export const WASTE_GROUP_KEYS = WASTE_GROUPS.map((group) => group.key);

export function isWasteGroupKey(key) {
  return WASTE_GROUP_KEYS.includes(key);
}

export function wasteGroupLabel(key) {
  const group = WASTE_GROUPS.find((item) => item.key === key);
  return group ? group.label : key;
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run lib/smart-waste/__tests__/wasteGroups.test.js`
Expected: PASS — 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add lib/smart-waste/wasteGroups.js lib/smart-waste/__tests__/wasteGroups.test.js
git commit -m "feat(smart-waste): เพิ่มนิยาม 8 กลุ่มขยะ"
```

---

## Task 3: ประเภทขยะตั้งต้น 24 รายการ

**Files:**
- Create: `lib/smart-waste/wasteTypesSeed.js`
- Test: `lib/smart-waste/__tests__/wasteTypesSeed.test.js`

- [ ] **Step 1: เขียนเทสต์ที่ต้องพัง**

สร้าง `lib/smart-waste/__tests__/wasteTypesSeed.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { WASTE_TYPES_SEED, LEGACY_HEADER_ALIASES } from '../wasteTypesSeed';
import { isWasteGroupKey } from '../wasteGroups';

describe('wasteTypesSeed', () => {
  it('มี 24 ประเภท ตรงกับจำนวนคอลัมน์ในไฟล์ต้นฉบับ', () => {
    expect(WASTE_TYPES_SEED).toHaveLength(24);
  });

  it('order เป็น 1..24 ไม่ซ้ำ ไม่ข้าม (คุมลำดับคอลัมน์ตอน export)', () => {
    const orders = WASTE_TYPES_SEED.map((type) => type.order).sort((a, b) => a - b);
    expect(orders).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });

  it('key ไม่ซ้ำ และ label ไม่ซ้ำ', () => {
    expect(new Set(WASTE_TYPES_SEED.map((t) => t.key)).size).toBe(24);
    expect(new Set(WASTE_TYPES_SEED.map((t) => t.label)).size).toBe(24);
  });

  it('ทุกประเภทอยู่ในกลุ่มที่มีอยู่จริง', () => {
    for (const type of WASTE_TYPES_SEED) {
      expect(isWasteGroupKey(type.group), `${type.key} → ${type.group}`).toBe(true);
    }
  });

  it('มี 7 ประเภทที่ติดธง isCommon ตามพฤติกรรมการกรอกจริง', () => {
    const common = WASTE_TYPES_SEED.filter((t) => t.isCommon).map((t) => t.key);
    expect(common.sort()).toEqual(
      [
        'plastic_mixed',
        'plastic_pet',
        'glass_clear',
        'glass_amber',
        'metal_tin_can',
        'food_waste_compost',
        'plastic_soft_bag',
      ].sort()
    );
  });

  it('ถุงอ่อนเป็นประเภทเดียวที่ติดธง isHighlighted ตอนเริ่มระบบ', () => {
    const highlighted = WASTE_TYPES_SEED.filter((t) => t.isHighlighted).map((t) => t.key);
    expect(highlighted).toEqual(['plastic_soft_bag']);
  });

  it('ถุงอ่อนอยู่ในกลุ่มพลาสติก (ไม่ใช่กลุ่มที่ 9)', () => {
    const softBag = WASTE_TYPES_SEED.find((t) => t.key === 'plastic_soft_bag');
    expect(softBag.group).toBe('plastic');
  });

  it('ใช้ชื่อ "เปลือกสายไฟ" ไม่ใช่ "สายไฟ" — คอลัมน์นี้ถูกนับเป็นพลาสติกในไฟล์ต้นฉบับ', () => {
    const sheath = WASTE_TYPES_SEED.find((t) => t.key === 'plastic_wire_sheath');
    expect(sheath.label).toBe('เปลือกสายไฟ');
    expect(sheath.group).toBe('plastic');
    expect(WASTE_TYPES_SEED.some((t) => t.label === 'สายไฟ')).toBe(false);
  });

  it('alias ของหัวคอลัมน์ในไฟล์เก่าชี้ไปที่ประเภทที่มีอยู่จริง', () => {
    expect(LEGACY_HEADER_ALIASES['สายไฟ']).toBe('plastic_wire_sheath');
    for (const key of Object.values(LEGACY_HEADER_ALIASES)) {
      expect(WASTE_TYPES_SEED.some((t) => t.key === key)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run lib/smart-waste/__tests__/wasteTypesSeed.test.js`
Expected: FAIL — `Failed to resolve import "../wasteTypesSeed"`

- [ ] **Step 3: เขียน implementation**

สร้าง `lib/smart-waste/wasteTypesSeed.js`:

```js
// ประเภทขยะตั้งต้น 24 รายการ — ถอดจากหัวคอลัมน์ของชีตรายเดือนในไฟล์ Excel เดิม
// ใช้เป็น seed ครั้งแรกของ collection smart_waste_types เท่านั้น
// หลังจากนั้นแอดมินแก้/เพิ่ม/ปิดประเภทผ่านหน้าจัดการได้เอง — ไฟล์นี้จะไม่เขียนทับของเดิม
//
// order = ลำดับคอลัมน์ในไฟล์เดิม ใช้คุม layout ตอน export ให้ตรงต้นฉบับ
// isCommon = ประเภทที่กรอกแทบทุกวัน → เด้งขึ้นหน้าแรกของฟอร์มมือถือ
//            (คัดจากข้อมูลจริง 2 ปี: แต่ละวันกรอกจริงแค่ 5–10 ช่องจาก 24)
// isHighlighted = ประเภทที่เจ้าหน้าที่สนใจเป็นพิเศษ → StatCard ของตัวเองบน dashboard
//            + แถว "เฉพาะ<label>" ในชีต "รวม" ตอน export

export const WASTE_TYPES_SEED = [
  { key: 'paper_mixed', label: 'กระดาษรวม', group: 'paper', order: 1 },
  { key: 'paper_carton', label: 'กระดาษลัง', group: 'paper', order: 2 },
  { key: 'paper_white_black', label: 'กระดาษขาวดำ', group: 'paper', order: 3 },
  { key: 'plastic_rigid', label: 'พลาสติกกรอบ', group: 'plastic', order: 4 },
  { key: 'plastic_mixed', label: 'พลาสติกรวม', group: 'plastic', order: 5, isCommon: true },
  { key: 'plastic_pet', label: 'ขวดพลาสติก PET', group: 'plastic', order: 6, isCommon: true },
  { key: 'plastic_bottle_clear', label: 'ขวดพลาสติกใส', group: 'plastic', order: 7 },
  { key: 'plastic_bottle_hdpe', label: 'ขวดพลาสติกขุ่น', group: 'plastic', order: 8 },
  { key: 'plastic_hose', label: 'สายยาง', group: 'plastic', order: 9 },
  { key: 'plastic_strap', label: 'สายรัดของ', group: 'plastic', order: 10 },
  { key: 'plastic_linoleum', label: 'เสื่อน้ำมัน', group: 'plastic', order: 11 },
  { key: 'plastic_pvc_pipe', label: 'ท่อ PVC', group: 'plastic', order: 12 },
  { key: 'plastic_boots', label: 'รองเท้าบู้ท', group: 'plastic', order: 13 },
  // ไฟล์เดิมเขียนหัวคอลัมน์ว่า "สายไฟ" แต่สูตร รวม!พลาสติก = SUM(รวมละเอียด!B5:B15, B24)
  // นับคอลัมน์นี้เป็นพลาสติก → ของจริงคือ "เปลือกสายไฟ" (ฉนวนหุ้ม) ไม่ใช่ทองแดง
  { key: 'plastic_wire_sheath', label: 'เปลือกสายไฟ', group: 'plastic', order: 14 },
  { key: 'glass_clear', label: 'ขวดแก้วใส', group: 'glass', order: 15, isCommon: true },
  { key: 'glass_amber', label: 'ขวดแก้วแดง', group: 'glass', order: 16, isCommon: true },
  { key: 'glass_green', label: 'ขวดแก้วเขียว', group: 'glass', order: 17 },
  { key: 'metal_tin_can', label: 'กระป๋องสังกะสี', group: 'mixedMetal', order: 18, isCommon: true },
  { key: 'aluminum_can', label: 'กระป๋องอลูมิเนียม', group: 'aluminum', order: 19 },
  { key: 'aluminum_scrap', label: 'เศษอลูมิเนียม', group: 'aluminum', order: 20 },
  { key: 'steel_scrap', label: 'เหล็ก', group: 'steel', order: 21 },
  // หัวคอลัมน์ในไฟล์เดิมคือ "ปุ๋ย" แต่ชีต "รวม" นับเป็นกลุ่ม "เศษอาหาร"
  { key: 'food_waste_compost', label: 'ปุ๋ย', group: 'foodWaste', order: 22, isCommon: true },
  {
    key: 'plastic_soft_bag',
    label: 'ถุงอ่อน',
    group: 'plastic',
    order: 23,
    isCommon: true,
    isHighlighted: true,
  },
  { key: 'kapok', label: 'นุ่น', group: 'kapok', order: 24 },
];

// หัวคอลัมน์ที่เขียนไม่ตรงกับ label ในไฟล์ Excel เก่า → typeKey
// เก็บไว้ที่นี่เพราะเป็นเรื่องของไฟล์เก่าโดยเฉพาะ ไม่ใช่ข้อมูลของระบบ
// (ไม่เก็บใน WasteType เพราะไม่อยากให้แอดมินเห็น/แก้ได้)
export const LEGACY_HEADER_ALIASES = {
  สายไฟ: 'plastic_wire_sheath',
};
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run lib/smart-waste/__tests__/wasteTypesSeed.test.js`
Expected: PASS — 9 tests passed

- [ ] **Step 5: Commit**

```bash
git add lib/smart-waste/wasteTypesSeed.js lib/smart-waste/__tests__/wasteTypesSeed.test.js
git commit -m "feat(smart-waste): เพิ่มประเภทขยะตั้งต้น 24 รายการ"
```

---

## Task 4: ปีงบประมาณและชื่อชีตไทย

จุดที่พลาดง่ายที่สุดของทั้งงาน — ชีต `ต.ค.68` ในไฟล์ปีงบ 2569 หมายถึง **ต.ค. พ.ศ. 2568 = ค.ศ. 2025-10** ไม่ใช่ 2026-10

**Files:**
- Create: `lib/smart-waste/fiscalYear.js`
- Test: `lib/smart-waste/__tests__/fiscalYear.test.js`

- [ ] **Step 1: เขียนเทสต์ที่ต้องพัง**

สร้าง `lib/smart-waste/__tests__/fiscalYear.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  bangkokToday,
  fiscalMonths,
  fiscalYearOf,
  fiscalYearRange,
  isValidRecordDate,
  parseSheetName,
} from '../fiscalYear';

describe('fiscalYearOf', () => {
  it('เดือน ต.ค.–ธ.ค. นับเป็นปีงบถัดไป', () => {
    expect(fiscalYearOf('2025-10-01')).toBe(2569);
    expect(fiscalYearOf('2025-12-31')).toBe(2569);
  });

  it('เดือน ม.ค.–ก.ย. นับเป็นปีงบเดียวกับปี พ.ศ.', () => {
    expect(fiscalYearOf('2026-01-01')).toBe(2569);
    expect(fiscalYearOf('2026-08-11')).toBe(2569);
    expect(fiscalYearOf('2026-09-30')).toBe(2569);
  });

  it('รอยต่อ ก.ย. → ต.ค. ข้ามปีงบพอดี', () => {
    expect(fiscalYearOf('2025-09-30')).toBe(2568);
    expect(fiscalYearOf('2025-10-01')).toBe(2569);
  });
});

describe('fiscalYearRange', () => {
  it('ปีงบ 2569 = 1 ต.ค. 2025 ถึง 30 ก.ย. 2026', () => {
    expect(fiscalYearRange(2569)).toEqual({ start: '2025-10-01', end: '2026-09-30' });
  });

  it('ขอบเขตสอดคล้องกับ fiscalYearOf ทั้งสองฝั่ง', () => {
    const { start, end } = fiscalYearRange(2568);
    expect(fiscalYearOf(start)).toBe(2568);
    expect(fiscalYearOf(end)).toBe(2568);
  });
});

describe('fiscalMonths', () => {
  const months = fiscalMonths(2569);

  it('คืน 12 เดือน เริ่ม ต.ค. จบ ก.ย.', () => {
    expect(months).toHaveLength(12);
    expect(months[0].sheetName).toBe('ต.ค.68');
    expect(months[11].sheetName).toBe('ก.ย.69');
  });

  it('เดือน ต.ค.–ธ.ค. อยู่ในปี ค.ศ. ก่อนหน้า', () => {
    expect(months[0].key).toBe('2025-10');
    expect(months[2].key).toBe('2025-12');
    expect(months[3].key).toBe('2026-01');
  });

  it('daysInMonth ถูกต้องรวมถึงเดือน ก.พ.', () => {
    expect(months[0].daysInMonth).toBe(31); // ต.ค. 2025
    expect(months[4].daysInMonth).toBe(28); // ก.พ. 2026
  });

  it('ปีงบ 2567 ครอบ ก.พ. 2567 ที่เป็นปีอธิกสุรทิน (ค.ศ. 2024)', () => {
    const leap = fiscalMonths(2567);
    expect(leap[4].key).toBe('2024-02');
    expect(leap[4].daysInMonth).toBe(29);
  });
});

describe('parseSheetName', () => {
  it('อ่านชีตของไฟล์ปีงบ 2569 ได้ถูกปี ค.ศ.', () => {
    expect(parseSheetName('ต.ค.68')).toEqual({
      month: 10,
      year: 2025,
      beYear: 2568,
      fiscalYear: 2569,
    });
    expect(parseSheetName('ก.ย.69')).toEqual({
      month: 9,
      year: 2026,
      beYear: 2569,
      fiscalYear: 2569,
    });
  });

  it('อ่านชีตของไฟล์ปีงบ 2568 ได้', () => {
    expect(parseSheetName('ต.ค.67').fiscalYear).toBe(2568);
    expect(parseSheetName('ก.ย.68').fiscalYear).toBe(2568);
  });

  it('ไป-กลับกับ fiscalMonths ได้ค่าเดิม', () => {
    for (const month of fiscalMonths(2569)) {
      const parsed = parseSheetName(month.sheetName);
      expect(parsed.year).toBe(month.year);
      expect(parsed.month).toBe(month.month);
      expect(parsed.fiscalYear).toBe(2569);
    }
  });

  it('ชื่อชีตที่ไม่รู้จัก → throw ไม่เดามั่ว', () => {
    expect(() => parseSheetName('รวม')).toThrow();
    expect(() => parseSheetName('Sheet1')).toThrow();
    expect(() => parseSheetName('ม.ค')).toThrow();
  });
});

describe('isValidRecordDate', () => {
  it('รับเฉพาะ YYYY-MM-DD ที่มีอยู่จริง', () => {
    expect(isValidRecordDate('2026-08-11')).toBe(true);
    expect(isValidRecordDate('2024-02-29')).toBe(true);
  });

  it('ปฏิเสธวันที่ไม่มีอยู่จริงและรูปแบบผิด', () => {
    expect(isValidRecordDate('2025-02-30')).toBe(false);
    expect(isValidRecordDate('2025-13-01')).toBe(false);
    expect(isValidRecordDate('2025-1-1')).toBe(false);
    expect(isValidRecordDate('')).toBe(false);
    expect(isValidRecordDate(null)).toBe(false);
  });
});

describe('bangkokToday', () => {
  it('คืนวันที่ตามโซนกรุงเทพ ไม่ใช่ UTC', () => {
    // 2026-08-11T18:30:00Z = 12 ส.ค. 01:30 ที่กรุงเทพ (UTC+7)
    expect(bangkokToday(new Date('2026-08-11T18:30:00Z'))).toBe('2026-08-12');
    expect(bangkokToday(new Date('2026-08-11T02:00:00Z'))).toBe('2026-08-11');
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run lib/smart-waste/__tests__/fiscalYear.test.js`
Expected: FAIL — `Failed to resolve import "../fiscalYear"`

- [ ] **Step 3: เขียน implementation**

สร้าง `lib/smart-waste/fiscalYear.js`:

```js
// ปีงบประมาณไทย = 1 ต.ค. ถึง 30 ก.ย. ของปีถัดไป และนับเป็น พ.ศ.
// ตัวอย่าง: ปีงบ 2569 = 1 ต.ค. 2025 (พ.ศ. 2568) ถึง 30 ก.ย. 2026 (พ.ศ. 2569)
//
// วันที่ในระบบเก็บเป็น string 'YYYY-MM-DD' แบบ ค.ศ. เสมอ (ตาม pattern ของ
// models/smart-papar/WaterQualityDaily.js) — เลี่ยงปัญหา timezone shift ที่ทำให้
// วันที่ 1 กลายเป็นวันที่ 31 ของเดือนก่อนเมื่อเซิร์ฟเวอร์อยู่ UTC

const THAI_MONTH_ABBR = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

// จำนวนวันของเดือน — day 0 ของเดือนถัดไปคือวันสุดท้ายของเดือนนี้
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export function isValidRecordDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

// 'YYYY-MM-DD' (ค.ศ.) → ปีงบประมาณ (พ.ศ.)
export function fiscalYearOf(recordDate) {
  if (!isValidRecordDate(recordDate)) {
    throw new Error(`fiscalYearOf: วันที่ไม่ถูกรูปแบบ "${recordDate}"`);
  }
  const [year, month] = recordDate.split('-').map(Number);
  const buddhistYear = year + 543;
  return month >= 10 ? buddhistYear + 1 : buddhistYear;
}

// ปีงบ (พ.ศ.) → ช่วงวันที่ ค.ศ. แบบ inclusive ทั้งสองฝั่ง
export function fiscalYearRange(fiscalYear) {
  const endYear = fiscalYear - 543; // ปีปฏิทินของเดือน ม.ค.–ก.ย.
  return { start: `${endYear - 1}-10-01`, end: `${endYear}-09-30` };
}

// ปีงบ (พ.ศ.) → 12 เดือนเรียงตามปีงบ (ต.ค. → ก.ย.)
export function fiscalMonths(fiscalYear) {
  const endYear = fiscalYear - 543;
  return Array.from({ length: 12 }, (_, index) => {
    const monthIndex = (9 + index) % 12; // 9 = ต.ค.
    const month = monthIndex + 1;
    const year = index < 3 ? endYear - 1 : endYear;
    const beShort = String((year + 543) % 100).padStart(2, '0');
    return {
      key: `${year}-${String(month).padStart(2, '0')}`,
      sheetName: `${THAI_MONTH_ABBR[monthIndex]}${beShort}`,
      label: `${THAI_MONTH_ABBR[monthIndex]} ${beShort}`,
      year,
      month,
      daysInMonth: daysInMonth(year, month),
    };
  });
}

// ชื่อชีตไทยในไฟล์เดิม (เช่น 'ต.ค.68') → เดือน/ปี ค.ศ./ปีงบ
// เลข 2 หลักท้ายชื่อชีตคือ พ.ศ. สองหลักท้าย จึงตีความเป็นช่วง 2500–2599
// (ข้อมูลจริงอยู่แถว ๆ 2560–2580 — ถ้าระบบยังใช้อยู่ถึง พ.ศ. 2600 ต้องแก้ตรงนี้)
export function parseSheetName(sheetName) {
  const match = String(sheetName).trim().match(/^(.+?)(\d{2})$/);
  if (!match) {
    throw new Error(`parseSheetName: ชื่อชีตไม่ถูกรูปแบบ "${sheetName}"`);
  }
  const [, monthAbbr, beShort] = match;
  const monthIndex = THAI_MONTH_ABBR.indexOf(monthAbbr);
  if (monthIndex < 0) {
    throw new Error(`parseSheetName: ไม่รู้จักเดือน "${monthAbbr}" ในชีต "${sheetName}"`);
  }
  const month = monthIndex + 1;
  const beYear = 2500 + Number(beShort);
  return {
    month,
    year: beYear - 543,
    beYear,
    fiscalYear: month >= 10 ? beYear + 1 : beYear,
  };
}

// วันนี้ตามเวลากรุงเทพ ในรูป 'YYYY-MM-DD'
// locale 'en-CA' ให้รูปแบบ YYYY-MM-DD พอดี ไม่ต้องประกอบเอง
export function bangkokToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run lib/smart-waste/__tests__/fiscalYear.test.js`
Expected: PASS — ทุกเทสต์ในไฟล์ผ่าน (16 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/smart-waste/fiscalYear.js lib/smart-waste/__tests__/fiscalYear.test.js
git commit -m "feat(smart-waste): เพิ่มตัวแปลงปีงบประมาณและชื่อชีตไทย"
```

---

## Task 5: สูตรรวมยอด (แหล่งความจริงเดียว)

**Files:**
- Create: `lib/smart-waste/aggregate.js`
- Test: `lib/smart-waste/__tests__/aggregate.test.js`

- [ ] **Step 1: เขียนเทสต์ที่ต้องพัง**

ตัวเลขในเทสต์นี้เป็นยอดรวมเดือน ต.ค. 2568 จากไฟล์จริง (แถว `รวม` ของชีต `ต.ค.68`)
ทุกกลุ่มถูกตรวจกับชีต `รวม` ของไฟล์ต้นฉบับแล้ว

สร้าง `lib/smart-waste/__tests__/aggregate.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  computeTotals,
  emptyGroupTotals,
  findHighValueEntries,
  HIGH_KG_WARNING_THRESHOLD,
  normalizeEntries,
  round2,
} from '../aggregate';
import { WASTE_TYPES_SEED } from '../wasteTypesSeed';

const TYPE_BY_KEY = new Map(WASTE_TYPES_SEED.map((type) => [type.key, type]));

// ยอดรวมเดือน ต.ค. 2568 จากไฟล์ "ขยะรีไซเคิลและขยะเปียก - 2569.xlsx" ชีต ต.ค.68 แถว "รวม"
const OCT_2568_TOTALS = {
  paper_mixed: 305,
  paper_carton: 179,
  paper_white_black: 19,
  plastic_mixed: 1312,
  plastic_pet: 1662,
  plastic_bottle_clear: 43,
  glass_clear: 1756,
  glass_amber: 1683,
  glass_green: 657,
  metal_tin_can: 733,
  aluminum_can: 30,
  steel_scrap: 126,
  food_waste_compost: 4626,
  plastic_soft_bag: 5265,
};

function entriesFrom(kgByTypeKey) {
  return Object.entries(kgByTypeKey).map(([typeKey, kg]) => ({
    typeKey,
    group: TYPE_BY_KEY.get(typeKey).group,
    kg,
  }));
}

describe('round2', () => {
  it('ตัดปัญหาทศนิยมลอยของ float', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(18396)).toBe(18396);
  });
});

describe('emptyGroupTotals', () => {
  it('เริ่มต้นทุกกลุ่มเป็น 0 ครบ 8 กลุ่ม', () => {
    const totals = emptyGroupTotals();
    expect(Object.keys(totals)).toHaveLength(8);
    expect(Object.values(totals).every((value) => value === 0)).toBe(true);
  });
});

describe('computeTotals', () => {
  it('ยอดกลุ่มของ ต.ค.68 ตรงกับชีต "รวม" ของไฟล์ต้นฉบับทุกกลุ่ม', () => {
    const { groupTotals, totalKg } = computeTotals(entriesFrom(OCT_2568_TOTALS));
    expect(groupTotals).toEqual({
      paper: 503,
      plastic: 8282,
      aluminum: 30,
      steel: 126,
      mixedMetal: 733,
      glass: 4096,
      foodWaste: 4626,
      kapok: 0,
    });
    expect(totalKg).toBe(18396);
  });

  it('ยอดรวมเท่ากับผลบวกของทุกกลุ่มเสมอ', () => {
    const { groupTotals, totalKg } = computeTotals(entriesFrom(OCT_2568_TOTALS));
    const sum = Object.values(groupTotals).reduce((acc, value) => acc + value, 0);
    expect(round2(sum)).toBe(totalKg);
  });

  it('ถุงอ่อนถูกนับรวมในกลุ่มพลาสติก ไม่แยกเป็นกลุ่มที่ 9', () => {
    const { groupTotals } = computeTotals(
      entriesFrom({ plastic_soft_bag: 100, plastic_pet: 50 })
    );
    expect(groupTotals.plastic).toBe(150);
    expect(Object.keys(groupTotals)).toHaveLength(8);
  });

  it('ข้ามค่าว่าง/ศูนย์/ติดลบ/ไม่ใช่ตัวเลข', () => {
    const { totalKg } = computeTotals([
      { typeKey: 'plastic_pet', group: 'plastic', kg: 10 },
      { typeKey: 'paper_mixed', group: 'paper', kg: 0 },
      { typeKey: 'glass_clear', group: 'glass', kg: -5 },
      { typeKey: 'kapok', group: 'kapok', kg: null },
      { typeKey: 'steel_scrap', group: 'steel', kg: 'abc' },
    ]);
    expect(totalKg).toBe(10);
  });

  it('entries ว่างหรือ undefined → ยอดเป็น 0 ทั้งหมด ไม่ throw', () => {
    expect(computeTotals([]).totalKg).toBe(0);
    expect(computeTotals(undefined).totalKg).toBe(0);
  });

  it('กลุ่มที่ไม่รู้จัก → throw ไม่ปล่อยให้ยอดหายเงียบ', () => {
    expect(() =>
      computeTotals([{ typeKey: 'copper', group: 'copper', kg: 5 }])
    ).toThrow(/copper/);
  });
});

describe('normalizeEntries', () => {
  it('เติม group จาก master และเรียงตาม order ของประเภท', () => {
    const entries = normalizeEntries(
      [
        { typeKey: 'plastic_soft_bag', kg: 223 },
        { typeKey: 'paper_mixed', kg: 64 },
      ],
      TYPE_BY_KEY
    );
    expect(entries).toEqual([
      { typeKey: 'paper_mixed', group: 'paper', kg: 64 },
      { typeKey: 'plastic_soft_bag', group: 'plastic', kg: 223 },
    ]);
  });

  it('ตัดช่องที่ว่าง/0 ทิ้ง ไม่เก็บลงฐานข้อมูล', () => {
    const entries = normalizeEntries(
      [
        { typeKey: 'plastic_pet', kg: 45 },
        { typeKey: 'kapok', kg: 0 },
        { typeKey: 'glass_green', kg: '' },
      ],
      TYPE_BY_KEY
    );
    expect(entries).toEqual([{ typeKey: 'plastic_pet', group: 'plastic', kg: 45 }]);
  });

  it('รวมค่าของ typeKey ที่ส่งซ้ำเข้าด้วยกัน', () => {
    const entries = normalizeEntries(
      [
        { typeKey: 'plastic_pet', kg: 10 },
        { typeKey: 'plastic_pet', kg: 5.5 },
      ],
      TYPE_BY_KEY
    );
    expect(entries).toEqual([{ typeKey: 'plastic_pet', group: 'plastic', kg: 15.5 }]);
  });

  it('typeKey ที่ไม่มีใน master → throw', () => {
    expect(() => normalizeEntries([{ typeKey: 'copper', kg: 5 }], TYPE_BY_KEY)).toThrow(
      /copper/
    );
  });
});

describe('findHighValueEntries', () => {
  it('เกณฑ์ 1,000 กก./ประเภท/วัน — ค่าสูงสุดที่เคยบันทึกจริงใน 2 ปีคือ 415', () => {
    expect(HIGH_KG_WARNING_THRESHOLD).toBe(1000);
  });

  it('คืนเฉพาะรายการที่เกินเกณฑ์', () => {
    const flagged = findHighValueEntries([
      { typeKey: 'plastic_pet', group: 'plastic', kg: 415 },
      { typeKey: 'food_waste_compost', group: 'foodWaste', kg: 4626 },
    ]);
    expect(flagged).toEqual([{ typeKey: 'food_waste_compost', kg: 4626 }]);
  });

  it('ไม่มีรายการเกินเกณฑ์ → array ว่าง', () => {
    expect(findHighValueEntries([{ typeKey: 'plastic_pet', group: 'plastic', kg: 1000 }])).toEqual(
      []
    );
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run lib/smart-waste/__tests__/aggregate.test.js`
Expected: FAIL — `Failed to resolve import "../aggregate"`

- [ ] **Step 3: เขียน implementation**

สร้าง `lib/smart-waste/aggregate.js`:

```js
// สูตรรวมยอดของบันทึกรายวัน — แหล่งความจริงเดียวของทั้งโมดูล
// ใช้ร่วมกัน 3 จุด: API บันทึกรายวัน / การนำเข้าไฟล์ xlsx / การสร้างไฟล์ export
// แก้สูตรที่ไฟล์นี้ที่เดียว มีผลทุกที่ — ห้ามคำนวณยอดเองที่อื่น

import { WASTE_GROUP_KEYS } from './wasteGroups';

// ปัดทศนิยม 2 ตำแหน่ง — กัน 0.1 + 0.2 = 0.30000000000000004 สะสมเข้าไปในยอดรวมปี
// (น้ำหนักเป็นบวกเสมอ จึงไม่ต้องรับมือเคสติดลบ)
export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function emptyGroupTotals() {
  const totals = {};
  for (const key of WASTE_GROUP_KEYS) totals[key] = 0;
  return totals;
}

// entries: [{ typeKey, group, kg }] → { groupTotals, totalKg }
export function computeTotals(entries) {
  const groupTotals = emptyGroupTotals();
  let totalKg = 0;

  for (const entry of entries || []) {
    const kg = Number(entry?.kg);
    if (!Number.isFinite(kg) || kg <= 0) continue;
    if (!(entry.group in groupTotals)) {
      throw new Error(
        `computeTotals: ไม่รู้จักกลุ่มขยะ "${entry.group}" (typeKey=${entry.typeKey})`
      );
    }
    groupTotals[entry.group] += kg;
    totalKg += kg;
  }

  for (const key of WASTE_GROUP_KEYS) groupTotals[key] = round2(groupTotals[key]);
  return { groupTotals, totalKg: round2(totalKg) };
}

// input ดิบจากฟอร์ม/ไฟล์ → entries ที่พร้อมบันทึก
// - ตัดช่องว่าง/0/ติดลบทิ้ง (ไม่เก็บลง Mongo — เอกสารจะได้เล็ก)
// - เติม group จาก master (snapshot ไว้ในเอกสาร รายงานย้อนหลังจะได้ไม่เปลี่ยนตาม master)
// - รวมค่าถ้ามี typeKey ซ้ำ
// - เรียงตาม order ของประเภท เพื่อให้ลำดับใน Mongo คงที่ ดู diff ง่าย
// typeByKey: Map<typeKey, { group, order }>
export function normalizeEntries(rawEntries, typeByKey) {
  const merged = new Map();

  for (const raw of rawEntries || []) {
    const typeKey = raw?.typeKey;
    const kg = Number(raw?.kg);
    if (!Number.isFinite(kg) || kg <= 0) continue;

    const type = typeByKey.get(typeKey);
    if (!type) {
      throw new Error(`normalizeEntries: ไม่รู้จักประเภทขยะ "${typeKey}"`);
    }

    const existing = merged.get(typeKey);
    if (existing) {
      existing.kg = round2(existing.kg + kg);
    } else {
      merged.set(typeKey, {
        typeKey,
        group: type.group,
        kg: round2(kg),
        order: Number(type.order) || 0,
      });
    }
  }

  return [...merged.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ typeKey, group, kg }) => ({ typeKey, group, kg }));
}

// เกณฑ์เตือน "ตัวเลขสูงผิดปกติ" — ไม่บล็อกการบันทึก แค่ให้ UI ถามยืนยัน
// ค่าสูงสุดที่เคยบันทึกจริงในข้อมูล 2 ปีคือ 415 กก./ประเภท/วัน
// เกณฑ์ 1,000 จึงจับการพิมพ์เกินหลักได้โดยไม่ขวางงานจริง
// อยู่ที่นี่ที่เดียวเพื่อให้ฝั่ง API และฝั่ง UI ใช้ค่าเดียวกัน
export const HIGH_KG_WARNING_THRESHOLD = 1000;

export function findHighValueEntries(entries) {
  return (entries || [])
    .filter((entry) => Number(entry?.kg) > HIGH_KG_WARNING_THRESHOLD)
    .map((entry) => ({ typeKey: entry.typeKey, kg: entry.kg }));
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run lib/smart-waste/__tests__/aggregate.test.js`
Expected: PASS — ทุกเทสต์ในไฟล์ผ่าน (15 tests)

- [ ] **Step 5: รันเทสต์ทั้งหมด**

Run: `npm test`
Expected: PASS — 5 test files ผ่านทั้งหมด, 0 failed

- [ ] **Step 6: Commit**

```bash
git add lib/smart-waste/aggregate.js lib/smart-waste/__tests__/aggregate.test.js
git commit -m "feat(smart-waste): เพิ่มสูตรรวมยอดกลุ่มขยะ"
```

---

## Task 6: Mongoose models

**Files:**
- Create: `models/smart-waste/WasteType.js`
- Create: `models/smart-waste/WasteDaily.js`

ไม่มีเทสต์ในทาสก์นี้ — เป็น schema declaration ล้วน ไม่มี logic ที่พังเงียบได้
(สูตรรวมที่พังเงียบได้ถูกครอบไว้ใน Task 5 แล้ว)

- [ ] **Step 1: สร้าง `models/smart-waste/WasteType.js`**

```js
import mongoose from "mongoose";
import { WASTE_GROUP_KEYS } from "@/lib/smart-waste/wasteGroups";

// master data ประเภทขยะ — แอดมินเพิ่ม/แก้/ปิดได้เองผ่านหน้าจัดการประเภท
// seed ครั้งแรก 24 รายการจาก lib/smart-waste/wasteTypesSeed.js
const WasteTypeSchema = new mongoose.Schema(
  {
    // slug ไม่ซ้ำ เช่น 'plastic_pet' — ล็อกถาวรหลังบันทึก เพราะ WasteDaily.entries อ้างถึง
    key: { type: String, required: true },
    label: { type: String, required: true },
    // 1 ใน 8 กลุ่มของ lib/smart-waste/wasteGroups.js — กลุ่มเป็น fixed ในโค้ด
    group: { type: String, required: true, enum: WASTE_GROUP_KEYS },
    // ลำดับคอลัมน์ในไฟล์ Excel เดิม — คุม layout ตอน export
    order: { type: Number, required: true },
    // เด้งขึ้นหน้าแรกของฟอร์มมือถือ
    isCommon: { type: Boolean, default: false },
    // สนใจเป็นพิเศษ → StatCard ของตัวเอง + แถว "เฉพาะ<label>" ในชีต "รวม"
    isHighlighted: { type: Boolean, default: false },
    // ปิดใช้งานแทนการลบ — ข้อมูลย้อนหลังที่อ้างถึงประเภทนี้ยังอยู่ครบ
    active: { type: Boolean, default: true },

    createdByClerkId: { type: String, default: "" },
    createdByName: { type: String, default: "" },
    updatedByClerkId: { type: String, default: "" },
    updatedByName: { type: String, default: "" },
  },
  { collection: "smart_waste_types", timestamps: true }
);

WasteTypeSchema.index({ key: 1 }, { unique: true });
WasteTypeSchema.index({ active: 1, order: 1 });

export default mongoose.models.WasteType ||
  mongoose.model("WasteType", WasteTypeSchema, "smart_waste_types");
```

- [ ] **Step 2: สร้าง `models/smart-waste/WasteDaily.js`**

```js
import mongoose from "mongoose";
import { WASTE_GROUP_KEYS } from "@/lib/smart-waste/wasteGroups";

// สร้าง sub-schema ของ groupTotals จากรายชื่อกลุ่ม เพื่อไม่ให้ field หลุดจากกัน
// เมื่อรายชื่อกลุ่มเปลี่ยน (จะได้ไม่ต้องไล่แก้ 8 บรรทัดด้วยมือ)
const groupTotalsFields = {};
for (const key of WASTE_GROUP_KEYS) {
  groupTotalsFields[key] = { type: Number, default: 0 };
}

const WasteEntrySchema = new mongoose.Schema(
  {
    typeKey: { type: String, required: true },
    // snapshot กลุ่ม ณ ตอนบันทึก — ถ้าแอดมินย้ายประเภทข้ามกลุ่มภายหลัง
    // รายงานย้อนหลังที่เคยส่งออกไปแล้วต้องไม่เปลี่ยนตัวเลข
    group: { type: String, required: true, enum: WASTE_GROUP_KEYS },
    kg: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

// 1 เอกสาร = 1 วัน รวมทั้งเทศบาล (ไม่แยกจุด/ชุมชน — ตามที่ผู้ใช้เลือก)
const WasteDailySchema = new mongoose.Schema(
  {
    // 'YYYY-MM-DD' ตามวันในไทย — เป็น string เพื่อเลี่ยง timezone shift ทั้งหมด
    recordDate: { type: String, required: true },
    // ปีงบประมาณ พ.ศ. — คำนวณจาก recordDate ด้วย fiscalYearOf() เสมอ ห้ามรับจาก client
    fiscalYear: { type: Number, required: true },

    // เก็บเฉพาะประเภทที่กรอกจริง (5–10 จาก 24) — ไม่เก็บช่องว่าง/0
    entries: { type: [WasteEntrySchema], default: [] },

    // denormalized จาก entries ด้วย computeTotals() ตอนบันทึก
    // เพื่อให้ dashboard/export ไม่ต้อง aggregate ใหม่ทุกครั้ง
    groupTotals: { type: groupTotalsFields, default: () => ({}) },
    totalKg: { type: Number, default: 0 },

    note: { type: String, default: "" },

    createdByClerkId: { type: String, default: "" },
    createdByName: { type: String, default: "" },
    updatedByClerkId: { type: String, default: "" },
    updatedByName: { type: String, default: "" },
  },
  { collection: "smart_waste_daily", timestamps: true }
);

// 1 วัน = 1 เอกสาร — กรอกวันเดิมซ้ำคือ "แก้ของเดิม" ไม่ใช่สร้างใหม่
WasteDailySchema.index({ recordDate: 1 }, { unique: true });
WasteDailySchema.index({ fiscalYear: 1, recordDate: 1 });

export default mongoose.models.WasteDaily ||
  mongoose.model("WasteDaily", WasteDailySchema, "smart_waste_daily");
```

- [ ] **Step 3: ตรวจว่า build ผ่าน**

Run: `npm run build`
Expected: `✓ Compiled successfully` (ไม่มี error เรื่อง import ของ 2 ไฟล์ใหม่)

- [ ] **Step 4: Commit**

```bash
git add models/smart-waste/
git commit -m "feat(smart-waste): เพิ่ม Mongoose models WasteType และ WasteDaily"
```

---

## Task 7: Auth helper

**Files:**
- Create: `pages/api/smart-waste/_auth.js`

ลอก pattern จาก `pages/api/pm25/_auth.js#requirePm25Admin` แต่ใช้ `pathMatchesPermission()`
จาก `lib/permissions.ts` ตามที่ CLAUDE.md กำหนด (ห้ามเขียน `startsWith` เช็คสิทธิ์เอง)

- [ ] **Step 1: สร้าง `pages/api/smart-waste/_auth.js`**

```js
import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import { pathMatchesPermission } from "@/lib/permissions";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
const REQUIRED_PAGE = "/admin/smart-waste";

// หมายเหตุ: User schema ถูก redefine แบบย่อ inline หลายที่ใน repo นี้
// (pages/api/auth/verify-app-access.js, lib/pm25CronAuth.js, pages/api/pm25/_auth.js)
// — เพิ่มฟิลด์ใน User ต้องแก้ทุกที่ ไม่งั้นฟิลด์หายเงียบจากผลคิวรี
function getUserModel() {
  const UserSchema = new mongoose.Schema(
    {
      clerkId: String,
      role: String,
      appId: { type: String, default: "" },
      allowedPages: { type: [String], default: [] },
      isActive: { type: Boolean, default: true },
      isArchived: { type: Boolean, default: false },
      name: String,
    },
    { collection: "users", timestamps: true }
  );
  return mongoose.models.User || mongoose.model("User", UserSchema);
}

export async function requireWasteAdmin(req) {
  const { userId } = getAuth(req);
  if (!userId) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const role = clerkUser.publicMetadata?.role || "admin";
  const clerkName = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim();

  if (role === "superadmin") {
    return { ok: true, userId, role, isSuperAdmin: true, name: clerkName };
  }

  await dbConnect();
  const User = getUserModel();
  const mongoUser = await User.findOne({ clerkId: userId }).lean();

  if (!mongoUser) {
    return { ok: false, status: 403, message: "User not registered" };
  }
  if (!mongoUser.appId || mongoUser.appId !== CURRENT_APP_ID) {
    return { ok: false, status: 403, message: "No app access" };
  }

  const allowed = Array.isArray(mongoUser.allowedPages) ? mongoUser.allowedPages : [];
  // allowedPages ว่าง = ใช้ DEFAULT_PERMISSIONS ซึ่งจะรวมหน้านี้ไว้แล้ว (ดูแผนที่ 2)
  const hasPageAccess =
    allowed.length === 0 ||
    allowed.some((permission) => pathMatchesPermission(REQUIRED_PAGE, permission));

  if (!hasPageAccess) {
    return { ok: false, status: 403, message: "No page access" };
  }

  return {
    ok: true,
    userId,
    role: mongoUser.role || role,
    isSuperAdmin: false,
    name: mongoUser.name || clerkName,
  };
}

// เข้มกว่า requireWasteAdmin — ใช้กับ endpoint ที่เขียนทับข้อมูลได้ทีละหลายร้อยวัน
// (การนำเข้าไฟล์ xlsx)
export async function requireWasteSuperadmin(req) {
  const auth = await requireWasteAdmin(req);
  if (!auth.ok) return auth;
  if (!auth.isSuperAdmin) {
    return { ok: false, status: 403, message: "Superadmin only" };
  }
  return auth;
}
```

- [ ] **Step 2: ตรวจว่า build ผ่าน**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add pages/api/smart-waste/_auth.js
git commit -m "feat(smart-waste): เพิ่ม auth helper ของ API โมดูล"
```

---

## Task 8: API ประเภทขยะ

**Files:**
- Create: `pages/api/smart-waste/types/index.js`
- Create: `pages/api/smart-waste/types/[id].js`

- [ ] **Step 1: สร้าง `pages/api/smart-waste/types/index.js`**

```js
import dbConnect from "@/lib/dbConnect";
import WasteType from "@/models/smart-waste/WasteType";
import WasteDaily from "@/models/smart-waste/WasteDaily";
import { WASTE_TYPES_SEED } from "@/lib/smart-waste/wasteTypesSeed";
import { isWasteGroupKey } from "@/lib/smart-waste/wasteGroups";
import { requireWasteAdmin } from "../_auth";

// seed 24 ประเภทตั้งต้น "เฉพาะตอน collection ยังว่าง"
// ทำตรงนี้แทน migration script เพราะ script ใน repo นี้เป็น CommonJS และ import
// ของจาก lib/ (ESM) ไม่ได้ — จะต้อง duplicate ตาราง 24 ประเภทไปอีกที่หนึ่ง
// รันซ้ำไม่ทำอะไรเพิ่ม และไม่เขียนทับสิ่งที่แอดมินแก้ไว้
export async function ensureWasteTypesSeeded() {
  const count = await WasteType.countDocuments();
  if (count > 0) return { seeded: 0 };
  await WasteType.insertMany(
    WASTE_TYPES_SEED.map((type) => ({
      key: type.key,
      label: type.label,
      group: type.group,
      order: type.order,
      isCommon: Boolean(type.isCommon),
      isHighlighted: Boolean(type.isHighlighted),
      active: true,
    }))
  );
  return { seeded: WASTE_TYPES_SEED.length };
}

// แปลง label เป็น slug ใช้เป็น key เริ่มต้น — แอดมินแก้ได้ก่อนบันทึก
function slugify(label) {
  return String(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default async function handler(req, res) {
  const auth = await requireWasteAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  await dbConnect();

  if (req.method === "GET") {
    await ensureWasteTypesSeeded();
    const includeInactive = req.query.includeInactive === "1";
    const filter = includeInactive ? {} : { active: true };
    const types = await WasteType.find(filter).sort({ order: 1 }).lean();

    // นับจำนวนวันที่อ้างถึงแต่ละประเภท — UI ใช้ตัดสินว่าลบได้หรือไม่
    const usage = await WasteDaily.aggregate([
      { $unwind: "$entries" },
      { $group: { _id: "$entries.typeKey", days: { $sum: 1 } } },
    ]);
    const usageByKey = new Map(usage.map((row) => [row._id, row.days]));

    return res.status(200).json({
      types: types.map((type) => ({
        id: String(type._id),
        key: type.key,
        label: type.label,
        group: type.group,
        order: type.order,
        isCommon: Boolean(type.isCommon),
        isHighlighted: Boolean(type.isHighlighted),
        active: type.active !== false,
        usedDays: usageByKey.get(type.key) || 0,
      })),
    });
  }

  if (req.method === "POST") {
    const { label, group, isCommon, isHighlighted } = req.body || {};
    const key = String(req.body?.key || slugify(label || ""));

    if (!label || !String(label).trim()) {
      return res.status(400).json({ message: "ต้องระบุชื่อประเภท" });
    }
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      return res
        .status(400)
        .json({ message: "key ต้องเป็น a-z, 0-9 และ _ เท่านั้น และขึ้นต้นด้วยตัวอักษร" });
    }
    if (!isWasteGroupKey(group)) {
      return res.status(400).json({ message: `ไม่รู้จักกลุ่มขยะ "${group}"` });
    }
    if (await WasteType.exists({ key })) {
      return res.status(409).json({ message: `มีประเภทที่ใช้ key "${key}" อยู่แล้ว` });
    }

    // ต่อท้ายเสมอ — ไม่แทรกกลางเพื่อไม่ให้ลำดับคอลัมน์ใน export ของปีเก่าขยับ
    const last = await WasteType.findOne().sort({ order: -1 }).lean();
    const created = await WasteType.create({
      key,
      label: String(label).trim(),
      group,
      order: (last?.order || 0) + 1,
      isCommon: Boolean(isCommon),
      isHighlighted: Boolean(isHighlighted),
      active: true,
      createdByClerkId: auth.userId,
      createdByName: auth.name,
    });

    return res.status(201).json({ id: String(created._id), key: created.key });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
```

- [ ] **Step 2: สร้าง `pages/api/smart-waste/types/[id].js`**

```js
import dbConnect from "@/lib/dbConnect";
import WasteType from "@/models/smart-waste/WasteType";
import WasteDaily from "@/models/smart-waste/WasteDaily";
import { requireWasteAdmin } from "../_auth";

export default async function handler(req, res) {
  const auth = await requireWasteAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  await dbConnect();
  const { id } = req.query;
  const type = await WasteType.findById(id);
  if (!type) return res.status(404).json({ message: "ไม่พบประเภทขยะนี้" });

  if (req.method === "PATCH") {
    const { label, isCommon, isHighlighted, active, order } = req.body || {};

    // key และ group แก้ไม่ได้ — WasteDaily.entries snapshot ทั้งคู่ไว้แล้ว
    // เปลี่ยนทีหลังจะทำให้ยอดย้อนหลังกับ master ไม่ตรงกันโดยไม่มีใครรู้
    if (label !== undefined) {
      if (!String(label).trim()) {
        return res.status(400).json({ message: "ชื่อประเภทว่างไม่ได้" });
      }
      type.label = String(label).trim();
    }
    if (isCommon !== undefined) type.isCommon = Boolean(isCommon);
    if (isHighlighted !== undefined) type.isHighlighted = Boolean(isHighlighted);
    if (active !== undefined) type.active = Boolean(active);
    if (order !== undefined && Number.isFinite(Number(order))) {
      type.order = Number(order);
    }

    type.updatedByClerkId = auth.userId;
    type.updatedByName = auth.name;
    await type.save();

    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const usedDays = await WasteDaily.countDocuments({ "entries.typeKey": type.key });
    if (usedDays > 0) {
      return res.status(409).json({
        message: `ลบไม่ได้ — มีข้อมูลอ้างถึงประเภทนี้ ${usedDays} วัน ปิดใช้งานแทนได้`,
        usedDays,
      });
    }
    await type.deleteOne();
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
```

- [ ] **Step 3: ตรวจว่า build ผ่าน**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 4: ทดสอบด้วยมือว่า seed ทำงาน**

เปิดเซิร์ฟเวอร์ dev แล้วล็อกอินเป็น superadmin จากนั้นเรียก endpoint จากแท็บเบราว์เซอร์
(cookie ของ Clerk จะติดไปเอง):

Run: `npm run dev` แล้วเปิด `http://localhost:3000/api/smart-waste/types` ในเบราว์เซอร์ที่ล็อกอินอยู่
Expected: JSON ที่มี `types` ยาว 24 รายการ · `types[0].key === "paper_mixed"` · `types[22].key === "plastic_soft_bag"` และ `isHighlighted: true`

รีเฟรชอีกครั้ง → ยังได้ 24 รายการเท่าเดิม (ไม่ซ้ำเป็น 48) พิสูจน์ว่า seed idempotent

- [ ] **Step 5: Commit**

```bash
git add pages/api/smart-waste/types/
git commit -m "feat(smart-waste): เพิ่ม API จัดการประเภทขยะ พร้อม seed ตั้งต้น"
```

---

## Task 9: อ่านไฟล์ Excel เก่า

**Files:**
- Create: `lib/smart-waste/importWorkbook.js`
- Test: `lib/smart-waste/__tests__/importWorkbook.test.js`

- [ ] **Step 1: เขียนเทสต์ที่ต้องพัง**

เทสต์แบ่ง 2 ชุด: ชุดแรกใช้ workbook สังเคราะห์ (รันได้เสมอ) ชุดที่สองใช้ไฟล์จริง
(รันเมื่อมี env `SMART_WASTE_FIXTURE_DIR` เท่านั้น — ไม่ผูก CI กับไฟล์ในเครื่องผู้ใช้)

สร้าง `lib/smart-waste/__tests__/importWorkbook.test.js`:

```js
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { importWorkbook } from '../importWorkbook';

// สร้าง workbook ปลอมที่มีโครงเหมือนไฟล์จริง: header + แถวรายวัน + แถว "รวม"
function makeWorkbook({ sheetName = 'ต.ค.68', headers, rows, totalRow }) {
  const workbook = XLSX.utils.book_new();
  const aoa = [['วันที่', ...headers, 'Total'], ...rows];
  if (totalRow) aoa.push(['รวม', ...totalRow, '']);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), sheetName);
  return workbook;
}

describe('importWorkbook — workbook สังเคราะห์', () => {
  it('อ่านแถวรายวันเป็น record พร้อมยอดกลุ่มที่คำนวณแล้ว', () => {
    const workbook = makeWorkbook({
      headers: ['ขวดพลาสติก PET', 'ปุ๋ย'],
      rows: [
        [1, 45, 237, 282],
        [2, 93, 177, 270],
      ],
      totalRow: [138, 414],
    });

    const result = importWorkbook(workbook);

    expect(result.fiscalYear).toBe(2569);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      recordDate: '2025-10-01', // ต.ค.68 = ต.ค. พ.ศ. 2568 = ค.ศ. 2025 — ไม่ใช่ 2026
      fiscalYear: 2569,
      totalKg: 282,
    });
    expect(result.records[0].groupTotals.plastic).toBe(45);
    expect(result.records[0].groupTotals.foodWaste).toBe(237);
    expect(result.verification.ok).toBe(true);
  });

  it('รับ alias "สายไฟ" เป็นเปลือกสายไฟ (กลุ่มพลาสติก)', () => {
    const workbook = makeWorkbook({
      headers: ['สายไฟ'],
      rows: [[1, 12, 12]],
      totalRow: [12],
    });

    const result = importWorkbook(workbook);
    expect(result.records[0].entries).toEqual([
      { typeKey: 'plastic_wire_sheath', group: 'plastic', kg: 12 },
    ]);
  });

  it('หัวคอลัมน์ที่ไม่รู้จัก → throw ไม่ข้ามเงียบ', () => {
    const workbook = makeWorkbook({
      headers: ['ทองแดง'],
      rows: [[1, 5, 5]],
      totalRow: [5],
    });
    expect(() => importWorkbook(workbook)).toThrow(/ทองแดง/);
  });

  it('ข้ามวันที่เกินจำนวนวันของเดือน และวันที่ไม่มีข้อมูลเลย', () => {
    const workbook = makeWorkbook({
      sheetName: 'ก.พ.69', // ก.พ. 2026 มี 28 วัน
      headers: ['ปุ๋ย'],
      rows: [
        [1, 10, 10],
        [2, '', ''], // ไม่มีข้อมูล → ไม่สร้าง record
        [29, 99, 99], // ไม่มีอยู่จริง → ข้าม
        [30, 99, 99],
      ],
      totalRow: [10],
    });

    const result = importWorkbook(workbook);
    expect(result.records.map((r) => r.recordDate)).toEqual(['2026-02-01']);
    expect(result.verification.ok).toBe(true);
  });

  it('ยอดที่อ่านได้ไม่ตรงแถว "รวม" → verification.ok = false พร้อมรายละเอียด', () => {
    const workbook = makeWorkbook({
      headers: ['ปุ๋ย'],
      rows: [[1, 10, 10]],
      totalRow: [999],
    });

    const result = importWorkbook(workbook);
    expect(result.verification.ok).toBe(false);
    expect(result.verification.months[0].diffs).toEqual([
      { typeKey: 'food_waste_compost', expected: 999, actual: 10 },
    ]);
  });

  it('ชีตที่ไม่มีแถว "รวม" ให้ตรวจไม่ผ่าน (ไม่เดาว่าถูก)', () => {
    const workbook = makeWorkbook({
      headers: ['ปุ๋ย'],
      rows: [[1, 10, 10]],
      totalRow: null,
    });
    expect(importWorkbook(workbook).verification.ok).toBe(false);
  });

  it('ชีตสรุปถูกข้าม ไม่ถูกตีความเป็นเดือน', () => {
    const workbook = makeWorkbook({
      headers: ['ปุ๋ย'],
      rows: [[1, 10, 10]],
      totalRow: [10],
    });
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['ประเภทขยะ']]),
      'รวมละเอียด'
    );
    expect(() => importWorkbook(workbook)).not.toThrow();
    expect(importWorkbook(workbook).verification.months).toHaveLength(1);
  });
});

// ตรวจกับไฟล์จริง — ตั้ง SMART_WASTE_FIXTURE_DIR ชี้ไปโฟลเดอร์ที่มีไฟล์ 2 ไฟล์นี้
// เช่น: SMART_WASTE_FIXTURE_DIR=~/Downloads npm test
const fixtureDir = process.env.SMART_WASTE_FIXTURE_DIR;
const realFiles = [
  { file: 'ขยะรีไซเคิลและขยะเปียก - 2568.xlsx', fiscalYear: 2568, totalKg: 245509 },
  { file: 'ขยะรีไซเคิลและขยะเปียก - 2569.xlsx', fiscalYear: 2569, totalKg: 42196 },
];

describe.skipIf(!fixtureDir)('importWorkbook — ไฟล์จริง', () => {
  for (const { file, fiscalYear, totalKg } of realFiles) {
    it(`${file} → ปีงบ ${fiscalYear} ยอดรวม ${totalKg} กก. ตรงกับชีต "รวม"`, () => {
      // ⚠️ ห้ามใช้ XLSX.readFile() ที่นี่ — vitest resolve xlsx ไปที่ ESM build (xlsx.mjs)
      // ซึ่งไม่ผูก fs ไว้ในตัว จะได้ error "Cannot access file" ทั้งที่ไฟล์มีอยู่จริง
      // (ตรวจแล้วกับไฟล์จริงในเครื่อง) — อ่าน buffer เองแล้วส่งเข้า XLSX.read แทน
      const buffer = fs.readFileSync(path.join(fixtureDir, file));
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const result = importWorkbook(workbook);

      expect(result.fiscalYear).toBe(fiscalYear);
      expect(result.verification.ok).toBe(true);
      expect(result.verification.totalKg).toBe(totalKg);
    });
  }
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run lib/smart-waste/__tests__/importWorkbook.test.js`
Expected: FAIL — `Failed to resolve import "../importWorkbook"`

- [ ] **Step 3: เขียน implementation**

สร้าง `lib/smart-waste/importWorkbook.js`:

```js
// อ่านไฟล์ Excel รูปแบบเดิม (ปีละ 1 ไฟล์) → records รายวัน + ผลตรวจยอด
// เป็นฟังก์ชัน pure: รับ workbook ที่ parse แล้ว ไม่แตะไฟล์ระบบและไม่แตะ Mongo
// จึงทดสอบได้ตรง ๆ ด้วย vitest

import * as XLSX from 'xlsx';
import { computeTotals, round2 } from './aggregate';
import { parseSheetName } from './fiscalYear';
import { LEGACY_HEADER_ALIASES, WASTE_TYPES_SEED } from './wasteTypesSeed';

// ชีตสรุปในไฟล์ต้นฉบับ — ไม่ใช่ชีตรายเดือน
const SUMMARY_SHEET_NAMES = new Set(['รวม', 'รวมละเอียด']);
const TOTAL_ROW_LABEL = 'รวม';

const TYPE_BY_KEY = new Map(WASTE_TYPES_SEED.map((type) => [type.key, type]));

// หัวคอลัมน์ (ตามที่เขียนในไฟล์) → typeKey
const HEADER_TO_TYPE_KEY = new Map([
  ...WASTE_TYPES_SEED.map((type) => [type.label, type.key]),
  ...Object.entries(LEGACY_HEADER_ALIASES),
]);

function mapHeaderRow(headerRow, sheetName) {
  const columns = [];
  for (let index = 1; index < headerRow.length; index += 1) {
    const raw = String(headerRow[index] ?? '').trim();
    // คอลัมน์ว่างท้ายตารางและคอลัมน์ Total ไม่ใช่ประเภทขยะ
    if (!raw || raw === 'Total') continue;
    const typeKey = HEADER_TO_TYPE_KEY.get(raw);
    if (!typeKey) {
      throw new Error(
        `importWorkbook: ชีต "${sheetName}" มีหัวคอลัมน์ที่ไม่รู้จัก "${raw}" — ` +
          'เพิ่มประเภทนี้ใน wasteTypesSeed.js หรือ LEGACY_HEADER_ALIASES ก่อนนำเข้า'
      );
    }
    columns.push({ index, typeKey, group: TYPE_BY_KEY.get(typeKey).group });
  }
  return columns;
}

export function importWorkbook(workbook) {
  const monthSheetNames = workbook.SheetNames.filter(
    (name) => !SUMMARY_SHEET_NAMES.has(name)
  );
  if (monthSheetNames.length === 0) {
    throw new Error('importWorkbook: ไม่พบชีตรายเดือนในไฟล์');
  }

  const fiscalYears = new Set();
  const records = [];
  const monthChecks = [];

  for (const sheetName of monthSheetNames) {
    const { year, month, fiscalYear } = parseSheetName(sheetName);
    fiscalYears.add(fiscalYear);

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      blankrows: false,
      defval: '',
    });
    const columns = mapHeaderRow(rows[0] || [], sheetName);
    const daysInMonth = new Date(year, month, 0).getDate();

    // ยอดที่เราบวกได้เอง เอาไว้เทียบกับแถว "รวม" ของชีต
    const readTotals = new Map();

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const day = Number(row[0]);
      // ตัดแถว "รวม", แถวเฉลี่ยท้ายชีต และวันที่ไม่มีอยู่จริงในเดือนนั้นออกพร้อมกัน
      if (!Number.isInteger(day) || day < 1 || day > daysInMonth) continue;

      const entries = [];
      for (const column of columns) {
        const kg = Number(row[column.index]);
        if (!Number.isFinite(kg) || kg <= 0) continue;
        entries.push({ typeKey: column.typeKey, group: column.group, kg: round2(kg) });
        readTotals.set(column.typeKey, round2((readTotals.get(column.typeKey) || 0) + kg));
      }

      // วันที่ไม่มีการบันทึกเลย → ไม่สร้างเอกสารเปล่า
      if (entries.length === 0) continue;

      const { groupTotals, totalKg } = computeTotals(entries);
      records.push({
        recordDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        fiscalYear,
        entries,
        groupTotals,
        totalKg,
      });
    }

    // ตรวจยอด: เทียบรายคอลัมน์กับแถว "รวม" ในชีตต้นฉบับ
    const totalRow = rows.find((row) => String(row[0]).trim() === TOTAL_ROW_LABEL);
    const diffs = [];
    for (const column of columns) {
      const expected = round2(Number(totalRow?.[column.index]) || 0);
      const actual = round2(readTotals.get(column.typeKey) || 0);
      if (expected !== actual) {
        diffs.push({ typeKey: column.typeKey, expected, actual });
      }
    }
    monthChecks.push({
      sheetName,
      hasTotalRow: Boolean(totalRow),
      ok: Boolean(totalRow) && diffs.length === 0,
      diffs,
    });
  }

  if (fiscalYears.size !== 1) {
    throw new Error(
      `importWorkbook: ไฟล์เดียวต้องเป็นปีงบเดียว แต่พบ ${[...fiscalYears].join(', ')}`
    );
  }

  return {
    fiscalYear: [...fiscalYears][0],
    records,
    verification: {
      ok: monthChecks.every((check) => check.ok),
      months: monthChecks,
      totalKg: round2(records.reduce((sum, record) => sum + record.totalKg, 0)),
      recordCount: records.length,
    },
  };
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน (ชุดสังเคราะห์)**

Run: `npx vitest run lib/smart-waste/__tests__/importWorkbook.test.js`
Expected: PASS — 7 passed, 2 skipped

- [ ] **Step 5: รันเทสต์กับไฟล์จริง**

Run: `SMART_WASTE_FIXTURE_DIR="$HOME/Downloads" npx vitest run lib/smart-waste/__tests__/importWorkbook.test.js`
Expected: PASS — 9 tests passed · ทั้ง 2 ไฟล์ `verification.ok === true` และยอดรวม 245,509 / 42,196 กก. ตรงกับสเปก

ถ้าเทสต์ชุดนี้ไม่ผ่าน **อย่าไปต่อ** — แปลว่าการอ่านไฟล์ยังไม่ตรงต้นฉบับ ให้ดู `verification.months[].diffs` ว่าคอลัมน์ไหนเพี้ยน

- [ ] **Step 6: Commit**

```bash
git add lib/smart-waste/importWorkbook.js lib/smart-waste/__tests__/importWorkbook.test.js
git commit -m "feat(smart-waste): อ่านไฟล์ Excel เก่าพร้อมตรวจยอดกับแถวรวมในชีต"
```

---

## Task 10: API นำเข้าไฟล์ + นำเข้าข้อมูลจริง

**Files:**
- Create: `pages/api/smart-waste/import.js`

- [ ] **Step 1: สร้าง `pages/api/smart-waste/import.js`**

```js
import fs from "node:fs";
import formidable from "formidable";
import * as XLSX from "xlsx";
import dbConnect from "@/lib/dbConnect";
import WasteDaily from "@/models/smart-waste/WasteDaily";
import { importWorkbook } from "@/lib/smart-waste/importWorkbook";
import { requireWasteSuperadmin } from "./_auth";

// formidable ต้องอ่าน stream เอง — ปิด bodyParser ของ Next
// (pattern เดียวกับ pages/api/upload.js)
export const config = { api: { bodyParser: false } };

const MAX_FILE_SIZE = 10 * 1024 * 1024; // ไฟล์จริงราว 850KB — 10MB เผื่อไว้มากพอ

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // เขียนทับข้อมูลได้ทีละ ~370 วัน จึงจำกัดเฉพาะ superadmin
  const auth = await requireWasteSuperadmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  const dryRun = req.query.dryRun === "1";
  let filepath = null;

  try {
    const form = formidable({ maxFileSize: MAX_FILE_SIZE });
    const [, files] = await form.parse(req);
    const file = files.file?.[0];
    if (!file) return res.status(400).json({ message: "ไม่พบไฟล์ที่อัปโหลด" });
    filepath = file.filepath;

    const workbook = XLSX.read(fs.readFileSync(filepath), { type: "buffer" });
    const { fiscalYear, records, verification } = importWorkbook(workbook);

    // ยอดไม่ตรงต้นฉบับ = ไม่เขียนอะไรเลยทั้ง batch
    if (!verification.ok) {
      return res.status(422).json({
        message: "ยอดที่อ่านได้ไม่ตรงกับแถว 'รวม' ในไฟล์ — ยังไม่บันทึกข้อมูลใด ๆ",
        fiscalYear,
        verification,
      });
    }

    if (dryRun) {
      return res.status(200).json({ dryRun: true, fiscalYear, verification });
    }

    await dbConnect();
    const result = await WasteDaily.bulkWrite(
      records.map((record) => ({
        updateOne: {
          filter: { recordDate: record.recordDate },
          update: {
            $set: {
              fiscalYear: record.fiscalYear,
              entries: record.entries,
              groupTotals: record.groupTotals,
              totalKg: record.totalKg,
              updatedByClerkId: auth.userId,
              updatedByName: auth.name,
            },
            $setOnInsert: {
              recordDate: record.recordDate,
              createdByClerkId: auth.userId,
              createdByName: auth.name,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );

    return res.status(200).json({
      fiscalYear,
      verification,
      inserted: result.upsertedCount,
      updated: result.modifiedCount,
    });
  } catch (error) {
    console.error("[smart-waste/import]", error);
    return res.status(400).json({ message: error.message || "นำเข้าไฟล์ไม่สำเร็จ" });
  } finally {
    // formidable เขียนไฟล์ลง temp — ลบทิ้งไม่ให้ค้าง
    if (filepath) fs.promises.unlink(filepath).catch(() => {});
  }
}
```

- [ ] **Step 2: ตรวจว่า build ผ่าน**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 3: ทดสอบแบบ dry-run กับไฟล์จริง**

เปิด `npm run dev` และล็อกอินเป็น superadmin ในเบราว์เซอร์ จากนั้นรันใน **console ของเบราว์เซอร์**
(ต้องรันจากเบราว์เซอร์เพื่อให้ cookie ของ Clerk ติดไปด้วย — `curl` จะได้ 401):

```js
const input = Object.assign(document.createElement('input'), { type: 'file' });
input.onchange = async () => {
  const body = new FormData();
  body.append('file', input.files[0]);
  const res = await fetch('/api/smart-waste/import?dryRun=1', { method: 'POST', body });
  console.log(res.status, await res.json());
};
input.click();
```

เลือกไฟล์ `ขยะรีไซเคิลและขยะเปียก - 2568.xlsx`
Expected: `200` · `dryRun: true` · `fiscalYear: 2568` · `verification.ok: true` · `verification.totalKg: 245509`

- [ ] **Step 4: นำเข้าจริงทั้ง 2 ไฟล์**

รันสคริปต์เดิมใน console แต่เอา `?dryRun=1` ออก แล้วอัปโหลดทีละไฟล์
Expected (ไฟล์ 2568): `200` · `verification.totalKg: 245509` · `inserted` มากกว่า 0
Expected (ไฟล์ 2569): `200` · `verification.totalKg: 42196`

- [ ] **Step 5: ตรวจยอดใน MongoDB**

รันใน console ของเบราว์เซอร์ (ใช้ endpoint `summary` ยังไม่มี — เช็คผ่าน mongosh แทน):

```bash
mongosh "$MONGO_URI" --quiet --eval '
  db.smart_waste_daily.aggregate([
    { $group: { _id: "$fiscalYear", days: { $sum: 1 }, totalKg: { $sum: "$totalKg" } } },
    { $sort: { _id: 1 } }
  ]).forEach(printjson)
'
```

Expected:
```
{ _id: 2568, days: 365, totalKg: 245509 }
{ _id: 2569, days: 92,  totalKg: 42196 }
```

(`days` คือจำนวนวันที่**มีการบันทึก** — วันที่ทุกช่องว่างจะไม่ถูกสร้าง จึงอาจน้อยกว่าจำนวนวันจริงของปี ยอด `totalKg` คือตัวที่ต้องตรงเป๊ะ)

- [ ] **Step 6: ทดสอบว่านำเข้าซ้ำได้ (idempotent)**

อัปโหลดไฟล์ 2568 ซ้ำอีกครั้ง แล้วรันคำสั่ง mongosh ข้อ 5 ใหม่
Expected: ยอดเท่าเดิมทุกตัว · `inserted: 0` ใน response

- [ ] **Step 7: Commit**

```bash
git add pages/api/smart-waste/import.js
git commit -m "feat(smart-waste): เพิ่ม API นำเข้าไฟล์ Excel เก่า (superadmin)"
```

---

## Task 11: API บันทึกรายวัน

**Files:**
- Create: `pages/api/smart-waste/daily/index.js`
- Create: `pages/api/smart-waste/daily/[date].js`

- [ ] **Step 1: สร้าง `pages/api/smart-waste/daily/index.js`**

```js
import dbConnect from "@/lib/dbConnect";
import WasteDaily from "@/models/smart-waste/WasteDaily";
import { isValidRecordDate } from "@/lib/smart-waste/fiscalYear";
import { requireWasteAdmin } from "../_auth";

export default async function handler(req, res) {
  const auth = await requireWasteAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { from, to } = req.query;
  if (!isValidRecordDate(from) || !isValidRecordDate(to)) {
    return res.status(400).json({ message: "ต้องระบุ from และ to เป็น YYYY-MM-DD" });
  }
  if (from > to) {
    return res.status(400).json({ message: "from ต้องไม่เกิน to" });
  }

  await dbConnect();
  // recordDate เป็น string YYYY-MM-DD จึงเทียบด้วย $gte/$lte ตรง ๆ ได้
  // (เรียงตามตัวอักษร = เรียงตามเวลา)
  const records = await WasteDaily.find({ recordDate: { $gte: from, $lte: to } })
    .sort({ recordDate: 1 })
    .lean();

  return res.status(200).json({
    records: records.map((record) => ({
      recordDate: record.recordDate,
      fiscalYear: record.fiscalYear,
      entries: record.entries,
      groupTotals: record.groupTotals,
      totalKg: record.totalKg,
      note: record.note || "",
      updatedByName: record.updatedByName || "",
      updatedAt: record.updatedAt,
    })),
  });
}
```

- [ ] **Step 2: สร้าง `pages/api/smart-waste/daily/[date].js`**

```js
import { z } from "zod";
import dbConnect from "@/lib/dbConnect";
import WasteDaily from "@/models/smart-waste/WasteDaily";
import WasteType from "@/models/smart-waste/WasteType";
import {
  computeTotals,
  findHighValueEntries,
  normalizeEntries,
} from "@/lib/smart-waste/aggregate";
import { bangkokToday, fiscalYearOf, isValidRecordDate } from "@/lib/smart-waste/fiscalYear";
import { logAuditEvent } from "@/lib/auditLogger";
import { requireWasteAdmin } from "../_auth";

const BodySchema = z.object({
  entries: z
    .array(
      z.object({
        typeKey: z.string().min(1),
        kg: z.coerce.number().min(0),
      })
    )
    .default([]),
  note: z.string().max(500).default(""),
});

export default async function handler(req, res) {
  const auth = await requireWasteAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  const { date } = req.query;
  if (!isValidRecordDate(date)) {
    return res.status(400).json({ message: `วันที่ไม่ถูกรูปแบบ "${date}"` });
  }

  await dbConnect();

  if (req.method === "GET") {
    const record = await WasteDaily.findOne({ recordDate: date }).lean();
    if (!record) {
      // ยังไม่มีข้อมูลของวันนี้ — ไม่ใช่ error ฝั่ง client ใช้เปิดฟอร์มเปล่า
      return res.status(200).json({ record: null });
    }
    return res.status(200).json({
      record: {
        recordDate: record.recordDate,
        fiscalYear: record.fiscalYear,
        entries: record.entries,
        groupTotals: record.groupTotals,
        totalKg: record.totalKg,
        note: record.note || "",
        updatedByName: record.updatedByName || "",
        updatedAt: record.updatedAt,
      },
    });
  }

  if (req.method === "PUT") {
    if (date > bangkokToday()) {
      return res.status(400).json({ message: "บันทึกวันในอนาคตไม่ได้" });
    }

    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกรูปแบบ", issues: parsed.error.issues });
    }

    // ต้องเป็นประเภทที่เปิดใช้งานอยู่เท่านั้น — ประเภทที่ปิดแล้วยังอ่านย้อนหลังได้
    // แต่กรอกใหม่ไม่ได้
    const activeTypes = await WasteType.find({ active: true }).lean();
    const typeByKey = new Map(activeTypes.map((type) => [type.key, type]));

    let entries;
    try {
      entries = normalizeEntries(parsed.data.entries, typeByKey);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    // ไม่เชื่อยอดที่ client ส่งมา — คำนวณใหม่จาก entries เสมอ
    const { groupTotals, totalKg } = computeTotals(entries);
    const before = await WasteDaily.findOne({ recordDate: date }).lean();

    await WasteDaily.updateOne(
      { recordDate: date },
      {
        $set: {
          fiscalYear: fiscalYearOf(date),
          entries,
          groupTotals,
          totalKg,
          note: parsed.data.note,
          updatedByClerkId: auth.userId,
          updatedByName: auth.name,
        },
        $setOnInsert: {
          recordDate: date,
          createdByClerkId: auth.userId,
          createdByName: auth.name,
        },
      },
      { upsert: true }
    );

    // log เฉพาะการ "แก้ของเดิม" — การบันทึกวันใหม่เป็นงานปกติ ไม่ต้องมี audit trail
    if (before) {
      await logAuditEvent({
        actorClerkId: auth.userId,
        actorName: auth.name,
        action: "data_exported",
        resourceType: "system",
        resourceId: date,
        before: { totalKg: before.totalKg, entries: before.entries },
        after: { totalKg, entries },
        description: `แก้ไขข้อมูลขยะรีไซเคิลวันที่ ${date} (${before.totalKg} → ${totalKg} กก.)`,
        meta: { module: "smart-waste", recordDate: date },
      });
    }

    return res.status(200).json({
      record: { recordDate: date, entries, groupTotals, totalKg },
      created: !before,
      // ตัวเลขสูงผิดปกติ — บันทึกให้แล้ว แต่ส่งกลับให้ UI เตือนผู้กรอกได้
      warnings: findHighValueEntries(entries),
    });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
```

> **หมายเหตุเรื่อง `action`:** `lib/auditLogger.ts` กำหนด `AuditAction` เป็น union type ปิด
> ยังไม่มีค่าที่ตรงกับ "แก้ข้อมูลขยะ" — ใช้ `data_exported` ไปก่อนแล้วแยกด้วย `meta.module`
> การเพิ่มค่าใหม่เข้า union ต้องแตะไฟล์กลางที่โมดูลอื่นใช้ร่วม จึงเก็บไว้ทำตอนที่มี
> โมดูลที่สองต้องการเช่นกัน (ระบุไว้ใน `docs/modules/smart-waste.md` แผนที่ 2)

- [ ] **Step 3: ตรวจว่า build ผ่าน**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 4: ทดสอบด้วยมือ**

ใน console ของเบราว์เซอร์ที่ล็อกอินแล้ว:

```js
// อ่านวันที่มีข้อมูลจากการ import
await (await fetch('/api/smart-waste/daily/2025-10-01')).json();
```
Expected: `record.totalKg === 715` (ยอดวันที่ 1 ต.ค. 2568 จากไฟล์ต้นฉบับ)

```js
// เขียนวันใหม่
await (await fetch('/api/smart-waste/daily/2026-08-10', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ entries: [{ typeKey: 'plastic_pet', kg: 12.5 }], note: 'ทดสอบ' }),
})).json();
```
Expected: `created: true` · `record.totalKg === 12.5` · `record.groupTotals.plastic === 12.5`

```js
// ตัวเลขสูงผิดปกติ — บันทึกได้ แต่ต้องมี warnings กลับมาให้ UI ถามยืนยัน
await (await fetch('/api/smart-waste/daily/2026-08-10', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ entries: [{ typeKey: 'plastic_pet', kg: 5000 }] }),
})).json();
```
Expected: `warnings: [{ typeKey: 'plastic_pet', kg: 5000 }]` และยังบันทึกสำเร็จ

```js
// ปฏิเสธประเภทที่ไม่มีจริง
(await fetch('/api/smart-waste/daily/2026-08-10', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ entries: [{ typeKey: 'copper', kg: 1 }] }),
})).status;
```
Expected: `400`

```js
// ปฏิเสธวันในอนาคต
(await fetch('/api/smart-waste/daily/2099-01-01', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ entries: [] }),
})).status;
```
Expected: `400`

ลบข้อมูลทดสอบทิ้ง:
```bash
mongosh "$MONGO_URI" --quiet --eval 'db.smart_waste_daily.deleteOne({ recordDate: "2026-08-10" })'
```

- [ ] **Step 5: Commit**

```bash
git add pages/api/smart-waste/daily/
git commit -m "feat(smart-waste): เพิ่ม API บันทึก/แก้ไขข้อมูลรายวัน"
```

---

## Task 12: API สรุปรายปีงบ

**Files:**
- Create: `pages/api/smart-waste/summary.js`

- [ ] **Step 1: สร้าง `pages/api/smart-waste/summary.js`**

```js
import dbConnect from "@/lib/dbConnect";
import WasteDaily from "@/models/smart-waste/WasteDaily";
import WasteType from "@/models/smart-waste/WasteType";
import { emptyGroupTotals, round2 } from "@/lib/smart-waste/aggregate";
import { fiscalMonths, fiscalYearRange } from "@/lib/smart-waste/fiscalYear";
import { requireWasteAdmin } from "./_auth";

// ปีงบหนึ่งมีอย่างมาก 366 เอกสาร × ~10 entries — ดึงมารวมใน JS ตรง ๆ เร็วกว่าและ
// อ่านง่ายกว่า aggregation pipeline ที่ต้อง $unwind + $group สองชั้น
// และได้ใช้ round2 ตัวเดียวกับที่อื่น ไม่ต้องเขียนสูตรซ้ำใน pipeline
export default async function handler(req, res) {
  const auth = await requireWasteAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const fiscalYear = Number(req.query.fiscalYear);
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2500 || fiscalYear > 2600) {
    return res.status(400).json({ message: "ต้องระบุ fiscalYear เป็นปี พ.ศ." });
  }

  await dbConnect();
  const { start, end } = fiscalYearRange(fiscalYear);
  const [records, types] = await Promise.all([
    WasteDaily.find({ recordDate: { $gte: start, $lte: end } })
      .sort({ recordDate: 1 })
      .lean(),
    WasteType.find().sort({ order: 1 }).lean(),
  ]);

  const months = fiscalMonths(fiscalYear).map((month) => ({
    ...month,
    totalKg: 0,
    recordedDays: 0,
    groupTotals: emptyGroupTotals(),
    typeTotals: {},
  }));
  const monthByKey = new Map(months.map((month) => [month.key, month]));

  const yearGroupTotals = emptyGroupTotals();
  const yearTypeTotals = {};
  let yearTotalKg = 0;

  for (const record of records) {
    const month = monthByKey.get(record.recordDate.slice(0, 7));
    if (!month) continue; // กันข้อมูลหลุดช่วง (ไม่ควรเกิด แต่ไม่ทำให้พังทั้งหน้า)
    month.recordedDays += 1;
    for (const entry of record.entries) {
      month.groupTotals[entry.group] = round2(month.groupTotals[entry.group] + entry.kg);
      month.typeTotals[entry.typeKey] = round2((month.typeTotals[entry.typeKey] || 0) + entry.kg);
      yearGroupTotals[entry.group] = round2(yearGroupTotals[entry.group] + entry.kg);
      yearTypeTotals[entry.typeKey] = round2((yearTypeTotals[entry.typeKey] || 0) + entry.kg);
      month.totalKg = round2(month.totalKg + entry.kg);
      yearTotalKg = round2(yearTotalKg + entry.kg);
    }
  }

  const totalDays = months.reduce((sum, month) => sum + month.daysInMonth, 0);
  const recordedDays = months.reduce((sum, month) => sum + month.recordedDays, 0);

  return res.status(200).json({
    fiscalYear,
    range: { start, end },
    months: months.map((month) => ({
      ...month,
      avgKgPerDay: month.daysInMonth ? round2(month.totalKg / month.daysInMonth) : 0,
    })),
    groupTotals: yearGroupTotals,
    typeTotals: yearTypeTotals,
    totalKg: yearTotalKg,
    totalDays,
    recordedDays,
    // เฉลี่ยต่อ "วันที่มีการบันทึก" — ปีที่กรอกยังไม่ครบจะได้ไม่ถูกหารด้วย 365 จนดูต่ำผิดจริง
    avgKgPerRecordedDay: recordedDays ? round2(yearTotalKg / recordedDays) : 0,
    highlightedTypes: types
      .filter((type) => type.isHighlighted)
      .map((type) => ({
        key: type.key,
        label: type.label,
        totalKg: yearTypeTotals[type.key] || 0,
      })),
  });
}
```

- [ ] **Step 2: ตรวจว่า build ผ่าน**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 3: ทดสอบด้วยมือกับข้อมูลจริงที่ import ไว้**

ใน console ของเบราว์เซอร์:

```js
const summary = await (await fetch('/api/smart-waste/summary?fiscalYear=2568')).json();
console.log(summary.totalKg, summary.groupTotals);
```
Expected: `totalKg === 245509` และ `groupTotals` ตรงกับชีต `รวม` ของไฟล์ 2568:
`{ paper: 13318, plastic: 107509, aluminum: 599, steel: 1657, mixedMetal: 7702, glass: 48804, foodWaste: 65831, kapok: 89 }`

```js
const y69 = await (await fetch('/api/smart-waste/summary?fiscalYear=2569')).json();
console.log(y69.totalKg, y69.months[0].totalKg, y69.highlightedTypes);
```
Expected: `totalKg === 42196` · `months[0].totalKg === 18396` (ต.ค.68) · `highlightedTypes` มี 1 รายการคือถุงอ่อน `totalKg: 11998`

- [ ] **Step 4: Commit**

```bash
git add pages/api/smart-waste/summary.js
git commit -m "feat(smart-waste): เพิ่ม API สรุปข้อมูลรายปีงบประมาณ"
```

---

## Task 13: สร้างไฟล์ Excel สำหรับส่งออก

**Files:**
- Create: `lib/smart-waste/exportWorkbook.js`
- Test: `lib/smart-waste/__tests__/exportWorkbook.test.js`

- [ ] **Step 1: เขียนเทสต์ที่ต้องพัง**

สร้าง `lib/smart-waste/__tests__/exportWorkbook.test.js`:

```js
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { buildExportWorkbook } from '../exportWorkbook';
import { WASTE_TYPES_SEED } from '../wasteTypesSeed';

const TYPES = WASTE_TYPES_SEED.map((type) => ({
  key: type.key,
  label: type.label,
  group: type.group,
  order: type.order,
  isHighlighted: Boolean(type.isHighlighted),
}));

function sheetRows(workbook, sheetName) {
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    blankrows: false,
    defval: '',
  });
}

const RECORDS = [
  {
    recordDate: '2025-10-01',
    entries: [
      { typeKey: 'plastic_pet', group: 'plastic', kg: 45 },
      { typeKey: 'food_waste_compost', group: 'foodWaste', kg: 237 },
      { typeKey: 'plastic_soft_bag', group: 'plastic', kg: 223 },
    ],
    totalKg: 505,
  },
  {
    recordDate: '2025-10-02',
    entries: [{ typeKey: 'plastic_pet', group: 'plastic', kg: 93 }],
    totalKg: 93,
  },
];

describe('buildExportWorkbook', () => {
  const workbook = buildExportWorkbook({ fiscalYear: 2569, types: TYPES, records: RECORDS });

  it('มี 14 ชีต เรียง รวม → รวมละเอียด → 12 เดือน เหมือนไฟล์ต้นฉบับ', () => {
    expect(workbook.SheetNames).toHaveLength(14);
    expect(workbook.SheetNames[0]).toBe('รวม');
    expect(workbook.SheetNames[1]).toBe('รวมละเอียด');
    expect(workbook.SheetNames[2]).toBe('ต.ค.68');
    expect(workbook.SheetNames[13]).toBe('ก.ย.69');
  });

  it('ชีตรายเดือนมีแถวครบทุกวัน + แถวรวม + แถวเฉลี่ย', () => {
    const rows = sheetRows(workbook, 'ต.ค.68');
    expect(rows[0][0]).toBe('วันที่');
    expect(rows[0][1]).toBe('กระดาษรวม'); // คอลัมน์เรียงตาม order
    expect(rows[1][0]).toBe(1);
    expect(rows[31][0]).toBe(31); // ต.ค. มี 31 วัน
    expect(rows[32][0]).toBe('รวม');
    expect(rows[33][0]).toBe(''); // แถวเฉลี่ยต่อวัน ไม่มีป้ายชื่อ เหมือนไฟล์เดิม
  });

  it('ช่องที่ไม่มีข้อมูลเว้นว่าง ไม่ใส่ 0 (ให้หน้าตาตรงไฟล์เดิม)', () => {
    const rows = sheetRows(workbook, 'ต.ค.68');
    const petColumn = TYPES.findIndex((t) => t.key === 'plastic_pet') + 1;
    expect(rows[1][petColumn]).toBe(45); // วันที่ 1 มีข้อมูล
    expect(rows[3][petColumn]).toBe(''); // วันที่ 3 ไม่มี
  });

  it('แถวรวมของเดือนตรงกับผลบวกรายวัน', () => {
    const rows = sheetRows(workbook, 'ต.ค.68');
    const petColumn = TYPES.findIndex((t) => t.key === 'plastic_pet') + 1;
    const totalColumn = TYPES.length + 1;
    expect(rows[32][petColumn]).toBe(138);
    expect(rows[32][totalColumn]).toBe(598);
  });

  it('ชีต "รวม" มี 8 กลุ่มเรียงตามลำดับเดิม + คอลัมน์ SUM/Avg.', () => {
    const rows = sheetRows(workbook, 'รวม');
    expect(rows[0][0]).toBe('');
    expect(rows[0][1]).toBe('ต.ค. 68');
    expect(rows[0][13]).toBe('SUM');
    expect(rows[0][14]).toBe('Avg.');
    expect(rows.slice(1, 9).map((row) => row[0])).toEqual([
      'กระดาษ', 'พลาสติก', 'อะลูมิเนียม', 'เหล็ก',
      'โลหะผสม', 'แก้ว', 'เศษอาหาร', 'นุ่น',
    ]);
    expect(rows[2][1]).toBe(361); // พลาสติก ต.ค. = 45 + 223 + 93
    expect(rows[2][13]).toBe(361); // SUM ทั้งปี
  });

  it('มีแถว รวม / เฉลี่ยต่อวัน / เฉพาะ<label> / Recheck ต่อท้าย', () => {
    const rows = sheetRows(workbook, 'รวม');
    const labels = rows.map((row) => row[0]);
    expect(labels).toContain('รวม');
    expect(labels).toContain('เฉลี่ยต่อวัน');
    expect(labels).toContain('เฉพาะถุงอ่อน'); // มาจากธง isHighlighted
    expect(labels).toContain('Recheck');
  });

  it('แถว "เฉพาะ" ขึ้นตามธง isHighlighted ไม่ hardcode ถุงอ่อน', () => {
    const custom = buildExportWorkbook({
      fiscalYear: 2569,
      types: TYPES.map((type) => ({
        ...type,
        isHighlighted: type.key === 'plastic_pet',
      })),
      records: RECORDS,
    });
    const labels = sheetRows(custom, 'รวม').map((row) => row[0]);
    expect(labels).toContain('เฉพาะขวดพลาสติก PET');
    expect(labels).not.toContain('เฉพาะถุงอ่อน');
  });

  it('ชีต "รวมละเอียด" มี 24 ประเภท + แถวรวม', () => {
    const rows = sheetRows(workbook, 'รวมละเอียด');
    expect(rows[0][0]).toBe('ประเภทขยะ');
    expect(rows).toHaveLength(26); // header + 24 ประเภท + รวม
    expect(rows[1][0]).toBe('กระดาษรวม');
    expect(rows[25][0]).toBe('รวม');
  });

  it('ปีงบที่ไม่มีข้อมูลเลยยังได้ไฟล์โครงครบ 14 ชีต ไม่ throw', () => {
    const empty = buildExportWorkbook({ fiscalYear: 2570, types: TYPES, records: [] });
    expect(empty.SheetNames).toHaveLength(14);
    const rows = sheetRows(empty, 'รวม');
    expect(rows[1][13]).toBe(0); // SUM ของกระดาษ = 0
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run lib/smart-waste/__tests__/exportWorkbook.test.js`
Expected: FAIL — `Failed to resolve import "../exportWorkbook"`

- [ ] **Step 3: เขียน implementation**

สร้าง `lib/smart-waste/exportWorkbook.js`:

```js
// สร้าง workbook หน้าตาเหมือนไฟล์ Excel เดิม เพื่อให้ส่งรายงานต่อได้ทันที
//
// ค่าที่เขียนลงชีตเป็น "ตัวเลขนิ่ง" ไม่ใช่สูตร — แหล่งความจริงคือฐานข้อมูล ไม่ใช่ชีต
// และสูตรในไฟล์เดิมคือสาเหตุที่ยอดพังเวลาแทรก/ลบแถว
//
// ความต่างจากไฟล์เดิมที่ตั้งใจ:
// 1. layout ของชีต "รวม" ใช้แบบไฟล์ 2569 (SUM/Avg. ท้ายตาราง) กับทุกปีงบ
//    ไฟล์ 2568 วางคอลัมน์รวมไว้หน้า 12 เดือน — ถ้าทำตามทั้งสองแบบจะเทียบปีต่อปีไม่ได้
// 2. Avg. = SUM ÷ จำนวนวันของปีงบ (กก./วัน) นิยามเดียวทุกแถว
//    ไฟล์เดิมใช้สูตรไม่สม่ำเสมอ (บางแถวหารพัน บางแถวไม่หาร) ซึ่งเทียบกันไม่ได้

import * as XLSX from 'xlsx';
import { round2 } from './aggregate';
import { fiscalMonths } from './fiscalYear';
import { WASTE_GROUPS } from './wasteGroups';

// types: [{ key, label, group, order, isHighlighted }]
// records: [{ recordDate, entries: [{ typeKey, group, kg }], totalKg }]
export function buildExportWorkbook({ fiscalYear, types, records }) {
  const months = fiscalMonths(fiscalYear);
  const sortedTypes = [...types].sort((a, b) => a.order - b.order);

  const recordsByMonth = new Map(months.map((month) => [month.key, []]));
  for (const record of records) {
    const bucket = recordsByMonth.get(record.recordDate.slice(0, 7));
    if (bucket) bucket.push(record);
  }

  // ยอดรายเดือน แยกตามประเภทและตามกลุ่ม — ใช้ทั้งชีต "รวม" และ "รวมละเอียด"
  const typeTotalsByMonth = new Map();
  const groupTotalsByMonth = new Map();
  const monthTotals = new Map();

  for (const month of months) {
    const typeTotals = new Map();
    const groupTotals = new Map();
    let monthTotal = 0;
    for (const record of recordsByMonth.get(month.key)) {
      for (const entry of record.entries) {
        typeTotals.set(entry.typeKey, round2((typeTotals.get(entry.typeKey) || 0) + entry.kg));
        groupTotals.set(entry.group, round2((groupTotals.get(entry.group) || 0) + entry.kg));
        monthTotal = round2(monthTotal + entry.kg);
      }
    }
    typeTotalsByMonth.set(month.key, typeTotals);
    groupTotalsByMonth.set(month.key, groupTotals);
    monthTotals.set(month.key, monthTotal);
  }

  const totalDays = months.reduce((sum, month) => sum + month.daysInMonth, 0);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    buildSummarySheet({ months, sortedTypes, groupTotalsByMonth, typeTotalsByMonth, monthTotals, totalDays }),
    'รวม'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildDetailSheet({ months, sortedTypes, typeTotalsByMonth, monthTotals }),
    'รวมละเอียด'
  );
  for (const month of months) {
    XLSX.utils.book_append_sheet(
      workbook,
      buildMonthSheet({
        month,
        sortedTypes,
        monthRecords: recordsByMonth.get(month.key),
        typeTotals: typeTotalsByMonth.get(month.key),
        monthTotal: monthTotals.get(month.key),
      }),
      month.sheetName
    );
  }

  return workbook;
}

function buildMonthSheet({ month, sortedTypes, monthRecords, typeTotals, monthTotal }) {
  const recordByDay = new Map(
    monthRecords.map((record) => [Number(record.recordDate.slice(8, 10)), record])
  );

  const aoa = [['วันที่', ...sortedTypes.map((type) => type.label), 'Total']];

  for (let day = 1; day <= month.daysInMonth; day += 1) {
    const record = recordByDay.get(day);
    const kgByType = new Map((record?.entries || []).map((entry) => [entry.typeKey, entry.kg]));
    aoa.push([
      day,
      // เว้นว่างเมื่อไม่มีข้อมูล ไม่ใส่ 0 — ให้หน้าตาตรงกับไฟล์เดิม
      ...sortedTypes.map((type) => (kgByType.has(type.key) ? kgByType.get(type.key) : '')),
      record ? record.totalKg : '',
    ]);
  }

  aoa.push([
    'รวม',
    ...sortedTypes.map((type) => typeTotals.get(type.key) || 0),
    monthTotal,
  ]);
  // แถวสุดท้ายของไฟล์เดิม: เฉลี่ยต่อวัน วางในคอลัมน์ Total โดยไม่มีป้ายชื่อแถว
  aoa.push([
    '',
    ...sortedTypes.map(() => ''),
    month.daysInMonth ? round2(monthTotal / month.daysInMonth) : 0,
  ]);

  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildDetailSheet({ months, sortedTypes, typeTotalsByMonth, monthTotals }) {
  const aoa = [['ประเภทขยะ', ...months.map((month) => month.label)]];
  for (const type of sortedTypes) {
    aoa.push([
      type.label,
      ...months.map((month) => typeTotalsByMonth.get(month.key).get(type.key) || 0),
    ]);
  }
  aoa.push(['รวม', ...months.map((month) => monthTotals.get(month.key))]);
  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildSummarySheet({
  months,
  sortedTypes,
  groupTotalsByMonth,
  typeTotalsByMonth,
  monthTotals,
  totalDays,
}) {
  const aoa = [['', ...months.map((month) => month.label), 'SUM', 'Avg.']];

  const withTotals = (label, valuesPerMonth) => {
    const sum = round2(valuesPerMonth.reduce((acc, value) => acc + value, 0));
    return [label, ...valuesPerMonth, sum, totalDays ? round2(sum / totalDays) : 0];
  };

  for (const group of WASTE_GROUPS) {
    aoa.push(
      withTotals(
        group.label,
        months.map((month) => groupTotalsByMonth.get(month.key).get(group.key) || 0)
      )
    );
  }

  const monthValues = months.map((month) => monthTotals.get(month.key));
  aoa.push(withTotals('รวม', monthValues));

  // เฉลี่ยต่อวันของแต่ละเดือน — ไม่ใช่ยอดสะสม จึงไม่ใช้ withTotals
  const dailyAverages = months.map((month) =>
    month.daysInMonth ? round2(monthTotals.get(month.key) / month.daysInMonth) : 0
  );
  aoa.push([
    'เฉลี่ยต่อวัน',
    ...dailyAverages,
    round2(dailyAverages.reduce((acc, value) => acc + value, 0)),
    '',
  ]);

  // แถว "เฉพาะ<ชื่อประเภท>" ต่อประเภทที่ติดธง isHighlighted
  // (ไฟล์เดิมมีแถว "เฉพาะถุงอ่อน" เพราะเจ้าหน้าที่สนใจตัวนี้เป็นพิเศษ —
  //  ทำเป็นธงเพื่อให้ติดประเภทอื่นเพิ่มได้โดยไม่ต้องแก้โค้ด)
  for (const type of sortedTypes.filter((item) => item.isHighlighted)) {
    aoa.push(
      withTotals(
        `เฉพาะ${type.label}`,
        months.map((month) => typeTotalsByMonth.get(month.key).get(type.key) || 0)
      )
    );
  }

  // Recheck = ยอดรวมซ้ำอีกรอบ ใช้ตาเทียบกับแถว "รวม" เหมือนไฟล์เดิม
  aoa.push(['Recheck', ...monthValues, '', '']);

  return XLSX.utils.aoa_to_sheet(aoa);
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run lib/smart-waste/__tests__/exportWorkbook.test.js`
Expected: PASS — 9 tests passed

- [ ] **Step 5: รันเทสต์ทั้งหมด**

Run: `SMART_WASTE_FIXTURE_DIR="$HOME/Downloads" npm test`
Expected: PASS — 7 test files ผ่านทั้งหมด, 0 failed, 0 skipped

- [ ] **Step 6: Commit**

```bash
git add lib/smart-waste/exportWorkbook.js lib/smart-waste/__tests__/exportWorkbook.test.js
git commit -m "feat(smart-waste): สร้างไฟล์ Excel ส่งออกรูปแบบเดิม"
```

---

## Task 14: API ดาวน์โหลดไฟล์ Excel

**Files:**
- Create: `pages/api/smart-waste/export.js`

- [ ] **Step 1: สร้าง `pages/api/smart-waste/export.js`**

```js
import * as XLSX from "xlsx";
import dbConnect from "@/lib/dbConnect";
import WasteDaily from "@/models/smart-waste/WasteDaily";
import WasteType from "@/models/smart-waste/WasteType";
import { buildExportWorkbook } from "@/lib/smart-waste/exportWorkbook";
import { fiscalYearRange } from "@/lib/smart-waste/fiscalYear";
import { requireWasteAdmin } from "./_auth";

export default async function handler(req, res) {
  const auth = await requireWasteAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const fiscalYear = Number(req.query.fiscalYear);
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2500 || fiscalYear > 2600) {
    return res.status(400).json({ message: "ต้องระบุ fiscalYear เป็นปี พ.ศ." });
  }

  await dbConnect();
  const { start, end } = fiscalYearRange(fiscalYear);
  const [records, types] = await Promise.all([
    WasteDaily.find({ recordDate: { $gte: start, $lte: end } })
      .sort({ recordDate: 1 })
      .lean(),
    // เอาทุกประเภทรวมที่ปิดใช้งานแล้ว — ปีเก่าอาจมีข้อมูลของประเภทที่เลิกใช้ไปแล้ว
    WasteType.find().sort({ order: 1 }).lean(),
  ]);

  const workbook = buildExportWorkbook({ fiscalYear, types, records });
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const filename = `ขยะรีไซเคิลและขยะเปียก-${fiscalYear}.xlsx`;
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  // ชื่อไฟล์เป็นภาษาไทย → ต้องใช้ filename* (RFC 5987) ไม่งั้นเบราว์เซอร์ได้ชื่อเพี้ยน
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="smart-waste-${fiscalYear}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
  return res.status(200).send(buffer);
}
```

- [ ] **Step 2: ตรวจว่า build ผ่าน**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 3: ทดสอบด้วยมือ — ดาวน์โหลดและเทียบกับต้นฉบับ**

เปิดในเบราว์เซอร์ที่ล็อกอินแล้ว: `http://localhost:3000/api/smart-waste/export?fiscalYear=2568`
Expected: ดาวน์โหลดไฟล์ `ขยะรีไซเคิลและขยะเปียก-2568.xlsx`

เปิดไฟล์ที่ได้แล้วตรวจ:
- มี 14 ชีต เรียง `รวม` → `รวมละเอียด` → `ต.ค.67` … `ก.ย.68`
- ชีต `รวม` คอลัมน์ `SUM` ของแถว `รวม` = **245,509**
- ชีต `รวม` มีแถว `เฉพาะถุงอ่อน` ที่ SUM = **69,150** (ตรงกับไฟล์ต้นฉบับ)
- ชีต `ต.ค.67` แถว `รวม` คอลัมน์ `Total` = **27,152**

- [ ] **Step 4: ตรวจปีที่ยังไม่มีข้อมูล**

เปิด `http://localhost:3000/api/smart-waste/export?fiscalYear=2570`
Expected: ดาวน์โหลดได้ปกติ ได้ไฟล์โครงเปล่าครบ 14 ชีต ไม่มี error

- [ ] **Step 5: Commit**

```bash
git add pages/api/smart-waste/export.js
git commit -m "feat(smart-waste): เพิ่ม API ดาวน์โหลดไฟล์ Excel รายปีงบ"
```

---

## เสร็จแผนที่ 1 — เกณฑ์ตรวจรับ

- [ ] `SMART_WASTE_FIXTURE_DIR="$HOME/Downloads" npm test` ผ่านทั้งหมด (7 ไฟล์)
- [ ] `npm run build` ผ่าน
- [ ] `GET /api/smart-waste/summary?fiscalYear=2568` → `totalKg === 245509`
- [ ] `GET /api/smart-waste/summary?fiscalYear=2569` → `totalKg === 42196`
- [ ] `GET /api/smart-waste/types` → 24 รายการ และเรียกซ้ำไม่เพิ่มเป็น 48
- [ ] ไฟล์ที่ได้จาก `GET /api/smart-waste/export?fiscalYear=2568` เปิดใน Excel/Sheets ได้ และยอดตรงกับต้นฉบับ

จากนั้นเขียนแผนที่ 2 (frontend) โดยอิงรูปร่าง response จริงของ `summary` / `daily` / `types`
