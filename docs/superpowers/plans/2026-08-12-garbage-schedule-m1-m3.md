# ระบบตารางเดินรถเก็บขยะ — Implementation Plan (M1–M3)

> **หมายเหตุการปรับใช้ในรีโปนี้ (2026-08-12):**
> 1. ใช้ env `MONGO_URI` (ตามรีโป) ไม่ใช่ `MONGODB_URI` และห้าม throw ตอน module load — ให้ lazy-init ใน `getDb()`
> 2. ชื่อ collection ใช้ prefix `garbage_` (`garbage_trucks`, `garbage_routes`, `garbage_communities`, `garbage_assignments`) เพราะ `communities` ชนกับ collection ของโมดูลร้องเรียนที่มีอยู่ และ DB แชร์ข้ามแอป
> 3. database ใช้ตัวที่ระบุใน URI (`client.db()` ไม่ส่งชื่อ) ไม่ hardcode "smart-takhli"
> 4. vitest/zod มีอยู่แล้ว — แก้ include ใน `vitest.config.mjs` แทน

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างแกนกลางของโมดูลตารางรถขยะใน Smart Takhli — ตัวจัดการเวลา โครงสร้างข้อมูล MongoDB ตัว resolve ตารางรายวัน และ API สาธารณะ 3 ตัว ให้พร้อมสำหรับหน้าจอในเฟสถัดไป

**Architecture:** แยก "สาย" (ลำดับจุดเก็บ ไม่มีเวลา) ออกจาก "การมอบหมาย" (รถคันไหนวิ่งสายอะไร วันไหน เวลาเท่าไหร่) การสับเปลี่ยนสายจึงเป็นการแก้เอกสารเดียวใน `assignments` โดยไม่แตะข้อมูลจุดเก็บ เวลาทั้งหมดเก็บเป็น int นาทีจากเที่ยงคืน ไม่ใช่ string

**Tech Stack:** Next.js 15 (Pages Router), TypeScript, MongoDB, Vitest, Zod

**ขอบเขต:** M1 (time + types) → M2 (schema + seed) → M3 (resolve + API สาธารณะ) ไม่รวมหน้าจอ ไม่รวมหลังบ้าน ไม่รวมแผนที่

---

## บริบทที่ผู้พัฒนาต้องรู้ก่อนเริ่ม

**โดเมน**

เทศบาลเมืองตาคลีมีรถเก็บขยะ 7 คัน (เบอร์ 1–7) แต่ละคันมีสีถาวร (เหลือง/เขียว) วิ่งตาม "สาย" ที่กำหนดไว้ แต่ละสายมี "จุดเก็บ" เรียงตามลำดับ และครอบคลุม "ชุมชน" หลายชุมชน โปสเตอร์ที่เทศบาลติดประกาศแสดงข้อมูล 2 ชั้น: แถวบนเป็นหมุดเวลาของจุดเก็บ แถวล่างเป็นช่วงเวลาที่รถอยู่ในแต่ละชุมชน

**สิ่งที่ทำให้ระบบนี้ไม่ใช่ CRUD ธรรมดา**

วันอังคาร รถ 1–4 หยุด แล้วรถ 5/6/7 วิ่ง "เก็บแทนเบอร์ 1/2/3" นอกจากนั้นรถ 7 ยังออกอีกรอบตอน 20.00 น. สำหรับตลาดนัด นี่คือเหตุผลที่ต้องแยกรถออกจากสาย และต้องรองรับหลายรอบต่อคันต่อวัน

**บั๊กที่ต้องไม่ทำซ้ำ**

ระบบ prototype เดิมมีโค้ด `if (hour === '12') minutes = 0` ทำให้เวลา 12.00 น. กลายเป็นเที่ยงคืน สายที่วิ่งถึง 13.30 น. และรอบตลาดนัด 20.00 น. จึงแสดงผิดทั้งหมด **ห้ามคัดลอกโค้ดแปลงเวลาจาก prototype เดิมมาใช้** Task 3 มีเทสต์ครอบเคสนี้ไว้แล้ว

ระบบเดิมยังคำนวณตำแหน่งรถจากสัดส่วน `Math.floor(progress * stops.length)` ทั้งที่มีเวลาจริงของทุกจุดอยู่แล้ว ทำให้ตำแหน่งเพี้ยนเมื่อจุดต่าง ๆ ใช้เวลาไม่เท่ากัน (สาย R5 ใช้ 20 นาทีต่อจุดช่วงเช้า แต่ 2.5 ชั่วโมงช่วงสาย) Task 9 ใช้ `stopTimes` จริงแทน

**ข้อมูลที่มี**

`schedule-seed.json` มีวันจันทร์ (7 สาย ครบ) และวันอังคาร (รูปแบบสับเปลี่ยนสาย) วันพุธ–อาทิตย์ยังไม่มี เจ้าหน้าที่จะป้อนเองผ่านหลังบ้านในเฟสถัดไป

---

## File Structure

| ไฟล์ | ความรับผิดชอบ |
|---|---|
| `types/garbage.ts` | type ทั้งหมดของโมดูล — แหล่งเดียว ห้ามประกาศ interface ซ้ำที่อื่น |
| `lib/garbage/time.ts` | แปลงเวลาไทย ↔ นาที ไม่มี dependency อื่น |
| `lib/garbage/time.test.ts` | เทสต์ของ time.ts |
| `lib/garbage/db.ts` | เชื่อม MongoDB + ตัวเข้าถึง collection + สร้าง index |
| `lib/garbage/validators.ts` | Zod schema ใช้ร่วมกันระหว่าง API และ seed |
| `lib/garbage/resolve.ts` | รวมร่างตารางของวันที่ระบุจาก assignments + routes + trucks |
| `lib/garbage/resolve.test.ts` | เทสต์ของ resolve.ts |
| `lib/garbage/live.ts` | คำนวณว่ารถอยู่จุดไหน ณ เวลาหนึ่ง |
| `lib/garbage/live.test.ts` | เทสต์ของ live.ts |
| `scripts/seed-garbage.mjs` | นำเข้า schedule-seed.json สู่ MongoDB |
| `data/garbage/schedule-seed.json` | ข้อมูลตั้งต้น (ไฟล์ที่แนบมา) |
| `pages/api/garbage/schedule.ts` | GET ตารางของวัน |
| `pages/api/garbage/search.ts` | GET ค้นหาจุด/ชุมชน |
| `pages/api/garbage/live.ts` | GET สถานะรถขณะนี้ |

---

## Task 1: ติดตั้ง Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: ติดตั้ง dependency**

```bash
npm i -D vitest @vitest/coverage-v8
npm i zod
```

- [ ] **Step 2: สร้าง vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: เพิ่ม script ใน package.json**

เพิ่มใน `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: ยืนยันว่า vitest รันได้**

Run: `npm test`
Expected: `No test files found` — ไม่ error เรื่อง config

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for garbage schedule module"
```

---

## Task 2: นิยาม type ทั้งหมด

**Files:**
- Create: `types/garbage.ts`

- [ ] **Step 1: เขียนไฟล์ type**

```ts
/** นาทีจากเที่ยงคืน 0–1439 (เช่น 4.00 น. = 240, 13.30 น. = 810, 20.00 น. = 1200) */
export type Minutes = number;

export type TruckColor = "yellow" | "green";
export type TruckStatus = "active" | "maintenance" | "retired";
export type StopMode = "truck" | "walk";
export type AssignmentKind = "normal" | "substitute" | "day_off" | "special";

/** 0 = อาทิตย์ … 6 = เสาร์ ตรงกับ Date.getDay() */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Truck {
  number: number;
  color: TruckColor;
  plate?: string | null;
  status: TruckStatus;
}

export interface Community {
  name: string;
  aliases?: string[];
}

export interface RouteStop {
  seq: number;
  name: string;
  mode: StopMode;
  /** อ้างถนนในชั้นข้อมูล GIS — ยังไม่ใช้ในเฟสนี้ */
  roadId?: string | null;
}

export interface Route {
  code: string;
  name: string;
  defaultTruckNumber: number;
  stops: RouteStop[];
  communityNames: string[];
  source?: string;
  needsVerification?: boolean;
  active: boolean;
}

export interface StopTime {
  seq: number;
  atMin: Minutes;
}

export interface CommunityWindow {
  communityNames: string[];
  startMin: Minutes;
  endMin: Minutes;
  note?: string;
}

export interface Assignment {
  weekday: Weekday;
  shiftNo: number;
  truckNumber: number;
  routeCode: string | null;
  kind: AssignmentKind;
  coverForRouteCode: string | null;
  startMin: Minutes | null;
  endMin: Minutes | null;
  stopTimes: StopTime[];
  communityWindows: CommunityWindow[];
  label: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

/** ผลลัพธ์หลัง join แล้ว พร้อมส่งให้ UI */
export interface ResolvedAssignment {
  truckNumber: number;
  truckColor: TruckColor;
  shiftNo: number;
  kind: AssignmentKind;
  routeCode: string | null;
  routeName: string | null;
  coverForRouteCode: string | null;
  startMin: Minutes | null;
  endMin: Minutes | null;
  label: string | null;
  stops: Array<RouteStop & { atMin: Minutes | null }>;
  communityWindows: CommunityWindow[];
}

export interface ResolvedDaySchedule {
  date: string; // YYYY-MM-DD
  weekday: Weekday;
  assignments: ResolvedAssignment[];
}

export type LiveStatus = "upcoming" | "running" | "finished" | "unknown";

export interface LivePosition {
  status: LiveStatus;
  /** จำนวนนาทีจนกว่าจะเริ่ม — มีค่าเมื่อ status = "upcoming" */
  startsInMin: number | null;
  currentStop: RouteStop | null;
  nextStop: RouteStop | null;
  /** นาทีจนกว่าจะถึง nextStop */
  etaNextMin: number | null;
  currentWindow: CommunityWindow | null;
  /** 0–1 */
  progress: number;
}
```

- [ ] **Step 2: ยืนยันว่า TypeScript ผ่าน**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add types/garbage.ts
git commit -m "feat: add garbage schedule domain types"
```

---

## Task 3: parseThaiTime

**Files:**
- Create: `lib/garbage/time.ts`
- Test: `lib/garbage/time.test.ts`

โปสเตอร์เขียนเวลาแบบ `4.00น.` (ใช้จุด ไม่เว้นวรรค) ส่วน JSON ของ prototype เดิมเขียน `4:00 น.` (ใช้ทวิภาค เว้นวรรค) ตัว parser ต้องรับได้ทั้งสองแบบ

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
import { describe, it, expect } from "vitest";
import { parseThaiTime } from "./time";

describe("parseThaiTime", () => {
  it("อ่านรูปแบบทวิภาคพร้อม น. ได้", () => {
    expect(parseThaiTime("4:00 น.")).toBe(240);
    expect(parseThaiTime("9:20 น.")).toBe(560);
  });

  it("อ่านรูปแบบจุดแบบโปสเตอร์ได้", () => {
    expect(parseThaiTime("4.00น.")).toBe(240);
    expect(parseThaiTime("13.30น.")).toBe(810);
  });

  it("อ่านเลขนำหน้าศูนย์ได้", () => {
    expect(parseThaiTime("04:30 น.")).toBe(270);
    expect(parseThaiTime("03.40น.")).toBe(220);
  });

  it("ไม่แปลงเที่ยงวันเป็นเที่ยงคืน", () => {
    // บั๊กจริงของระบบเดิม: if (hour === '12') minutes = 0
    expect(parseThaiTime("12:00 น.")).toBe(720);
    expect(parseThaiTime("12.30น.")).toBe(750);
  });

  it("อ่านเวลาช่วงเย็นแบบ 24 ชั่วโมงได้", () => {
    expect(parseThaiTime("20.00น.")).toBe(1200);
    expect(parseThaiTime("23:59")).toBe(1439);
  });

  it("รับได้เมื่อไม่มี น.", () => {
    expect(parseThaiTime("6:15")).toBe(375);
  });

  it("ตัดช่องว่างส่วนเกิน", () => {
    expect(parseThaiTime("  7.05 น.  ")).toBe(425);
  });

  it("คืน null เมื่อ input ไม่ถูกต้อง", () => {
    expect(parseThaiTime("")).toBeNull();
    expect(parseThaiTime("ไม่ใช่เวลา")).toBeNull();
    expect(parseThaiTime("25:00")).toBeNull();
    expect(parseThaiTime("10:60")).toBeNull();
    expect(parseThaiTime("4")).toBeNull();
  });
});
```

- [ ] **Step 2: รันเทสต์เพื่อยืนยันว่าไม่ผ่าน**

Run: `npx vitest run lib/garbage/time.test.ts`
Expected: FAIL — `Failed to resolve import "./time"`

- [ ] **Step 3: เขียน implementation ขั้นต่ำ**

```ts
import type { Minutes } from "@/types/garbage";

const TIME_RE = /^(\d{1,2})[:.](\d{2})(?:\s*น\.?)?$/u;

/**
 * แปลงเวลาไทยเป็นนาทีจากเที่ยงคืน
 * รับได้ทั้ง "4:00 น." (JSON เดิม) และ "4.00น." (โปสเตอร์)
 * ถือว่าเป็นระบบ 24 ชั่วโมงเสมอ — 12.30 น. คือเที่ยงครึ่ง ไม่ใช่เที่ยงคืนครึ่ง
 */
export function parseThaiTime(input: string | null | undefined): Minutes | null {
  if (input == null) return null;
  const m = TIME_RE.exec(String(input).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}
```

- [ ] **Step 4: รันเทสต์เพื่อยืนยันว่าผ่าน**

Run: `npx vitest run lib/garbage/time.test.ts`
Expected: PASS ทั้ง 8 เคส

- [ ] **Step 5: Commit**

```bash
git add lib/garbage/time.ts lib/garbage/time.test.ts
git commit -m "feat: add parseThaiTime with noon-handling test coverage"
```

---

## Task 4: formatThaiTime และตัวช่วยเวลาอื่น

**Files:**
- Modify: `lib/garbage/time.ts`
- Modify: `lib/garbage/time.test.ts`

- [ ] **Step 1: เพิ่มเทสต์**

เพิ่มต่อท้าย `lib/garbage/time.test.ts`:

```ts
import { formatThaiTime, formatRange, minutesNowInBangkok, weekdayOf } from "./time";

describe("formatThaiTime", () => {
  it("จัดรูปแบบตามโปสเตอร์", () => {
    expect(formatThaiTime(240)).toBe("4.00 น.");
    expect(formatThaiTime(560)).toBe("9.20 น.");
  });

  it("ไม่เพี้ยนที่เที่ยงและเย็น", () => {
    expect(formatThaiTime(720)).toBe("12.00 น.");
    expect(formatThaiTime(810)).toBe("13.30 น.");
    expect(formatThaiTime(1200)).toBe("20.00 น.");
  });

  it("คืนค่าว่างเมื่อ input เป็น null", () => {
    expect(formatThaiTime(null)).toBe("");
  });

  it("ไป-กลับกับ parseThaiTime ได้ค่าเดิม", () => {
    for (const m of [0, 240, 560, 720, 810, 1200, 1439]) {
      expect(parseThaiTime(formatThaiTime(m))).toBe(m);
    }
  });
});

describe("formatRange", () => {
  it("แสดงช่วงเวลา", () => {
    expect(formatRange(240, 560)).toBe("4.00 – 9.20 น.");
  });
});

describe("weekdayOf", () => {
  it("คืนวันในสัปดาห์ตามเวลาไทย", () => {
    // 2026-08-12 คือวันพุธ
    expect(weekdayOf("2026-08-12")).toBe(3);
    // 2026-08-10 คือวันจันทร์
    expect(weekdayOf("2026-08-10")).toBe(1);
  });
});

describe("minutesNowInBangkok", () => {
  it("คืนค่าอยู่ในช่วง 0–1439", () => {
    const m = minutesNowInBangkok();
    expect(m).toBeGreaterThanOrEqual(0);
    expect(m).toBeLessThanOrEqual(1439);
  });
});
```

- [ ] **Step 2: รันเทสต์เพื่อยืนยันว่าไม่ผ่าน**

Run: `npx vitest run lib/garbage/time.test.ts`
Expected: FAIL — `formatThaiTime is not a function`

- [ ] **Step 3: เพิ่ม implementation**

เพิ่มต่อท้าย `lib/garbage/time.ts`:

```ts
import type { Weekday } from "@/types/garbage";

export const BANGKOK_TZ = "Asia/Bangkok";

/** 560 → "9.20 น." ใช้จุดตามรูปแบบโปสเตอร์ของเทศบาล */
export function formatThaiTime(min: Minutes | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}.${String(m).padStart(2, "0")} น.`;
}

/** 240, 560 → "4.00 – 9.20 น." */
export function formatRange(startMin: Minutes | null, endMin: Minutes | null): string {
  if (startMin == null || endMin == null) return "";
  const a = formatThaiTime(startMin).replace(" น.", "");
  return `${a} – ${formatThaiTime(endMin)}`;
}

/** แยกส่วนของวันที่ตามเขตเวลาไทย ไม่ขึ้นกับ TZ ของเซิร์ฟเวอร์ */
function bangkokParts(d: Date): { y: number; m: number; d: number; weekday: Weekday } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const map: Record<string, Weekday> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    weekday: map[parts.weekday as string],
  };
}

/** "2026-08-12" | Date → 0..6 ตามเวลาไทย */
export function weekdayOf(input: string | Date): Weekday {
  const d = typeof input === "string" ? new Date(`${input}T00:00:00+07:00`) : input;
  return bangkokParts(d).weekday;
}

/** วันที่ปัจจุบันในไทยเป็น "YYYY-MM-DD" */
export function todayInBangkok(): string {
  const p = bangkokParts(new Date());
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** เวลาปัจจุบันในไทยเป็นนาทีจากเที่ยงคืน */
export function minutesNowInBangkok(now: Date = new Date()): Minutes {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGKOK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = fmt.format(now).split(":").map(Number);
  return (h % 24) * 60 + m;
}
```

- [ ] **Step 4: รันเทสต์เพื่อยืนยันว่าผ่าน**

Run: `npx vitest run lib/garbage/time.test.ts`
Expected: PASS ทุกเคส

- [ ] **Step 5: Commit**

```bash
git add lib/garbage/time.ts lib/garbage/time.test.ts
git commit -m "feat: add Thai time formatting and Bangkok timezone helpers"
```

---

## Task 5: ตัวเชื่อม MongoDB

**Files:**
- Create: `lib/garbage/db.ts`

- [ ] **Step 1: เขียนไฟล์**

```ts
import { MongoClient, type Collection, type Db } from "mongodb";
import type { Truck, Route, Community, Assignment } from "@/types/garbage";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "smart-takhli";

if (!uri) throw new Error("ต้องตั้งค่า MONGODB_URI");

// ใช้ global cache เพื่อไม่ให้ hot reload ของ Next.js เปิด connection ใหม่ทุกครั้ง
const globalForMongo = globalThis as unknown as { _garbageMongo?: Promise<MongoClient> };

const clientPromise: Promise<MongoClient> =
  globalForMongo._garbageMongo ?? new MongoClient(uri).connect();

if (process.env.NODE_ENV !== "production") globalForMongo._garbageMongo = clientPromise;

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}

export async function trucks(): Promise<Collection<Truck>> {
  return (await getDb()).collection<Truck>("trucks");
}

export async function routes(): Promise<Collection<Route>> {
  return (await getDb()).collection<Route>("routes");
}

export async function communities(): Promise<Collection<Community>> {
  return (await getDb()).collection<Community>("communities");
}

export async function assignments(): Promise<Collection<Assignment>> {
  return (await getDb()).collection<Assignment>("assignments");
}

/** สร้าง index ทั้งหมด — เรียกจาก seed script ปลอดภัยที่จะเรียกซ้ำ */
export async function ensureIndexes(): Promise<void> {
  const db = await getDb();
  await db.collection("trucks").createIndex({ number: 1 }, { unique: true });
  await db.collection("routes").createIndex({ code: 1 }, { unique: true });
  await db.collection("routes").createIndex({ "stops.name": 1 });
  await db.collection("communities").createIndex({ name: 1 }, { unique: true });
  await db
    .collection("communities")
    .createIndex({ name: "text", aliases: "text" }, { default_language: "none" });
  await db.collection("assignments").createIndex({ weekday: 1, effectiveFrom: -1 });
  await db.collection("assignments").createIndex({ truckNumber: 1, weekday: 1, shiftNo: 1 });
  await db.collection("assignments").createIndex({ routeCode: 1 });
}
```

หมายเหตุเรื่อง text index: ตั้ง `default_language: "none"` เพราะ MongoDB ไม่มี stemmer ภาษาไทย ถ้าไม่ตั้งจะตัดคำผิดและค้นไม่เจอ

- [ ] **Step 2: ยืนยันว่า TypeScript ผ่าน**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add lib/garbage/db.ts
git commit -m "feat: add MongoDB accessors for garbage schedule collections"
```

---

## Task 6: Zod validators

**Files:**
- Create: `lib/garbage/validators.ts`

- [ ] **Step 1: เขียนไฟล์**

```ts
import { z } from "zod";

const minutes = z.number().int().min(0).max(1439);

export const stopSchema = z.object({
  seq: z.number().int().positive(),
  name: z.string().min(1).max(200),
  mode: z.enum(["truck", "walk"]),
  roadId: z.string().max(50).nullable().optional(),
}).strict();

export const routeSchema = z.object({
  code: z.string().regex(/^R\d+$/u, "รหัสสายต้องเป็นรูปแบบ R1, R2, …"),
  name: z.string().min(1).max(200),
  defaultTruckNumber: z.number().int().min(1).max(99),
  stops: z.array(stopSchema).min(1),
  communityNames: z.array(z.string().min(1)).min(1),
  source: z.string().optional(),
  needsVerification: z.boolean().optional(),
}).strict();

export const stopTimeSchema = z.object({
  seq: z.number().int().positive(),
  atMin: minutes,
}).strict();

export const communityWindowSchema = z.object({
  communityNames: z.array(z.string().min(1)).min(1),
  startMin: minutes,
  endMin: minutes,
  note: z.string().optional(),
}).strict();

export const assignmentSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  shiftNo: z.number().int().positive(),
  truckNumber: z.number().int().min(1).max(99),
  routeCode: z.string().regex(/^R\d+$/u).nullable(),
  kind: z.enum(["normal", "substitute", "day_off", "special"]),
  coverForRouteCode: z.string().regex(/^R\d+$/u).nullable(),
  startMin: minutes.nullable(),
  endMin: minutes.nullable(),
  stopTimes: z.array(stopTimeSchema),
  communityWindows: z.array(communityWindowSchema),
  label: z.string().nullable(),
}).strict()
  .refine((a) => a.kind !== "day_off" || a.routeCode === null, {
    message: "วันหยุดต้องไม่มี routeCode",
  })
  .refine((a) => a.kind !== "substitute" || a.coverForRouteCode !== null, {
    message: "การเก็บแทนต้องระบุ coverForRouteCode",
  })
  .refine((a) => a.kind === "day_off" || (a.startMin !== null && a.endMin !== null), {
    message: "ต้องระบุเวลาเริ่มและสิ้นสุด ยกเว้นวันหยุด",
  });

export const seedFileSchema = z.object({
  trucks: z.array(
    z.object({
      number: z.number().int().min(1).max(99),
      color: z.enum(["yellow", "green"]),
      status: z.enum(["active", "maintenance", "retired"]),
    }).strict()
  ),
  communities: z.array(z.object({ name: z.string().min(1) }).strict()),
  routes: z.array(routeSchema),
  assignments: z.array(assignmentSchema),
}).passthrough(); // ยอมให้มี key ที่ขึ้นต้นด้วย $ สำหรับคำอธิบายในไฟล์
```

- [ ] **Step 2: ยืนยันว่า TypeScript ผ่าน**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add lib/garbage/validators.ts
git commit -m "feat: add Zod validators for garbage schedule"
```

---

## Task 7: สคริปต์ seed

**Files:**
- Create: `data/garbage/schedule-seed.json` (คัดลอกไฟล์ที่แนบมากับแผนนี้)
- Create: `scripts/seed-garbage.mjs`

- [ ] **Step 1: วางไฟล์ข้อมูล**

```bash
mkdir -p data/garbage
# คัดลอก schedule-seed.json ที่แนบมา ไปที่ data/garbage/schedule-seed.json
```

ยืนยันเนื้อหา:

```bash
node -e "const d=require('./data/garbage/schedule-seed.json');console.log('trucks',d.trucks.length,'routes',d.routes.length,'communities',d.communities.length,'assignments',d.assignments.length)"
```

Expected: `trucks 7 routes 7 communities 21 assignments 17`

- [ ] **Step 2: เขียนสคริปต์ seed**

```js
#!/usr/bin/env node
/**
 * นำเข้าข้อมูลตั้งต้นตารางรถขยะ
 *   MONGODB_URI="..." node scripts/seed-garbage.mjs
 *   MONGODB_URI="..." node scripts/seed-garbage.mjs --dry-run
 *
 * idempotent: upsert ตาม natural key ไม่สร้างซ้ำ รันกี่ครั้งก็ได้
 */
import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

const FILE = "data/garbage/schedule-seed.json";
const dryRun = process.argv.includes("--dry-run");
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "smart-takhli";

const seed = JSON.parse(readFileSync(FILE, "utf8"));

// ตรวจความสอดคล้องก่อนเขียน
const errors = [];
const routeCodes = new Set(seed.routes.map((r) => r.code));
const truckNumbers = new Set(seed.trucks.map((t) => t.number));
const communityNames = new Set(seed.communities.map((c) => c.name));

for (const r of seed.routes) {
  const seqs = r.stops.map((s) => s.seq);
  if (new Set(seqs).size !== seqs.length) errors.push(`${r.code}: seq ของจุดเก็บซ้ำ`);
  if (seqs.some((s, i) => s !== i + 1)) errors.push(`${r.code}: seq ไม่เรียง 1..n`);
  for (const c of r.communityNames) {
    if (!communityNames.has(c)) errors.push(`${r.code}: ไม่รู้จักชุมชน "${c}"`);
  }
}
for (const a of seed.assignments) {
  const at = `รถ ${a.truckNumber} วัน ${a.weekday} รอบ ${a.shiftNo}`;
  if (!truckNumbers.has(a.truckNumber)) errors.push(`${at}: ไม่รู้จักรถ`);
  if (a.routeCode && !routeCodes.has(a.routeCode)) errors.push(`${at}: ไม่รู้จักสาย ${a.routeCode}`);
  if (a.coverForRouteCode && !routeCodes.has(a.coverForRouteCode))
    errors.push(`${at}: ไม่รู้จักสายที่เก็บแทน ${a.coverForRouteCode}`);
  if (a.startMin != null && a.endMin != null && a.endMin < a.startMin)
    errors.push(`${at}: เวลาสิ้นสุดก่อนเวลาเริ่ม`);
  const route = seed.routes.find((r) => r.code === a.routeCode);
  if (route) {
    for (const st of a.stopTimes) {
      if (!route.stops.some((s) => s.seq === st.seq))
        errors.push(`${at}: stopTimes อ้าง seq ${st.seq} ที่ไม่มีในสาย ${a.routeCode}`);
    }
  }
  for (const w of a.communityWindows) {
    for (const c of w.communityNames) {
      if (!communityNames.has(c)) errors.push(`${at}: ไม่รู้จักชุมชน "${c}"`);
    }
  }
}
// รถคันเดียวกันในวันเดียวกัน เวลาต้องไม่ทับกัน
const byTruckDay = new Map();
for (const a of seed.assignments) {
  if (a.startMin == null) continue;
  const k = `${a.weekday}-${a.truckNumber}`;
  (byTruckDay.get(k) ?? byTruckDay.set(k, []).get(k)).push(a);
}
for (const [k, list] of byTruckDay) {
  list.sort((x, y) => x.startMin - y.startMin);
  for (let i = 1; i < list.length; i++) {
    if (list[i].startMin < list[i - 1].endMin)
      errors.push(`${k}: รอบ ${list[i - 1].shiftNo} กับ ${list[i].shiftNo} เวลาทับกัน`);
  }
}

if (errors.length) {
  console.error(`พบข้อผิดพลาด ${errors.length} รายการ — ยกเลิก\n`);
  errors.forEach((e) => console.error("  " + e));
  process.exit(1);
}
console.log("ตรวจความสอดคล้องผ่าน");

if (dryRun) {
  console.log("--dry-run: ไม่เขียนฐานข้อมูล");
  process.exit(0);
}
if (!uri) {
  console.error("ต้องตั้งค่า MONGODB_URI");
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);
const now = new Date();
const effectiveFrom = new Date("2026-01-01T00:00:00+07:00");

await db.collection("trucks").createIndex({ number: 1 }, { unique: true });
await db.collection("routes").createIndex({ code: 1 }, { unique: true });
await db.collection("communities").createIndex({ name: 1 }, { unique: true });
await db.collection("communities").createIndex({ name: "text", aliases: "text" }, { default_language: "none" });
await db.collection("assignments").createIndex({ weekday: 1, effectiveFrom: -1 });
await db.collection("assignments").createIndex({ truckNumber: 1, weekday: 1, shiftNo: 1 });
await db.collection("assignments").createIndex({ routeCode: 1 });

const up = (col, filter, doc) => ({
  updateOne: { filter, update: { $set: { ...doc, updatedAt: now }, $setOnInsert: { createdAt: now } }, upsert: true },
});

const r1 = await db.collection("trucks").bulkWrite(
  seed.trucks.map((t) => up(db.collection("trucks"), { number: t.number }, t))
);
const r2 = await db.collection("communities").bulkWrite(
  seed.communities.map((c) => up(null, { name: c.name }, { ...c, aliases: [], active: true }))
);
const r3 = await db.collection("routes").bulkWrite(
  seed.routes.map((r) => up(null, { code: r.code }, { ...r, active: true }))
);
const r4 = await db.collection("assignments").bulkWrite(
  seed.assignments.map((a) =>
    up(null, { weekday: a.weekday, truckNumber: a.truckNumber, shiftNo: a.shiftNo }, {
      ...a,
      effectiveFrom,
      effectiveTo: null,
    })
  )
);

console.log(`trucks +${r1.upsertedCount}/~${r1.modifiedCount}`);
console.log(`communities +${r2.upsertedCount}/~${r2.modifiedCount}`);
console.log(`routes +${r3.upsertedCount}/~${r3.modifiedCount}`);
console.log(`assignments +${r4.upsertedCount}/~${r4.modifiedCount}`);

await client.close();
console.log("เสร็จเรียบร้อย");
```

- [ ] **Step 3: รัน dry-run เพื่อยืนยันการตรวจความสอดคล้อง**

Run: `node scripts/seed-garbage.mjs --dry-run`
Expected:
```
ตรวจความสอดคล้องผ่าน
--dry-run: ไม่เขียนฐานข้อมูล
```

- [ ] **Step 4: รันจริง**

Run: `MONGODB_URI="<uri>" node scripts/seed-garbage.mjs`
Expected: `trucks +7/~0`, `routes +7/~0`, `communities +21/~0`, `assignments +17/~0`

- [ ] **Step 5: รันซ้ำเพื่อยืนยัน idempotency**

Run: `MONGODB_URI="<uri>" node scripts/seed-garbage.mjs`
Expected: `upsertedCount` เป็น 0 ทั้งหมด ไม่มีข้อมูลซ้ำ

- [ ] **Step 6: Commit**

```bash
git add data/garbage/schedule-seed.json scripts/seed-garbage.mjs
git commit -m "feat: add garbage schedule seed data and idempotent import script"
```

---

## Task 8: resolveScheduleForDate

**Files:**
- Create: `lib/garbage/resolve.ts`
- Test: `lib/garbage/resolve.test.ts`

แยก logic บริสุทธิ์ (`buildDaySchedule`) ออกจากการอ่านฐานข้อมูล (`resolveScheduleForDate`) เพื่อให้เทสต์ได้โดยไม่ต้องมี MongoDB

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
import { describe, it, expect } from "vitest";
import { buildDaySchedule, pickLatestVersions } from "./resolve";
import type { Assignment, Route, Truck } from "@/types/garbage";

const trucks: Truck[] = [
  { number: 1, color: "yellow", status: "active" },
  { number: 5, color: "green", status: "active" },
];

const routes: Route[] = [
  {
    code: "R1", name: "สาย R1", defaultTruckNumber: 1, active: true,
    communityNames: ["ชุมชนเขาใบไม้"],
    stops: [
      { seq: 1, name: "ถ.ดอกไม้แดง", mode: "truck" },
      { seq: 2, name: "ซ.เจ้าเงาะ 5", mode: "truck" },
    ],
  },
];

const base = {
  effectiveFrom: new Date("2026-01-01"), effectiveTo: null,
  coverForRouteCode: null, label: null, communityWindows: [],
};

describe("buildDaySchedule", () => {
  it("join สาย รถ และเวลาจุดเข้าด้วยกัน", () => {
    const a: Assignment[] = [{
      ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal",
      startMin: 240, endMin: 560,
      stopTimes: [{ seq: 1, atMin: 240 }, { seq: 2, atMin: 255 }],
    }];
    const out = buildDaySchedule("2026-08-10", 1, a, routes, trucks);
    expect(out.assignments).toHaveLength(1);
    expect(out.assignments[0].truckColor).toBe("yellow");
    expect(out.assignments[0].routeName).toBe("สาย R1");
    expect(out.assignments[0].stops[1]).toMatchObject({ name: "ซ.เจ้าเงาะ 5", atMin: 255 });
  });

  it("จัดการวันหยุดที่ไม่มีสาย", () => {
    const a: Assignment[] = [{
      ...base, weekday: 2, shiftNo: 1, truckNumber: 1, routeCode: null, kind: "day_off",
      startMin: null, endMin: null, stopTimes: [], label: "วันหยุด",
    }];
    const out = buildDaySchedule("2026-08-11", 2, a, routes, trucks);
    expect(out.assignments[0].kind).toBe("day_off");
    expect(out.assignments[0].stops).toEqual([]);
    expect(out.assignments[0].routeName).toBeNull();
  });

  it("แสดงว่ารถคันไหนเก็บแทนสายอะไร", () => {
    const a: Assignment[] = [{
      ...base, weekday: 2, shiftNo: 1, truckNumber: 5, routeCode: "R1", kind: "substitute",
      coverForRouteCode: "R1", startMin: 240, endMin: 310, stopTimes: [],
      label: "เก็บแทนเบอร์ 1",
    }];
    const out = buildDaySchedule("2026-08-11", 2, a, routes, trucks);
    expect(out.assignments[0]).toMatchObject({
      truckNumber: 5, kind: "substitute", coverForRouteCode: "R1", label: "เก็บแทนเบอร์ 1",
    });
  });

  it("จุดที่ไม่มีเวลากำหนด ได้ atMin เป็น null ไม่ใช่พัง", () => {
    const a: Assignment[] = [{
      ...base, weekday: 2, shiftNo: 2, truckNumber: 5, routeCode: "R1", kind: "normal",
      startMin: 310, endMin: 810, stopTimes: [],
    }];
    const out = buildDaySchedule("2026-08-11", 2, a, routes, trucks);
    expect(out.assignments[0].stops.every((s) => s.atMin === null)).toBe(true);
  });

  it("เรียงตามเวลาเริ่ม แล้วตามเบอร์รถ", () => {
    const a: Assignment[] = [
      { ...base, weekday: 1, shiftNo: 1, truckNumber: 5, routeCode: "R1", kind: "normal", startMin: 300, endMin: 500, stopTimes: [] },
      { ...base, weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 500, stopTimes: [] },
    ];
    const out = buildDaySchedule("2026-08-10", 1, a, routes, trucks);
    expect(out.assignments.map((x) => x.truckNumber)).toEqual([1, 5]);
  });

  it("วันหยุดถูกจัดไว้ท้ายสุด", () => {
    const a: Assignment[] = [
      { ...base, weekday: 2, shiftNo: 1, truckNumber: 1, routeCode: null, kind: "day_off", startMin: null, endMin: null, stopTimes: [] },
      { ...base, weekday: 2, shiftNo: 1, truckNumber: 5, routeCode: "R1", kind: "normal", startMin: 240, endMin: 500, stopTimes: [] },
    ];
    const out = buildDaySchedule("2026-08-11", 2, a, routes, trucks);
    expect(out.assignments.map((x) => x.truckNumber)).toEqual([5, 1]);
  });
});

describe("pickLatestVersions", () => {
  it("เลือกเวอร์ชันที่ effectiveFrom ใหม่สุดของแต่ละ (รถ, รอบ)", () => {
    const a: Assignment[] = [
      { ...base, effectiveFrom: new Date("2026-01-01"), weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 240, endMin: 500, stopTimes: [] },
      { ...base, effectiveFrom: new Date("2026-07-01"), weekday: 1, shiftNo: 1, truckNumber: 1, routeCode: "R1", kind: "normal", startMin: 300, endMin: 560, stopTimes: [] },
    ];
    const out = pickLatestVersions(a);
    expect(out).toHaveLength(1);
    expect(out[0].startMin).toBe(300);
  });
});
```

- [ ] **Step 2: รันเทสต์เพื่อยืนยันว่าไม่ผ่าน**

Run: `npx vitest run lib/garbage/resolve.test.ts`
Expected: FAIL — `Failed to resolve import "./resolve"`

- [ ] **Step 3: เขียน implementation**

```ts
import type {
  Assignment, Route, Truck, ResolvedAssignment, ResolvedDaySchedule, Weekday,
} from "@/types/garbage";
import { assignments as assignmentsCol, routes as routesCol, trucks as trucksCol } from "./db";
import { weekdayOf } from "./time";

/** เมื่อมีหลายเวอร์ชันของ (รถ, รอบ) เดียวกัน เลือกอันที่ effectiveFrom ใหม่สุด */
export function pickLatestVersions(list: Assignment[]): Assignment[] {
  const best = new Map<string, Assignment>();
  for (const a of list) {
    const key = `${a.truckNumber}-${a.shiftNo}`;
    const cur = best.get(key);
    if (!cur || a.effectiveFrom > cur.effectiveFrom) best.set(key, a);
  }
  return [...best.values()];
}

/** logic บริสุทธิ์ — ไม่แตะฐานข้อมูล เพื่อให้เทสต์ได้ */
export function buildDaySchedule(
  date: string,
  weekday: Weekday,
  list: Assignment[],
  routes: Route[],
  trucks: Truck[]
): ResolvedDaySchedule {
  const routeByCode = new Map(routes.map((r) => [r.code, r]));
  const truckByNumber = new Map(trucks.map((t) => [t.number, t]));

  const resolved: ResolvedAssignment[] = list.map((a) => {
    const route = a.routeCode ? routeByCode.get(a.routeCode) ?? null : null;
    const truck = truckByNumber.get(a.truckNumber);
    const timeBySeq = new Map(a.stopTimes.map((s) => [s.seq, s.atMin]));

    return {
      truckNumber: a.truckNumber,
      truckColor: truck?.color ?? "green",
      shiftNo: a.shiftNo,
      kind: a.kind,
      routeCode: a.routeCode,
      routeName: route?.name ?? null,
      coverForRouteCode: a.coverForRouteCode,
      startMin: a.startMin,
      endMin: a.endMin,
      label: a.label,
      stops: route
        ? route.stops.map((s) => ({ ...s, atMin: timeBySeq.get(s.seq) ?? null }))
        : [],
      communityWindows: a.communityWindows,
    };
  });

  // วันหยุดไปท้ายสุด ที่เหลือเรียงตามเวลาเริ่ม แล้วเบอร์รถ แล้วรอบ
  resolved.sort((x, y) => {
    const xOff = x.startMin == null ? 1 : 0;
    const yOff = y.startMin == null ? 1 : 0;
    if (xOff !== yOff) return xOff - yOff;
    if (x.startMin != null && y.startMin != null && x.startMin !== y.startMin)
      return x.startMin - y.startMin;
    if (x.truckNumber !== y.truckNumber) return x.truckNumber - y.truckNumber;
    return x.shiftNo - y.shiftNo;
  });

  return { date, weekday, assignments: resolved };
}

/** อ่านจากฐานข้อมูลแล้วประกอบเป็นตารางของวันที่ระบุ */
export async function resolveScheduleForDate(date: string): Promise<ResolvedDaySchedule> {
  const weekday = weekdayOf(date);
  const at = new Date(`${date}T00:00:00+07:00`);

  const [aCol, rCol, tCol] = await Promise.all([assignmentsCol(), routesCol(), trucksCol()]);
  const [rawAssignments, allRoutes, allTrucks] = await Promise.all([
    aCol
      .find({
        weekday,
        effectiveFrom: { $lte: at },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gte: at } }],
      })
      .toArray(),
    rCol.find({ active: true }).toArray(),
    tCol.find({}).toArray(),
  ]);

  return buildDaySchedule(date, weekday, pickLatestVersions(rawAssignments), allRoutes, allTrucks);
}
```

- [ ] **Step 4: รันเทสต์เพื่อยืนยันว่าผ่าน**

Run: `npx vitest run lib/garbage/resolve.test.ts`
Expected: PASS ทั้ง 7 เคส

- [ ] **Step 5: Commit**

```bash
git add lib/garbage/resolve.ts lib/garbage/resolve.test.ts
git commit -m "feat: add day schedule resolver with substitute route support"
```

---

## Task 9: getLivePosition

**Files:**
- Create: `lib/garbage/live.ts`
- Test: `lib/garbage/live.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
import { describe, it, expect } from "vitest";
import { getLivePosition } from "./live";
import type { ResolvedAssignment } from "@/types/garbage";

const ra: ResolvedAssignment = {
  truckNumber: 1, truckColor: "yellow", shiftNo: 1, kind: "normal",
  routeCode: "R1", routeName: "สาย R1", coverForRouteCode: null,
  startMin: 240, endMin: 300, label: null,
  stops: [
    { seq: 1, name: "จุด A", mode: "truck", atMin: 240 },
    { seq: 2, name: "จุด B", mode: "truck", atMin: 270 },
    { seq: 3, name: "จุด C", mode: "truck", atMin: 300 },
  ],
  communityWindows: [
    { communityNames: ["ชุมชน ก"], startMin: 240, endMin: 270 },
    { communityNames: ["ชุมชน ข"], startMin: 270, endMin: 300 },
  ],
};

describe("getLivePosition", () => {
  it("ก่อนเริ่ม บอกว่าอีกกี่นาทีจะเริ่ม", () => {
    const p = getLivePosition(ra, 200);
    expect(p.status).toBe("upcoming");
    expect(p.startsInMin).toBe(40);
  });

  it("หลังจบ บอกว่าเสร็จแล้ว", () => {
    expect(getLivePosition(ra, 400).status).toBe("finished");
  });

  it("ระหว่างวิ่ง บอกจุดปัจจุบันและจุดถัดไป", () => {
    const p = getLivePosition(ra, 280);
    expect(p.status).toBe("running");
    expect(p.currentStop?.name).toBe("จุด B");
    expect(p.nextStop?.name).toBe("จุด C");
    expect(p.etaNextMin).toBe(20);
    expect(p.currentWindow?.communityNames).toEqual(["ชุมชน ข"]);
  });

  it("ณ นาทีสุดท้ายพอดี ต้องได้จุดสุดท้าย ไม่ใช่จุดแรก", () => {
    // บั๊กของระบบเดิม: Math.floor(progress * len) ได้ index เกินขอบ แล้ว fallback ไป stops[0]
    const p = getLivePosition(ra, 300);
    expect(p.currentStop?.name).toBe("จุด C");
    expect(p.nextStop).toBeNull();
    expect(p.progress).toBe(1);
  });

  it("ใช้เวลาจริงของแต่ละจุด ไม่ใช่สัดส่วนของเส้นทาง", () => {
    const uneven: ResolvedAssignment = {
      ...ra, startMin: 240, endMin: 840,
      stops: [
        { seq: 1, name: "เช้า 1", mode: "truck", atMin: 240 },
        { seq: 2, name: "เช้า 2", mode: "truck", atMin: 260 },
        { seq: 3, name: "สาย", mode: "truck", atMin: 840 },
      ],
      communityWindows: [],
    };
    // ที่นาที 300 ผ่านมา 10% ของเวลา แต่ผ่านไปแล้ว 2 จุดจาก 3
    // ถ้าใช้สัดส่วนจะได้ index 0 ซึ่งผิด
    expect(getLivePosition(uneven, 300).currentStop?.name).toBe("เช้า 2");
  });

  it("วันหยุดที่ไม่มีเวลา คืน unknown", () => {
    const off = { ...ra, startMin: null, endMin: null, kind: "day_off" as const, stops: [] };
    expect(getLivePosition(off, 300).status).toBe("unknown");
  });

  it("ไม่มี stopTimes เลย ยังบอกสถานะได้", () => {
    const noTimes = { ...ra, stops: ra.stops.map((s) => ({ ...s, atMin: null })) };
    const p = getLivePosition(noTimes, 280);
    expect(p.status).toBe("running");
    expect(p.currentStop).toBeNull();
    expect(p.currentWindow?.communityNames).toEqual(["ชุมชน ข"]);
  });
});
```

- [ ] **Step 2: รันเทสต์เพื่อยืนยันว่าไม่ผ่าน**

Run: `npx vitest run lib/garbage/live.test.ts`
Expected: FAIL — `Failed to resolve import "./live"`

- [ ] **Step 3: เขียน implementation**

```ts
import type { ResolvedAssignment, LivePosition, Minutes } from "@/types/garbage";

/**
 * คำนวณสถานะรถ ณ เวลาหนึ่ง
 * ใช้เวลาจริงของแต่ละจุด (atMin) ไม่ใช้สัดส่วนของช่วงเวลารวม
 * เพราะจุดต่าง ๆ ใช้เวลาไม่เท่ากัน — สาย R5 ใช้ 20 นาทีต่อจุดช่วงเช้า แต่ 2.5 ชั่วโมงช่วงสาย
 */
export function getLivePosition(a: ResolvedAssignment, nowMin: Minutes): LivePosition {
  const empty: LivePosition = {
    status: "unknown", startsInMin: null, currentStop: null, nextStop: null,
    etaNextMin: null, currentWindow: null, progress: 0,
  };

  if (a.startMin == null || a.endMin == null) return empty;

  if (nowMin < a.startMin) {
    return { ...empty, status: "upcoming", startsInMin: a.startMin - nowMin };
  }
  if (nowMin > a.endMin) {
    return { ...empty, status: "finished", progress: 1 };
  }

  const span = a.endMin - a.startMin;
  const progress = span > 0 ? Math.min((nowMin - a.startMin) / span, 1) : 1;

  const timed = a.stops.filter((s) => s.atMin != null);
  let currentStop = null as LivePosition["currentStop"];
  let nextStop = null as LivePosition["nextStop"];

  if (timed.length > 0) {
    // จุดปัจจุบัน = จุดสุดท้ายที่เวลาถึงแล้ว
    for (const s of timed) {
      if ((s.atMin as number) <= nowMin) currentStop = s;
      else if (nextStop === null) nextStop = s;
    }
    // ถ้ายังไม่ถึงจุดแรกเลย ให้จุดแรกเป็นจุดถัดไป
    if (currentStop === null) nextStop = timed[0];
  }

  const currentWindow =
    a.communityWindows.find((w) => nowMin >= w.startMin && nowMin <= w.endMin) ?? null;

  return {
    status: "running",
    startsInMin: null,
    currentStop,
    nextStop,
    etaNextMin: nextStop?.atMin != null ? (nextStop.atMin as number) - nowMin : null,
    currentWindow,
    progress,
  };
}
```

- [ ] **Step 4: รันเทสต์เพื่อยืนยันว่าผ่าน**

Run: `npx vitest run lib/garbage/live.test.ts`
Expected: PASS ทั้ง 7 เคส

- [ ] **Step 5: รันเทสต์ทั้งหมด**

Run: `npm test`
Expected: PASS ทุกไฟล์ ไม่มีเคสตก

- [ ] **Step 6: Commit**

```bash
git add lib/garbage/live.ts lib/garbage/live.test.ts
git commit -m "feat: add live truck position using real stop times"
```

---

## Task 10: API ตารางของวัน

**Files:**
- Create: `pages/api/garbage/schedule.ts`

- [ ] **Step 1: เขียน API route**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { resolveScheduleForDate } from "@/lib/garbage/resolve";
import { todayInBangkok } from "@/lib/garbage/time";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }

  const raw = Array.isArray(req.query.date) ? req.query.date[0] : req.query.date;
  const date = raw ?? todayInBangkok();

  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00+07:00`))) {
    return res.status(400).json({ error: "รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD" });
  }

  try {
    const schedule = await resolveScheduleForDate(date);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json(schedule);
  } catch (err) {
    console.error("[garbage/schedule]", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอ่านข้อมูล" });
  }
}
```

- [ ] **Step 2: ทดสอบวันจันทร์**

Run:
```bash
npm run dev
curl -s "http://localhost:3000/api/garbage/schedule?date=2026-08-10" | npx json -a assignments | head
```
หรือ:
```bash
curl -s "http://localhost:3000/api/garbage/schedule?date=2026-08-10" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('weekday',j.weekday,'| รถ',j.assignments.length,'คัน');j.assignments.forEach(a=>console.log(' รถ',a.truckNumber,a.routeCode,a.startMin,'-',a.endMin,'จุด',a.stops.length))})"
```
Expected: `weekday 1 | รถ 7 คัน` และรถเบอร์ 1 มี 22 จุด

- [ ] **Step 3: ทดสอบวันอังคาร — เคสสับเปลี่ยนสาย**

Run:
```bash
curl -s "http://localhost:3000/api/garbage/schedule?date=2026-08-11" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);j.assignments.forEach(a=>console.log('รถ',a.truckNumber,'รอบ',a.shiftNo,a.kind,a.coverForRouteCode??'',a.label??''))})"
```
Expected: รถ 5 รอบ 1 เป็น `substitute` `R1` `เก็บแทนเบอร์ 1` และรถ 1–4 เป็น `day_off` อยู่ท้ายรายการ

- [ ] **Step 4: ทดสอบ input ผิด**

Run: `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/garbage/schedule?date=abc"`
Expected: `400`

- [ ] **Step 5: Commit**

```bash
git add pages/api/garbage/schedule.ts
git commit -m "feat: add public schedule API endpoint"
```

---

## Task 11: API ค้นหา

**Files:**
- Create: `pages/api/garbage/search.ts`

ประชาชนพิมพ์ชื่อถนนหรือชุมชนของตัวเอง แล้วอยากรู้ว่ารถมาวันไหน เวลาไหน

- [ ] **Step 1: เขียน API route**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { routes as routesCol, assignments as assignmentsCol, trucks as trucksCol } from "@/lib/garbage/db";
import { pickLatestVersions } from "@/lib/garbage/resolve";

const WEEKDAY_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

interface SearchHit {
  matchType: "stop" | "community";
  matchName: string;
  routeCode: string;
  routeName: string;
  weekday: number;
  weekdayName: string;
  truckNumber: number;
  startMin: number | null;
  endMin: number | null;
  atMin: number | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }

  const raw = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
  const q = (raw ?? "").trim();
  if (q.length < 2) return res.status(400).json({ error: "ต้องพิมพ์อย่างน้อย 2 ตัวอักษร" });

  // ตัดคำนำหน้าและช่องว่างออกเพื่อให้ "ถ.มาลัย" ค้นเจอ "มาลัย" และกลับกัน
  const norm = (s: string) =>
    s.normalize("NFC").replace(/^(ถนน|ถ\.\s*|ซอย|ซ\.\s*|ชุมชน)\s*/u, "").replace(/\s/gu, "").toLowerCase();
  const needle = norm(q);

  try {
    const [rCol, aCol, tCol] = await Promise.all([routesCol(), assignmentsCol(), trucksCol()]);
    const now = new Date();
    const [allRoutes, rawAssignments] = await Promise.all([
      rCol.find({ active: true }).toArray(),
      aCol.find({
        effectiveFrom: { $lte: now },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gte: now } }],
      }).toArray(),
    ]);
    await tCol.estimatedDocumentCount(); // ยืนยันว่าเชื่อม db ได้

    // จัดกลุ่ม assignment ตามวัน แล้วเลือกเวอร์ชันล่าสุดของแต่ละวัน
    const byWeekday = new Map<number, typeof rawAssignments>();
    for (const a of rawAssignments) {
      const list = byWeekday.get(a.weekday) ?? [];
      list.push(a);
      byWeekday.set(a.weekday, list);
    }

    const hits: SearchHit[] = [];
    for (const [weekday, list] of byWeekday) {
      for (const a of pickLatestVersions(list)) {
        if (!a.routeCode) continue;
        const route = allRoutes.find((r) => r.code === a.routeCode);
        if (!route) continue;

        const timeBySeq = new Map(a.stopTimes.map((s) => [s.seq, s.atMin]));
        for (const s of route.stops) {
          if (!norm(s.name).includes(needle)) continue;
          hits.push({
            matchType: "stop", matchName: s.name,
            routeCode: route.code, routeName: route.name,
            weekday, weekdayName: WEEKDAY_TH[weekday],
            truckNumber: a.truckNumber,
            startMin: a.startMin, endMin: a.endMin,
            atMin: timeBySeq.get(s.seq) ?? null,
          });
        }
        for (const w of a.communityWindows) {
          for (const name of w.communityNames) {
            if (!norm(name).includes(needle)) continue;
            hits.push({
              matchType: "community", matchName: name,
              routeCode: route.code, routeName: route.name,
              weekday, weekdayName: WEEKDAY_TH[weekday],
              truckNumber: a.truckNumber,
              startMin: w.startMin, endMin: w.endMin, atMin: null,
            });
          }
        }
      }
    }

    hits.sort((x, y) => x.weekday - y.weekday || (x.startMin ?? 0) - (y.startMin ?? 0));

    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ query: q, count: hits.length, hits: hits.slice(0, 100) });
  } catch (err) {
    console.error("[garbage/search]", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการค้นหา" });
  }
}
```

- [ ] **Step 2: ทดสอบค้นหาชุมชน**

Run:
```bash
curl -s "http://localhost:3000/api/garbage/search?q=มาลัย" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('พบ',j.count);j.hits.slice(0,5).forEach(h=>console.log(' ',h.weekdayName,h.matchType,h.matchName,'รถ',h.truckNumber,h.startMin,'-',h.endMin))})"
```
Expected: พบทั้งจุดเก็บ `ถ.มาลัย` และชุมชน `ชุมชนมาลัย` ในวันจันทร์

- [ ] **Step 3: ทดสอบว่าคำนำหน้าไม่ทำให้ค้นไม่เจอ**

Run:
```bash
curl -s "http://localhost:3000/api/garbage/search?q=ถ.มาลัย" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('count',JSON.parse(s).count))"
curl -s "http://localhost:3000/api/garbage/search?q=ชุมชนมาลัย" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('count',JSON.parse(s).count))"
```
Expected: ทั้งสองคำสั่งได้ count มากกว่า 0

- [ ] **Step 4: ทดสอบ input สั้นเกินไป**

Run: `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/garbage/search?q=ก"`
Expected: `400`

- [ ] **Step 5: Commit**

```bash
git add pages/api/garbage/search.ts
git commit -m "feat: add public search API for stops and communities"
```

---

## Task 12: API สถานะสด

**Files:**
- Create: `pages/api/garbage/live.ts`

- [ ] **Step 1: เขียน API route**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { resolveScheduleForDate } from "@/lib/garbage/resolve";
import { getLivePosition } from "@/lib/garbage/live";
import { todayInBangkok, minutesNowInBangkok } from "@/lib/garbage/time";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }

  // ?at=<นาที> ใช้สำหรับทดสอบเท่านั้น ไม่ระบุ = เวลาปัจจุบันของไทย
  const rawAt = Array.isArray(req.query.at) ? req.query.at[0] : req.query.at;
  let nowMin = minutesNowInBangkok();
  if (rawAt != null) {
    const n = Number(rawAt);
    if (!Number.isInteger(n) || n < 0 || n > 1439) {
      return res.status(400).json({ error: "at ต้องเป็นจำนวนเต็ม 0–1439" });
    }
    nowMin = n;
  }

  const rawDate = Array.isArray(req.query.date) ? req.query.date[0] : req.query.date;
  const date = rawDate ?? todayInBangkok();

  try {
    const schedule = await resolveScheduleForDate(date);
    const trucks = schedule.assignments.map((a) => ({
      truckNumber: a.truckNumber,
      truckColor: a.truckColor,
      shiftNo: a.shiftNo,
      kind: a.kind,
      routeCode: a.routeCode,
      label: a.label,
      live: getLivePosition(a, nowMin),
    }));

    // สถานะสดต้องไม่ถูกแคชนาน
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({ date, nowMin, trucks });
  } catch (err) {
    console.error("[garbage/live]", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอ่านข้อมูล" });
  }
}
```

- [ ] **Step 2: ทดสอบเวลา 6.00 น. ของวันจันทร์**

Run:
```bash
curl -s "http://localhost:3000/api/garbage/live?date=2026-08-10&at=360" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);j.trucks.forEach(t=>console.log('รถ',t.truckNumber,t.live.status,t.live.currentStop?.name??'-','→',t.live.nextStop?.name??'-'))})"
```
Expected: รถทุกคันเป็น `running` และแต่ละคันมีชื่อจุดปัจจุบันที่สมเหตุสมผล

- [ ] **Step 3: ทดสอบบั๊กเที่ยง — เวลา 13.00 น.**

Run:
```bash
curl -s "http://localhost:3000/api/garbage/live?date=2026-08-10&at=780" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const t5=j.trucks.find(x=>x.truckNumber===5);console.log('รถ 5:',t5.live.status,t5.live.currentStop?.name)})"
```
Expected: `รถ 5: running` — สาย R5 วิ่งถึง 13.30 น. ถ้าได้ `finished` แสดงว่ามีบั๊กการแปลงเวลา

- [ ] **Step 4: ทดสอบวันอังคารเวลา 20.00 น. — รอบพิเศษ**

Run:
```bash
curl -s "http://localhost:3000/api/garbage/live?date=2026-08-11&at=1200" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);j.trucks.filter(t=>t.kind==='special').forEach(t=>console.log('รถ',t.truckNumber,t.label,t.live.status))})"
```
Expected: `รถ 7 วันตลาดนัดพิเศษ running`

- [ ] **Step 5: ทดสอบ input ผิด**

Run: `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/garbage/live?at=9999"`
Expected: `400`

- [ ] **Step 6: รันเทสต์ทั้งหมดและตรวจ type**

Run:
```bash
npm test && npx tsc --noEmit && npm run build
```
Expected: เทสต์ผ่านทั้งหมด ไม่มี type error และ build สำเร็จ

- [ ] **Step 7: Commit**

```bash
git add pages/api/garbage/live.ts
git commit -m "feat: add live truck status API endpoint"
```

---

## เกณฑ์ยืนยันว่า M1–M3 เสร็จ

- [ ] `parseThaiTime("12:00 น.")` คืน `720` ไม่ใช่ `0`
- [ ] `formatThaiTime(1200)` คืน `"20.00 น."`
- [ ] `npm test` ผ่านทุกเคส
- [ ] `npx tsc --noEmit` ไม่มี error
- [ ] `npm run build` สำเร็จ
- [ ] รัน `scripts/seed-garbage.mjs` สองครั้งติดกัน ครั้งที่สอง `upsertedCount` เป็น 0 ทั้งหมด
- [ ] `GET /api/garbage/schedule?date=<วันจันทร์>` คืนรถ 7 คัน สาย R1 มี 22 จุด
- [ ] `GET /api/garbage/schedule?date=<วันอังคาร>` แสดงรถ 5 เป็น `substitute` ของ `R1` และรถ 1–4 เป็น `day_off`
- [ ] `GET /api/garbage/search?q=มาลัย` และ `?q=ถ.มาลัย` ได้ผลลัพธ์ทั้งคู่
- [ ] `GET /api/garbage/live?date=<วันจันทร์>&at=780` แสดงรถ 5 เป็น `running`
- [ ] `GET /api/garbage/live?date=<วันอังคาร>&at=1200` แสดงรอบพิเศษของรถ 7
- [ ] ไม่มีไฟล์ component ใด ๆ อยู่ใต้ `pages/` (ยกเว้น API routes)

---

## สิ่งที่ยังไม่ทำในแผนนี้

M4 หน้าจอประชาชน · M5 หลังบ้านพร้อม Clerk และ audit log · M6 เชื่อมชั้นข้อมูลถนนและ POI · M7 export โปสเตอร์

เมื่อ M3 เสร็จ ให้เขียนแผน M4–M5 ใหม่บนสิ่งที่เรียนรู้จากการทำ M1–M3 อย่าเขียนล่วงหน้าตอนนี้

## งานคู่ขนานที่ไม่บล็อกการเขียนโค้ด

1. ขอตารางวันพุธ–อาทิตย์จากกองสาธารณสุข (บล็อกความสมบูรณ์ของข้อมูล ไม่บล็อกโค้ด)
2. ให้กองสาธารณสุขตรวจทานชื่อจุดเก็บของสาย R5–R7 ในไฟล์ seed — ปัจจุบันอ่านมาจากโปสเตอร์ ยังไม่ได้รับรอง
3. ตรวจว่าเทศบาลมีขอบเขตชุมชนเป็น polygon หรือไม่ (บล็อกแค่ M6)
4. ตรวจสอบช่วงเวลาชุมชนของสาย R5 วันจันทร์ที่ทับกัน — ตาคลีพัฒนา 4.20–5.50 น. กับ ตาคลีใหญ่ 5.20–12.30 น. ซ้อนกัน 30 นาที ต้องยืนยันว่าเป็นความตั้งใจหรือพิมพ์ผิดในโปสเตอร์
