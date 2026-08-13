# แก้ไขตารางรถขยะจากหน้าแอดมิน (M6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้เจ้าหน้าที่กองสาธารณสุขเพิ่ม/แก้/ลบงานมอบหมายรายวัน และแก้ชื่อสาย/รายการจุดเก็บได้เองจาก `/admin/garbage` โดยไม่ต้องแก้ JSON แล้วรันสคริปต์

**Architecture:** UI เป็นแหล่งความจริง seed เหลือเป็น bootstrap ตอน DB ว่าง · ไม่ทำ versioning (ทับข้อมูลเดิม) แต่บันทึกทุกการแก้ลง audit log · กฎข้ามเอกสาร (เวลารถทับกัน, ลำดับจุด) แยกเป็น pure function ใน `lib/garbage/` เพื่อเทสได้โดยไม่ต้องมี MongoDB · การแก้รายการจุดเขียน `stopTimes` ของงานก่อนแล้วจึงเขียน `route.stops` เพื่อให้ล้มกลางทางแล้ว "ไม่มีเวลา" ไม่ใช่ "เวลาผิด"

**Tech Stack:** Next.js 15 Pages Router, TypeScript strict, MongoDB native driver ~6.16, Zod, Vitest, Tailwind + DaisyUI, Clerk

**Spec:** `docs/superpowers/specs/2026-08-13-garbage-crud-design.md`

**Branch:** `feat/garbage-crud` (แตกจาก `feat/garbage-ui` — stacked ชั้นที่ 3) **ห้ามสลับ branch**

---

## บริบทที่ผู้รับงานต้องรู้ก่อนเริ่ม

**สิ่งที่มีอยู่แล้ว (M1–M5):** `types/garbage.ts` · `lib/garbage/{time,labels,db,validators,resolve,live}.ts` + เทส · API `pages/api/garbage/{schedule,week,search,live,settings}.ts` + `_auth.ts` (`requireGarbageAdmin`) · หน้า `/garbage` (ประชาชน) · หน้า `/admin/garbage` อ่านอย่างเดียว (`components/garbage/admin/{WeekScheduleView,ContactSettingsCard}.jsx`) · `components/ui/adminTheme.jsx` · DB จริง: `garbage_trucks` 7, `garbage_routes` 7, `garbage_communities` 21, `garbage_assignments` 17 (จันทร์+อังคาร), `garbage_settings`, `roads` 532

**กฎที่พลาดง่าย:**

1. **API โมดูลนี้คืน `{ error: string }`** ไม่ใช่ `{ success, message }`
2. **ห้ามฟอร์แมตเวลาเอง** ใช้ `formatThaiTime` / `formatRange` จาก `lib/garbage/time.ts`
3. **collection ต้อง prefix `garbage_`** — ชื่อเปล่า `assignments`/`communities` เป็นของโมดูลร้องเรียน (มี 507 docs)
4. **`effectiveFrom` ใช้ค่า baseline คงที่** `2026-01-01T00:00:00+07:00` และ `effectiveTo = null` เสมอ (รอบนี้ไม่ทำ versioning) — resolver ยังกรองด้วยฟิลด์นี้เหมือนเดิม
5. **audit log มี 4 จุดที่ต้องลงทะเบียน ไม่ใช่ 2** และจุดที่ 2 พลาดแล้ว**เงียบสนิท** เพราะ `logAuditEvent` เป็น fire-and-forget (กลืน error): (ก) union ใน `lib/auditLogger.ts` (ข) **mongoose `enum` ใน `models/AuditLog.js` ทั้ง `action` และ `resourceType`** (ค) `ACTION_LABELS` และ (ง) `ACTION_COLORS` ใน `pages/admin/superadmin/audit-log.tsx`
6. **เทสของโมดูลนี้วางแบบ colocate** (`lib/garbage/time.test.ts`) ไม่ใช่ `__tests__/` — vitest config รวมทั้ง `lib/**/__tests__/**/*.test.js` และ `lib/**/*.test.ts`

**คำสั่ง:** `npm test` · `npx vitest run <path>` · `npx tsc --noEmit` · `npm run lint` · `npm run build` · dev server `npm run dev` (พอร์ต 3000 อาจไม่ว่าง Next ขยับเอง) · **ปิด dev server ก่อนรัน build** (ใช้ `.next` ร่วมกัน)

**ข้อจำกัดการทดสอบที่รู้ล่วงหน้า:** ไม่มี agent ไหนล็อกอิน Clerk ได้ (ยืนยันแล้วใน M4–M5) จึงทดสอบ API ที่ต้อง auth ผ่าน curl ได้แค่ 401 · **ห้ามปลอม session token** · ให้ทดสอบ logic ผ่าน pure function + เทส แล้วรายงานตามจริงว่าอะไรพิสูจน์แล้วอะไรอนุมาน

---

## File Structure

| ไฟล์ | ความรับผิดชอบ |
|---|---|
| `lib/garbage/constants.ts` | ค่าคงที่ที่ใช้ร่วมหลายที่ (baseline `effectiveFrom`) |
| `lib/garbage/overlap.ts` + `.test.ts` | ตรวจเวลารถทับกัน (pure) |
| `lib/garbage/stopEditing.ts` + `.test.ts` | จัดลำดับจุดใหม่, ย้ายเวลาตามจุด, กระจายเวลาเท่ากัน (pure) |
| `lib/garbage/validators.ts` | เพิ่ม `assignmentInputSchema`, `routeUpdateSchema` |
| `lib/garbage/db.ts` | เพิ่ม unique index ของ `(weekday, truckNumber, shiftNo)` |
| `scripts/seed-garbage.mjs` | เปลี่ยนเป็น insert-only ไม่ทับค่าที่แก้จาก UI |
| `lib/auditLogger.ts`, `models/AuditLog.js`, `pages/admin/superadmin/audit-log.tsx` | ลงทะเบียน action ใหม่ 4 จุด |
| `pages/api/garbage/assignments/index.ts` | POST สร้างงาน |
| `pages/api/garbage/assignments/[id].ts` | PUT แก้ / DELETE ลบ |
| `pages/api/garbage/routes/index.ts` | GET รายการสายสำหรับฟอร์ม (ต้องล็อกอิน) |
| `pages/api/garbage/routes/[code].ts` | PUT แก้ชื่อสาย/จุด/ปลดป้ายรอตรวจสอบ |
| `components/garbage/admin/AssignmentFormModal.jsx` | ฟอร์มเพิ่ม/แก้งาน |
| `components/garbage/admin/StopTimesEditor.jsx` | ตั้งเวลารายจุด + กระจายเท่ากัน |
| `components/garbage/admin/RouteManagerModal.jsx` | จัดการสายและรายการจุด |
| `components/garbage/admin/WeekScheduleView.jsx` | เพิ่มปุ่มเพิ่ม/แก้/ลบ |
| `pages/admin/garbage.jsx` | ต่อสายทุกอย่าง |
| `docs/modules/garbage.md` | อัปเดตเอกสาร |

---

## Task 1: baseline constant + seed เป็น insert-only

**Files:**
- Create: `lib/garbage/constants.ts`
- Modify: `scripts/seed-garbage.mjs`

- [ ] **Step 1: สร้าง `lib/garbage/constants.ts`**

```ts
/**
 * วันเริ่มมีผลของงานมอบหมายทุกตัว
 *
 * รอบนี้ไม่ทำ versioning (แก้แล้วทับเลย) จึงตั้งค่านี้คงที่ให้ทุกงาน และ effectiveTo = null
 * → resolver มองเห็นงานทุกตัวในทุกวันที่ค้นหา "อะไรอยู่ใน DB คือตารางที่ใช้จริง"
 *
 * ไม่ใช้ "วันนี้" เป็นค่าเริ่ม เพราะเจ้าหน้าที่ที่กรอกตารางวันพุธในวันพฤหัสบดี
 * จะไม่เห็นงานที่เพิ่งกรอกในสัปดาห์ปัจจุบัน (วันพุธที่ผ่านมาอยู่ก่อน effectiveFrom)
 *
 * ค่าเดียวกันนี้ถูกคัดลอกไว้ใน scripts/seed-garbage.mjs (สคริปต์ .mjs import .ts ไม่ได้)
 * — แก้ที่นี่ต้องแก้ที่นั่นด้วย
 */
export const BASELINE_EFFECTIVE_FROM = new Date("2026-01-01T00:00:00+07:00");
```

- [ ] **Step 2: เปลี่ยน seed เป็น insert-only**

ใน `scripts/seed-garbage.mjs` แก้ helper `up()` และคอมเมนต์หัวไฟล์

หัวไฟล์ — แทนที่บรรทัดที่บอกว่า seed คือ source of truth ด้วย:

```js
/**
 * นำเข้าข้อมูลตั้งต้นของตารางรถขยะ — ใช้ตอน DB ว่างเท่านั้น
 *   node --env-file=.env.local scripts/seed-garbage.mjs
 *   node scripts/seed-garbage.mjs --dry-run
 *
 * insert-only: เอกสารที่มีอยู่แล้วจะไม่ถูกแตะ เพราะ **ข้อมูลจริงแก้จาก /admin/garbage**
 * (ตั้งแต่ M6 UI เป็นแหล่งความจริง ไฟล์ JSON นี้จะ drift จาก DB เป็นเรื่องปกติ)
 * รันซ้ำได้ปลอดภัย — จะรายงานว่าข้ามไปกี่รายการ
 */
```

helper — เปลี่ยนจาก `$set` เป็น `$setOnInsert` ทั้งก้อน:

```js
// insert-only: ใช้ $setOnInsert ทุกฟิลด์ เอกสารที่มีอยู่แล้วจึงไม่ถูกทับ
// (ก่อน M6 ใช้ $set ซึ่งจะล้างค่าที่เจ้าหน้าที่แก้จากหน้าแอดมิน)
const up = (filter, doc) => ({
  updateOne: {
    filter,
    update: { $setOnInsert: { ...doc, createdAt: now, updatedAt: now } },
    upsert: true,
  },
});
```

- [ ] **Step 3: รายงานจำนวนที่ข้าม**

แทนที่บล็อกที่ `console.log` ผลลัพธ์ 4 บรรทัด ด้วยเวอร์ชันที่บอกทั้งเพิ่มและข้าม:

```js
const report = (label, res, total) => {
  const added = res.upsertedCount;
  const skipped = total - added;
  console.log(`${label} +${added} เพิ่มใหม่ · ข้าม ${skipped} (มีอยู่แล้ว ไม่ถูกทับ)`);
};
report("garbage_trucks", r1, seed.trucks.length);
report("garbage_communities", r2, seed.communities.length);
report("garbage_routes", r3, seed.routes.length);
report("garbage_assignments", r4, seed.assignments.length);
console.log("(insert-only — ข้อมูลจริงแก้จาก /admin/garbage)");
```

ลบบรรทัด legend เดิม `(+ = เพิ่มใหม่, ~ = อัปเดต ...)` ออกเพราะไม่มี `~` แล้ว · ส่วนคำเตือน "มีเอกสารมากกว่าใน seed" ให้คงไว้แต่แก้ข้อความเป็น "มีเอกสารมากกว่าใน seed — ปกติถ้าเพิ่มงานจากหน้าแอดมิน" เพราะตอนนี้เป็นเรื่องคาดหมาย ไม่ใช่ความผิดปกติ

- [ ] **Step 4: ทดสอบว่าไม่ทับข้อมูลจริง**

```bash
node scripts/seed-garbage.mjs --dry-run
node --env-file=.env.local scripts/seed-garbage.mjs
```
Expected: dry-run ผ่าน · รันจริงได้ `+0 เพิ่มใหม่ · ข้าม 7/21/7/17` ทุก collection (ข้อมูลมีอยู่แล้วครบ)

พิสูจน์ว่าไม่ทับจริงด้วย read-only probe: อ่าน `updatedAt` ของ assignment หนึ่งตัวก่อนและหลังรัน — **ต้องเท่ากัน** (ก่อน M6 จะเปลี่ยนทุกครั้ง)

- [ ] **Step 5: Commit**

```bash
git add lib/garbage/constants.ts scripts/seed-garbage.mjs
git commit -m "feat: seed เป็น insert-only + baseline effectiveFrom ที่เดียว"
```

---

## Task 2: unique index ของคีย์ธรรมชาติ

CRUD ต้องมีคีย์ที่ไม่ซ้ำ ไม่งั้นเพิ่มงานรถคันเดิมรอบเดิมซ้ำได้แล้ว resolver จะเลือกตัวไหนก็ไม่แน่นอน

**Files:**
- Modify: `lib/garbage/db.ts`
- Modify: `scripts/seed-garbage.mjs`

- [ ] **Step 1: ตรวจก่อนว่าข้อมูลที่มีไม่ชนกันเอง**

เขียน probe อ่านอย่างเดียว (ในสแครชแพด ไม่ใช่ในรีโป) นับ `garbage_assignments` ที่มีคีย์ `(weekday, truckNumber, shiftNo)` ซ้ำ ด้วย aggregation `$group` + `$match: { count: { $gt: 1 } }`

Expected: 0 กลุ่มที่ซ้ำ · **ถ้าเจอซ้ำให้หยุดและรายงาน BLOCKED** ห้ามลบข้อมูลเอง

- [ ] **Step 2: เพิ่ม unique index ใน `lib/garbage/db.ts#ensureIndexes`**

แทนที่บรรทัด index เดิมของ `garbage_assignments` ที่เป็น `{ truckNumber: 1, weekday: 1, shiftNo: 1 }` (ไม่ unique) ด้วย:

```ts
  // คีย์ธรรมชาติของงานมอบหมาย — unique เพื่อกันเพิ่มซ้ำจากหน้าแอดมิน (M6)
  await db
    .collection("garbage_assignments")
    .createIndex({ weekday: 1, truckNumber: 1, shiftNo: 1 }, { unique: true, name: "natural_key" });
```

หมายเหตุ: สลับลำดับฟิลด์เป็น `weekday` นำหน้าเพื่อให้ index นี้ช่วยคิวรีรายวันได้ด้วย · ตั้ง `name` ชัดเจนเพราะชื่ออัตโนมัติจะยาว

- [ ] **Step 3: อัปเดต `scripts/seed-garbage.mjs` ให้ตรงกัน**

หา `createIndex({ truckNumber: 1, weekday: 1, shiftNo: 1 })` ในสคริปต์ แล้วเปลี่ยนให้เหมือน Step 2 (ไฟล์นั้นมีคอมเมนต์กำกับอยู่แล้วว่าต้องแก้ทั้งสองที่)

- [ ] **Step 4: สร้าง index จริงและยืนยัน**

```bash
node --env-file=.env.local scripts/seed-garbage.mjs
```
แล้ว probe อ่าน index ของ `garbage_assignments`
Expected: มี `natural_key` และ `unique: true` · index เดิมชื่ออัตโนมัติ (`truckNumber_1_weekday_1_shiftNo_1`) อาจยังค้างอยู่ — **ปล่อยไว้ ไม่ต้องลบ** (ไม่เสียหาย และการลบ index บน DB จริงเป็นการทำลายที่ไม่จำเป็น) แต่ให้รายงานว่าเจอ

- [ ] **Step 5: Commit**

```bash
git add lib/garbage/db.ts scripts/seed-garbage.mjs
git commit -m "feat: unique index คีย์ธรรมชาติของงานมอบหมาย"
```

---

## Task 3: พา `id` ของงานออกมาถึงหน้าแอดมิน

**ปัญหาที่ต้องแก้ก่อนทำ CRUD:** `buildDaySchedule` สร้าง `ResolvedAssignment` เป็น object literal ใหม่โดย**ไม่ใส่ `_id`** (ตั้งใจไว้ตอน M1–M3 เพื่อไม่ให้ `_id` รั่วออก API สาธารณะ) ผลคือหน้าแอดมินไม่รู้ว่าจะยิง `PUT`/`DELETE` ไปที่งานไหน — ปุ่มแก้/ลบจะยิงไปที่ `/assignments/undefined`

ทางแก้: เพิ่มฟิลด์ `id: string` (สตริง ไม่ใช่ `ObjectId`) แล้ว map จาก `_id` ของเอกสาร · ยอมให้ `id` ปรากฏใน API สาธารณะได้ เพราะเป็นแค่รหัสอ้างอิงเอกสาร ไม่ใช่ข้อมูลอ่อนไหว และหน้าประชาชนก็ไม่ได้ใช้

**Files:**
- Modify: `types/garbage.ts`
- Modify: `lib/garbage/resolve.ts`
- Test: `lib/garbage/resolve.test.ts`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

เพิ่มใน `describe("buildDaySchedule", ...)`:

```ts
  it("พา id ของเอกสารออกมาเป็นสตริง", () => {
    const a = [{
      ...base, _id: { toString: () => "abc123" }, weekday: 1, shiftNo: 1, truckNumber: 1,
      routeCode: "R1", kind: "normal" as const, startMin: 240, endMin: 300, stopTimes: [],
    }];
    const out = buildDaySchedule("2026-08-10", 1, a as never, routes, trucks);
    expect(out.assignments[0].id).toBe("abc123");
  });

  it("เอกสารที่ไม่มี _id (เช่นในเทส) ได้ id เป็นค่าว่าง ไม่พัง", () => {
    const a: Assignment[] = [{
      ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal",
      startMin: 240, endMin: 300, stopTimes: [],
    }];
    const out = buildDaySchedule("2026-08-10", 1, a, routes, trucks);
    expect(out.assignments[0].id).toBe("");
  });
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run lib/garbage/resolve.test.ts`
Expected: FAIL — `expected undefined to be "abc123"`

- [ ] **Step 3: เพิ่มฟิลด์ใน `types/garbage.ts`**

ใน `interface ResolvedAssignment` เพิ่มเป็นฟิลด์แรก:

```ts
  /** รหัสเอกสารในรูปสตริง — หน้าแอดมินใช้อ้างตอนแก้/ลบ; ว่างได้เมื่อสร้างจากข้อมูลที่ไม่มาจาก DB */
  id: string;
```

- [ ] **Step 4: map ค่าใน `lib/garbage/resolve.ts`**

เปลี่ยนซิกเนเจอร์ของ `buildDaySchedule` ให้รับเอกสารที่อาจมี `_id` (เอกสารจาก DB เป็น `WithId<Assignment>` อยู่แล้ว):

```ts
export function buildDaySchedule(
  date: string,
  weekday: Weekday,
  list: Array<Assignment & { _id?: unknown }>,
  routes: Route[],
  trucks: Truck[]
): ResolvedDaySchedule {
```

และใน object literal ที่สร้าง `ResolvedAssignment` เพิ่มเป็นบรรทัดแรก:

```ts
      id: a._id == null ? "" : String(a._id),
```

`buildWeekSchedule` เรียก `buildDaySchedule` ต่อ จึงได้ผลตามไปเอง — แต่ต้องแก้ซิกเนเจอร์ของ `buildWeekSchedule` ให้รับ `Array<Assignment & { _id?: unknown }>` ด้วย ไม่งั้น tsc จะบ่นตอนส่งต่อ

- [ ] **Step 5: รันเทสให้ผ่าน**

Run: `npx vitest run lib/garbage/resolve.test.ts && npx tsc --noEmit && npm test`
Expected: PASS ทุกเทสในไฟล์ (เดิม 20 + ใหม่ 2 = 22) · tsc เงียบ · เทสรวมผ่าน

- [ ] **Step 6: ยืนยันกับข้อมูลจริง**

เขียน probe อ่านอย่างเดียวในสแครชแพดที่เรียก `resolveWeekSchedule("2026-08-12")` แล้วตรวจว่างานทุกตัวมี `id` เป็นสตริง 24 ตัวอักษร (ObjectId hex) ไม่ใช่ค่าว่าง

- [ ] **Step 7: Commit**

```bash
git add types/garbage.ts lib/garbage/resolve.ts lib/garbage/resolve.test.ts
git commit -m "feat: expose assignment id for admin editing"
```

---

## Task 4: `findOverlap` — กันจองรถซ้อนเวลา

**Files:**
- Create: `lib/garbage/overlap.ts`
- Test: `lib/garbage/overlap.test.ts`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```ts
import { describe, it, expect } from "vitest";
import { findOverlap } from "./overlap";
import type { Minutes } from "@/types/garbage";

interface Row {
  _id: string;
  weekday: number;
  truckNumber: number;
  shiftNo: number;
  startMin: Minutes | null;
  endMin: Minutes | null;
}

const row = (o: Partial<Row>): Row => ({
  _id: "a1", weekday: 1, truckNumber: 1, shiftNo: 1, startMin: 240, endMin: 300, ...o,
});

describe("findOverlap", () => {
  it("ไม่มีงานอื่นเลย = ไม่ทับ", () => {
    expect(findOverlap([], row({}))).toBeNull();
  });

  it("เวลาทับกันบางส่วน = เจอ", () => {
    const existing = [row({ _id: "old", shiftNo: 1, startMin: 240, endMin: 300 })];
    const hit = findOverlap(existing, row({ _id: "new", shiftNo: 2, startMin: 290, endMin: 400 }));
    expect(hit?._id).toBe("old");
  });

  it("ครอบทั้งช่วง = เจอ", () => {
    const existing = [row({ _id: "old", shiftNo: 1, startMin: 300, endMin: 320 })];
    expect(findOverlap(existing, row({ _id: "new", shiftNo: 2, startMin: 240, endMin: 400 }))?._id).toBe("old");
  });

  it("ประชิดพอดี (จบ 300 เริ่ม 300) = ไม่ทับ", () => {
    const existing = [row({ _id: "old", shiftNo: 1, startMin: 240, endMin: 300 })];
    expect(findOverlap(existing, row({ _id: "new", shiftNo: 2, startMin: 300, endMin: 400 }))).toBeNull();
  });

  it("ข้ามตัวเองตอนแก้งานเดิม", () => {
    const existing = [row({ _id: "same", shiftNo: 1, startMin: 240, endMin: 300 })];
    expect(findOverlap(existing, row({ _id: "same", shiftNo: 1, startMin: 250, endMin: 310 }))).toBeNull();
  });

  it("รถต่างคัน ไม่ถือว่าทับ", () => {
    const existing = [row({ _id: "old", truckNumber: 2, startMin: 240, endMin: 300 })];
    expect(findOverlap(existing, row({ _id: "new", truckNumber: 1, startMin: 240, endMin: 300 }))).toBeNull();
  });

  it("วันต่างกัน ไม่ถือว่าทับ", () => {
    const existing = [row({ _id: "old", weekday: 2, startMin: 240, endMin: 300 })];
    expect(findOverlap(existing, row({ _id: "new", weekday: 1, startMin: 240, endMin: 300 }))).toBeNull();
  });

  it("วันหยุดที่ไม่มีเวลา ข้ามทั้งสองฝั่ง", () => {
    const dayOff = row({ _id: "off", startMin: null, endMin: null });
    expect(findOverlap([dayOff], row({ _id: "new", startMin: 240, endMin: 300 }))).toBeNull();
    expect(findOverlap([row({ _id: "old" })], row({ _id: "new", startMin: null, endMin: null }))).toBeNull();
  });

  it("ทับหลายตัว คืนตัวที่เวลาเริ่มก่อนสุด", () => {
    const existing = [
      row({ _id: "late", shiftNo: 2, startMin: 400, endMin: 500 }),
      row({ _id: "early", shiftNo: 1, startMin: 200, endMin: 500 }),
    ];
    expect(findOverlap(existing, row({ _id: "new", shiftNo: 3, startMin: 250, endMin: 450 }))?._id).toBe("early");
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run lib/garbage/overlap.test.ts`
Expected: FAIL — `Failed to resolve import "./overlap"`

- [ ] **Step 3: เขียน implementation**

```ts
import type { Minutes } from "@/types/garbage";

/** ข้อมูลเท่าที่การตรวจเวลาทับต้องใช้ — รับได้ทั้งเอกสารจาก DB และข้อมูลจากฟอร์ม */
export interface OverlapCandidate {
  _id?: unknown;
  weekday: number;
  truckNumber: number;
  shiftNo: number;
  startMin: Minutes | null;
  endMin: Minutes | null;
}

/**
 * หางานของรถคันเดียวกันในวันเดียวกันที่เวลาทับกับ candidate
 * คืนตัวที่เวลาเริ่มก่อนสุด หรือ null ถ้าไม่ทับ
 *
 * ประชิดพอดีไม่ถือว่าทับ (จบ 300 แล้วเริ่ม 300 ได้) เพราะรอบต่อเนื่องกันเป็นเรื่องปกติในตารางจริง
 * งานที่ไม่มีเวลา (วันหยุด) ข้ามทั้งสองฝั่ง — ไม่มีเวลาก็ไม่มีอะไรให้ทับ
 * ข้ามเอกสารที่ _id เท่ากับ candidate เพื่อให้แก้งานเดิมได้โดยไม่ชนตัวเอง
 */
export function findOverlap<T extends OverlapCandidate>(
  existing: T[],
  candidate: OverlapCandidate
): T | null {
  if (candidate.startMin == null || candidate.endMin == null) return null;
  const candId = candidate._id == null ? null : String(candidate._id);

  const hits = existing.filter((a) => {
    if (a.startMin == null || a.endMin == null) return false;
    if (a.weekday !== candidate.weekday) return false;
    if (a.truckNumber !== candidate.truckNumber) return false;
    if (candId != null && a._id != null && String(a._id) === candId) return false;
    // ทับกันเมื่อช่วงเวลาซ้อนกันจริง — ประชิดพอดี (a.endMin === candidate.startMin) ไม่นับ
    return a.startMin < (candidate.endMin as number) && (candidate.startMin as number) < a.endMin;
  });

  if (hits.length === 0) return null;
  return hits.reduce((best, a) => ((a.startMin as number) < (best.startMin as number) ? a : best));
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `npx vitest run lib/garbage/overlap.test.ts && npx tsc --noEmit`
Expected: PASS ทั้ง 9 เทส และ tsc เงียบ

- [ ] **Step 5: Commit**

```bash
git add lib/garbage/overlap.ts lib/garbage/overlap.test.ts
git commit -m "feat: add findOverlap to prevent double-booking a truck"
```

---

## Task 5: `stopEditing` — จัดลำดับจุดและย้ายเวลา

**Files:**
- Create: `lib/garbage/stopEditing.ts`
- Test: `lib/garbage/stopEditing.test.ts`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```ts
import { describe, it, expect } from "vitest";
import { assignSeq, buildSeqMap, remapStopTimes, distributeStopTimes } from "./stopEditing";

describe("assignSeq", () => {
  it("ให้ seq 1..n ตามลำดับที่ส่งมา", () => {
    const out = assignSeq([
      { prevSeq: 3, name: "ค", mode: "truck" },
      { prevSeq: null, name: "ใหม่", mode: "walk" },
      { prevSeq: 1, name: "ก", mode: "truck" },
    ]);
    expect(out.map((s) => s.seq)).toEqual([1, 2, 3]);
    expect(out.map((s) => s.name)).toEqual(["ค", "ใหม่", "ก"]);
    expect(out[1].mode).toBe("walk");
  });

  it("ไม่พา prevSeq ติดไปในผลลัพธ์", () => {
    const out = assignSeq([{ prevSeq: 5, name: "ก", mode: "truck" }]);
    expect(out[0]).toEqual({ seq: 1, name: "ก", mode: "truck", roadId: null });
  });
});

describe("buildSeqMap", () => {
  it("จับคู่ seq เดิมกับ seq ใหม่ ข้ามจุดที่เพิ่มใหม่", () => {
    const map = buildSeqMap([
      { prevSeq: 3, name: "ค", mode: "truck" },
      { prevSeq: null, name: "ใหม่", mode: "truck" },
      { prevSeq: 1, name: "ก", mode: "truck" },
    ]);
    expect(map.get(3)).toBe(1);
    expect(map.get(1)).toBe(3);
    expect(map.has(2)).toBe(false); // จุดที่ 2 ถูกลบ
    expect(map.size).toBe(2);
  });
});

describe("remapStopTimes", () => {
  const map = new Map([
    [1, 2],
    [3, 1],
  ]); // จุด 1 ย้ายไปที่ 2, จุด 3 ย้ายไปที่ 1, จุด 2 ถูกลบ

  it("ย้ายเวลาไปตามจุดเดิม ไม่ใช่ตามตำแหน่ง", () => {
    const out = remapStopTimes(map, [
      { seq: 1, atMin: 240 },
      { seq: 3, atMin: 300 },
    ]);
    expect(out).toEqual([
      { seq: 1, atMin: 300 },
      { seq: 2, atMin: 240 },
    ]);
  });

  it("ตัดเวลาของจุดที่ถูกลบออก", () => {
    const out = remapStopTimes(map, [
      { seq: 1, atMin: 240 },
      { seq: 2, atMin: 260 },
    ]);
    expect(out).toEqual([{ seq: 2, atMin: 240 }]);
  });

  it("เรียงผลลัพธ์ตาม seq ใหม่", () => {
    const out = remapStopTimes(map, [
      { seq: 1, atMin: 240 },
      { seq: 3, atMin: 100 },
    ]);
    expect(out.map((s) => s.seq)).toEqual([1, 2]);
  });

  it("ไม่มีเวลาเดิม = ได้อาเรย์ว่าง", () => {
    expect(remapStopTimes(map, [])).toEqual([]);
  });
});

describe("distributeStopTimes", () => {
  it("กระจายเท่ากันตลอดช่วง จุดแรกที่เวลาเริ่ม จุดสุดท้ายที่เวลาจบ", () => {
    expect(distributeStopTimes(3, 240, 300)).toEqual([
      { seq: 1, atMin: 240 },
      { seq: 2, atMin: 270 },
      { seq: 3, atMin: 300 },
    ]);
  });

  it("จุดเดียว ได้เวลาเริ่ม", () => {
    expect(distributeStopTimes(1, 240, 300)).toEqual([{ seq: 1, atMin: 240 }]);
  });

  it("ช่วงเวลาเป็นศูนย์ ทุกจุดเวลาเดียวกัน", () => {
    expect(distributeStopTimes(3, 300, 300)).toEqual([
      { seq: 1, atMin: 300 },
      { seq: 2, atMin: 300 },
      { seq: 3, atMin: 300 },
    ]);
  });

  it("ปัดเป็นจำนวนเต็มและไม่ย้อนกลับ", () => {
    const out = distributeStopTimes(22, 240, 550);
    expect(out).toHaveLength(22);
    expect(out.every((s) => Number.isInteger(s.atMin))).toBe(true);
    expect(out[0].atMin).toBe(240);
    expect(out[21].atMin).toBe(550);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].atMin).toBeGreaterThanOrEqual(out[i - 1].atMin);
    }
  });

  it("จำนวนจุดไม่ถูกต้อง ได้อาเรย์ว่าง", () => {
    expect(distributeStopTimes(0, 240, 300)).toEqual([]);
    expect(distributeStopTimes(-1, 240, 300)).toEqual([]);
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run lib/garbage/stopEditing.test.ts`
Expected: FAIL — `Failed to resolve import "./stopEditing"`

- [ ] **Step 3: เขียน implementation**

```ts
import type { Minutes, RouteStop, StopMode, StopTime } from "@/types/garbage";

/** จุดเก็บที่ส่งมาจากฟอร์มแก้สาย — prevSeq = seq เดิม (null ถ้าเป็นจุดใหม่) */
export interface StopDraft {
  prevSeq: number | null;
  name: string;
  mode: StopMode;
  roadId?: string | null;
}

/** ให้เลขลำดับใหม่ 1..n ตามลำดับที่ส่งมา — เซิร์ฟเวอร์เป็นคนกำหนด seq ไม่ใช่ client */
export function assignSeq(drafts: StopDraft[]): RouteStop[] {
  return drafts.map((d, i) => ({
    seq: i + 1,
    name: d.name,
    mode: d.mode,
    roadId: d.roadId ?? null,
  }));
}

/** ตาราง seq เดิม → seq ใหม่ (จุดที่เพิ่มใหม่ไม่มีใน map, จุดที่ถูกลบก็ไม่มี) */
export function buildSeqMap(drafts: StopDraft[]): Map<number, number> {
  const map = new Map<number, number>();
  drafts.forEach((d, i) => {
    if (d.prevSeq != null) map.set(d.prevSeq, i + 1);
  });
  return map;
}

/**
 * ย้ายเวลาของแต่ละจุดไปตาม seq ใหม่ — ยึด "จุดเดิมตัวไหน" ไม่ใช่ "ตำแหน่งที่เท่าไร"
 * จุดที่ถูกลบออกจากสาย เวลาของมันหายไปด้วย
 */
export function remapStopTimes(
  prevToNew: Map<number, number>,
  stopTimes: StopTime[]
): StopTime[] {
  return stopTimes
    .flatMap((st) => {
      const next = prevToNew.get(st.seq);
      return next == null ? [] : [{ seq: next, atMin: st.atMin }];
    })
    .sort((a, b) => a.seq - b.seq);
}

/**
 * กระจายเวลาให้จุดทั้งหมดเท่า ๆ กันในช่วง startMin–endMin
 * ใช้เป็นตัวช่วยกรอก (สาย R1 มี 22 จุด) แล้วเจ้าหน้าที่ปรับรายตัวได้
 */
export function distributeStopTimes(count: number, startMin: Minutes, endMin: Minutes): StopTime[] {
  if (!Number.isInteger(count) || count < 1) return [];
  if (count === 1) return [{ seq: 1, atMin: startMin }];
  const span = endMin - startMin;
  return Array.from({ length: count }, (_, i) => ({
    seq: i + 1,
    atMin: startMin + Math.round((span * i) / (count - 1)),
  }));
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `npx vitest run lib/garbage/stopEditing.test.ts && npx tsc --noEmit`
Expected: PASS ทั้ง 12 เทส และ tsc เงียบ

- [ ] **Step 5: Commit**

```bash
git add lib/garbage/stopEditing.ts lib/garbage/stopEditing.test.ts
git commit -m "feat: add stop reordering and time distribution helpers"
```

---

## Task 6: validators ของฟอร์ม

**Files:**
- Modify: `lib/garbage/validators.ts`

- [ ] **Step 1: เพิ่มท้ายไฟล์**

```ts
/**
 * ข้อมูลงานมอบหมายที่รับจากฟอร์มแอดมิน
 * ไม่มี effectiveFrom/effectiveTo — เซิร์ฟเวอร์เติมจาก BASELINE_EFFECTIVE_FROM เอง
 * กฎภายในเอกสารทั้งหมดใช้ชุดเดียวกับ assignmentSchema (ยืมผ่าน .innerType ไม่ได้เพราะมี refine)
 */
export const assignmentInputSchema = assignmentSchema;

/** จุดเก็บที่ส่งมาจากฟอร์มแก้สาย — ไม่รับ seq เพราะเซิร์ฟเวอร์เป็นคนกำหนด */
export const stopDraftSchema = z
  .object({
    prevSeq: z.number().int().positive().nullable(),
    name: z.string().trim().min(1, "ชื่อจุดเก็บต้องไม่ว่าง").max(200, "ชื่อจุดเก็บยาวเกิน 200 ตัวอักษร"),
    mode: z.enum(["truck", "walk"]),
    roadId: z.string().max(50).nullable().optional(),
  })
  .strict();

export const routeUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "ชื่อสายต้องไม่ว่าง").max(200, "ชื่อสายยาวเกิน 200 ตัวอักษร"),
    needsVerification: z.boolean(),
    stops: z.array(stopDraftSchema).min(1, "สายต้องมีจุดเก็บอย่างน้อย 1 จุด"),
  })
  .strict()
  .refine(
    (r) => {
      const prev = r.stops.map((s) => s.prevSeq).filter((s): s is number => s != null);
      return new Set(prev).size === prev.length;
    },
    { message: "ส่งจุดเดิมซ้ำกัน (prevSeq ซ้ำ)" }
  );
```

หมายเหตุ: `assignmentInputSchema` เป็น alias ของ `assignmentSchema` เพราะสคีมาเดิมไม่มี `effectiveFrom`/`effectiveTo` อยู่แล้ว (seed เป็นคนเติม) — ตั้ง alias ไว้เพื่อให้ชื่อสื่อความหมายที่จุดเรียกใช้ และรองรับการแยกกฎในอนาคต **ต้องยืนยันด้วยการอ่านไฟล์ว่าจริง** ถ้า `assignmentSchema` มีสองฟิลด์นั้นให้สร้างสคีมาใหม่ที่ `.omit()` ออกแทน แล้วรายงานการปรับ

- [ ] **Step 2: ยืนยัน**

Run: `npx tsc --noEmit && npm test`
Expected: เงียบ / เทสผ่านเท่าเดิม

- [ ] **Step 3: Commit**

```bash
git add lib/garbage/validators.ts
git commit -m "feat: add Zod schemas for assignment and route editing"
```

---

## Task 7: ลงทะเบียน audit action 4 จุด

**Files:**
- Modify: `lib/auditLogger.ts`
- Modify: `models/AuditLog.js`
- Modify: `pages/admin/superadmin/audit-log.tsx`

**คำเตือน:** `logAuditEvent` เป็น fire-and-forget (จับ error แล้ว `console.error` เฉย ๆ) ถ้าลืมเพิ่มค่าใน mongoose `enum` ของ `models/AuditLog.js` การเขียน log จะล้มแบบ**ไม่มีใครรู้**

- [ ] **Step 1: `lib/auditLogger.ts`** — เพิ่มใน `type AuditAction` ต่อจาก `'waste_daily_updated'`:

```ts
  // Garbage schedule
  | 'garbage_assignment_created'
  | 'garbage_assignment_updated'
  | 'garbage_assignment_deleted'
  | 'garbage_route_updated'
```

และเพิ่มใน `type ResourceType`:

```ts
type ResourceType = 'complaint' | 'assignment' | 'user' | 'notification' | 'system' | 'garbage_assignment' | 'garbage_route';
```

- [ ] **Step 2: `models/AuditLog.js`** — เพิ่มใน `enum` ของ `action` ต่อจาก `'waste_daily_updated',`:

```js
      // Garbage schedule
      'garbage_assignment_created',
      'garbage_assignment_updated',
      'garbage_assignment_deleted',
      'garbage_route_updated',
```

และเพิ่มใน `enum` ของ `resourceType`:

```js
    enum: ['complaint', 'assignment', 'user', 'notification', 'system', 'garbage_assignment', 'garbage_route'],
```

- [ ] **Step 3: `pages/admin/superadmin/audit-log.tsx`** — เพิ่มใน `ACTION_LABELS`:

```ts
  garbage_assignment_created: 'เพิ่มงานเดินรถขยะ',
  garbage_assignment_updated: 'แก้งานเดินรถขยะ',
  garbage_assignment_deleted: 'ลบงานเดินรถขยะ',
  garbage_route_updated: 'แก้สายเดินรถขยะ',
```

และใน `ACTION_COLORS`:

```ts
  garbage_assignment_created: 'badge-primary',
  garbage_assignment_updated: 'badge-info',
  garbage_assignment_deleted: 'badge-error',
  garbage_route_updated: 'badge-warning',
```

- [ ] **Step 4: ยืนยันว่าเขียน log ลงจริง**

เขียน probe ในสแครชแพดที่ import `logAuditEvent` แล้วเขียน event ทดสอบด้วย action `garbage_route_updated`, resourceType `garbage_route`, `resourceId: "TEST-PROBE"` แล้วอ่านกลับจาก collection ว่าเจอ · **แล้วลบ doc ทดสอบนั้นทิ้ง** (ลบเฉพาะ `resourceId: "TEST-PROBE"` ที่เพิ่งสร้าง ห้ามลบอย่างอื่น)

Expected: doc ถูกเขียนลงจริง (พิสูจน์ว่า enum ครบ) แล้วลบสำเร็จ

- [ ] **Step 5: Commit**

```bash
git add lib/auditLogger.ts models/AuditLog.js pages/admin/superadmin/audit-log.tsx
git commit -m "feat: ลงทะเบียน audit action ของโมดูลขยะครบ 4 จุด"
```

---

## Task 8: POST สร้างงานมอบหมาย

**Files:**
- Create: `pages/api/garbage/assignments/index.ts`

- [ ] **Step 1: เขียน API route**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { assignments as assignmentsCol, routes as routesCol } from "@/lib/garbage/db";
import { assignmentInputSchema } from "@/lib/garbage/validators";
import { findOverlap } from "@/lib/garbage/overlap";
import { BASELINE_EFFECTIVE_FROM } from "@/lib/garbage/constants";
import { formatRange } from "@/lib/garbage/time";
import { logAuditEvent } from "@/lib/auditLogger";
import { requireGarbageAdmin } from "../_auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "รองรับเฉพาะ POST" });
  }

  let auth;
  try {
    auth = await requireGarbageAdmin(req);
  } catch (err) {
    console.error("[garbage/assignments] auth", err);
    return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  }
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const parsed = assignmentInputSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
  }
  const input = parsed.data;

  try {
    const [aCol, rCol] = await Promise.all([assignmentsCol(), routesCol()]);

    // สายต้องมีจริงและยัง active
    if (input.routeCode) {
      const route = await rCol.findOne({ code: input.routeCode, active: true });
      if (!route) return res.status(400).json({ error: `ไม่พบสาย ${input.routeCode} หรือสายถูกปิดใช้งาน` });
      for (const st of input.stopTimes) {
        if (!route.stops.some((s) => s.seq === st.seq)) {
          return res.status(400).json({ error: `สาย ${input.routeCode} ไม่มีจุดลำดับที่ ${st.seq}` });
        }
      }
    }

    // กฎข้ามเอกสาร: รถคันเดียวกันในวันเดียวกัน เวลาห้ามทับ
    const siblings = await aCol
      .find({ weekday: input.weekday, truckNumber: input.truckNumber })
      .toArray();
    const clash = findOverlap(siblings, input);
    if (clash) {
      return res.status(400).json({
        error: `รถ ${input.truckNumber} มีงานรอบ ${clash.shiftNo} เวลา ${formatRange(clash.startMin, clash.endMin)} อยู่แล้ว เวลาทับกัน`,
      });
    }

    const now = new Date();
    const doc = {
      ...input,
      effectiveFrom: BASELINE_EFFECTIVE_FROM,
      effectiveTo: null,
      createdAt: now,
      updatedAt: now,
    };

    let insertedId;
    try {
      const result = await aCol.insertOne(doc as never);
      insertedId = result.insertedId;
    } catch (err) {
      // unique index natural_key ชน = มีงานรถคันนี้ รอบนี้ ในวันนี้อยู่แล้ว
      if ((err as { code?: number }).code === 11000) {
        return res.status(409).json({
          error: `มีงานของรถ ${input.truckNumber} รอบ ${input.shiftNo} ในวันนี้อยู่แล้ว — ให้แก้งานเดิมแทนการเพิ่มใหม่`,
        });
      }
      throw err;
    }

    await logAuditEvent({
      actorClerkId: auth.userId,
      action: "garbage_assignment_created",
      resourceType: "garbage_assignment",
      resourceId: String(insertedId),
      after: doc,
      description: `เพิ่มงานรถ ${input.truckNumber} รอบ ${input.shiftNo} วัน ${input.weekday}`,
    });

    return res.status(201).json({ _id: String(insertedId) });
  } catch (err) {
    console.error("[garbage/assignments] POST", err);
    return res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
  }
}
```

- [ ] **Step 2: ทดสอบเท่าที่ทำได้โดยไม่ล็อกอิน**

```bash
curl -s -o /dev/null -w "POST ไม่ล็อกอิน: %{http_code}\n" -X POST -H "Content-Type: application/json" \
  -d '{}' "http://localhost:3000/api/garbage/assignments"
curl -s -o /dev/null -w "GET: %{http_code}\n" "http://localhost:3000/api/garbage/assignments"
```
Expected: `POST ไม่ล็อกอิน: 401` · `GET: 405`

- [ ] **Step 3: ยืนยัน type**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add pages/api/garbage/assignments/index.ts
git commit -m "feat: add assignment create API with overlap and duplicate guards"
```

---

## Task 9: PUT/DELETE งานมอบหมาย

**Files:**
- Create: `pages/api/garbage/assignments/[id].ts`

- [ ] **Step 1: เขียน API route**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import { assignments as assignmentsCol, routes as routesCol } from "@/lib/garbage/db";
import { assignmentInputSchema } from "@/lib/garbage/validators";
import { findOverlap } from "@/lib/garbage/overlap";
import { BASELINE_EFFECTIVE_FROM } from "@/lib/garbage/constants";
import { formatRange } from "@/lib/garbage/time";
import { logAuditEvent } from "@/lib/auditLogger";
import { requireGarbageAdmin } from "../_auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT" && req.method !== "DELETE") {
    res.setHeader("Allow", "PUT, DELETE");
    return res.status(405).json({ error: "รองรับเฉพาะ PUT และ DELETE" });
  }

  let auth;
  try {
    auth = await requireGarbageAdmin(req);
  } catch (err) {
    console.error("[garbage/assignments/[id]] auth", err);
    return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  }
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!rawId || !ObjectId.isValid(rawId)) {
    return res.status(400).json({ error: "รหัสงานไม่ถูกต้อง" });
  }
  const _id = new ObjectId(rawId);

  try {
    const aCol = await assignmentsCol();
    const before = await aCol.findOne({ _id } as never);
    if (!before) return res.status(404).json({ error: "ไม่พบงานที่ระบุ" });

    if (req.method === "DELETE") {
      await aCol.deleteOne({ _id } as never);
      await logAuditEvent({
        actorClerkId: auth.userId,
        action: "garbage_assignment_deleted",
        resourceType: "garbage_assignment",
        resourceId: rawId,
        before,
        description: `ลบงานรถ ${before.truckNumber} รอบ ${before.shiftNo} วัน ${before.weekday}`,
      });
      return res.status(200).json({ deleted: true });
    }

    const parsed = assignmentInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
    }
    const input = parsed.data;

    if (input.routeCode) {
      const rCol = await routesCol();
      const route = await rCol.findOne({ code: input.routeCode, active: true });
      if (!route) return res.status(400).json({ error: `ไม่พบสาย ${input.routeCode} หรือสายถูกปิดใช้งาน` });
      for (const st of input.stopTimes) {
        if (!route.stops.some((s) => s.seq === st.seq)) {
          return res.status(400).json({ error: `สาย ${input.routeCode} ไม่มีจุดลำดับที่ ${st.seq}` });
        }
      }
    }

    const siblings = await aCol
      .find({ weekday: input.weekday, truckNumber: input.truckNumber })
      .toArray();
    const clash = findOverlap(siblings, { ...input, _id });
    if (clash) {
      return res.status(400).json({
        error: `รถ ${input.truckNumber} มีงานรอบ ${clash.shiftNo} เวลา ${formatRange(clash.startMin, clash.endMin)} อยู่แล้ว เวลาทับกัน`,
      });
    }

    try {
      await aCol.updateOne({ _id } as never, {
        $set: {
          ...input,
          effectiveFrom: BASELINE_EFFECTIVE_FROM,
          effectiveTo: null,
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        return res.status(409).json({
          error: `มีงานของรถ ${input.truckNumber} รอบ ${input.shiftNo} ในวันนี้อยู่แล้ว`,
        });
      }
      throw err;
    }

    await logAuditEvent({
      actorClerkId: auth.userId,
      action: "garbage_assignment_updated",
      resourceType: "garbage_assignment",
      resourceId: rawId,
      before,
      after: input,
      description: `แก้งานรถ ${input.truckNumber} รอบ ${input.shiftNo} วัน ${input.weekday}`,
    });

    return res.status(200).json({ updated: true });
  } catch (err) {
    console.error("[garbage/assignments/[id]]", req.method, err);
    return res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
  }
}
```

- [ ] **Step 2: ทดสอบ**

```bash
curl -s -o /dev/null -w "PUT ไม่ล็อกอิน: %{http_code}\n" -X PUT -H "Content-Type: application/json" -d '{}' \
  "http://localhost:3000/api/garbage/assignments/000000000000000000000000"
curl -s -o /dev/null -w "DELETE ไม่ล็อกอิน: %{http_code}\n" -X DELETE \
  "http://localhost:3000/api/garbage/assignments/000000000000000000000000"
curl -s -o /dev/null -w "GET: %{http_code}\n" "http://localhost:3000/api/garbage/assignments/000000000000000000000000"
```
Expected: `401` · `401` · `405`

- [ ] **Step 3: Commit**

```bash
git add "pages/api/garbage/assignments/[id].ts"
git commit -m "feat: add assignment update and delete API"
```

---

## Task 10: GET รายการสายสำหรับฟอร์ม

**Files:**
- Create: `pages/api/garbage/routes/index.ts`

- [ ] **Step 1: เขียน API route**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { routes as routesCol } from "@/lib/garbage/db";
import { requireGarbageAdmin } from "../_auth";

/**
 * รายการสายพร้อมจุดเก็บ — ใช้เติม dropdown และตัวตั้งเวลารายจุดในฟอร์มแอดมิน
 * ต้องล็อกอิน: เป็นข้อมูลตั้งต้นของฟอร์ม ไม่ใช่ข้อมูลที่หน้าประชาชนต้องใช้
 * (หน้าประชาชนได้สายมาพร้อม /week และ /search แล้ว)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }

  let auth;
  try {
    auth = await requireGarbageAdmin(req);
  } catch (err) {
    console.error("[garbage/routes] auth", err);
    return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  }
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    const rCol = await routesCol();
    const routes = await rCol.find({ active: true }).sort({ code: 1 }).toArray();
    return res.status(200).json({
      routes: routes.map((r) => ({
        code: r.code,
        name: r.name,
        defaultTruckNumber: r.defaultTruckNumber,
        needsVerification: r.needsVerification ?? false,
        stops: r.stops,
      })),
    });
  } catch (err) {
    console.error("[garbage/routes] GET", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอ่านข้อมูล" });
  }
}
```

- [ ] **Step 2: ทดสอบ**

```bash
curl -s -o /dev/null -w "GET ไม่ล็อกอิน: %{http_code}\n" "http://localhost:3000/api/garbage/routes"
curl -s -o /dev/null -w "POST: %{http_code}\n" -X POST "http://localhost:3000/api/garbage/routes"
```
Expected: `401` · `405`

- [ ] **Step 3: Commit**

```bash
git add pages/api/garbage/routes/index.ts
git commit -m "feat: add admin route list API"
```

---

## Task 11: PUT แก้สายและรายการจุด

นี่คือ task ที่ยากที่สุด — **ลำดับการเขียนสำคัญ**: เขียน `stopTimes` ของงานก่อน แล้วจึงเขียน `route.stops` เพื่อให้ล้มกลางทางแล้วได้ "ไม่มีเวลา" ไม่ใช่ "เวลาผิด"

**Files:**
- Create: `pages/api/garbage/routes/[code].ts`

- [ ] **Step 1: เขียน API route**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { assignments as assignmentsCol, routes as routesCol } from "@/lib/garbage/db";
import { routeUpdateSchema } from "@/lib/garbage/validators";
import { assignSeq, buildSeqMap, remapStopTimes } from "@/lib/garbage/stopEditing";
import { logAuditEvent } from "@/lib/auditLogger";
import { requireGarbageAdmin } from "../_auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "รองรับเฉพาะ PUT" });
  }

  let auth;
  try {
    auth = await requireGarbageAdmin(req);
  } catch (err) {
    console.error("[garbage/routes/[code]] auth", err);
    return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  }
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const rawCode = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
  if (!rawCode || !/^R\d+$/u.test(rawCode)) {
    return res.status(400).json({ error: "รหัสสายไม่ถูกต้อง" });
  }

  const parsed = routeUpdateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
  }
  const input = parsed.data;

  try {
    const [rCol, aCol] = await Promise.all([routesCol(), assignmentsCol()]);
    const before = await rCol.findOne({ code: rawCode });
    if (!before) return res.status(404).json({ error: `ไม่พบสาย ${rawCode}` });

    // prevSeq ทุกตัวต้องมีอยู่จริงในสายเดิม — กันฟอร์มที่ค้างอยู่บนข้อมูลเก่า
    const existingSeqs = new Set(before.stops.map((s) => s.seq));
    for (const s of input.stops) {
      if (s.prevSeq != null && !existingSeqs.has(s.prevSeq)) {
        return res.status(409).json({
          error: "ข้อมูลสายเปลี่ยนไปแล้วระหว่างที่เปิดฟอร์มอยู่ — ปิดแล้วเปิดใหม่เพื่อโหลดข้อมูลล่าสุด",
        });
      }
    }

    const nextStops = assignSeq(input.stops);
    const seqMap = buildSeqMap(input.stops);

    // ลำดับสำคัญ: เขียนเวลาของงานก่อน แล้วจึงเขียนรายการจุดของสาย
    // ถ้าขั้นที่สองล้ม งานจะอ้าง seq ที่ยังไม่มีในสาย → หน้าเว็บแสดง "—" (ไม่มีเวลา)
    // ซึ่งปลอดภัยกว่าการเขียนสายก่อนแล้วล้ม เพราะนั่นจะทำให้แสดงเวลาผิดที่ดูเหมือนถูก
    const affected = await aCol.find({ routeCode: rawCode }).toArray();
    const timeChanges = affected
      .map((a) => ({ _id: a._id, next: remapStopTimes(seqMap, a.stopTimes) }))
      .filter((c, i) => JSON.stringify(c.next) !== JSON.stringify(affected[i].stopTimes));

    if (timeChanges.length > 0) {
      await aCol.bulkWrite(
        timeChanges.map((c) => ({
          updateOne: {
            filter: { _id: c._id },
            update: { $set: { stopTimes: c.next, updatedAt: new Date() } },
          },
        })) as never
      );
    }

    await rCol.updateOne(
      { code: rawCode },
      {
        $set: {
          name: input.name,
          needsVerification: input.needsVerification,
          stops: nextStops,
          updatedAt: new Date(),
        },
      }
    );

    await logAuditEvent({
      actorClerkId: auth.userId,
      action: "garbage_route_updated",
      resourceType: "garbage_route",
      resourceId: rawCode,
      before: { name: before.name, stops: before.stops, needsVerification: before.needsVerification ?? false },
      after: { name: input.name, stops: nextStops, needsVerification: input.needsVerification },
      description: `แก้สาย ${rawCode} (${before.stops.length} → ${nextStops.length} จุด, กระทบ ${timeChanges.length} งาน)`,
      meta: { affectedAssignments: timeChanges.length },
    });

    return res.status(200).json({ updated: true, affectedAssignments: timeChanges.length });
  } catch (err) {
    console.error("[garbage/routes/[code]] PUT", err);
    return res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
  }
}
```

- [ ] **Step 2: ทดสอบ**

```bash
curl -s -o /dev/null -w "PUT ไม่ล็อกอิน: %{http_code}\n" -X PUT -H "Content-Type: application/json" -d '{}' \
  "http://localhost:3000/api/garbage/routes/R1"
curl -s -o /dev/null -w "GET: %{http_code}\n" "http://localhost:3000/api/garbage/routes/R1"
```
Expected: `401` · `405`

- [ ] **Step 3: ยืนยัน type และเทส**

Run: `npx tsc --noEmit && npm test`

- [ ] **Step 4: Commit**

```bash
git add "pages/api/garbage/routes/[code].ts"
git commit -m "feat: add route editing API with safe stop-time reconciliation"
```

---

## Task 12: `AssignmentFormModal`

**Files:**
- Create: `components/garbage/admin/AssignmentFormModal.jsx`

- [ ] **Step 1: เขียนคอมโพเนนต์**

```jsx
import { useEffect, useMemo, useState } from 'react';
import { parseThaiTime, formatThaiTime } from '@/lib/garbage/time';
import { KIND_LABEL_TH, weekdayName } from '@/lib/garbage/labels';
import { inputCls, labelCls, primaryBtnCls, ghostBtnCls } from '@/components/ui/adminTheme';
import StopTimesEditor from './StopTimesEditor';

const KINDS = ['normal', 'substitute', 'day_off', 'special'];

/** แปลง "4.00" หรือ "4:00" เป็นนาที — ช่องเวลาในฟอร์มรับรูปแบบเดียวกับที่แสดง */
function toMin(text) {
  return parseThaiTime(text);
}

/**
 * ฟอร์มเพิ่ม/แก้งานมอบหมาย
 * ซ่อนช่องที่ชนิดงานนั้นไม่ใช้ เพื่อไม่ให้ผู้ใช้ไปชนกฎ validator ฝั่งเซิร์ฟเวอร์
 * assignment = null คือโหมดเพิ่มใหม่
 */
export default function AssignmentFormModal({ open, weekday, assignment, trucks, routes, onClose, onSaved }) {
  const [truckNumber, setTruckNumber] = useState('');
  const [shiftNo, setShiftNo] = useState('1');
  const [kind, setKind] = useState('normal');
  const [routeCode, setRouteCode] = useState('');
  const [coverForRouteCode, setCoverForRouteCode] = useState('');
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');
  const [label, setLabel] = useState('');
  const [stopTimes, setStopTimes] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (assignment) {
      setTruckNumber(String(assignment.truckNumber));
      setShiftNo(String(assignment.shiftNo));
      setKind(assignment.kind);
      setRouteCode(assignment.routeCode ?? '');
      setCoverForRouteCode(assignment.coverForRouteCode ?? '');
      setStartText(assignment.startMin == null ? '' : formatThaiTime(assignment.startMin).replace(' น.', ''));
      setEndText(assignment.endMin == null ? '' : formatThaiTime(assignment.endMin).replace(' น.', ''));
      setLabel(assignment.label ?? '');
      setStopTimes(assignment.stops.filter((s) => s.atMin != null).map((s) => ({ seq: s.seq, atMin: s.atMin })));
    } else {
      setTruckNumber('');
      setShiftNo('1');
      setKind('normal');
      setRouteCode('');
      setCoverForRouteCode('');
      setStartText('');
      setEndText('');
      setLabel('');
      setStopTimes([]);
    }
  }, [open, assignment]);

  const selectedRoute = useMemo(() => routes.find((r) => r.code === routeCode) ?? null, [routes, routeCode]);
  const isDayOff = kind === 'day_off';
  const needsRoute = kind === 'normal' || kind === 'substitute';

  const save = async () => {
    setError('');
    const startMin = isDayOff ? null : toMin(startText);
    const endMin = isDayOff ? null : toMin(endText);
    if (!isDayOff && (startMin == null || endMin == null)) {
      setError('เวลาต้องเป็นรูปแบบ 4.00 หรือ 13.30');
      return;
    }
    const body = {
      weekday,
      truckNumber: Number(truckNumber),
      shiftNo: Number(shiftNo),
      kind,
      routeCode: isDayOff ? null : routeCode || null,
      coverForRouteCode: kind === 'substitute' ? coverForRouteCode || null : null,
      startMin,
      endMin,
      stopTimes: isDayOff ? [] : stopTimes,
      communityWindows: assignment?.communityWindows ?? [],
      label: label.trim() === '' ? null : label.trim(),
    };

    setSaving(true);
    try {
      const url = assignment
        ? `/api/garbage/assignments/${assignment.id}`
        : '/api/garbage/assignments';
      const res = await fetch(url, {
        method: assignment ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'บันทึกไม่สำเร็จ');
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[24px] bg-white p-5 space-y-3">
        <div className="text-[16px] font-bold text-[#57506A]">
          {assignment ? 'แก้งาน' : 'เพิ่มงาน'} · วัน{weekdayName(weekday)}
        </div>

        {error && (
          <div className="rounded-[14px] bg-amber-50 ring-1 ring-amber-200 p-3 text-[13px] text-amber-900">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="af-truck">เบอร์รถ</label>
            <select id="af-truck" className={inputCls} value={truckNumber}
              onChange={(e) => setTruckNumber(e.target.value)}>
              <option value="">เลือกรถ</option>
              {trucks.map((t) => <option key={t.number} value={t.number}>รถ {t.number}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="af-shift">รอบที่</label>
            <input id="af-shift" className={inputCls} type="number" min="1" value={shiftNo}
              onChange={(e) => setShiftNo(e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="af-kind">ชนิดงาน</label>
          <select id="af-kind" className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>{KIND_LABEL_TH[k] || 'ปกติ'}</option>
            ))}
          </select>
        </div>

        {!isDayOff && (
          <>
            <div>
              <label className={labelCls} htmlFor="af-route">สาย{needsRoute ? '' : ' (ไม่บังคับ)'}</label>
              <select id="af-route" className={inputCls} value={routeCode}
                onChange={(e) => { setRouteCode(e.target.value); setStopTimes([]); }}>
                <option value="">ไม่ระบุสาย</option>
                {routes.map((r) => <option key={r.code} value={r.code}>{r.code} · {r.name}</option>)}
              </select>
            </div>

            {kind === 'substitute' && (
              <div>
                <label className={labelCls} htmlFor="af-cover">แทนสาย</label>
                <select id="af-cover" className={inputCls} value={coverForRouteCode}
                  onChange={(e) => setCoverForRouteCode(e.target.value)}>
                  <option value="">เลือกสายที่แทน</option>
                  {routes.map((r) => <option key={r.code} value={r.code}>{r.code}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="af-start">เวลาเริ่ม</label>
                <input id="af-start" className={inputCls} value={startText} placeholder="4.00"
                  onChange={(e) => setStartText(e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="af-end">เวลาสิ้นสุด</label>
                <input id="af-end" className={inputCls} value={endText} placeholder="9.20"
                  onChange={(e) => setEndText(e.target.value)} />
              </div>
            </div>

            {selectedRoute && (
              <StopTimesEditor route={selectedRoute} value={stopTimes} onChange={setStopTimes}
                startMin={toMin(startText)} endMin={toMin(endText)} />
            )}
          </>
        )}

        <div>
          <label className={labelCls} htmlFor="af-label">ป้ายกำกับ (ไม่บังคับ)</label>
          <input id="af-label" className={inputCls} value={label} placeholder="เช่น วันตลาดนัดพิเศษ"
            onChange={(e) => setLabel(e.target.value)} />
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" className={primaryBtnCls} onClick={save} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
          <button type="button" className={ghostBtnCls} onClick={onClose} disabled={saving}>ยกเลิก</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ยืนยัน type**

Run: `npx tsc --noEmit`
(จะยังไม่ผ่านถ้า `StopTimesEditor` ยังไม่มี — ทำ Task 13 ต่อทันทีแล้วค่อยยืนยันรวม)

- [ ] **Step 3: Commit** (หลัง Task 13 ผ่าน tsc แล้ว commit สองไฟล์แยกกันตามลำดับ task ได้ตามปกติ — ถ้า tsc ยังแดงเพราะไฟล์ที่ยังไม่สร้าง ให้ commit หลังจบ Task 12)

```bash
git add components/garbage/admin/AssignmentFormModal.jsx
git commit -m "feat: add assignment form modal"
```

---

## Task 13: `StopTimesEditor`

**Files:**
- Create: `components/garbage/admin/StopTimesEditor.jsx`

- [ ] **Step 1: เขียนคอมโพเนนต์**

```jsx
import { formatThaiTime, parseThaiTime } from '@/lib/garbage/time';
import { distributeStopTimes } from '@/lib/garbage/stopEditing';
import { labelCls, ghostBtnCls } from '@/components/ui/adminTheme';

/**
 * ตั้งเวลารายจุดของงาน — value เป็นอาเรย์ { seq, atMin } เฉพาะจุดที่มีเวลา
 * ปุ่ม "กระจายเวลาเท่ากัน" จำเป็นเพราะสาย R1 มี 22 จุด กรอกมือทีละช่องคือทรมาน
 */
export default function StopTimesEditor({ route, value, onChange, startMin, endMin }) {
  const bySeq = new Map(value.map((v) => [v.seq, v.atMin]));

  const setOne = (seq, text) => {
    const min = parseThaiTime(text);
    const next = value.filter((v) => v.seq !== seq);
    if (min != null) next.push({ seq, atMin: min });
    next.sort((a, b) => a.seq - b.seq);
    onChange(next);
  };

  const spread = () => {
    if (startMin == null || endMin == null) return;
    onChange(distributeStopTimes(route.stops.length, startMin, endMin));
  };

  return (
    <div className="rounded-[14px] border border-[#E7E2F2] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className={labelCls + ' mb-0'}>เวลาถึงแต่ละจุด ({route.stops.length} จุด)</span>
        <button type="button" className={ghostBtnCls} onClick={spread}
          disabled={startMin == null || endMin == null}
          title={startMin == null || endMin == null ? 'ต้องกรอกเวลาเริ่มและสิ้นสุดก่อน' : ''}>
          กระจายเวลาเท่ากัน
        </button>
      </div>
      <p className="text-[11.5px] text-[#8A8398]">
        เว้นว่างได้ถ้ายังไม่ทราบเวลา — จุดที่ไม่มีเวลาจะแสดงเป็น &ldquo;—&rdquo; บนหน้าประชาชน
      </p>
      <ol className="space-y-1 max-h-64 overflow-y-auto">
        {route.stops.map((s) => (
          <li key={s.seq} className="flex items-center gap-2">
            <span className="w-6 text-right text-[12px] text-[#8A8398]">{s.seq}.</span>
            <span className="flex-1 text-[12.5px] truncate" title={s.name}>{s.name}</span>
            <input
              className="w-24 rounded-[10px] border border-[#E7E2F2] px-2 py-1 text-[12.5px]"
              placeholder="4.00"
              aria-label={`เวลาถึง ${s.name}`}
              defaultValue={bySeq.has(s.seq) ? formatThaiTime(bySeq.get(s.seq)).replace(' น.', '') : ''}
              key={`${s.seq}-${bySeq.get(s.seq) ?? 'empty'}`}
              onBlur={(e) => setOne(s.seq, e.target.value)}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
```

หมายเหตุเรื่อง `key` ของ input: ใส่ค่าเวลาไว้ใน key เพื่อให้ปุ่ม "กระจายเวลาเท่ากัน" ทำให้ช่องรีเซ็ตค่าที่แสดงจริง (ใช้ `defaultValue` เพื่อให้พิมพ์ได้ลื่นโดยไม่ re-render ทุกตัวอักษร)

- [ ] **Step 2: ยืนยัน**

Run: `npx tsc --noEmit && npm run build`
Expected: เงียบ และ build ผ่าน

- [ ] **Step 3: Commit**

```bash
git add components/garbage/admin/StopTimesEditor.jsx
git commit -m "feat: add per-stop time editor with even distribution"
```

---

## Task 14: `RouteManagerModal`

**Files:**
- Create: `components/garbage/admin/RouteManagerModal.jsx`

- [ ] **Step 1: เขียนคอมโพเนนต์**

```jsx
import { useEffect, useState } from 'react';
import { inputCls, labelCls, primaryBtnCls, ghostBtnCls } from '@/components/ui/adminTheme';

/**
 * จัดการสายและรายการจุดเก็บ
 * เตือนก่อนบันทึกว่าการลบหรือสลับจุดกระทบเวลาของงานที่ใช้สายนี้
 * ส่ง prevSeq ไปให้เซิร์ฟเวอร์ย้ายเวลาตามจุดเดิม ไม่ใช่ตามตำแหน่ง
 */
export default function RouteManagerModal({ open, routes, onClose, onSaved }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [verified, setVerified] = useState(false);
  const [stops, setStops] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setCode(routes[0]?.code ?? '');
  }, [open, routes]);

  useEffect(() => {
    const r = routes.find((x) => x.code === code);
    if (!r) return;
    setName(r.name);
    setVerified(!r.needsVerification);
    setStops(r.stops.map((s) => ({ prevSeq: s.seq, name: s.name, mode: s.mode, roadId: s.roadId ?? null })));
  }, [code, routes]);

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= stops.length) return;
    const next = [...stops];
    [next[i], next[j]] = [next[j], next[i]];
    setStops(next);
  };

  const removed = (routes.find((r) => r.code === code)?.stops.length ?? 0) - stops.filter((s) => s.prevSeq != null).length;
  const reordered = stops.some((s, i) => s.prevSeq != null && s.prevSeq !== i + 1);

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/garbage/routes/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), needsVerification: !verified, stops }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'บันทึกไม่สำเร็จ');
      onSaved(json?.affectedAssignments ?? 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[24px] bg-white p-5 space-y-3">
        <div className="text-[16px] font-bold text-[#57506A]">จัดการสายและจุดเก็บ</div>

        {error && (
          <div className="rounded-[14px] bg-amber-50 ring-1 ring-amber-200 p-3 text-[13px] text-amber-900">{error}</div>
        )}

        <div>
          <label className={labelCls} htmlFor="rm-code">สาย</label>
          <select id="rm-code" className={inputCls} value={code} onChange={(e) => setCode(e.target.value)}>
            {routes.map((r) => <option key={r.code} value={r.code}>{r.code} · {r.name}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="rm-name">ชื่อสาย</label>
          <input id="rm-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          ตรวจสอบชื่อจุดกับกองสาธารณสุขแล้ว
        </label>

        <div className="rounded-[14px] border border-[#E7E2F2] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className={labelCls + ' mb-0'}>จุดเก็บ ({stops.length})</span>
            <button type="button" className={ghostBtnCls}
              onClick={() => setStops([...stops, { prevSeq: null, name: '', mode: 'truck', roadId: null }])}>
              + เพิ่มจุด
            </button>
          </div>
          <ol className="space-y-1 max-h-72 overflow-y-auto">
            {stops.map((s, i) => (
              <li key={s.prevSeq ?? `new-${i}`} className="flex items-center gap-1.5">
                <span className="w-6 text-right text-[12px] text-[#8A8398]">{i + 1}.</span>
                <input className="flex-1 rounded-[10px] border border-[#E7E2F2] px-2 py-1 text-[12.5px]"
                  value={s.name} aria-label={`ชื่อจุดลำดับที่ ${i + 1}`}
                  onChange={(e) => {
                    const next = [...stops];
                    next[i] = { ...s, name: e.target.value };
                    setStops(next);
                  }} />
                <select className="rounded-[10px] border border-[#E7E2F2] px-1 py-1 text-[11.5px]"
                  value={s.mode} aria-label={`วิธีเก็บจุดลำดับที่ ${i + 1}`}
                  onChange={(e) => {
                    const next = [...stops];
                    next[i] = { ...s, mode: e.target.value };
                    setStops(next);
                  }}>
                  <option value="truck">รถ</option>
                  <option value="walk">เดิน</option>
                </select>
                <button type="button" aria-label={`เลื่อนขึ้น จุดลำดับที่ ${i + 1}`}
                  className="px-1.5 text-[#8A8398] disabled:opacity-30" disabled={i === 0}
                  onClick={() => move(i, -1)}>↑</button>
                <button type="button" aria-label={`เลื่อนลง จุดลำดับที่ ${i + 1}`}
                  className="px-1.5 text-[#8A8398] disabled:opacity-30" disabled={i === stops.length - 1}
                  onClick={() => move(i, 1)}>↓</button>
                <button type="button" aria-label={`ลบ จุดลำดับที่ ${i + 1}`}
                  className="px-1.5 text-red-500"
                  onClick={() => setStops(stops.filter((_, j) => j !== i))}>✕</button>
              </li>
            ))}
          </ol>
        </div>

        {(removed > 0 || reordered) && (
          <div className="rounded-[14px] bg-amber-50 ring-1 ring-amber-200 p-3 text-[12.5px] text-amber-900">
            {removed > 0 && <>จะลบจุด {removed} จุด — เวลาของจุดที่ถูกลบจะหายไปด้วย<br /></>}
            {reordered && <>มีการสลับลำดับจุด — เวลาจะย้ายตามจุดเดิม ไม่ตามตำแหน่ง</>}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" className={primaryBtnCls} onClick={save} disabled={saving || stops.length === 0}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
          <button type="button" className={ghostBtnCls} onClick={onClose} disabled={saving}>ยกเลิก</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ยืนยัน**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/garbage/admin/RouteManagerModal.jsx
git commit -m "feat: add route and stop list manager"
```

---

## Task 15: ต่อสายเข้าหน้าแอดมิน

**Files:**
- Modify: `components/garbage/admin/WeekScheduleView.jsx`
- Modify: `pages/admin/garbage.jsx`

- [ ] **Step 1: เพิ่มปุ่มใน `WeekScheduleView.jsx`**

รับ prop ใหม่ `onAdd`, `onEdit`, `onDelete` (ถ้าไม่ส่งมาให้ซ่อนปุ่มทั้งหมด เพื่อให้คอมโพเนนต์ยังใช้แบบอ่านอย่างเดียวได้)

เหนือตาราง (ต่อจากบรรทัดที่แสดง `day?.date · N รายการ`) เพิ่ม:

```jsx
      {onAdd && (
        <button type="button" className={primaryBtnCls} onClick={() => onAdd(day.weekday)}>
          + เพิ่มงาน
        </button>
      )}
```

(import `primaryBtnCls` จาก `@/components/ui/adminTheme` เพิ่มในบรรทัด import ที่มีอยู่)

เพิ่มคอลัมน์ท้ายตารางในส่วน `<thead>`:

```jsx
                {onEdit && <th className="px-3 py-2 text-right border-b border-[#E7E2F2]">จัดการ</th>}
```

และในแถวข้อมูล (ก่อนปิด `</tr>` ของแถวหลัก):

```jsx
                      {onEdit && (
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button type="button" className="px-2 text-[#6D28D9]"
                            aria-label={`แก้งานรถ ${a.truckNumber} รอบ ${a.shiftNo}`}
                            onClick={(e) => { e.stopPropagation(); onEdit(a); }}>แก้</button>
                          <button type="button" className="px-2 text-red-500"
                            aria-label={`ลบงานรถ ${a.truckNumber} รอบ ${a.shiftNo}`}
                            onClick={(e) => { e.stopPropagation(); onDelete(a); }}>ลบ</button>
                        </td>
                      )}
```

**สำคัญ:** ต้องมี `e.stopPropagation()` ไม่งั้นกดปุ่มจะไปกางรายการจุดด้วย · และต้องแก้ `colSpan` ของแถวกางรายการจุดจาก `5` เป็น `onEdit ? 6 : 5`

- [ ] **Step 2: ต่อทุกอย่างใน `pages/admin/garbage.jsx`**

เพิ่ม state และ handler (คงส่วนเดิมทั้งหมด เพิ่มของใหม่):

```jsx
import AssignmentFormModal from '@/components/garbage/admin/AssignmentFormModal';
import RouteManagerModal from '@/components/garbage/admin/RouteManagerModal';
```

ใน component เพิ่ม:

```jsx
  const [routes, setRoutes] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [routeMgrOpen, setRouteMgrOpen] = useState(false);

  const fetchRoutes = useCallback(async () => {
    try {
      const res = await fetch('/api/garbage/routes');
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'โหลดรายการสายไม่สำเร็จ');
      if (mountedRef.current) setRoutes(json.routes ?? []);
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'โหลดรายการสายไม่สำเร็จ', text: e.message });
    }
  }, []);

  useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

  // เบอร์รถที่มีในระบบ — ดึงจากงานที่มีอยู่ (ทะเบียนรถยังแก้ผ่าน seed รอบนี้)
  useEffect(() => {
    if (!days) return;
    const nums = new Set();
    days.forEach((d) => d.assignments.forEach((a) => nums.add(a.truckNumber)));
    setTrucks([...nums].sort((a, b) => a - b).map((number) => ({ number })));
  }, [days]);

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (a) => { setEditing(a); setFormOpen(true); };

  const removeAssignment = async (a) => {
    const ok = await Swal.fire({
      icon: 'warning', title: 'ลบงานนี้?',
      text: `รถ ${a.truckNumber} รอบ ${a.shiftNo}${a.routeCode ? ` สาย ${a.routeCode}` : ''}`,
      showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก',
    });
    if (!ok.isConfirmed) return;
    try {
      const res = await fetch(`/api/garbage/assignments/${a.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'ลบไม่สำเร็จ');
      fetchWeek();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: e.message });
    }
  };
```

ส่ง prop เข้า `WeekScheduleView`:

```jsx
            <WeekScheduleView days={days} activeDate={activeDate} onChangeDate={setActiveDate}
              onAdd={openAdd} onEdit={openEdit} onDelete={removeAssignment} />
```

เพิ่มปุ่มจัดการสายที่ `DashboardHeader` prop `right`:

```jsx
            right={
              <button type="button" onClick={() => setRouteMgrOpen(true)}
                title="จัดการสายและจุดเก็บ" aria-label="จัดการสายและจุดเก็บ"
                className="grid h-10 w-10 place-items-center rounded-[12px] border border-[#E7E2F2]
                  text-[18px] hover:bg-[#F1ECFB] transition">🛣️</button>
            }
```

และเรนเดอร์ modal ท้ายหน้า (ใน `PermissionGuard` ก่อนปิด div นอกสุด):

```jsx
        <AssignmentFormModal open={formOpen} weekday={activeWeekday} assignment={editing}
          trucks={trucks} routes={routes}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); fetchWeek(); }} />

        <RouteManagerModal open={routeMgrOpen} routes={routes}
          onClose={() => setRouteMgrOpen(false)}
          onSaved={(affected) => {
            setRouteMgrOpen(false);
            fetchRoutes();
            fetchWeek();
            Swal.fire({ icon: 'success', title: 'บันทึกแล้ว',
              text: affected > 0 ? `ปรับเวลาของ ${affected} งานให้ตรงกับจุดใหม่แล้ว` : '',
              timer: 2000, showConfirmButton: false });
          }} />
```

โดย `activeWeekday` คำนวณจากวันที่ที่เลือก:

```jsx
  const activeWeekday = days?.find((d) => d.date === activeDate)?.weekday ?? 0;
```

**หมายเหตุสำคัญ:** ทุก mutation สำเร็จต้องเรียก `fetchWeek()` เพื่อโหลดใหม่จาก DB ห้ามแก้ state ในเครื่องเอง (กันหน้าจอไม่ตรงกับฐานข้อมูล)

- [ ] **Step 3: ยืนยัน**

Run: `npx tsc --noEmit && npm test && npm run lint && npm run build`
Expected: เงียบทั้งหมด, เทสผ่าน, build ผ่าน

- [ ] **Step 4: ตรวจด้วย headless browser เท่าที่ทำได้**

`/admin/garbage` เข้าไม่ได้ถ้าไม่ล็อกอิน — ให้ยืนยันว่า build ผ่านและ chunk ของหน้ามีสตริงที่คาด (`เพิ่มงาน`, `จัดการสายและจุดเก็บ`, `กระจายเวลาเท่ากัน`) แล้วรายงานตามจริงว่าส่วนที่เห็นจริงคืออะไร ส่วนที่อนุมานคืออะไร · **ห้ามปลอม session**

- [ ] **Step 5: Commit**

```bash
git add components/garbage/admin/WeekScheduleView.jsx pages/admin/garbage.jsx
git commit -m "feat: wire assignment and route editing into admin page"
```

---

## Task 16: เอกสารและเกตปิดท้าย

**Files:**
- Modify: `docs/modules/garbage.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: อัปเดต `docs/modules/garbage.md`**

แก้ตารางโครงสร้างให้มีไฟล์ใหม่ (API `assignments/`, `routes/`, lib `overlap.ts`, `stopEditing.ts`, `constants.ts`, components 3 ตัวใหม่) และเพิ่มหัวข้อใหม่ท้ายไฟล์:

```markdown
## การแก้ข้อมูล (ตั้งแต่ M6)

**UI คือแหล่งความจริง** — แก้ตารางที่ `/admin/garbage` ไม่ใช่แก้ JSON

- `data/garbage/schedule-seed.json` + `scripts/seed-garbage.mjs` เป็น **bootstrap ตอน DB ว่างเท่านั้น** และเป็น insert-only (รันซ้ำไม่ทับค่าที่แก้จาก UI) ไฟล์ JSON จะ drift จาก DB เป็นเรื่องปกติ
- งานมอบหมายทุกตัวใช้ `effectiveFrom` = `BASELINE_EFFECTIVE_FROM` (`lib/garbage/constants.ts`) และ `effectiveTo = null` เพราะรอบนี้ไม่ทำ versioning — แก้แล้วทับเลย ร่องรอยอยู่ใน audit log
- คีย์ธรรมชาติ `(weekday, truckNumber, shiftNo)` เป็น unique index ชื่อ `natural_key` — เพิ่มซ้ำได้ 409
- กฎข้ามเอกสารที่บังคับฝั่งเซิร์ฟเวอร์: รถคันเดียวกันในวันเดียวกันเวลาห้ามทับ (`lib/garbage/overlap.ts`) และ `stopTimes[].seq` ต้องมีอยู่จริงในสาย
- **การแก้รายการจุดเก็บ**: เขียน `stopTimes` ของงานก่อน แล้วจึงเขียน `route.stops` — ถ้าขั้นสองล้ม งานจะอ้าง seq ที่ยังไม่มี → แสดง "—" (ไม่มีเวลา) ซึ่งปลอดภัยกว่าแสดงเวลาผิด **ห้ามสลับลำดับการเขียน**
- audit log ต้องลงทะเบียน **4 จุด** (`lib/auditLogger.ts` union, `models/AuditLog.js` enum ทั้ง action และ resourceType, `ACTION_LABELS` และ `ACTION_COLORS` ใน `pages/admin/superadmin/audit-log.tsx`) — ลืม enum แล้วเขียน log ไม่ลงแบบเงียบ เพราะ `logAuditEvent` กลืน error
- ไม่มี optimistic locking: สองคนแก้งานเดียวกันพร้อมกัน คนบันทึกทีหลังชนะ (ยอมรับได้ที่ขนาดทีมนี้)
- `/api/garbage/{schedule,week,search}` ตั้ง `s-maxage=300` — หลังแก้ตาราง หน้าประชาชนอาจเห็นของเก่าได้ถึง 5 นาที **ถ้าวันไหนเอา CDN มาวางหน้า Railway ต้องเพิ่มการ purge หรือลด s-maxage**
```

- [ ] **Step 2: อัปเดตบรรทัดโมดูลใน `CLAUDE.md`**

เติมท้ายบรรทัด garbage ที่มีอยู่: `· ตั้งแต่ M6 แก้ตาราง/สาย/จุดเก็บได้จากหน้าแอดมิน (UI เป็นแหล่งความจริง, seed เป็น insert-only bootstrap, ทุกการแก้ลง audit log)`

- [ ] **Step 3: รันเกตทั้งหมด**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: เทสผ่านทั้งหมด (เดิม 137 + ใหม่ 23 = 160 passed, 2 skipped) · tsc เงียบ · lint ไม่มี warning ใหม่ · build ผ่าน

- [ ] **Step 4: Commit**

```bash
git add docs/modules/garbage.md CLAUDE.md
git commit -m "docs: อัปเดตเอกสารโมดูล garbage สำหรับ M6"
```

---

## เช็กลิสต์ยืนยันว่า M6 เสร็จ

- [ ] `npm test` ผ่าน รวมเทสใหม่ของ `findOverlap` (9), `stopEditing` (12), `id` ของงาน (2)
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` ผ่าน
- [ ] รัน `scripts/seed-garbage.mjs` ซ้ำแล้ว `updatedAt` ของ assignment เดิม **ไม่เปลี่ยน** (พิสูจน์ว่า insert-only จริง)
- [ ] `garbage_assignments` มี unique index `natural_key`
- [ ] API ที่ต้อง auth ทั้ง 4 เส้นทางคืน 401 เมื่อไม่ล็อกอิน และ 405 เมื่อใช้ method ผิด
- [ ] probe เขียน audit log ด้วย action ใหม่ลงจริง (พิสูจน์ว่า mongoose enum ครบ) แล้วลบ doc ทดสอบทิ้ง
- [ ] ไม่มีการฟอร์แมตเวลาด้วยมือในไฟล์ใหม่ (ใช้ helper จาก `lib/garbage/time.ts` เท่านั้น)

## งานที่ต้องทำมือหลัง merge (เจ้าของโปรเจกต์)

ต้องล็อกอินเป็นแอดมิน — ไม่มี agent ไหนทำแทนได้:

1. เพิ่มงานวันพุธ → เห็นในตารางแอดมินและที่หน้า `/garbage`
2. จองรถซ้อนเวลา → ต้องถูกปฏิเสธพร้อมข้อความบอกว่าชนกับงานรอบไหน เวลาเท่าไร
3. เพิ่มงานรถคันเดิมรอบเดิมในวันเดิม → 409 พร้อมข้อความให้ไปแก้งานเดิม
4. แก้เวลาแล้วหน้าประชาชนเปลี่ยน (อาจต้องรอ 5 นาทีถ้ามีแคช)
5. ลบงาน → หายทั้งสองหน้า
6. เปิด "จัดการสายและจุดเก็บ" → แก้ชื่อจุดของ R5 แล้วติ๊ก "ตรวจสอบแล้ว" → ป้าย "รอตรวจสอบ" หาย
7. ลบจุดกลางของสายที่มีเวลาแล้ว → เวลาของจุดที่เหลือ**ยังตรงตัวเดิม ไม่เลื่อน** (จุดสำคัญที่สุดของ M6)
8. `/admin/superadmin/audit-log` มีรายการที่เพิ่งทำครบ พร้อมชื่อผู้แก้
