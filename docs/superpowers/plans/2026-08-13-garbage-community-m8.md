# ผูกจุดเก็บกับชุมชน (M8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ค้นด้วยชื่อชุมชนกลับมาใช้ได้ โดยผูกจุดเก็บแต่ละจุดกับชุมชนจากพิกัดจริง (ไม่ใช่เดาจากชื่อ) แล้วให้เจ้าหน้าที่ตรวจและเติมส่วนที่ระบบทำแทนไม่ได้

**Architecture:** จับคู่ชื่อจุด → ถนนใน `roads` → ยิง `$geoIntersects` กับ polygon ใน `geojsonfeatures` → ได้ชื่อชุมชน · ทำได้ 62/145 จุด ที่เหลือเป็นโรงเรียน/หมู่บ้าน/ตลาดซึ่งไม่ใช่ถนน ต้องให้เจ้าหน้าที่เลือกจาก dropdown · แยก `communitySource` เป็น auto/manual เพื่อไม่ให้สคริปต์ทับงานที่คนยืนยันแล้ว

**Tech Stack:** Next.js 15 Pages Router, TypeScript strict, MongoDB native driver, Zod, Vitest

**Spec:** `docs/superpowers/specs/2026-08-13-garbage-community-mapping-design.md`

**Branch:** `feat/garbage-community` (stacked ชั้นที่ 5 บน `feat/garbage-real-schedule`) **ห้ามสลับ branch**

---

## บริบทที่ผู้รับงานต้องรู้ก่อนเริ่ม

**สถานะข้อมูลตอนนี้:** `garbage_assignments` 56 · `garbage_routes` 8 (R1–R7, R13) · `garbage_trucks` 8 · `garbage_communities` **ลบทิ้งแล้ว 0 เอกสาร** (เป็นชุดจากโปสเตอร์ที่เขียนคลาด) · `roads` 532 เส้น (269 มีชื่อ, มี `centroid` และ 2dsphere index) · `geojsonfeatures` 22 polygon ชุมชน

**กฎที่พลาดง่าย:**

1. **`geojsonfeatures` เป็นของแอปอื่น (`appId: "app_b"`)** — อ่านอย่างเดียว **ห้ามเขียน ห้ามลบ ห้ามสร้าง index บนมัน** · `$geoIntersects` ไม่ต้องใช้ index อยู่แล้ว
2. **ห้ามอ่าน `garbage_communities`** — ว่างแล้วและเลิกใช้ ชื่อชุมชนต้องมาจาก `geojsonfeatures.name` เท่านั้น
3. **ชื่อซอยไม่สัมพันธ์กับชื่อชุมชน** — เช่น "ซ.มาลัย2" อยู่ในชุมชนรจนา ไม่ใช่ชุมชนมาลัย · ห้ามเดาจากชื่อเด็ดขาด ต้องใช้พิกัด
4. API โมดูลนี้คืน `{ error: string }` · ห้ามฟอร์แมตเวลาเอง · collection ต้อง prefix `garbage_`
5. `logAuditEvent` กลืน error — action ใหม่ต้องลงทะเบียน 4 จุด รวม mongoose `enum` ใน `models/AuditLog.js`
6. เทส colocate (`lib/garbage/*.test.ts`) · ปิด dev server ก่อน `npm run build`

**Baseline:** `npm test` = 185 passed | 2 skipped

---

## Task 1: helper กลางสำหรับ normalize ชื่อ

`pages/api/garbage/search.ts` มีฟังก์ชัน `norm()` อยู่ในไฟล์ ซึ่งสคริปต์จับคู่ถนนต้องใช้กฎเดียวกันเป๊ะ ไม่งั้นจับคู่ได้คนละแบบกับที่ผู้ใช้ค้นเจอ

**Files:**
- Create: `lib/garbage/community.ts`
- Test: `lib/garbage/community.test.ts`
- Modify: `pages/api/garbage/search.ts`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```ts
import { describe, it, expect } from "vitest";
import { normalizePlaceName, pickCommunity } from "./community";

describe("normalizePlaceName", () => {
  it("ตัดคำนำหน้าถนน/ซอย/ชุมชนออก", () => {
    expect(normalizePlaceName("ถนนมาลัย")).toBe(normalizePlaceName("มาลัย"));
    expect(normalizePlaceName("ถ.มาลัย")).toBe(normalizePlaceName("มาลัย"));
    expect(normalizePlaceName("ซอยมาลัย")).toBe(normalizePlaceName("มาลัย"));
    expect(normalizePlaceName("ซ.มาลัย")).toBe(normalizePlaceName("มาลัย"));
    expect(normalizePlaceName("ชุมชนมาลัย")).toBe(normalizePlaceName("มาลัย"));
  });

  it("ตัดช่องว่างและแปลงเป็นตัวพิมพ์เล็ก", () => {
    expect(normalizePlaceName("  ซ.เจ้าเงาะ 5  ")).toBe(normalizePlaceName("เจ้าเงาะ5"));
    expect(normalizePlaceName("ABC")).toBe(normalizePlaceName("abc"));
  });

  it("ตัดคำนำหน้าแค่ชั้นเดียว ไม่กินชื่อจริง", () => {
    // "ซอยซ่อนกลิ่น" ตัด "ซอย" แล้วต้องเหลือ "ซ่อนกลิ่น" ไม่ใช่ตัดซ้ำจนเหลือ "อนกลิ่น"
    expect(normalizePlaceName("ซอยซ่อนกลิ่น")).toBe(normalizePlaceName("ซ่อนกลิ่น"));
  });

  it("รับค่าว่างได้", () => {
    expect(normalizePlaceName("")).toBe("");
    expect(normalizePlaceName(null)).toBe("");
  });
});

describe("pickCommunity", () => {
  it("ไม่มี polygon ตรงเลย = null", () => {
    expect(pickCommunity([])).toBeNull();
  });

  it("ตรงอันเดียว = อันนั้น", () => {
    expect(pickCommunity([{ name: "มาลัย" }])).toBe("มาลัย");
  });

  it("ซ้อนกันหลายอัน = เลือกแบบกำหนดแน่นอน (เรียงชื่อแล้วเอาตัวแรก)", () => {
    // จุดที่ตกในพื้นที่ทับซ้อนต้องได้คำตอบเดิมทุกครั้ง ไม่ขึ้นกับลำดับที่ DB คืนมา
    expect(pickCommunity([{ name: "รจนา" }, { name: "มาลัย" }])).toBe("มาลัย");
    expect(pickCommunity([{ name: "มาลัย" }, { name: "รจนา" }])).toBe("มาลัย");
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run lib/garbage/community.test.ts`
Expected: FAIL — `Failed to resolve import "./community"`

- [ ] **Step 3: เขียน implementation**

```ts
/** คำนำหน้าที่ตัดทิ้งตอนจับคู่ชื่อ — ต้องตรงกับที่หน้าค้นหาใช้ ไม่งั้นจับคู่คนละแบบกับที่ผู้ใช้เจอ */
const PREFIX_RE = /^(ถนน|ถ\.\s*|ซอย|ซ\.\s*|ชุมชน)\s*/u;

/**
 * ทำให้ชื่อสถานที่เทียบกันได้ — ตัดคำนำหน้า (ชั้นเดียว) ตัดช่องว่าง แปลงเป็นตัวพิมพ์เล็ก
 * ใช้ทั้งตอนค้นหาและตอนจับคู่จุดเก็บกับถนน
 */
export function normalizePlaceName(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFC")
    .trim()
    .replace(PREFIX_RE, "")
    .replace(/\s/gu, "")
    .toLowerCase();
}

/**
 * เลือกชุมชนจาก polygon ที่จุดตกอยู่
 * พื้นที่ทับซ้อนต้องได้คำตอบเดิมทุกครั้ง จึงเรียงชื่อแล้วเอาตัวแรก ไม่ใช่เชื่อลำดับที่ DB คืนมา
 */
export function pickCommunity(matches: Array<{ name: string }>): string | null {
  if (matches.length === 0) return null;
  return [...matches].map((m) => m.name).sort((a, b) => a.localeCompare(b, "th"))[0];
}
```

- [ ] **Step 4: ให้ `search.ts` ใช้ helper กลาง**

ลบฟังก์ชัน `norm` ที่ประกาศในไฟล์นั้นออก แล้ว import แทน:

```ts
import { normalizePlaceName } from "@/lib/garbage/community";
```

เปลี่ยนจุดเรียกใช้ `norm(...)` เป็น `normalizePlaceName(...)` ทุกที่ · **ยืนยันว่าผลค้นหาไม่เปลี่ยน** ด้วยการรัน curl หลัง dev server ขึ้น: `q=มาลัย` ต้องได้จำนวนผลเท่าเดิม

- [ ] **Step 5: รันเทสให้ผ่าน**

Run: `npx vitest run lib/garbage/community.test.ts && npx tsc --noEmit && npm test`

- [ ] **Step 6: Commit**

```bash
git add lib/garbage/community.ts lib/garbage/community.test.ts pages/api/garbage/search.ts
git commit -m "refactor: รวมกฎ normalize ชื่อสถานที่ไว้ที่เดียว"
```

---

## Task 2: ฟิลด์ชุมชนใน `RouteStop`

**Files:**
- Modify: `types/garbage.ts`
- Modify: `lib/garbage/validators.ts`

- [ ] **Step 1: เพิ่มฟิลด์ใน `types/garbage.ts`**

ใน `interface RouteStop` เพิ่ม:

```ts
  /** ชื่อชุมชนที่จุดนี้อยู่ — อ้างชื่อจาก geojsonfeatures.name (ห้ามใช้ garbage_communities ที่เลิกใช้แล้ว) */
  communityName?: string | null;
  /** "auto" = ระบบเดาจากถนน+polygon ยังไม่มีคนตรวจ · "manual" = เจ้าหน้าที่ยืนยันแล้ว */
  communitySource?: "auto" | "manual" | null;
```

- [ ] **Step 2: ให้ `stopDraftSchema` รับค่าใหม่**

ใน `lib/garbage/validators.ts` เพิ่มสองฟิลด์ใน `stopDraftSchema` (ยังคง `.strict()` ไว้):

```ts
    communityName: z.string().trim().min(1).max(120).nullable().optional(),
```

**ไม่รับ `communitySource` จาก client** — เซิร์ฟเวอร์เป็นคนตั้งเป็น `"manual"` เสมอเมื่อบันทึกจากฟอร์ม (การกดบันทึกคือการยืนยัน) ใส่คอมเมนต์กำกับไว้

- [ ] **Step 3: ยืนยัน**

Run: `npx tsc --noEmit && npm test`

- [ ] **Step 4: Commit**

```bash
git add types/garbage.ts lib/garbage/validators.ts
git commit -m "feat: เพิ่มฟิลด์ชุมชนของจุดเก็บ"
```

---

## Task 3: สคริปต์เติมชุมชนอัตโนมัติ

**Files:**
- Create: `scripts/map-garbage-communities.mjs`
- Modify: `lib/auditLogger.ts`, `models/AuditLog.js`, `pages/admin/superadmin/audit-log.tsx`

- [ ] **Step 1: ลงทะเบียน audit action ครบ 4 จุด**

action `garbage_communities_mapped` (resourceType ใช้ `system` ที่มีอยู่แล้ว) — เพิ่มใน union ของ `lib/auditLogger.ts`, `enum` ของ `models/AuditLog.js`, `ACTION_LABELS` (`'ผูกชุมชนให้จุดเก็บ'`) และ `ACTION_COLORS` (`'badge-info'`)

- [ ] **Step 2: เขียนสคริปต์**

```js
#!/usr/bin/env node
/**
 * เติมชื่อชุมชนให้จุดเก็บจากพิกัดจริง
 *   node --env-file=.env.local scripts/map-garbage-communities.mjs        (dry-run)
 *   node --env-file=.env.local scripts/map-garbage-communities.mjs --yes  (เขียนจริง)
 *
 * วิธี: ชื่อจุด → หาถนนใน roads (ชื่อหรือ alias) → centroid ของถนน → $geoIntersects กับ
 * polygon ใน geojsonfeatures → ได้ชื่อชุมชน
 *
 * ชื่อซอยไม่สัมพันธ์กับชื่อชุมชน (เช่น "ซ.มาลัย2" อยู่ในชุมชนรจนา) จึงห้ามเดาจากชื่อ
 * geojsonfeatures เป็นของแอปอื่น (appId app_b) — อ่านอย่างเดียว ห้ามเขียน/สร้าง index
 * ห้ามทับจุดที่ communitySource === "manual" — งานที่เจ้าหน้าที่ยืนยันแล้วชนะเสมอ
 */
import { MongoClient } from "mongodb";

const PREFIX_RE = /^(ถนน|ถ\.\s*|ซอย|ซ\.\s*|ชุมชน)\s*/u;
// สำเนากฎจาก lib/garbage/community.ts — .mjs import .ts ไม่ได้ แก้ที่ไหนต้องแก้อีกที่
const norm = (s) =>
  String(s ?? "").normalize("NFC").trim().replace(PREFIX_RE, "").replace(/\s/gu, "").toLowerCase();

const confirmed = process.argv.includes("--yes");
const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("ต้องตั้งค่า MONGO_URI (รันด้วย node --env-file=.env.local)");
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.MONGODB_DB || undefined);

const roads = await db.collection("roads")
  .find({ active: true, centroid: { $exists: true } })
  .project({ roadId: 1, name: 1, aliases: 1, centroid: 1 })
  .toArray();

// ดัชนีชื่อ→ถนน · ชื่อซ้ำให้ตัวแรกชนะแบบกำหนดแน่นอน (เรียงตาม roadId ก่อน)
roads.sort((a, b) => String(a.roadId).localeCompare(String(b.roadId)));
const roadIdx = new Map();
for (const r of roads) {
  for (const n of [r.name, ...(r.aliases ?? [])]) {
    const k = norm(n);
    if (k && !roadIdx.has(k)) roadIdx.set(k, r);
  }
}

const geo = db.collection("geojsonfeatures");
const routes = await db.collection("garbage_routes").find({}).toArray();

let filled = 0, kept = 0, noRoad = 0, noPolygon = 0;
const unresolved = [];
const updates = [];

for (const route of routes) {
  const nextStops = [];
  let changed = false;
  for (const s of route.stops) {
    if (s.communitySource === "manual") {
      kept++;
      nextStops.push(s);
      continue;
    }
    const road = roadIdx.get(norm(s.name));
    if (!road) {
      noRoad++;
      unresolved.push(`${route.code} · ${s.name} (ไม่พบถนนชื่อนี้)`);
      nextStops.push(s);
      continue;
    }
    const hits = await geo
      .find({ active: true, geometry: { $geoIntersects: { $geometry: road.centroid } } })
      .project({ name: 1 })
      .toArray();
    if (hits.length === 0) {
      noPolygon++;
      unresolved.push(`${route.code} · ${s.name} (ถนน ${road.name} ไม่ตกในชุมชนใด)`);
      nextStops.push({ ...s, roadId: road.roadId });
      changed = true;
      continue;
    }
    const name = hits.map((h) => h.name).sort((a, b) => a.localeCompare(b, "th"))[0];
    nextStops.push({ ...s, roadId: road.roadId, communityName: name, communitySource: "auto" });
    filled++;
    changed = true;
  }
  if (changed) updates.push({ code: route.code, stops: nextStops });
}

console.log(`เติมชุมชนได้ ${filled} จุด · คงค่าที่เจ้าหน้าที่ยืนยันไว้ ${kept} จุด`);
console.log(`เติมไม่ได้ ${noRoad + noPolygon} จุด (ไม่พบถนน ${noRoad} · ถนนไม่ตกในชุมชน ${noPolygon})`);
console.log(`\nจุดที่ต้องให้เจ้าหน้าที่เลือกเอง ${unresolved.length} รายการ:`);
unresolved.slice(0, 25).forEach((u) => console.log("  " + u));
if (unresolved.length > 25) console.log(`  … และอีก ${unresolved.length - 25} รายการ`);

if (!confirmed) {
  console.log("\ndry-run: ยังไม่เขียนฐานข้อมูล (ใส่ --yes เพื่อเขียนจริง)");
  await client.close();
  process.exit(0);
}

const now = new Date();
for (const u of updates) {
  await db.collection("garbage_routes").updateOne(
    { code: u.code },
    { $set: { stops: u.stops, updatedAt: now } }
  );
}
await db.collection("auditlogs").insertOne({
  actorClerkId: "script",
  actorName: "map-garbage-communities.mjs",
  action: "garbage_communities_mapped",
  resourceType: "system",
  resourceId: "garbage_routes",
  description: `ผูกชุมชนให้จุดเก็บ ${filled} จุด (คงค่าที่ยืนยันแล้ว ${kept} จุด · เติมไม่ได้ ${unresolved.length} จุด)`,
  meta: { filled, kept, unresolved: unresolved.length },
  createdAt: now,
  updatedAt: now,
});

console.log(`\nเขียนแล้ว: แก้ ${updates.length} สาย · เติมชุมชน ${filled} จุด`);
await client.close();
```

- [ ] **Step 3: dry-run**

Run: `node --env-file=.env.local scripts/map-garbage-communities.mjs`
Expected: `เติมชุมชนได้ 62 จุด` (± เล็กน้อยได้ถ้าจุดซ้ำข้ามสาย) และรายการจุดที่เติมไม่ได้เป็นพวกโรงเรียน/หมู่บ้าน/ตลาด · **ถ้าตัวเลขต่างจาก 62 มากให้หยุดและรายงาน**

- [ ] **Step 4: Commit** (ยังไม่รันจริง)

```bash
git add scripts/map-garbage-communities.mjs lib/auditLogger.ts models/AuditLog.js pages/admin/superadmin/audit-log.tsx
git commit -m "feat: สคริปต์ผูกชุมชนให้จุดเก็บจากพิกัดจริง"
```

---

## Task 4: รันจริงและตรวจ

- [ ] **Step 1: รันจริง**

Run: `node --env-file=.env.local scripts/map-garbage-communities.mjs --yes`

- [ ] **Step 2: ตรวจกับข้อมูลจริง (read-only probe ในสแครชแพด)**

ยืนยันทั้งหมดนี้:
- ถนนดอกไม้แดง (R1) → `communityName` เป็น "มาลัย", `communitySource` เป็น "auto", มี `roadId`
- ถนนเจ้าเงาะ → "เขาใบไม้"
- **ซ.มาลัย 2 → "รจนา" ไม่ใช่ "มาลัย"** (พิสูจน์ว่าใช้พิกัดจริง ไม่ได้เดาจากชื่อ)
- ชื่อชุมชนที่เติมทุกค่า อยู่ใน 22 ชื่อของ `geojsonfeatures` จริง
- `geojsonfeatures` ยังมี 22 เอกสารและ index เท่าเดิม (ไม่ถูกแตะ)
- audit มี `garbage_communities_mapped` 1 รายการ

- [ ] **Step 3: รันซ้ำต้องไม่เปลี่ยนอะไร**

Run สคริปต์ `--yes` อีกครั้ง → ตัวเลข `เติมชุมชนได้` เท่าเดิม (idempotent เพราะคำนวณจากพิกัดเดิม) และไม่มี error

---

## Task 5: API รายชื่อชุมชน

**Files:**
- Create: `pages/api/garbage/communities.ts`

- [ ] **Step 1: เขียน API route**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/garbage/db";
import { requireGarbageAdmin } from "./_auth";

/**
 * รายชื่อชุมชนสำหรับ dropdown ในหน้าแอดมิน
 * อ่านจาก geojsonfeatures ซึ่งเป็นของแอปอื่น (appId app_b) — อ่านอย่างเดียว
 * ไม่ส่ง geometry ออก (payload ใหญ่และหน้าแอดมินไม่ได้ใช้)
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
    console.error("[garbage/communities] auth", err);
    return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  }
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    const db = await getDb();
    const docs = await db
      .collection("geojsonfeatures")
      .find({ active: true })
      .project({ name: 1, _id: 0 })
      .toArray();
    const names = docs
      .map((d) => String(d.name))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "th"));
    return res.status(200).json({ communities: names });
  } catch (err) {
    console.error("[garbage/communities] GET", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอ่านข้อมูล" });
  }
}
```

- [ ] **Step 2: ทดสอบ**

```bash
curl -s -o /dev/null -w "GET ไม่ล็อกอิน: %{http_code}\n" "http://localhost:3000/api/garbage/communities"
curl -s -o /dev/null -w "POST: %{http_code}\n" -X POST "http://localhost:3000/api/garbage/communities"
```
Expected: `401` · `405`

- [ ] **Step 3: Commit**

```bash
git add pages/api/garbage/communities.ts
git commit -m "feat: add admin community list API"
```

---

## Task 6: ตรวจชื่อชุมชนฝั่งเซิร์ฟเวอร์ตอนบันทึกสาย

**Files:**
- Modify: `pages/api/garbage/routes/[code].ts`

- [ ] **Step 1: ตรวจชื่อและตั้ง source**

ใน handler หลัง validate ด้วย `routeUpdateSchema` แล้ว เพิ่มการตรวจว่าชื่อชุมชนที่ส่งมาอยู่ในรายการจริง (กันพิมพ์ผิดแล้วค้นไม่เจอตลอดไป):

```ts
    // ชื่อชุมชนต้องเป็นชื่อจริงจาก geojsonfeatures — พิมพ์ผิดแล้วจะค้นไม่เจอตลอดไป
    const wanted = [...new Set(input.stops.map((s) => s.communityName).filter(Boolean))];
    if (wanted.length > 0) {
      const db = await getDb();
      const found = await db
        .collection("geojsonfeatures")
        .find({ active: true, name: { $in: wanted } })
        .project({ name: 1 })
        .toArray();
      const ok = new Set(found.map((f) => String(f.name)));
      const bad = wanted.filter((w) => !ok.has(w as string));
      if (bad.length > 0) {
        return res.status(400).json({ error: `ไม่รู้จักชุมชน: ${bad.join(", ")}` });
      }
    }
```

(ต้อง import `getDb` จาก `@/lib/garbage/db` เพิ่ม)

จากนั้นตอนสร้าง `nextStops` ให้พา `communityName` ไปด้วย และตั้ง `communitySource` เป็น `"manual"` เมื่อมีค่า — การกดบันทึกคือการยืนยัน:

```ts
    const nextStops = assignSeq(input.stops).map((s, i) => ({
      ...s,
      communityName: input.stops[i].communityName ?? null,
      communitySource: input.stops[i].communityName ? "manual" : null,
    }));
```

**หมายเหตุ:** `assignSeq` คืนจุดตามลำดับที่ส่งมา ดัชนี `i` จึงตรงกับ `input.stops[i]` เสมอ

- [ ] **Step 2: ยืนยัน**

Run: `npx tsc --noEmit && npm test`
และ `curl -X PUT` ไม่ล็อกอินยังได้ 401 เหมือนเดิม

- [ ] **Step 3: Commit**

```bash
git add "pages/api/garbage/routes/[code].ts"
git commit -m "feat: ตรวจชื่อชุมชนตอนบันทึกและตั้งเป็น manual"
```

---

## Task 7: dropdown ชุมชนในหน้าแอดมิน

**Files:**
- Modify: `components/garbage/admin/RouteManagerModal.jsx`
- Modify: `pages/admin/garbage.jsx`

- [ ] **Step 1: หน้าแอดมินโหลดรายชื่อชุมชนแล้วส่งเข้า modal**

ใน `pages/admin/garbage.jsx` เพิ่ม state + fetch (แนวเดียวกับ `fetchRoutes` ที่มีอยู่) แล้วส่ง prop `communities` เข้า `RouteManagerModal`:

```jsx
  const [communities, setCommunities] = useState([]);

  const fetchCommunities = useCallback(async () => {
    try {
      const res = await fetch('/api/garbage/communities');
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'โหลดรายชื่อชุมชนไม่สำเร็จ');
      if (mountedRef.current) setCommunities(json.communities ?? []);
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'โหลดรายชื่อชุมชนไม่สำเร็จ', text: e.message });
    }
  }, []);

  useEffect(() => { fetchCommunities(); }, [fetchCommunities]);
```

- [ ] **Step 2: `RouteManagerModal` แสดง dropdown ต่อจุด**

รับ prop `communities` เพิ่ม · ตอนโหลดสายเข้า state ให้พา `communityName`/`communitySource` มาด้วย:

```jsx
    setStops(r.stops.map((s) => ({
      prevSeq: s.seq, name: s.name, mode: s.mode, roadId: s.roadId ?? null,
      communityName: s.communityName ?? '', communitySource: s.communitySource ?? null,
    })));
```

เพิ่มตัวนับความคืบหน้าเหนือรายการจุด (ต่อจากบรรทัด "จุดเก็บ (N)"):

```jsx
          <span className="text-[11.5px] text-[#8A8398]">
            ระบุชุมชนแล้ว {stops.filter((s) => s.communityName).length}/{stops.length}
            {stops.some((s) => s.communitySource === 'auto') &&
              ` · รอตรวจ ${stops.filter((s) => s.communitySource === 'auto').length}`}
          </span>
```

และในแต่ละแถวจุด เพิ่ม dropdown ต่อจากช่องเลือกวิธีเก็บ:

```jsx
                <select
                  className={'rounded-[10px] border px-1 py-1 text-[11.5px] max-w-[9rem] ' +
                    (s.communitySource === 'auto'
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-[#E7E2F2]')}
                  value={s.communityName || ''}
                  aria-label={`ชุมชนของจุดลำดับที่ ${i + 1}`}
                  title={s.communitySource === 'auto' ? 'ระบบเติมให้ ยังไม่มีคนตรวจ' : ''}
                  onChange={(e) => {
                    const next = [...stops];
                    next[i] = { ...s, communityName: e.target.value, communitySource: e.target.value ? 'manual' : null };
                    setStops(next);
                  }}>
                  <option value="">— ชุมชน —</option>
                  {communities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
```

และตอนส่ง PUT ให้พา `communityName` ไปด้วย (ส่ง null เมื่อว่าง):

```jsx
        stops: stops.map((s) => ({
          prevSeq: s.prevSeq, name: s.name, mode: s.mode, roadId: s.roadId ?? null,
          communityName: s.communityName || null,
        })),
```

- [ ] **Step 3: ยืนยัน**

Run: `npx tsc --noEmit && npm run lint && npm run build`

- [ ] **Step 4: Commit**

```bash
git add components/garbage/admin/RouteManagerModal.jsx pages/admin/garbage.jsx
git commit -m "feat: เลือกชุมชนของแต่ละจุดในหน้าแอดมิน"
```

---

## Task 8: ค้นด้วยชื่อชุมชนกลับมาใช้ได้

**Files:**
- Modify: `pages/api/garbage/search.ts`
- Modify: `types/garbage.ts`

- [ ] **Step 1: เพิ่มฟิลด์ใน `SearchHit`**

```ts
  /** ชื่อชุมชนของจุดนี้ (ถ้าระบุแล้ว) — ใช้แสดงประกอบผลค้นหา */
  communityName?: string | null;
```

- [ ] **Step 2: แก้ `search.ts`**

ลบลูปที่วนอ่าน `a.communityWindows` ทั้งบล็อกออก (ข้อมูลจริงไม่มีและว่างเปล่าอยู่แล้ว) แล้วแทนด้วยการจับคู่ชื่อชุมชนของจุด — เพิ่มต่อจากลูปที่จับคู่ชื่อจุด:

```ts
        for (const s of route.stops) {
          if (!s.communityName) continue;
          if (!normalizePlaceName(s.communityName).includes(needle)) continue;
          if (!timeBySeq.has(s.seq)) continue; // วันนั้นไม่ได้เก็บจุดนี้
          hits.push({
            matchType: "community", matchName: s.communityName,
            routeCode: route.code, routeName: route.name,
            weekday, weekdayName: WEEKDAY_TH[weekday],
            truckNumber: a.truckNumber,
            kind: a.kind, coverForRouteCode: a.coverForRouteCode,
            startMin: a.startMin, endMin: a.endMin,
            atMin: timeBySeq.get(s.seq) ?? null,
            served: true,
            communityName: s.communityName,
          });
        }
```

และในลูปของ `matchType: "stop"` เพิ่ม `communityName: s.communityName ?? null` เข้าไปใน hit ด้วย

**หมายเหตุ:** ตอนนี้ hit ของชุมชนเป็นระดับ "จุด" ไม่ใช่ระดับ "ช่วงเวลา" แล้ว จึงมี `atMin` จริงของจุดนั้น ซึ่งมีประโยชน์กว่าเดิม

- [ ] **Step 3: ทดสอบกับข้อมูลจริง**

```bash
curl -s -G --data-urlencode "q=มาลัย" "http://localhost:3000/api/garbage/search" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('count',j.count);const byType={};j.hits.forEach(h=>byType[h.matchType]=(byType[h.matchType]||0)+1);console.log(byType);j.hits.filter(h=>h.matchType==='community').slice(0,3).forEach(h=>console.log(' ',h.weekdayName,h.matchName,h.atMin))})"
```
Expected: มี hit ทั้ง `stop` และ `community` · **ถ้าไม่มี `community` เลยให้ตรวจว่า Task 4 รันจริงแล้วหรือยัง**

- [ ] **Step 4: Commit**

```bash
git add pages/api/garbage/search.ts types/garbage.ts
git commit -m "feat: ค้นด้วยชื่อชุมชนจากชุมชนของจุดเก็บ"
```

---

## Task 9: หน้าประชาชนแสดงชุมชนประกอบ

**Files:**
- Modify: `components/garbage/GarbageSearchPanel.tsx`

- [ ] **Step 1: แสดงชื่อชุมชนใต้ชื่อจุด**

ในบรรทัดที่แสดง `h.routeName` เพิ่มชื่อชุมชนเมื่อมี:

```tsx
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {h.communityName ? `ชุมชน${h.communityName} · ` : ""}{h.routeName}
```

และสำหรับ hit ที่ `matchType === "community"` ให้หัวรายการแสดงชื่อจุดจริงด้วย เพราะชาวบ้านต้องรู้ว่าจุดไหนในชุมชนตัวเอง — เปลี่ยนบรรทัดชื่อเป็น:

```tsx
                      <span className="text-sm font-medium text-slate-800">
                        {h.matchType === "community" ? `ชุมชน${h.matchName}` : h.matchName}
                      </span>
```

- [ ] **Step 2: ยืนยันด้วยเบราว์เซอร์**

เปิด `/garbage` ค้น "มาลัย" → ต้องเห็นทั้งผลที่เป็นชื่อถนนและผลที่เป็นชื่อชุมชน พร้อมชื่อชุมชนกำกับใต้แต่ละรายการ

Run: `npx tsc --noEmit && npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/garbage/GarbageSearchPanel.tsx
git commit -m "feat: ผลค้นหาแสดงชุมชนของแต่ละจุด"
```

---

## Task 10: เอกสาร

**Files:**
- Modify: `docs/modules/garbage.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: เพิ่มหัวข้อใน `docs/modules/garbage.md`**

```markdown
## ชุมชนของจุดเก็บ (ตั้งแต่ M8)

**แหล่งความจริงของชื่อชุมชนคือ collection `geojsonfeatures`** (22 polygon) ไม่ใช่ `garbage_communities` ซึ่งถอดมาจากโปสเตอร์และ**ลบทิ้งแล้ว** (ชื่อคลาด + ขาดไปหนึ่งชุมชน)

- `geojsonfeatures` มี `appId: "app_b"` = **ของแอปพี่น้อง อ่านอย่างเดียว ห้ามเขียน ห้ามลบ ห้ามสร้าง index** · `$geoIntersects` ไม่ต้องใช้ index อยู่แล้ว
- **ชื่อซอยไม่สัมพันธ์กับชื่อชุมชน** — "ซ.มาลัย 2" อยู่ในชุมชนรจนา ห้ามเดาจากชื่อ ต้องดูพิกัด
- `RouteStop.communityName` + `communitySource` (`auto` = ระบบเติมจากพิกัด ยังไม่มีคนตรวจ · `manual` = เจ้าหน้าที่ยืนยันแล้ว)
- `scripts/map-garbage-communities.mjs` เติมอัตโนมัติจากพิกัด (~62/145 จุด) · **ไม่ทับค่าที่เป็น `manual`** · ที่เหลือเป็นโรงเรียน/หมู่บ้าน/ตลาดซึ่งไม่ใช่ถนน ต้องให้เจ้าหน้าที่เลือกจาก dropdown ที่หน้าจัดการสาย
- ข้อจำกัด: ใช้ centroid ของถนนทั้งเส้น ถนนยาวที่พาดหลายชุมชนอาจได้ชุมชนไม่ตรงจุดจอดจริง — จึงต้องให้คนตรวจ
- `communityNames`/`communityWindows` ของโมเดลเดิมเลิกใช้แล้ว (ว่างทั้งหมด)
```

- [ ] **Step 2: อัปเดตบรรทัดโมดูลใน `CLAUDE.md`** เติมว่าชื่อชุมชนมาจาก `geojsonfeatures` (ห้ามเขียน) และค้นด้วยชื่อชุมชนอิงชุมชนของจุด

- [ ] **Step 3: รันเกตทั้งหมด**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`

- [ ] **Step 4: Commit**

```bash
git add docs/modules/garbage.md CLAUDE.md
git commit -m "docs: อัปเดตเอกสารโมดูล garbage สำหรับ M8"
```

---

## เช็กลิสต์ยืนยันว่า M8 เสร็จ

- [ ] `npm test` ผ่าน รวมเทสใหม่ของ `normalizePlaceName` และ `pickCommunity`
- [ ] `tsc` / `lint` / `build` ผ่าน
- [ ] สคริปต์ dry-run ได้ราว 62 จุด · รันจริงแล้วรันซ้ำได้ผลเดิม
- [ ] **ซ.มาลัย 2 → ชุมชนรจนา** (พิสูจน์ว่าใช้พิกัด ไม่ได้เดาจากชื่อ)
- [ ] `geojsonfeatures` ยัง 22 เอกสาร index เท่าเดิม ไม่ถูกแตะ
- [ ] `curl /api/garbage/search?q=มาลัย` มี hit ทั้ง `stop` และ `community`
- [ ] `/api/garbage/communities` คืน 401 เมื่อไม่ล็อกอิน
- [ ] audit มี `garbage_communities_mapped`

## งานที่ต้องทำมือหลัง merge

1. เข้า `/admin/garbage` → ปุ่มจัดการสาย → ไล่เลือกชุมชนให้จุดที่ยังว่าง (~83 จุด) และตรวจจุดที่ขึ้นพื้นเหลือง (ระบบเติมให้ ยังไม่ได้ยืนยัน)
2. กรอกเวลาของรถ 13 (ค้างจาก M7)
