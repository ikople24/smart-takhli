# นำเข้าตารางเดินรถขยะฉบับจริง (M7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** นำตารางเดินรถขยะฉบับจริงจากกองสาธารณสุข (8 คัน 7 วัน 172 จุด) เข้าระบบ และแก้โมเดลให้แยกได้ว่าจุดไหน "วันนี้ไม่เก็บ" ต่างจาก "เก็บแต่ยังไม่ระบุเวลา"

**Architecture:** เปลี่ยนความหมายของ `stopTimes` เป็น "รายการจุดที่เก็บวันนั้น โดยเวลาเป็นค่าว่างได้" — อยู่ในลิสต์ = เก็บ, ไม่อยู่ = ไม่เก็บ, อยู่แต่ไม่มีเวลา = รอระบุเวลา · เป็นการเปลี่ยนที่เล็กที่สุดที่รองรับข้อมูลจริงครบ · สคริปต์นำเข้าเป็น re-baseline ที่ต้องสั่งชัดเจน ไม่ใช่ upsert เงียบ

**Tech Stack:** Next.js 15 Pages Router, TypeScript strict, MongoDB native driver, Zod, Vitest

**Spec:** `docs/superpowers/specs/2026-08-13-garbage-real-schedule-design.md`

**Branch:** `feat/garbage-real-schedule` (stacked ชั้นที่ 4 บน `feat/garbage-crud`) **ห้ามสลับ branch**

---

## บริบทที่ผู้รับงานต้องรู้ก่อนเริ่ม

**ข้อมูลพร้อมแล้ว:** `data/garbage/schedule-2569.json` (commit `fad68f0`) มีรถ 1–7 (`trucks[]`) และรถ 13 (`truck13`) · `data/garbage/trucks.local.json` มีทะเบียนรถ/ชื่อคนขับ (gitignore ไว้ — repo นี้ public)

โครงไฟล์ `schedule-2569.json`:
```jsonc
{ "trucks": [ { "number": 1,
      "stops": [ { "seq": 1, "name": "โรงเรียนประดับวิทย์", "mode": "truck",
                   "times": { "0": 240, "3": 610, "4": 240, "5": 390 },   // คีย์ = เลขวัน 0–6
                   "note": "หยุดวันอังคาร" } ],
      "days": { "1": { "startMin": 240, "endMin": 550, "stopCount": 22, "notes": [...] } } } ],
  "truck13": { "stops": [ { "seq": 1, "name": "โรงพยาบาลตาคลี", "weekdays": [1,2,3,4,5,6], "note": "หยุดวันอาทิตย์" } ] } }
```

**กฎที่พลาดง่าย:**

1. API โมดูลนี้คืน `{ error: string }` ไม่ใช่ `{ success, message }`
2. ห้ามฟอร์แมตเวลาเอง ใช้ helper ใน `lib/garbage/time.ts`
3. **`driverName` เป็นข้อมูลพนักงาน ห้ามส่งออก API สาธารณะ** — ตรวจทุกจุดที่ส่ง `Truck` ออกก่อนเพิ่มฟิลด์
4. `logAuditEvent` กลืน error — action ใหม่ต้องลงทะเบียนครบ 4 จุด รวม mongoose `enum` ใน `models/AuditLog.js`
5. เทสโมดูลนี้ colocate (`lib/garbage/*.test.ts`) ไม่ใช่ `__tests__/`
6. ปิด dev server ก่อนรัน `npm run build` (ใช้ `.next` ร่วมกัน)

**Baseline:** `npm test` = 169 passed | 2 skipped

---

## Task 1: `atMin` เป็นค่าว่างได้ + ธง `served`

**Files:**
- Modify: `types/garbage.ts`
- Modify: `lib/garbage/resolve.ts`
- Test: `lib/garbage/resolve.test.ts`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

เพิ่มใน `describe("buildDaySchedule", ...)`:

```ts
  it("แยกสามสถานะของจุดในแต่ละวัน", () => {
    const routesWith3: Route[] = [{
      code: "R1", name: "สาย R1", defaultTruckNumber: 1, active: true,
      communityNames: ["ชุมชนเขาใบไม้"],
      stops: [
        { seq: 1, name: "จุดมีเวลา", mode: "truck" },
        { seq: 2, name: "จุดไม่เก็บวันนี้", mode: "truck" },
        { seq: 3, name: "จุดรอระบุเวลา", mode: "truck" },
      ],
    }];
    const a: Assignment[] = [{
      ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal",
      startMin: 240, endMin: 300,
      // จุด 2 ไม่อยู่ในลิสต์ = วันนี้ไม่เก็บ · จุด 3 อยู่แต่ไม่มีเวลา = รอระบุเวลา
      stopTimes: [{ seq: 1, atMin: 240 }, { seq: 3, atMin: null }],
    }];
    const stops = buildDaySchedule("2026-08-10", 1, a, routesWith3, trucks).assignments[0].stops;
    expect(stops[0]).toMatchObject({ name: "จุดมีเวลา", served: true, atMin: 240 });
    expect(stops[1]).toMatchObject({ name: "จุดไม่เก็บวันนี้", served: false, atMin: null });
    expect(stops[2]).toMatchObject({ name: "จุดรอระบุเวลา", served: true, atMin: null });
  });

  it("งานที่ไม่มีสาย ได้ stops ว่างเหมือนเดิม", () => {
    const a: Assignment[] = [{
      ...base, weekday: 2, shiftNo: 1, truckNumber: 1, routeCode: null, kind: "day_off",
      startMin: null, endMin: null, stopTimes: [],
    }];
    expect(buildDaySchedule("2026-08-11", 2, a, routes, trucks).assignments[0].stops).toEqual([]);
  });
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run lib/garbage/resolve.test.ts`
Expected: FAIL — `served` เป็น undefined

- [ ] **Step 3: แก้ `types/garbage.ts`**

`StopTime.atMin` เปลี่ยนเป็นค่าว่างได้ พร้อมคอมเมนต์อธิบายความหมายใหม่:

```ts
export interface StopTime {
  seq: number;
  /** เวลาที่รถถึงจุดนี้ — null = เก็บวันนี้แต่ยังไม่ระบุเวลา (เช่น รถยกภาชนะ) */
  atMin: Minutes | null;
}
```

และใน `ResolvedAssignment` เปลี่ยนชนิดของ `stops`:

```ts
  /**
   * จุดทั้งหมดของสาย พร้อมสถานะรายวัน
   * served = วันนี้เก็บจุดนี้หรือไม่ (มาจากการมีอยู่ใน stopTimes)
   * atMin = เวลาที่ถึง · null ทั้งที่ served เป็น true แปลว่ายังไม่ระบุเวลา
   */
  stops: Array<RouteStop & { served: boolean; atMin: Minutes | null }>;
```

- [ ] **Step 4: แก้ `lib/garbage/resolve.ts#buildDaySchedule`**

แทนที่บรรทัดที่สร้าง `stops` ด้วยเวอร์ชันที่แยก `served` ออกจาก `atMin`:

```ts
      stops: route
        ? route.stops.map((s) => ({
            ...s,
            // อยู่ใน stopTimes = วันนี้เก็บจุดนี้ · ไม่อยู่ = วันนี้ไม่เก็บ
            served: timeBySeq.has(s.seq),
            atMin: timeBySeq.get(s.seq) ?? null,
          }))
        : [],
```

(`timeBySeq` ที่มีอยู่แล้วสร้างจาก `a.stopTimes.map((s) => [s.seq, s.atMin])` ซึ่งตอนนี้ค่าอาจเป็น null — `.has()` จึงบอก "เก็บไหม" และ `.get()` บอก "เวลาเท่าไร" แยกกันได้พอดี)

- [ ] **Step 5: รันเทสให้ผ่าน**

Run: `npx vitest run lib/garbage/resolve.test.ts && npx tsc --noEmit`
Expected: PASS · tsc อาจฟ้องที่ `live.ts`/`live.test.ts`/UI ที่ยังไม่รู้จัก `served` — **ถ้าฟ้องให้ทำ Task 2–4 ต่อแล้วค่อยยืนยันรวม** แต่ห้ามใส่ `as never` กลบ

- [ ] **Step 6: Commit**

```bash
git add types/garbage.ts lib/garbage/resolve.ts lib/garbage/resolve.test.ts
git commit -m "feat: แยกสถานะจุดเก็บรายวัน (ไม่เก็บ / เก็บแต่ยังไม่ระบุเวลา)"
```

---

## Task 2: validators รองรับเวลาว่าง

**Files:**
- Modify: `lib/garbage/validators.ts`
- Test: `lib/garbage/validators.test.ts` (ไฟล์ใหม่ — โมดูลนี้ยังไม่เคยมีเทส validator)

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```ts
import { describe, it, expect } from "vitest";
import { assignmentSchema } from "./validators";

const base = {
  weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal" as const,
  coverForRouteCode: null, startMin: 240, endMin: 300,
  stopTimes: [] as Array<{ seq: number; atMin: number | null }>,
  communityWindows: [], label: null,
};

describe("assignmentSchema กับเวลาที่เว้นว่าง", () => {
  it("รับ atMin เป็น null ได้", () => {
    const r = assignmentSchema.safeParse({ ...base, stopTimes: [{ seq: 1, atMin: null }] });
    expect(r.success).toBe(true);
  });

  it("กฎเวลาไม่ย้อนกลับต้องข้ามจุดที่ไม่มีเวลา", () => {
    const r = assignmentSchema.safeParse({
      ...base,
      stopTimes: [{ seq: 1, atMin: 240 }, { seq: 2, atMin: null }, { seq: 3, atMin: 260 }],
    });
    expect(r.success).toBe(true);
  });

  it("ยังจับเวลาย้อนกลับของจุดที่มีเวลาได้", () => {
    const r = assignmentSchema.safeParse({
      ...base,
      stopTimes: [{ seq: 1, atMin: 300 }, { seq: 2, atMin: 240 }],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toContain("ย้อนกลับ");
  });

  it("งานพิเศษที่ทุกจุดยังไม่ระบุเวลา บันทึกได้ (รถยกภาชนะ)", () => {
    const r = assignmentSchema.safeParse({
      ...base, kind: "special", routeCode: "R13", startMin: null, endMin: null,
      stopTimes: [{ seq: 1, atMin: null }, { seq: 2, atMin: null }],
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run lib/garbage/validators.test.ts`
Expected: FAIL — `atMin` ไม่รับ null

- [ ] **Step 3: แก้ `lib/garbage/validators.ts`**

`stopTimeSchema` ให้ `atMin` เป็นค่าว่างได้:

```ts
export const stopTimeSchema = z.object({
  seq: z.number().int().positive(),
  /** null = เก็บวันนี้แต่ยังไม่ระบุเวลา */
  atMin: minutes.nullable(),
}).strict();
```

และ refine เรื่องเวลาไม่ย้อนกลับต้องกรอง null ออกก่อนเทียบ — หา refine ที่มีข้อความ "เวลาใน stopTimes ต้องไม่ย้อนกลับตามลำดับจุด" แล้วเปลี่ยนตัวเปรียบเทียบเป็น:

```ts
  .refine(
    (a) => {
      // เทียบเฉพาะจุดที่ระบุเวลาแล้ว — จุดที่ยังไม่ระบุเวลาไม่ถือว่าย้อนกลับ
      const timed = [...a.stopTimes]
        .sort((x, y) => x.seq - y.seq)
        .filter((s) => s.atMin != null);
      return timed.every((s, i) => i === 0 || (s.atMin as number) >= (timed[i - 1].atMin as number));
    },
    { message: "เวลาใน stopTimes ต้องไม่ย้อนกลับตามลำดับจุด" }
  )
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `npx vitest run lib/garbage/validators.test.ts && npm test`
Expected: PASS ทั้งไฟล์ใหม่และเทสเดิมทั้งหมด

- [ ] **Step 5: Commit**

```bash
git add lib/garbage/validators.ts lib/garbage/validators.test.ts
git commit -m "feat: validators รองรับจุดที่ยังไม่ระบุเวลา"
```

---

## Task 3: `live.ts` ไม่นับจุดที่วันนี้ไม่เก็บ

**Files:**
- Modify: `lib/garbage/live.ts`
- Test: `lib/garbage/live.test.ts`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

เพิ่มใน `describe("getLivePosition", ...)` (fixture `ra` ที่มีอยู่ต้องเติม `served: true` ให้ทุกจุดก่อน ไม่งั้น tsc ไม่ผ่าน):

```ts
  it("ข้ามจุดที่วันนี้ไม่เก็บ", () => {
    const withSkipped: ResolvedAssignment = {
      ...ra,
      stops: [
        { seq: 1, name: "จุด A", mode: "truck", served: true, atMin: 240 },
        { seq: 2, name: "จุดข้าม", mode: "truck", served: false, atMin: 260 },
        { seq: 3, name: "จุด C", mode: "truck", served: true, atMin: 300 },
      ],
    };
    const p = getLivePosition(withSkipped, 270);
    expect(p.currentStop?.name).toBe("จุด A");
    expect(p.nextStop?.name).toBe("จุด C");
  });
```

(จุดที่ `served: false` มี `atMin` ค้างอยู่เพื่อพิสูจน์ว่าโค้ดกรองด้วย `served` จริง ไม่ใช่บังเอิญกรองด้วย null)

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run lib/garbage/live.test.ts`
Expected: FAIL — `currentStop` เป็น "จุดข้าม"

- [ ] **Step 3: แก้ `lib/garbage/live.ts`**

ในบรรทัดที่กรอง `timed` เพิ่มเงื่อนไข `served`:

```ts
  const timed = a.stops
    .filter((s): s is typeof s & { atMin: Minutes } => s.served && s.atMin != null)
    .sort((x, y) => x.atMin - y.atMin);
```

(ปรับ type predicate ให้คอมไพล์ผ่าน strict ตามรูปแบบเดิมของไฟล์)

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `npx vitest run lib/garbage/live.test.ts && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add lib/garbage/live.ts lib/garbage/live.test.ts
git commit -m "fix: สถานะรถสดไม่นับจุดที่วันนั้นไม่เก็บ"
```

---

## Task 4: ผลค้นหาบอกได้ว่าวันไหนเก็บจริง

**Files:**
- Modify: `types/garbage.ts`
- Modify: `pages/api/garbage/search.ts`

- [ ] **Step 1: เพิ่มฟิลด์ใน `SearchHit`**

```ts
  /** วันนั้นเก็บจุดนี้จริงหรือไม่ — false = ชื่อจุดอยู่ในสาย แต่วันนั้นไม่เข้าเก็บ */
  served: boolean;
```

- [ ] **Step 2: แก้ `pages/api/garbage/search.ts`**

ในลูปที่สร้าง hit ของ `matchType: "stop"` เดิมใช้ `timeBySeq.get(s.seq) ?? null` — เปลี่ยนเป็นแยกสองค่า และ**ข้ามจุดที่วันนั้นไม่เก็บ** ไม่ให้ขึ้นเป็นผลค้นหาของวันนั้น:

```ts
        for (const s of route.stops) {
          if (!norm(s.name).includes(needle)) continue;
          // วันนั้นไม่ได้เก็บจุดนี้ → ไม่ใช่คำตอบของ "วันไหนรถมา" จึงไม่ต้องแสดง
          if (!timeBySeq.has(s.seq)) continue;
          hits.push({
            matchType: "stop", matchName: s.name,
            routeCode: route.code, routeName: route.name,
            weekday, weekdayName: WEEKDAY_TH[weekday],
            truckNumber: a.truckNumber,
            kind: a.kind, coverForRouteCode: a.coverForRouteCode,
            startMin: a.startMin, endMin: a.endMin,
            atMin: timeBySeq.get(s.seq) ?? null,
            served: true,
          });
        }
```

และ hit ของ `matchType: "community"` ให้ใส่ `served: true` (หน้าต่างชุมชนมีอยู่ = วันนั้นเก็บ)

- [ ] **Step 3: ยืนยัน**

Run: `npx tsc --noEmit && npm test`

- [ ] **Step 4: Commit**

```bash
git add types/garbage.ts pages/api/garbage/search.ts
git commit -m "fix: ผลค้นหาแสดงเฉพาะวันที่เก็บจุดนั้นจริง"
```

---

## Task 5: `findNextPickup` — บอกว่ารอบหน้ามาเมื่อไร

ความต้องการจากเจ้าของโปรเจกต์: จุดที่วันนี้ไม่เก็บ ต้องบอกได้ว่า **"รอบถัดไปมาวันไหน เวลาไหน"** — เป็นคำตอบที่ชาวบ้านอยากรู้ที่สุดเมื่อเปิดมาแล้วเจอว่าวันนี้รถไม่มา

**Files:**
- Create: `lib/garbage/nextPickup.ts`
- Test: `lib/garbage/nextPickup.test.ts`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```ts
import { describe, it, expect } from "vitest";
import { findNextPickup } from "./nextPickup";

// จุดนี้เก็บวันจันทร์ 4.00, วันพุธ 5.00, วันเสาร์ 6.00
const slots = [
  { weekday: 1, atMin: 240 },
  { weekday: 3, atMin: 300 },
  { weekday: 6, atMin: 360 },
];

describe("findNextPickup", () => {
  it("วันนี้ยังมาไม่ถึง = รอบนี้แหละ", () => {
    expect(findNextPickup(slots, 1, 200)).toEqual({ weekday: 1, atMin: 240, daysAhead: 0 });
  });

  it("วันนี้ผ่านไปแล้ว = ข้ามไปวันถัดไปที่เก็บ", () => {
    expect(findNextPickup(slots, 1, 300)).toEqual({ weekday: 3, atMin: 300, daysAhead: 2 });
  });

  it("วันที่ไม่เก็บ = บอกวันถัดไปที่เก็บ", () => {
    expect(findNextPickup(slots, 2, 600)).toEqual({ weekday: 3, atMin: 300, daysAhead: 1 });
  });

  it("วนข้ามสัปดาห์ได้", () => {
    expect(findNextPickup(slots, 0, 600)).toEqual({ weekday: 1, atMin: 240, daysAhead: 1 });
    expect(findNextPickup(slots, 6, 400)).toEqual({ weekday: 1, atMin: 240, daysAhead: 2 });
  });

  it("จุดที่ยังไม่ระบุเวลา ถือว่ายังมาได้วันนี้", () => {
    expect(findNextPickup([{ weekday: 2, atMin: null }], 2, 900))
      .toEqual({ weekday: 2, atMin: null, daysAhead: 0 });
  });

  it("ไม่เคยเก็บเลย = null", () => {
    expect(findNextPickup([], 1, 240)).toBeNull();
  });

  it("เก็บวันเดียว วนกลับมาครบสัปดาห์", () => {
    expect(findNextPickup([{ weekday: 1, atMin: 240 }], 1, 300))
      .toEqual({ weekday: 1, atMin: 240, daysAhead: 7 });
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run lib/garbage/nextPickup.test.ts`
Expected: FAIL — `Failed to resolve import "./nextPickup"`

- [ ] **Step 3: เขียน implementation**

```ts
import type { Minutes } from "@/types/garbage";

/** วันและเวลาที่จุดหนึ่งถูกเก็บ — atMin เป็น null คือเก็บแต่ยังไม่ระบุเวลา */
export interface PickupSlot {
  weekday: number;
  atMin: Minutes | null;
}

export interface NextPickup {
  weekday: number;
  atMin: Minutes | null;
  /** 0 = วันนี้ · 1 = พรุ่งนี้ · 7 = อีกสัปดาห์ (เก็บสัปดาห์ละครั้งและรอบวันนี้ผ่านไปแล้ว) */
  daysAhead: number;
}

/**
 * หารอบเก็บถัดไปของจุดหนึ่ง นับจากวันและเวลาปัจจุบัน
 * ไล่ไปข้างหน้าทีละวันจนครบ 7 วัน แล้ววนกลับมาวันเดิม (daysAhead = 7)
 * รอบของวันนี้ที่เวลาผ่านไปแล้วไม่นับ — แต่ถ้ายังไม่ระบุเวลา ถือว่ายังมาได้
 */
export function findNextPickup(
  slots: PickupSlot[],
  fromWeekday: number,
  fromMin: Minutes
): NextPickup | null {
  if (slots.length === 0) return null;
  for (let ahead = 0; ahead <= 7; ahead++) {
    const wd = (fromWeekday + ahead) % 7;
    const candidates = slots
      .filter((s) => s.weekday === wd)
      .filter((s) => ahead > 0 || s.atMin == null || s.atMin >= fromMin)
      .sort((a, b) => (a.atMin ?? -1) - (b.atMin ?? -1));
    if (candidates.length > 0) {
      return { weekday: wd, atMin: candidates[0].atMin, daysAhead: ahead };
    }
  }
  return null;
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `npx vitest run lib/garbage/nextPickup.test.ts && npx tsc --noEmit`
Expected: PASS ทั้ง 7 เทส

- [ ] **Step 5: Commit**

```bash
git add lib/garbage/nextPickup.ts lib/garbage/nextPickup.test.ts
git commit -m "feat: add findNextPickup for next collection lookup"
```

---

## Task 6: หน้าประชาชน — รอบถัดไป และวันที่รถหยุด

สองอย่างที่เจ้าของโปรเจกต์ขอ: (1) จุดที่วันนี้ไม่เก็บ ต้องบอกว่า **รอบหน้ามาเมื่อไร** (2) วันที่รถหยุดกันเยอะ (อังคาร/ศุกร์) ต้องขึ้นให้ชัดว่า **วันนี้รถหยุดดำเนินการ**

**Files:**
- Modify: `components/garbage/GarbageSearchPanel.tsx`
- Modify: `components/garbage/TodayTruckPanel.tsx`

- [ ] **Step 1: ผลค้นหาแสดง "รอบถัดไป" เป็นบรรทัดแรก**

`/api/garbage/search` คืน hit ของ **ทุกวันที่จุดนั้นถูกเก็บ** อยู่แล้ว จึงคำนวณรอบถัดไปได้ฝั่ง client โดยไม่ต้องเพิ่ม API

ใน `GarbageSearchPanel.tsx` เพิ่ม import:

```tsx
import { findNextPickup } from "@/lib/garbage/nextPickup";
import { minutesNowInBangkok, weekdayOf, todayInBangkok } from "@/lib/garbage/time";
import { weekdayName } from "@/lib/garbage/labels";
```

เพิ่มฟังก์ชันช่วยระดับไฟล์ (นอก component):

```tsx
/** "วันนี้ 9.00 น." · "พรุ่งนี้ 4.00 น." · "วันพุธ 4.00 น. (อีก 2 วัน)" */
function nextPickupText(hits: SearchHit[]): string | null {
  const stopHits = hits.filter((h) => h.matchType === "stop");
  if (stopHits.length === 0) return null;
  const next = findNextPickup(
    stopHits.map((h) => ({ weekday: h.weekday, atMin: h.atMin })),
    weekdayOf(todayInBangkok()),
    minutesNowInBangkok()
  );
  if (next == null) return null;
  const when =
    next.daysAhead === 0 ? "วันนี้" : next.daysAhead === 1 ? "พรุ่งนี้" : `วัน${weekdayName(next.weekday)}`;
  const time = next.atMin == null ? "ยังไม่ระบุเวลา" : formatThaiTime(next.atMin);
  const tail = next.daysAhead >= 2 ? ` (อีก ${next.daysAhead} วัน)` : "";
  return `${when} ${time}${tail}`;
}
```

แล้วเรนเดอร์เหนือกลุ่มผลลัพธ์ (ก่อน `groups.map`) — ใช้สีเขียวให้เด่นเพราะเป็นคำตอบที่คนเข้ามาหา:

```tsx
      {!loading && !error && groups.length > 0 && nextPickupText(hits ?? []) && (
        <div className="mt-4 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 px-4 py-3">
          <div className="text-xs text-emerald-800">รอบเก็บถัดไปของจุดที่ค้นเจอ</div>
          <div className="text-base font-semibold text-emerald-900">{nextPickupText(hits ?? [])}</div>
        </div>
      )}
```

(ถ้ามีหลายจุดที่ชื่อคล้ายกัน ค่านี้คือรอบที่ใกล้ที่สุดของทั้งกลุ่ม — พอสำหรับคำถาม "รถจะมาเมื่อไร")

- [ ] **Step 2: ป้ายบอกว่าวันนี้รถหยุดเยอะ**

ใน `TodayTruckPanel.tsx` หลังคำนวณ `working` / `dayOff` แล้ว เพิ่มการแสดงเมื่อรถหยุดเกินครึ่ง:

```tsx
      {dayOff.length > 0 && dayOff.length >= working.length && (
        <div className="mt-3 rounded-2xl bg-amber-50/80 ring-1 ring-amber-200 p-3">
          <p className="text-sm font-semibold text-amber-900">วันนี้รถหยุดดำเนินการเป็นส่วนใหญ่</p>
          <p className="text-xs text-amber-800 mt-0.5">
            หยุด {dayOff.length} คัน (รถ {dayOff.map((t) => t.truckNumber).join(", ")})
            {working.length > 0 && ` · ยังมีรถ ${working.map((t) => t.truckNumber).join(", ")} วิ่งเก็บแทนบางจุด`}
          </p>
          <p className="text-xs text-amber-800 mt-1">
            ค้นหาถนนของคุณด้านบนเพื่อดูว่ารอบถัดไปรถจะมาวันไหน
          </p>
        </div>
      )}
```

และแก้บรรทัด "วันนี้หยุด: รถ ..." เดิมให้แสดงเฉพาะเมื่อ**ไม่ได้**ขึ้นป้ายใหญ่ (กันข้อความซ้ำ):

```tsx
      {dayOff.length > 0 && dayOff.length < working.length && (
        <p className="mt-2.5 text-xs text-slate-500">
          วันนี้หยุด: รถ {dayOff.map((t) => t.truckNumber).join(", ")}
        </p>
      )}
```

- [ ] **Step 3: จุดถัดไปที่ยังไม่ระบุเวลา**

ในบรรทัดที่แสดงจุดถัดไป เปลี่ยนให้บอกได้เมื่อไม่มีเวลา:

```tsx
                  {t.live.nextStop && (
                    <> · ถัดไป {t.live.nextStop.name}
                      {t.live.etaNextMin != null
                        ? ` (อีก ${t.live.etaNextMin} นาที)`
                        : " (ยังไม่ระบุเวลา)"}</>
                  )}
```

- [ ] **Step 4: ยืนยัน**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: เงียบทั้งหมด

- [ ] **Step 5: Commit**

```bash
git add components/garbage/GarbageSearchPanel.tsx components/garbage/TodayTruckPanel.tsx
git commit -m "feat: หน้าประชาชนบอกรอบเก็บถัดไปและวันที่รถหยุด"
```

---

## Task 7: หน้าแอดมินแยก "เก็บวันนี้" ออกจาก "เวลา"

**Files:**
- Modify: `components/garbage/admin/StopTimesEditor.jsx`
- Modify: `components/garbage/admin/WeekScheduleView.jsx`
- Modify: `components/garbage/admin/AssignmentFormModal.jsx`

- [ ] **Step 0: กันจุดที่ "เก็บแต่ยังไม่ระบุเวลา" หายตอนเปิดฟอร์ม**

`AssignmentFormModal.jsx` ตอนโหลดงานเดิมใช้ `assignment.stops.filter((s) => s.atMin != null)` สร้าง `stopTimes` เริ่มต้น → ภายใต้โมเดลใหม่ จุดที่ `served` เป็น true แต่ไม่มีเวลา (เช่นทุกจุดของรถ 13) จะ**หายไปเงียบ ๆ** แอดมินเปิดงานแล้วกดบันทึกทีเดียว เครื่องหมาย "เก็บวันนี้" หายทั้งหมด ซึ่งตรงข้ามกับสิ่งที่ M7 ทำมา

เปลี่ยนให้ยึด `served` แทน:

```jsx
      setStopTimes(assignment.stops.filter((s) => s.served).map((s) => ({ seq: s.seq, atMin: s.atMin })));
```


- [ ] **Step 1: `StopTimesEditor` เพิ่มช่องติ๊กต่อจุด**

แทนที่เนื้อในของ `<li>` ด้วยเวอร์ชันที่มีช่องติ๊ก "เก็บ" นำหน้า และช่องเวลาใช้ได้เฉพาะเมื่อติ๊กแล้ว · เพิ่ม handler:

```jsx
  const toggleServed = (seq, on) => {
    const next = value.filter((v) => v.seq !== seq);
    if (on) next.push({ seq, atMin: null });
    next.sort((a, b) => a.seq - b.seq);
    onChange(next);
  };
```

และใน `<li>`:

```jsx
          <li key={s.seq} className="flex items-center gap-2">
            <input type="checkbox" checked={bySeq.has(s.seq)}
              aria-label={`เก็บ ${s.name} ในวันนี้`}
              onChange={(e) => toggleServed(s.seq, e.target.checked)} />
            <span className="w-6 text-right text-[12px] text-[#8A8398]">{s.seq}.</span>
            <span className="flex-1 text-[12.5px] truncate" title={s.name}>{s.name}</span>
            <input
              className="w-24 rounded-[10px] border border-[#E7E2F2] px-2 py-1 text-[12.5px] disabled:bg-[#F1F1F4]"
              placeholder={bySeq.has(s.seq) ? '4.00' : 'ไม่เก็บ'}
              disabled={!bySeq.has(s.seq)}
              aria-label={`เวลาถึง ${s.name}`}
              defaultValue={bySeq.get(s.seq) != null ? formatThaiTime(bySeq.get(s.seq)).replace(' น.', '') : ''}
              key={`${s.seq}-${bySeq.get(s.seq) ?? 'empty'}-${bySeq.has(s.seq)}`}
              onBlur={(e) => setOne(s.seq, e.target.value)}
            />
          </li>
```

`setOne` ต้องคงสถานะ "เก็บ" ไว้เมื่อล้างเวลา (เดิมลบทั้ง entry):

```jsx
  const setOne = (seq, text) => {
    const min = parseThaiTime(text);
    const next = value.filter((v) => v.seq !== seq);
    // ยังเก็บอยู่แม้ล้างเวลา — ต่างจาก "ไม่เก็บ" ที่ต้องเอาติ๊กออก
    next.push({ seq, atMin: min });
    next.sort((a, b) => a.seq - b.seq);
    onChange(next);
  };
```

และแก้ข้อความช่วยเดิมเป็น:

```jsx
      <p className="text-[11.5px] text-[#8A8398]">
        ติ๊กเฉพาะจุดที่เก็บในวันนี้ · เว้นช่องเวลาไว้ได้ถ้ายังไม่ทราบ (จะขึ้นว่า &ldquo;ยังไม่ระบุเวลา&rdquo;)
      </p>
```

ปุ่ม "กระจายเวลาเท่ากัน" ต้องกระจายให้**เฉพาะจุดที่ติ๊กไว้** ไม่ใช่ทุกจุดของสาย:

```jsx
  const spread = () => {
    if (startMin == null || endMin == null) return;
    const served = value.map((v) => v.seq).sort((a, b) => a - b);
    if (served.length === 0) return;
    const times = distributeStopTimes(served.length, startMin, endMin);
    onChange(served.map((seq, i) => ({ seq, atMin: times[i].atMin })));
  };
```

- [ ] **Step 2: `WeekScheduleView` แสดงสถานะในรายการจุดที่กางดู**

ในลิสต์จุด เปลี่ยนบรรทัดเวลาเป็น:

```jsx
                                {s.served
                                  ? <span className="text-[#57506A] whitespace-nowrap">{formatThaiTime(s.atMin) || 'ยังไม่ระบุเวลา'}</span>
                                  : <span className="text-[#B9B3C7] whitespace-nowrap">ไม่เก็บวันนี้</span>}
```

และให้จำนวนจุดในตารางนับเฉพาะที่เก็บจริง — หาคอลัมน์ `{a.stops.length}` แล้วเปลี่ยนเป็น:

```jsx
                      <td className="px-3 py-2 text-right">{a.stops.filter((s) => s.served).length}</td>
```

- [ ] **Step 3: ยืนยัน**

Run: `npx tsc --noEmit && npm run lint && npm run build`

- [ ] **Step 4: Commit**

```bash
git add components/garbage/admin/StopTimesEditor.jsx components/garbage/admin/WeekScheduleView.jsx
git commit -m "feat: หน้าแอดมินติ๊กได้ว่าจุดไหนเก็บวันไหน"
```

---

## Task 8: ทะเบียนรถและคนขับ

**Files:**
- Modify: `types/garbage.ts`
- Modify: `pages/api/garbage/week.ts` และ `pages/api/garbage/schedule.ts` (ถ้าส่ง truck ออก)

- [ ] **Step 1: ตรวจก่อนว่ามีจุดไหนส่ง `Truck` ออก API สาธารณะบ้าง**

Run: `grep -rn "trucksCol\|trucks()" pages/api/garbage/ lib/garbage/resolve.ts`
อ่านผลแล้วยืนยันว่า `ResolvedAssignment` เอาไปแค่ `truckNumber` กับ `truckColor` (ไม่ได้ส่งทั้ง object) — **ถ้าพบว่ามีที่ไหนส่ง `Truck` ทั้งก้อนออก API สาธารณะ ให้หยุดและรายงาน** เพราะการเพิ่ม `driverName` จะทำให้ชื่อพนักงานหลุด

- [ ] **Step 2: เพิ่มฟิลด์ใน `types/garbage.ts`**

```ts
export interface Truck {
  number: number;
  color: TruckColor;
  plate?: string | null;
  status: TruckStatus;
  /** ชื่อพนักงานขับรถ — ข้อมูลพนักงาน ห้ามส่งออก API สาธารณะ */
  driverName?: string | null;
  /** เช่น "รถขยะอัดท้าย", "รถยกภาชนะรองรับ" */
  truckType?: string | null;
}
```

- [ ] **Step 3: ยืนยัน**

Run: `npx tsc --noEmit && npm test`

- [ ] **Step 4: Commit**

```bash
git add types/garbage.ts
git commit -m "feat: เพิ่มทะเบียนรถและประเภทรถใน Truck"
```

---

## Task 9: สคริปต์นำเข้า

**Files:**
- Create: `scripts/import-garbage-schedule.mjs`
- Modify: `lib/auditLogger.ts`, `models/AuditLog.js`, `pages/admin/superadmin/audit-log.tsx`

- [ ] **Step 1: ลงทะเบียน audit action ใหม่ครบ 4 จุด**

action `garbage_schedule_imported` (resourceType ใช้ `system` ที่มีอยู่แล้ว) · เพิ่มใน union ของ `lib/auditLogger.ts`, `enum` ของ `models/AuditLog.js`, `ACTION_LABELS` (`'นำเข้าตารางเดินรถขยะ'`) และ `ACTION_COLORS` (`'badge-warning'`)

- [ ] **Step 2: เขียนสคริปต์**

```js
#!/usr/bin/env node
/**
 * นำเข้าตารางเดินรถขยะฉบับจริงจาก data/garbage/schedule-2569.json
 *
 *   node --env-file=.env.local scripts/import-garbage-schedule.mjs           (dry-run)
 *   node --env-file=.env.local scripts/import-garbage-schedule.mjs --yes     (เขียนจริง)
 *   node --env-file=.env.local scripts/import-garbage-schedule.mjs --yes --force
 *
 * นี่คือการ re-baseline ทับข้อมูลเดิม ไม่ใช่ upsert เงียบ ๆ
 * ถ้าพบงานที่เคยถูกแก้จากหน้าแอดมิน (updatedAt ห่างจาก createdAt เกิน 1 วินาที)
 * จะไม่เขียนทับจนกว่าจะใส่ --force
 */
import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

const FILE = new URL("../data/garbage/schedule-2569.json", import.meta.url);
const LOCAL = new URL("../data/garbage/trucks.local.json", import.meta.url);
const BASELINE_EFFECTIVE_FROM = new Date("2026-01-01T00:00:00+07:00"); // ตรงกับ lib/garbage/constants.ts
const TRUCK_COLORS = { 1: "yellow", 6: "yellow" }; // ที่เหลือเขียว ตามข้อมูลเดิม

const confirmed = process.argv.includes("--yes");
const force = process.argv.includes("--force");
const uri = process.env.MONGO_URI;

const data = JSON.parse(readFileSync(FILE, "utf8"));
let registry = [];
try {
  registry = JSON.parse(readFileSync(LOCAL, "utf8")).trucks ?? [];
} catch {
  console.log("ไม่พบ trucks.local.json — ข้ามทะเบียนรถ/คนขับ (ปกติบนเครื่อง deploy)");
}

/** แปลงข้อมูลไฟล์เป็นเอกสาร routes/assignments/trucks */
function build() {
  const routes = [];
  const assignments = [];
  const truckNumbers = new Set();

  for (const t of data.trucks) {
    truckNumbers.add(t.number);
    routes.push({
      code: `R${t.number}`,
      name: `สาย R${t.number}`,
      defaultTruckNumber: t.number,
      stops: t.stops.map((s) => ({ seq: s.seq, name: s.name, mode: s.mode, roadId: null })),
      communityNames: [],
      source: data.$source,
      needsVerification: false,
      active: true,
    });

    for (let wd = 0; wd < 7; wd++) {
      const key = String(wd);
      const own = t.stops.filter((s) => key in s.times && !/เก็บแทนเบอร์/u.test(s.note ?? ""));
      const sub = t.stops.filter((s) => key in s.times && /เก็บแทนเบอร์/u.test(s.note ?? ""));

      if (own.length === 0 && sub.length === 0) {
        assignments.push({
          weekday: wd, shiftNo: 1, truckNumber: t.number, routeCode: null,
          kind: "day_off", coverForRouteCode: null, startMin: null, endMin: null,
          stopTimes: [], communityWindows: [], label: "วันหยุด",
        });
        continue;
      }
      if (own.length > 0) {
        const times = own.map((s) => s.times[key]);
        assignments.push({
          weekday: wd, shiftNo: 1, truckNumber: t.number, routeCode: `R${t.number}`,
          kind: "normal", coverForRouteCode: null,
          startMin: Math.min(...times), endMin: Math.max(...times),
          stopTimes: own.map((s) => ({ seq: s.seq, atMin: s.times[key] })).sort((a, b) => a.seq - b.seq),
          communityWindows: [], label: null,
        });
      }
      if (sub.length > 0) {
        const covered = (sub[0].note.match(/เก็บแทนเบอร์\s*(\d+)/u) ?? [])[1];
        const times = sub.map((s) => s.times[key]);
        assignments.push({
          weekday: wd, shiftNo: own.length > 0 ? 2 : 1, truckNumber: t.number,
          routeCode: `R${t.number}`, kind: "substitute",
          coverForRouteCode: covered ? `R${covered}` : null,
          startMin: Math.min(...times), endMin: Math.max(...times),
          stopTimes: sub.map((s) => ({ seq: s.seq, atMin: s.times[key] })).sort((a, b) => a.seq - b.seq),
          communityWindows: [], label: covered ? `เก็บแทนเบอร์ ${covered}` : null,
        });
      }
    }
  }

  // รถ 13 — มีแต่ว่าวันไหนเก็บ ยังไม่ระบุเวลา จึงเป็น special และ atMin เป็น null ทั้งหมด
  if (data.truck13?.stops?.length) {
    truckNumbers.add(13);
    routes.push({
      code: "R13", name: "สาย R13 (รถยกภาชนะรองรับ)", defaultTruckNumber: 13,
      stops: data.truck13.stops.map((s) => ({ seq: s.seq, name: s.name, mode: "truck", roadId: null })),
      communityNames: [], source: data.$source, needsVerification: false, active: true,
    });
    for (let wd = 0; wd < 7; wd++) {
      const served = data.truck13.stops.filter((s) => s.weekdays.includes(wd));
      assignments.push(
        served.length === 0
          ? { weekday: wd, shiftNo: 1, truckNumber: 13, routeCode: null, kind: "day_off",
              coverForRouteCode: null, startMin: null, endMin: null, stopTimes: [],
              communityWindows: [], label: "วันหยุด" }
          : { weekday: wd, shiftNo: 1, truckNumber: 13, routeCode: "R13", kind: "special",
              coverForRouteCode: null, startMin: null, endMin: null,
              stopTimes: served.map((s) => ({ seq: s.seq, atMin: null })),
              communityWindows: [], label: "รถยกภาชนะรองรับ · ยังไม่ระบุเวลา" }
      );
    }
  }

  const byNumber = new Map(registry.map((r) => [r.number, r]));
  const trucks = [...truckNumbers].sort((a, b) => a - b).map((n) => ({
    number: n,
    color: TRUCK_COLORS[n] ?? "green",
    status: "active",
    plate: byNumber.get(n)?.plate ?? null,
    driverName: byNumber.get(n)?.driverName ?? null,
    truckType: byNumber.get(n)?.truckType ?? null,
  }));

  return { routes, assignments, trucks };
}

const { routes, assignments, trucks } = build();

console.log(`จะนำเข้า: สาย ${routes.length} · งาน ${assignments.length} · รถ ${trucks.length}`);
for (const r of routes) console.log(`  ${r.code}: ${r.stops.length} จุด`);
const byKind = assignments.reduce((m, a) => ({ ...m, [a.kind]: (m[a.kind] ?? 0) + 1 }), {});
console.log("  ชนิดงาน:", JSON.stringify(byKind));

if (!confirmed) {
  console.log("\ndry-run: ยังไม่เขียนฐานข้อมูล (ใส่ --yes เพื่อเขียนจริง)");
  process.exit(0);
}
if (!uri) {
  console.error("ต้องตั้งค่า MONGO_URI (รันด้วย node --env-file=.env.local)");
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.MONGODB_DB || undefined);

// กันทับงานที่เจ้าหน้าที่แก้จากหน้าแอดมินไปแล้ว
const edited = await db.collection("garbage_assignments").countDocuments({
  $expr: { $gt: [{ $subtract: ["$updatedAt", "$createdAt"] }, 1000] },
});
if (edited > 0 && !force) {
  console.error(`\nพบงาน ${edited} รายการที่เคยถูกแก้จากหน้าแอดมิน — ยกเลิก`);
  console.error("ถ้าตั้งใจจะทับข้อมูลเหล่านั้นจริง ให้รันซ้ำด้วย --force");
  await client.close();
  process.exit(1);
}

const now = new Date();
await db.collection("garbage_assignments").deleteMany({});
await db.collection("garbage_assignments").insertMany(
  assignments.map((a) => ({ ...a, effectiveFrom: BASELINE_EFFECTIVE_FROM, effectiveTo: null, createdAt: now, updatedAt: now }))
);
for (const r of routes) {
  await db.collection("garbage_routes").updateOne(
    { code: r.code },
    { $set: { ...r, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
}
for (const t of trucks) {
  await db.collection("garbage_trucks").updateOne(
    { number: t.number },
    { $set: { ...t, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
}

console.log(`\nเขียนแล้ว: งาน ${assignments.length} · สาย ${routes.length} · รถ ${trucks.length}`);
await client.close();
```

**หมายเหตุการออกแบบที่ต้องคงไว้:** ใช้ `deleteMany` + `insertMany` กับ `garbage_assignments` เพราะจำนวนงานต่อวันเปลี่ยนไปจากเดิม (upsert จะทิ้งงานเก่าค้าง) · ส่วน routes/trucks ใช้ upsert เพราะคีย์คงที่

- [ ] **Step 3: dry-run**

Run: `node scripts/import-garbage-schedule.mjs`
Expected: `จะนำเข้า: สาย 8 · งาน 56 · รถ 8` และรายการจุดต่อสายตรงกับตารางใน spec · **ถ้าตัวเลขไม่ตรงให้หยุดและรายงาน**

- [ ] **Step 4: Commit** (ยังไม่รันจริง)

```bash
git add scripts/import-garbage-schedule.mjs lib/auditLogger.ts models/AuditLog.js pages/admin/superadmin/audit-log.tsx
git commit -m "feat: สคริปต์นำเข้าตารางเดินรถขยะฉบับจริง"
```

---

## Task 10: นำเข้าจริงและตรวจกับข้อมูล

**Files:** ไม่มีไฟล์ใหม่ — เป็นการรันและตรวจ

- [ ] **Step 1: รันจริง**

Run: `node --env-file=.env.local scripts/import-garbage-schedule.mjs --yes`
Expected: เขียนสำเร็จ · ถ้าเจอ "พบงานที่เคยถูกแก้จากหน้าแอดมิน" ให้**หยุดและรายงาน** ห้ามใส่ `--force` เอง

- [ ] **Step 2: ตรวจกับข้อมูลจริง (read-only probe ในสแครชแพด)**

เรียก `resolveWeekSchedule("2026-08-10")` แล้วยืนยันทั้งหมดนี้:

- ถนนดอกไม้แดง (สาย R1): `served` เป็น true ในวัน 0,1,3,4,6 และ **false ในวันอังคาร (2)**
- รถ 1 วันอังคาร: `kind` เป็น `day_off`
- รถ 5 วันอังคาร: มีงาน `normal` และงาน `substitute` ที่ `coverForRouteCode` เป็น `R1`
- รถ 13 ทุกวันจันทร์–เสาร์: `kind` เป็น `special` และทุกจุดที่ `served` มี `atMin` เป็น null
- ไม่มีงานไหนที่เวลาทับกันในรถคันเดียวกันวันเดียวกัน (ใช้ `findOverlap` ไล่ตรวจทุกคู่)

- [ ] **Step 3: ตรวจว่าชื่อคนขับไม่หลุด API สาธารณะ**

```bash
curl -s "http://localhost:3000/api/garbage/week" | grep -c "driverName" ; echo "(ต้องเป็น 0)"
curl -s "http://localhost:3000/api/garbage/schedule" | grep -c "driverName" ; echo "(ต้องเป็น 0)"
```
Expected: 0 ทั้งสองเส้นทาง · **ถ้าไม่ใช่ 0 ให้หยุดและรายงานทันที**

- [ ] **Step 4: รันเกตทั้งหมด**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`

---

## Task 11: เอกสาร

**Files:**
- Modify: `docs/modules/garbage.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: อัปเดต `docs/modules/garbage.md`**

เพิ่มหัวข้อ:

```markdown
## สถานะของจุดเก็บในแต่ละวัน (ตั้งแต่ M7)

`stopTimes` คือ **รายการจุดที่เก็บในวันนั้น** โดยเวลาเป็นค่าว่างได้:

| สถานะ | ข้อมูล | หน้าประชาชนเห็น |
|---|---|---|
| เก็บ รู้เวลา | อยู่ใน `stopTimes` + `atMin` มีค่า | เวลา เช่น "4.00 น." |
| เก็บ ยังไม่ระบุเวลา | อยู่ใน `stopTimes` + `atMin` เป็น null | "ยังไม่ระบุเวลา" |
| วันนี้ไม่เก็บ | ไม่อยู่ใน `stopTimes` | "ไม่เก็บวันนี้" (จาง) |

`ResolvedAssignment.stops[]` จึงมีทั้ง `served` และ `atMin` — **อย่าใช้ `atMin == null` ตัดสินว่าเก็บหรือไม่เก็บ**

## ข้อมูลตั้งต้น

- `data/garbage/schedule-2569.json` — ตารางฉบับจริงจากกองสาธารณสุข (8 คัน 7 วัน 172 จุด) นำเข้าด้วย `scripts/import-garbage-schedule.mjs`
- `data/garbage/trucks.local.json` — ทะเบียนรถ/ชื่อคนขับ **gitignore ไว้เพราะ repo นี้ public** · ไม่มีไฟล์นี้สคริปต์ยังรันได้ แค่ข้ามข้อมูลส่วนนั้น
- `data/garbage/schedule-seed.json` + `scripts/seed-garbage.mjs` — ชุดเก่าจาก M1 (จันทร์+อังคาร) เก็บไว้เป็นประวัติ **อย่ารันทับข้อมูลจริง**
- **`driverName` ห้ามส่งออก API สาธารณะ** — แสดงได้เฉพาะหน้าแอดมิน
```

- [ ] **Step 2: อัปเดตบรรทัดโมดูลใน `CLAUDE.md`** เติมว่าข้อมูลจริงมาจาก `schedule-2569.json` และ `stopTimes` แยกสามสถานะ

- [ ] **Step 3: Commit**

```bash
git add docs/modules/garbage.md CLAUDE.md
git commit -m "docs: อัปเดตเอกสารโมดูล garbage สำหรับ M7"
```

---

## เช็กลิสต์ยืนยันว่า M7 เสร็จ

- [ ] `npm test` ผ่าน รวมเทสใหม่ของสามสถานะและ validators
- [ ] `tsc --noEmit` / `lint` / `build` ผ่าน
- [ ] dry-run ของสคริปต์นำเข้าให้ตัวเลขตรงกับตารางใน spec
- [ ] หลังนำเข้า: ถนนดอกไม้แดงไม่เก็บวันอังคาร · รถ 1 วันอังคารเป็นวันหยุด · รถ 5 วันอังคารมีงานแทนเบอร์ 1 · รถ 13 ทุกจุดขึ้น "ยังไม่ระบุเวลา"
- [ ] `curl /api/garbage/week` และ `/schedule` ไม่มีคำว่า `driverName`
- [ ] ไม่มีงานที่เวลาทับกันในรถคันเดียวกันวันเดียวกัน

## งานที่ต้องทำมือหลัง merge

1. ให้กองสาธารณสุขกรอกเวลาของรถ 13 ผ่าน `/admin/garbage` (ตอนนี้ทำได้แล้วเพราะ M6 ให้ติ๊ก "เก็บ" แยกจากเวลา)
2. ตรวจว่าชุมชน (`communityNames` / `communityWindows`) ยังว่างอยู่ — ข้อมูลจริงไม่มีคอลัมน์ชุมชน ถ้าต้องการให้ค้นด้วยชื่อชุมชนได้เหมือนเดิม ต้องขอ mapping จุด→ชุมชน จากกองสาธารณสุขเพิ่ม
