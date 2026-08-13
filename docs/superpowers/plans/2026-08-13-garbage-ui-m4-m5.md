# หน้าจอประชาชนและหลังบ้านตารางรถขยะ (M4–M5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ประชาชนค้นหาถนน/ชุมชนของตัวเองที่ `/garbage` แล้วรู้ว่ารถขยะมาวันไหนเวลาไหน พร้อมดูสถานะรถวันนี้ และให้เจ้าหน้าที่เปิดดูตารางทั้งสัปดาห์ที่ `/admin/garbage` โดยมีเมนูบนไซด์บาร์

**Architecture:** ต่อยอด `lib/garbage/*` + API 3 ตัวที่เสร็จแล้วใน M1–M3 · เพิ่ม endpoint รายสัปดาห์ที่อ่าน DB รอบเดียวสำหรับ 7 วัน (`resolveWeekSchedule`) แยก logic ล้วน (`buildWeekSchedule`) ออกจากการอ่านข้อมูลเพื่อให้เทสได้ · หน้าประชาชนเป็นหน้าเดียวสองส่วน (ค้นหา + รถวันนี้) หน้าแอดมินอ่านอย่างเดียวยกเว้นค่าตั้งค่าเบอร์ติดต่อที่เก็บใน collection `garbage_settings`

**Tech Stack:** Next.js 15 Pages Router, TypeScript strict, MongoDB (native driver ~6.16), Zod, Vitest, Tailwind v4 + DaisyUI, Clerk (เฉพาะ PUT settings)

**Spec:** `docs/superpowers/specs/2026-08-13-garbage-ui-design.md`

**Branch:** ทำบน `feat/garbage-ui` (แตกจาก `feat/garbage-schedule` แล้ว — ห้ามสลับ branch)

---

## บริบทที่ผู้รับงานต้องรู้ก่อนเริ่ม

**ทำอะไรไปแล้ว (M1–M3, อยู่ใน PR #116):** `types/garbage.ts` (domain types), `lib/garbage/time.ts` (เวลาไทย/โซนกรุงเทพ), `lib/garbage/db.ts` (native driver, collection `garbage_*`, lazy connect), `lib/garbage/validators.ts` (Zod), `lib/garbage/resolve.ts` (`buildDaySchedule`, `pickLatestVersions`, `resolveScheduleForDate`), `lib/garbage/live.ts` (`getLivePosition`), API `pages/api/garbage/{schedule,search,live}.ts` · DB จริง seed แล้ว: รถ 7, สาย 7, ชุมชน 21, งานมอบหมาย 17 (**เฉพาะวันจันทร์กับวันอังคาร**)

**กฎที่พลาดง่าย 6 ข้อ:**

1. **API ชุด garbage คืน `{ error: string }`** ไม่ใช่ `{ success, message }` แบบโมดูลอื่นในรีโป — ฝั่ง client ต้องอ่าน `json.error`
2. **ห้ามฟอร์แมตเวลาเอง** ใช้ `formatThaiTime` / `formatRange` จาก `lib/garbage/time.ts` เท่านั้น (ระบบ prototype เดิมมีบั๊ก `if (hour === '12') minutes = 0` ทำให้เวลาบ่ายเพี้ยนทั้งระบบ)
3. **หน้า public ไม่ต้องเรนเดอร์ header/nav/`<main>` ของตัวเอง** — `components/Layout.js` ใส่ `TopNavbar` + `BottomNav` + padding ให้ทุกหน้าที่ไม่ได้ขึ้นต้นด้วย `/admin` อยู่แล้ว
4. **การ์ดหน้าแรกต้อง hardcode JSX** — กริดไอคอนใน `pages/index.tsx` ดึงจาก `useMenuStore` → `/api/menu` ซึ่ง proxy ไป backend ภายนอก และรายการเมนูเปิด modal ไม่ได้ navigate ดังนั้นเพิ่มการ์ดผ่าน DB ไม่ได้
5. **หน้า admin ใหม่ต้องลงทะเบียน 5 จุด** ไม่ใช่ 4 ตามที่ `.claude/skills/adding-admin-page/SKILL.md` เขียน — จุดที่ 5 คือ `ADMIN_META` ใน `components/Layout.js` ลืมแล้วหน้าไม่มีชื่อแบบเงียบ ๆ
6. **วันพุธ–อาทิตย์ไม่มีข้อมูลเป็นสถานะปกติ** (รอกองสาธารณสุข) ทั้งสองหน้าต้องบอกตรง ๆ ว่ารอข้อมูล ไม่ใช่แสดงว่างเปล่า

**คำสั่งที่ใช้:** `npm test` (vitest, environment node — ไม่มีเทส React/API ในรีโปนี้) · `npx vitest run <path>` · `npx tsc --noEmit` · `npm run build` · dev server `npm run dev` (พอร์ต 3000 อาจไม่ว่าง Next จะขยับไป 3001 เอง)

---

## File Structure

| ไฟล์ | ความรับผิดชอบ |
|---|---|
| `components/ui/adminTheme.jsx` | โทเคน/คอมโพเนนต์ธีมแอดมินกลาง (บ้านใหม่ที่ smart-waste สั่งให้สกัดเมื่อมีโมดูลที่ 3) |
| `components/smart-school/adminTheme.jsx` | เหลือ `statusBadgeCls` (เฉพาะโดเมนใบสมัคร) + re-export ของเดิม |
| `components/smart-waste/wasteTheme.jsx` | re-export ชี้บ้านใหม่ + โทเคนสีขยะของตัวเอง |
| `lib/garbage/labels.ts` | ป้ายภาษาไทยของโดเมน (ชื่อวัน, ชนิดงาน, สถานะสด) — ที่เดียวทั้งระบบ |
| `lib/garbage/time.ts` | เพิ่ม `weekDatesOf()` — 7 วันของสัปดาห์เรียงอาทิตย์→เสาร์ |
| `lib/garbage/resolve.ts` | เพิ่ม `buildWeekSchedule()` (pure) + `resolveWeekSchedule()` (อ่าน DB รอบเดียว) และ map `routeNeedsVerification` |
| `lib/garbage/db.ts` | เพิ่ม accessor `settings()` + index ของ `garbage_settings` |
| `lib/garbage/validators.ts` | เพิ่ม `garbageSettingsInputSchema` |
| `types/garbage.ts` | เพิ่ม `routeNeedsVerification` ใน `ResolvedAssignment`, ย้าย `SearchHit` มาไว้ที่นี่, เพิ่ม `GarbageSettings` |
| `pages/api/garbage/week.ts` | GET ตารางรายสัปดาห์ (public) |
| `pages/api/garbage/_auth.ts` | `requireGarbageAdmin()` — ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์สำหรับ PUT settings |
| `pages/api/garbage/settings.ts` | GET (public) / PUT (ต้องล็อกอิน + มีสิทธิ์หน้า) ค่าเบอร์ติดต่อ |
| `components/garbage/useDebounce.ts` | ฮุค debounce (colocate กับผู้ใช้เพียงรายเดียว) |
| `components/garbage/GarbageSearchPanel.tsx` | ช่องค้นหา + ผลลัพธ์จัดกลุ่มตามวัน |
| `components/garbage/TodayTruckPanel.tsx` | สถานะรถวันนี้ poll 60 วิ |
| `components/garbage/CoverageNote.tsx` | แถบบอกว่าวันไหนยังไม่มีตาราง + เบอร์ติดต่อ |
| `components/garbage/GarbageHomeCard.tsx` | การ์ดทางเข้าบนหน้าแรก |
| `pages/garbage.tsx` | ประกอบ 3 คอมโพเนนต์ + ดึง week/settings ครั้งเดียว |
| `components/garbage/admin/WeekScheduleView.jsx` | แท็บ 7 วัน + ตารางงานมอบหมาย + กางดูจุด |
| `components/garbage/admin/ContactSettingsCard.jsx` | ฟอร์มเบอร์ติดต่อ |
| `pages/admin/garbage.jsx` | หน้าแอดมิน (บาง) ครอบ `PermissionGuard` |
| `scripts/grant-garbage-permission.js` | migration สิทธิ์ให้ user เดิม |
| `docs/modules/garbage.md` | เอกสารโมดูล (บังคับตาม convention) |

---

## Task 1: สกัดธีมแอดมินไปไว้ที่ `components/ui/adminTheme.jsx`

`components/smart-waste/wasteTheme.jsx` เขียนคอมเมนต์สั่งไว้เองว่า "ถ้ามีโมดูลที่ 3 มายืมอีก ให้สกัดเป็น components/ui/adminTheme" — garbage คือรายที่ 3 · เป้าหมายคือ **ไฟล์ของ smart-school และ smart-waste ทั้ง 16 ไฟล์ไม่ต้องแก้ import แม้แต่ไฟล์เดียว** (ทำเป็น re-export shim) ความเสี่ยงเป็นศูนย์และตรวจได้ด้วย build

**Files:**
- Create: `components/ui/adminTheme.jsx`
- Modify: `components/smart-school/adminTheme.jsx` (เหลือเฉพาะส่วนโดเมน + re-export)
- Modify: `components/smart-waste/wasteTheme.jsx` (เปลี่ยนต้นทาง import 1 บรรทัด)

- [ ] **Step 1: สร้าง `components/ui/adminTheme.jsx`**

ย้ายเนื้อจริงของ `cardCls`, `tableHeadCls`, `StatCard`, `PillTabs`, `YearPills`, `DashboardHeader` มาไว้ที่นี่ (คัดลอกโค้ดเดิมทั้งดุ้น ห้ามแก้ค่าสี/คลาส) — `statusBadgeCls` **ไม่ย้าย** เพราะผูกกับสถานะใบสมัครของ smart-school:

```jsx
// components/ui/adminTheme.jsx
// ธีมแอดมินกลาง — สกัดจาก components/smart-school/adminTheme.jsx เมื่อ garbage กลายเป็นโมดูลที่ 3 ที่ยืมใช้
// (smart-school/adminTheme.jsx และ smart-waste/wasteTheme.jsx re-export จากที่นี่ ของเดิมจึงไม่ต้องแก้ import)
// โทเคนพื้นฐาน (ฟอนต์/อินพุต/ปุ่ม) ยังอยู่ที่ smart-school/survey/surveyTheme — การย้ายชุดนั้นไม่อยู่ในขอบเขตรอบนี้
import React from 'react';
import {
  FONT_DISPLAY, FONT_BODY,
  inputCls, labelCls, chipCls,
  primaryBtnCls, ghostBtnCls, successBtnCls,
} from '@/components/smart-school/survey/surveyTheme';

export { FONT_DISPLAY, FONT_BODY, inputCls, labelCls, chipCls, primaryBtnCls, ghostBtnCls, successBtnCls };

// การ์ด shell ของ dashboard/แผง (radius 24 + เงานุ่ม)
export const cardCls =
  'bg-[#FAF8FF] border border-[#E7E2F2] rounded-[24px] shadow-[0_20px_50px_-30px_rgba(33,27,46,0.4)]';

// หัวตาราง/แถวโฮเวอร์
export const tableHeadCls = 'bg-[#F6F3FD] text-[12px] font-bold text-[#57506A]';

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

- [ ] **Step 2: แทนที่ `components/smart-school/adminTheme.jsx` ทั้งไฟล์**

เหลือเฉพาะส่วนที่เป็นโดเมน smart-school แล้ว re-export ที่เหลือ (ไฟล์ smart-school เดิมที่ import จากที่นี่จึงยังทำงานเหมือนเดิมทุกตัว):

```jsx
// components/smart-school/adminTheme.jsx
// จุด import เดิมของ smart-school — โทเคน/คอมโพเนนต์กลางย้ายไป components/ui/adminTheme แล้ว
// ไฟล์นี้เหลือเฉพาะ statusBadgeCls ที่ผูกกับสถานะใบสมัครของโมดูลนี้โดยตรง
export {
  FONT_DISPLAY, FONT_BODY, inputCls, labelCls, chipCls,
  primaryBtnCls, ghostBtnCls, successBtnCls,
  cardCls, tableHeadCls, StatCard, PillTabs, YearPills, DashboardHeader,
} from '@/components/ui/adminTheme';

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
```

- [ ] **Step 3: แก้ต้นทาง import ใน `components/smart-waste/wasteTheme.jsx`**

เปลี่ยนบล็อกที่ re-export จาก `@/components/smart-school/adminTheme` ให้ชี้บ้านใหม่ และอัปเดตคอมเมนต์หัวไฟล์ที่บอกว่า "รอบนี้ YAGNI" (ทำแล้ว) — ส่วน `WASTE_GROUP_COLORS`, `YEAR_LINE_COLORS`, `formatKg` คงเดิมทั้งหมด:

```jsx
// components/smart-waste/wasteTheme.jsx
// จุด import เดียวของธีม smart-waste — token กลางอยู่ที่ components/ui/adminTheme
// (สกัดออกมาแล้วตอน garbage เป็นโมดูลที่ 3 ที่ยืมใช้ ตามที่คอมเมนต์เดิมสั่งไว้)

export {
  FONT_DISPLAY, FONT_BODY, inputCls, labelCls, chipCls,
  primaryBtnCls, ghostBtnCls, successBtnCls,
  cardCls, tableHeadCls, StatCard, PillTabs, YearPills, DashboardHeader,
} from '@/components/ui/adminTheme';
```

(บรรทัดถัดจากนี้ในไฟล์เดิม — คอมเมนต์สีขยะและ `export const WASTE_GROUP_COLORS = {...}` ลงไปจนจบไฟล์ — ห้ามแตะ)

- [ ] **Step 4: ยืนยันว่าไม่มีอะไรพัง**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc เงียบ · เทสผ่านเท่าเดิม (124 passed | 2 skipped) · build สำเร็จและหน้า `/admin/smart-waste` กับ `/admin/smart-school` คอมไพล์ผ่าน

- [ ] **Step 5: Commit**

```bash
git add components/ui/adminTheme.jsx components/smart-school/adminTheme.jsx components/smart-waste/wasteTheme.jsx
git commit -m "refactor: สกัดธีมแอดมินกลางไป components/ui/adminTheme"
```

---

## Task 2: `weekDatesOf` — 7 วันของสัปดาห์

**Files:**
- Modify: `lib/garbage/time.ts`
- Test: `lib/garbage/time.test.ts`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

เพิ่มท้าย `lib/garbage/time.test.ts` และเพิ่ม `weekDatesOf` เข้าไปใน import statement ที่มีอยู่ของไฟล์นี้:

```ts
describe("weekDatesOf", () => {
  it("คืน 7 วันเรียงอาทิตย์→เสาร์", () => {
    // 2026-08-12 คือวันพุธ สัปดาห์นั้นเริ่มอาทิตย์ 2026-08-09
    expect(weekDatesOf("2026-08-12")).toEqual([
      "2026-08-09", "2026-08-10", "2026-08-11", "2026-08-12",
      "2026-08-13", "2026-08-14", "2026-08-15",
    ]);
  });

  it("index ตรงกับเลขวันในสัปดาห์", () => {
    const days = weekDatesOf("2026-08-12");
    expect(weekdayOf(days[0])).toBe(0);
    expect(weekdayOf(days[3])).toBe(3);
    expect(weekdayOf(days[6])).toBe(6);
  });

  it("วันไหนในสัปดาห์ก็ได้ชุดเดียวกัน", () => {
    const fromSunday = weekDatesOf("2026-08-09");
    expect(weekDatesOf("2026-08-15")).toEqual(fromSunday);
    expect(weekDatesOf("2026-08-11")).toEqual(fromSunday);
  });

  it("ข้ามเดือนได้", () => {
    // 2026-09-01 คือวันอังคาร สัปดาห์เริ่มอาทิตย์ 2026-08-30
    expect(weekDatesOf("2026-09-01")).toEqual([
      "2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02",
      "2026-09-03", "2026-09-04", "2026-09-05",
    ]);
  });

  it("รูปแบบวันที่ผิดต้องโยน error", () => {
    expect(() => weekDatesOf("2026-8-9")).toThrow();
    expect(() => weekDatesOf("ไม่ใช่วันที่")).toThrow();
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run lib/garbage/time.test.ts`
Expected: FAIL — `weekDatesOf is not a function` (หรือ import error)

- [ ] **Step 3: เพิ่ม implementation ท้าย `lib/garbage/time.ts`**

```ts
const DAY_MS = 86_400_000;

/**
 * "2026-08-12" → 7 วันของสัปดาห์นั้น เรียงอาทิตย์→เสาร์ (index = เลขวันในสัปดาห์ 0..6)
 * กรุงเทพฯ ไม่มี DST จึงบวกวันด้วยมิลลิวินาทีคงที่ได้ปลอดภัย
 */
export function weekDatesOf(date: string): string[] {
  const weekday = weekdayOf(date); // โยน error เองถ้ารูปแบบผิด
  const base = new Date(`${date}T00:00:00+07:00`);
  const sunday = base.getTime() - weekday * DAY_MS;
  return Array.from({ length: 7 }, (_, i) => formatDateBangkok(new Date(sunday + i * DAY_MS)));
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `npx vitest run lib/garbage/time.test.ts`
Expected: PASS ทุกเทสในไฟล์ (ของเดิม 21 + ใหม่ 5 = 26)

- [ ] **Step 5: Commit**

```bash
git add lib/garbage/time.ts lib/garbage/time.test.ts
git commit -m "feat: add weekDatesOf helper for week schedule"
```

---

## Task 3: ป้ายภาษาไทยของโดเมน (`lib/garbage/labels.ts`)

ตอนนี้ `WEEKDAY_TH` ถูกประกาศไว้ใน `pages/api/garbage/search.ts` ไฟล์เดียว หน้า UI ทั้งสองหน้าต้องใช้ด้วย → ย้ายมาไว้ที่เดียว ป้องกันชื่อวันเพี้ยนกันระหว่างหน้า

**Files:**
- Create: `lib/garbage/labels.ts`
- Modify: `pages/api/garbage/search.ts` (ลบ const ในไฟล์ ใช้ของกลาง)

- [ ] **Step 1: สร้าง `lib/garbage/labels.ts`**

```ts
import type { AssignmentKind, LiveStatus, Weekday } from "@/types/garbage";

/** ชื่อวันในสัปดาห์ index ตรงกับ Weekday 0..6 */
export const WEEKDAY_TH: string[] = [
  "อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์",
];

export function weekdayName(weekday: Weekday | number): string {
  return WEEKDAY_TH[weekday] ?? "";
}

/** ป้ายชนิดงานมอบหมาย — "normal" ไม่ต้องแสดงป้าย จึงคืนค่าว่าง */
export const KIND_LABEL_TH: Record<AssignmentKind, string> = {
  normal: "",
  substitute: "แทนเบอร์",
  day_off: "วันหยุด",
  special: "พิเศษ",
};

export const LIVE_STATUS_TH: Record<LiveStatus, string> = {
  running: "กำลังวิ่ง",
  upcoming: "ยังไม่เริ่ม",
  finished: "เสร็จแล้ว",
  unknown: "ไม่มีข้อมูล",
};
```

- [ ] **Step 2: ให้ `pages/api/garbage/search.ts` ใช้ของกลาง**

ลบบรรทัด `const WEEKDAY_TH = [...]` ในไฟล์นั้นออก แล้วเพิ่ม import:

```ts
import { WEEKDAY_TH } from "@/lib/garbage/labels";
```

ส่วนที่เรียกใช้ (`weekdayName: WEEKDAY_TH[weekday]`) คงเดิม

- [ ] **Step 3: ยืนยันว่า API ยังทำงานเหมือนเดิม**

Run: `npx tsc --noEmit && npm test`
Expected: tsc เงียบ, เทสผ่านเท่าเดิม

- [ ] **Step 4: Commit**

```bash
git add lib/garbage/labels.ts pages/api/garbage/search.ts
git commit -m "refactor: รวมป้ายภาษาไทยของโมดูลขยะไว้ที่ lib/garbage/labels.ts"
```

---

## Task 4: `routeNeedsVerification` ใน `ResolvedAssignment`

สาย R5–R7 มี `needsVerification: true` (ถอดจากโปสเตอร์ ยังไม่ผ่านการตรวจ) หน้าแอดมินต้องเห็นป้ายเตือนนี้ แต่ `ResolvedAssignment` ยังไม่พาข้อมูลออกมา

**Files:**
- Modify: `types/garbage.ts`
- Modify: `lib/garbage/resolve.ts`
- Test: `lib/garbage/resolve.test.ts`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

เพิ่มใน `describe("buildDaySchedule", ...)` ของ `lib/garbage/resolve.test.ts`:

```ts
  it("พาสถานะรอตรวจสอบของสายออกมาด้วย", () => {
    const routesWithFlag: Route[] = [
      { ...routes[0] },
      {
        code: "R5", name: "สาย R5", defaultTruckNumber: 5, active: true,
        needsVerification: true, communityNames: ["ชุมชนเขาใบไม้"],
        stops: [{ seq: 1, name: "จุด X", mode: "truck" }],
      },
    ];
    const a: Assignment[] = [
      { ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 300, stopTimes: [] },
      { ...base, weekday: 1, shiftNo: 1, truckNumber: 5, routeCode: "R5", kind: "normal", startMin: 300, endMin: 400, stopTimes: [] },
    ];
    const out = buildDaySchedule("2026-08-10", 1, a, routesWithFlag, trucks);
    expect(out.assignments[0].routeNeedsVerification).toBe(false); // R1 ไม่ได้ตั้งค่า → false ไม่ใช่ undefined
    expect(out.assignments[1].routeNeedsVerification).toBe(true);
  });

  it("วันหยุดที่ไม่มีสาย ถือว่าไม่ต้องตรวจสอบ", () => {
    const a: Assignment[] = [{
      ...base, weekday: 2, shiftNo: 1, truckNumber: 1, routeCode: null, kind: "day_off",
      startMin: null, endMin: null, stopTimes: [],
    }];
    const out = buildDaySchedule("2026-08-11", 2, a, routes, trucks);
    expect(out.assignments[0].routeNeedsVerification).toBe(false);
  });
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run lib/garbage/resolve.test.ts`
Expected: FAIL — `expected undefined to be false`

- [ ] **Step 3: เพิ่มฟิลด์ใน `types/garbage.ts`**

ใน `interface ResolvedAssignment` เพิ่มบรรทัดนี้ต่อจาก `routeName`:

```ts
  /** สายนี้ยังต้องให้กองสาธารณสุขตรวจชื่อจุด (R5–R7 ถอดจากโปสเตอร์) — ไม่มีสายถือว่า false */
  routeNeedsVerification: boolean;
```

- [ ] **Step 4: map ค่าใน `lib/garbage/resolve.ts`**

ใน object literal ที่ `buildDaySchedule` สร้าง เพิ่มบรรทัดต่อจาก `routeName: route?.name ?? null,`:

```ts
      routeNeedsVerification: route?.needsVerification ?? false,
```

- [ ] **Step 5: รันเทสให้ผ่าน**

Run: `npx vitest run lib/garbage/resolve.test.ts && npx tsc --noEmit`
Expected: PASS ทุกเทส (ของเดิม 13 + ใหม่ 2 = 15) และ tsc เงียบ

- [ ] **Step 6: Commit**

```bash
git add types/garbage.ts lib/garbage/resolve.ts lib/garbage/resolve.test.ts
git commit -m "feat: expose routeNeedsVerification in resolved assignments"
```

---

## Task 5: `buildWeekSchedule` + `resolveWeekSchedule`

แยก logic ล้วน (`buildWeekSchedule` — เทสได้ ไม่ต้องมี MongoDB) ออกจากการอ่านข้อมูล (`resolveWeekSchedule` — อ่าน DB **รอบเดียว** สำหรับทั้ง 7 วัน แทนการยิงรายวัน 7 ครั้ง = 21 คิวรี)

การกรองช่วงเวลาที่มีผล (`effectiveFrom`/`effectiveTo`) ต้องทำ**ต่อวัน** เพราะแต่ละวันมีจุดอ้างอิงเวลาต่างกัน จึงคิวรีด้วยกรอบกว้างสุดของสัปดาห์แล้วกรองละเอียดใน JS

**Files:**
- Modify: `lib/garbage/resolve.ts`
- Test: `lib/garbage/resolve.test.ts`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

เพิ่มท้าย `lib/garbage/resolve.test.ts` และเพิ่ม `buildWeekSchedule` เข้าไปใน import statement ที่มีอยู่:

```ts
describe("buildWeekSchedule", () => {
  const week = [
    "2026-08-09", "2026-08-10", "2026-08-11", "2026-08-12",
    "2026-08-13", "2026-08-14", "2026-08-15",
  ];

  it("คืนครบ 7 วันเรียงตามลำดับที่ส่งเข้ามา", () => {
    const out = buildWeekSchedule(week, [], routes, trucks);
    expect(out).toHaveLength(7);
    expect(out.map((d) => d.date)).toEqual(week);
    expect(out.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("วันที่ไม่มีข้อมูลต้องมีอยู่ในผลลัพธ์ด้วย assignments ว่าง", () => {
    const a: Assignment[] = [
      { ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 300, stopTimes: [] },
    ];
    const out = buildWeekSchedule(week, a, routes, trucks);
    expect(out[1].assignments).toHaveLength(1); // จันทร์
    expect(out[3].assignments).toEqual([]); // พุธ — ยังไม่มีข้อมูล ต้องไม่หายไป
    expect(out.filter((d) => d.assignments.length === 0)).toHaveLength(6);
  });

  it("แยกงานของแต่ละวันไม่ปนกัน", () => {
    const a: Assignment[] = [
      { ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 300, stopTimes: [] },
      { ...base, weekday: 2, shiftNo: 1, truckNumber: 5, routeCode: "R1", kind: "normal", startMin: 250, endMin: 310, stopTimes: [] },
    ];
    const out = buildWeekSchedule(week, a, routes, trucks);
    expect(out[1].assignments.map((x) => x.truckNumber)).toEqual([1]);
    expect(out[2].assignments.map((x) => x.truckNumber)).toEqual([5]);
  });

  it("ตัดงานที่ยังไม่มีผลหรือหมดอายุแล้วออกรายวัน", () => {
    const a: Assignment[] = [
      // เริ่มมีผลวันอังคาร 2026-08-11 → วันจันทร์ต้องไม่เห็น
      { ...base, effectiveFrom: new Date("2026-08-11T00:00:00+07:00"), weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 300, stopTimes: [] },
    ];
    const out = buildWeekSchedule(week, a, routes, trucks);
    expect(out[1].assignments).toEqual([]);

    const b: Assignment[] = [
      // ใช้ได้ถึงวันจันทร์ 2026-08-10 (inclusive) → วันจันทร์เห็น
      { ...base, effectiveTo: new Date("2026-08-10T00:00:00+07:00"), weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 300, stopTimes: [] },
    ];
    expect(buildWeekSchedule(week, b, routes, trucks)[1].assignments).toHaveLength(1);
  });

  it("เลือกเวอร์ชันล่าสุดแยกกันในแต่ละวัน", () => {
    const a: Assignment[] = [
      { ...base, effectiveFrom: new Date("2026-01-01"), weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 300, stopTimes: [] },
      { ...base, effectiveFrom: new Date("2026-07-01"), weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 260, endMin: 320, stopTimes: [] },
    ];
    const out = buildWeekSchedule(week, a, routes, trucks);
    expect(out[1].assignments).toHaveLength(1);
    expect(out[1].assignments[0].startMin).toBe(260);
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run lib/garbage/resolve.test.ts`
Expected: FAIL — `buildWeekSchedule is not a function`

- [ ] **Step 3: เพิ่ม implementation ใน `lib/garbage/resolve.ts`**

แก้ import ของ time ที่หัวไฟล์ให้รวม `weekDatesOf`:

```ts
import { weekDatesOf, weekdayOf } from "./time";
```

แล้วเพิ่มสองฟังก์ชันนี้ท้ายไฟล์:

```ts
/** งานมอบหมายนี้มีผลในวันที่อ้างอิงหรือไม่ — effectiveTo คือวันสุดท้ายที่ยังใช้ (inclusive) */
function isEffectiveOn(a: Assignment, at: Date): boolean {
  return a.effectiveFrom <= at && (a.effectiveTo == null || a.effectiveTo >= at);
}

/**
 * logic บริสุทธิ์ — ไม่แตะฐานข้อมูล เพื่อให้เทสต์ได้
 * dates เรียงลำดับอย่างไร ผลลัพธ์เรียงอย่างนั้น (ผู้เรียกใช้ weekDatesOf จึงได้อาทิตย์→เสาร์)
 * วันที่ไม่มีงานยังต้องอยู่ในผลลัพธ์ด้วย assignments ว่าง — ฝั่ง UI ใช้บอกว่าวันไหนรอข้อมูล
 */
export function buildWeekSchedule(
  dates: string[],
  list: Assignment[],
  routes: Route[],
  trucks: Truck[]
): ResolvedDaySchedule[] {
  return dates.map((date) => {
    const weekday = weekdayOf(date);
    const at = new Date(`${date}T00:00:00+07:00`);
    const forDay = list.filter((a) => a.weekday === weekday && isEffectiveOn(a, at));
    return buildDaySchedule(date, weekday, pickLatestVersions(forDay), routes, trucks);
  });
}

/**
 * อ่านฐานข้อมูล "รอบเดียว" แล้วประกอบตารางทั้งสัปดาห์ที่ครอบวันที่ระบุ
 * คิวรีด้วยกรอบกว้างสุดของสัปดาห์ แล้วกรองช่วงมีผลละเอียดต่อวันใน buildWeekSchedule
 */
export async function resolveWeekSchedule(date: string): Promise<ResolvedDaySchedule[]> {
  const dates = weekDatesOf(date);
  const weekStart = new Date(`${dates[0]}T00:00:00+07:00`);
  const weekEnd = new Date(`${dates[6]}T00:00:00+07:00`);

  const [aCol, rCol, tCol] = await Promise.all([assignmentsCol(), routesCol(), trucksCol()]);
  const [rawAssignments, allRoutes, allTrucks] = await Promise.all([
    aCol
      .find({
        effectiveFrom: { $lte: weekEnd },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gte: weekStart } }],
      })
      .sort({ effectiveFrom: -1, _id: -1 })
      .toArray(),
    rCol.find({ active: true }).toArray(),
    tCol.find({}).toArray(),
  ]);

  return buildWeekSchedule(dates, rawAssignments, allRoutes, allTrucks);
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `npx vitest run lib/garbage/resolve.test.ts && npx tsc --noEmit`
Expected: PASS ทุกเทส (15 + ใหม่ 5 = 20) และ tsc เงียบ

- [ ] **Step 5: Commit**

```bash
git add lib/garbage/resolve.ts lib/garbage/resolve.test.ts
git commit -m "feat: add week schedule resolver reading the database once"
```

---

## Task 6: API `GET /api/garbage/week`

**Files:**
- Create: `pages/api/garbage/week.ts`

- [ ] **Step 1: เขียน API route**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { resolveWeekSchedule } from "@/lib/garbage/resolve";
import { resolveDateParam } from "@/lib/garbage/time";

/**
 * ตารางทั้งสัปดาห์ที่ครอบวันที่ระบุ เรียงอาทิตย์→เสาร์ (days.length === 7 เสมอ)
 * เปิดสาธารณะเหมือน /api/garbage/schedule — เป็นข้อมูลชุดเดียวกัน ไม่มีข้อมูลใหม่รั่ว
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }

  const date = resolveDateParam(req.query.date);
  if (date == null) {
    return res.status(400).json({ error: "รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD" });
  }

  try {
    const days = await resolveWeekSchedule(date);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ startDate: days[0].date, endDate: days[6].date, days });
  } catch (err) {
    console.error("[garbage/week]", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอ่านข้อมูล" });
  }
}
```

- [ ] **Step 2: ทดสอบกับข้อมูลจริง**

รัน dev server ค้างไว้ (`npm run dev` — จดพอร์ตที่ได้ สมมติ 3001) แล้ว:

```bash
curl -s "http://localhost:3001/api/garbage/week?date=2026-08-12" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('ช่วง',j.startDate,'ถึง',j.endDate,'| วัน',j.days.length);j.days.forEach(d=>console.log(' ',d.date,'wd'+d.weekday,d.assignments.length+' งาน'))})"
```
Expected: `ช่วง 2026-08-09 ถึง 2026-08-15 | วัน 7` และมีงานเฉพาะ `2026-08-10` (7 งาน) กับ `2026-08-11` (10 งาน) ที่เหลือ 0 งาน

- [ ] **Step 3: ทดสอบ input ผิดและ method ผิด**

```bash
curl -s -o /dev/null -w "date ผิด: %{http_code}\n" "http://localhost:3001/api/garbage/week?date=2026-02-30"
curl -s -o /dev/null -w "POST: %{http_code}\n" -X POST "http://localhost:3001/api/garbage/week"
curl -s -D - -o /dev/null "http://localhost:3001/api/garbage/week" | grep -i cache-control
```
Expected: `date ผิด: 400` · `POST: 405` · `cache-control: public, s-maxage=300, stale-while-revalidate=600`

- [ ] **Step 4: Commit**

```bash
git add pages/api/garbage/week.ts
git commit -m "feat: add public week schedule API endpoint"
```

---

## Task 7: ค่าตั้งค่าโมดูล — model, validator, API

เบอร์ติดต่อกองสาธารณสุขต้องแก้ได้จากหน้าแอดมิน ไม่ hardcode และไม่ต้อง redeploy · เก็บเป็น singleton doc (`key: "default"`) ตามแบบ `Pm25Settings` แต่ใช้ native driver ให้เข้ากับโมดูลนี้

**Files:**
- Modify: `types/garbage.ts`
- Modify: `lib/garbage/db.ts`
- Modify: `lib/garbage/validators.ts`
- Create: `pages/api/garbage/_auth.ts`
- Create: `pages/api/garbage/settings.ts`

- [ ] **Step 1: เพิ่ม type ท้าย `types/garbage.ts`**

```ts
/** ค่าตั้งค่าการแสดงผลของโมดูล — singleton doc key = "default" ใน garbage_settings */
export interface GarbageSettings {
  key: string;
  contactPhone: string | null;
  contactNote: string | null;
  updatedBy: string | null;
}
```

- [ ] **Step 2: เพิ่ม accessor และ index ใน `lib/garbage/db.ts`**

เพิ่ม `GarbageSettings` เข้าไปใน import type ที่มีอยู่ แล้วเพิ่ม accessor ต่อจาก `assignments()`:

```ts
export async function settings(): Promise<Collection<GarbageSettings>> {
  return (await getDb()).collection<GarbageSettings>("garbage_settings");
}
```

และเพิ่มบรรทัดนี้ใน `ensureIndexes()`:

```ts
  await db.collection("garbage_settings").createIndex({ key: 1 }, { unique: true });
```

- [ ] **Step 3: เพิ่ม validator ท้าย `lib/garbage/validators.ts`**

```ts
/** ฟอร์มตั้งค่าจากหน้าแอดมิน — ค่าว่างถือเป็น null (ล้างค่า) */
const optionalTrimmed = (max: number, message: string) =>
  z
    .string()
    .max(max, message)
    .nullable()
    .optional()
    .transform((v) => {
      const s = typeof v === "string" ? v.trim() : v;
      return s == null || s === "" ? null : s;
    });

export const garbageSettingsInputSchema = z
  .object({
    contactPhone: optionalTrimmed(30, "เบอร์ติดต่อยาวเกิน 30 ตัวอักษร").refine(
      (v) => v == null || /^[0-9\s\-()+]{6,30}$/u.test(v),
      "เบอร์ติดต่อต้องมีแต่ตัวเลข เว้นวรรค ขีด วงเล็บ หรือ + และยาว 6–30 ตัวอักษร"
    ),
    contactNote: optionalTrimmed(200, "หมายเหตุยาวเกิน 200 ตัวอักษร"),
  })
  .strict();
```

- [ ] **Step 4: สร้าง `pages/api/garbage/_auth.ts`**

คัดลอกแนวจาก `pages/api/pm25/_auth.js` (มาตรฐานของรีโป) แต่เป็น TypeScript และเช็คสิทธิ์ด้วย `pathMatchesPermission` ตามที่ CLAUDE.md บังคับ (ห้ามเขียน startsWith เอง):

```ts
import type { NextApiRequest } from "next";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import dbConnect from "@/lib/dbConnect";
import { pathMatchesPermission } from "@/lib/permissions";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
const REQUIRED_PAGE = "/admin/garbage";

export type GarbageAdminResult =
  | { ok: true; userId: string; isSuperAdmin: boolean }
  | { ok: false; status: 401 | 403; message: string };

/** ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์อีกครั้ง — ห้ามเชื่อฝั่ง client */
export async function requireGarbageAdmin(req: NextApiRequest): Promise<GarbageAdminResult> {
  const { userId } = getAuth(req);
  if (!userId) return { ok: false, status: 401, message: "ต้องเข้าสู่ระบบก่อน" };

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  if (clerkUser.publicMetadata?.role === "superadmin") {
    return { ok: true, userId, isSuperAdmin: true };
  }

  await dbConnect();
  // schema ย่อแบบ inline ตามแบบเดียวกับ pages/api/pm25/_auth.js
  const UserSchema = new mongoose.Schema(
    {
      clerkId: String,
      role: String,
      appId: { type: String, default: "" },
      allowedPages: { type: [String], default: [] },
      name: String,
    },
    { collection: "users", timestamps: true }
  );
  const User = mongoose.models.User || mongoose.model("User", UserSchema);
  const mongoUser = await User.findOne({ clerkId: userId }).lean<{
    appId?: string;
    allowedPages?: string[];
  } | null>();

  if (!mongoUser) return { ok: false, status: 403, message: "ยังไม่ได้ลงทะเบียนผู้ใช้" };
  if (!mongoUser.appId || mongoUser.appId !== CURRENT_APP_ID) {
    return { ok: false, status: 403, message: "ไม่มีสิทธิ์เข้าใช้แอปนี้" };
  }

  const allowed = Array.isArray(mongoUser.allowedPages) ? mongoUser.allowedPages : [];
  const hasPageAccess =
    allowed.length === 0 || allowed.some((p) => pathMatchesPermission(REQUIRED_PAGE, p));
  if (!hasPageAccess) return { ok: false, status: 403, message: "ไม่มีสิทธิ์หน้านี้" };

  return { ok: true, userId, isSuperAdmin: false };
}
```

- [ ] **Step 5: สร้าง `pages/api/garbage/settings.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { settings as settingsCol } from "@/lib/garbage/db";
import { garbageSettingsInputSchema } from "@/lib/garbage/validators";
import { requireGarbageAdmin } from "./_auth";

const SETTINGS_KEY = "default";

/** GET เปิดสาธารณะ (หน้าประชาชนต้องอ่านเบอร์ไปแสดง) · PUT ต้องล็อกอินและมีสิทธิ์หน้า /admin/garbage */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const col = await settingsCol();

  if (req.method === "GET") {
    try {
      const doc = await col.findOne({ key: SETTINGS_KEY });
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
      return res.status(200).json({
        contactPhone: doc?.contactPhone ?? null,
        contactNote: doc?.contactNote ?? null,
      });
    } catch (err) {
      console.error("[garbage/settings] GET", err);
      return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอ่านข้อมูล" });
    }
  }

  if (req.method === "PUT") {
    const auth = await requireGarbageAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

    const parsed = garbageSettingsInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
    }

    try {
      const now = new Date();
      await col.updateOne(
        { key: SETTINGS_KEY },
        {
          $set: { ...parsed.data, updatedBy: auth.userId, updatedAt: now },
          $setOnInsert: { key: SETTINGS_KEY, createdAt: now },
        },
        { upsert: true }
      );
      return res.status(200).json({ contactPhone: parsed.data.contactPhone, contactNote: parsed.data.contactNote });
    } catch (err) {
      console.error("[garbage/settings] PUT", err);
      return res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "รองรับเฉพาะ GET และ PUT" });
}
```

- [ ] **Step 6: ทดสอบ**

```bash
npx tsc --noEmit
curl -s "http://localhost:3001/api/garbage/settings"
curl -s -o /dev/null -w "PUT ไม่ล็อกอิน: %{http_code}\n" -X PUT -H "Content-Type: application/json" \
  -d '{"contactPhone":"056-123456"}' "http://localhost:3001/api/garbage/settings"
curl -s -o /dev/null -w "DELETE: %{http_code}\n" -X DELETE "http://localhost:3001/api/garbage/settings"
```
Expected: tsc เงียบ · GET คืน `{"contactPhone":null,"contactNote":null}` (ยังไม่มี doc) · `PUT ไม่ล็อกอิน: 401` · `DELETE: 405`

- [ ] **Step 7: Commit**

```bash
git add types/garbage.ts lib/garbage/db.ts lib/garbage/validators.ts pages/api/garbage/_auth.ts pages/api/garbage/settings.ts
git commit -m "feat: add garbage module settings with admin-only write"
```

---

## Task 8: ย้าย `SearchHit` ไป `types/garbage.ts`

หน้าประชาชนต้องใช้ type เดียวกับที่ API ส่งออก ตอนนี้ `SearchHit` ประกาศอยู่ใน `pages/api/garbage/search.ts` แบบไม่ export

**Files:**
- Modify: `types/garbage.ts`
- Modify: `pages/api/garbage/search.ts`

- [ ] **Step 1: เพิ่ม type ท้าย `types/garbage.ts`**

```ts
/** ผลค้นหาหนึ่งรายการจาก /api/garbage/search — ใช้ร่วมกันทั้งฝั่ง API และหน้าเว็บ */
export interface SearchHit {
  matchType: "stop" | "community";
  matchName: string;
  routeCode: string;
  routeName: string;
  weekday: number;
  weekdayName: string;
  truckNumber: number;
  kind: AssignmentKind;
  coverForRouteCode: string | null;
  startMin: Minutes | null;
  endMin: Minutes | null;
  atMin: Minutes | null;
}
```

- [ ] **Step 2: ให้ `pages/api/garbage/search.ts` ใช้ type กลาง**

ลบ `interface SearchHit { ... }` ทั้งบล็อกในไฟล์นั้นออก แล้วเพิ่ม `SearchHit` เข้าไปใน import type ที่มีอยู่จาก `@/types/garbage` (ถ้าไฟล์ยังไม่มี import type จาก types/garbage ให้เพิ่มบรรทัดใหม่ `import type { SearchHit } from "@/types/garbage";`)

- [ ] **Step 3: ยืนยันว่า API ยังตอบเหมือนเดิม**

```bash
npx tsc --noEmit
curl -s -G --data-urlencode "q=มาลัย" "http://localhost:3001/api/garbage/search" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('count',j.count);console.log(Object.keys(j.hits[0]).join(','))})"
```
Expected: tsc เงียบ · `count 6` · คีย์ครบ 12 ตัวเท่าเดิมรวม `kind` และ `coverForRouteCode`

- [ ] **Step 4: Commit**

```bash
git add types/garbage.ts pages/api/garbage/search.ts
git commit -m "refactor: share SearchHit type between API and UI"
```

---

## Task 9: หน้าประชาชน — ช่องค้นหา

**Files:**
- Create: `components/garbage/useDebounce.ts`
- Create: `components/garbage/GarbageSearchPanel.tsx`

- [ ] **Step 1: สร้างฮุค debounce**

```ts
// components/garbage/useDebounce.ts
import { useEffect, useState } from "react";

/** หน่วงค่าไว้ก่อนยิง API — แนวเดียวกับฮุคใน pages/admin/manage-complaints.jsx */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
```

- [ ] **Step 2: สร้าง `components/garbage/GarbageSearchPanel.tsx`**

จุดที่ต้องระวัง: gate ที่ 2 ตัวอักษรฝั่ง client (API ตอบ 400 ถ้าน้อยกว่า) · `reqIdRef` กันผลเก่าแซงผลใหม่ · อ่าน error จาก `json.error` · ห้ามฟอร์แมตเวลาเอง

```tsx
import { useEffect, useRef, useState } from "react";
import type { SearchHit } from "@/types/garbage";
import { formatRange, formatThaiTime } from "@/lib/garbage/time";
import { KIND_LABEL_TH } from "@/lib/garbage/labels";
import { useDebounce } from "./useDebounce";

const MIN_CHARS = 2;

/** จัดกลุ่มผลลัพธ์ตามวัน โดยคงลำดับที่ API ส่งมา (เรียงวันแล้วเรียงเวลาแล้ว) */
function groupByWeekday(hits: SearchHit[]): Array<{ weekday: number; weekdayName: string; hits: SearchHit[] }> {
  const groups: Array<{ weekday: number; weekdayName: string; hits: SearchHit[] }> = [];
  for (const h of hits) {
    const last = groups[groups.length - 1];
    if (last && last.weekday === h.weekday) last.hits.push(h);
    else groups.push({ weekday: h.weekday, weekdayName: h.weekdayName, hits: [h] });
  }
  return groups;
}

function timeText(h: SearchHit): string {
  if (h.atMin != null) return `รถถึงประมาณ ${formatThaiTime(h.atMin)}`;
  const range = formatRange(h.startMin, h.endMin);
  return range ? `ช่วง ${range}` : "ยังไม่ระบุเวลา";
}

export default function GarbageSearchPanel() {
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term.trim(), 300);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (debounced.length < MIN_CHARS) {
      setHits(null);
      setError("");
      setLoading(false);
      return;
    }
    const myId = ++reqIdRef.current;
    let alive = true;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ q: debounced });
        const res = await fetch(`/api/garbage/search?${params}`);
        const json = await res.json();
        if (!alive || myId !== reqIdRef.current) return;
        // API ชุดนี้คืน { error } ไม่ใช่ { success, message }
        if (!res.ok) throw new Error(json?.error || "ค้นหาไม่สำเร็จ");
        setHits(json.hits ?? []);
      } catch (e: unknown) {
        if (!alive || myId !== reqIdRef.current) return;
        setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
        setHits(null);
      } finally {
        if (alive && myId === reqIdRef.current) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [debounced]);

  const groups = hits ? groupByWeekday(hits) : [];

  return (
    <section className="rounded-3xl bg-white/80 ring-1 ring-slate-200 p-4">
      <h2 className="text-base font-semibold text-slate-800">ค้นหาถนนหรือชุมชนของคุณ</h2>
      <p className="text-xs text-slate-500 mt-0.5">พิมพ์ชื่อถนน ซอย หรือชุมชน เช่น มาลัย · ใส่คำนำหน้าหรือไม่ก็ได้</p>

      <input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="เช่น มาลัย, ชุมชนสามัคคี"
        className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm
          focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        aria-label="ค้นหาถนนหรือชุมชน"
      />

      {term.trim().length > 0 && term.trim().length < MIN_CHARS && (
        <p className="mt-2 text-xs text-slate-500">พิมพ์อีก {MIN_CHARS - term.trim().length} ตัวอักษรเพื่อเริ่มค้นหา</p>
      )}

      {loading && <p className="mt-3 text-sm text-slate-500">กำลังค้นหา...</p>}

      {error && (
        <div className="mt-3 rounded-2xl bg-amber-50/80 ring-1 ring-amber-200 p-4">
          <p className="font-semibold text-amber-900 text-sm">ค้นหาไม่ได้</p>
          <p className="text-xs text-amber-800 mt-1">{error}</p>
        </div>
      )}

      {!loading && !error && hits != null && hits.length === 0 && (
        <p className="mt-3 text-sm text-slate-600">
          ไม่พบ &ldquo;{debounced}&rdquo; — ลองพิมพ์ชื่อถนนหรือชุมชนให้สั้นลง เช่น ตัดคำว่า ซอย ออก
        </p>
      )}

      {!loading && !error && groups.length > 0 && (
        <div className="mt-4 space-y-4">
          {groups.map((g) => (
            <div key={g.weekday}>
              <div className="text-sm font-semibold text-emerald-800">วัน{g.weekdayName}</div>
              <ul className="mt-1.5 space-y-1.5">
                {g.hits.map((h, i) => (
                  <li key={`${h.routeCode}-${h.matchName}-${i}`}
                    className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800">{h.matchName}</span>
                      <span className="text-xs text-slate-500 whitespace-nowrap">รถ {h.truckNumber}</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">{timeText(h)}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {h.routeName}
                      {KIND_LABEL_TH[h.kind] && (
                        <span className="ml-1.5 inline-block rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">
                          {KIND_LABEL_TH[h.kind]}
                          {h.coverForRouteCode ? ` ${h.coverForRouteCode}` : ""}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: ยืนยัน type**

Run: `npx tsc --noEmit`
Expected: เงียบ (ยังไม่มีหน้าเรียกใช้ — Task 11 จะประกอบ)

- [ ] **Step 4: Commit**

```bash
git add components/garbage/useDebounce.ts components/garbage/GarbageSearchPanel.tsx
git commit -m "feat: add public garbage search panel"
```

---

## Task 10: หน้าประชาชน — สถานะรถวันนี้ และแถบบอกวันที่ยังไม่มีข้อมูล

**Files:**
- Create: `components/garbage/TodayTruckPanel.tsx`
- Create: `components/garbage/CoverageNote.tsx`

- [ ] **Step 1: สร้าง `components/garbage/TodayTruckPanel.tsx`**

จุดที่ต้องระวัง: poll ทุก 60 วิ ด้วย `alive` flag + `clearInterval` · **ยิงพลาดต้องคงข้อมูลเดิมไว้** ห้ามล้างจอเป็นว่าง

```tsx
import { useEffect, useState } from "react";
import type { LivePosition, TruckColor, AssignmentKind } from "@/types/garbage";
import { formatThaiTime, minutesNowInBangkok } from "@/lib/garbage/time";
import { LIVE_STATUS_TH } from "@/lib/garbage/labels";

interface LiveTruck {
  truckNumber: number;
  truckColor: TruckColor;
  shiftNo: number;
  kind: AssignmentKind;
  routeCode: string | null;
  label: string | null;
  live: LivePosition;
}

const POLL_MS = 60_000;

const STATUS_CLS: Record<string, string> = {
  running: "bg-emerald-100 text-emerald-800",
  upcoming: "bg-sky-100 text-sky-800",
  finished: "bg-slate-200 text-slate-600",
  unknown: "bg-slate-100 text-slate-500",
};

export default function TodayTruckPanel() {
  const [trucks, setTrucks] = useState<LiveTruck[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const res = await fetch("/api/garbage/live");
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(json?.error || "โหลดสถานะไม่สำเร็จ");
        setTrucks(json.trucks ?? []);
        setUpdatedAt(formatThaiTime(minutesNowInBangkok()));
        setFailed(false);
      } catch {
        if (!alive) return;
        // คงข้อมูลเดิมไว้ ชาวบ้านกำลังดูอยู่ — แค่ทำเครื่องหมายว่าอัปเดตล่าสุดไม่สำเร็จ
        setFailed(true);
      }
    };
    run();
    const t = setInterval(run, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (trucks == null) {
    return (
      <section className="rounded-3xl bg-white/80 ring-1 ring-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-800">รถวันนี้</h2>
        <p className="mt-2 text-sm text-slate-500">{failed ? "โหลดสถานะไม่สำเร็จ" : "กำลังโหลด..."}</p>
      </section>
    );
  }

  const working = trucks.filter((t) => t.kind !== "day_off");
  const dayOff = trucks.filter((t) => t.kind === "day_off");

  return (
    <section className="rounded-3xl bg-white/80 ring-1 ring-slate-200 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-800">รถวันนี้</h2>
        {updatedAt && (
          <span className="text-[11px] text-slate-400">
            อัปเดต {updatedAt}{failed ? " (ล่าสุดที่โหลดได้)" : ""}
          </span>
        )}
      </div>

      {working.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">วันนี้ยังไม่มีตารางเดินรถในระบบ</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {working.map((t) => (
            <li key={`${t.truckNumber}-${t.shiftNo}`}
              className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2">
              <div className="flex items-center gap-2">
                <span aria-hidden className={"h-2.5 w-2.5 rounded-full " +
                  (t.truckColor === "yellow" ? "bg-amber-400" : "bg-emerald-500")} />
                <span className="text-sm font-medium text-slate-800">รถ {t.truckNumber}</span>
                {t.routeCode && <span className="text-xs text-slate-500">{t.routeCode}</span>}
                <span className={"ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full " +
                  (STATUS_CLS[t.live.status] ?? STATUS_CLS.unknown)}>
                  {LIVE_STATUS_TH[t.live.status]}
                  {t.live.status === "upcoming" && t.live.startsInMin != null && ` · อีก ${t.live.startsInMin} นาที`}
                </span>
              </div>
              {t.live.status === "running" && (
                <div className="text-xs text-slate-600 mt-1">
                  {t.live.currentStop ? `กำลังอยู่ ${t.live.currentStop.name}` : "กำลังวิ่งตามเส้นทาง"}
                  {t.live.nextStop && (
                    <> · ถัดไป {t.live.nextStop.name}
                      {t.live.etaNextMin != null && ` (อีก ${t.live.etaNextMin} นาที)`}</>
                  )}
                </div>
              )}
              {t.label && <div className="text-[11px] text-slate-500 mt-0.5">{t.label}</div>}
            </li>
          ))}
        </ul>
      )}

      {dayOff.length > 0 && (
        <p className="mt-2.5 text-xs text-slate-500">
          วันนี้หยุด: รถ {dayOff.map((t) => t.truckNumber).join(", ")}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: สร้าง `components/garbage/CoverageNote.tsx`**

```tsx
import { weekdayName } from "@/lib/garbage/labels";

interface Props {
  /** เลขวันในสัปดาห์ที่ยังไม่มีตารางในระบบ */
  emptyWeekdays: number[];
  contactPhone: string | null;
  contactNote: string | null;
}

/** แถบบอกความครอบคลุมข้อมูล — ตอนนี้มีเฉพาะวันจันทร์กับอังคาร ต้องบอกตรง ๆ ว่ารออีก 5 วัน */
export default function CoverageNote({ emptyWeekdays, contactPhone, contactNote }: Props) {
  if (emptyWeekdays.length === 0) return null;
  const names = emptyWeekdays.map((w) => `วัน${weekdayName(w)}`).join(" ");
  return (
    <div className="rounded-3xl bg-sky-50/90 ring-1 ring-sky-200/80 p-4">
      <p className="text-sm font-medium text-sky-900">ตารางบางวันยังอยู่ระหว่างจัดทำ</p>
      <p className="text-xs text-sky-900/80 mt-1">
        {names} ยังไม่มีข้อมูลในระบบ กองสาธารณสุขและสิ่งแวดล้อมกำลังจัดทำเพิ่ม
      </p>
      {contactNote && <p className="text-xs text-sky-900/80 mt-1">{contactNote}</p>}
      {contactPhone && (
        <p className="text-xs text-sky-900 mt-1.5">
          สอบถามเพิ่มเติม{" "}
          <a href={`tel:${contactPhone.replace(/[^0-9+]/gu, "")}`} className="font-semibold underline">
            {contactPhone}
          </a>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: ยืนยัน type**

Run: `npx tsc --noEmit`
Expected: เงียบ

- [ ] **Step 4: Commit**

```bash
git add components/garbage/TodayTruckPanel.tsx components/garbage/CoverageNote.tsx
git commit -m "feat: add live truck panel and data coverage note"
```

---

## Task 11: หน้า `/garbage`

**Files:**
- Create: `pages/garbage.tsx`

- [ ] **Step 1: เขียนหน้า**

`components/Layout.js` ใส่ `TopNavbar` + `BottomNav` + padding ให้แล้ว หน้านี้จึงเรนเดอร์แค่เนื้อหา **ห้ามใส่ `<main>` หรือ header ของตัวเอง**

```tsx
import { useEffect, useState } from "react";
import Head from "next/head";
import type { ResolvedDaySchedule } from "@/types/garbage";
import GarbageSearchPanel from "@/components/garbage/GarbageSearchPanel";
import TodayTruckPanel from "@/components/garbage/TodayTruckPanel";
import CoverageNote from "@/components/garbage/CoverageNote";

interface Settings {
  contactPhone: string | null;
  contactNote: string | null;
}

export default function GarbagePage() {
  const [emptyWeekdays, setEmptyWeekdays] = useState<number[]>([]);
  const [settings, setSettings] = useState<Settings>({ contactPhone: null, contactNote: null });

  // ยิงครั้งเดียวตอนเปิด — ใช้รู้ว่าวันไหน "ไม่มีตารางเลย" (จาก /search อย่างเดียวแยกไม่ออก)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const [weekRes, settingsRes] = await Promise.all([
          fetch("/api/garbage/week"),
          fetch("/api/garbage/settings"),
        ]);
        const weekJson = await weekRes.json();
        const settingsJson = await settingsRes.json();
        if (!alive) return;
        if (weekRes.ok && Array.isArray(weekJson?.days)) {
          setEmptyWeekdays(
            (weekJson.days as ResolvedDaySchedule[])
              .filter((d) => d.assignments.length === 0)
              .map((d) => d.weekday)
          );
        }
        if (settingsRes.ok) {
          setSettings({
            contactPhone: settingsJson?.contactPhone ?? null,
            contactNote: settingsJson?.contactNote ?? null,
          });
        }
      } catch {
        // โหลดข้อมูลประกอบไม่ได้ก็ไม่เป็นไร — ช่องค้นหายังใช้งานได้ปกติ
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <Head>
        <title>ตารางรถเก็บขยะ | เทศบาลเมืองตาคลี</title>
        <meta name="description" content="ค้นหาว่ารถเก็บขยะเข้าถนนหรือชุมชนของคุณวันไหน เวลาไหน" />
      </Head>

      <div className="max-w-screen-sm mx-auto w-full space-y-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800">ตารางรถเก็บขยะ</h1>
          <p className="text-xs text-slate-500 mt-0.5">เทศบาลเมืองตาคลี · กองสาธารณสุขและสิ่งแวดล้อม</p>
        </div>

        <GarbageSearchPanel />
        <TodayTruckPanel />
        <CoverageNote
          emptyWeekdays={emptyWeekdays}
          contactPhone={settings.contactPhone}
          contactNote={settings.contactNote}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 2: ทดสอบบน dev server**

เปิด `http://localhost:3001/garbage` แล้วตรวจ:
- พิมพ์ `มา` → ยังไม่ยิง (ข้อความบอกให้พิมพ์อีก) · พิมพ์ `มาลัย` → เห็นผลจัดกลุ่ม "วันจันทร์" มีทั้งชื่อถนนและชื่อชุมชน
- พิมพ์ `ซ.มาลัย` → ได้ผลเหมือน `มาลัย`
- พิมพ์ `zzzz` → ข้อความ "ไม่พบ..." ไม่ใช่กล่อง error
- ส่วน "รถวันนี้" แสดงผล (วันนี้เป็นวันพฤหัสบดี 2026-08-13 → ไม่มีตาราง จึงขึ้น "วันนี้ยังไม่มีตารางเดินรถในระบบ")
- แถบสีฟ้าล่างสุดระบุวันพุธ พฤหัสบดี ศุกร์ เสาร์ อาทิตย์ ว่ายังไม่มีข้อมูล (ยังไม่มีเบอร์โทรเพราะยังไม่ได้ตั้งค่า)
- มี TopNavbar และ BottomNav ครบ (มาจาก Layout) และไม่มี header ซ้อนกัน

- [ ] **Step 3: ตรวจ type และ build**

Run: `npx tsc --noEmit && npm run build`
Expected: เงียบ และ build ผ่าน โดย manifest มี `/garbage`

- [ ] **Step 4: Commit**

```bash
git add pages/garbage.tsx
git commit -m "feat: add public garbage schedule page"
```

---

## Task 12: การ์ดทางเข้าบนหน้าแรก

**Files:**
- Create: `components/garbage/GarbageHomeCard.tsx`
- Modify: `pages/index.tsx`

- [ ] **Step 1: สร้างการ์ด**

ยิง `/api/garbage/live` ครั้งเดียว **ไม่ poll** (หน้าแรกมีการ์ดอื่นที่ poll อยู่แล้ว ไม่ควรเพิ่มภาระ) · โหลดไม่ได้ให้แสดงข้อความชวนกดเฉย ๆ ห้ามโชว์ error บนหน้าแรก

```tsx
import { useEffect, useState } from "react";
import Link from "next/link";

interface LiveTruckLite {
  kind: string;
  live: { status: string };
}

/** การ์ดทางเข้าหน้า /garbage บนหน้าแรก — เพิ่มแบบ hardcode เพราะกริดเมนูดึงจาก backend ภายนอกและเปิดได้แค่ modal */
export default function GarbageHomeCard({ className = "" }: { className?: string }) {
  const [runningCount, setRunningCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/garbage/live");
        const json = await res.json();
        if (!alive || !res.ok) return;
        const trucks: LiveTruckLite[] = json?.trucks ?? [];
        setRunningCount(trucks.filter((t) => t.live?.status === "running").length);
      } catch {
        // เงียบไว้ — หน้าแรกไม่ควรมีกล่อง error
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Link href="/garbage"
      className={"block rounded-xl shadow-md bg-white/30 backdrop-blur-md p-4 " +
        "hover:shadow-lg transition " + className}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-2xl">🚛</span>
        <div className="min-w-0">
          <div className="font-bold text-gray-700 text-sm">ตารางรถเก็บขยะ</div>
          <div className="text-xs text-gray-600 mt-0.5">
            {runningCount != null && runningCount > 0
              ? `ขณะนี้มีรถกำลังวิ่ง ${runningCount} คัน · กดดูตารางของคุณ`
              : "ค้นหาว่ารถเข้าถนนของคุณวันไหน"}
          </div>
        </div>
        <span aria-hidden className="ml-auto text-gray-400">›</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: แทรกในหน้าแรก**

ใน `pages/index.tsx` เพิ่ม import:

```tsx
import GarbageHomeCard from "@/components/garbage/GarbageHomeCard";
```

แล้ววางการ์ดต่อจาก `</div>` ที่ปิดกริดเมนู (กริดที่ map `menu.map((item: MenuItem, index) => ...)`) ก่อนบล็อกหัวข้อ SMART-HEALTH:

```tsx
        <div className="mt-4">
          <GarbageHomeCard />
        </div>
```

- [ ] **Step 3: ทดสอบ**

เปิด `http://localhost:3001/` → เห็นการ์ด "ตารางรถเก็บขยะ" ใต้กริดไอคอน กดแล้วไปหน้า `/garbage` · หน้าแรกไม่มีกล่อง error แม้ API ล่ม (ลองปิด dev server ชั่วคราวไม่ได้ — ข้ามได้ ตรวจด้วยการอ่านโค้ดว่า catch เงียบ)

Run: `npx tsc --noEmit && npm run build`
Expected: เงียบ และ build ผ่าน

- [ ] **Step 4: Commit**

```bash
git add components/garbage/GarbageHomeCard.tsx pages/index.tsx
git commit -m "feat: add garbage schedule entry card on home page"
```

---

## Task 13: หน้าแอดมิน `/admin/garbage`

**Files:**
- Create: `components/garbage/admin/WeekScheduleView.jsx`
- Create: `components/garbage/admin/ContactSettingsCard.jsx`
- Create: `pages/admin/garbage.jsx`

- [ ] **Step 1: สร้าง `components/garbage/admin/WeekScheduleView.jsx`**

หมายเหตุเรื่องตาราง: สเปกอ้าง `MonthTable` เป็นต้นแบบ แต่ **ไม่ต้องทำ dual-view (การ์ด/ตาราง)** เพราะตารางนี้มีแค่ 5 คอลัมน์แคบ ๆ (`MonthTable` มี 20+ คอลัมน์จึงต้องมีโหมดการ์ด) — `overflow-x-auto` พอสำหรับมือถือ · ส่วนที่ยืมมาจริงคือ idiom ของ border/ระยะ/`tableHeadCls`

```jsx
import { Fragment, useState } from 'react';
import { formatRange, formatThaiTime } from '@/lib/garbage/time';
import { KIND_LABEL_TH, weekdayName } from '@/lib/garbage/labels';
import { tableHeadCls } from '@/components/ui/adminTheme';

/** ตารางงานมอบหมายรายวัน — อ่านอย่างเดียว คลิกแถวเพื่อกางดูจุดเก็บ */
export default function WeekScheduleView({ days, activeDate, onChangeDate }) {
  const [openKey, setOpenKey] = useState(null);
  const day = days.find((d) => d.date === activeDate) ?? days[0];
  const rows = day?.assignments ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 bg-[#F1ECFB] p-1.5 rounded-[14px]">
        {days.map((d) => {
          const on = d.date === activeDate;
          const empty = d.assignments.length === 0;
          return (
            <button key={d.date} type="button" onClick={() => { onChangeDate(d.date); setOpenKey(null); }}
              className={'text-[13px] px-3 py-2 rounded-[10px] font-semibold transition ' +
                (on ? 'bg-white text-[#7C3AED] shadow-[0_2px_6px_-2px_rgba(124,58,237,0.3)]'
                    : 'text-[#8A8398] hover:text-[#6D28D9]')}>
              {weekdayName(d.weekday)}
              {empty && <span className="ml-1 text-[10px] font-normal opacity-70">รอข้อมูล</span>}
            </button>
          );
        })}
      </div>

      <div className="text-[12px] text-[#8A8398]">{day?.date} · {rows.length} รายการ</div>

      {rows.length === 0 ? (
        <p className="text-center text-[13px] text-[#8A8398] py-10">
          วัน{weekdayName(day?.weekday ?? 0)}ยังไม่มีตารางในระบบ — รอข้อมูลจากกองสาธารณสุข
        </p>
      ) : (
        <div className="overflow-x-auto border border-[#E7E2F2] rounded-[16px]">
          <table className="text-[12px] w-full border-collapse">
            <thead>
              <tr className={tableHeadCls}>
                <th className="px-3 py-2 text-left border-b border-[#E7E2F2]">รถ</th>
                <th className="px-3 py-2 text-left border-b border-[#E7E2F2]">รอบ</th>
                <th className="px-3 py-2 text-left border-b border-[#E7E2F2]">สาย</th>
                <th className="px-3 py-2 text-left border-b border-[#E7E2F2]">ช่วงเวลา</th>
                <th className="px-3 py-2 text-right border-b border-[#E7E2F2]">จุด</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const key = `${a.truckNumber}-${a.shiftNo}`;
                const open = openKey === key;
                return (
                  // ต้องใช้ Fragment ที่มี key ไม่ใช่ <> เพราะ map คืนสองแถว — ไม่งั้น React เตือนเรื่อง key
                  <Fragment key={key}>
                    <tr onClick={() => setOpenKey(open ? null : key)}
                      className="cursor-pointer hover:bg-[#FAF8FF] border-b border-[#F1ECFB]">
                      <td className="px-3 py-2">
                        <span aria-hidden className={'inline-block h-2 w-2 rounded-full mr-1.5 ' +
                          (a.truckColor === 'yellow' ? 'bg-amber-400' : 'bg-emerald-500')} />
                        {a.truckNumber}
                      </td>
                      <td className="px-3 py-2">{a.shiftNo}</td>
                      <td className="px-3 py-2">
                        {a.routeCode ?? '—'}
                        {KIND_LABEL_TH[a.kind] && (
                          <span className="ml-1.5 inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#EDE7FD] text-[#6D28D9]">
                            {KIND_LABEL_TH[a.kind]}{a.coverForRouteCode ? ` ${a.coverForRouteCode}` : ''}
                          </span>
                        )}
                        {a.routeNeedsVerification && (
                          <span className="ml-1.5 inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            รอตรวจสอบ
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatRange(a.startMin, a.endMin) || '—'}</td>
                      <td className="px-3 py-2 text-right">{a.stops.length}</td>
                    </tr>
                    {open && a.stops.length > 0 && (
                      <tr className="bg-[#FAF8FF] border-b border-[#F1ECFB]">
                        <td colSpan={5} className="px-3 py-2">
                          <ol className="space-y-0.5">
                            {a.stops.map((s) => (
                              <li key={s.seq} className="flex gap-2 text-[12px]">
                                <span className="text-[#8A8398] w-6 text-right">{s.seq}.</span>
                                <span className="flex-1">{s.name}</span>
                                {s.mode === 'walk' && <span className="text-[10.5px] text-[#8A8398]">เดินเก็บ</span>}
                                <span className="text-[#57506A] whitespace-nowrap">{formatThaiTime(s.atMin) || '—'}</span>
                              </li>
                            ))}
                          </ol>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: สร้าง `components/garbage/admin/ContactSettingsCard.jsx`**

```jsx
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { inputCls, labelCls, primaryBtnCls } from '@/components/ui/adminTheme';

/** ตั้งค่าเบอร์ติดต่อที่หน้าประชาชนนำไปแสดงในแถบ "ตารางบางวันยังอยู่ระหว่างจัดทำ" */
export default function ContactSettingsCard() {
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/garbage/settings');
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(json?.error || 'โหลดค่าตั้งค่าไม่สำเร็จ');
        setPhone(json.contactPhone ?? '');
        setNote(json.contactNote ?? '');
      } catch (error) {
        if (alive) Swal.fire({ icon: 'error', title: 'โหลดค่าตั้งค่าไม่สำเร็จ', text: error.message });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/garbage/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactPhone: phone, contactNote: note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'บันทึกไม่สำเร็จ');
      setPhone(json.contactPhone ?? '');
      setNote(json.contactNote ?? '');
      Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', timer: 1400, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[14px] font-bold text-[#57506A]">ตั้งค่าการแสดงผลหน้าประชาชน</div>
        <div className="text-[12px] text-[#8A8398]">
          เบอร์นี้จะแสดงในแถบแจ้งว่าตารางบางวันยังอยู่ระหว่างจัดทำ · เว้นว่างไว้คือไม่แสดง
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="garbage-contact-phone">เบอร์ติดต่อ</label>
        <input id="garbage-contact-phone" className={inputCls} value={phone} disabled={loading}
          onChange={(e) => setPhone(e.target.value)} placeholder="เช่น 056-123456" />
      </div>
      <div>
        <label className={labelCls} htmlFor="garbage-contact-note">หมายเหตุ (ไม่บังคับ)</label>
        <input id="garbage-contact-note" className={inputCls} value={note} disabled={loading}
          onChange={(e) => setNote(e.target.value)} placeholder="เช่น ติดต่อในเวลาราชการ" />
      </div>
      <button type="button" className={primaryBtnCls} onClick={save} disabled={loading || saving}>
        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: สร้าง `pages/admin/garbage.jsx`**

```jsx
import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import PermissionGuard from '@/components/PermissionGuard';
import WeekScheduleView from '@/components/garbage/admin/WeekScheduleView';
import ContactSettingsCard from '@/components/garbage/admin/ContactSettingsCard';
import { DashboardHeader, cardCls } from '@/components/ui/adminTheme';

// ตารางเดินรถเก็บขยะ — อ่านอย่างเดียวรอบนี้ (แก้ตารางยังทำผ่าน data/garbage/schedule-seed.json + scripts/seed-garbage.mjs)
export default function AdminGarbagePage() {
  const [days, setDays] = useState(null);
  const [activeDate, setActiveDate] = useState(null);

  const fetchWeek = useCallback(async () => {
    try {
      const res = await fetch('/api/garbage/week');
      const json = await res.json();
      // API ชุดนี้คืน { error } ไม่ใช่ { success, message }
      if (!res.ok) throw new Error(json?.error || 'โหลดตารางไม่สำเร็จ');
      setDays(json.days);
      // เปิดที่วันที่มีข้อมูลวันแรก ถ้าไม่มีเลยเปิดวันอาทิตย์
      const firstWithData = json.days.find((d) => d.assignments.length > 0);
      setActiveDate((firstWithData ?? json.days[0]).date);
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'โหลดตารางไม่สำเร็จ', text: error.message });
    }
  }, []);

  useEffect(() => { fetchWeek(); }, [fetchWeek]);

  return (
    <PermissionGuard>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className={cardCls + ' p-4 sm:p-5'}>
          <DashboardHeader icon="🚛" title="ตารางเดินรถเก็บขยะ"
            subtitle="ตารางรายสัปดาห์ · กองสาธารณสุขและสิ่งแวดล้อม" />
          {!days ? (
            <div className="flex justify-center py-16">
              <span className="loading loading-spinner loading-lg text-primary" />
            </div>
          ) : (
            <WeekScheduleView days={days} activeDate={activeDate} onChangeDate={setActiveDate} />
          )}
        </div>

        <div className={cardCls + ' p-4 sm:p-5'}>
          <ContactSettingsCard />
        </div>
      </div>
    </PermissionGuard>
  );
}
```

- [ ] **Step 4: ตรวจ type และ build**

Run: `npx tsc --noEmit && npm run build`
Expected: เงียบ และ build ผ่าน manifest มี `/admin/garbage`

- [ ] **Step 5: Commit**

```bash
git add components/garbage/admin/WeekScheduleView.jsx components/garbage/admin/ContactSettingsCard.jsx pages/admin/garbage.jsx
git commit -m "feat: add read-only admin week schedule page"
```

---

## Task 14: ลงทะเบียนหน้าแอดมิน 5 จุด + สคริปต์ให้สิทธิ์

ตอนนี้หน้ายังเข้าไม่ได้และเมนูยังไม่ขึ้น เพราะยังไม่ลงทะเบียน · ทำครบทั้ง 5 จุด ลืมข้อใดข้อหนึ่งจะพังแบบเงียบ ๆ ต่างกัน

**Files:**
- Modify: `lib/permissions.ts` (2 จุด)
- Modify: `components/LayoutAdmin.tsx`
- Modify: `components/Layout.js`
- Create: `scripts/grant-garbage-permission.js`

- [ ] **Step 1: จุดที่ 1 — `ALL_PAGES` ใน `lib/permissions.ts`**

แทรก entry ใหม่ต่อจาก entry ของ `/admin/smart-waste` (ประมาณบรรทัด 87):

```ts
  {
    path: '/admin/garbage',
    label: 'ตารางเดินรถเก็บขยะ',
    icon: '🚛',
    description: 'ตารางเดินรถเก็บขยะรายสัปดาห์ (กองสาธารณสุข)',
    category: 'management'
  },
```

- [ ] **Step 2: จุดที่ 2 — `DEFAULT_PERMISSIONS.admin`**

เพิ่มบรรทัดต่อจาก `'/admin/smart-waste',` ในอาเรย์ของ role `admin`:

```ts
    '/admin/garbage',
```

(`superadmin` ได้อัตโนมัติจาก `ALL_PAGES.map()` ไม่ต้องแก้)

- [ ] **Step 3: จุดที่ 3 — `navigationItems` ใน `components/LayoutAdmin.tsx`**

แทรกต่อจากรายการของ `/admin/smart-waste`:

```tsx
  { label: 'ตารางเดินรถเก็บขยะ', href: '/admin/garbage', icon: '🚛', group: 'จัดการ' },
```

- [ ] **Step 4: จุดที่ 4 — `ADMIN_META` ใน `components/Layout.js`**

แทรกต่อจากรายการของ `'/admin/smart-waste'`:

```js
  '/admin/garbage': {
    title: 'ตารางเดินรถเก็บขยะ',
    subtitle: 'ตารางรายสัปดาห์ · กองสาธารณสุขและสิ่งแวดล้อม',
  },
```

- [ ] **Step 5: จุดที่ 5 — สร้าง `scripts/grant-garbage-permission.js`**

คัดลอกแนวจาก `scripts/grant-smart-waste-permission.js` (แบบใหม่ที่ไม่ใส่แฟล็ก = dry-run):

```js
// scripts/grant-garbage-permission.js
// เพิ่มสิทธิ์หน้า /admin/garbage ให้ user ที่มี allowedPages กำหนดเองไว้แล้ว
// (user ที่ allowedPages ว่าง = ใช้ค่า default จึงเห็นหน้าใหม่อยู่แล้ว ไม่ต้องแก้)
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/grant-garbage-permission.js         (dry-run: แสดงรายชื่อ)
//   node --env-file=.env.local scripts/grant-garbage-permission.js --yes   (เพิ่มสิทธิ์จริง)
//
// รันซ้ำได้ (idempotent) — ใช้ $addToSet
// ถ้าต้องการให้เฉพาะบางคน: ไม่ต้องรัน script — ให้ superadmin ติ๊กรายคนที่ /admin/superadmin

const mongoose = require("mongoose");

const NEW_PAGE = "/admin/garbage";

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

  // เป้าหมาย: คนที่เคยติ๊กสิทธิ์เอง (allowedPages ไม่ว่าง) — ใช้หน้าขยะที่มีอยู่เป็นตัวชี้กลุ่มงานสาธารณสุข
  const filter = { allowedPages: "/admin/smart-waste" };
  const targets = await User.find(filter).select("name clerkId role allowedPages").lean();

  console.log(`พบ user ที่ต้องเพิ่มสิทธิ์ ${targets.length} ราย`);
  console.table(
    targets.map((u) => ({
      name: u.name,
      clerkId: u.clerkId,
      role: u.role,
      pages: (u.allowedPages || []).length,
      hasGarbage: (u.allowedPages || []).includes(NEW_PAGE),
    }))
  );

  if (!confirmed) {
    console.log("--dry-run: ยังไม่แก้ไขข้อมูล (ใส่ --yes เพื่อเพิ่มสิทธิ์จริง)");
  } else {
    const res = await User.updateMany(filter, { $addToSet: { allowedPages: NEW_PAGE } });
    console.log(`อัปเดตแล้ว: ${res.modifiedCount} ราย`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 6: รัน dry-run**

Run: `node --env-file=.env.local scripts/grant-garbage-permission.js`
Expected: แสดงตารางรายชื่อ user ที่มีสิทธิ์ `/admin/smart-waste` และบรรทัด `--dry-run: ยังไม่แก้ไขข้อมูล` · **ยังไม่ต้องรัน `--yes`** ให้เจ้าของโปรเจกต์ตัดสินใจหลัง merge

- [ ] **Step 7: ทดสอบว่าเมนูและหน้าใช้งานได้**

รีสตาร์ท dev server แล้วล็อกอินเป็น superadmin:
- ไซด์บาร์กลุ่ม "จัดการ" มีเมนู "ตารางเดินรถเก็บขยะ" · กดแล้วเข้า `/admin/garbage` ได้
- หัวหน้าเพจแสดงชื่อ "ตารางเดินรถเก็บขยะ" (มาจาก `ADMIN_META`)
- แท็บ 7 วันครบ วันพุธ–อาทิตย์มีคำว่า "รอข้อมูล" · เปิดวันจันทร์เห็น 7 รายการ วันอังคารเห็น 10 รายการ
- คลิกแถวกางเห็นรายการจุดพร้อมเวลา · แถว R5/R6/R7 มีป้าย "รอตรวจสอบ"
- กรอกเบอร์ `056-123456` กดบันทึก → ขึ้น "บันทึกแล้ว" · เปิด `/garbage` เห็นเบอร์ในแถบสีฟ้า
- หน้า `/admin/superadmin` (จัดการสิทธิ์) มีรายการหน้า "ตารางเดินรถเก็บขยะ" ให้ติ๊กได้

- [ ] **Step 8: Commit**

```bash
git add lib/permissions.ts components/LayoutAdmin.tsx components/Layout.js scripts/grant-garbage-permission.js
git commit -m "feat: ลงทะเบียนหน้า /admin/garbage ครบ 5 จุด + สคริปต์ให้สิทธิ์"
```

---

## Task 15: เอกสารโมดูลและเกตปิดท้าย

**Files:**
- Create: `docs/modules/garbage.md`
- Modify: `docs/modules/README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: สร้าง `docs/modules/garbage.md`**

```markdown
# โมดูล garbage — ตารางเดินรถเก็บขยะ

ระบบตารางเดินรถเก็บขยะของเทศบาลเมืองตาคลี · ประชาชนค้นหาถนน/ชุมชนของตัวเองเพื่อดูว่ารถมาวันไหนเวลาไหน เจ้าหน้าที่กองสาธารณสุขเปิดดูตารางรายสัปดาห์

## โครงสร้าง

| ชั้น | ไฟล์ |
|---|---|
| หน้าประชาชน | `pages/garbage.tsx` + `components/garbage/{GarbageSearchPanel,TodayTruckPanel,CoverageNote,GarbageHomeCard}.tsx` |
| หน้าแอดมิน | `pages/admin/garbage.jsx` + `components/garbage/admin/{WeekScheduleView,ContactSettingsCard}.jsx` |
| API สาธารณะ | `pages/api/garbage/{schedule,week,search,live}.ts` + `settings.ts` (GET) |
| API ต้องล็อกอิน | `pages/api/garbage/settings.ts` (PUT) ผ่าน `pages/api/garbage/_auth.ts` |
| Logic | `lib/garbage/{time,resolve,live,validators,labels,db}.ts` |
| Types | `types/garbage.ts` |
| ข้อมูลตั้งต้น | `data/garbage/schedule-seed.json` + `scripts/seed-garbage.mjs` |
| ถนน (GIS) | `public/road_takhli.geojson` + `scripts/import-roads.mjs` → collection `roads` |

## Collections

`garbage_trucks` (7) · `garbage_routes` (7) · `garbage_communities` (21) · `garbage_assignments` (17 — เฉพาะวันจันทร์กับอังคาร) · `garbage_settings` (singleton `key: "default"`) · `roads` (532 เส้น ใช้ร่วมกับโมดูลอื่นในอนาคต)

**ต้องใส่ prefix `garbage_`** เพราะชื่อเปล่า `assignments` และ `communities` เป็นของโมดูลร้องเรียนอยู่แล้ว และฐานข้อมูลแชร์ข้ามแอปพี่น้อง

## เรื่องที่ต้องรู้ก่อนแก้

- **API คืน `{ error }`** ไม่ใช่ `{ success, message }` แบบโมดูลอื่น
- **ห้ามฟอร์แมตเวลาเอง** ใช้ `formatThaiTime` / `formatRange` จาก `lib/garbage/time.ts` (prototype เดิมมีบั๊กเที่ยงวันกลายเป็นเที่ยงคืน)
- **`effectiveTo` เป็นวันสุดท้ายที่ยังใช้ (inclusive)** เก็บที่เที่ยงคืนเวลาไทย — ฝั่งเขียนในอนาคตห้ามใช้แบบ exclusive
- **ข้อมูลมีแค่จันทร์กับอังคาร** พุธ–อาทิตย์รอกองสาธารณสุข ทั้งสองหน้าต้องบอกตรง ๆ ว่ารอข้อมูล
- **สาย R5–R7 มี `needsVerification: true`** (ถอดจากโปสเตอร์) หน้าแอดมินแสดงป้าย "รอตรวจสอบ"
- **seed คือ source of truth** รัน `scripts/seed-garbage.mjs` ซ้ำจะทับค่าที่แก้มือใน DB
- โมดูลนี้ใช้ **native mongodb driver** (`lib/garbage/db.ts`) ไม่ใช่ mongoose ยกเว้น `_auth.ts` ที่ยืม pattern ตรวจสิทธิ์ของรีโป

## สิ่งที่ยังไม่ทำ

แก้ตารางจาก UI · แผนที่เส้นทาง (ต้องผูก `RouteStop.roadId` กับ `roads` ก่อน) · export โปสเตอร์ · แจ้งเตือน LINE ก่อนรถถึง
```

- [ ] **Step 2: เพิ่มแถวใน `docs/modules/README.md`**

ในตารางหัวข้อ "โมดูล | เอกสาร | หน้าหลัก" แทรกบรรทัดต่อจากแถว Smart Waste:

```markdown
| ตารางเดินรถเก็บขยะ (Garbage) | [garbage.md](garbage.md) | `/garbage`, `/admin/garbage` |
```

- [ ] **Step 3: เพิ่มโมดูลใน `CLAUDE.md`**

ในหัวข้อ `### Feature modules / โมดูลฟีเจอร์` เพิ่มรายการต่อจาก **Smart Waste**:

```markdown
- **Garbage / ตารางเดินรถเก็บขยะ (กองสาธารณสุข)** — โมดูล `garbage`: หน้าประชาชน `/garbage` (ค้นหาถนน/ชุมชน + สถานะรถวันนี้) + การ์ดทางเข้าที่หน้าแรก, หน้าแอดมิน `/admin/garbage` (ตารางรายสัปดาห์ อ่านอย่างเดียว + ตั้งค่าเบอร์ติดต่อ), API สาธารณะ `pages/api/garbage/{schedule,week,search,live}.ts` (คืน `{ error }` ไม่ใช่ `{ success, message }`), logic + เทสที่ `lib/garbage/`, collections `garbage_*` (prefix จำเป็น — `assignments`/`communities` ชื่อเปล่าเป็นของโมดูลร้องเรียน), ข้อมูลตั้งต้น `data/garbage/schedule-seed.json` → `scripts/seed-garbage.mjs`. **ห้ามฟอร์แมตเวลาเอง** ใช้ helper ใน `lib/garbage/time.ts`. ตอนนี้มีข้อมูลเฉพาะวันจันทร์–อังคาร รายละเอียดเต็มดู `docs/modules/garbage.md`
```

- [ ] **Step 4: รันเกตทั้งหมด**

Run:
```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```
Expected: เทสผ่านทั้งหมด (เดิม 124 + ใหม่ 12 = 136 passed, 2 skipped) · tsc เงียบ · lint ไม่มี warning ใหม่ · build สำเร็จ

- [ ] **Step 5: ตรวจรอบสุดท้ายด้วยมือบน dev server**

- `/garbage` — ค้น `มาลัย` เจอ, `ซ.มาลัย` ได้ผลเท่ากัน, `zzzz` ขึ้นข้อความไม่พบ, แถบสีฟ้าระบุวันที่รอข้อมูลพร้อมเบอร์ที่ตั้งไว้
- `/` — การ์ด "ตารางรถเก็บขยะ" กดไป `/garbage` ได้
- `/admin/garbage` — แท็บ 7 วัน, ป้าย "รอข้อมูล"/"รอตรวจสอบ", กางดูจุดได้, บันทึกเบอร์ได้
- `curl -X PUT` ไม่ล็อกอิน → 401
- ไซด์บาร์มีเมนูใหม่ และหน้ามีชื่อ

- [ ] **Step 6: Commit**

```bash
git add docs/modules/garbage.md docs/modules/README.md CLAUDE.md
git commit -m "docs: เพิ่มเอกสารโมดูล garbage"
```

---

## เช็กลิสต์ยืนยันว่า M4–M5 เสร็จ

- [ ] `GET /api/garbage/week` คืน 7 วันเรียงอาทิตย์→เสาร์ วันว่างมี `assignments: []`
- [ ] `npm test` ผ่านทุกเทส รวมเทสใหม่ของ `weekDatesOf`, `routeNeedsVerification`, `buildWeekSchedule`
- [ ] `npx tsc --noEmit` และ `npm run build` ผ่าน
- [ ] `/garbage` ค้นหาได้ทั้งชื่อมีคำนำหน้าและไม่มี และไม่มีทางยิง API ตอนพิมพ์ยังไม่ถึง 2 ตัวอักษร
- [ ] `/garbage` ส่วนรถวันนี้ poll 60 วิ และยิงพลาดไม่ล้างข้อมูลเดิม
- [ ] แถบบอกวันที่ยังไม่มีตารางแสดงถูกต้อง (ตอนนี้ต้องเป็นพุธ พฤหัสบดี ศุกร์ เสาร์ อาทิตย์)
- [ ] การ์ดหน้าแรกกดไป `/garbage` ได้ และหน้าแรกไม่มีกล่อง error แม้ API ล่ม
- [ ] `/admin/garbage` เข้าได้, แท็บครบ 7 วัน, ป้าย "รอตรวจสอบ" ขึ้นที่ R5–R7, กางดูจุดได้
- [ ] เมนู "ตารางเดินรถเก็บขยะ" ขึ้นบนไซด์บาร์กลุ่ม "จัดการ" และหน้ามีชื่อจาก `ADMIN_META`
- [ ] หน้า `/admin/superadmin` มีหน้าใหม่ให้ติ๊กสิทธิ์ได้
- [ ] `PUT /api/garbage/settings` โดยไม่ล็อกอิน = 401 · แก้เบอร์แล้วหน้าประชาชนเห็น
- [ ] `scripts/grant-garbage-permission.js` (ไม่ใส่แฟล็ก) แสดงรายชื่อได้ไม่แก้ข้อมูล
- [ ] หน้า `/admin/smart-waste` และ `/admin/smart-school` ยังทำงานเหมือนเดิมหลังสกัดธีม

## งานที่ต้องทำมือหลัง merge

1. รัน `node --env-file=.env.local scripts/grant-garbage-permission.js --yes` เพื่อให้ user เดิมที่ติ๊กสิทธิ์เองเห็นหน้าใหม่
2. ตั้งเบอร์ติดต่อกองสาธารณสุขที่ `/admin/garbage`
3. ขอตารางวันพุธ–อาทิตย์จากกองสาธารณสุข แล้วเติมใน `data/garbage/schedule-seed.json` + รัน seed
4. ให้กองสาธารณสุขตรวจชื่อจุดของสาย R5–R7 แล้วลบ `needsVerification` ออกจาก seed
