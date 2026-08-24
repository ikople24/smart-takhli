# Smart Water — ทะเบียนท่อประปา (เฟส 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างโมดูล `smart-water` — ทะเบียนท่อประปาและอุปกรณ์ของเทศบาลเมืองตาคลี ที่คำนวณความยาวอัตโนมัติจาก geometry แยกชนิด/ขนาดท่อตามรหัส A/G/H/P/S/R แสดงบนแผนที่ admin และออกรายงานสรุปความยาวแยกตามชนิด-ขนาด-ถนน-ปี-สถานะ

**Architecture:** MongoDB 2 collections — `water_pipes` (LineString) และ `water_nodes` (Point สำหรับวาล์ว/หัวดับเพลิง/จุดจ่าย/end cap/มาตรวัด) เขียนผ่าน service layer เดียว (`lib/smart-water/service.ts`) ที่ derive `code`, `diameterMm`, `lengthM` อัตโนมัติ — **ห้าม API route เขียน DB ตรง** ใช้ native MongoDB driver ตามแบบโมดูล garbage โดยสกัด `getDb()` เป็นไฟล์กลาง `lib/mongoNative.ts` แชร์กันสองโมดูล (ไม่เปิด client ตัวที่สาม) ความยาวคำนวณโดย project พิกัด WGS84 → UTM zone 47N (EPSG:32647) หน้าเป็น admin ล้วน (`/admin/smart-water`) ครอบ `PermissionGuard` + API ตรวจสิทธิ์ด้วย pattern `_auth.ts` แบบเดียวกับ garbage แผนที่ใช้ **react-leaflet v5** (ติดตั้งและใช้ทั่ว repo กับ React 19 อยู่แล้ว) + `BaseLayersControl` กลาง

**Tech Stack:** Next.js 15 (Pages Router), TypeScript, MongoDB native driver, Zod (มีแล้ว), proj4 (ติดตั้งใหม่), react-leaflet 5 (มีแล้ว), Clerk, Vitest (config มีแล้ว — เทสต์ colocate ใน `lib/smart-water/*.test.ts`)

---

## ⚠️ ข้อสมมติที่ต้องยืนยัน (แก้ได้ทีหลังโดยไม่รื้อโครง)

| # | ข้อสมมติ | ค่า/ที่ที่ต้องแก้ถ้าไม่ตรง |
|---|---|---|
| 1 | **พิกัดใน seed เป็นค่าสมมติ**รอบพื้นที่ตาคลี (~15.26°N, 100.35°E) ไม่ใช่แนวท่อจริง | `scripts/seed-water.ts` — ทับด้วยข้อมูลจริงหลัง import PDF (ดูภาคผนวก ข) |
| 2 | หัวดับเพลิงยังไม่มีเลขทะเบียนเดิม → `hydrantNo` เป็น optional | `lib/smart-water/schemas.ts` |
| 3 | เฟส 1 ไม่มีเรื่องวัดความดัน/อัตราไหล (อยู่เฟส 2) | — |
| 4 | หน้านี้**ไม่อยู่ใน DEFAULT_PERMISSIONS** — superadmin ติ๊กสิทธิ์รายคน (ตามนโยบายใน `lib/permissions.ts` — เครื่องมือเฉพาะกองการประปา ไม่ใช่ชุดพื้นฐานทุก admin) | Task 12 — ถ้าอยากให้ admin ทุกคนเห็น ค่อยเพิ่มใน `DEFAULT_PERMISSIONS.admin` |
| 5 | ป้ายเมนู/หน้า = "ทะเบียนท่อประปา" ไอคอน 🚰 หมวด `management` กลุ่มเมนู `จัดการ` | `lib/permissions.ts`, `components/LayoutAdmin.tsx` |

**ห้ามเอาตัวเลขจากข้อมูล seed ไปใส่รายงานจริง** — เป็นข้อมูลทดสอบล้วน

---

## File Structure

```
lib/mongoNative.ts                 # (ใหม่ กลาง) getDb() native driver — สกัดจาก lib/garbage/db.ts
lib/garbage/db.ts                  # (แก้) delegate getDb ไปที่ lib/mongoNative.ts — export เดิมครบ

lib/smart-water/
  constants.ts                     # PIPE_MATERIALS, NODE_TYPES, PIPE_STATUSES
  pipe-code.ts   + pipe-code.test.ts   # parsePipeCode / buildPipeCode / toMm
  geo.ts         + geo.test.ts         # computeLengthM (UTM 47N), projectToUTM, bboxOf
  schemas.ts                       # Zod: PipeInput, NodeInput
  db.ts                            # collection helpers: pipes(), nodes(), ensureWaterIndexes()
  service.ts     + service.test.ts     # savePipe/saveNode/list*/softDelete* + derivePipeFields (pure)
  reports.ts     + reports.test.ts     # buildLengthPipeline (pure) + runLengthReport
  api-helpers.ts                   # parseBBox, str, toFeatureCollection

pages/api/smart-water/
  _auth.ts                         # requireSmartWaterAdmin — template จาก pages/api/garbage/_auth.ts
  pipes/index.ts                   # GET (bbox/filter/geojson) / POST
  pipes/[id].ts                    # GET / PATCH / DELETE (soft)
  nodes/index.ts                   # GET / POST
  nodes/[id].ts                    # GET / PATCH / DELETE (soft)
  reports/length.ts                # GET รายงานความยาว

pages/admin/smart-water/
  index.jsx                        # หน้าแผนที่ (PermissionGuard, dynamic import map)
  report.jsx                       # หน้ารายงาน (PermissionGuard requiredPath="/admin/smart-water")

components/smart-water/
  WaterMap.js                      # react-leaflet (โหลดผ่าน dynamic ssr:false เท่านั้น)
  PipeLegend.js                    # legend สีตามชนิดท่อ + สัญลักษณ์อุปกรณ์

scripts/
  seed-water.ts                    # seed ข้อมูลทดสอบ + สร้าง index (idempotent, ลบเฉพาะของ seed เดิม)
  grant-smart-water-permission.js  # ให้สิทธิ์ user ที่มี custom allowedPages (template smart-light)

docs/modules/smart-water.md        # เอกสารโมดูล (บังคับ)
```

**หลักการ:** `lib/smart-water/*` เป็น pure function ทั้งหมดยกเว้น `db.ts`/`service.ts`/`reports.ts` ส่วนที่แตะ DB — เทสต์ครอบเฉพาะส่วน pure (ตาม convention เทสต์ของ repo: logic ล้วน ไม่ต่อ Mongo) API route ทำหน้าที่แค่ auth + parse query + เรียก service **ห้ามมี business logic**

---

### Task 1: ติดตั้ง dependency + ยืนยัน baseline

**Files:**
- Modify: `package.json` (ผ่าน npm install เท่านั้น — **ห้าม**เพิ่ม script `test`/`test:watch` เพราะมีอยู่แล้ว และ**ห้าม**สร้าง vitest config ใหม่ — `vitest.config.mjs` มีอยู่แล้วและ include `lib/**/*.test.ts`)

- [ ] **Step 1: ยืนยันว่าเทสต์เดิมผ่านก่อนแตะอะไร**

Run: `npm test`
Expected: PASS ทั้งหมด (เทสต์เดิมของ lib/garbage และ lib/smart-light) — จดจำนวนไว้เทียบตอนจบ

- [ ] **Step 2: ติดตั้ง package ที่ขาด**

```bash
npm install proj4
npm install -D @types/proj4 tsx
```

หมายเหตุ: `leaflet`, `react-leaflet`, `@types/leaflet`, `zod`, `vitest`, `mongodb`, `dotenv` มีครบแล้ว — ห้ามติดตั้งซ้ำ
`tsx` ใช้รัน script `.ts` ด้วย `node --env-file=.env.local --import tsx scripts/<file>.ts` (node v23 ของเครื่องนี้รองรับ `--import`; tsx resolve path alias `@/*` จาก tsconfig ให้เอง)

- [ ] **Step 3: ยืนยัน type check ผ่าน**

Run: `npx tsc --noEmit`
Expected: exit 0 ไม่มี error (baseline ปัจจุบันสะอาด)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(smart-water): add proj4 + tsx for pipe registry module"
```

---

### Task 2: สกัด getDb() เป็นไฟล์กลาง lib/mongoNative.ts

**เหตุผล:** `lib/garbage/db.ts` มี native-driver `getDb()` อยู่แล้ว smart-water ต้องใช้เหมือนกัน — กติกาโมดูลห้าม copy ฟังก์ชันข้ามโมดูลและห้ามโมดูลหนึ่ง import จาก lib ของอีกโมดูล ให้สกัดเป็นไฟล์กลาง ทั้งสองโมดูลจึงแชร์ client/pool เดียว (ยังคงเป็น "client ตัวที่สองข้าง ๆ mongoose" ไม่ใช่ตัวที่สาม)

**Files:**
- Create: `lib/mongoNative.ts`
- Modify: `lib/garbage/db.ts` (เฉพาะส่วน getDb — export เดิมต้องครบทุกตัว)

- [ ] **Step 1: สร้าง lib/mongoNative.ts**

```ts
import { MongoClient, type Db } from "mongodb";

// native MongoDB client กลาง — แชร์ระหว่างโมดูลที่ไม่ใช้ mongoose (garbage, smart-water)
// ใช้ global cache เพื่อไม่ให้ hot reload ของ Next.js เปิด connection ใหม่ทุกครั้ง
const globalForMongo = globalThis as unknown as { _nativeMongo?: Promise<MongoClient> };

/** เชื่อมต่อแบบ lazy — ห้าม throw ตอน import เพราะไฟล์นี้ถูก import โดยเทสต์และ build */
export async function getDb(): Promise<Db> {
  if (!globalForMongo._nativeMongo) {
    // ใช้ MONGO_URI ตัวเดียวตามมาตรฐาน repo (ไม่มี fallback — กันสภาพแอปครึ่งใบที่ mongoose ล่มแต่โมดูลนี้รอด)
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("ต้องตั้งค่า MONGO_URI");
    // จำกัด pool ให้เล็กเพราะเป็น client ตัวที่สองข้าง ๆ mongoose — default 100/30s กว้างเกินไป
    globalForMongo._nativeMongo = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    })
      .connect()
      .catch((err) => {
        // ลบ cache เมื่อ connect ล้ม — ไม่งั้น promise ที่ reject ค้างตลอดชีวิต process = 500 ถาวร
        delete globalForMongo._nativeMongo;
        throw err;
      });
  }
  const client = await globalForMongo._nativeMongo;
  // ใช้ db ตาม URI เพื่อให้ตรงกับฝั่ง mongoose; MONGODB_DB มีไว้ override ตอนเทส/สคริปต์เท่านั้น
  return client.db(process.env.MONGODB_DB || undefined);
}
```

- [ ] **Step 2: แก้ lib/garbage/db.ts ให้ delegate**

แทนที่ **ส่วนหัวไฟล์ถึงจบฟังก์ชัน getDb เดิม** (บรรทัด `import { MongoClient, ... }` จนถึงปีกกาปิดของ `getDb`) ด้วย:

```ts
import type { Collection } from "mongodb";
import { getDb } from "@/lib/mongoNative";
import type { Truck, Route, Community, Assignment, GarbageSettings } from "@/types/garbage";

// getDb ย้ายไปเป็นไฟล์กลาง lib/mongoNative.ts (แชร์กับโมดูล smart-water)
// re-export เพื่อไม่ให้ import เดิมทั้ง repo ต้องแก้
export { getDb };
```

ส่วนที่เหลือของไฟล์ (collection helpers `trucks()/routes()/...` และ `ensureIndexes()`) **ไม่แตะ**

- [ ] **Step 3: ยืนยันว่าไม่มีอะไรพัง**

Run: `npx tsc --noEmit && npm test`
Expected: tsc exit 0, เทสต์ผ่านเท่าจำนวนเดิมจาก Task 1

- [ ] **Step 4: Commit**

```bash
git add lib/mongoNative.ts lib/garbage/db.ts
git commit -m "refactor(db): extract shared native-driver getDb to lib/mongoNative"
```

---

### Task 3: ตาราง constants ชนิดท่อและอุปกรณ์

**Files:**
- Create: `lib/smart-water/constants.ts`

- [ ] **Step 1: สร้างไฟล์ constants**

```ts
/**
 * ตารางชนิดท่อตามสัญลักษณ์ในแบบแปลนเทศบาลเมืองตาคลี
 * unit ต่างกันตามชนิด — ห้ามสมมติว่าเป็นนิ้วทั้งหมด
 * basis: RCP ระบุเป็น ศก.ภายใน ที่เหลือเป็นขนาดระบุ (nominal)
 * หมายเหตุ: ไม่มีฟิลด์สีที่นี่ — สีในแบบจริงผูกกับ "รหัส" (ขนาด) ไม่ใช่ชนิด ดู CODE_COLORS ท้ายไฟล์
 */
export const PIPE_MATERIALS = {
  A: { code: 'AC',   nameTh: 'ท่อซีเมนต์ใยหิน',    unit: 'inch', basis: 'nominal' },
  G: { code: 'GS',   nameTh: 'ท่อเหล็กชุบสังกะสี',  unit: 'inch', basis: 'nominal' },
  H: { code: 'HDPE', nameTh: 'ท่อ HDPE',           unit: 'mm',   basis: 'nominal' },
  P: { code: 'PVC',  nameTh: 'ท่อ PVC',            unit: 'inch', basis: 'nominal' },
  S: { code: 'SP',   nameTh: 'ท่อเหล็กเหนียว',      unit: 'mm',   basis: 'nominal' },
  R: { code: 'RCP',  nameTh: 'ท่อระบายคอนกรีต',     unit: 'cm',   basis: 'internal' },
} as const;

export type MaterialLetter = keyof typeof PIPE_MATERIALS;
export type MaterialCode = (typeof PIPE_MATERIALS)[MaterialLetter]['code'];
export type DiameterUnit = 'inch' | 'mm' | 'cm';

export const NODE_TYPES = {
  gate_valve:  { nameTh: 'ประตูน้ำลิ้นแบบเปิด' },
  hydrant:     { nameTh: 'หัวดับเพลิง / ท่อธาร' },
  tap:         { nameTh: 'จุดจ่อ' },
  end_cap:     { nameTh: 'END CAP' },
  water_meter: { nameTh: 'มาตรวัดน้ำ' },
  blow_off:    { nameTh: 'จุดระบายตะกอน' },
} as const;

export type NodeType = keyof typeof NODE_TYPES;

export const PIPE_STATUSES = ['existing', 'new', 'abandoned', 'planned'] as const;
export type PipeStatus = (typeof PIPE_STATUSES)[number];

/**
 * สีตามรหัสท่อ อ่านจากแบบร่าง 2568 เพื่อให้ตรงกับที่กองการประปาคุ้นเคย
 * สีในแบบผูกกับ "รหัส" (ชนิด+ขนาด) ไม่ใช่ชนิดวัสดุ — ห้ามระบายสีตาม material
 * (สีแดงถูกใช้ซ้ำ 3 รหัส: P1.5 / P6 / A4 — AutoCAD ใช้ layer color ไม่ได้เป๊ะตามขนาด
 *  แยกกันบนแผนที่ด้วยความหนาเส้นตาม diameterMm แทน)
 * รหัสที่ไม่อยู่ในแบบ (เช่น S400, H110, R30) ใช้ FALLBACK_COLOR
 */
export const CODE_COLORS: Record<string, string> = {
  P1: '#00BFFF', 'P1.5': '#FF0000', P2: '#DD3700', P4: '#00FF00',
  P6: '#FF0000', P8: '#00FFFF', P10: '#FF7FBF', P16: '#FF00FF',
  A12: '#FF7F00', A4: '#FF0000',
};
export const FALLBACK_COLOR = '#666666';
```

- [ ] **Step 2: ยืนยันว่า compile ผ่าน**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add lib/smart-water/constants.ts
git commit -m "feat(smart-water): add pipe material constants and drawing code colors"
```

---

### Task 4: parse / build รหัสท่อ

**Files:**
- Create: `lib/smart-water/pipe-code.ts`
- Test: `lib/smart-water/pipe-code.test.ts` (colocate ตาม convention — vitest.config.mjs include `lib/**/*.test.ts` อยู่แล้ว)

- [ ] **Step 1: เขียน failing test**

Create `lib/smart-water/pipe-code.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parsePipeCode, buildPipeCode, toMm } from './pipe-code';

describe('parsePipeCode', () => {
  it('แปลง P4 เป็น PVC 4 นิ้ว', () => {
    const r = parsePipeCode('P4');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.material).toBe('PVC');
    expect(r.diameter).toEqual({ value: 4, unit: 'inch' });
    expect(r.diameterMm).toBe(101.6);
    expect(r.diameterBasis).toBe('nominal');
  });

  it('แปลง S400 เป็น SP 400 มม.', () => {
    const r = parsePipeCode('S400');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.material).toBe('SP');
    expect(r.diameter).toEqual({ value: 400, unit: 'mm' });
    expect(r.diameterMm).toBe(400);
  });

  it('แปลง R30 เป็น RCP 30 ซม. และเป็นขนาดภายใน', () => {
    const r = parsePipeCode('R30');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.material).toBe('RCP');
    expect(r.diameterMm).toBe(300);
    expect(r.diameterBasis).toBe('internal');
  });

  it('รับตัวพิมพ์เล็กและช่องว่าง', () => {
    const r = parsePipeCode('  a12 ');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.material).toBe('AC');
    expect(r.diameter.value).toBe(12);
  });

  it('รับทศนิยม เช่น G1.5', () => {
    const r = parsePipeCode('G1.5');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.diameter.value).toBe(1.5);
  });

  it('ปฏิเสธตัวอักษรที่ไม่รู้จัก', () => {
    expect(parsePipeCode('X4').ok).toBe(false);
  });

  it('ปฏิเสธรหัสที่ไม่มีตัวเลข', () => {
    expect(parsePipeCode('P').ok).toBe(false);
  });

  it('ปฏิเสธค่าว่าง', () => {
    expect(parsePipeCode('').ok).toBe(false);
  });
});

describe('buildPipeCode', () => {
  it('สร้าง P4 จาก PVC 4', () => {
    expect(buildPipeCode('PVC', 4)).toBe('P4');
  });

  it('สร้าง S400 จาก SP 400', () => {
    expect(buildPipeCode('SP', 400)).toBe('S400');
  });

  it('ตัด .0 ออกจากจำนวนเต็ม', () => {
    expect(buildPipeCode('PVC', 6.0)).toBe('P6');
  });

  it('คงทศนิยมไว้ถ้ามีจริง', () => {
    expect(buildPipeCode('GS', 1.5)).toBe('G1.5');
  });

  it('round-trip: parse แล้ว build ต้องได้ค่าเดิม', () => {
    for (const code of ['A6', 'G2', 'H110', 'P4', 'S400', 'R30']) {
      const r = parsePipeCode(code);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(buildPipeCode(r.material, r.diameter.value)).toBe(code);
    }
  });
});

describe('toMm', () => {
  it('นิ้ว → มม.', () => expect(toMm(6, 'inch')).toBe(152.4));
  it('ซม. → มม.', () => expect(toMm(30, 'cm')).toBe(300));
  it('มม. → มม.', () => expect(toMm(110, 'mm')).toBe(110));
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npx vitest run lib/smart-water/pipe-code.test.ts`
Expected: FAIL — `Failed to resolve import "./pipe-code"`

- [ ] **Step 3: เขียน implementation**

Create `lib/smart-water/pipe-code.ts`:

```ts
import {
  PIPE_MATERIALS,
  type MaterialLetter,
  type MaterialCode,
  type DiameterUnit,
} from './constants';

const CODE_RE = /^([AGHPSR])(\d+(?:\.\d+)?)$/;

export type ParseResult =
  | {
      ok: true;
      material: MaterialCode;
      diameter: { value: number; unit: DiameterUnit };
      diameterMm: number;
      diameterBasis: 'nominal' | 'internal';
    }
  | { ok: false; error: string };

export function toMm(value: number, unit: DiameterUnit): number {
  if (unit === 'inch') return Number((value * 25.4).toFixed(1));
  if (unit === 'cm') return value * 10;
  return value;
}

export function parsePipeCode(raw: string): ParseResult {
  const m = CODE_RE.exec(String(raw ?? '').trim().toUpperCase());
  if (!m) return { ok: false, error: `รหัสท่อไม่ถูกต้อง: "${raw}"` };

  const spec = PIPE_MATERIALS[m[1] as MaterialLetter];
  const value = Number(m[2]);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: `ขนาดท่อไม่ถูกต้อง: "${raw}"` };
  }

  return {
    ok: true,
    material: spec.code,
    diameter: { value, unit: spec.unit },
    diameterMm: toMm(value, spec.unit),
    diameterBasis: spec.basis,
  };
}

export function buildPipeCode(material: MaterialCode, value: number): string {
  const entry = Object.entries(PIPE_MATERIALS).find(
    ([, v]) => v.code === material
  );
  if (!entry) throw new Error(`ไม่รู้จักชนิดท่อ: ${material}`);
  // String(6.0) === "6" อยู่แล้ว จึงไม่ต้องแยกกรณีจำนวนเต็ม
  return `${entry[0]}${String(value)}`;
}

export function materialSpec(material: MaterialCode) {
  const entry = Object.values(PIPE_MATERIALS).find((v) => v.code === material);
  if (!entry) throw new Error(`ไม่รู้จักชนิดท่อ: ${material}`);
  return entry;
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run lib/smart-water/pipe-code.test.ts`
Expected: PASS ทั้ง 16 test

- [ ] **Step 5: Commit**

```bash
git add lib/smart-water/pipe-code.ts lib/smart-water/pipe-code.test.ts
git commit -m "feat(smart-water): add pipe code parser and builder with tests"
```

---

### Task 5: คำนวณความยาวท่อบน UTM zone 47N

**Files:**
- Create: `lib/smart-water/geo.ts`
- Test: `lib/smart-water/geo.test.ts`

- [ ] **Step 1: เขียน failing test**

Create `lib/smart-water/geo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeLengthM, projectToUTM } from './geo';

describe('computeLengthM', () => {
  it('เส้นแนวตะวันออก-ตก 0.01 องศา ที่ตาคลี ≈ 1074 ม.', () => {
    // 111320 * cos(15.26°) * 0.01 ≈ 1074 ม.
    const len = computeLengthM([
      [100.3500, 15.2600],
      [100.3600, 15.2600],
    ]);
    expect(len).toBeGreaterThan(1060);
    expect(len).toBeLessThan(1085);
  });

  it('เส้นตรงแนวเหนือ-ใต้ 0.01 องศา ≈ 1106 ม.', () => {
    const len = computeLengthM([
      [100.3500, 15.2600],
      [100.3500, 15.2700],
    ]);
    expect(len).toBeGreaterThan(1095);
    expect(len).toBeLessThan(1120);
  });

  it('รวมความยาวหลาย segment', () => {
    const a = computeLengthM([[100.35, 15.26], [100.36, 15.26]]);
    const b = computeLengthM([[100.36, 15.26], [100.36, 15.27]]);
    const both = computeLengthM([
      [100.35, 15.26],
      [100.36, 15.26],
      [100.36, 15.27],
    ]);
    expect(both).toBeCloseTo(a + b, 1);
  });

  it('จุดเดียวได้ 0', () => {
    expect(computeLengthM([[100.35, 15.26]])).toBe(0);
  });

  it('array ว่างได้ 0', () => {
    expect(computeLengthM([])).toBe(0);
  });

  it('ปัดเป็น 2 ตำแหน่ง', () => {
    const len = computeLengthM([[100.35, 15.26], [100.36, 15.27]]);
    expect(Number(len.toFixed(2))).toBe(len);
  });
});

describe('projectToUTM', () => {
  it('ตาคลีอยู่ในโซน 47N → easting ประมาณ 6.4 แสน', () => {
    const [x, y] = projectToUTM([100.35, 15.26]);
    expect(x).toBeGreaterThan(600000);
    expect(x).toBeLessThan(700000);
    expect(y).toBeGreaterThan(1600000);
    expect(y).toBeLessThan(1720000);
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npx vitest run lib/smart-water/geo.test.ts`
Expected: FAIL — resolve import ไม่ได้

- [ ] **Step 3: เขียน implementation**

Create `lib/smart-water/geo.ts`:

```ts
import proj4 from 'proj4';

/**
 * เทศบาลเมืองตาคลีอยู่ใน UTM zone 47N
 * คำนวณระยะบนพิกัดฉาก คลาดเคลื่อนจาก scale factor ~0.04%
 * ดีกว่าคิดระยะบนองศาโดยตรงซึ่งบิดมาก
 */
proj4.defs(
  'EPSG:32647',
  '+proj=utm +zone=47 +datum=WGS84 +units=m +no_defs'
);

const converter = proj4('EPSG:4326', 'EPSG:32647');

export type LngLat = [number, number];

export function projectToUTM(coord: LngLat): [number, number] {
  const r = converter.forward(coord);
  return [r[0], r[1]];
}

/**
 * ความยาวราบของเส้น หน่วยเมตร
 * หมายเหตุ: นี่คือระยะบนแผนที่ ไม่ใช่ความยาวท่อจริง
 * ท่อจริงมีข้องอและความลึกเปลี่ยน มักยาวกว่า 2-5%
 */
export function computeLengthM(coords: LngLat[]): number {
  if (!Array.isArray(coords) || coords.length < 2) return 0;
  const pts = coords.map(projectToUTM);
  let sum = 0;
  for (let i = 1; i < pts.length; i++) {
    sum += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return Number(sum.toFixed(2));
}

/** bounding box [west, south, east, north] จาก coordinates */
export function bboxOf(coords: LngLat[]): [number, number, number, number] {
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run lib/smart-water/geo.test.ts`
Expected: PASS ทั้ง 7 test

- [ ] **Step 5: Commit**

```bash
git add lib/smart-water/geo.ts lib/smart-water/geo.test.ts
git commit -m "feat(smart-water): add UTM 47N length calculation"
```

---

### Task 6: Zod schemas

**Files:**
- Create: `lib/smart-water/schemas.ts`

- [ ] **Step 1: สร้าง Zod schema**

```ts
import { z } from 'zod';
import { PIPE_STATUSES, NODE_TYPES } from './constants';

const lngLat = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

export const LineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(lngLat).min(2, 'ต้องมีอย่างน้อย 2 จุด'),
});

export const PointSchema = z.object({
  type: z.literal('Point'),
  coordinates: lngLat,
});

export const PipeInputSchema = z.object({
  _id: z.string().optional(),
  material: z.enum(['AC', 'GS', 'HDPE', 'PVC', 'SP', 'RCP']),
  diameter: z.object({
    value: z.number().positive('ขนาดท่อต้องมากกว่า 0'),
    unit: z.enum(['inch', 'mm', 'cm']),
  }),
  status: z.enum(PIPE_STATUSES).default('existing'),
  roadName: z.string().trim().max(200).optional(),
  zone: z.string().trim().max(100).optional(),
  installedYear: z.number().int().min(2400).max(2700).optional(),
  ownership: z.enum(['municipality', 'pwa', 'private']).default('municipality'),
  geometry: LineStringSchema,
  surveyedLengthM: z.number().positive().optional(),
  lengthSource: z.enum(['computed', 'surveyed', 'as-built']).default('computed'),
  sourceDoc: z
    .object({
      pdfName: z.string().optional(),
      page: z.number().int().optional(),
      confidence: z.enum(['high', 'medium', 'low']).default('low'),
    })
    .optional(),
  note: z.string().max(1000).optional(),
});

export const NodeInputSchema = z.object({
  _id: z.string().optional(),
  type: z.enum(
    Object.keys(NODE_TYPES) as [keyof typeof NODE_TYPES, ...Array<keyof typeof NODE_TYPES>]
  ),
  geometry: PointSchema,
  onPipeId: z.string().optional(),
  hydrantNo: z.string().trim().max(50).optional(),
  size: z.string().trim().max(50).optional(),
  condition: z
    .enum(['ok', 'leaking', 'blocked', 'damaged', 'missing', 'unknown'])
    .default('unknown'),
  accessNote: z.string().max(500).optional(),
  note: z.string().max(1000).optional(),
});

export type PipeInput = z.infer<typeof PipeInputSchema>;
export type NodeInput = z.infer<typeof NodeInputSchema>;
```

- [ ] **Step 2: ยืนยันว่า compile ผ่าน**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add lib/smart-water/schemas.ts
git commit -m "feat(smart-water): add zod schemas for pipes and nodes"
```

---

### Task 7: collection helpers + index

**Files:**
- Create: `lib/smart-water/db.ts`

ไม่มีเทสต์ — เป็น thin wrapper แบบเดียวกับ `lib/garbage/db.ts` ส่วน index จะถูกติดตั้งจริงตอนรัน seed (Task 13) ตามแบบ seed-garbage

- [ ] **Step 1: สร้าง lib/smart-water/db.ts**

```ts
import type { Collection, Document } from "mongodb";
import { getDb } from "@/lib/mongoNative";

// ชื่อ collection คงที่ — ห้ามเปลี่ยนหลังมีข้อมูล production
export const PIPES_COLLECTION = "water_pipes";
export const NODES_COLLECTION = "water_nodes";

export async function pipes(): Promise<Collection<Document>> {
  return (await getDb()).collection(PIPES_COLLECTION);
}

export async function nodes(): Promise<Collection<Document>> {
  return (await getDb()).collection(NODES_COLLECTION);
}

/** สร้าง index ทั้งหมด — เรียกจาก seed script ปลอดภัยที่จะเรียกซ้ำ (แบบเดียวกับ garbage) */
export async function ensureWaterIndexes(): Promise<void> {
  const db = await getDb();

  await db.collection(PIPES_COLLECTION).createIndexes([
    { key: { geometry: "2dsphere" }, name: "geo" },
    { key: { material: 1, diameterMm: 1 }, name: "by_material" },
    { key: { roadName: 1 }, name: "by_road" },
    { key: { status: 1, deletedAt: 1 }, name: "by_status" },
    { key: { code: 1 }, name: "by_code" },
  ]);

  await db.collection(NODES_COLLECTION).createIndexes([
    { key: { geometry: "2dsphere" }, name: "geo" },
    { key: { type: 1, deletedAt: 1 }, name: "by_type" },
    { key: { onPipeId: 1 }, name: "by_pipe" },
    {
      key: { hydrantNo: 1 },
      name: "uniq_hydrant_no",
      unique: true,
      partialFilterExpression: { hydrantNo: { $type: "string" } },
    },
  ]);
}
```

- [ ] **Step 2: ยืนยันว่า compile ผ่าน**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add lib/smart-water/db.ts
git commit -m "feat(smart-water): add collection helpers and index definitions"
```

---

### Task 8: Service layer — บังคับ derive ทุกจุดเขียน

**Files:**
- Create: `lib/smart-water/service.ts`
- Test: `lib/smart-water/service.test.ts`

**เหตุผล:** ทุกการเขียนต้องผ่าน `savePipe`/`saveNode` เท่านั้น เพื่อให้ `code`/`diameterMm`/`lengthM`/`bbox` ถูก derive เสมอ — เทสต์ครอบเฉพาะ `derivePipeFields` (pure ไม่ต่อ DB)

- [ ] **Step 1: เขียน failing test**

Create `lib/smart-water/service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { derivePipeFields } from './service';

const baseGeometry = {
  type: 'LineString' as const,
  coordinates: [
    [100.35, 15.26],
    [100.36, 15.26],
  ] as [number, number][],
};

const base = {
  material: 'PVC' as const,
  diameter: { value: 4, unit: 'inch' as const },
  status: 'existing' as const,
  ownership: 'municipality' as const,
  lengthSource: 'computed' as const,
  geometry: baseGeometry,
};

describe('derivePipeFields', () => {
  it('สร้าง code จาก material + diameter', () => {
    expect(derivePipeFields(base).code).toBe('P4');
  });

  it('คำนวณ diameterMm', () => {
    expect(derivePipeFields(base).diameterMm).toBe(101.6);
  });

  it('คำนวณ lengthM จาก geometry', () => {
    const d = derivePipeFields(base);
    expect(d.lengthM).toBeGreaterThan(1060);
    expect(d.lengthM).toBeLessThan(1085);
  });

  it('เปลี่ยน geometry แล้ว lengthM ต้องเปลี่ยนตาม', () => {
    const short = derivePipeFields(base);
    const long = derivePipeFields({
      ...base,
      geometry: {
        type: 'LineString',
        coordinates: [
          [100.35, 15.26],
          [100.38, 15.26],
        ],
      },
    });
    expect(long.lengthM).toBeGreaterThan(short.lengthM * 2.5);
  });

  it('เปลี่ยน diameter แล้ว code ต้องเปลี่ยนตาม', () => {
    const a = derivePipeFields(base);
    const b = derivePipeFields({ ...base, diameter: { value: 8, unit: 'inch' } });
    expect(a.code).toBe('P4');
    expect(b.code).toBe('P8');
  });

  it('เก็บ bbox ไว้สำหรับ query', () => {
    expect(derivePipeFields(base).bbox).toEqual([100.35, 15.26, 100.36, 15.26]);
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npx vitest run lib/smart-water/service.test.ts`
Expected: FAIL — resolve import ไม่ได้

- [ ] **Step 3: เขียน implementation**

Create `lib/smart-water/service.ts`:

```ts
import { ObjectId, type Filter, type Document } from 'mongodb';
import { pipes, nodes } from './db';
import { buildPipeCode, toMm } from './pipe-code';
import { computeLengthM, bboxOf, type LngLat } from './geo';
import { PipeInputSchema, NodeInputSchema, type PipeInput } from './schemas';

/** pure — เทสต์ได้โดยไม่ต้องต่อ DB */
export function derivePipeFields(input: PipeInput) {
  const coords = input.geometry.coordinates as LngLat[];
  return {
    code: buildPipeCode(input.material, input.diameter.value),
    diameterMm: toMm(input.diameter.value, input.diameter.unit),
    lengthM: computeLengthM(coords),
    bbox: bboxOf(coords),
  };
}

export async function savePipe(raw: unknown) {
  const input = PipeInputSchema.parse(raw);
  const derived = derivePipeFields(input);
  const { _id, ...rest } = input;
  const id = _id ? new ObjectId(_id) : new ObjectId();
  const now = new Date();

  const col = await pipes();
  await col.updateOne(
    { _id: id },
    {
      $set: { ...rest, ...derived, updatedAt: now },
      $setOnInsert: { createdAt: now, deletedAt: null },
    },
    { upsert: true }
  );
  return col.findOne({ _id: id });
}

export async function saveNode(raw: unknown) {
  const input = NodeInputSchema.parse(raw);
  const { _id, onPipeId, ...rest } = input;
  const id = _id ? new ObjectId(_id) : new ObjectId();
  const now = new Date();

  const col = await nodes();
  await col.updateOne(
    { _id: id },
    {
      $set: {
        ...rest,
        onPipeId: onPipeId ? new ObjectId(onPipeId) : null,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now, deletedAt: null },
    },
    { upsert: true }
  );
  return col.findOne({ _id: id });
}

export type BBox = [number, number, number, number];

function bboxFilter(bbox?: BBox): Filter<Document> {
  if (!bbox) return {};
  const [w, s, e, n] = bbox;
  return {
    geometry: {
      $geoIntersects: {
        $geometry: {
          type: 'Polygon',
          coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
        },
      },
    },
  };
}

export async function listPipes(opts: {
  bbox?: BBox;
  material?: string;
  status?: string;
  roadName?: string;
  limit?: number;
}) {
  const filter: Filter<Document> = {
    deletedAt: null,
    ...bboxFilter(opts.bbox),
  };
  if (opts.material) filter.material = opts.material;
  if (opts.status) filter.status = opts.status;
  if (opts.roadName) filter.roadName = opts.roadName;

  const col = await pipes();
  // ข้อมูลจริงจากแบบมี 2,096 เส้น — default ต้องสูงกว่านั้น ไม่งั้นแผนที่ขาดหายเงียบ ๆ
  return col
    .find(filter)
    .limit(Math.min(opts.limit ?? 5000, 10000))
    .toArray();
}

export async function listNodes(opts: {
  bbox?: BBox;
  type?: string;
  limit?: number;
}) {
  const filter: Filter<Document> = {
    deletedAt: null,
    ...bboxFilter(opts.bbox),
  };
  if (opts.type) filter.type = opts.type;

  const col = await nodes();
  return col
    .find(filter)
    .limit(Math.min(opts.limit ?? 3000, 8000))
    .toArray();
}

export async function softDeletePipe(id: string) {
  const col = await pipes();
  return col.updateOne(
    { _id: new ObjectId(id) },
    { $set: { deletedAt: new Date() } }
  );
}

export async function softDeleteNode(id: string) {
  const col = await nodes();
  return col.updateOne(
    { _id: new ObjectId(id) },
    { $set: { deletedAt: new Date() } }
  );
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run lib/smart-water/service.test.ts`
Expected: PASS ทั้ง 6 test

- [ ] **Step 5: Commit**

```bash
git add lib/smart-water/service.ts lib/smart-water/service.test.ts
git commit -m "feat(smart-water): add service layer with auto-derived fields"
```

---

### Task 9: รายงานสรุปความยาว

**Files:**
- Create: `lib/smart-water/reports.ts`
- Test: `lib/smart-water/reports.test.ts`

- [ ] **Step 1: เขียน failing test สำหรับ pipeline builder (pure)**

Create `lib/smart-water/reports.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildLengthPipeline } from './reports';

// return type เป็น Document[] ของ mongodb (มี index signature) — เข้าถึง stage ได้ตรง ๆ
// โดยไม่ต้องประกาศ any เอง (เลี่ยง no-explicit-any ของ eslint)

describe('buildLengthPipeline', () => {
  it('group ตาม material เป็นค่า default', () => {
    const p = buildLengthPipeline({});
    const group = p.find((s) => s.$group)!;
    expect(group.$group._id).toHaveProperty('material');
    expect(group.$group._id).toHaveProperty('diameterValue');
  });

  it('group ตามถนนได้', () => {
    const p = buildLengthPipeline({ groupBy: 'road' });
    const group = p.find((s) => s.$group)!;
    expect(group.$group._id).toHaveProperty('roadName');
  });

  it('ตัดท่อที่ถูกลบและท่อยกเลิกออก', () => {
    const p = buildLengthPipeline({});
    const match = p.find((s) => s.$match)!;
    expect(match.$match.deletedAt).toBeNull();
    expect(match.$match.status).toEqual({ $ne: 'abandoned' });
  });

  it('รวมท่อยกเลิกได้ถ้าสั่ง', () => {
    const p = buildLengthPipeline({ includeAbandoned: true });
    const match = p.find((s) => s.$match)!;
    expect(match.$match.status).toBeUndefined();
  });

  it('กรองตามถนนได้', () => {
    const p = buildLengthPipeline({ roadName: 'ถ.หัสนัย' });
    const match = p.find((s) => s.$match)!;
    expect(match.$match.roadName).toBe('ถ.หัสนัย');
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `npx vitest run lib/smart-water/reports.test.ts`
Expected: FAIL — resolve import ไม่ได้

- [ ] **Step 3: เขียน implementation**

Create `lib/smart-water/reports.ts`:

```ts
import type { Document } from 'mongodb';
import { pipes } from './db';

export type GroupBy = 'material' | 'road' | 'year' | 'status';

export interface LengthReportOptions {
  groupBy?: GroupBy;
  roadName?: string;
  material?: string;
  includeAbandoned?: boolean;
}

export function buildLengthPipeline(opts: LengthReportOptions): Document[] {
  const match: Document = { deletedAt: null };
  if (!opts.includeAbandoned) match.status = { $ne: 'abandoned' };
  if (opts.roadName) match.roadName = opts.roadName;
  if (opts.material) match.material = opts.material;

  let id: Document;
  switch (opts.groupBy) {
    case 'road':
      id = { roadName: '$roadName' };
      break;
    case 'year':
      id = { installedYear: '$installedYear' };
      break;
    case 'status':
      id = { status: '$status' };
      break;
    default:
      id = {
        material: '$material',
        diameterValue: '$diameter.value',
        unit: '$diameter.unit',
        code: '$code',
      };
  }

  return [
    { $match: match },
    {
      $group: {
        _id: id,
        totalM: { $sum: '$lengthM' },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        group: '$_id',
        totalM: { $round: ['$totalM', 2] },
        totalKm: { $round: [{ $divide: ['$totalM', 1000] }, 3] },
        count: 1,
      },
    },
    { $sort: { totalM: -1 } },
  ];
}

export async function runLengthReport(opts: LengthReportOptions) {
  const col = await pipes();
  const rows = await col.aggregate(buildLengthPipeline(opts)).toArray();
  const grandTotalM = rows.reduce((s, r) => s + (r.totalM || 0), 0);
  return {
    rows,
    grandTotalM: Number(grandTotalM.toFixed(2)),
    grandTotalKm: Number((grandTotalM / 1000).toFixed(3)),
    generatedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run lib/smart-water/reports.test.ts`
Expected: PASS ทั้ง 5 test

- [ ] **Step 5: Commit**

```bash
git add lib/smart-water/reports.ts lib/smart-water/reports.test.ts
git commit -m "feat(smart-water): add pipe length aggregation report"
```

---

### Task 10: API auth guard ของโมดูล

**Files:**
- Create: `pages/api/smart-water/_auth.ts`

Template จาก `pages/api/garbage/_auth.ts` ทั้งไฟล์ (มาตรฐานล่าสุดของ repo: บล็อก isActive/isArchived, กัน role ใน Mongo ยกระดับตัวเอง, ใช้ `hasPermission` กลาง) — **ห้าม**เช็คแค่ `getAuth(req)` เพราะ Clerk org แชร์ข้ามแอปพี่น้อง

- [ ] **Step 1: สร้างไฟล์ _auth.ts**

```ts
import type { NextApiRequest } from "next";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import dbConnect from "@/lib/dbConnect";
import { hasPermission, type Role } from "@/lib/permissions";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
const REQUIRED_PAGE = "/admin/smart-water";

const KNOWN_ROLES: readonly string[] = ["superadmin", "admin", "user", "guest"];

/** role ที่ไม่รู้จัก/ไม่มีค่า ถือเป็น "admin" ตามแบบเดียวกับ pages/api/garbage/_auth.ts */
function asRole(value: unknown): Role {
  return typeof value === "string" && KNOWN_ROLES.includes(value) ? (value as Role) : "admin";
}

export type SmartWaterAdminResult =
  | { ok: true; userId: string; isSuperAdmin: boolean }
  | { ok: false; status: 401 | 403; message: string };

/** ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์อีกครั้ง — ห้ามเชื่อฝั่ง client */
export async function requireSmartWaterAdmin(req: NextApiRequest): Promise<SmartWaterAdminResult> {
  const { userId } = getAuth(req);
  if (!userId) return { ok: false, status: 401, message: "ต้องเข้าสู่ระบบก่อน" };

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  if (clerkUser.publicMetadata?.role === "superadmin") {
    return { ok: true, userId, isSuperAdmin: true };
  }

  await dbConnect();
  // schema ย่อแบบ inline ตามแบบเดียวกับ pages/api/garbage/_auth.ts
  // (repo นี้ redefine User แบบย่อหลายที่ — เพิ่มฟิลด์ใน User ต้องแก้ทุกที่ ไม่งั้นฟิลด์หายเงียบ)
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
  const User = mongoose.models.User || mongoose.model("User", UserSchema);
  const mongoUser = await User.findOne({ clerkId: userId }).lean<{
    appId?: string;
    allowedPages?: string[];
    role?: string;
    isActive?: boolean;
    isArchived?: boolean;
  } | null>();

  if (!mongoUser) return { ok: false, status: 403, message: "ยังไม่ได้ลงทะเบียนผู้ใช้" };
  // พนักงานที่ถูกปิดใช้งาน/เก็บเข้ากรุแล้วต้องเข้าไม่ได้ แม้บัญชี Clerk ยังอยู่
  if (mongoUser.isActive === false || mongoUser.isArchived === true) {
    return { ok: false, status: 403, message: "บัญชีถูกปิดใช้งาน" };
  }
  if (!mongoUser.appId || mongoUser.appId !== CURRENT_APP_ID) {
    return { ok: false, status: 403, message: "ไม่มีสิทธิ์เข้าใช้แอปนี้" };
  }

  // มาถึงตรงนี้แปลว่า Clerk ไม่ได้บอกว่าเป็น superadmin — ห้าม role ใน Mongo
  // ยกระดับตัวเองเป็น superadmin ผ่านการเช็คสิทธิ์
  const rawRole = asRole(mongoUser.role ?? clerkUser.publicMetadata?.role);
  const role: Role = rawRole === "superadmin" ? "admin" : rawRole;

  // ใช้ helper กลางของรีโป — allowedPages ว่างตกไปใช้ DEFAULT_PERMISSIONS[role]
  // หน้านี้ไม่อยู่ใน DEFAULT_PERMISSIONS.admin (นโยบาย: superadmin ติ๊กสิทธิ์รายคน)
  // → admin ที่ยังไม่ถูกให้สิทธิ์จะได้ 403 — ให้สิทธิ์ที่ /admin/superadmin
  //   หรือรัน scripts/grant-smart-water-permission.js --yes
  const allowed = Array.isArray(mongoUser.allowedPages) ? mongoUser.allowedPages : [];
  if (!hasPermission(role, allowed, REQUIRED_PAGE)) {
    return { ok: false, status: 403, message: "ไม่มีสิทธิ์หน้านี้" };
  }

  return { ok: true, userId, isSuperAdmin: false };
}
```

- [ ] **Step 2: ยืนยันว่า compile ผ่าน**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add pages/api/smart-water/_auth.ts
git commit -m "feat(smart-water): add server-side auth guard for module APIs"
```

---

### Task 11: API routes

**Files:**
- Create: `lib/smart-water/api-helpers.ts`
- Create: `pages/api/smart-water/pipes/index.ts`
- Create: `pages/api/smart-water/pipes/[id].ts`
- Create: `pages/api/smart-water/nodes/index.ts`
- Create: `pages/api/smart-water/nodes/[id].ts`
- Create: `pages/api/smart-water/reports/length.ts`

รูปแบบ response ตาม convention repo: `{ success: true, data }` / `{ success: false, message }` (ยกเว้น `?format=geojson` ที่คืน FeatureCollection ตรง ๆ ให้แผนที่ใช้)

- [ ] **Step 1: สร้าง helper แปลง query string**

Create `lib/smart-water/api-helpers.ts`:

```ts
import type { NextApiRequest } from 'next';
import type { Document } from 'mongodb';
import type { BBox } from './service';

export function parseBBox(req: NextApiRequest): BBox | undefined {
  const raw = req.query.bbox;
  if (typeof raw !== 'string') return undefined;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return undefined;
  return parts as BBox;
}

export function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export function toFeatureCollection(docs: Document[]) {
  return {
    type: 'FeatureCollection',
    features: docs.map((d) => {
      const { geometry, _id, ...props } = d;
      return {
        type: 'Feature',
        id: String(_id),
        geometry,
        properties: { ...props, _id: String(_id) },
      };
    }),
  };
}

/** ดึง ZodError ออกจาก unknown อย่างปลอดภัย — คืน null ถ้าไม่ใช่ */
export function zodIssues(e: unknown): unknown[] | null {
  if (e && typeof e === 'object' && (e as { name?: string }).name === 'ZodError') {
    return (e as { issues: unknown[] }).issues;
  }
  return null;
}
```

- [ ] **Step 2: สร้าง route รายการท่อ**

Create `pages/api/smart-water/pipes/index.ts`:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireSmartWaterAdmin } from '../_auth';
import { listPipes, savePipe } from '@/lib/smart-water/service';
import { parseBBox, str, toFeatureCollection, zodIssues } from '@/lib/smart-water/api-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireSmartWaterAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  try {
    if (req.method === 'GET') {
      const docs = await listPipes({
        bbox: parseBBox(req),
        material: str(req.query.material),
        status: str(req.query.status),
        roadName: str(req.query.roadName),
        limit: Number(req.query.limit) || undefined,
      });
      if (req.query.format === 'geojson') {
        return res.status(200).json(toFeatureCollection(docs));
      }
      return res.status(200).json({ success: true, data: docs, count: docs.length });
    }

    if (req.method === 'POST') {
      const doc = await savePipe(req.body);
      return res.status(201).json({ success: true, data: doc });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ success: false, message: 'ไม่รองรับ method นี้' });
  } catch (e) {
    const issues = zodIssues(e);
    if (issues) {
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', issues });
    }
    console.error('[smart-water/pipes]', e);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
  }
}
```

- [ ] **Step 3: สร้าง route ท่อรายเส้น**

Create `pages/api/smart-water/pipes/[id].ts`:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { requireSmartWaterAdmin } from '../_auth';
import { pipes } from '@/lib/smart-water/db';
import { savePipe, softDeletePipe } from '@/lib/smart-water/service';
import { zodIssues } from '@/lib/smart-water/api-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireSmartWaterAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  const id = String(req.query.id);
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'id ไม่ถูกต้อง' });
  }

  try {
    const col = await pipes();

    if (req.method === 'GET') {
      const doc = await col.findOne({ _id: new ObjectId(id), deletedAt: null });
      if (!doc) return res.status(404).json({ success: false, message: 'ไม่พบท่อนี้' });
      return res.status(200).json({ success: true, data: doc });
    }

    if (req.method === 'PATCH') {
      const existing = await col.findOne({ _id: new ObjectId(id), deletedAt: null });
      if (!existing) return res.status(404).json({ success: false, message: 'ไม่พบท่อนี้' });
      // merge ของเดิม + ของใหม่ แล้ววนกลับเข้า savePipe เพื่อ re-validate + re-derive
      // ตัดฟิลด์ derive/metadata ทิ้งก่อน — Zod schema ไม่รู้จักและ service จะคำนวณใหม่เอง
      const merged: Record<string, unknown> = { ...existing, ...req.body, _id: id };
      delete merged.createdAt;
      delete merged.updatedAt;
      delete merged.deletedAt;
      delete merged.code;
      delete merged.diameterMm;
      delete merged.lengthM;
      delete merged.bbox;
      const doc = await savePipe(merged);
      return res.status(200).json({ success: true, data: doc });
    }

    if (req.method === 'DELETE') {
      await softDeletePipe(id);
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return res.status(405).json({ success: false, message: 'ไม่รองรับ method นี้' });
  } catch (e) {
    const issues = zodIssues(e);
    if (issues) {
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', issues });
    }
    console.error('[smart-water/pipes/id]', e);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
  }
}
```

- [ ] **Step 4: สร้าง route อุปกรณ์ (nodes)**

Create `pages/api/smart-water/nodes/index.ts`:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireSmartWaterAdmin } from '../_auth';
import { listNodes, saveNode } from '@/lib/smart-water/service';
import { parseBBox, str, toFeatureCollection, zodIssues } from '@/lib/smart-water/api-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireSmartWaterAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  try {
    if (req.method === 'GET') {
      const docs = await listNodes({
        bbox: parseBBox(req),
        type: str(req.query.type),
        limit: Number(req.query.limit) || undefined,
      });
      if (req.query.format === 'geojson') {
        return res.status(200).json(toFeatureCollection(docs));
      }
      return res.status(200).json({ success: true, data: docs, count: docs.length });
    }

    if (req.method === 'POST') {
      const doc = await saveNode(req.body);
      return res.status(201).json({ success: true, data: doc });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ success: false, message: 'ไม่รองรับ method นี้' });
  } catch (e) {
    const issues = zodIssues(e);
    if (issues) {
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', issues });
    }
    console.error('[smart-water/nodes]', e);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
  }
}
```

Create `pages/api/smart-water/nodes/[id].ts`:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { requireSmartWaterAdmin } from '../_auth';
import { nodes } from '@/lib/smart-water/db';
import { saveNode, softDeleteNode } from '@/lib/smart-water/service';
import { zodIssues } from '@/lib/smart-water/api-helpers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireSmartWaterAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  const id = String(req.query.id);
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'id ไม่ถูกต้อง' });
  }

  try {
    const col = await nodes();

    if (req.method === 'GET') {
      const doc = await col.findOne({ _id: new ObjectId(id), deletedAt: null });
      if (!doc) return res.status(404).json({ success: false, message: 'ไม่พบอุปกรณ์นี้' });
      return res.status(200).json({ success: true, data: doc });
    }

    if (req.method === 'PATCH') {
      const existing = await col.findOne({ _id: new ObjectId(id), deletedAt: null });
      if (!existing) return res.status(404).json({ success: false, message: 'ไม่พบอุปกรณ์นี้' });
      const merged: Record<string, unknown> = { ...existing, ...req.body, _id: id };
      if (merged.onPipeId) merged.onPipeId = String(merged.onPipeId);
      delete merged.createdAt;
      delete merged.updatedAt;
      delete merged.deletedAt;
      const doc = await saveNode(merged);
      return res.status(200).json({ success: true, data: doc });
    }

    if (req.method === 'DELETE') {
      await softDeleteNode(id);
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return res.status(405).json({ success: false, message: 'ไม่รองรับ method นี้' });
  } catch (e) {
    const issues = zodIssues(e);
    if (issues) {
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', issues });
    }
    console.error('[smart-water/nodes/id]', e);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
  }
}
```

- [ ] **Step 5: สร้าง route รายงาน**

Create `pages/api/smart-water/reports/length.ts`:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireSmartWaterAdmin } from '../_auth';
import { runLengthReport, type GroupBy } from '@/lib/smart-water/reports';
import { str } from '@/lib/smart-water/api-helpers';

const VALID: GroupBy[] = ['material', 'road', 'year', 'status'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireSmartWaterAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'ไม่รองรับ method นี้' });
  }

  const g = str(req.query.groupBy) as GroupBy | undefined;
  try {
    const result = await runLengthReport({
      groupBy: g && VALID.includes(g) ? g : 'material',
      roadName: str(req.query.roadName),
      material: str(req.query.material),
      includeAbandoned: req.query.includeAbandoned === 'true',
    });
    return res.status(200).json({ success: true, ...result });
  } catch (e) {
    console.error('[smart-water/reports/length]', e);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
  }
}
```

- [ ] **Step 6: ยืนยันว่า compile ผ่าน**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 7: Commit**

```bash
git add lib/smart-water/api-helpers.ts pages/api/smart-water
git commit -m "feat(smart-water): add pipes, nodes and report API routes"
```

---

### Task 12: ลงทะเบียนหน้า /admin/smart-water (4 จุดตาม checklist)

**Files:**
- Modify: `lib/permissions.ts` — `ALL_PAGES`
- Modify: `components/LayoutAdmin.tsx` — `navigationItems`
- Create: `scripts/grant-smart-water-permission.js`

หน้าเดียวที่ลงทะเบียนคือ `/admin/smart-water` — หน้า `/admin/smart-water/report` เป็นหน้าลูกที่ยืมสิทธิ์หน้าแม่ผ่าน prefix match ของ `pathMatchesPermission()` ไม่ต้องลงทะเบียนแยก
**ไม่เพิ่ม** ใน `DEFAULT_PERMISSIONS.admin` (ตามนโยบายในคอมเมนต์ของไฟล์: หน้าใหม่ให้ superadmin ติ๊กรายคน — เครื่องมือเฉพาะกอง) — preset ผู้บริหารจะรวมหน้านี้อัตโนมัติเพราะ category เป็น `management`

- [ ] **Step 1: เพิ่ม entry ใน ALL_PAGES**

ใน `lib/permissions.ts` เพิ่มต่อจาก entry ของ `/admin/smart-light`:

```ts
  {
    path: '/admin/smart-water',
    label: 'ทะเบียนท่อประปา',
    icon: '🚰',
    description: 'ทะเบียนท่อประปาและอุปกรณ์ — แผนที่แนวท่อ + รายงานความยาว',
    category: 'management'
  },
```

- [ ] **Step 2: เพิ่มเมนูใน LayoutAdmin**

ใน `components/LayoutAdmin.tsx` เพิ่มใน `navigationItems` ต่อจากแถว smart-light:

```ts
  { label: 'ทะเบียนท่อประปา',   href: '/admin/smart-water',              icon: '🚰', group: 'จัดการ' },
```

- [ ] **Step 3: สร้าง grant script**

Create `scripts/grant-smart-water-permission.js` (template จาก `scripts/grant-smart-light-permission.js`):

```js
// One-time migration: ให้สิทธิ์หน้าทะเบียนท่อประปากับ user เดิมที่มี custom allowedPages
//
// หมายเหตุ: หน้านี้ไม่อยู่ใน DEFAULT_PERMISSIONS (เครื่องมือเฉพาะกองการประปา)
// — script นี้เพิ่มสิทธิ์ให้ "ทุก" user ที่มี custom allowedPages ถ้าต้องการให้เฉพาะบางคน
// ให้ superadmin ติ๊กรายคนที่ /admin/superadmin แทน
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/grant-smart-water-permission.js            (dry-run: แสดงรายชื่อ)
//   node --env-file=.env.local scripts/grant-smart-water-permission.js --yes      (เพิ่มสิทธิ์จริง)
//
// รันซ้ำได้ (idempotent) — ใช้ $addToSet

const mongoose = require("mongoose");

const NEW_PAGE = "/admin/smart-water";

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

**การรันจริงเป็นการตัดสินใจเชิงนโยบาย** (ให้สิทธิ์ทุก custom user) — ในแผนนี้ให้รันแค่ dry-run ตรวจว่า script ทำงาน:

Run: `node --env-file=.env.local scripts/grant-smart-water-permission.js`
Expected: แสดงตารางรายชื่อ + ข้อความ "โหมดแสดงรายชื่อ..." โดยไม่แก้อะไร

- [ ] **Step 4: ยืนยัน compile**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 5: Commit**

```bash
git add lib/permissions.ts components/LayoutAdmin.tsx scripts/grant-smart-water-permission.js
git commit -m "feat(smart-water): register admin page permissions and menu"
```

---

### Task 13: Seed ข้อมูลทดสอบ + ติดตั้ง index

**Files:**
- Create: `scripts/seed-water.ts`

**⚠️ พิกัดทั้งหมดเป็นค่าสมมติเพื่อพัฒนา UI ไม่ใช่แนวท่อจริง — ต้องทับด้วยข้อมูลจาก PDF ภายหลัง**
Script เป็น idempotent: ลบ**เฉพาะ**เอกสารที่มาจาก seed เดิม (`sourceDoc.pdfName === "SEED-DATA"` / `note === "SEED-DATA"`) — **ห้าม deleteMany ทั้ง collection** เพราะอนาคตจะมีข้อมูลจริงปนอยู่

- [ ] **Step 1: เขียน seed script**

Create `scripts/seed-water.ts`:

```ts
// Seed ข้อมูลทดสอบทะเบียนท่อประปา + ติดตั้ง index
//   node --env-file=.env.local --import tsx scripts/seed-water.ts
//
// idempotent: ลบเฉพาะเอกสาร seed เดิม (SEED-DATA) แล้วเขียนใหม่ — ข้อมูลจริงไม่ถูกแตะ
// ⚠️ พิกัดสมมติรอบตาคลี ไม่ใช่แนวท่อจริง — ห้ามเอาตัวเลขไปใช้ในรายงานจริง
import { pipes, nodes, ensureWaterIndexes } from "../lib/smart-water/db";
import { savePipe, saveNode } from "../lib/smart-water/service";

const SEED_TAG = "SEED-DATA";

const PIPES_SEED = [
  { material: "PVC" as const, diameter: { value: 4, unit: "inch" as const },
    roadName: "ถ.พหลโยธิน", status: "existing" as const, installedYear: 2558,
    geometry: { type: "LineString" as const, coordinates: [[100.3480, 15.2585], [100.3532, 15.2601], [100.3578, 15.2612]] as [number, number][] } },
  { material: "PVC" as const, diameter: { value: 8, unit: "inch" as const },
    roadName: "ถ.พหลโยธิน", status: "existing" as const, installedYear: 2552,
    geometry: { type: "LineString" as const, coordinates: [[100.3578, 15.2612], [100.3625, 15.2588], [100.3661, 15.2554]] as [number, number][] } },
  { material: "PVC" as const, diameter: { value: 6, unit: "inch" as const },
    roadName: "ถ.หัสนัย", status: "existing" as const, installedYear: 2560,
    geometry: { type: "LineString" as const, coordinates: [[100.3512, 15.2548], [100.3570, 15.2542], [100.3618, 15.2536]] as [number, number][] } },
  { material: "PVC" as const, diameter: { value: 4, unit: "inch" as const },
    roadName: "ถ.วิษณุธรรม", status: "existing" as const, installedYear: 2561,
    geometry: { type: "LineString" as const, coordinates: [[100.3455, 15.2632], [100.3508, 15.2628]] as [number, number][] } },
  { material: "AC" as const, diameter: { value: 12, unit: "inch" as const },
    roadName: "ถ.วิษณุธรรม", status: "existing" as const, installedYear: 2535,
    geometry: { type: "LineString" as const, coordinates: [[100.3440, 15.2640], [100.3512, 15.2630], [100.3560, 15.2625]] as [number, number][] } },
  { material: "AC" as const, diameter: { value: 6, unit: "inch" as const },
    roadName: "ถ.สนามคลี", status: "existing" as const, installedYear: 2538,
    geometry: { type: "LineString" as const, coordinates: [[100.3390, 15.2668], [100.3448, 15.2655]] as [number, number][] } },
  { material: "PVC" as const, diameter: { value: 2, unit: "inch" as const },
    roadName: "ถ.ลูกคลี", status: "existing" as const, installedYear: 2563,
    geometry: { type: "LineString" as const, coordinates: [[100.3448, 15.2655], [100.3452, 15.2620]] as [number, number][] } },
  { material: "SP" as const, diameter: { value: 400, unit: "mm" as const },
    roadName: "ถ.พหลโยธิน", status: "existing" as const, installedYear: 2548,
    geometry: { type: "LineString" as const, coordinates: [[100.3400, 15.2700], [100.3520, 15.2640], [100.3620, 15.2570]] as [number, number][] } },
  { material: "HDPE" as const, diameter: { value: 110, unit: "mm" as const },
    roadName: "หมู่บ้านอุดมสุข", status: "new" as const, installedYear: 2567,
    geometry: { type: "LineString" as const, coordinates: [[100.3690, 15.2600], [100.3712, 15.2598], [100.3714, 15.2570]] as [number, number][] } },
  { material: "PVC" as const, diameter: { value: 16, unit: "inch" as const },
    roadName: "ถ.สนามคลี", status: "existing" as const, installedYear: 2555,
    geometry: { type: "LineString" as const, coordinates: [[100.3405, 15.2680], [100.3470, 15.2652], [100.3530, 15.2618]] as [number, number][] } },
  { material: "GS" as const, diameter: { value: 2, unit: "inch" as const },
    roadName: "ถ.รุ่งทา 1", status: "abandoned" as const, installedYear: 2530,
    geometry: { type: "LineString" as const, coordinates: [[100.3462, 15.2678], [100.3488, 15.2672]] as [number, number][] } },
  { material: "RCP" as const, diameter: { value: 30, unit: "cm" as const },
    roadName: "ถ.หัสนัย", status: "existing" as const, installedYear: 2559,
    geometry: { type: "LineString" as const, coordinates: [[100.3618, 15.2536], [100.3640, 15.2510]] as [number, number][] } },
];

const NODES_SEED = [
  { type: "hydrant" as const, hydrantNo: "HD-001", condition: "ok" as const,
    geometry: { type: "Point" as const, coordinates: [100.3532, 15.2601] as [number, number] } },
  { type: "hydrant" as const, hydrantNo: "HD-002", condition: "ok" as const,
    geometry: { type: "Point" as const, coordinates: [100.3578, 15.2612] as [number, number] } },
  { type: "hydrant" as const, hydrantNo: "HD-003", condition: "damaged" as const,
    accessNote: "มีรถจอดบังประจำ",
    geometry: { type: "Point" as const, coordinates: [100.3570, 15.2542] as [number, number] } },
  { type: "hydrant" as const, hydrantNo: "HD-004", condition: "unknown" as const,
    geometry: { type: "Point" as const, coordinates: [100.3700, 15.2599] as [number, number] } },
  { type: "gate_valve" as const, size: '8"', condition: "ok" as const,
    geometry: { type: "Point" as const, coordinates: [100.3625, 15.2588] as [number, number] } },
  { type: "gate_valve" as const, size: '4"', condition: "ok" as const,
    geometry: { type: "Point" as const, coordinates: [100.3508, 15.2628] as [number, number] } },
  { type: "gate_valve" as const, size: '16"', condition: "ok" as const,
    geometry: { type: "Point" as const, coordinates: [100.3470, 15.2652] as [number, number] } },
  { type: "tap" as const,
    geometry: { type: "Point" as const, coordinates: [100.3448, 15.2655] as [number, number] } },
  { type: "end_cap" as const,
    geometry: { type: "Point" as const, coordinates: [100.3714, 15.2570] as [number, number] } },
  { type: "blow_off" as const, condition: "ok" as const,
    geometry: { type: "Point" as const, coordinates: [100.3640, 15.2510] as [number, number] } },
  { type: "water_meter" as const,
    geometry: { type: "Point" as const, coordinates: [100.3452, 15.2620] as [number, number] } },
];

async function main() {
  await ensureWaterIndexes();
  console.log("ติดตั้ง index เรียบร้อย");

  const pipeCol = await pipes();
  const nodeCol = await nodes();

  // ลบเฉพาะของ seed เดิม — ห้ามล้างทั้ง collection
  await pipeCol.deleteMany({ "sourceDoc.pdfName": SEED_TAG });
  await nodeCol.deleteMany({ note: SEED_TAG });

  for (const p of PIPES_SEED) {
    await savePipe({
      ...p,
      ownership: "municipality",
      lengthSource: "computed",
      sourceDoc: { pdfName: SEED_TAG, confidence: "low" },
    });
  }
  for (const n of NODES_SEED) {
    await saveNode({ ...n, note: SEED_TAG });
  }

  const rows = await pipeCol.find({ "sourceDoc.pdfName": SEED_TAG }).toArray();
  const total = rows.reduce((s, p) => s + (p.lengthM || 0), 0);
  console.log(`ใส่ท่อ ${rows.length} เส้น รวม ${total.toFixed(2)} ม.`);
  console.log(`ใส่ node ${NODES_SEED.length} จุด`);
  console.log("⚠️  ข้อมูลชุดนี้เป็นข้อมูลทดสอบ พิกัดสมมติ ไม่ใช่แนวท่อจริง");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: รัน seed**

Run: `node --env-file=.env.local --import tsx scripts/seed-water.ts`
Expected: `ติดตั้ง index เรียบร้อย` → `ใส่ท่อ 12 เส้น รวม xxxx.xx ม.` → `ใส่ node 11 จุด` + คำเตือน

- [ ] **Step 3: ตรวจว่า derive ทำงานและรันซ้ำได้**

Run:
```bash
node --env-file=.env.local --import tsx -e "import('./lib/smart-water/db').then(async (m) => { const col = await m.pipes(); const r = await col.find({}, { projection: { code: 1, lengthM: 1, roadName: 1 } }).toArray(); console.table(r.map(x => ({ code: x.code, lengthM: x.lengthM, road: x.roadName }))); process.exit(0); })"
```
Expected: 12 แถว ทุกแถวมี `lengthM > 0` และ `code` เป็น P4/P8/A12/S400/H110/R30 ฯลฯ

แล้วรัน seed ซ้ำอีกรอบ: `node --env-file=.env.local --import tsx scripts/seed-water.ts`
Expected: ยังได้ `ใส่ท่อ 12 เส้น` (ไม่บวมเป็น 24 — พิสูจน์ว่า idempotent)

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-water.ts
git commit -m "feat(smart-water): add idempotent seed script with index setup"
```

---

### Task 14: Map components (react-leaflet)

**Files:**
- Create: `components/smart-water/PipeLegend.js`
- Create: `components/smart-water/WaterMap.js`

ใช้ react-leaflet v5 + `BaseLayersControl` กลาง (`components/MapBaseTileLayers.js`) ตามแบบโมดูลอื่น — **ห้าม** new Leaflet map เอง ใช้แค่ `circleMarker` จึงไม่ต้อง fix marker icon

- [ ] **Step 1: สร้าง legend component**

Create `components/smart-water/PipeLegend.js`:

```jsx
import { PIPE_MATERIALS, NODE_TYPES, CODE_COLORS } from "@/lib/smart-water/constants";

export const NODE_STYLE = {
  hydrant: { color: "#DC2626", fill: true },
  gate_valve: { color: "#16A34A", fill: false },
  tap: { color: "#374151", fill: true },
  end_cap: { color: "#6B7280", fill: false },
  water_meter: { color: "#2563EB", fill: false },
  blow_off: { color: "#EA580C", fill: true },
};

export default function PipeLegend() {
  return (
    <div className="absolute bottom-6 right-4 z-[1000] rounded-lg bg-white/95 p-3 text-xs shadow-lg ring-1 ring-black/10 max-h-[60vh] overflow-y-auto">
      {/* สีผูกกับรหัส (ขนาด) ตามแบบร่าง 2568 — ไม่ใช่ตามชนิดวัสดุ */}
      <div className="mb-1 font-semibold text-slate-700">รหัสท่อ (สีตามแบบ)</div>
      {Object.entries(CODE_COLORS).map(([code, color]) => (
        <div key={code} className="flex items-center gap-2 py-0.5">
          <span
            className="inline-block h-1 w-6 rounded"
            style={{ backgroundColor: color }}
          />
          <span className="text-slate-600">{code}</span>
        </div>
      ))}
      <div className="mt-1 text-[10px] leading-4 text-slate-400">
        {Object.entries(PIPE_MATERIALS)
          .map(([letter, m]) => `${letter} = ${m.nameTh}`)
          .join(" · ")}
        <br />รหัสอื่นนอกแบบแสดงเป็นสีเทา
      </div>
      <div className="mt-2 mb-1 font-semibold text-slate-700">อุปกรณ์</div>
      {Object.entries(NODE_TYPES).map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 py-0.5">
          <span
            className="inline-block h-3 w-3 rounded-full border-2"
            style={{
              borderColor: NODE_STYLE[k]?.color ?? "#000",
              backgroundColor: NODE_STYLE[k]?.fill
                ? NODE_STYLE[k].color
                : "transparent",
            }}
          />
          <span className="text-slate-600">{v.nameTh}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: สร้าง map component**

Create `components/smart-water/WaterMap.js`:

```jsx
// แผนที่ทะเบียนท่อประปา — มี leaflet ข้างใน ต้อง import ผ่าน dynamic(..., { ssr: false }) เท่านั้น
import { useEffect } from "react";
import { MapContainer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { BaseLayersControl } from "@/components/MapBaseTileLayers";
import { CODE_COLORS, FALLBACK_COLOR } from "@/lib/smart-water/constants";
import { NODE_STYLE } from "./PipeLegend";

const TAKHLI_CENTER = [15.2605, 100.3555];

// สีตามรหัสท่อ (ชนิด+ขนาด) ให้ตรงกับแบบที่กองการประปาใช้ — ไม่ใช่ตามชนิดวัสดุ
function colorOf(code) {
  return CODE_COLORS[code] ?? FALLBACK_COLOR;
}

function weightOf(diameterMm) {
  if (diameterMm >= 300) return 6;
  if (diameterMm >= 150) return 4.5;
  if (diameterMm >= 100) return 3.5;
  return 2.5;
}

function pipeStyle(feature) {
  const p = feature.properties;
  return {
    color: colorOf(p.code),
    weight: weightOf(p.diameterMm ?? 50),
    opacity: p.status === "abandoned" ? 0.35 : 0.9,
    dashArray: p.status === "planned" ? "6,6" : undefined,
  };
}

function onEachPipe(feature, layer) {
  const p = feature.properties;
  const conf = p.sourceDoc?.confidence;
  const warn =
    conf === "low"
      ? '<div style="color:#b45309;margin-top:4px">⚠ ข้อมูลความเชื่อมั่นต่ำ ระยะเป็นค่าประมาณ</div>'
      : "";
  layer.bindPopup(`
    <div style="font-family:inherit;min-width:180px">
      <div style="font-weight:600;font-size:14px">${p.code} — ${p.material}</div>
      <div>ขนาด ${p.diameter?.value} ${p.diameter?.unit}</div>
      <div>ถนน: ${p.roadName ?? "-"}</div>
      <div>ความยาว: <b>${conf === "low" ? Math.round(p.lengthM) : p.lengthM} ม.</b></div>
      <div>สถานะ: ${p.status}</div>
      <div>ปีที่วาง: ${p.installedYear ?? "-"}</div>
      ${warn}
    </div>
  `);
}

function nodeToLayer(feature, latlng) {
  const s = NODE_STYLE[feature.properties.type] ?? { color: "#000", fill: true };
  return L.circleMarker(latlng, {
    radius: feature.properties.type === "hydrant" ? 7 : 5,
    color: s.color,
    weight: 2,
    fillColor: s.fill ? s.color : "#ffffff",
    fillOpacity: 1,
  });
}

function onEachNode(feature, layer) {
  const p = feature.properties;
  layer.bindPopup(`
    <div style="font-family:inherit">
      <div style="font-weight:600">${p.hydrantNo ?? p.type}</div>
      <div>ชนิด: ${p.type}</div>
      ${p.size ? `<div>ขนาด: ${p.size}</div>` : ""}
      <div>สภาพ: ${p.condition ?? "-"}</div>
      ${p.accessNote ? `<div>หมายเหตุ: ${p.accessNote}</div>` : ""}
    </div>
  `);
}

// ซูมให้พอดีข้อมูลครั้งแรกที่โหลด
function FitToData({ data }) {
  const map = useMap();
  useEffect(() => {
    if (!data?.features?.length) return;
    const b = L.geoJSON(data).getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [40, 40] });
  }, [map, data]);
  return null;
}

export default function WaterMap({ pipes, nodes }) {
  return (
    <MapContainer center={TAKHLI_CENTER} zoom={15} className="h-full w-full">
      <BaseLayersControl />
      <GeoJSON data={pipes} style={pipeStyle} onEachFeature={onEachPipe} />
      <GeoJSON data={nodes} pointToLayer={nodeToLayer} onEachFeature={onEachNode} />
      <FitToData data={pipes} />
    </MapContainer>
  );
}
```

- [ ] **Step 3: ยืนยัน compile**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 4: Commit**

```bash
git add components/smart-water
git commit -m "feat(smart-water): add react-leaflet pipe map and legend components"
```

---

### Task 15: หน้าแผนที่ /admin/smart-water

**Files:**
- Create: `pages/admin/smart-water/index.jsx`

หน้า fetch ข้อมูล → ส่งเข้า `WaterMap` (แบบเดียวกับ smart-light: page เป็นเจ้าของ state, map เป็น presentational) — `<GeoJSON>` ของ react-leaflet ไม่ re-render เมื่อ data เปลี่ยน จึง mount map หลังข้อมูลมาแล้วเท่านั้น

- [ ] **Step 1: สร้างหน้า**

Create `pages/admin/smart-water/index.jsx`:

```jsx
// ทะเบียนท่อประปา (กองการประปา) — แผนที่แนวท่อ + อุปกรณ์ อ่านอย่างเดียวในเฟส 1
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import PermissionGuard from "@/components/PermissionGuard";
import PipeLegend from "@/components/smart-water/PipeLegend";

// มี leaflet ข้างใน — โหลดเฉพาะฝั่ง client
const WaterMap = dynamic(() => import("@/components/smart-water/WaterMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-500">
      กำลังโหลดแผนที่...
    </div>
  ),
});

export default function SmartWaterPage() {
  const [pipes, setPipes] = useState(null);
  const [nodes, setNodes] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pRes, nRes] = await Promise.all([
          fetch("/api/smart-water/pipes?format=geojson"),
          fetch("/api/smart-water/nodes?format=geojson"),
        ]);
        if (!pRes.ok || !nRes.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
        const [p, n] = await Promise.all([pRes.json(), nRes.json()]);
        if (cancelled) return;
        setPipes(p);
        setNodes(n);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("โหลดข้อมูลไม่สำเร็จ");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loaded = pipes && nodes;

  return (
    <PermissionGuard>
      <Head>
        <title>ทะเบียนท่อประปา | Smart Takhli</title>
      </Head>
      <div className="flex h-screen flex-col">
        <header className="flex items-center justify-between border-b bg-white px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">
              🚰 ทะเบียนท่อประปา
            </h1>
            <p className="text-xs text-slate-500">
              เทศบาลเมืองตาคลี · กองการประปา
              {loaded &&
                ` · ท่อ ${pipes.features.length} เส้น · อุปกรณ์ ${nodes.features.length} จุด`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/smart-water/report"
              className="rounded-md bg-teal-600 px-3 py-1.5 text-sm text-white hover:bg-teal-700"
            >
              รายงานความยาวท่อ
            </Link>
            <Link
              href="/admin/dashboard"
              className="rounded-md border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              ← กลับ
            </Link>
          </div>
        </header>
        <div className="relative flex-1">
          {error && (
            <div className="flex h-full items-center justify-center text-red-600">
              {error}
            </div>
          )}
          {!error && !loaded && (
            <div className="flex h-full items-center justify-center text-slate-500">
              กำลังโหลดข้อมูล...
            </div>
          )}
          {!error && loaded && <WaterMap pipes={pipes} nodes={nodes} />}
          <PipeLegend />
        </div>
      </div>
    </PermissionGuard>
  );
}
```

- [ ] **Step 2: ทดสอบด้วยมือ**

Run: `npm run dev` แล้วเปิด `http://localhost:3000/admin/smart-water` (login ด้วยบัญชี superadmin)

ตรวจ:
- แผนที่โหลด สีเส้นท่อตรงกับ**รหัส**ตามแบบ: P4 เขียว `#00FF00`, P8 ฟ้า `#00FFFF`, P16 ม่วงบานเย็น `#FF00FF`, A12 ส้ม `#FF7F00`, P2 แดงอิฐ `#DD3700`
- รหัสที่ไม่อยู่ในแบบ (S400, H110, R30, A6, G2) เป็นสีเทา fallback `#666666`
- เส้นท่อใหญ่หนากว่าเส้นเล็ก (ช่วยแยกรหัสที่สีซ้ำกัน) · ท่อ `abandoned` จาง · popup มีความยาวเป็นเมตร
- หัวดับเพลิงเป็นวงกลมแดงทึบ วาล์วเป็นวงกลมเขียวกลวง
- สลับพื้นแผนที่ 3 แบบ (แผนที่/ดาวเทียม/ไฮบริด) ได้จาก control มุมขวาบน
- header บอก `ท่อ 12 เส้น · อุปกรณ์ 11 จุด`
- เปิดด้วยบัญชี admin ที่ไม่มีสิทธิ์ → PermissionGuard บล็อก และ API คืน 403

- [ ] **Step 3: Commit**

```bash
git add pages/admin/smart-water/index.jsx
git commit -m "feat(smart-water): add admin pipe network map page"
```

---

### Task 16: หน้ารายงาน /admin/smart-water/report

**Files:**
- Create: `pages/admin/smart-water/report.jsx`

หน้าลูก — ยืมสิทธิ์หน้าแม่ด้วย `requiredPath="/admin/smart-water"` ใช้ `DashboardHeader` กลางจาก `@/components/ui/adminTheme`

- [ ] **Step 1: สร้างหน้ารายงาน**

Create `pages/admin/smart-water/report.jsx`:

```jsx
// รายงานความยาวท่อประปา — สรุปตามชนิด/ถนน/ปี/สถานะ (หน้าลูกของ /admin/smart-water)
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import PermissionGuard from "@/components/PermissionGuard";
import { DashboardHeader } from "@/components/ui/adminTheme";

const GROUPS = [
  { key: "material", label: "ชนิด/ขนาดท่อ" },
  { key: "road", label: "ถนน" },
  { key: "year", label: "ปีที่วาง" },
  { key: "status", label: "สถานะ" },
];

function labelOf(g) {
  if (g.code) {
    const unit = g.unit === "inch" ? '"' : ` ${g.unit}`;
    return `${g.material} Ø${g.diameterValue}${unit}  (${g.code})`;
  }
  if (g.roadName !== undefined) return g.roadName || "ไม่ระบุถนน";
  if (g.installedYear !== undefined)
    return g.installedYear ? `พ.ศ. ${g.installedYear}` : "ไม่ระบุปี";
  if (g.status !== undefined) return g.status;
  return "-";
}

export default function SmartWaterReportPage() {
  const [groupBy, setGroupBy] = useState("material");
  const [includeAbandoned, setIncludeAbandoned] = useState(false);
  const [rows, setRows] = useState([]);
  const [totalM, setTotalM] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(
      `/api/smart-water/reports/length?groupBy=${groupBy}&includeAbandoned=${includeAbandoned}`
    )
      .then((r) => {
        if (!r.ok) throw new Error("โหลดรายงานไม่สำเร็จ");
        return r.json();
      })
      .then((d) => {
        if (!d.success) throw new Error(d.message || "โหลดรายงานไม่สำเร็จ");
        setRows(d.rows);
        setTotalM(d.grandTotalM);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [groupBy, includeAbandoned]);

  return (
    <PermissionGuard requiredPath="/admin/smart-water">
      <Head>
        <title>รายงานความยาวท่อ | Smart Takhli</title>
      </Head>
      <div className="mx-auto max-w-4xl p-6">
        <DashboardHeader
          icon="🚰"
          title="รายงานความยาวท่อประปา"
          subtitle="เทศบาลเมืองตาคลี · กองการประปา"
          right={
            <Link
              href="/admin/smart-water"
              className="rounded-md border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              ← กลับไปแผนที่
            </Link>
          }
        />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {GROUPS.map((g) => (
              <button
                key={g.key}
                onClick={() => setGroupBy(g.key)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  groupBy === g.key
                    ? "bg-white font-medium text-teal-700 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={includeAbandoned}
              onChange={(e) => setIncludeAbandoned(e.target.checked)}
            />
            รวมท่อที่ยกเลิกใช้งาน
          </label>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {loading && <div className="py-8 text-center text-slate-400">กำลังโหลด...</div>}

        {!loading && !error && (
          <>
            <div className="mb-3 rounded-lg bg-teal-50 p-4">
              <div className="text-xs text-teal-700">ความยาวรวมทั้งหมด</div>
              <div className="text-2xl font-semibold text-teal-800">
                {totalM.toLocaleString("th-TH", { maximumFractionDigits: 2 })} ม.
                <span className="ml-2 text-base font-normal">
                  ({(totalM / 1000).toFixed(3)} กม.)
                </span>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">รายการ</th>
                  <th className="py-2 text-right">จำนวนเส้น</th>
                  <th className="py-2 text-right">ความยาว (ม.)</th>
                  <th className="py-2 text-right">กม.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 text-slate-800">{labelOf(r.group)}</td>
                    <td className="py-2 text-right text-slate-600">{r.count}</td>
                    <td className="py-2 text-right font-medium text-slate-800">
                      {r.totalM.toLocaleString("th-TH", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 text-right text-slate-500">{r.totalKm}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-4 text-xs text-slate-400">
              หมายเหตุ: ความยาวคำนวณจากระยะราบบนแผนที่ (UTM zone 47N)
              ไม่รวมความยาวส่วนเพิ่มจากข้องอและความลึกของท่อ
              ท่อจริงมักยาวกว่าค่านี้ประมาณ 2–5%
            </p>
          </>
        )}
      </div>
    </PermissionGuard>
  );
}
```

- [ ] **Step 2: ทดสอบด้วยมือ**

เปิด `http://localhost:3000/admin/smart-water/report`

ตรวจ:
- ยอดรวมตรงกับที่ seed script พิมพ์ (เมื่อไม่รวมท่อยกเลิก ต้องน้อยกว่าเล็กน้อย)
- สลับ tab เป็น "ถนน" เห็น ถ.พหลโยธิน / ถ.หัสนัย / ถ.วิษณุธรรม / ถ.สนามคลี
- ติ๊ก "รวมท่อที่ยกเลิกใช้งาน" แล้วยอดรวมเพิ่มขึ้น (ท่อ GS 2")
- สลับเป็น "ปีที่วาง" เห็นปี พ.ศ.

- [ ] **Step 3: Commit**

```bash
git add pages/admin/smart-water/report.jsx
git commit -m "feat(smart-water): add pipe length report page"
```

---

### Task 17: เอกสารโมดูล (บังคับตามกติกา repo)

**Files:**
- Create: `docs/modules/smart-water.md`
- Modify: `docs/modules/README.md` (เพิ่มแถวในตาราง)
- Modify: `CLAUDE.md` (เพิ่ม bullet ในหัวข้อ Feature modules)

- [ ] **Step 1: สร้าง docs/modules/smart-water.md**

```markdown
# Smart Water — ทะเบียนท่อประปา (กองการประปา)

ทะเบียนท่อประปาและอุปกรณ์ของเทศบาลเมืองตาคลี — เก็บแนวท่อเป็น GeoJSON LineString
และอุปกรณ์ (วาล์ว/หัวดับเพลิง/จุดจ่าย/END CAP/มาตรวัด/จุดระบายตะกอน) เป็น Point
derive `code` (P4/S400/R30 ฯลฯ), `diameterMm`, `lengthM` อัตโนมัติทุกครั้งที่เขียน

## โครงไฟล์

- หน้า: `pages/admin/smart-water/index.jsx` (แผนที่ read-only), `pages/admin/smart-water/report.jsx` (รายงานความยาว — หน้าลูก ยืมสิทธิ์หน้าแม่)
- API: `pages/api/smart-water/` — `pipes/`, `nodes/`, `reports/length` (ทุกตัวผ่าน `_auth.ts#requireSmartWaterAdmin`)
- Logic: `lib/smart-water/` — pure functions + เทสต์ colocate (`*.test.ts`)
- Components: `components/smart-water/` — `WaterMap.js` (react-leaflet, dynamic ssr:false), `PipeLegend.js`
- Scripts: `scripts/seed-water.ts` (seed + index — idempotent), `scripts/grant-smart-water-permission.js`

## Collections

- `water_pipes` — LineString + `material`, `diameter {value, unit}`, `status`, `roadName`, `installedYear`, derived: `code`, `diameterMm`, `lengthM`, `bbox` · soft delete ด้วย `deletedAt`
- `water_nodes` — Point + `type`, `hydrantNo` (unique partial), `condition`, `onPipeId`
- ใช้ native MongoDB driver ผ่าน `lib/mongoNative.ts` (client แชร์กับโมดูล garbage) — ไม่ใช่ Mongoose

## กติกาสำคัญ

1. **ทุกการเขียนต้องผ่าน `lib/smart-water/service.ts`** (`savePipe`/`saveNode`) — ห้าม API เขียน collection ตรง ไม่งั้นฟิลด์ derive ไม่อัปเดต
2. รหัสท่อ: ตัวอักษร A/G/H/P/S/R + ตัวเลขขนาด — หน่วยต่างกันตามชนิด (นิ้ว/มม./ซม.) ดู `constants.ts`
   สีบนแผนที่ผูกกับ**รหัส** (`CODE_COLORS` อ่านจากแบบร่าง 2568) ไม่ใช่ชนิดวัสดุ — ห้ามเปลี่ยนไประบายตาม material เพราะจะไม่ตรงกับแบบที่กองการประปาใช้ (รหัสนอกแบบเป็นสีเทา fallback)
3. ความยาว `lengthM` = ระยะราบบน UTM 47N — ไม่ใช่ความยาวท่อจริง (จริงยาวกว่า ~2–5%)
4. สิทธิ์: `/admin/smart-water` **ไม่อยู่ใน DEFAULT_PERMISSIONS** — superadmin ติ๊กรายคน (หรือ `scripts/grant-smart-water-permission.js --yes` เพิ่มให้ user ที่มี custom allowedPages ทั้งหมด)
5. Seed (`scripts/seed-water.ts`) เป็น**ข้อมูลทดสอบพิกัดสมมติ** — ลบ/เขียนเฉพาะเอกสารที่แท็ก `SEED-DATA` รันซ้ำได้ ห้ามเอาตัวเลขไปใช้ในรายงานจริง

## Roadmap

- เฟส 1 (ปัจจุบัน): ทะเบียน + แผนที่ read-only + รายงานความยาว
- เฟส 2: บันทึกการเป่าตะกอน (flushing), หน้ามือถือ, calibrate ด้วย bucket test
- เฟส 3+: งานซ่อม (repair jobs), topology graph, editor ลากเส้นบนแผนที่ (leaflet-geoman), import จาก PDF จริง
```

- [ ] **Step 2: เพิ่มแถวใน docs/modules/README.md**

เพิ่มในตารางโมดูล (ต่อจากแถว Smart Waste):

```markdown
| ทะเบียนท่อประปา (Smart Water) | [smart-water.md](smart-water.md) | `/admin/smart-water` |
```

- [ ] **Step 3: เพิ่ม bullet ใน CLAUDE.md**

ในหัวข้อ "Feature modules" เพิ่มต่อจาก bullet ของ Smart Light:

```markdown
- **Smart Water / ทะเบียนท่อประปา (กองการประปา)** — โมดูล `smart-water`: ทะเบียนท่อ (LineString) + อุปกรณ์ (Point) ใน collections `water_pipes`/`water_nodes` ผ่าน native driver (`lib/mongoNative.ts` — client แชร์กับโมดูล garbage), ทุกการเขียนผ่าน `lib/smart-water/service.ts` ที่ derive `code`/`diameterMm`/`lengthM` อัตโนมัติ (ความยาวคำนวณบน UTM 47N ด้วย proj4), หน้า `/admin/smart-water` (แผนที่ react-leaflet) + `/report`, seed/สคริปต์ `.ts` รันด้วย `node --env-file=.env.local --import tsx scripts/<file>.ts`
```

- [ ] **Step 4: Commit**

```bash
git add docs/modules/smart-water.md docs/modules/README.md CLAUDE.md
git commit -m "docs(smart-water): add module documentation"
```

---

### Task 18: ตรวจสุดท้ายทั้งระบบ

- [ ] **Step 1: รัน test ทั้งหมด**

Run: `npm test`
Expected: PASS ทั้งหมด — เทสต์เดิม (garbage/smart-light) + ใหม่ 34 test ใน `lib/smart-water/` (pipe-code 16, geo 7, service 6, reports 5)

- [ ] **Step 2: ตรวจ type**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 3: ตรวจ lint + build**

Run: `npm run lint && npm run build`
Expected: build สำเร็จ ไม่มี error

- [ ] **Step 4: Manual checklist รอบสุดท้าย**

| ที่ | สิ่งที่ต้องเห็น |
|---|---|
| เมนู sidebar (superadmin) | มีรายการ "ทะเบียนท่อประปา" 🚰 กลุ่ม จัดการ |
| `/admin/superadmin` permission UI | มีหน้า "ทะเบียนท่อประปา" ให้ติ๊ก |
| `/admin/smart-water` | แผนที่ + เส้นท่อสีตามรหัส (CODE_COLORS ตรงแบบ 2568) + popup ความยาว + legend |
| `/admin/smart-water/report` | ตารางสลับ 4 มุมมอง ยอดรวมตรง seed |
| `/api/smart-water/pipes?format=geojson` | FeatureCollection 12 features (login แล้ว) |
| `/api/smart-water/pipes` โดยไม่ login | 401 |
| admin ไม่มีสิทธิ์หน้านี้เรียก API | 403 "ไม่มีสิทธิ์หน้านี้" |

- [ ] **Step 5: Commit tag**

```bash
git commit --allow-empty -m "chore(smart-water): phase 1 complete"
git tag smart-water-phase1
```

---

## ภาคผนวก ก — สรุปสิ่งที่ต่างจากแผนร่างแรก (เหตุผลอยู่ในบันทึกรีวิว)

| เดิม | ใหม่ | เพราะ |
|---|---|---|
| `lib/mongodb.ts` ใหม่ + `MONGODB_URI` | `lib/mongoNative.ts` สกัดจาก garbage + `MONGO_URI` | ไฟล์เดิมไม่มีจริง env ผิดตัว และห้ามเปิด client ซ้อน |
| เช็คแค่ `getAuth()` | `_auth.ts` แบบ garbage (appId + allowedPages + isActive) | Clerk org แชร์ข้ามแอป — แค่ login ไม่พอ |
| `pages/water/*` (public) | `pages/admin/smart-water/*` + ลงทะเบียน 4 จุด | ผู้ใช้ยืนยัน: admin ล้วน |
| สร้าง `vitest.config.ts` + `tests/` | ใช้ `vitest.config.mjs` เดิม + เทสต์ colocate `lib/**` | config ใหม่จะทับของเดิม ทำเทสต์ garbage หายเงียบ |
| Leaflet ดิบ | react-leaflet v5 + `BaseLayersControl` กลาง | v5 ใช้กับ React 19 ทั่ว repo อยู่แล้ว |
| seed `deleteMany` ทั้ง collection | ลบเฉพาะแท็ก `SEED-DATA` | กันข้อมูลจริงหายในอนาคต |
| ฟิลด์ `orgId: 'takhli'` | ไม่มี tenant key | collection รายโมดูลของ repo นี้ไม่ใส่ (ตามแบบ street_light_poles) |
| สีตาม material (`PIPE_MATERIALS.color`) | สีตามรหัสท่อ (`CODE_COLORS` อ่านจากแบบร่าง 2568) + fallback เทา | สีในแบบจริงผูกกับขนาด ไม่ใช่ชนิด — ระบายตาม material จะเขียวทั้งจอ กองการประปาอ่านไม่ออก |
| `listPipes` limit default 2000 | default 5000 / cap 10000 | ข้อมูลจริง 2,096 เส้น เกิน 2000 พอดี — จะโดนตัดทิ้งเงียบ ๆ |
| script รันด้วย `tsx` (ไม่ได้ติดตั้ง) | ติดตั้ง `tsx` เป็น devDep + `node --env-file --import tsx` | ตาม convention env-file ของ repo |

## ภาคผนวก ข — ตรวจ PDF ว่าดึงเส้นออกได้ไหม (ทำแยกจากแผนนี้ เมื่อได้ไฟล์จริง)

```bash
# 1. เป็น vector หรือ scan?
pdffonts map.pdf          # มี font = vector
pdfimages -list map.pdf   # ถ้ามีรูปเต็มหน้า = scan

# 2. มี geo-reference ฝังมาไหม (PDF ที่ export จาก QGIS/ArcGIS มักมี)
ogrinfo map.pdf

# 3. ถ้ามี → ดึงตรงได้เลย
ogr2ogr -f GeoJSON pipes.geojson map.pdf

# 4. ถ้าไม่มี → แปลงเป็น SVG แล้วแยกเส้นตามสี stroke
pdftocairo -svg -f 1 -l 1 map.pdf map.svg
grep -o 'stroke:#[0-9a-fA-F]*' map.svg | sort | uniq -c | sort -rn
```

**คำสั่งที่ 4 สำคัญที่สุด** — จะบอกว่ามีสี stroke กี่สี แต่ละสีมีกี่เส้น ถ้าสีตรงกับ legend (เขียว/น้ำเงิน/แดง/ส้ม/เทา) แสดงว่า map สี→รหัสท่อ แล้วเขียนโปรแกรม import อัตโนมัติได้

## เฟส 2 (แยกแผน — ยังไม่รวมในนี้)

- บันทึกการเป่าตะกอน (`flushingRecords`) + หน้ามือถือ
- calibrate อัตราไหลด้วย bucket test
- รายงานปริมาณน้ำสูญเสียจากการเป่า

## เฟส 3+ (ยังไม่เขียน)

- งานซ่อมท่อ (`repairJobs`) + ผูกกับ workflow ซ่อมเสร็จต้องปิดงาน
- Topology graph + suggest-flush-points
- Editor ลากเส้นบนแผนที่ (leaflet-geoman)
- Import จาก PDF
