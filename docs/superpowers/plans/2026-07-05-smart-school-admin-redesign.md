# Smart School Admin Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปรับหน้า admin ของโมดูล smart-school ให้เป็นธีมม่วง-ครีมตาม `design_handoff_smart_school/` โดย retheme โครง 4 แท็บเดิม ไม่แตะ API/models

**Architecture:** สร้าง `adminTheme.jsx` เป็น helper กลาง (import สี/ฟอนต์/input/chip/ปุ่ม จาก `surveyTheme.jsx` ที่มีอยู่ → source of truth เดียว) แล้วทยอย restyle component เดิม 7 ตัว เป็น 3 เฟส งานเป็น presentation-only: **คงลอจิก/props/handler/state เดิมทุกตัว เปลี่ยนเฉพาะ className/JSX โครงสร้างการแสดงผล**

**Tech Stack:** Next.js 15 Pages Router, React 19, Tailwind v4 + DaisyUI (arbitrary hex values), SweetAlert2. **ไม่มี test runner** → verify ทุก task ด้วย `npm run lint` (expect "✔ No ESLint warnings or errors") + `npm run build` (expect exit 0, "Compiled successfully") + ตาดู dev server ที่รันอยู่ (`http://localhost:3000/admin/smart-school`, ต้องล็อกอิน Clerk)

**Spec:** `docs/superpowers/specs/2026-07-05-smart-school-admin-redesign-design.md`

---

## File Structure

| ไฟล์ | ความรับผิดชอบ | เฟส |
|---|---|---|
| `components/smart-school/adminTheme.jsx` (ใหม่) | โทเคน/ helper การแสดงผล admin (cardCls, StatCard, PillTabs, DashboardHeader, statusBadgeCls) — reuse จาก surveyTheme | 1 |
| `components/smart-school/admin/SmartSchoolDashboard.jsx` | shell: หัว + pill tabs + การ์ดสถิติ + ปีงบ (restyle in place) | 1 |
| `components/smart-school/admin/ApplicationTable.jsx` | ตัวกรอง chip + ค้นหา + ตาราง (restyle) | 1 |
| `components/smart-school/admin/ApplicationDetailModal.jsx` | modal ดู หัวม่วง + กลุ่มหัวข้อ | 1 |
| `components/smart-school/admin/ApplicationEditModal.jsx` | modal แก้ไข หัวเข้ม + chip สถานะ | 1 |
| `components/smart-school/admin/AllocationBoard.jsx` | คงตารางลำดับ + การ์ดโควตา progress + ธีม | 2 |
| `components/smart-school/admin/MapPoints.js` | สีหมุดตามสถานะ + panel/legend + กรอบธีม | 3 |
| `components/smart-school/admin/BlockedSchoolsPanel.jsx` | คงการจัดการ blocklist + ธีม | 3 |

**หลักการร่วมทุก task:** อ่านไฟล์เดิมก่อน · เปลี่ยนเฉพาะชั้น presentation · ห้ามแตะ fetch/handler/props/สัญญากับ API · import helper จาก `@/components/smart-school/adminTheme`

---

## Task 1: adminTheme.jsx (ฐานธีม admin)

**Files:**
- Create: `components/smart-school/adminTheme.jsx`

- [ ] **Step 1: สร้างไฟล์ด้วยโค้ดเต็ม**

```jsx
import React from 'react';
import {
  FONT_DISPLAY, FONT_BODY,
  inputCls, labelCls, chipCls,
  primaryBtnCls, ghostBtnCls, successBtnCls,
} from './survey/surveyTheme';

// re-export โทเคนร่วมจาก surveyTheme เพื่อให้ admin import ที่เดียว
export { FONT_DISPLAY, FONT_BODY, inputCls, labelCls, chipCls, primaryBtnCls, ghostBtnCls, successBtnCls };

// การ์ด shell ของ dashboard/แผง (radius 24 + เงานุ่ม)
export const cardCls =
  'bg-[#FAF8FF] border border-[#E7E2F2] rounded-[24px] shadow-[0_20px_50px_-30px_rgba(33,27,46,0.4)]';

// หัวตาราง/แถวโฮเวอร์
export const tableHeadCls = 'bg-[#F6F3FD] text-[12px] font-bold text-[#57506A]';

// สีสถานะใบสมัคร 4 ค่า → คลาส badge
const STATUS_BADGE = {
  'รับคำร้อง': 'bg-[#EDE7FD] text-[#6D28D9]',
  'ตรวจสอบแล้ว': 'bg-[#DDD2FB] text-[#6D28D9]',
  'ได้รับทุน': 'bg-[#DCFCE7] text-[#15803D]',
  'ไม่ผ่านเกณฑ์': 'bg-[#F1F1F4] text-[#6B7280]',
};
export function statusBadgeCls(status) {
  return (
    'inline-block text-[11.5px] font-semibold px-2.5 py-1 rounded-full ' +
    (STATUS_BADGE[status] || 'bg-[#F1F1F4] text-[#6B7280]')
  );
}

// การ์ดสถิติ — tone: 'purple' (เต็ม) | 'green' | 'gray' | 'deep' | 'default'
export function StatCard({ value, label, tone = 'default' }) {
  const filled = tone === 'purple';
  const valueColor = { green: '#16A34A', gray: '#9CA3AF', deep: '#6D28D9' }[tone];
  return (
    <div className={'rounded-[18px] p-4 ' + (filled ? 'bg-[#7C3AED] text-white' : 'bg-white border border-[#E7E2F2]')}>
      <div className="text-[30px] font-bold leading-none"
        style={{ fontFamily: FONT_DISPLAY, color: filled ? undefined : valueColor }}>
        {value}
      </div>
      <div className={'text-[12px] mt-1.5 ' + (filled ? 'text-white/85' : 'text-[#8A8398]')}>{label}</div>
    </div>
  );
}

// แถบแท็บ pill — tabs: [{key,label}]
export function PillTabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 bg-[#F1ECFB] p-1.5 rounded-[14px] w-fit">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button key={t.key} type="button" onClick={() => onChange(t.key)}
            className={'text-[13px] px-4 py-2 rounded-[10px] font-semibold transition ' +
              (on ? 'bg-white text-[#7C3AED] shadow-[0_2px_6px_-2px_rgba(124,58,237,0.3)]' : 'text-[#8A8398] hover:text-[#6D28D9]')}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// pill ปีงบ — years: number[], value: number, onChange(y)
export function YearPills({ years, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-[#8A8398]">ปีงบ:</span>
      {years.map((y) => (
        <button key={y} type="button" onClick={() => onChange(y)}
          className={'text-[13px] px-4 py-1.5 rounded-full font-semibold transition ' +
            (y === value ? 'bg-[#7C3AED] text-white' : 'bg-white border border-[#E7E2F2] text-[#57506A] hover:border-[#7C3AED]')}>
          {y}
        </button>
      ))}
    </div>
  );
}

// หัว dashboard — right = node (เช่น <YearPills/>)
export function DashboardHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-center gap-3.5 mb-5">
      <span className="w-11 h-11 rounded-[14px] bg-[#7C3AED] text-white grid place-items-center text-[22px]"
        style={{ fontFamily: FONT_DISPLAY }}>📚</span>
      <div>
        <div className="text-[19px] font-bold" style={{ fontFamily: FONT_DISPLAY }}>{title}</div>
        {subtitle && <div className="text-[12px] text-[#8A8398]">{subtitle}</div>}
      </div>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}
```

- [ ] **Step 2: verify import path**

Run: `node -e "const fs=require('fs'); const s=fs.readFileSync('components/smart-school/survey/surveyTheme.jsx','utf8'); ['FONT_DISPLAY','FONT_BODY','inputCls','labelCls','chipCls','primaryBtnCls','ghostBtnCls','successBtnCls'].forEach(n=>{ if(!s.includes('export const '+n) && !s.includes('export function '+n)) throw new Error('missing '+n); }); console.log('all exports present');"`
Expected: `all exports present`

- [ ] **Step 3: lint + build**

Run: `npm run lint && npm run build`
Expected: lint "✔ No ESLint warnings or errors"; build exit 0. (ไฟล์ยังไม่ถูก import ที่ไหน — แค่ต้องคอมไพล์ผ่าน)

- [ ] **Step 4: Commit**

```bash
git add components/smart-school/adminTheme.jsx
git commit -m "feat(smart-school): adminTheme.jsx โทเคน/ helper ธีมม่วง admin (reuse surveyTheme)"
```

---

## Task 2: Dashboard shell + การ์ดสถิติ (SmartSchoolDashboard.jsx)

**Files:**
- Modify: `components/smart-school/admin/SmartSchoolDashboard.jsx`

**บริบท (อ่านก่อน):** ไฟล์นี้ fetch `list.js` → `data = { year, years, applications, stats }`. มี `yearTabs` (ปุ่มปีงบ ~บรรทัด 85), การ์ดสถิติ 6 ใบ (~105–113: `[['ทั้งหมด',stats.total],['รายเก่า',stats.renewals],['รับคำร้อง',...],['ตรวจสอบแล้ว',...],['ได้รับทุน',...],['ไม่ผ่านเกณฑ์',...]]`), แถบปุ่ม `join` 4 view (`table|map|blocked|allocation`), และ render `<ApplicationTable/> <AllocationBoard/> <BlockedSchoolsPanel/> <MapPoints/>`. **คง state/fetch/handler เดิมทั้งหมด**

- [ ] **Step 1: import helper**

เพิ่มบนสุด:
```jsx
import { DashboardHeader, YearPills, PillTabs, StatCard, cardCls } from '@/components/smart-school/adminTheme';
```

- [ ] **Step 2: แทนหัว + ปีงบ ด้วย DashboardHeader + YearPills**

แทนบล็อกหัว/ปุ่มปีงบเดิม (yearTabs map) ด้วย:
```jsx
<DashboardHeader
  title="Smart School — สำรวจการศึกษา"
  subtitle="ทะเบียนผู้ขอทุน + แบบสำรวจรายปีงบประมาณ"
  right={<YearPills years={yearTabs} value={data?.year} onChange={(y) => setYear(y)} />}
/>
```
> คง `yearTabs`, `data?.year`, `setYear` เดิม (YearPills แทนปุ่ม `btn` เดิม)

- [ ] **Step 3: แทนแถบปุ่ม view ด้วย PillTabs**

แทนบล็อก `join` 4 ปุ่มเดิม ด้วย:
```jsx
<div className="mb-5">
  <PillTabs
    active={view}
    onChange={setView}
    tabs={[
      { key: 'table', label: '📋 ตาราง' },
      { key: 'map', label: '🗺️ แผนที่' },
      { key: 'blocked', label: '🚫 โรงเรียนไม่ผ่าน' },
      { key: 'allocation', label: '🎯 จัดสรรทุน' },
    ]}
  />
</div>
```

- [ ] **Step 4: restyle การ์ดสถิติ 6 ใบ ด้วย StatCard**

แทนบล็อกการ์ดสถิติเดิม (array 6 คู่) ด้วย grid StatCard (คง gate `{stats && ...}` และให้โชว์บนแท็บตาราง):
```jsx
{stats && view === 'table' && (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
    <StatCard value={stats.total} label="ทั้งหมด" tone="purple" />
    <StatCard value={stats.renewals} label="รายเก่า" />
    <StatCard value={stats.byStatus?.['รับคำร้อง'] || 0} label="รับคำร้อง" />
    <StatCard value={stats.byStatus?.['ตรวจสอบแล้ว'] || 0} label="ตรวจสอบแล้ว" tone="deep" />
    <StatCard value={stats.byStatus?.['ได้รับทุน'] || 0} label="ได้รับทุน" tone="green" />
    <StatCard value={stats.byStatus?.['ไม่ผ่านเกณฑ์'] || 0} label="ไม่ผ่านเกณฑ์" tone="gray" />
  </div>
)}
```
> ถ้าเดิมการ์ดโชว์ทุก view ให้คงพฤติกรรมเดิมได้ (ตัด `view === 'table'`) — แต่ mockup โชว์เฉพาะแท็บตาราง แนะนำ gate ตามนี้

- [ ] **Step 5: ครอบเนื้อหาแต่ละ view ด้วย cardCls (ถ้ายังไม่ครอบ)**

ให้กล่องเนื้อหาหลัก (ที่ห่อ header+tabs+stats+view) ใช้พื้นการ์ด เช่น เพิ่ม `className={cardCls + ' p-5'}` ที่ wrapper นอกสุดของ dashboard (คงโครง conditional `view === ...` เดิม)

- [ ] **Step 6: lint + build**

Run: `npm run lint && npm run build`
Expected: lint clean; build exit 0

- [ ] **Step 7: Commit**

```bash
git add components/smart-school/admin/SmartSchoolDashboard.jsx
git commit -m "feat(smart-school): restyle dashboard shell ธีมม่วง (หัว+pill tabs+stat cards+ปีงบ)"
```

---

## Task 3: แท็บตาราง (ApplicationTable.jsx)

**Files:**
- Modify: `components/smart-school/admin/ApplicationTable.jsx`

**บริบท (อ่านก่อน):** ตารางรายชื่อ มี level tabs, ช่องค้นหา, badge เกณฑ์ (schoolEligibility/residency), household tag, คลิกแถวเปิด detail. **คง props/handler/filter logic เดิม** เปลี่ยนเฉพาะ className/JSX

- [ ] **Step 1: import helper**

```jsx
import { cardCls, tableHeadCls, chipCls, inputCls, statusBadgeCls } from '@/components/smart-school/adminTheme';
```

- [ ] **Step 2: restyle level tabs → chipCls**

เปลี่ยนปุ่ม level tab เดิมให้ใช้ `className={chipCls(active)}` (active = แท็บที่เลือก) คงค่าที่ map และ onClick เดิม

- [ ] **Step 3: restyle ช่องค้นหา → inputCls**

เปลี่ยน `<input>` ค้นหาให้ `className={inputCls}` (คง value/onChange/placeholder เดิม) ครอบด้วยกล่อง `max-w-[280px]` ถ้าต้องการ

- [ ] **Step 4: restyle ตาราง (card shell + header + แถว + badge)**

- ครอบตารางด้วย `<div className={cardCls + ' overflow-hidden'}>`
- แถวหัว `<thead>` ใช้ `className={tableHeadCls}` (พื้น `#F6F3FD`)
- แถวข้อมูล: `className="border-t border-[#F0ECF8] hover:bg-[#F6F3FD] cursor-pointer"` (คง onClick เปิด detail เดิม)
- badge สถานะ: `<span className={statusBadgeCls(row.status)}>{row.status}</span>`
- badge "เก่า" (isRenewal): `<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] font-bold">เก่า</span>`
- 🏠 บ้านเดียวกัน (household.members.length): `<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309]" title={...}>🏠 {n}</span>`
- คง badge เกณฑ์ (schoolEligibility='block' → แดง, residency) ที่มีอยู่ ปรับสีให้เข้าชุด (แดง `bg-[#FEE2E2] text-[#B91C1C]`)

- [ ] **Step 5: lint + build**

Run: `npm run lint && npm run build`
Expected: lint clean; build exit 0

- [ ] **Step 6: Commit**

```bash
git add components/smart-school/admin/ApplicationTable.jsx
git commit -m "feat(smart-school): restyle ตารางผู้สมัคร ธีมม่วง (chip/ค้นหา/แถว/badge สถานะ)"
```

---

## Task 4: Modal ดู (ApplicationDetailModal.jsx)

**Files:**
- Modify: `components/smart-school/admin/ApplicationDetailModal.jsx`

**บริบท:** modal แสดงรายละเอียดใบสมัคร (มี Row ข้อมูลการศึกษา/ครัวเรือน/เกณฑ์/checklist/scholarshipAmount/household members/รูป). **คงทุกฟิลด์/ข้อมูลที่แสดง** เปลี่ยนเฉพาะกรอบ/หัว/สีหัวข้อ

- [ ] **Step 1: import helper**

```jsx
import { statusBadgeCls, ghostBtnCls, primaryBtnCls, FONT_DISPLAY } from '@/components/smart-school/adminTheme';
```

- [ ] **Step 2: หัว modal ม่วง**

ทำแถบหัวม่วง: พื้น `#7C3AED` text ขาว — code/รหัส + ชื่อ + `<span className="...bg-white/22...">{status}</span>` + ปุ่มปิด ✕ (`text-white/85 hover:text-white`) ครอบ modal body ด้วยพื้น `#FAF8FF` rounded-[24px]

- [ ] **Step 3: หัวข้อกลุ่มสีม่วง**

หัวข้อแต่ละกลุ่ม (ข้อมูลการศึกษา / ครัวเรือน&รายได้ / รูป&พิกัด) ใช้ `<div className="text-[12px] font-bold text-[#7C3AED] mb-2.5 tracking-wide">…</div>` + คั่นด้วยเส้น `border-[#EDE7FD]`

- [ ] **Step 4: ปุ่มล่าง**

"ปิด" → `className={ghostBtnCls}`; "✎ แก้ไขข้อมูล" → `className={primaryBtnCls}` (คง handler เปิด edit เดิม)

- [ ] **Step 5: lint + build**

Run: `npm run lint && npm run build`
Expected: lint clean; build exit 0

- [ ] **Step 6: Commit**

```bash
git add components/smart-school/admin/ApplicationDetailModal.jsx
git commit -m "feat(smart-school): restyle modal ดูข้อมูล หัวม่วง + กลุ่มหัวข้อ"
```

---

## Task 5: Modal แก้ไข (ApplicationEditModal.jsx)

**Files:**
- Modify: `components/smart-school/admin/ApplicationEditModal.jsx`

**บริบท:** modal แก้ไข มี select สถานะ, schoolEligibility, residency, checklist, ฟิลด์ชื่อ/รายได้ ฯลฯ + ปุ่มบันทึก. **คงฟิลด์/handler/บันทึกเดิม**

- [ ] **Step 1: import helper**

```jsx
import { inputCls, labelCls, chipCls, ghostBtnCls, successBtnCls } from '@/components/smart-school/adminTheme';
```

- [ ] **Step 2: หัว modal เข้ม**

แถบหัวพื้น `#211B2E` text ขาว + ไอคอน ✎ + "แก้ไข · {code}" + ชื่อ + ปุ่มปิด

- [ ] **Step 3: สถานะเป็น chip แทน select (ถ้าเดิมเป็น select)**

ถ้าสถานะเดิมเป็น `<select>` เปลี่ยนเป็นแถว chip 4 ค่า:
```jsx
<div className="flex flex-wrap gap-1.5">
  {['รับคำร้อง','ตรวจสอบแล้ว','ได้รับทุน','ไม่ผ่านเกณฑ์'].map((s) => (
    <button type="button" key={s} onClick={() => setStatus(s)} className={chipCls(status === s)}>{s}</button>
  ))}
</div>
```
> ใช้ชื่อ state/ตัว setter สถานะเดิมของไฟล์ (แทน `status`/`setStatus` ให้ตรงของจริง) ถ้าเดิมเป็น select ที่เก็บใน form object ให้ setter เขียนลง object เดิม — **ห้ามเปลี่ยนสัญญาการบันทึก**

- [ ] **Step 4: ฟิลด์ + ปุ่ม**

input/textarea → `className={inputCls}`, label → `labelCls`; checklist/select อื่นคงไว้ปรับสีให้เข้าชุด; ปุ่ม "ยกเลิก" → `ghostBtnCls`, "✓ บันทึกการแก้ไข" → `successBtnCls` (คง onSave เดิม)

- [ ] **Step 5: lint + build**

Run: `npm run lint && npm run build`
Expected: lint clean; build exit 0

- [ ] **Step 6: Commit**

```bash
git add components/smart-school/admin/ApplicationEditModal.jsx
git commit -m "feat(smart-school): restyle modal แก้ไข หัวเข้ม + chip สถานะ"
```

---

## Task 6: แท็บจัดสรรทุน (AllocationBoard.jsx) — เฟส 2

**Files:**
- Modify: `components/smart-school/admin/AllocationBoard.jsx`

**บริบท:** มีตารางลำดับ (rank input + ปุ่ม OK + ตัวกรองโรงเรียน + แท็บระดับ + Export CSV + `byLevel`, `awardedInLevel`, `info`). **คงลอจิกทั้งหมด** เพิ่มการ์ดโควตา + ธีม

- [ ] **Step 1: import helper**

```jsx
import { cardCls, tableHeadCls, chipCls, statusBadgeCls, FONT_DISPLAY } from '@/components/smart-school/adminTheme';
```

- [ ] **Step 2: การ์ดโควตา progress ต่อระดับ (ใหม่ ด้านบนแท็บระดับ)**

เพิ่มบล็อกเหนือแท็บระดับ ใช้ `SCHOLARSHIP_LEVELS` + นับ awarded ต่อ bucket (จาก `byLevel[b.key]`):
```jsx
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
  {SCHOLARSHIP_LEVELS.map((b) => {
    const awarded = (byLevel[b.key] || []).filter((r) => r.status === 'ได้รับทุน').length;
    const over = awarded > b.quota;
    const pct = Math.min(100, Math.round((awarded / b.quota) * 100));
    return (
      <div key={b.key} className={'rounded-[18px] p-4 ' + (over ? 'bg-white border border-[#FBCFE0]' : 'bg-white border border-[#E7E2F2]')}>
        <div className="text-[12px] text-[#8A8398]">{b.label}</div>
        <div className="text-[26px] font-bold mt-1" style={{ fontFamily: FONT_DISPLAY, color: over ? '#B91C1C' : undefined }}>
          {awarded}<span className="text-[14px] text-[#8A8398]">/{b.quota}</span>
        </div>
        <div className="h-1.5 rounded-full bg-[#EDE7FD] mt-2">
          <div className="h-full rounded-full" style={{ width: (over ? 100 : pct) + '%', background: over ? '#DC2626' : '#7C3AED' }} />
        </div>
      </div>
    );
  })}
</div>
```

- [ ] **Step 3: restyle แท็บระดับ + ตาราง + ปุ่ม**

- แท็บระดับ → `chipCls(active)`
- ครอบตารางด้วย `cardCls`, หัวตาราง `tableHeadCls`, แถว `border-t border-[#F0ECF8]`
- badge สถานะ `statusBadgeCls`; badge 🏠/เกินโควตา เหลือง `bg-[#FEF3C7] text-[#B45309]`
- **คงช่อง rank input + ปุ่ม OK + ตัวกรองโรงเรียน + ปุ่ม Export ตามเดิม** (แค่ปรับสีปุ่มให้เข้าชุด: OK ใช้ม่วง `bg-[#7C3AED] text-white`)

- [ ] **Step 4: lint + build**

Run: `npm run lint && npm run build`
Expected: lint clean; build exit 0

- [ ] **Step 5: Commit**

```bash
git add components/smart-school/admin/AllocationBoard.jsx
git commit -m "feat(smart-school): แท็บจัดสรรทุน เพิ่มการ์ดโควตา progress + ธีมม่วง (คงตารางลำดับ)"
```

---

## Task 7: แท็บแผนที่ (MapPoints.js) — เฟส 3

**Files:**
- Modify: `components/smart-school/admin/MapPoints.js`

**บริบท:** แผนที่ Leaflet แสดงหมุดผู้สมัคร (มี marker/popup). **คง Leaflet/logic เดิม** เปลี่ยนสีหมุดตามสถานะ + เพิ่ม legend + กรอบธีม

- [ ] **Step 1: กำหนดสีหมุดตามสถานะ**

ทำ map สี (ตรงกับ status color): `รับคำร้อง #7C3AED · ตรวจสอบแล้ว #6D28D9 · ได้รับทุน #16A34A · ไม่ผ่านเกณฑ์ #9CA3AF`. ใช้กับ marker icon (ถ้าเป็น divIcon/circleMarker เปลี่ยน fill; ถ้าเป็น default icon ใช้สีในหมุด custom) คง lat/lng/popup เดิม

- [ ] **Step 2: กรอบ + legend**

ครอบแผนที่ด้วย `<div className={cardCls + ' p-4'}>` (import `cardCls`) + หัว "🗺️ แผนที่ผู้สมัคร" + legend 4 สีด้านล่าง (จุดกลม + label สถานะ)

- [ ] **Step 3: lint + build**

Run: `npm run lint && npm run build`
Expected: lint clean; build exit 0 (ระวัง MapPoints เป็น `ssr:false` dynamic — ต้องคอมไพล์ผ่าน)

- [ ] **Step 4: Commit**

```bash
git add components/smart-school/admin/MapPoints.js
git commit -m "feat(smart-school): restyle แผนที่ สีหมุดตามสถานะ + legend + กรอบธีม"
```

---

## Task 8: แท็บโรงเรียนไม่ผ่าน (BlockedSchoolsPanel.jsx) — เฟส 3

**Files:**
- Modify: `components/smart-school/admin/BlockedSchoolsPanel.jsx`

**บริบท:** แผงจัดการ blocklist โรงเรียน (เพิ่ม/แก้/ลบ ชื่อ + reason). **คงการจัดการทั้งหมด** แต่งธีมเท่านั้น

- [ ] **Step 1: import + restyle**

```jsx
import { cardCls, inputCls, chipCls, primaryBtnCls, ghostBtnCls } from '@/components/smart-school/adminTheme';
```
- ครอบด้วย `cardCls + ' p-5'`; input ชื่อโรงเรียน → `inputCls`; reason chip → `chipCls`; ปุ่มเพิ่ม → `primaryBtnCls`; ปุ่มลบ/ยกเลิก → `ghostBtnCls`. คง fetch/CRUD handler เดิม

- [ ] **Step 2: lint + build**

Run: `npm run lint && npm run build`
Expected: lint clean; build exit 0

- [ ] **Step 3: Commit**

```bash
git add components/smart-school/admin/BlockedSchoolsPanel.jsx
git commit -m "feat(smart-school): restyle แผงโรงเรียนไม่ผ่าน ธีมม่วง (คงการจัดการ blocklist)"
```

---

## Final verification (หลังครบทุก task)

- [ ] `npm run lint` — clean
- [ ] `npm run build` — exit 0
- [ ] `grep -rn "surveyTheme\|adminTheme" components/smart-school/admin/` — ทุกไฟล์ import จาก adminTheme (ไม่ import surveyTheme ตรง ๆ ให้ผ่าน adminTheme ที่ re-export)
- [ ] ตาดู dev server `/admin/smart-school` ครบ 4 แท็บ + เปิด/แก้ modal (ต้องล็อกอิน Clerk — ให้ผู้ใช้ยืนยันด้วยตา)

---

## Notes / Constraints
- **ห้าม**แตะ API (`pages/api/smart-school/*`), models, permissions, ฟอร์ม survey
- **ห้าม**เปลี่ยนสัญญา props/handler/fetch ของ component — presentation-only
- daisyUI class เดิม (`btn`, `badge`, `select`) แทนที่ด้วย themed class ได้ แต่ไม่แตะ `styles/globals.css` รวม
- เลข hex ใช้ arbitrary value ของ Tailwind (`bg-[#7C3AED]`) ตาม pattern surveyTheme
- ทุก task เป็นอิสระต่อกันหลัง Task 1 (Task 1 เป็น dependency ของทุกตัว) — ทำเรียงเฟสได้
