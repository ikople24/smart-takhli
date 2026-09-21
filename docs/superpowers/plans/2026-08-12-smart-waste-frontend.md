# Smart Waste — Frontend (แผนที่ 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หน้า `/admin/smart-waste` เดียว 3 แท็บ (บันทึก · ข้อมูล · สรุป) + modal จัดการประเภทขยะ/นำเข้าไฟล์เก่า พร้อมลงทะเบียนสิทธิ์ครบ 4 จุดให้เมนูขึ้น sidebar

**Architecture:** Backend เสร็จแล้วทั้งหมดใน branch นี้ (แผนที่ 1 — API ใต้ `pages/api/smart-waste/`, lib pure + vitest, models) · แผนนี้เพิ่มเฉพาะฝั่ง client: หนึ่งหน้า + components ใน `components/smart-waste/` โดยยืม design token จาก smart-school (**ไม่ fork ค่าสี** ม่วง `#7C3AED`) · logic ล้วนใหม่มีไฟล์เดียว (`lib/smart-waste/uiDate.js`) ทำแบบ TDD ด้วย vitest — React components ไม่มี test runner ในโปรเจกต์ ใช้ `npm run build` + ทดสอบมือแทน (ตาม convention repo: เทสต์ครอบเฉพาะ logic ล้วนใน `lib/**`)

**Tech Stack:** Next.js 15 Pages Router · React 19 · Tailwind v4 + token จาก `components/smart-school/` · recharts ^3.0.2 · sweetalert2 ^11.21.2 (มีใน dependencies แล้วทั้งคู่)

**สเปกอ้างอิง:** `docs/superpowers/specs/2026-08-11-smart-waste-design.md` ข้อ 7 (UI), 10 (สิทธิ์), 11 (error handling)

---

## รูปร่าง response ของ API ที่ทำเสร็จแล้ว (อ่านจากโค้ดจริง — ห้ามเดาใหม่)

ทุก endpoint ตอบ error เป็น `{ message: string }` พร้อม status 400/401/403/404/405/409/422/500

| Endpoint | Response (200 เว้นแต่ระบุ) |
|---|---|
| `GET /api/smart-waste/types[?includeInactive=1]` | `{ types: [{ id, key, label, group, order, isCommon, isHighlighted, active, usedDays }] }` เรียงตาม `order` แล้ว · เรียกครั้งแรก auto-seed 24 ประเภท |
| `POST /api/smart-waste/types` body `{ label, group, key?, isCommon?, isHighlighted? }` | 201 `{ id, key }` · 409 ถ้า key ซ้ำ · key ต้อง `/^[a-z][a-z0-9_]*$/` |
| `PATCH /api/smart-waste/types/[id]` body `{ label?, isCommon?, isHighlighted?, active?, order? }` | `{ ok: true }` (key/group แก้ไม่ได้) |
| `DELETE /api/smart-waste/types/[id]` | `{ ok: true }` · 409 `{ message, usedDays }` ถ้ามีข้อมูลอ้างถึง |
| `GET /api/smart-waste/daily?from=&to=` (≤400 วัน) | `{ records: [{ recordDate, fiscalYear, entries: [{typeKey, group, kg}], groupTotals, totalKg, note, updatedByName, updatedAt }] }` เรียงตามวัน |
| `GET /api/smart-waste/daily/[date]` | `{ record: null }` ถ้ายังไม่มี · ไม่ใช่ 404 |
| `PUT /api/smart-waste/daily/[date]` body `{ entries: [{typeKey, kg}], note }` | `{ record, created, warnings: [{typeKey, kg}] }` · ถ้า entries กรองแล้วว่าง = ลบวันนั้น → `{ record: null, deleted, warnings: [] }` · 400 ถ้าวันอนาคต |
| `GET /api/smart-waste/summary?fiscalYear=` | `{ fiscalYear, range, months: [{ key, sheetName, label, year, month, daysInMonth, totalKg, recordedDays, groupTotals, typeTotals, avgKgPerDay }], groupTotals, typeTotals, totalKg, totalDays, recordedDays, avgKgPerRecordedDay, highlightedTypes: [{key, label, totalKg}] }` |
| `GET /api/smart-waste/export?fiscalYear=` | ไฟล์ `.xlsx` (Content-Disposition attachment) — ใช้ `<a href>` ตรง ๆ ได้ |
| `POST /api/smart-waste/import[?dryRun=1]` multipart field `file` (**superadmin เท่านั้น**) | dryRun: `{ dryRun, fiscalYear, verification, existingDays, willOverwrite: [{recordDate, from, to}] }` · จริง: `{ fiscalYear, verification, inserted, updated, overwritten }` · 422 ยอดไม่ตรงต้นฉบับ · 409 มี typeKey ที่ไม่รู้จัก |

ของที่ import ได้จาก lib ฝั่ง client (ESM ใช้ใน component ได้ตรง ๆ):
- `@/lib/smart-waste/wasteGroups` → `WASTE_GROUPS` (8 กลุ่ม `{key, label}` เรียงตามรายงาน), `wasteGroupLabel(key)`
- `@/lib/smart-waste/aggregate` → `round2`, `HIGH_KG_WARNING_THRESHOLD` (= 1000)
- `@/lib/smart-waste/fiscalYear` → `fiscalMonths(fy)`, `fiscalYearOf(date)`, `bangkokToday()`, `isValidRecordDate`

## สีของกราฟ (ผ่าน `dataviz` validator แล้ว — อย่าเปลี่ยนเองโดยไม่รัน validator ใหม่)

- 8 กลุ่มขยะ ใช้ตามลำดับ `WASTE_GROUPS` คงที่ (ห้ามสลับตามอันดับยอด):
  `paper #2a78d6 · plastic #eb6834 · aluminum #1baf7a · steel #eda100 · mixedMetal #e87ba4 · glass #008300 · foodWaste #4a3aa7 · kapok #e34948`
  ผลตรวจ: PASS ทุกข้อบน surface `#FAF8FF` ยกเว้น **WARN contrast** ที่ `#1baf7a / #eda100 / #e87ba4` → บังคับมี "ตาราง relief" (ตารางยอดรายเดือน 8 กลุ่ม) ในแท็บสรุปเสมอ — Task 7 Step 2 ทำตารางนี้ ห้ามตัดออก
- เส้นเทียบปีงบ 2 เส้น: ปีปัจจุบัน `#7C3AED` · ปีก่อน `#eb6834` (PASS ทุกข้อ; ห้ามใช้เทา `#9CA3AF` — fail chroma floor)
- กติกา mark: เส้นหนา 2px · แท่ง/ชิ้นโดนัทคั่นด้วยเส้นขอบสีพื้น (stroke ขาว) · legend ต้องมีเมื่อ ≥2 series · แกน y เดียวเสมอ (ห้าม dual axis)

---

### Task 1: `lib/smart-waste/uiDate.js` — date helpers ของฝั่ง UI (TDD)

**Files:**
- Modify: `lib/smart-waste/fiscalYear.js:8` (export `THAI_MONTH_ABBR` ที่มีอยู่แล้ว)
- Create: `lib/smart-waste/uiDate.js`
- Test: `lib/smart-waste/__tests__/uiDate.test.js`

- [ ] **Step 1: export `THAI_MONTH_ABBR` จาก fiscalYear.js**

แก้บรรทัด `const THAI_MONTH_ABBR = [` เป็น `export const THAI_MONTH_ABBR = [` (อาเรย์เดิม ไม่แตะเนื้อหา)

- [ ] **Step 2: เขียนเทสต์ให้ fail ก่อน**

```js
// lib/smart-waste/__tests__/uiDate.test.js
import { describe, expect, it } from 'vitest';
import {
  addDays, thaiDateLabel, nextEntryDate, listFiscalYears, draftKey,
  FIRST_FISCAL_YEAR,
} from '../uiDate';

describe('addDays', () => {
  it('ข้ามเดือน/ปีถูกต้อง (คิดแบบ UTC ไม่โดน timezone)', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29'); // leap year
  });
});

describe('thaiDateLabel', () => {
  it('แสดง วัน เดือนย่อไทย ปี พ.ศ.', () => {
    expect(thaiDateLabel('2026-08-11')).toBe('11 ส.ค. 2569');
    expect(thaiDateLabel('2025-10-01')).toBe('1 ต.ค. 2568');
  });
});

describe('nextEntryDate', () => {
  it('บันทึกวันย้อนหลัง → เลื่อนไปวันถัดไป', () => {
    expect(nextEntryDate('2026-08-01', '2026-08-11')).toBe('2026-08-02');
  });
  it('บันทึกวันนี้ → ค้างที่วันนี้ (ห้ามเลื่อนเป็นวันอนาคต)', () => {
    expect(nextEntryDate('2026-08-11', '2026-08-11')).toBe('2026-08-11');
  });
  it('เมื่อวาน → วันนี้', () => {
    expect(nextEntryDate('2026-08-10', '2026-08-11')).toBe('2026-08-11');
  });
});

describe('listFiscalYears', () => {
  it('ไล่จากปีงบปัจจุบันลงไปถึงปีแรกที่มีข้อมูล (2568)', () => {
    expect(listFiscalYears('2026-08-12')).toEqual([2569, 2568]);
    expect(listFiscalYears('2026-10-01')).toEqual([2570, 2569, 2568]); // ต.ค. = ขึ้นปีงบใหม่
  });
  it('FIRST_FISCAL_YEAR คือ 2568', () => {
    expect(FIRST_FISCAL_YEAR).toBe(2568);
  });
});

describe('draftKey', () => {
  it('ตรงรูปแบบ key ใน localStorage ตามสเปกข้อ 7.2', () => {
    expect(draftKey('2026-08-11')).toBe('smart-waste-draft-2026-08-11');
  });
});
```

- [ ] **Step 3: รันให้เห็นว่า fail**

Run: `npx vitest run lib/smart-waste/__tests__/uiDate.test.js`
Expected: FAIL — `Cannot find module '../uiDate'`

- [ ] **Step 4: implement**

```js
// lib/smart-waste/uiDate.js
// date helpers เฉพาะฝั่ง UI ของ smart-waste — logic ปีงบ/วันที่หลักอยู่ fiscalYear.js
// ที่นี่มีเฉพาะของที่ API ไม่ใช้ (label ไทยของฟอร์ม, การเลื่อนวันหลังบันทึก, key ของ draft)

import { fiscalYearOf, THAI_MONTH_ABBR } from './fiscalYear';

// ปีงบแรกที่มีข้อมูลจริง (ไฟล์ Excel เก่าเริ่มปีงบ 2568)
export const FIRST_FISCAL_YEAR = 2568;

// บวก/ลบวันบน string 'YYYY-MM-DD' — คิดแบบ UTC ล้วนเพื่อไม่ให้ timezone ของ
// เครื่องผู้ใช้เลื่อนวัน (ปัญหาเดียวกับที่ทำให้ recordDate เป็น string ทั้งระบบ)
export function addDays(recordDate, days) {
  const [year, month, day] = recordDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function thaiDateLabel(recordDate) {
  const [year, month, day] = recordDate.split('-').map(Number);
  return `${day} ${THAI_MONTH_ABBR[month - 1]} ${year + 543}`;
}

// วันที่ฟอร์มควรไปต่อหลังบันทึกสำเร็จ — เลื่อนไปวันถัดไปตอนกรอกย้อนหลัง
// แต่ไม่เกินวันนี้ (server ปฏิเสธวันอนาคตอยู่แล้ว อย่าพาผู้ใช้ไปเจอ error นั้น)
export function nextEntryDate(savedDate, today) {
  return savedDate < today ? addDays(savedDate, 1) : today;
}

// ปีงบสำหรับ YearPills — ใหม่ → เก่า ถึงปีแรกที่มีข้อมูล
export function listFiscalYears(today) {
  const current = fiscalYearOf(today);
  const years = [];
  for (let year = current; year >= FIRST_FISCAL_YEAR; year -= 1) years.push(year);
  return years;
}

export function draftKey(recordDate) {
  return `smart-waste-draft-${recordDate}`;
}
```

- [ ] **Step 5: รันเทสต์ทั้งโมดูลให้ผ่าน**

Run: `npx vitest run lib/smart-waste`
Expected: PASS ทุกไฟล์ (รวมเทสต์เดิมของ fiscalYear — ยืนยันว่าการเติม export ไม่พังอะไร)

- [ ] **Step 6: Commit**

```bash
git add lib/smart-waste/fiscalYear.js lib/smart-waste/uiDate.js lib/smart-waste/__tests__/uiDate.test.js
git commit -m "feat(smart-waste): เพิ่ม date helpers ฝั่ง UI (label ไทย, เลื่อนวันหลังบันทึก, draft key)"
```

---

### Task 2: ธีมโมดูล `components/smart-waste/wasteTheme.jsx`

**Files:**
- Modify: `components/smart-school/adminTheme.jsx:82-94` (เพิ่ม prop `icon` ให้ `DashboardHeader`)
- Create: `components/smart-waste/wasteTheme.jsx`

- [ ] **Step 1: เพิ่ม prop `icon` ให้ DashboardHeader (backward-compatible)**

ใน `components/smart-school/adminTheme.jsx` แก้ฟังก์ชัน `DashboardHeader`:

```jsx
// หัว dashboard — right = node (เช่น <YearPills/>) · icon override ได้ (โมดูลอื่นยืมใช้)
export function DashboardHeader({ title, subtitle, right, icon = '📚' }) {
  return (
    <div className="flex items-center gap-3.5 mb-5">
      <span className="w-11 h-11 rounded-[14px] bg-[#7C3AED] text-white grid place-items-center text-[22px]"
        style={{ fontFamily: FONT_DISPLAY }}>{icon}</span>
      <div>
        <div className="text-[19px] font-bold" style={{ fontFamily: FONT_DISPLAY }}>{title}</div>
        {subtitle && <div className="text-[12px] text-[#8A8398]">{subtitle}</div>}
      </div>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}
```

(เปลี่ยนเฉพาะ signature + `{icon}` แทน `📚` — caller เดิมใน smart-school ไม่ส่ง icon จึงได้ 📚 เหมือนเดิม)

- [ ] **Step 2: สร้าง wasteTheme.jsx**

```jsx
// components/smart-waste/wasteTheme.jsx
// จุด import เดียวของธีม smart-waste — token ทั้งหมดยืมจาก smart-school ตามสเปกข้อ 7
// (ไม่ fork ค่าสี ม่วง #7C3AED) · ถ้ามีโมดูลที่ 3 มายืมอีก ให้สกัดเป็น components/ui/adminTheme
// (บันทึกไว้ใน docs/modules/smart-waste.md แล้ว — รอบนี้ YAGNI)

export {
  FONT_DISPLAY, FONT_BODY, inputCls, labelCls, chipCls,
  primaryBtnCls, ghostBtnCls, successBtnCls,
} from '@/components/smart-school/survey/surveyTheme';

export {
  cardCls, tableHeadCls, StatCard, PillTabs, YearPills, DashboardHeader,
} from '@/components/smart-school/adminTheme';

// สีประจำ 8 กลุ่มขยะ — ตามลำดับ WASTE_GROUPS คงที่ ผ่าน dataviz validator บน #FAF8FF แล้ว
// (สี aqua/yellow/magenta contrast < 3:1 → แท็บสรุปต้องมีตารางยอดรายเดือนเป็น relief เสมอ)
// ห้ามเปลี่ยนสี/สลับลำดับโดยไม่รัน validator ใหม่
export const WASTE_GROUP_COLORS = {
  paper: '#2a78d6',
  plastic: '#eb6834',
  aluminum: '#1baf7a',
  steel: '#eda100',
  mixedMetal: '#e87ba4',
  glass: '#008300',
  foodWaste: '#4a3aa7',
  kapok: '#e34948',
};

// เส้นเทียบปีงบต่อปีงบ — ห้ามใช้เทา (fail chroma floor ของ validator)
export const YEAR_LINE_COLORS = { current: '#7C3AED', previous: '#eb6834' };

// ตัวเลขน้ำหนักทั้งโมดูล — คั่นหลักพัน ทศนิยมไม่เกิน 2
export function formatKg(value) {
  return Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
}
```

- [ ] **Step 3: ตรวจ build**

Run: `npm run build`
Expected: ผ่าน (ยังไม่มีใคร import wasteTheme — เช็คว่า adminTheme ที่แก้ไม่พัง smart-school)

- [ ] **Step 4: Commit**

```bash
git add components/smart-school/adminTheme.jsx components/smart-waste/wasteTheme.jsx
git commit -m "feat(smart-waste): เพิ่มธีมโมดูล — ยืม token จาก smart-school + สีกราฟ 8 กลุ่มที่ผ่าน validator"
```

---

### Task 3: components ย่อยของฟอร์ม — `TotalBar` + `TypePickerSheet`

**Files:**
- Create: `components/smart-waste/entry/TotalBar.jsx`
- Create: `components/smart-waste/entry/TypePickerSheet.jsx`

- [ ] **Step 1: TotalBar — แถบยอดรวม sticky ล่างจอ**

```jsx
// components/smart-waste/entry/TotalBar.jsx
import React from 'react';
import { primaryBtnCls, formatKg } from '../wasteTheme';

// แถบรวมยอด + ปุ่มบันทึก ติดล่างจอ อัปเดตสดขณะพิมพ์ (สเปกข้อ 7.2)
export default function TotalBar({ totalKg, saving, editing, onSave }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 sm:mx-0 px-4 py-3 bg-white/95 backdrop-blur
      border-t border-[#E7E2F2] sm:rounded-b-[24px] flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-[#8A8398]">รวมทั้งวัน</div>
        <div className="text-[22px] font-bold text-[#211B2E] leading-none truncate">
          {formatKg(totalKg)} กก.
        </div>
      </div>
      <button type="button" onClick={onSave} disabled={saving}
        className={primaryBtnCls + ' min-w-[132px] shrink-0'}>
        {saving ? 'กำลังบันทึก…' : editing ? 'บันทึกการแก้ไข' : 'บันทึก'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: TypePickerSheet — bottom sheet เลือกประเภทเพิ่ม**

จัดกลุ่มตาม 8 กลุ่มใหญ่ + ช่องค้นหา (สเปกข้อ 7.2) · ประเภทที่อยู่ในฟอร์มแล้ว disabled

```jsx
// components/smart-waste/entry/TypePickerSheet.jsx
import React, { useMemo, useState } from 'react';
import { WASTE_GROUPS } from '@/lib/smart-waste/wasteGroups';
import { inputCls } from '../wasteTheme';

// bottom sheet เลือกประเภทที่ไม่ใช่ "กรอกบ่อย" เข้าฟอร์ม — จัดกลุ่มตาม 8 กลุ่มใหญ่
export default function TypePickerSheet({ open, types, selectedKeys, onPick, onClose }) {
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const q = query.trim();
    return WASTE_GROUPS.map((group) => ({
      ...group,
      types: types.filter(
        (type) => type.group === group.key && (!q || type.label.includes(q))
      ),
    })).filter((group) => group.types.length > 0);
  }, [types, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[80vh] bg-white rounded-t-[24px]
        sm:rounded-[24px] flex flex-col">
        <div className="p-4 pb-2 border-b border-[#E7E2F2]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[15px] font-bold text-[#211B2E]">เพิ่มประเภทขยะ</p>
            <button type="button" onClick={onClose} aria-label="ปิด"
              className="grid h-8 w-8 place-items-center rounded-full text-[#8A8398] hover:bg-[#F1ECFB]">✕</button>
          </div>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาประเภท…" className={inputCls} />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {grouped.length === 0 && (
            <p className="text-center text-[13px] text-[#8A8398] py-6">ไม่พบประเภทที่ค้นหา</p>
          )}
          {grouped.map((group) => (
            <div key={group.key}>
              <p className="text-[11px] font-bold text-[#57506A] mb-1.5">{group.label}</p>
              <div className="flex flex-wrap gap-2">
                {group.types.map((type) => {
                  const added = selectedKeys.includes(type.key);
                  return (
                    <button key={type.key} type="button" disabled={added}
                      onClick={() => { onPick(type.key); onClose(); }}
                      className={'text-[13px] px-3.5 py-2 rounded-full font-semibold transition ' +
                        (added
                          ? 'bg-[#F1F1F4] text-[#B9B0C9] cursor-not-allowed'
                          : 'bg-[#EDE7FD] text-[#6D28D9] hover:bg-[#DDD2FB]')}>
                      {added ? '✓ ' : '+ '}{type.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: ตรวจ build แล้ว commit**

Run: `npm run build` — Expected: ผ่าน

```bash
git add components/smart-waste/entry/TotalBar.jsx components/smart-waste/entry/TypePickerSheet.jsx
git commit -m "feat(smart-waste): เพิ่ม TotalBar และ TypePickerSheet ของฟอร์มกรอกรายวัน"
```

---

### Task 4: `DailyEntryForm` — ฟอร์มกรอกรายวัน (หัวใจของงาน)

**Files:**
- Create: `components/smart-waste/entry/DailyEntryForm.jsx`

พฤติกรรมตามสเปกข้อ 7.2 + 11 ทั้งหมด: default วันนี้ · ปุ่มเมื่อวาน · โหลดวันเดิมมาแก้ + badge · แสดงเฉพาะ `isCommon` ก่อน · ประเภทที่เพิ่มแล้วคงอยู่จนกดลบ · `inputMode="decimal"` + `text-[16px]` (อยู่ใน `inputCls` แล้ว) · draft ลง localStorage · เตือน >1,000 กก. · entries ว่าง + มีข้อมูลเดิม = ยืนยันก่อนล้าง · บันทึกสำเร็จเลื่อนไปวันถัดไป (ไม่เกินวันนี้)

- [ ] **Step 1: เขียน component ทั้งไฟล์**

```jsx
// components/smart-waste/entry/DailyEntryForm.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { HIGH_KG_WARNING_THRESHOLD, round2 } from '@/lib/smart-waste/aggregate';
import { bangkokToday } from '@/lib/smart-waste/fiscalYear';
import { addDays, draftKey, nextEntryDate, thaiDateLabel } from '@/lib/smart-waste/uiDate';
import { wasteGroupLabel } from '@/lib/smart-waste/wasteGroups';
import { chipCls, inputCls, formatKg } from '../wasteTheme';
import TotalBar from './TotalBar';
import TypePickerSheet from './TypePickerSheet';

// ฟอร์มกรอกน้ำหนักขยะรายวัน (mobile-first) — สเปกข้อ 7.2
// types: รายการประเภททั้งหมดจากหน้าแม่ (ฟอร์มกรองเฉพาะ active เอง)
// initialDate: เปิดที่วันไหน (มาจากแท็บ "ข้อมูล" กดแก้) — ไม่ส่ง = วันนี้
// onSaved(recordDate): แจ้งหน้าแม่ให้ refresh ข้อมูลแท็บอื่น
export default function DailyEntryForm({ types, initialDate, onSaved }) {
  const today = bangkokToday();
  const activeTypes = useMemo(() => types.filter((type) => type.active), [types]);
  const typeByKey = useMemo(() => new Map(types.map((type) => [type.key, type])), [types]);

  const [recordDate, setRecordDate] = useState(initialDate || today);
  const [values, setValues] = useState({});      // typeKey -> string ที่ผู้ใช้พิมพ์
  const [extraKeys, setExtraKeys] = useState([]); // ประเภทนอกชุด isCommon ที่ถูกเพิ่มเข้าฟอร์ม
  const [note, setNote] = useState('');
  const [existing, setExisting] = useState(null); // record เดิมของวันนี้ (null = วันใหม่)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const dirtyRef = useRef(false); // เขียน draft เฉพาะเมื่อผู้ใช้แก้เอง ไม่ใช่ตอนโหลด
  const reqIdRef = useRef(0);

  // เปิดจากแท็บ "ข้อมูล" ด้วยวันอื่น → เปลี่ยนวันตาม
  useEffect(() => {
    if (initialDate) setRecordDate(initialDate);
  }, [initialDate]);

  const commonTypes = useMemo(() => activeTypes.filter((type) => type.isCommon), [activeTypes]);
  const visibleTypes = useMemo(() => {
    const extras = extraKeys
      .map((key) => typeByKey.get(key))
      .filter(Boolean)
      .filter((type) => !type.isCommon);
    return [...commonTypes, ...extras];
  }, [commonTypes, extraKeys, typeByKey]);

  // ยอดรวมโชว์สด — server คำนวณของจริงใหม่เสมอ ตัวนี้เพื่อ UI เท่านั้น
  const totalKg = useMemo(() => {
    let total = 0;
    for (const type of visibleTypes) {
      const kg = Number(values[type.key]);
      if (Number.isFinite(kg) && kg > 0) total = round2(total + kg);
    }
    return total;
  }, [values, visibleTypes]);

  // โหลดข้อมูลของวัน + กู้ draft ถ้ามี (draft ชนะค่าจาก server — มันใหม่กว่าเสมอ
  // เพราะถูกล้างทุกครั้งที่บันทึกสำเร็จ)
  const loadDate = useCallback(async (date) => {
    const myId = ++reqIdRef.current;
    setLoading(true);
    dirtyRef.current = false;
    try {
      const res = await fetch(`/api/smart-waste/daily/${date}`);
      if (!res.ok) throw new Error((await res.json()).message || 'โหลดข้อมูลไม่สำเร็จ');
      const { record } = await res.json();
      if (myId !== reqIdRef.current) return;

      const nextValues = {};
      const nextExtras = [];
      for (const entry of record?.entries || []) {
        nextValues[entry.typeKey] = String(entry.kg);
        const type = typeByKey.get(entry.typeKey);
        if (!type?.isCommon) nextExtras.push(entry.typeKey);
      }
      setExisting(record);
      setNote(record?.note || '');

      let draft = null;
      try {
        draft = JSON.parse(localStorage.getItem(draftKey(date)) || 'null');
      } catch { /* draft พัง → ทิ้ง */ }
      if (draft) {
        setValues(draft.values || {});
        setExtraKeys(draft.extraKeys || nextExtras);
        setNote(draft.note ?? (record?.note || ''));
        dirtyRef.current = true;
        Swal.fire({
          toast: true, position: 'top', icon: 'info', timer: 3500, showConfirmButton: false,
          title: 'กู้ข้อมูลร่างที่ยังไม่ได้บันทึกกลับมาให้แล้ว',
        });
      } else {
        setValues(nextValues);
        setExtraKeys(nextExtras);
      }
    } catch (error) {
      if (myId === reqIdRef.current) {
        Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: error.message });
      }
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  }, [typeByKey]);

  useEffect(() => { loadDate(recordDate); }, [recordDate, loadDate]);

  // draft autosave — เขียนเมื่อผู้ใช้แก้เท่านั้น (สเปกข้อ 7.2: กันเน็ตหลุด/ปิดจอ)
  useEffect(() => {
    if (!dirtyRef.current || loading) return;
    localStorage.setItem(
      draftKey(recordDate),
      JSON.stringify({ values, extraKeys, note })
    );
  }, [values, extraKeys, note, recordDate, loading]);

  const setValue = (typeKey, raw) => {
    dirtyRef.current = true;
    setValues((prev) => ({ ...prev, [typeKey]: raw }));
  };
  const addExtra = (typeKey) => {
    dirtyRef.current = true;
    setExtraKeys((prev) => (prev.includes(typeKey) ? prev : [...prev, typeKey]));
  };
  const removeExtra = (typeKey) => {
    dirtyRef.current = true;
    setExtraKeys((prev) => prev.filter((key) => key !== typeKey));
    setValues((prev) => ({ ...prev, [typeKey]: '' }));
  };

  const handleSave = async () => {
    const entries = visibleTypes
      .map((type) => ({ typeKey: type.key, kg: Number(values[type.key]) }))
      .filter((entry) => Number.isFinite(entry.kg) && entry.kg > 0);

    // ล้างข้อมูลวันเดิม (entries ว่าง + มีของเดิม) — ต้องยืนยันก่อน server จะลบ record
    if (entries.length === 0) {
      if (!existing) {
        Swal.fire({ icon: 'info', title: 'ยังไม่ได้กรอกน้ำหนัก', text: 'ใส่ตัวเลขอย่างน้อย 1 ช่องก่อนบันทึก' });
        return;
      }
      const confirm = await Swal.fire({
        icon: 'warning',
        title: `ล้างข้อมูลของวันที่ ${thaiDateLabel(recordDate)}?`,
        text: `ข้อมูลเดิม ${formatKg(existing.totalKg)} กก. จะถูกลบทั้งวัน`,
        showCancelButton: true, confirmButtonText: 'ล้างข้อมูล', cancelButtonText: 'ยกเลิก',
      });
      if (!confirm.isConfirmed) return;
    }

    // ตัวเลขสูงผิดปกติ (> 1,000 กก./ประเภท/วัน) — เตือนแต่ไม่บล็อก (สเปกข้อ 11)
    const high = entries.filter((entry) => entry.kg > HIGH_KG_WARNING_THRESHOLD);
    if (high.length > 0) {
      const lines = high
        .map((entry) => `${typeByKey.get(entry.typeKey)?.label || entry.typeKey} ${formatKg(entry.kg)} กก.`)
        .join(' · ');
      const confirm = await Swal.fire({
        icon: 'warning', title: 'ตัวเลขสูงผิดปกติ', text: `${lines} — ยืนยันว่าถูกต้อง?`,
        showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'กลับไปแก้',
      });
      if (!confirm.isConfirmed) return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/smart-waste/daily/${recordDate}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, note }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'บันทึกไม่สำเร็จ');
      const data = await res.json();

      // สำเร็จแล้วเท่านั้นจึงล้าง draft — เน็ตหลุด draft ต้องยังอยู่ (สเปกข้อ 11)
      localStorage.removeItem(draftKey(recordDate));
      dirtyRef.current = false;
      onSaved?.(recordDate);

      await Swal.fire({
        toast: true, position: 'top', icon: 'success', timer: 2500, showConfirmButton: false,
        title: data.record
          ? `บันทึก ${thaiDateLabel(recordDate)} รวม ${formatKg(data.record.totalKg)} กก.`
          : `ล้างข้อมูล ${thaiDateLabel(recordDate)} แล้ว`,
      });

      const next = nextEntryDate(recordDate, today);
      if (next !== recordDate) setRecordDate(next);
      else loadDate(recordDate); // ค้างวันเดิม → โหลดใหม่ให้ badge/ค่าตรง server
    } catch (error) {
      // ไม่เคลียร์ฟอร์ม ไม่ล้าง draft — ให้กดส่งซ้ำได้
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      {/* ── เลือกวันที่ ── */}
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <input type="date" value={recordDate} max={today}
          onChange={(e) => e.target.value && setRecordDate(e.target.value)}
          className={inputCls + ' !w-auto'} aria-label="เลือกวันที่บันทึก" />
        <button type="button" className={chipCls(recordDate === today)}
          onClick={() => setRecordDate(today)}>วันนี้</button>
        <button type="button" className={chipCls(recordDate === addDays(today, -1))}
          onClick={() => setRecordDate(addDays(today, -1))}>เมื่อวาน</button>
        <span className="text-[13px] font-semibold text-[#57506A]">📅 {thaiDateLabel(recordDate)}</span>
      </div>
      {existing && !loading && (
        <p className="text-[12px] font-semibold text-[#B45309] bg-[#FEF3C7] rounded-lg px-3 py-1.5 mb-2 w-fit">
          ⚠ วันนี้บันทึกแล้ว ({formatKg(existing.totalKg)} กก.) — กำลังแก้ไข
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : (
        <>
          {/* ── ช่องกรอก: กรอกบ่อยก่อน แล้วตามด้วยประเภทที่เพิ่มเอง ── */}
          <p className="text-[12px] font-bold text-[#57506A] mt-3 mb-2">กรอกบ่อย</p>
          <div className="space-y-2">
            {visibleTypes.map((type) => (
              <div key={type.key} className="flex items-center gap-2">
                <label htmlFor={`kg-${type.key}`}
                  className="flex-1 min-w-0 text-[13.5px] font-medium text-[#211B2E] truncate">
                  {type.label}
                  {!type.isCommon && (
                    <span className="ml-1.5 text-[11px] text-[#8A8398]">({wasteGroupLabel(type.group)})</span>
                  )}
                </label>
                {!type.isCommon && (
                  <button type="button" onClick={() => removeExtra(type.key)}
                    aria-label={`เอา ${type.label} ออก`}
                    className="text-[#B9B0C9] hover:text-[#e34948] text-[15px] px-1">✕</button>
                )}
                <input id={`kg-${type.key}`} inputMode="decimal" placeholder="0"
                  value={values[type.key] ?? ''}
                  onChange={(e) => setValue(type.key, e.target.value)}
                  className={inputCls + ' !w-[110px] text-right'} />
                <span className="text-[12px] text-[#8A8398] w-6">กก.</span>
              </div>
            ))}
          </div>

          <button type="button" onClick={() => setSheetOpen(true)}
            className="mt-3 w-full rounded-[14px] border-[1.5px] border-dashed border-[#C9BCE8]
              py-3 text-[13.5px] font-semibold text-[#7C3AED] hover:bg-[#F1ECFB] transition">
            + เพิ่มประเภทอื่น
          </button>

          <div className="mt-4">
            <label htmlFor="waste-note" className="text-[12px] font-bold text-[#57506A]">หมายเหตุ (ถ้ามี)</label>
            <input id="waste-note" value={note} maxLength={500}
              onChange={(e) => { dirtyRef.current = true; setNote(e.target.value); }}
              placeholder="เช่น วันหยุดไม่มีการคัดแยก" className={inputCls + ' mt-1.5'} />
          </div>

          <div className="h-4" />
          <TotalBar totalKg={totalKg} saving={saving} editing={Boolean(existing)} onSave={handleSave} />
        </>
      )}

      <TypePickerSheet open={sheetOpen} onClose={() => setSheetOpen(false)}
        types={activeTypes.filter((type) => !type.isCommon)}
        selectedKeys={extraKeys} onPick={addExtra} />
    </div>
  );
}
```

- [ ] **Step 2: ตรวจ build แล้ว commit**

Run: `npm run build` — Expected: ผ่าน

```bash
git add components/smart-waste/entry/DailyEntryForm.jsx
git commit -m "feat(smart-waste): เพิ่มฟอร์มกรอกรายวัน mobile-first พร้อม draft autosave และเตือนตัวเลขสูงผิดปกติ"
```

---

### Task 5: หน้า `/admin/smart-waste` (เริ่มด้วยแท็บ "บันทึก") + title ใน Layout

**Files:**
- Create: `pages/admin/smart-waste.jsx`
- Modify: `components/Layout.js:43-44` (เพิ่มแถวใน `ADMIN_META`)

- [ ] **Step 1: สร้างหน้า**

แท็บ "ข้อมูล"/"สรุป" กับปุ่มเฟือง ใส่ placeholder ไว้ก่อน (เติมจริง Task 6–8) — หน้าใช้งานแท็บบันทึกได้จริงตั้งแต่ task นี้

```jsx
// pages/admin/smart-waste.jsx
import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import Swal from 'sweetalert2';
import PermissionGuard from '@/components/PermissionGuard';
import DailyEntryForm from '@/components/smart-waste/entry/DailyEntryForm';
import { DashboardHeader, PillTabs, cardCls } from '@/components/smart-waste/wasteTheme';
import { bangkokToday } from '@/lib/smart-waste/fiscalYear';
import { listFiscalYears } from '@/lib/smart-waste/uiDate';

// Smart Waste — บันทึกขยะรีไซเคิลและขยะเปียกรายวัน (กองสาธารณสุข)
// หน้าเดียว 3 แท็บตามสเปกข้อ 7.1 — จัดการประเภทเป็น modal ไม่แยกหน้า (เลี่ยง permission entry ที่ 2)
export default function SmartWastePage() {
  const { user } = useUser();
  const isSuperAdmin = user?.publicMetadata?.role === 'superadmin';

  const [tab, setTab] = useState('entry'); // 'entry' | 'data' | 'summary'
  const [types, setTypes] = useState(null); // null = ยังไม่โหลด (รวม inactive — ตารางย้อนหลังต้องใช้)
  const [editDate, setEditDate] = useState(null); // แท็บข้อมูลสั่งเปิดฟอร์มที่วันนี้
  const [managerOpen, setManagerOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0); // บันทึกสำเร็จ → บังคับแท็บอื่นโหลดใหม่

  const years = listFiscalYears(bangkokToday());
  const [fiscalYear, setFiscalYear] = useState(years[0]);

  const fetchTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/smart-waste/types?includeInactive=1');
      if (!res.ok) throw new Error((await res.json()).message || 'โหลดประเภทขยะไม่สำเร็จ');
      setTypes((await res.json()).types);
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'โหลดประเภทขยะไม่สำเร็จ', text: error.message });
    }
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const openEntryAt = (recordDate) => {
    setEditDate(recordDate);
    setTab('entry');
  };

  return (
    <PermissionGuard>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className={cardCls + ' p-4 sm:p-5'}>
          <DashboardHeader icon="♻️" title="Smart Waste — ขยะรีไซเคิลและขยะเปียก"
            subtitle="บันทึกน้ำหนักคัดแยกรายวัน · กองสาธารณสุข"
            right={
              <button type="button" onClick={() => setManagerOpen(true)}
                title="จัดการประเภทขยะ" aria-label="จัดการประเภทขยะ"
                className="grid h-10 w-10 place-items-center rounded-[12px] border border-[#E7E2F2]
                  text-[18px] hover:bg-[#F1ECFB] transition">⚙️</button>
            } />
          <PillTabs active={tab} onChange={setTab}
            tabs={[
              { key: 'entry', label: '📝 บันทึก' },
              { key: 'data', label: '📅 ข้อมูล' },
              { key: 'summary', label: '📊 สรุป' },
            ]} />

          <div className="mt-4">
            {!types ? (
              <div className="flex justify-center py-16">
                <span className="loading loading-spinner loading-lg text-primary" />
              </div>
            ) : tab === 'entry' ? (
              <DailyEntryForm types={types} initialDate={editDate}
                onSaved={() => setRefreshTick((t) => t + 1)} />
            ) : tab === 'data' ? (
              <p className="text-center text-[13px] text-[#8A8398] py-10">— แท็บข้อมูล (Task 6) —</p>
            ) : (
              <p className="text-center text-[13px] text-[#8A8398] py-10">— แท็บสรุป (Task 7) —</p>
            )}
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
```

หมายเหตุ implementer: `refreshTick`, `fiscalYear`, `years`, `openEntryAt`, `isSuperAdmin`, `managerOpen` ถูกใช้จริงใน Task 6–8 — ประกาศตั้งแต่ตอนนี้เพื่อไม่ต้อง refactor ทีหลัง (ESLint อาจเตือน unused ชั่วคราว ยอมรับได้ภายใน task นี้ ห้ามลบทิ้ง)

- [ ] **Step 2: เพิ่ม title ใน Layout**

ใน `components/Layout.js` object `ADMIN_META` เพิ่มแถวถัดจาก `'/admin/smart-light'`:

```js
  '/admin/smart-waste':               { title: 'Smart Waste (ขยะรีไซเคิล)' },
```

- [ ] **Step 3: ทดสอบมือ**

Run: `npm run dev` แล้วเปิด `http://localhost:3000/admin/smart-waste` (login superadmin — ผ่าน guard ได้เสมอ)
Expected: เห็นฟอร์ม 7 ช่อง "กรอกบ่อย" (ข้อมูลจริงถูก import แล้วในแผนที่ 1 — เปิดวันนี้อาจว่าง เปิด "เมื่อวาน"/วันที่มีข้อมูลต้องเห็น badge กำลังแก้ไข) · กรอกเลข → ยอดรวม sticky อัปเดต · กดบันทึก → toast สำเร็จ

- [ ] **Step 4: Commit**

```bash
git add pages/admin/smart-waste.jsx components/Layout.js
git commit -m "feat(smart-waste): เพิ่มหน้า /admin/smart-waste พร้อมแท็บบันทึกใช้งานได้จริง"
```

---

### Task 6: แท็บ "ข้อมูล" — `MonthTable`

**Files:**
- Create: `components/smart-waste/admin/MonthTable.jsx`
- Modify: `pages/admin/smart-waste.jsx` (แทน placeholder แท็บ data)

ตามสเปกข้อ 7.3: pill 12 เดือนของปีงบ → ตารางแถว=วัน คอลัมน์=ประเภท (เหมือน Excel เดิม, คอลัมน์วันที่ sticky ซ้าย, เลื่อนแนวนอน) · มือถือ default card ต่อวัน แตะเพื่อแก้ · แถวท้าย=ยอดรวมเดือน · การแก้ไขทำผ่านฟอร์มแท็บ "บันทึก" (audit log อยู่ฝั่ง server แล้ว)

- [ ] **Step 1: เขียน MonthTable**

```jsx
// components/smart-waste/admin/MonthTable.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { fiscalMonths, bangkokToday } from '@/lib/smart-waste/fiscalYear';
import { round2 } from '@/lib/smart-waste/aggregate';
import { WASTE_GROUPS, wasteGroupLabel } from '@/lib/smart-waste/wasteGroups';
import { chipCls, tableHeadCls, formatKg } from '../wasteTheme';

// ตาราง/การ์ดข้อมูลรายเดือน — คอลัมน์คือ "ทุกประเภท" ตาม order (รวม inactive
// เพราะข้อมูลย้อนหลังอาจอ้างประเภทที่ปิดไปแล้ว — สเปกข้อ 11)
export default function MonthTable({ fiscalYear, types, onEditDate, refreshTick }) {
  const months = useMemo(() => fiscalMonths(fiscalYear), [fiscalYear]);
  const today = bangkokToday();
  const currentMonthKey = today.slice(0, 7);

  const [monthKey, setMonthKey] = useState(
    months.some((m) => m.key === currentMonthKey) ? currentMonthKey : months[0].key
  );
  // มือถือ default การ์ด / จอใหญ่ default ตาราง (สเปกข้อ 7.3)
  const [view, setView] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'cards' : 'table'
  );
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const reqIdRef = useRef(0);

  // เปลี่ยนปีงบ → เดือนเดิมอาจไม่อยู่ในปีใหม่
  useEffect(() => {
    if (!months.some((m) => m.key === monthKey)) setMonthKey(months[0].key);
  }, [months, monthKey]);

  const month = months.find((m) => m.key === monthKey) || months[0];

  const fetchMonth = useCallback(async () => {
    const myId = ++reqIdRef.current;
    setLoading(true);
    try {
      const from = `${month.key}-01`;
      const to = `${month.key}-${String(month.daysInMonth).padStart(2, '0')}`;
      const res = await fetch(`/api/smart-waste/daily?from=${from}&to=${to}`);
      if (!res.ok) throw new Error((await res.json()).message || 'โหลดข้อมูลไม่สำเร็จ');
      const json = await res.json();
      if (myId === reqIdRef.current) setRecords(json.records);
    } catch (error) {
      if (myId === reqIdRef.current) {
        Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: error.message });
      }
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  }, [month.key, month.daysInMonth]);

  // refreshTick มาจากหน้าแม่ — บันทึกในแท็บฟอร์มแล้วข้อมูลที่นี่ต้องสด
  useEffect(() => { fetchMonth(); }, [fetchMonth, refreshTick]);

  // ยอดรวมเดือนต่อประเภท (แถวท้ายตาราง) — บวกจาก entries ชุดเดียวกับที่แสดง
  const columnTotals = useMemo(() => {
    const totals = {};
    let grand = 0;
    for (const record of records) {
      for (const entry of record.entries) {
        totals[entry.typeKey] = round2((totals[entry.typeKey] || 0) + entry.kg);
      }
      grand = round2(grand + record.totalKg);
    }
    return { totals, grand };
  }, [records]);

  return (
    <div>
      {/* pill 12 เดือนของปีงบ */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
        {months.map((m) => (
          <button key={m.key} type="button" onClick={() => setMonthKey(m.key)}
            className={chipCls(m.key === monthKey) + ' shrink-0'}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mt-2 mb-3">
        <p className="text-[13px] font-bold text-[#57506A]">
          {month.label} · บันทึกแล้ว {records.length} วัน · รวม {formatKg(columnTotals.grand)} กก.
        </p>
        <div className="flex gap-1.5">
          <button type="button" className={chipCls(view === 'cards')} onClick={() => setView('cards')}>การ์ด</button>
          <button type="button" className={chipCls(view === 'table')} onClick={() => setView('table')}>ตาราง</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : records.length === 0 ? (
        <p className="text-center text-[13px] text-[#8A8398] py-10">
          ยังไม่มีข้อมูลใน {month.label} — กรอกได้ที่แท็บ "บันทึก"
        </p>
      ) : view === 'cards' ? (
        /* ── การ์ดต่อวัน (มือถือ) — แตะเพื่อแก้ ── */
        <div className="space-y-2">
          {records.map((record) => {
            const topGroups = WASTE_GROUPS
              .map((g) => ({ ...g, kg: record.groupTotals?.[g.key] || 0 }))
              .filter((g) => g.kg > 0)
              .sort((a, b) => b.kg - a.kg)
              .slice(0, 3);
            return (
              <button key={record.recordDate} type="button"
                onClick={() => onEditDate(record.recordDate)}
                className="w-full text-left bg-white border border-[#E7E2F2] rounded-[16px] p-3.5
                  hover:border-[#7C3AED] transition">
                <div className="flex items-baseline justify-between">
                  <span className="text-[14px] font-bold text-[#211B2E]">
                    {Number(record.recordDate.slice(8, 10))} {month.label}
                  </span>
                  <span className="text-[15px] font-bold text-[#7C3AED]">{formatKg(record.totalKg)} กก.</span>
                </div>
                <div className="text-[11.5px] text-[#8A8398] mt-1">
                  {topGroups.map((g) => `${g.label} ${formatKg(g.kg)}`).join(' · ') || '—'}
                  {record.note ? ` · 📝 ${record.note}` : ''}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        /* ── ตารางเหมือน Excel เดิม — คอลัมน์วันที่ sticky ── */
        <div className="overflow-x-auto border border-[#E7E2F2] rounded-[16px]">
          <table className="text-[12px] whitespace-nowrap border-collapse min-w-full">
            <thead>
              <tr className={tableHeadCls}>
                <th className="sticky left-0 z-10 bg-[#F6F3FD] px-3 py-2 text-left border-b border-[#E7E2F2]">วันที่</th>
                {types.map((type) => (
                  <th key={type.key} title={wasteGroupLabel(type.group)}
                    className="px-2.5 py-2 text-right border-b border-[#E7E2F2] font-semibold">
                    {type.label}{type.active ? '' : ' (ปิด)'}
                  </th>
                ))}
                <th className="px-3 py-2 text-right border-b border-[#E7E2F2]">รวม</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const kgByKey = Object.fromEntries(record.entries.map((e) => [e.typeKey, e.kg]));
                return (
                  <tr key={record.recordDate} className="hover:bg-[#FAF8FF] cursor-pointer"
                    onClick={() => onEditDate(record.recordDate)}
                    title="แตะเพื่อแก้ไขวันนี้">
                    <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-semibold border-b border-[#F1ECFB]">
                      {Number(record.recordDate.slice(8, 10))}
                    </td>
                    {types.map((type) => (
                      <td key={type.key} className="px-2.5 py-1.5 text-right border-b border-[#F1ECFB]">
                        {kgByKey[type.key] ? formatKg(kgByKey[type.key]) : ''}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right font-bold border-b border-[#F1ECFB]">
                      {formatKg(record.totalKg)}
                    </td>
                  </tr>
                );
              })}
              {/* แถวท้าย = ยอดรวมเดือน (สเปกข้อ 7.3) */}
              <tr className="bg-[#F6F3FD] font-bold">
                <td className="sticky left-0 z-10 bg-[#F6F3FD] px-3 py-2">รวม</td>
                {types.map((type) => (
                  <td key={type.key} className="px-2.5 py-2 text-right">
                    {columnTotals.totals[type.key] ? formatKg(columnTotals.totals[type.key]) : ''}
                  </td>
                ))}
                <td className="px-3 py-2 text-right text-[#7C3AED]">{formatKg(columnTotals.grand)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: ต่อเข้าหน้า — แทน placeholder แท็บ data**

ใน `pages/admin/smart-waste.jsx`:

```jsx
import MonthTable from '@/components/smart-waste/admin/MonthTable';
import { YearPills } from '@/components/smart-waste/wasteTheme';
```

แทน `<p ...>— แท็บข้อมูล (Task 6) —</p>` ด้วย:

```jsx
              <div className="space-y-3">
                <YearPills years={years} value={fiscalYear} onChange={setFiscalYear} />
                <MonthTable fiscalYear={fiscalYear} types={types}
                  onEditDate={openEntryAt} refreshTick={refreshTick} />
              </div>
```

- [ ] **Step 3: ทดสอบมือ + commit**

Run: dev server → แท็บ "ข้อมูล" ปีงบ 2569 เดือน ต.ค.68
Expected: ตารางมีข้อมูลจริงจากการ import (แผนที่ 1) · แถวท้าย "รวม" ตรงกับไฟล์ Excel เดิม · จอแคบ default การ์ด · คลิกแถว/การ์ด → กระโดดไปแท็บบันทึกพร้อมข้อมูลวันนั้น

```bash
git add components/smart-waste/admin/MonthTable.jsx pages/admin/smart-waste.jsx
git commit -m "feat(smart-waste): เพิ่มแท็บข้อมูล — ตารางรายเดือนแบบ Excel + การ์ดมือถือ แตะเพื่อแก้"
```

---

### Task 7: แท็บ "สรุป" — `SummaryDashboard` + export

**Files:**
- Create: `components/smart-waste/admin/SummaryDashboard.jsx`
- Modify: `pages/admin/smart-waste.jsx` (แทน placeholder แท็บ summary)

ตามสเปกข้อ 7.4 + กติกากราฟหัวแผน: StatCard (รวมปี/เฉลี่ยต่อวันที่บันทึก/เดือนล่าสุด/จำนวนวัน + 1 ใบต่อประเภท `isHighlighted`) · แท่งซ้อน 8 กลุ่ม × 12 เดือน · เส้นเทียบปีงบ (ข้ามถ้าปีก่อนไม่มีข้อมูล) · โดนัทสัดส่วน 8 กลุ่ม · **ตาราง relief รายเดือน 8 กลุ่ม (ห้ามตัด — เงื่อนไขจาก validator)** · ปุ่มดาวน์โหลด Excel · ปีที่ไม่มีข้อมูล = empty state ไม่ error

- [ ] **Step 1: เขียน SummaryDashboard**

```jsx
// components/smart-waste/admin/SummaryDashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { WASTE_GROUPS } from '@/lib/smart-waste/wasteGroups';
import { FIRST_FISCAL_YEAR } from '@/lib/smart-waste/uiDate';
import {
  StatCard, ghostBtnCls, tableHeadCls, formatKg,
  WASTE_GROUP_COLORS, YEAR_LINE_COLORS,
} from '../wasteTheme';

const kgTip = (value) => `${formatKg(value)} กก.`;

// แท็บสรุปต่อปีงบ — ดึง summary ปีที่เลือก + ปีก่อนหน้า (เส้นเทียบปีต่อปี)
export default function SummaryDashboard({ fiscalYear, refreshTick }) {
  const [summary, setSummary] = useState(null);
  const [prevSummary, setPrevSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const myId = ++reqIdRef.current;
    const load = async () => {
      setLoading(true);
      try {
        const fetchYear = async (year) => {
          const res = await fetch(`/api/smart-waste/summary?fiscalYear=${year}`);
          if (!res.ok) throw new Error((await res.json()).message || 'โหลดสรุปไม่สำเร็จ');
          return res.json();
        };
        const hasPrev = fiscalYear - 1 >= FIRST_FISCAL_YEAR;
        const [current, previous] = await Promise.all([
          fetchYear(fiscalYear),
          hasPrev ? fetchYear(fiscalYear - 1) : Promise.resolve(null),
        ]);
        if (myId !== reqIdRef.current) return;
        setSummary(current);
        setPrevSummary(previous);
      } catch (error) {
        if (myId === reqIdRef.current) {
          Swal.fire({ icon: 'error', title: 'โหลดสรุปไม่สำเร็จ', text: error.message });
        }
      } finally {
        if (myId === reqIdRef.current) setLoading(false);
      }
    };
    load();
  }, [fiscalYear, refreshTick]);

  const stackedData = useMemo(
    () => (summary?.months || []).map((m) => ({ label: m.label, ...m.groupTotals })),
    [summary]
  );
  const compareData = useMemo(
    () => (summary?.months || []).map((m, i) => ({
      label: m.label,
      current: m.totalKg,
      previous: prevSummary?.months?.[i]?.totalKg ?? 0,
    })),
    [summary, prevSummary]
  );
  const donutData = useMemo(
    () => WASTE_GROUPS
      .map((g) => ({ ...g, value: summary?.groupTotals?.[g.key] || 0 }))
      .filter((g) => g.value > 0),
    [summary]
  );
  const latestMonth = useMemo(
    () => [...(summary?.months || [])].reverse().find((m) => m.recordedDays > 0),
    [summary]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }
  if (!summary) return null;

  const exportBtn = (
    <a href={`/api/smart-waste/export?fiscalYear=${fiscalYear}`} className={ghostBtnCls + ' !py-2.5'}>
      ⬇️ ดาวน์โหลด Excel
    </a>
  );

  // ปีที่ยังไม่มีข้อมูล — empty state ไม่ error (สเปกข้อ 11) แต่ export ได้ (ไฟล์โครงเปล่า)
  if (summary.recordedDays === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-[13px] text-[#8A8398]">ยังไม่มีข้อมูลในปีงบ {fiscalYear}</p>
        {exportBtn}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── StatCards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard value={formatKg(summary.totalKg)} label={`รวมปีงบ ${fiscalYear} (กก.)`} tone="purple" />
        <StatCard value={formatKg(summary.avgKgPerRecordedDay)} label="เฉลี่ยต่อวันที่บันทึก (กก.)" />
        <StatCard value={latestMonth ? formatKg(latestMonth.totalKg) : '—'}
          label={`เดือนล่าสุด${latestMonth ? ` (${latestMonth.label})` : ''} (กก.)`} tone="deep" />
        <StatCard value={`${summary.recordedDays}`} label={`วันที่บันทึกแล้ว (จาก ${summary.totalDays} วัน)`} />
        {/* + 1 ใบต่อประเภทที่ติดธง isHighlighted (เริ่มต้น = ถุงอ่อน) — สเปกข้อ 2.4 */}
        {summary.highlightedTypes.map((type) => (
          <StatCard key={type.key} value={formatKg(type.totalKg)}
            label={`เฉพาะ${type.label} (กก.)`} tone="green" />
        ))}
      </div>

      <div className="flex justify-end">{exportBtn}</div>

      {/* ── แท่งซ้อน 8 กลุ่ม × 12 เดือน ── */}
      <div>
        <p className="text-[13px] font-bold text-[#57506A] mb-2">น้ำหนักรายเดือนแยก 8 กลุ่ม</p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={stackedData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEE9F8" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#E7E2F2' }} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
            <Tooltip formatter={(value, name) => [kgTip(value), name]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {WASTE_GROUPS.map((group) => (
              /* stroke สีพื้น 1px = ช่องไฟระหว่างชั้น stack (กติกา mark ของ dataviz) */
              <Bar key={group.key} dataKey={group.key} name={group.label} stackId="kg"
                fill={WASTE_GROUP_COLORS[group.key]} stroke="#FAF8FF" strokeWidth={1} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── ตาราง relief — บังคับโดยผล validator (3 สี contrast < 3:1) ห้ามตัดออก ── */}
      <details className="border border-[#E7E2F2] rounded-[16px] px-4 py-3">
        <summary className="text-[13px] font-bold text-[#57506A] cursor-pointer select-none">
          ตารางยอดรายเดือน 8 กลุ่ม (กก.)
        </summary>
        <div className="overflow-x-auto mt-3">
          <table className="text-[12px] whitespace-nowrap min-w-full">
            <thead>
              <tr className={tableHeadCls}>
                <th className="px-2.5 py-1.5 text-left">เดือน</th>
                {WASTE_GROUPS.map((g) => (
                  <th key={g.key} className="px-2.5 py-1.5 text-right">{g.label}</th>
                ))}
                <th className="px-2.5 py-1.5 text-right">รวม</th>
              </tr>
            </thead>
            <tbody>
              {summary.months.map((m) => (
                <tr key={m.key} className="border-b border-[#F1ECFB]">
                  <td className="px-2.5 py-1.5 font-semibold">{m.label}</td>
                  {WASTE_GROUPS.map((g) => (
                    <td key={g.key} className="px-2.5 py-1.5 text-right">
                      {m.groupTotals[g.key] ? formatKg(m.groupTotals[g.key]) : ''}
                    </td>
                  ))}
                  <td className="px-2.5 py-1.5 text-right font-bold">{formatKg(m.totalKg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* ── เส้นเทียบปีงบต่อปีงบ — ข้ามเมื่อปีก่อนไม่มีข้อมูล ── */}
      {prevSummary && prevSummary.recordedDays > 0 && (
        <div>
          <p className="text-[13px] font-bold text-[#57506A] mb-2">
            เทียบรายเดือน: ปีงบ {fiscalYear} กับ {fiscalYear - 1}
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={compareData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE9F8" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#E7E2F2' }} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
              <Tooltip formatter={(value, name) => [kgTip(value), name]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="current" name={`ปีงบ ${fiscalYear}`}
                stroke={YEAR_LINE_COLORS.current} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="previous" name={`ปีงบ ${fiscalYear - 1}`}
                stroke={YEAR_LINE_COLORS.previous} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── โดนัทสัดส่วน 8 กลุ่มทั้งปี ── */}
      <div>
        <p className="text-[13px] font-bold text-[#57506A] mb-2">สัดส่วนทั้งปีงบแยกกลุ่ม</p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <ResponsiveContainer width="100%" height={240} className="sm:max-w-[260px]">
            <PieChart>
              <Pie data={donutData} dataKey="value" nameKey="label"
                innerRadius={62} outerRadius={92} paddingAngle={1}
                stroke="#FFFFFF" strokeWidth={2}>
                {donutData.map((g) => (
                  <Cell key={g.key} fill={WASTE_GROUP_COLORS[g.key]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [kgTip(value), name]} />
            </PieChart>
          </ResponsiveContainer>
          {/* legend + ค่าตรง ๆ = direct label relief ของโดนัท */}
          <ul className="text-[12.5px] space-y-1.5 w-full sm:w-auto">
            {donutData.map((g) => (
              <li key={g.key} className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-[4px]"
                  style={{ background: WASTE_GROUP_COLORS[g.key] }} />
                <span className="text-[#57506A] flex-1">{g.label}</span>
                <span className="font-bold text-[#211B2E]">{formatKg(g.value)} กก.</span>
                <span className="text-[#8A8398] w-14 text-right">
                  {summary.totalKg ? `${((g.value / summary.totalKg) * 100).toFixed(1)}%` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ต่อเข้าหน้า**

ใน `pages/admin/smart-waste.jsx` — recharts หนัก โหลดแบบ dynamic เฉพาะตอนเปิดแท็บ:

```jsx
import dynamic from 'next/dynamic';
const SummaryDashboard = dynamic(
  () => import('@/components/smart-waste/admin/SummaryDashboard'),
  { ssr: false, loading: () => (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    ) }
);
```

แทน `<p ...>— แท็บสรุป (Task 7) —</p>` ด้วย:

```jsx
              <div className="space-y-3">
                <YearPills years={years} value={fiscalYear} onChange={setFiscalYear} />
                <SummaryDashboard fiscalYear={fiscalYear} refreshTick={refreshTick} />
              </div>
```

- [ ] **Step 3: ทดสอบมือ + commit**

Expected: ปีงบ 2568 เห็น StatCard รวม 245,509 กก. + การ์ด "เฉพาะถุงอ่อน" · ปีงบ 2569 เห็นเส้นเทียบ 2 ปี · ปุ่มดาวน์โหลดได้ไฟล์ .xlsx เปิดใน Excel/Sheets ได้ · ตาราง relief เปิด-ปิดได้ · เลือกปีงบที่ไม่มีข้อมูล (ถ้ามี) → empty state

```bash
git add components/smart-waste/admin/SummaryDashboard.jsx pages/admin/smart-waste.jsx
git commit -m "feat(smart-waste): เพิ่มแท็บสรุป — StatCard กราฟ 3 แบบ ตาราง relief และปุ่มดาวน์โหลด Excel"
```

---

### Task 8: `TypeManagerModal` — จัดการประเภทขยะ + แท็บนำเข้าไฟล์เก่า

**Files:**
- Create: `components/smart-waste/admin/TypeManagerModal.jsx`
- Modify: `pages/admin/smart-waste.jsx` (เปิด modal จากปุ่มเฟือง)

ตามสเปกข้อ 7.5 + 9: modal ในหน้าเดิม (ไม่แยกหน้า — เลี่ยง permission ที่ 2) · ตารางเรียง `order` · toggle isCommon/isHighlighted/active · แก้ label · เพิ่มประเภท (gen key จาก label — **label ไทย slug ได้ค่าว่าง ต้องให้กรอก key เอง**, ล็อกถาวรหลังบันทึก) · ปุ่มลบ disabled เมื่อ `usedDays > 0` · แท็บนำเข้า (superadmin เท่านั้น): dry-run ก่อนเสมอ → โชว์ผลตรวจ + วันที่จะถูกทับ → ยืนยัน → นำเข้าจริง

- [ ] **Step 1: เขียน TypeManagerModal**

```jsx
// components/smart-waste/admin/TypeManagerModal.jsx
import React, { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { WASTE_GROUPS, wasteGroupLabel } from '@/lib/smart-waste/wasteGroups';
import { chipCls, inputCls, labelCls, primaryBtnCls, ghostBtnCls, tableHeadCls, formatKg } from '../wasteTheme';

// สร้าง key เริ่มต้นจาก label — label ไทยล้วนจะได้ '' (ผู้ใช้ต้องตั้ง key อังกฤษเอง)
// กติกาเดียวกับ slugify ฝั่ง server ใน pages/api/smart-waste/types/index.js
function slugify(label) {
  return String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function patchType(id, body) {
  const res = await fetch(`/api/smart-waste/types/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).message || 'บันทึกไม่สำเร็จ');
}

export default function TypeManagerModal({ open, onClose, onChanged, isSuperAdmin }) {
  const [tab, setTab] = useState('types'); // 'types' | 'import'
  const [types, setTypes] = useState(null);
  // ฟอร์มเพิ่มประเภท — keyTouched: ผู้ใช้แก้ key เองแล้ว หยุด auto-gen จาก label
  const [form, setForm] = useState({ label: '', key: '', group: WASTE_GROUPS[0].key, keyTouched: false });
  // แท็บนำเข้า
  const [file, setFile] = useState(null);
  const [dryResult, setDryResult] = useState(null);
  const [importing, setImporting] = useState(false);

  const fetchTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/smart-waste/types?includeInactive=1');
      if (!res.ok) throw new Error((await res.json()).message || 'โหลดไม่สำเร็จ');
      setTypes((await res.json()).types);
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'โหลดประเภทขยะไม่สำเร็จ', text: error.message });
    }
  }, []);

  useEffect(() => {
    if (open) {
      setTab('types');
      setTypes(null);
      setDryResult(null);
      setFile(null);
      fetchTypes();
    }
  }, [open, fetchTypes]);

  if (!open) return null;

  const mutate = async (action) => {
    try {
      await action();
      await fetchTypes();
      onChanged();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: error.message });
    }
  };

  const handleToggle = (type, field) => mutate(() => patchType(type.id, { [field]: !type[field] }));

  const handleEditLabel = async (type) => {
    const { value, isConfirmed } = await Swal.fire({
      title: 'แก้ชื่อประเภท',
      input: 'text', inputValue: type.label,
      text: `key: ${type.key} (แก้ไม่ได้) · ชื่อใหม่มีผลย้อนหลังทุกรายงาน`,
      showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก',
      inputValidator: (v) => (!v?.trim() ? 'ชื่อว่างไม่ได้' : undefined),
    });
    if (isConfirmed) await mutate(() => patchType(type.id, { label: value.trim() }));
  };

  const handleDelete = async (type) => {
    const confirm = await Swal.fire({
      icon: 'warning', title: `ลบ "${type.label}"?`,
      text: 'ลบได้เฉพาะประเภทที่ไม่มีข้อมูลอ้างถึง — ลบแล้วกู้คืนไม่ได้',
      showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก',
    });
    if (!confirm.isConfirmed) return;
    await mutate(async () => {
      const res = await fetch(`/api/smart-waste/types/${type.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).message || 'ลบไม่สำเร็จ');
    });
  };

  const handleCreate = async () => {
    await mutate(async () => {
      const res = await fetch('/api/smart-waste/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: form.label, key: form.key, group: form.group }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'เพิ่มไม่สำเร็จ');
      setForm({ label: '', key: '', group: WASTE_GROUPS[0].key, keyTouched: false });
    });
  };

  // นำเข้า: dry-run ก่อนเสมอ → ผู้ใช้เห็นผลตรวจแล้วจึงยืนยันของจริง (สเปกข้อ 9)
  const postImport = async (dryRun) => {
    const body = new FormData();
    body.append('file', file);
    const res = await fetch(`/api/smart-waste/import${dryRun ? '?dryRun=1' : ''}`, {
      method: 'POST', body,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'นำเข้าไม่สำเร็จ');
    return json;
  };

  const handleDryRun = async () => {
    if (!file) return;
    setImporting(true);
    setDryResult(null);
    try {
      setDryResult(await postImport(true));
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'ตรวจไฟล์ไม่ผ่าน', text: error.message });
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await postImport(false);
      setDryResult(null);
      setFile(null);
      onChanged();
      Swal.fire({
        icon: 'success', title: `นำเข้าปีงบ ${result.fiscalYear} สำเร็จ`,
        text: `เพิ่มใหม่ ${result.inserted} วัน · อัปเดต ${result.updated} วัน · ทับข้อมูลเดิม ${result.overwritten} วัน`,
      });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'นำเข้าไม่สำเร็จ', text: error.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-3xl max-h-[90vh] bg-white rounded-t-[24px]
        sm:rounded-[24px] flex flex-col">
        <div className="flex items-center justify-between p-4 pb-3 border-b border-[#E7E2F2]">
          <p className="text-[15px] font-bold text-[#211B2E]">⚙️ จัดการประเภทขยะ</p>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <>
                <button type="button" className={chipCls(tab === 'types')} onClick={() => setTab('types')}>ประเภท</button>
                <button type="button" className={chipCls(tab === 'import')} onClick={() => setTab('import')}>นำเข้าข้อมูลเก่า</button>
              </>
            )}
            <button type="button" onClick={onClose} aria-label="ปิด"
              className="grid h-8 w-8 place-items-center rounded-full text-[#8A8398] hover:bg-[#F1ECFB]">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'types' ? (
            !types ? (
              <div className="flex justify-center py-12">
                <span className="loading loading-spinner loading-lg text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto border border-[#E7E2F2] rounded-[16px]">
                  <table className="text-[12.5px] min-w-full whitespace-nowrap">
                    <thead>
                      <tr className={tableHeadCls}>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">ประเภท</th>
                        <th className="px-3 py-2 text-left">กลุ่ม</th>
                        <th className="px-3 py-2 text-center" title="เด้งขึ้นหน้าแรกของฟอร์ม">กรอกบ่อย</th>
                        <th className="px-3 py-2 text-center" title="StatCard + แถวเฉพาะใน Excel">สนใจพิเศษ</th>
                        <th className="px-3 py-2 text-center">ใช้งาน</th>
                        <th className="px-3 py-2 text-right">มีข้อมูล (วัน)</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {types.map((type) => (
                        <tr key={type.id} className={'border-b border-[#F1ECFB] ' + (type.active ? '' : 'opacity-50')}>
                          <td className="px-3 py-2 text-[#8A8398]">{type.order}</td>
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => handleEditLabel(type)}
                              className="font-semibold text-[#211B2E] hover:text-[#7C3AED]"
                              title={`key: ${type.key} · คลิกเพื่อแก้ชื่อ`}>
                              {type.label} ✏️
                            </button>
                          </td>
                          <td className="px-3 py-2 text-[#57506A]">{wasteGroupLabel(type.group)}</td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" className="checkbox checkbox-sm checkbox-primary"
                              checked={type.isCommon} onChange={() => handleToggle(type, 'isCommon')} />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" className="checkbox checkbox-sm checkbox-primary"
                              checked={type.isHighlighted} onChange={() => handleToggle(type, 'isHighlighted')} />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" className="toggle toggle-sm toggle-primary"
                              checked={type.active} onChange={() => handleToggle(type, 'active')} />
                          </td>
                          <td className="px-3 py-2 text-right">{type.usedDays ? formatKg(type.usedDays) : '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <button type="button" onClick={() => handleDelete(type)}
                              disabled={type.usedDays > 0}
                              title={type.usedDays > 0 ? 'มีข้อมูลใช้งานอยู่ ปิดใช้งานแทนได้' : 'ลบประเภทนี้'}
                              className="text-[#e34948] disabled:text-[#D9D4E4] disabled:cursor-not-allowed">
                              🗑
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── เพิ่มประเภทใหม่ — key ล็อกถาวรหลังบันทึก (สเปกข้อ 7.5) ── */}
                <div className="border border-dashed border-[#C9BCE8] rounded-[16px] p-4 space-y-3">
                  <p className="text-[13px] font-bold text-[#57506A]">+ เพิ่มประเภทใหม่</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>ชื่อประเภท (ไทย)</label>
                      <input value={form.label} className={inputCls} placeholder="เช่น ทองแดง"
                        onChange={(e) => setForm((f) => ({
                          ...f, label: e.target.value,
                          key: f.keyTouched ? f.key : slugify(e.target.value),
                        }))} />
                    </div>
                    <div>
                      <label className={labelCls}>key (a-z, 0-9, _ — ล็อกถาวรหลังบันทึก)</label>
                      <input value={form.key} className={inputCls} placeholder="เช่น copper"
                        onChange={(e) => setForm((f) => ({ ...f, key: e.target.value, keyTouched: true }))} />
                    </div>
                    <div>
                      <label className={labelCls}>กลุ่มรายงาน</label>
                      <select value={form.group} className={inputCls}
                        onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}>
                        {WASTE_GROUPS.map((g) => (
                          <option key={g.key} value={g.key}>{g.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button type="button" onClick={handleCreate}
                    disabled={!form.label.trim() || !/^[a-z][a-z0-9_]*$/.test(form.key)}
                    className={primaryBtnCls + ' !py-2.5'}>
                    เพิ่มประเภท
                  </button>
                </div>
              </div>
            )
          ) : (
            /* ── แท็บนำเข้าข้อมูลเก่า (superadmin) — สเปกข้อ 9 ── */
            <div className="space-y-4 max-w-lg">
              <p className="text-[12.5px] text-[#57506A] leading-relaxed">
                อัปโหลดไฟล์ Excel รายปีงบ (รูปแบบเดิมของกองสาธารณสุข) — ระบบอ่านปีงบจากชื่อชีตเอง
                ตรวจยอดกับแถว "รวม" ทุกเดือนก่อน ไม่ตรง = ไม่บันทึกเลยทั้งไฟล์ · อัปโหลดซ้ำได้ (ทับตามวันที่)
              </p>
              <input type="file" accept=".xlsx" className="file-input file-input-bordered w-full"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setDryResult(null); }} />
              <button type="button" onClick={handleDryRun} disabled={!file || importing}
                className={ghostBtnCls + ' !py-2.5'}>
                {importing && !dryResult ? 'กำลังตรวจ…' : '1) ตรวจไฟล์ก่อน (ยังไม่บันทึก)'}
              </button>

              {dryResult && (
                <div className="border border-[#E7E2F2] rounded-[16px] p-4 space-y-2 text-[12.5px]">
                  <p className="font-bold text-[#15803D]">✓ ยอดตรงกับแถว "รวม" ของไฟล์ทุกเดือน</p>
                  <p>ปีงบ <b>{dryResult.fiscalYear}</b> · รวม <b>{formatKg(dryResult.verification.totalKg)} กก.</b></p>
                  <p>วันที่มีข้อมูลในระบบแล้ว {dryResult.existingDays} วัน
                    · จะถูกทับด้วยยอดใหม่ {dryResult.willOverwrite.length} วัน</p>
                  {dryResult.willOverwrite.length > 0 && (
                    <ul className="text-[#B45309] max-h-32 overflow-y-auto list-disc pl-5">
                      {dryResult.willOverwrite.map((row) => (
                        <li key={row.recordDate}>
                          {row.recordDate}: {formatKg(row.from)} → {formatKg(row.to)} กก.
                        </li>
                      ))}
                    </ul>
                  )}
                  <button type="button" onClick={handleImport} disabled={importing}
                    className={primaryBtnCls + ' !py-2.5 mt-2'}>
                    {importing ? 'กำลังนำเข้า…' : '2) ยืนยันนำเข้าจริง'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ต่อเข้าหน้า**

ใน `pages/admin/smart-waste.jsx`:

```jsx
import TypeManagerModal from '@/components/smart-waste/admin/TypeManagerModal';
```

วางไว้ก่อนปิด `</PermissionGuard>` (นอก card):

```jsx
        <TypeManagerModal open={managerOpen} onClose={() => setManagerOpen(false)}
          isSuperAdmin={isSuperAdmin}
          onChanged={() => { fetchTypes(); setRefreshTick((t) => t + 1); }} />
```

- [ ] **Step 3: ทดสอบมือ + commit**

Expected: เฟืองเปิด modal เห็น 24 ประเภทเรียงตาม order · toggle แล้วรีเฟรชคงค่า · ประเภทที่มีข้อมูล ปุ่มลบ disabled + tooltip · เพิ่มประเภท label ไทย → ช่อง key ว่าง ปุ่ม disabled จนกรอก key อังกฤษ · superadmin เห็นแท็บนำเข้า / admin ธรรมดาไม่เห็น · dry-run ไฟล์จริง → ยอด 245,509 หรือ 42,196 กก.

```bash
git add components/smart-waste/admin/TypeManagerModal.jsx pages/admin/smart-waste.jsx
git commit -m "feat(smart-waste): เพิ่ม modal จัดการประเภทขยะ + แท็บนำเข้าไฟล์เก่าแบบ dry-run ก่อนเสมอ"
```

---

### Task 9: ลงทะเบียนสิทธิ์ครบ 4 จุด (จุด 1–3 + อัปเดตคอมเมนต์ _auth)

**Files:**
- Modify: `lib/permissions.ts:75-80` (`ALL_PAGES`) และ `:211` (`DEFAULT_PERMISSIONS.admin`)
- Modify: `components/LayoutAdmin.tsx:36-37` (`navigationItems`)
- Modify: `pages/api/smart-waste/_auth.js:67-70` (คอมเมนต์อ้าง "แผนที่ 2" หมดอายุ)

- [ ] **Step 1: `ALL_PAGES` — เพิ่มต่อจาก entry `/admin/smart-light`**

```ts
  {
    path: '/admin/smart-waste',
    label: 'smart-waste (ขยะรีไซเคิล)',
    icon: '♻️',
    description: 'บันทึกน้ำหนักขยะรีไซเคิลและขยะเปียกรายวัน (กองสาธารณสุข)',
    category: 'management'
  },
```

- [ ] **Step 2: `DEFAULT_PERMISSIONS.admin` — เพิ่ม `'/admin/smart-waste',` ต่อจาก `'/admin/smart-light',`**

(ตั้งใจให้เป็นชุดพื้นฐาน — เจ้าหน้าที่กรอกข้อมูลรายวันหลายคน แบบเดียวกับ smart-light
และคอมเมนต์ใน `_auth.js` ระบุไว้แล้วว่าจะเพิ่มในแผนที่ 2 · preset ผู้บริหารได้อัตโนมัติ
เพราะ category เป็น management)

- [ ] **Step 3: `navigationItems` ใน LayoutAdmin — เพิ่มต่อจากแถว `เสาไฟสาธารณะ`**

```ts
  { label: 'Smart Waste (ขยะ)',  href: '/admin/smart-waste',               icon: '♻️', group: 'จัดการ' },
```

- [ ] **Step 4: อัปเดตคอมเมนต์ใน `pages/api/smart-waste/_auth.js`**

คอมเมนต์เดิมบอกว่า `/admin/smart-waste ยังไม่อยู่ใน DEFAULT_PERMISSIONS (จะเพิ่มในแผนที่ 2)` — ตอนนี้เพิ่มแล้ว แก้ย่อหน้านั้นเป็น:

```js
  // ⚠️ ห้ามเขียนเงื่อนไข "allowedPages ว่าง = ผ่าน" เองที่นี่:
  // ให้ hasPermission ตัดสินจาก DEFAULT_PERMISSIONS ที่เดียว — เขียนเองเมื่อไร
  // API จะหลวมกว่า UI ทันทีที่นโยบายชุดพื้นฐานเปลี่ยน
```

- [ ] **Step 5: ทดสอบมือ**

Run: dev server → login superadmin
Expected: เมนู "Smart Waste (ขยะ)" ♻️ โผล่ในกลุ่ม "จัดการ" ของ sidebar · หน้า `/admin/superadmin` (permission UI) มีหน้า smart-waste ให้ติ๊ก

- [ ] **Step 6: Commit**

```bash
git add lib/permissions.ts components/LayoutAdmin.tsx pages/api/smart-waste/_auth.js
git commit -m "feat(smart-waste): ลงทะเบียนสิทธิ์หน้า /admin/smart-waste ครบ ALL_PAGES + default + เมนู sidebar"
```

---

### Task 10: จุดที่ 4 — migration สิทธิ์ user เดิม

**Files:**
- Create: `scripts/grant-smart-waste-permission.js`

user ที่มี custom `allowedPages` (ไม่ว่าง) จะไม่เห็นหน้าใหม่จนกว่าจะถูกเพิ่มสิทธิ์ — ลอกโครงจาก `scripts/grant-smart-light-permission.js` (CommonJS + `--yes` ยืนยันก่อนเขียนจริง)

- [ ] **Step 1: เขียน script**

```js
// One-time migration: ให้สิทธิ์หน้า Smart Waste กับ user เดิมที่มี custom allowedPages
//
// ทำไมต้องรัน: user ที่ถูกกำหนด allowedPages เอง (ไม่ว่าง) จะไม่เห็นหน้าใหม่
// จนกว่าจะถูกเพิ่มสิทธิ์ (user ที่ allowedPages ว่างใช้ DEFAULT_PERMISSIONS ซึ่งอัปเดตแล้ว)
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/grant-smart-waste-permission.js            (dry-run: แสดงรายชื่อ)
//   node --env-file=.env.local scripts/grant-smart-waste-permission.js --yes      (เพิ่มสิทธิ์จริง)
//
// รันซ้ำได้ (idempotent) — ใช้ $addToSet
// ถ้าต้องการให้เฉพาะบางคน: ไม่ต้องรัน script — ให้ superadmin ติ๊กรายคนที่ /admin/superadmin

const mongoose = require("mongoose");

const NEW_PAGE = "/admin/smart-waste";

async function main() {
  const confirmed = process.argv.includes("--yes");
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local");
  }
  await mongoose.connect(process.env.MONGO_URI);

  const User =
    mongoose.models.User ||
    mongoose.model(
      "User",
      new mongoose.Schema(
        {
          name: String,
          clerkId: String,
          role: String,
          allowedPages: { type: [String], default: [] },
        },
        { strict: false }
      ),
      "users"
    );

  // เป้าหมาย: user ที่มี custom allowedPages (ไม่ว่าง) และยังไม่มีหน้า smart-waste
  const filter = {
    "allowedPages.0": { $exists: true },
    allowedPages: { $ne: NEW_PAGE },
  };
  const targets = await User.find(filter)
    .select("name clerkId role allowedPages")
    .lean();

  console.log(`พบ user ที่ต้องเพิ่มสิทธิ์ ${targets.length} ราย`);
  console.table(
    targets.map((u) => ({
      name: u.name,
      clerkId: u.clerkId,
      role: u.role,
      pages: (u.allowedPages || []).length,
    }))
  );

  if (!confirmed) {
    console.log("โหมดแสดงรายชื่อ — ตรวจรายชื่อแล้วรันซ้ำพร้อม --yes เพื่อเพิ่มสิทธิ์จริง");
  } else {
    const res = await User.updateMany(filter, {
      $addToSet: { allowedPages: NEW_PAGE },
    });
    console.log(`อัปเดตแล้ว: ${res.modifiedCount} ราย`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: dry-run กับฐานจริง**

Run: `node --env-file=.env.local scripts/grant-smart-waste-permission.js`
Expected: แสดงตารางรายชื่อ ไม่แก้ข้อมูล — **อย่ารัน `--yes` ใน task นี้** ให้ผู้ใช้ตัดสินใจตอนปิดงาน (บางคนอาจไม่ควรเห็นหน้ากรอกข้อมูลกองสาธารณสุข — superadmin ติ๊กรายคนได้เช่นกัน)

- [ ] **Step 3: Commit**

```bash
git add scripts/grant-smart-waste-permission.js
git commit -m "feat(smart-waste): เพิ่ม migration script ให้สิทธิ์หน้า smart-waste กับ user ที่มี custom allowedPages"
```

---

### Task 11: เอกสาร — `docs/modules/smart-waste.md` + ดัชนี + CLAUDE.md

**Files:**
- Create: `docs/modules/smart-waste.md`
- Modify: `docs/modules/README.md:11-12` (เพิ่มแถวตาราง)
- Modify: `CLAUDE.md` (bullet ใหม่ในหัวข้อ Feature modules)

- [ ] **Step 1: เขียน docs/modules/smart-waste.md**

```markdown
# Smart Waste — ขยะรีไซเคิลและขยะเปียก (กองสาธารณสุข)

บันทึกน้ำหนักขยะที่คัดแยกได้ **รายวัน วันละ 1 ชุดรวมทั้งเทศบาล หน่วยเป็นกิโลกรัม**
แทนไฟล์ Excel รายปีงบเดิม · สเปกเต็ม: `docs/superpowers/specs/2026-08-11-smart-waste-design.md`

## โครงสร้าง

| ชั้น | ไฟล์ |
|---|---|
| หน้า | `pages/admin/smart-waste.jsx` — หน้าเดียว 3 แท็บ (บันทึก · ข้อมูล · สรุป) + modal จัดการประเภท |
| API | `pages/api/smart-waste/` — `_auth.js` (requireWasteAdmin/Superadmin) · `types/` · `daily/` · `summary` · `export` · `import` |
| Components | `components/smart-waste/` — `wasteTheme.jsx` · `entry/` (DailyEntryForm, TypePickerSheet, TotalBar) · `admin/` (MonthTable, SummaryDashboard, TypeManagerModal) |
| Logic | `lib/smart-waste/` — wasteGroups (8 กลุ่ม fixed) · wasteTypesSeed (24 ประเภท) · fiscalYear · aggregate (computeTotals ที่เดียว) · importWorkbook · exportWorkbook · uiDate · เทสต์ vitest ใน `__tests__/` |
| Models | `models/smart-waste/WasteType.js` (`smart_waste_types`) · `WasteDaily.js` (`smart_waste_daily` — 1 doc = 1 วัน, unique `recordDate` แบบ 'YYYY-MM-DD') |

## กติกาสำคัญ

- **ปีงบประมาณ** ต.ค.–ก.ย. นับเป็น พ.ศ. (`fiscalYearOf('2025-10-01') === 2569`) — logic อยู่
  `lib/smart-waste/fiscalYear.js` ที่เดียว
- ยอดรวม (`groupTotals`/`totalKg`) denormalize ตอนบันทึก คำนวณด้วย `computeTotals()`
  ที่เดียว 3 จุดใช้ร่วม (API daily / import / export) — **ห้ามเชื่อ totals จาก client**
- 8 กลุ่มใหญ่ fixed ในโค้ด (หัวข้อรายงานส่งหน่วยงานภายนอก) · 24 ประเภทย่อยเป็น master data
  แอดมินแก้ได้ผ่าน modal ในหน้า (ไม่มีหน้าแยก — ไม่มี permission entry ที่ 2)
- ประเภทลบได้เฉพาะเมื่อไม่มีข้อมูลอ้างถึง (API ตอบ 409) — ปิดใช้งาน (`active: false`) แทน
- ธง `isHighlighted` (เริ่มต้น = ถุงอ่อน): StatCard ของตัวเอง + แถว `เฉพาะ<label>` ใน Excel export
- **นำเข้าไฟล์เก่า** ผ่าน `POST /api/smart-waste/import` (superadmin + dry-run ก่อนเสมอ)
  — ยอดอ้างอิง: ปีงบ 2568 = 245,509 กก. · ปีงบ 2569 (ถึง ธ.ค.68) = 42,196 กก.
- แก้ไขย้อนหลัง/ล้างวัน/นำเข้า เขียน `AuditLog` (`action: waste_daily_updated`) ฝั่ง server แล้ว

## ธีมและกราฟ

- Token ยืมจาก smart-school ผ่าน `components/smart-waste/wasteTheme.jsx` — **ห้าม import
  จาก `components/smart-school/` ตรง ๆ ในไฟล์อื่นของโมดูลนี้** · ถ้ามีโมดูลที่ 3 มายืมอีก
  ให้สกัดเป็น `components/ui/adminTheme` (กติกาข้อ 4 ของ skill adding-feature-module)
- สีกราฟ 8 กลุ่มใน `WASTE_GROUP_COLORS` ผ่าน dataviz validator แล้ว (ลำดับคงที่ตาม
  `WASTE_GROUPS`) — เปลี่ยนสีต้องรัน validator ใหม่ และแท็บสรุปต้องคงตารางรายเดือน
  (relief ของ 3 สีที่ contrast < 3:1)

## สิทธิ์

`/admin/smart-waste` อยู่ใน `ALL_PAGES` + `DEFAULT_PERMISSIONS.admin` (ชุดพื้นฐาน) +
เมนู sidebar · user เดิมที่มี custom `allowedPages`: รัน
`node --env-file=.env.local scripts/grant-smart-waste-permission.js` (dry-run ก่อน, `--yes` เขียนจริง)
หรือให้ superadmin ติ๊กรายคน · API ตรวจซ้ำฝั่ง server ทุกเส้นด้วย `requireWasteAdmin`
```

- [ ] **Step 2: เพิ่มแถวใน `docs/modules/README.md`** (ตารางดัชนี ต่อจากแถว Smart Papar)

```markdown
| Smart Waste (ขยะรีไซเคิล) | [smart-waste.md](smart-waste.md) | `/admin/smart-waste` |
```

- [ ] **Step 3: เพิ่ม bullet ใน `CLAUDE.md`** หัวข้อ "Feature modules" ต่อจาก bullet Smart Light:

```markdown
- **Smart Waste / ขยะรีไซเคิลและขยะเปียก (กองสาธารณสุข)** — โมดูล `smart-waste`: บันทึกน้ำหนักคัดแยกรายวัน (กก.) ตามปีงบประมาณ ต.ค.–ก.ย., หน้าเดียว `/admin/smart-waste` 3 แท็บ + modal จัดการประเภท, models `models/smart-waste/` (`WasteType` 24 ประเภท → 8 กลุ่ม fixed, `WasteDaily` 1 doc = 1 วัน `recordDate` string), API `pages/api/smart-waste/*` (ยอดคำนวณฝั่ง server ด้วย `computeTotals()` เสมอ), นำเข้า Excel เก่าผ่าน `POST /api/smart-waste/import` (superadmin + dryRun), export Excel รูปแบบเดิมที่ `GET /api/smart-waste/export?fiscalYear=` — logic ล้วนมีเทสต์ vitest ใน `lib/smart-waste/__tests__/`
```

- [ ] **Step 4: Commit**

```bash
git add docs/modules/smart-waste.md docs/modules/README.md CLAUDE.md
git commit -m "docs: เพิ่มเอกสารโมดูล smart-waste + ดัชนี + CLAUDE.md"
```

---

### Task 12: Verification ปิดแผน

- [ ] **Step 1: รันตรวจครบชุด**

```bash
npm test && npm run lint && npm run build
```

Expected: เทสต์ผ่านทุกไฟล์ (รวม uiDate ใหม่) · lint ไม่มี error (มี warning เดิมของ repo ได้) · build ผ่าน

- [ ] **Step 2: ทดสอบมือรอบสุดท้าย (checklist)**

Run: `npm run dev` แล้วไล่ตามนี้ — ทุกข้อต้องผ่านก่อนถือว่าเสร็จ:

1. superadmin: เมนู ♻️ ขึ้น sidebar กลุ่ม "จัดการ" · เข้าหน้าได้ทั้ง 3 แท็บ
2. แท็บบันทึก (เปิดจอแคบ/มือถือจริง): กรอก 2-3 ช่อง → ยอด sticky ตรง → บันทึก → toast → วันเลื่อนถูก · เปิดวันที่มีข้อมูล → badge "กำลังแก้ไข" + ค่าเดิมเติมมา
3. draft: กรอกเลขแล้ว refresh หน้า (ไม่บันทึก) → เปิดวันเดิม เห็น toast กู้ draft + ค่ายังอยู่ · บันทึกสำเร็จแล้ว refresh → ไม่มี draft ค้าง
4. กรอก 1500 ในช่องเดียว → dialog "ตัวเลขสูงผิดปกติ" · ยกเลิกแล้วค่าไม่หาย
5. ลบตัวเลขทุกช่องของวันที่มีข้อมูล → กดบันทึก → dialog ยืนยันล้างข้อมูล
6. แท็บข้อมูล: เดือน ต.ค.68 ปีงบ 2569 — แถวรวมท้ายตารางตรงกับชีต `ต.ค.68` ในไฟล์เดิม (18,396 กก.) · คลิกแถว → เด้งไปแท็บบันทึกวันนั้น
7. แท็บสรุป: ปีงบ 2568 การ์ดรวม = 245,509 กก. + การ์ด "เฉพาะถุงอ่อน" · ปีงบ 2569 มีเส้นเทียบ 2 ปี · ดาวน์โหลด Excel เปิดได้ 14 ชีต
8. modal ประเภท: toggle ค้างได้จริงหลังปิด-เปิดใหม่ · ลบประเภทที่มีข้อมูล disabled · admin ธรรมดา (ถ้ามี user ทดสอบ) ไม่เห็นแท็บนำเข้า
9. audit: แก้ตัวเลขวันเก่า 1 ครั้ง → `/admin/superadmin/audit-log` มีรายการ `waste_daily_updated`

- [ ] **Step 3: Commit สุดท้าย (ถ้ามีของแก้จากการทดสอบ) แล้วสรุปงาน**

หลังผ่านครบ: ใช้ skill `superpowers:finishing-a-development-branch` เพื่อเลือกวิธีปิด branch
(PR `feat/smart-waste` → `main` — จำไว้ว่า **merge เข้า main = deploy production ทันที** (Railway)
และก่อน merge ต้องเตือนผู้ใช้เรื่องการรัน `grant-smart-waste-permission.js --yes` หลัง deploy
ถ้าต้องการให้ user ที่มี custom allowedPages เห็นเมนู)

---

## Self-review notes (ตรวจแล้วตอนเขียนแผน)

- สเปกข้อ 7.1–7.5 ครบ: 3 แท็บ (Task 5–7) · เฟือง+modal (Task 8) · isCommon ก่อน + bottom sheet + sticky total + draft + badge แก้ไข (Task 4) · card/table ต่อ mobile/desktop + แถวรวมเดือน (Task 6) · StatCard + isHighlighted + กราฟ 3 แบบ + export (Task 7) · เพิ่มประเภท gen key + ล็อกหลังบันทึก + ลบ disabled (Task 8)
- สเปกข้อ 10 ครบ 4 จุด: ALL_PAGES + DEFAULT_PERMISSIONS (Task 9) · navigationItems (Task 9) · grant script (Task 10) — ไม่มีการเขียน `startsWith` เช็คสิทธิ์เองที่ไหน (ฝั่ง client ใช้ PermissionGuard/hasPermission เดิม)
- สเปกข้อ 11 ครบ: โหลดวันเดิม+badge · draft คงอยู่เมื่อ save fail · เตือน >1,000 · ประเภท inactive ยังโชว์ในตาราง (page ส่ง includeInactive ให้ MonthTable, ฟอร์มกรอง active เอง — สอดคล้อง API ที่ยอมแก้วันเก่าที่มีประเภท inactive) · ลบประเภทโดน 409 → ปุ่ม disabled · ปี/เดือนว่าง empty state · export ปีว่างได้ไฟล์โครง
- จุดที่ตั้งใจ "ไม่ทำ": ไม่มีเทสต์ React (repo ไม่มี infra — logic ล้วนแยกไป uiDate.js + เทสต์แล้ว) · ไม่แตะ n8n/LINE (นอกขอบเขตสเปกข้อ 3)
- Type consistency ตรวจแล้ว: ชื่อ export ของ wasteTheme ตรงกับที่ทุก component import · props `refreshTick/onEditDate/fiscalYear` ตรงกันระหว่าง page ↔ MonthTable/SummaryDashboard · `formatKg`, `draftKey`, `nextEntryDate` นิยามใน Task 1–2 ก่อนถูกใช้ Task 3+
