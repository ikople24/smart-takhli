# แผน implement เฟส 1: โครง citizen + หน้าแรกโฉมใหม่ (`/preview`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หน้าแรกโฉมใหม่ตามแคนวาส "Smart Takhli Redesign" ที่ route `/preview` — เปลือกใหม่ทั้งชุด ข้อมูล/API เดิมทั้งหมด ฟีเจอร์เดิมครบ

**Architecture:** โมดูล `citizen` ใหม่: shell กึ่งกลางจอกว้างสุด 480px + Nav ล่าง (2 แท็บ + ปุ่มแจ้งเรื่อง) ครอบหน้าแรกที่ประกอบจากการ์ดสไตล์ใหม่ ทุกการ์ดดึงข้อมูลจาก endpoint/store เดิม (`/api/pm25/dashboard`, `/api/smart-papar/water-quality/public-latest`, `/api/activities/feed`, `useMenuStore`, `useHealthMenuStore`) — logic แปลงค่าเป็นระดับ/สี แยกเป็นฟังก์ชันล้วนใน `lib/citizen/` พร้อมเทสต์

**Tech Stack:** Next.js 15 Pages Router · React 19 · Tailwind v4 (arbitrary values, ไม่แตะ DaisyUI theme) · `next/font/google` (Anuphan) · vitest

**Spec:** `docs/superpowers/specs/2026-08-18-citizen-home-redesign-design.md`

**ข้อควรระวังตลอดแผน:**
- dev server ใช้พอร์ต 3100: `npm run dev -- -p 3100` (พอร์ต 3000 มีโปรเจกต์อื่นรัน) — เปิดค้างไว้ข้ามงานได้
- **ห้ามรัน `npm run build` ขณะ dev server เปิดอยู่** (build ทับ `.next` แล้ว API จะพัง 500 เงียบ ๆ)
- ทำงานบน branch `feat/app-redesign-canvas` — เช็ค `git branch --show-current` ก่อน commit ทุกครั้ง (เจ้าของ repo สลับสาขาใน working copy เดียวกันเป็นครั้งคราว)
- โทนสีทั้งหมดมาจากแคนวาส: ม่วง `#7C3AED`→`#9050F0` · พื้นหน้า `#F6F5FA` · พื้นนอก shell `#EDEAF3` · ตัวอักษร `#1B1830` · รอง `#6B6880` / `#9590A8` · เส้น `#EFEDF4` · ม่วงอ่อน `#F1ECFE`

---

### Task 1: `lib/citizen/pm25Level.js` — map ค่า PM2.5 → ระดับ/ป้าย/สี (TDD)

เกณฑ์ต้องตรงกับ `getPm25LevelInfo` ใน `components/Pmdata.js:5-97` (≤15 ดีมาก · ≤25 ดี · ≤37.5 ปานกลาง · ≤75 มีผล · มากกว่านั้น มีผลมาก · ค่าว่าง/0 = ไม่มีข้อมูล)

**Files:**
- Create: `lib/citizen/pm25Level.js`
- Test: `lib/citizen/__tests__/pm25Level.test.js`

- [ ] **Step 1: เขียนเทสต์ (คาดว่า fail)**

```js
// lib/citizen/__tests__/pm25Level.test.js
import { describe, it, expect } from "vitest";
import { pm25Level } from "../pm25Level";

describe("pm25Level", () => {
  it("ค่าว่าง/0/ไม่ใช่ตัวเลข = ไม่มีข้อมูล", () => {
    expect(pm25Level(null).key).toBe("none");
    expect(pm25Level(0).key).toBe("none");
    expect(pm25Level("abc").key).toBe("none");
    expect(pm25Level(undefined).label).toBe("ไม่มีข้อมูล");
  });
  it("เกณฑ์ตรงกับ getPm25LevelInfo เดิม (ขอบเขตรวมค่าบน)", () => {
    expect(pm25Level(15).key).toBe("verygood");
    expect(pm25Level(15.1).key).toBe("good");
    expect(pm25Level(25).key).toBe("good");
    expect(pm25Level(25.1).key).toBe("moderate");
    expect(pm25Level(37.5).key).toBe("moderate");
    expect(pm25Level(37.6).key).toBe("unhealthy");
    expect(pm25Level(75).key).toBe("unhealthy");
    expect(pm25Level(75.1).key).toBe("hazardous");
  });
  it("รับค่า string ได้เหมือนของเดิม (latest.pm25 เป็น string)", () => {
    expect(pm25Level("38").label).toBe("ปานกลาง");
  });
  it("ทุกระดับมี label/chipBg/chipText/dot ครบ", () => {
    for (const v of [null, 10, 20, 30, 50, 100]) {
      const lv = pm25Level(v);
      expect(lv.label).toBeTruthy();
      expect(lv.chipBg).toMatch(/^#/);
      expect(lv.chipText).toMatch(/^#/);
      expect(lv.dot).toMatch(/^#/);
    }
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่า fail**

Run: `npx vitest run lib/citizen/__tests__/pm25Level.test.js`
Expected: FAIL — `Cannot find module '../pm25Level'`

- [ ] **Step 3: เขียน implementation**

```js
// lib/citizen/pm25Level.js
// ระดับ PM2.5 สำหรับการ์ดหน้าแรกโฉมใหม่ — เกณฑ์เดียวกับ getPm25LevelInfo
// ใน components/Pmdata.js (มาตรฐานกรมควบคุมมลพิษ) ห้ามแก้เกณฑ์ฝั่งเดียว
export function pm25Level(value) {
  const pm = parseFloat(value);
  if (!pm || Number.isNaN(pm) || pm <= 0) {
    return { key: "none", label: "ไม่มีข้อมูล", chipBg: "#F1F0F5", chipText: "#6B6880", dot: "#9590A8" };
  }
  if (pm <= 15) {
    return { key: "verygood", label: "ดีมาก", chipBg: "#E6F1FE", chipText: "#2563C9", dot: "#3B82F6" };
  }
  if (pm <= 25) {
    return { key: "good", label: "ดี", chipBg: "#E6F6EC", chipText: "#1B935A", dot: "#27AE60" };
  }
  if (pm <= 37.5) {
    return { key: "moderate", label: "ปานกลาง", chipBg: "#FEF6E0", chipText: "#C77E10", dot: "#F2A93B" };
  }
  if (pm <= 75) {
    return { key: "unhealthy", label: "มีผลต่อสุขภาพ", chipBg: "#FDEBE3", chipText: "#C2410C", dot: "#EA580C" };
  }
  return { key: "hazardous", label: "มีผลต่อสุขภาพมาก", chipBg: "#FDE5E7", chipText: "#B91C1C", dot: "#DC2626" };
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run lib/citizen/__tests__/pm25Level.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/citizen/pm25Level.js lib/citizen/__tests__/pm25Level.test.js
git commit -m "feat(citizen): helper ระดับ PM2.5 สำหรับการ์ดหน้าแรกโฉมใหม่"
```

---

### Task 2: `lib/citizen/waterLevel.js` — map ค่าความขุ่นน้ำ (NTU) → ระดับ/ป้าย/สี (TDD)

เกณฑ์ต้องตรงกับ `getNtuInfo` + `tier` ใน `components/smart-papar/WaterQualityCard.js` (<5 ปกติ · ≤15 เฝ้าระวัง · ≤20 ตะกอนเล็กน้อย · มากกว่านั้น เริ่มขุ่น) — หมายเหตุ: ในแคนวาสการ์ดน้ำเป็น placeholder "pH 7.2" แต่ข้อมูลจริงของระบบคือความขุ่น NTU ใช้ NTU

**Files:**
- Create: `lib/citizen/waterLevel.js`
- Test: `lib/citizen/__tests__/waterLevel.test.js`

- [ ] **Step 1: เขียนเทสต์ (คาดว่า fail)**

```js
// lib/citizen/__tests__/waterLevel.test.js
import { describe, it, expect } from "vitest";
import { waterLevel } from "../waterLevel";

describe("waterLevel", () => {
  it("ค่าว่าง/ไม่ใช่ตัวเลข = ไม่มีข้อมูล", () => {
    expect(waterLevel(null).key).toBe("none");
    expect(waterLevel(undefined).key).toBe("none");
    expect(waterLevel("abc").label).toBe("ไม่มีข้อมูล");
  });
  it("เกณฑ์ตรงกับ getNtuInfo เดิม", () => {
    expect(waterLevel(0).key).toBe("ok");
    expect(waterLevel(4.99).key).toBe("ok");
    expect(waterLevel(5).key).toBe("watch");
    expect(waterLevel(15).key).toBe("watch");
    expect(waterLevel(15.1).key).toBe("sediment");
    expect(waterLevel(20).key).toBe("sediment");
    expect(waterLevel(20.1).key).toBe("turbid");
  });
  it("ป้ายไทยถูกต้อง", () => {
    expect(waterLevel(2).label).toBe("ปกติ");
    expect(waterLevel(10).label).toBe("เฝ้าระวัง");
    expect(waterLevel(18).label).toBe("ตะกอนเล็กน้อย");
    expect(waterLevel(25).label).toBe("เริ่มขุ่น");
  });
  it("ทุกระดับมีสีครบ", () => {
    for (const v of [null, 2, 10, 18, 25]) {
      const lv = waterLevel(v);
      expect(lv.chipBg).toMatch(/^#/);
      expect(lv.chipText).toMatch(/^#/);
      expect(lv.dot).toMatch(/^#/);
    }
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่า fail**

Run: `npx vitest run lib/citizen/__tests__/waterLevel.test.js`
Expected: FAIL — `Cannot find module '../waterLevel'`

- [ ] **Step 3: เขียน implementation**

```js
// lib/citizen/waterLevel.js
// ระดับความขุ่นน้ำประปา (NTU) สำหรับการ์ดหน้าแรกโฉมใหม่ — เกณฑ์เดียวกับ
// getNtuInfo ใน components/smart-papar/WaterQualityCard.js ห้ามแก้เกณฑ์ฝั่งเดียว
export function waterLevel(ntuValue) {
  const ntu = Number(ntuValue);
  if (!Number.isFinite(ntu)) {
    return { key: "none", label: "ไม่มีข้อมูล", chipBg: "#F1F0F5", chipText: "#6B6880", dot: "#9590A8" };
  }
  if (ntu < 5) {
    return { key: "ok", label: "ปกติ", chipBg: "#E6F6EC", chipText: "#1B935A", dot: "#27AE60" };
  }
  if (ntu <= 15) {
    return { key: "watch", label: "เฝ้าระวัง", chipBg: "#FEF6E0", chipText: "#C77E10", dot: "#F2A93B" };
  }
  if (ntu <= 20) {
    return { key: "sediment", label: "ตะกอนเล็กน้อย", chipBg: "#FDEBE3", chipText: "#C2410C", dot: "#EA580C" };
  }
  return { key: "turbid", label: "เริ่มขุ่น", chipBg: "#FDE5E7", chipText: "#B91C1C", dot: "#DC2626" };
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run lib/citizen/__tests__/waterLevel.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/citizen/waterLevel.js lib/citizen/__tests__/waterLevel.test.js
git commit -m "feat(citizen): helper ระดับความขุ่นน้ำประปาสำหรับการ์ดหน้าแรกโฉมใหม่"
```

---

### Task 3: โครง shell — ฟอนต์ + `CitizenShell` + `BottomNav` + หน้า `/preview` เปล่า

**Files:**
- Create: `components/citizen/fonts.ts`
- Create: `components/citizen/BottomNav.tsx`
- Create: `components/citizen/CitizenShell.tsx`
- Create: `pages/preview.tsx` (โครงเปล่า — เติมเนื้อหาใน Task ถัด ๆ ไป)

- [ ] **Step 1: สร้าง `components/citizen/fonts.ts`**

```ts
// components/citizen/fonts.ts
// ฟอนต์ของโมดูล citizen (โฉมใหม่ฝั่งประชาชน) — โหลดเฉพาะหน้าที่ใช้ CitizenShell
// next/font dedupe ให้เองถ้าซ้ำกับที่อื่น (ActivityFeedCard ก็ใช้ Anuphan)
import { Anuphan } from "next/font/google";

export const anuphan = Anuphan({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});
```

- [ ] **Step 2: สร้าง `components/citizen/BottomNav.tsx`**

เฟสนี้มี 2 แท็บ + ปุ่มกลาง (โปรไฟล์/กระดิ่งยังไม่มีระบบจริง — ตาม spec) · แท็บสถานะชี้ `/status` เดิม · ปุ่มกลางเลื่อนไปยังหมวดแจ้งเรื่อง (`#report-categories`) เพราะ `ComplaintFormModal` เดิมต้องเลือกหมวดก่อนเปิด — การเลือกหมวดคือขั้นแรกของ flow แจ้งเรื่องอยู่แล้ว

```tsx
// components/citizen/BottomNav.tsx
import Link from "next/link";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.1 : 1.9} strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

export default function BottomNav({ onReport }: { onReport: () => void }) {
  return (
    <nav className="sticky bottom-0 z-20 flex items-end border-t border-[#EFEDF4] bg-white px-4 pb-6 pt-2">
      <Link href="/preview" className="flex flex-1 flex-col items-center gap-1 text-[#7C3AED]">
        <HomeIcon active />
        <span className="text-[11px] font-semibold">หน้าแรก</span>
      </Link>
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={onReport}
          aria-label="แจ้งเรื่องร้องเรียน"
          className="-mt-9 flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#7C3AED] to-[#9050F0] shadow-[0_10px_22px_rgba(124,58,237,0.4)] transition hover:scale-105"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
      <Link href="/status" className="flex flex-1 flex-col items-center gap-1 text-[#A7A2B6]">
        <StatusIcon />
        <span className="text-[11px]">สถานะ</span>
      </Link>
    </nav>
  );
}
```

- [ ] **Step 3: สร้าง `components/citizen/CitizenShell.tsx`**

```tsx
// components/citizen/CitizenShell.tsx
// app shell ฝั่งประชาชนโฉมใหม่ — เนื้อหากว้างสุด 480px กึ่งกลางจอ (ตาม spec:
// ไม่ทำ responsive หลายคอลัมน์) พร้อม Nav ล่าง ใช้ได้กับทุกหน้า citizen เฟสถัดไป
import { ReactNode } from "react";
import { anuphan } from "./fonts";
import BottomNav from "./BottomNav";

export default function CitizenShell({ children, onReport }: { children: ReactNode; onReport: () => void }) {
  return (
    <div className={`${anuphan.className} min-h-screen bg-[#EDEAF3]`}>
      <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-[#F6F5FA] text-[#1B1830] shadow-[0_0_40px_rgba(60,40,100,0.10)]">
        <main className="flex-1">{children}</main>
        <BottomNav onReport={onReport} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: สร้าง `pages/preview.tsx` โครงเปล่า**

```tsx
// pages/preview.tsx
// หน้าแรกโฉมใหม่ (เฟสทดลอง) — route คู่ขนาน ไม่มีลิงก์เข้าจากที่ไหน
// spec: docs/superpowers/specs/2026-08-18-citizen-home-redesign-design.md
import Head from "next/head";
import CitizenShell from "@/components/citizen/CitizenShell";

export default function PreviewHome() {
  const scrollToCategories = () => {
    document.getElementById("report-categories")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <Head>
        <title>เทศบาลเมืองตาคลี · Smart Takhli</title>
      </Head>
      <CitizenShell onReport={scrollToCategories}>
        <div className="px-4 py-6 text-sm text-[#9590A8]">กำลังประกอบหน้าแรกโฉมใหม่…</div>
      </CitizenShell>
    </>
  );
}
```

- [ ] **Step 5: ตรวจด้วยตาบน dev (พอร์ต 3100)**

Run: `npm run dev -- -p 3100` (เปิดค้างไว้) แล้วเปิด `http://localhost:3100/preview`
Expected: คอลัมน์กึ่งกลางพื้น `#F6F5FA` บนพื้นนอก `#EDEAF3` · Nav ล่างมี หน้าแรก (ม่วง) / ปุ่ม + ม่วงนูนกลาง / สถานะ (เทา) · ฟอนต์เป็น Anuphan · คลิก "สถานะ" ไป `/status` ได้ · จอแคบ (มือถือ) คอลัมน์เต็มจอพอดี

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # ต้องเป็น feat/app-redesign-canvas
git add components/citizen/fonts.ts components/citizen/BottomNav.tsx components/citizen/CitizenShell.tsx pages/preview.tsx
git commit -m "feat(citizen): โครง shell + Nav ล่าง + route /preview สำหรับหน้าแรกโฉมใหม่"
```

---

### Task 4: `HeaderCard` + `EnvCards` (PM2.5 + น้ำประปา)

**Files:**
- Create: `components/citizen/home/HeaderCard.tsx`
- Create: `components/citizen/home/EnvCards.tsx`
- Modify: `pages/preview.tsx` (แทนบรรทัด placeholder ด้วยสองส่วนนี้)

- [ ] **Step 1: สร้าง `components/citizen/home/HeaderCard.tsx`**

โลโก้จริงของเทศบาลอยู่ที่ `public/logoTK.png` (แคนวาสใช้ตราโล่ placeholder) · ไม่มีปุ่มกระดิ่ง (ตาม spec)

```tsx
// components/citizen/home/HeaderCard.tsx
import Image from "next/image";

export default function HeaderCard() {
  return (
    <div className="mx-4 mt-4 flex items-center gap-3 rounded-[22px] bg-gradient-to-br from-[#7C3AED] to-[#9050F0] px-4 py-4 shadow-[0_12px_26px_rgba(124,58,237,0.28)]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/90">
        <Image src="/logoTK.png" alt="ตราเทศบาลเมืองตาคลี" width={40} height={40} className="h-10 w-10 object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-base font-semibold leading-tight text-white">เทศบาลเมืองตาคลี</div>
        <div className="text-[10px] font-medium tracking-[2px] text-white/75">SMART TAKHLI</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: สร้าง `components/citizen/home/EnvCards.tsx`**

ดึงข้อมูลเองจาก endpoint เดิมทั้งคู่ (รูปแบบ fetch + alive flag ตามธรรมเนียม `WaterQualityCard.js`) · ระหว่างโหลดแสดง skeleton · โหลดพลาดแสดง "–" + ป้ายไม่มีข้อมูล

```tsx
// components/citizen/home/EnvCards.tsx
import { useEffect, useState } from "react";
import { pm25Level } from "@/lib/citizen/pm25Level";
import { waterLevel } from "@/lib/citizen/waterLevel";

type Level = { label: string; chipBg: string; chipText: string; dot: string };

function Chip({ level }: { level: Level }) {
  return (
    <span
      className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: level.chipBg, color: level.chipText }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: level.dot }} />
      {level.label}
    </span>
  );
}

function CardFrame({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex-1 rounded-[18px] bg-white p-3.5 shadow-[0_4px_14px_rgba(60,40,100,0.05)]">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6B6880]">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

export default function EnvCards() {
  const [pm, setPm] = useState<string | number | null>(null);
  const [ntu, setNtu] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const [pmRes, waterRes] = await Promise.allSettled([
        fetch("/api/pm25/dashboard", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/smart-papar/water-quality/public-latest").then((r) => r.json()),
      ]);
      if (!alive) return;
      if (pmRes.status === "fulfilled" && pmRes.value?.success && pmRes.value.latest) {
        setPm(pmRes.value.latest.pm25);
      }
      if (waterRes.status === "fulfilled" && waterRes.value?.success && waterRes.value.data) {
        setNtu(waterRes.value.data.tapTurbidityNtu);
      }
      setLoading(false);
    };
    run();
    const t = setInterval(run, 60 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-4 mt-3 flex gap-2.5">
        <div className="h-28 flex-1 animate-pulse rounded-[18px] bg-white/70" />
        <div className="h-28 flex-1 animate-pulse rounded-[18px] bg-white/70" />
      </div>
    );
  }

  const pmLv = pm25Level(pm);
  const waterLv = waterLevel(ntu);
  const pmDisplay = pmLv.key === "none" ? "–" : String(parseInt(String(pm), 10));
  const ntuNum = Number(ntu);
  const ntuDisplay = Number.isFinite(ntuNum) ? ntuNum.toFixed(2) : "–";

  return (
    <div className="mx-4 mt-3 flex gap-2.5">
      <CardFrame
        title="PM2.5"
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth={1.8} strokeLinecap="round">
            <path d="M3 8h10a2.5 2.5 0 1 0-2.5-2.5" />
            <path d="M3 12h15a2.5 2.5 0 1 1-2.5 2.5" />
            <path d="M3 16h8a2 2 0 1 1-2 2" />
          </svg>
        }
      >
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-bold leading-none">{pmDisplay}</span>
          <span className="text-[11px] text-[#9590A8]">µg/m³</span>
        </div>
        <Chip level={pmLv} />
      </CardFrame>
      <CardFrame
        title="น้ำประปา"
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3BA4F0" strokeWidth={1.8} strokeLinejoin="round">
            <path d="M12 3s6 6 6 11a6 6 0 0 1-12 0c0-5 6-11 6-11Z" />
          </svg>
        }
      >
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-bold leading-none">{ntuDisplay}</span>
          <span className="text-[11px] text-[#9590A8]">NTU</span>
        </div>
        <Chip level={waterLv} />
      </CardFrame>
    </div>
  );
}
```

- [ ] **Step 3: เสียบเข้า `pages/preview.tsx`**

แทนที่ `<div className="px-4 py-6 ...">กำลังประกอบหน้าแรกโฉมใหม่…</div>` ด้วย:

```tsx
<HeaderCard />
<EnvCards />
```

เพิ่ม import ด้านบน:

```tsx
import HeaderCard from "@/components/citizen/home/HeaderCard";
import EnvCards from "@/components/citizen/home/EnvCards";
```

- [ ] **Step 4: ตรวจด้วยตา**

เปิด `http://localhost:3100/preview`
Expected: การ์ดม่วง gradient โลโก้เทศบาลจริง + การ์ดคู่ PM2.5/น้ำประปา ตัวเลขจริงจาก API พร้อมชิปสีตามระดับ (เทียบค่ากับหน้าแรกเดิม `http://localhost:3100/` ต้องตรงกัน) · ถ้า API ล้มการ์ดแสดง "–" + "ไม่มีข้อมูล" ไม่พังทั้งหน้า

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # ต้องเป็น feat/app-redesign-canvas
git add components/citizen/home/HeaderCard.tsx components/citizen/home/EnvCards.tsx pages/preview.tsx
git commit -m "feat(citizen): การ์ดหัว + การ์ด PM2.5/น้ำประปา บนหน้าแรกโฉมใหม่"
```

---

### Task 5: `ComplaintCTA` + `ServiceGrid` (หมวดแจ้งเรื่อง + modal เดิมครบ)

พฤติกรรมหมวดพิเศษคัดจาก `pages/index.tsx:91-99`: "ลงทะเบียนกายอุปกรณ์" → `SpecialFormModal` · "สำรวจการศึกษา" → `SchoolSurveyModal` · อื่น ๆ → `ComplaintFormModal(selectedLabel)`

**Files:**
- Create: `components/citizen/home/ComplaintCTA.tsx`
- Create: `components/citizen/home/ServiceGrid.tsx`
- Modify: `pages/preview.tsx` (state + modal ทั้งสามตัว)

- [ ] **Step 1: สร้าง `components/citizen/home/ComplaintCTA.tsx`**

```tsx
// components/citizen/home/ComplaintCTA.tsx
export default function ComplaintCTA({ onStart }: { onStart: () => void }) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="mx-4 mt-3 block w-[calc(100%-2rem)] rounded-[20px] bg-gradient-to-br from-[#7C3AED] to-[#9050F0] px-5 py-4 text-left shadow-[0_10px_22px_rgba(124,58,237,0.30)]"
    >
      <div className="text-[15px] font-semibold text-white">พบปัญหาในพื้นที่?</div>
      <div className="mt-0.5 text-xs text-white/80">แจ้งเทศบาลได้เลย ติดตามสถานะได้ทุกขั้นตอน</div>
      <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#7C3AED]">
        เริ่มแจ้งเรื่อง
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}
```

- [ ] **Step 2: สร้าง `components/citizen/home/ServiceGrid.tsx`**

grid หมวดจาก `useMenuStore` (รูปจริง `Prob_pic` เป็นภาพถ่าย — แสดงเป็นวงกลมเหมือนเดิมแต่ย่อลงในการ์ดขาวสไตล์แคนวาส) — id `report-categories` เป็นเป้าเลื่อนของปุ่มแจ้งเรื่อง

```tsx
// components/citizen/home/ServiceGrid.tsx
import Image from "next/image";
import { MenuItem } from "@/stores/useMenuStore";

export default function ServiceGrid({
  menu,
  loading,
  onSelect,
}: {
  menu: MenuItem[];
  loading: boolean;
  onSelect: (label: string) => void;
}) {
  return (
    <section id="report-categories" className="mx-4 mt-6 scroll-mt-4">
      <h2 className="text-[15px] font-bold">แจ้งเรื่อง / บริการ</h2>
      <p className="text-[11px] text-[#9590A8]">เลือกหมวดที่ต้องการแจ้งหรือใช้บริการ</p>
      {loading ? (
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-[16px] bg-white/70" />
          ))}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {menu.map((item, index) => (
            <button
              key={item._id || index}
              type="button"
              onClick={() => onSelect(item.Prob_name)}
              className="flex flex-col items-center rounded-[16px] bg-white px-1 py-3 shadow-[0_4px_12px_rgba(60,40,100,0.04)] transition hover:-translate-y-0.5"
            >
              <div className="relative h-12 w-12 overflow-hidden rounded-full">
                <Image src={item.Prob_pic} alt={item.Prob_name} width={48} height={48} className="h-full w-full object-cover" />
              </div>
              <span className="mt-1.5 text-center text-[10.5px] leading-tight text-[#4A4458]">{item.Prob_name}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: เดินสายใน `pages/preview.tsx`**

แทนเนื้อไฟล์ทั้งหมดด้วย (โครงจาก Task 4 + state modal — ท้ายหน้า Task 6-7 จะเติมต่อจาก `ServiceGrid`):

```tsx
// pages/preview.tsx
// หน้าแรกโฉมใหม่ (เฟสทดลอง) — route คู่ขนาน ไม่มีลิงก์เข้าจากที่ไหน
// spec: docs/superpowers/specs/2026-08-18-citizen-home-redesign-design.md
import { useEffect, useState } from "react";
import Head from "next/head";
import CitizenShell from "@/components/citizen/CitizenShell";
import HeaderCard from "@/components/citizen/home/HeaderCard";
import EnvCards from "@/components/citizen/home/EnvCards";
import ComplaintCTA from "@/components/citizen/home/ComplaintCTA";
import ServiceGrid from "@/components/citizen/home/ServiceGrid";
import ComplaintFormModal from "@/components/complaints/ComplaintFormModal";
import SpecialFormModal from "@/components/sm-health/SpacialFormModal";
import SchoolSurveyModal from "@/components/smart-school/survey/SchoolSurveyModal";
import { useMenuStore } from "@/stores/useMenuStore";

export default function PreviewHome() {
  const { menu, fetchMenu, menuLoading } = useMenuStore();
  const [hasFetched, setHasFetched] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [showSpecialForm, setShowSpecialForm] = useState(false);
  const [showEducationForm, setShowEducationForm] = useState(false);
  const [specialFormData, setSpecialFormData] = useState({ name: "", phone: "", equipment: "", reason: "" });

  useEffect(() => {
    if (!hasFetched && menu.length === 0 && !menuLoading) {
      fetchMenu();
      setHasFetched(true);
    }
  }, [menu.length, fetchMenu, menuLoading, hasFetched]);

  // พฤติกรรมหมวดพิเศษเหมือนหน้าแรกเดิม (pages/index.tsx)
  const handleSelect = (label: string) => {
    if (label === "ลงทะเบียนกายอุปกรณ์") setShowSpecialForm(true);
    else if (label === "สำรวจการศึกษา") setShowEducationForm(true);
    else setSelectedLabel(label);
  };

  const scrollToCategories = () => {
    document.getElementById("report-categories")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <Head>
        <title>เทศบาลเมืองตาคลี · Smart Takhli</title>
      </Head>
      <CitizenShell onReport={scrollToCategories}>
        <HeaderCard />
        <EnvCards />
        <ComplaintCTA onStart={scrollToCategories} />
        <ServiceGrid menu={menu} loading={menuLoading} onSelect={handleSelect} />
        <div className="h-8" />
      </CitizenShell>

      {selectedLabel && <ComplaintFormModal selectedLabel={selectedLabel} onClose={() => setSelectedLabel(null)} />}
      {showSpecialForm && (
        <SpecialFormModal formData={specialFormData} setFormData={setSpecialFormData} onClose={() => setShowSpecialForm(false)} />
      )}
      <SchoolSurveyModal isOpen={showEducationForm} onClose={() => setShowEducationForm(false)} />
    </>
  );
}
```

- [ ] **Step 4: ตรวจด้วยตา**

เปิด `http://localhost:3100/preview`
Expected: แบนเนอร์ CTA ม่วง + grid หมวด 3 คอลัมน์รูปจริง · กดหมวดปกติ → `ComplaintFormModal` เปิด-ปิด-ส่งได้เหมือนหน้าเดิม · กด "ลงทะเบียนกายอุปกรณ์" → SpecialFormModal · กด "สำรวจการศึกษา" → SchoolSurveyModal · ปุ่ม + ที่ Nav กับปุ่ม "เริ่มแจ้งเรื่อง" เลื่อนหน้าไปที่ grid

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # ต้องเป็น feat/app-redesign-canvas
git add components/citizen/home/ComplaintCTA.tsx components/citizen/home/ServiceGrid.tsx pages/preview.tsx
git commit -m "feat(citizen): CTA แจ้งเรื่อง + grid หมวดบริการ พร้อม modal เดิมครบสามตัว"
```

---

### Task 6: `NewsSection` — ข่าวกิจกรรม 3 รายการ + "ดูทั้งหมด ›"

ใช้ endpoint เดิม `/api/activities/feed?limit=3` (รูปแบบ `{success, data}`) · ฟิลด์ item: `_id, name, description, images[], startDate, views` · ลิงก์รายการ `/activities?activity=<id>` และ "ดูทั้งหมด" → `/activities` · ใช้ `formatThaiDate` เดิมจาก ActivityFeedCard (DRY) · ไม่มีชิปหมวดแบบแคนวาส — ข้อมูลจริงไม่มีฟิลด์หมวด ใช้วันที่แทน

**Files:**
- Create: `components/citizen/home/NewsSection.tsx`
- Modify: `pages/preview.tsx` (เสียบใต้ `ServiceGrid`)

- [ ] **Step 1: สร้าง `components/citizen/home/NewsSection.tsx`**

```tsx
// components/citizen/home/NewsSection.tsx
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatThaiDate } from "@/components/activities/ActivityFeedCard";

type Activity = {
  _id: string;
  name: string;
  description?: string;
  images?: string[];
  startDate?: string;
  views?: number;
};

export default function NewsSection() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/activities/feed?limit=3")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setActivities(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || activities.length === 0) return null;

  return (
    <section className="mx-4 mt-6">
      <div className="flex items-end justify-between">
        <h2 className="text-[15px] font-bold">ข่าวกิจกรรม</h2>
        <Link href="/activities" className="text-xs font-medium text-[#8B5CF6]">
          ดูทั้งหมด ›
        </Link>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {activities.map((a) => (
          <Link
            key={a._id}
            href={`/activities?activity=${a._id}`}
            className="flex gap-3 rounded-[16px] bg-white p-2.5 shadow-[0_4px_12px_rgba(60,40,100,0.04)]"
          >
            <div className="relative h-[74px] w-[74px] shrink-0 overflow-hidden rounded-[12px] bg-[#EEF1FB]">
              {a.images?.[0] && (
                <Image src={a.images[0]} alt={a.name} fill sizes="74px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              <div className="line-clamp-2 text-[13.5px] font-semibold leading-snug">{a.name}</div>
              <div className="mt-1.5 text-[11px] text-[#9590A8]">
                {a.startDate ? formatThaiDate(a.startDate) : ""}
                {typeof a.views === "number" ? ` · อ่าน ${a.views}` : ""}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: เสียบเข้า `pages/preview.tsx`**

ใต้ `<ServiceGrid ... />` เพิ่ม `<NewsSection />` และ import:

```tsx
import NewsSection from "@/components/citizen/home/NewsSection";
```

- [ ] **Step 3: ตรวจด้วยตา**

เปิด `http://localhost:3100/preview`
Expected: การ์ดข่าว 3 รายการรูป + ชื่อ + วันที่ไทย ตรงกับฟีดหน้าเดิม · กดรายการไปหน้ากิจกรรมถูกตัว · "ดูทั้งหมด ›" ไป `/activities`

- [ ] **Step 4: Commit**

```bash
git branch --show-current   # ต้องเป็น feat/app-redesign-canvas
git add components/citizen/home/NewsSection.tsx pages/preview.tsx
git commit -m "feat(citizen): section ข่าวกิจกรรมบนหน้าแรกโฉมใหม่"
```

---

### Task 7: ส่วนท้าย — รถขยะ + กายอุปกรณ์ + คู่มือ/ติดตั้งแอป + สถิติ + Footer

ฟีเจอร์เดิมที่เหลือทั้งหมด (ตาม spec "เก็บครบ") — คอมโพเนนต์เดิม self-contained อยู่แล้ว จัดวางในภาษาหน้าตาใหม่: หัว section แบบเดียวกับข่าว ครอบการ์ดเดิม

**Files:**
- Modify: `pages/preview.tsx`

- [ ] **Step 1: เพิ่ม import + state PWA ใน `pages/preview.tsx`**

เพิ่ม import:

```tsx
import AvailableListOnly from "@/components/sm-health/AvailableListOnly";
import GarbageHomeCard from "@/components/garbage/GarbageHomeCard";
import SiteStatsBar from "@/components/site-stats/SiteStatsBar";
import Footer from "@/components/Footer";
import { useHealthMenuStore } from "@/stores/useHealthMenuStore";
import { BookOpen, Download } from "lucide-react";
```

เพิ่มใน component (เหนือ `return` — type + state PWA คัดจาก `pages/index.tsx:1-36` และ health store จาก `pages/index.tsx:42-44,83-88`):

```tsx
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};
// (วาง type ไว้บนสุดของไฟล์ นอก component)

const { menu: healthMenu, loading: healthLoading, fetchMenu: fetchHealthMenu } = useHealthMenuStore();
const [hasFetchedHealth, setHasFetchedHealth] = useState(false);
const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

useEffect(() => {
  if (!hasFetchedHealth && healthMenu.length === 0 && !healthLoading) {
    fetchHealthMenu();
    setHasFetchedHealth(true);
  }
}, [healthMenu.length, fetchHealthMenu, healthLoading, hasFetchedHealth]);

useEffect(() => {
  const handler = (e: Event) => {
    e.preventDefault();
    setDeferredPrompt(e as BeforeInstallPromptEvent);
  };
  window.addEventListener("beforeinstallprompt", handler);
  return () => window.removeEventListener("beforeinstallprompt", handler);
}, []);
```

- [ ] **Step 2: เพิ่มส่วนท้ายใน JSX** (ระหว่าง `<NewsSection />` กับ `<div className="h-8" />`)

```tsx
<section className="mx-4 mt-6">
  <h2 className="text-[15px] font-bold">ตารางรถเก็บขยะ</h2>
  <div className="mt-3">
    <GarbageHomeCard />
  </div>
</section>

<section className="mx-4 mt-6">
  <h2 className="text-[15px] font-bold">ศูนย์กายอุปกรณ์</h2>
  <p className="text-[11px] text-[#9590A8]">ยืม-คืนอุปกรณ์ช่วยเหลือผู้ป่วยและผู้สูงอายุ</p>
  <div className="mt-3">
    <AvailableListOnly menu={healthMenu} loading={healthLoading} />
  </div>
</section>

<div className="mx-4 mt-8 flex items-center justify-center gap-4 text-sm text-[#7C3AED]">
  <a href="https://heyzine.com/flip-book/7cf559d572.html" className="flex items-center gap-1 hover:underline">
    <BookOpen size={16} />
    คู่มือประชาชน
  </a>
  {deferredPrompt && (
    <button
      type="button"
      onClick={() => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => setDeferredPrompt(null));
      }}
      className="flex items-center gap-1 rounded-full bg-[#7C3AED] px-4 py-2 text-white"
    >
      <Download size={16} />
      ติดตั้งแอป
    </button>
  )}
</div>

<div className="mt-4">
  <SiteStatsBar />
</div>

<Footer />
```

- [ ] **Step 3: ตรวจด้วยตาเทียบหน้าเดิมทีละฟีเจอร์**

เปิด `http://localhost:3100/preview` เทียบ `http://localhost:3100/`
Expected: การ์ดรถขยะทำงาน (สถานะรถวันนี้) · ลิสต์กายอุปกรณ์ขึ้นครบ · คู่มือประชาชนกดได้ · แถบสถิติ + Footer แสดง · ฟีเจอร์หน้าเดิมทุกตัวมีทางเข้าบนหน้าใหม่ (เช็คลิสต์: PM2.5 ✓ น้ำ ✓ หมวดแจ้งเรื่อง ✓ กายอุปกรณ์ ✓ สำรวจการศึกษา ✓ รถขยะ ✓ ข่าว ✓ คู่มือ ✓ PWA ✓ สถิติ ✓ Footer ✓)

- [ ] **Step 4: Commit**

```bash
git branch --show-current   # ต้องเป็น feat/app-redesign-canvas
git add pages/preview.tsx
git commit -m "feat(citizen): ส่วนท้ายหน้าแรกโฉมใหม่ — รถขยะ กายอุปกรณ์ คู่มือ สถิติ ครบฟีเจอร์เดิม"
```

---

### Task 8: ตรวจรวมปิดเฟส

- [ ] **Step 1: รันเทสต์ทั้งหมด + lint**

Run: `npm test` → Expected: PASS ทั้งหมด (รวม 2 ไฟล์ใหม่ของ citizen)
Run: `npm run lint` → Expected: ไม่มี error ใหม่ (warning เดิมของ repo ปล่อยได้)

- [ ] **Step 2: ตรวจด้วยตารอบสุดท้ายเทียบแคนวาส**

เปิดแคนวาส (`open "docs/ดีไซน์ใหม่ Smart Takhli/Smart-Takhli-Redesign-standalone.html"`) เทียบ `http://localhost:3100/preview` ทั้งวิวมือถือ (responsive mode) และจอคอม (คอลัมน์กึ่งกลาง) — เช็ค: โทนม่วง/เงา/มุมโค้งตรงแคนวาส · Nav ล่างตำแหน่งถูก ปุ่ม + นูนกลาง · ไม่มี scroll แนวนอน · หน้าเดิม `/` ยังแสดงผลปกติไม่เปลี่ยน

- [ ] **Step 3: Commit สุดท้าย (ถ้ามีแก้จากการตรวจ) แล้วสรุปสถานะ**

```bash
git branch --show-current   # ต้องเป็น feat/app-redesign-canvas
git status --short          # ต้องสะอาด หรือ commit ที่ค้าง
git log --oneline main..HEAD
```

รายงานผู้ใช้: เฟส 1 จบ — ทดลองที่ `http://localhost:3100/preview` · การ push/PR และการสลับเป็นหน้าแรกจริงเป็นการตัดสินใจถัดไปของเจ้าของโปรเจกต์
