# สถิติการเข้าชมเว็บไซต์ (site-stats) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** การ์ดสถิติการเข้าชมเว็บไซต์บนหน้าหลัก (ยอดรวม/วันนี้/เดือนนี้/ออนไลน์) พร้อมตัวเลขนับขึ้นแบบ transition โดยมีตัวนับเองใน MongoDB

**Architecture:** โมดูลใหม่ `site-stats` — models (`SiteVisitDaily`, `SiteStatsTotal`, `SiteOnline` TTL) + API public 3 ตัว + hook tracking ใน `_app.tsx` (เฉพาะ route สาธารณะ) + component การ์ดบนหน้าหลัก. นับ visit 1/วัน/แท็บ (sessionStorage), online ใช้ heartbeat 60 วิ + TTL 5 นาที

**Tech Stack:** Next.js 15 Pages Router, Mongoose, Tailwind+DaisyUI, lucide-react (มีอยู่แล้ว), ไม่เพิ่ม dependency

**Spec:** `docs/superpowers/specs/2026-06-19-site-stats-design.md`

**หมายเหตุการทดสอบ:** โปรเจกต์ไม่มี test runner (CLAUDE.md) — ตรวจด้วย `npm run build` + `npm run lint` + curl/dev server

---

### Task 1: Models + lib date helper

**Files:**
- Create: `models/site-stats/SiteVisitDaily.js`
- Create: `models/site-stats/SiteStatsTotal.js`
- Create: `models/site-stats/SiteOnline.js`
- Create: `lib/site-stats/date.js`

- [ ] **Step 1.1:** สร้าง `models/site-stats/SiteVisitDaily.js`:

```js
import mongoose from "mongoose";

const SiteVisitDailySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD (Asia/Bangkok)
    count: { type: Number, default: 0 },
  },
  { collection: "site_visit_daily", timestamps: true }
);

export default mongoose.models.SiteVisitDaily ||
  mongoose.model("SiteVisitDaily", SiteVisitDailySchema);
```

- [ ] **Step 1.2:** สร้าง `models/site-stats/SiteStatsTotal.js`:

```js
import mongoose from "mongoose";

const SiteStatsTotalSchema = new mongoose.Schema(
  {
    _id: { type: String }, // คงที่ "total"
    count: { type: Number, default: 0 },
  },
  { collection: "site_stats_total", timestamps: true }
);

export default mongoose.models.SiteStatsTotal ||
  mongoose.model("SiteStatsTotal", SiteStatsTotalSchema);
```

- [ ] **Step 1.3:** สร้าง `models/site-stats/SiteOnline.js` (มี TTL index):

```js
import mongoose from "mongoose";

const SiteOnlineSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, unique: true },
    lastSeen: { type: Date, default: Date.now },
  },
  { collection: "site_online" }
);

// TTL: doc หมดอายุ 300 วินาทีหลัง lastSeen (ถือว่าออฟไลน์)
SiteOnlineSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 300 });

export default mongoose.models.SiteOnline ||
  mongoose.model("SiteOnline", SiteOnlineSchema);
```

- [ ] **Step 1.4:** สร้าง `lib/site-stats/date.js`:

```js
// วันที่เขต Asia/Bangkok สำหรับ site-stats
// หมายเหตุ: ซ้ำกับ getBangkokYMD ใน lib/pm25Sync.js — รวมเป็น util กลางในเฟส 6/7
export function getBangkokYMD(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
```

- [ ] **Step 1.5:** `npm run build` → `✓ Compiled successfully` (models ยังไม่ถูก import ที่ไหน แต่ต้องไม่มี syntax error)
- [ ] **Step 1.6:** Commit: `feat: site-stats models (visit daily/total + online TTL) + bangkok date helper`

---

### Task 2: API endpoints (visit / ping / GET)

**Files:**
- Create: `pages/api/site-stats/visit.js`
- Create: `pages/api/site-stats/ping.js`
- Create: `pages/api/site-stats/index.js`

- [ ] **Step 2.1:** สร้าง `pages/api/site-stats/visit.js`:

```js
import dbConnect from "@/lib/dbConnect";
import SiteVisitDaily from "@/models/site-stats/SiteVisitDaily";
import SiteStatsTotal from "@/models/site-stats/SiteStatsTotal";
import { getBangkokYMD } from "@/lib/site-stats/date";

// นับการเข้าชมเว็บไซต์ (public, fire-and-forget — กันซ้ำ 1/วัน ฝั่ง client)
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  try {
    await dbConnect();
    const date = getBangkokYMD();
    await Promise.all([
      SiteVisitDaily.updateOne({ date }, { $inc: { count: 1 } }, { upsert: true }),
      SiteStatsTotal.updateOne({ _id: "total" }, { $inc: { count: 1 } }, { upsert: true }),
    ]);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error counting site visit:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
```

- [ ] **Step 2.2:** สร้าง `pages/api/site-stats/ping.js`:

```js
import dbConnect from "@/lib/dbConnect";
import SiteOnline from "@/models/site-stats/SiteOnline";

// heartbeat ผู้ใช้ออนไลน์ (public) — upsert lastSeen; TTL 5 นาทีลบ doc ที่เงียบ
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  try {
    const { clientId } = req.body || {};
    if (!clientId || typeof clientId !== "string") {
      return res.status(400).json({ success: false, message: "clientId required" });
    }
    await dbConnect();
    await SiteOnline.updateOne(
      { clientId },
      { $set: { lastSeen: new Date() } },
      { upsert: true }
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error site ping:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
```

- [ ] **Step 2.3:** สร้าง `pages/api/site-stats/index.js`:

```js
import dbConnect from "@/lib/dbConnect";
import SiteVisitDaily from "@/models/site-stats/SiteVisitDaily";
import SiteStatsTotal from "@/models/site-stats/SiteStatsTotal";
import SiteOnline from "@/models/site-stats/SiteOnline";
import { getBangkokYMD } from "@/lib/site-stats/date";

// สถิติการเข้าชมเว็บไซต์ (public): total, today, month, online
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  try {
    await dbConnect();
    const ymd = getBangkokYMD();
    const monthPrefix = ymd.slice(0, 7);

    const [totalDoc, todayDoc, monthAgg, online] = await Promise.all([
      SiteStatsTotal.findById("total").lean(),
      SiteVisitDaily.findOne({ date: ymd }).lean(),
      SiteVisitDaily.aggregate([
        { $match: { date: { $regex: `^${monthPrefix}` } } },
        { $group: { _id: null, sum: { $sum: "$count" } } },
      ]),
      SiteOnline.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        total: totalDoc?.count || 0,
        today: todayDoc?.count || 0,
        month: monthAgg?.[0]?.sum || 0,
        online,
      },
    });
  } catch (error) {
    console.error("Error fetching site stats:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
```

- [ ] **Step 2.4:** ตรวจ: `npm run build` ผ่าน, dev server แล้ว:
  - `curl -s -X POST localhost:<port>/api/site-stats/visit` → `{"success":true}`; ทำซ้ำ 2 ครั้ง
  - `curl -s -X POST localhost:<port>/api/site-stats/ping -H 'Content-Type: application/json' -d '{"clientId":"test1"}'` → `{"success":true}`
  - `curl -s localhost:<port>/api/site-stats` → `data.total`≥2, `data.today`≥2, `data.month`≥2, `data.online`≥1
- [ ] **Step 2.5:** Commit: `feat: site-stats API — visit/ping/GET (total, today, month, online)`

---

### Task 3: Tracking hook + เชื่อมเข้า `_app.tsx`

**Files:**
- Create: `components/site-stats/useSiteTracking.ts`
- Modify: `pages/_app.tsx`

- [ ] **Step 3.1:** สร้าง `components/site-stats/useSiteTracking.ts`:

```ts
import { useEffect } from "react";

const PING_INTERVAL_MS = 60_000;

function getClientId(): string {
  const KEY = "site-client-id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? String(Date.now() + Math.random()));
    localStorage.setItem(KEY, id);
  }
  return id;
}

// ติดตามการเข้าชม + heartbeat ออนไลน์ (เรียกจาก _app เฉพาะ route สาธารณะ)
export function useSiteTracking(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // visit: 1 ครั้ง/วัน/แท็บ (sessionStorage)
    const today = new Date().toISOString().slice(0, 10);
    const visitKey = `site-visit-${today}`;
    if (!sessionStorage.getItem(visitKey)) {
      sessionStorage.setItem(visitKey, "1");
      fetch("/api/site-stats/visit", { method: "POST" }).catch(() => {});
    }

    // ping: heartbeat ทุก 60 วิ
    const clientId = getClientId();
    const ping = () =>
      fetch("/api/site-stats/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      }).catch(() => {});
    ping();
    const timer = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled]);
}
```

- [ ] **Step 3.2:** ใน `pages/_app.tsx` เพิ่ม import (หลังบรรทัด `import { hasPermission } ...` ราวบรรทัด 9):

```tsx
import { useSiteTracking } from "@/components/site-stats/useSiteTracking";
```

- [ ] **Step 3.3:** ใน `pages/_app.tsx` ภายใน `AppContent` หลังบรรทัดที่ประกาศ `isProtected` (ราวบรรทัด 28-30 ที่ลงท้าย `);`) เพิ่ม:

```tsx
  // ติดตามสถิติการเข้าชม เฉพาะหน้าสาธารณะ (ไม่นับ /admin, /user)
  useSiteTracking(!isProtected);
```

- [ ] **Step 3.4:** ตรวจ: `npm run build` ผ่าน; dev → เปิดหน้าหลัก แล้ว `curl -s localhost:<port>/api/site-stats` เห็น `total`/`today` เพิ่มจากการเปิดหน้าจริง และ `online`≥1
- [ ] **Step 3.5:** Commit: `feat: site tracking hook ใน _app (visit 1/วัน + ping ออนไลน์, ยกเว้น admin/user)`

---

### Task 4: UI — `useCountUp` + `SiteStatsBar` (ใช้ frontend-design)

> **REQUIRED SUB-SKILL:** ก่อนเขียน UI ของ `SiteStatsBar.tsx` ให้ใช้ **frontend-design** เพื่อยกระดับงานออกแบบการ์ด (สี/spacing/gradient/glass/typography) — โค้ดด้านล่างเป็น baseline ที่ build ผ่านและทำงานครบ ให้ frontend-design ปรับ "ความสวย/ลูกเล่น" บนฐานนี้ ห้ามลดฟังก์ชัน (count-up, IntersectionObserver, poll online, จุดเขียวออนไลน์)

**Files:**
- Create: `components/site-stats/useCountUp.ts`
- Create: `components/site-stats/SiteStatsBar.tsx`

- [ ] **Step 4.1:** สร้าง `components/site-stats/useCountUp.ts`:

```ts
import { useEffect, useRef, useState } from "react";

// นับเลขจากค่าก่อนหน้า → target ด้วย requestAnimationFrame (ease-out)
// re-animate ทุกครั้งที่ target เปลี่ยน (รองรับ online ที่อัปเดตเป็นช่วง)
export function useCountUp(target: number, durationMs = 1200, start = true) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!start) return;
    const from = fromRef.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, target, durationMs]);

  return value;
}
```

- [ ] **Step 4.2:** สร้าง baseline `components/site-stats/SiteStatsBar.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { Eye, CalendarDays, TrendingUp, Radio } from "lucide-react";
import { useCountUp } from "./useCountUp";

interface Stats {
  total: number;
  today: number;
  month: number;
  online: number;
}

const POLL_MS = 60_000;

function StatCard({
  icon,
  label,
  value,
  visible,
  live = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  visible: boolean;
  live?: boolean;
}) {
  const display = useCountUp(value, 1200, visible);
  return (
    <div className="relative flex flex-col items-center justify-center rounded-2xl bg-white/70 backdrop-blur border border-gray-100 shadow-sm px-4 py-5">
      <div className="mb-2 text-indigo-500">{icon}</div>
      <div className="text-2xl font-bold text-gray-800 tabular-nums">
        {display.toLocaleString("th-TH")}
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
        {live && (
          <span className="inline-grid *:[grid-area:1/1]">
            <span className="status status-success status-sm animate-ping"></span>
            <span className="status status-success status-sm"></span>
          </span>
        )}
        {label}
      </div>
    </div>
  );
}

// แถบสถิติการเข้าชมเว็บไซต์ (แสดงบนหน้าหลัก ส่วนล่าง)
export default function SiteStatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/site-stats")
        .then((r) => r.json())
        .then((j) => {
          if (j.success) setStats(j.data);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!stats) return null;

  return (
    <section ref={ref} className="w-full max-w-5xl mx-auto px-4 mb-6">
      <h2 className="text-center text-sm font-semibold text-gray-500 mb-3">
        สถิติการเข้าชมเว็บไซต์
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Eye size={22} />} label="เข้าชมทั้งหมด" value={stats.total} visible={visible} />
        <StatCard icon={<CalendarDays size={22} />} label="วันนี้" value={stats.today} visible={visible} />
        <StatCard icon={<TrendingUp size={22} />} label="เดือนนี้" value={stats.month} visible={visible} />
        <StatCard icon={<Radio size={22} />} label="กำลังออนไลน์" value={stats.online} visible={visible} live />
      </div>
    </section>
  );
}
```

- [ ] **Step 4.3:** `npm run build` ผ่าน (baseline ก่อน frontend-design ปรับ)
- [ ] **Step 4.4:** ใช้ **frontend-design** ปรับ `SiteStatsBar.tsx` ให้ดูสมัยใหม่ขึ้น (รักษาทุกฟังก์ชันใน 4.2) → `npm run build` ผ่านอีกครั้ง
- [ ] **Step 4.5:** Commit: `feat: SiteStatsBar — การ์ดสถิติ 4 ช่อง + count-up animation`

---

### Task 5: วางบนหน้าหลัก

**Files:**
- Modify: `pages/index.tsx`

- [ ] **Step 5.1:** เพิ่ม import (หลังบรรทัด `import ActivityFeed from "@/components/activities/ActivityFeed";` ราวบรรทัด 20):

```tsx
import SiteStatsBar from "@/components/site-stats/SiteStatsBar";
```

- [ ] **Step 5.2:** ใน `pages/index.tsx` แทรก `<SiteStatsBar />` ระหว่าง `</div>` ปิดแถบคู่มือประชาชน (บรรทัดราว 217) กับ `<Footer />` (บรรทัดราว 219). โครงเดิม:

```tsx
        )}
      </div>

      <Footer />
```

แก้เป็น:

```tsx
        )}
      </div>

      <SiteStatsBar />

      <Footer />
```

(แถบที่จะแทรกอยู่หลังคือ `<div className="flex justify-center items-center gap-4 text-purple-400 ...">` ที่มีลิงก์ "คู่มือประชาชน" — `<SiteStatsBar />` ต้องอยู่ "หลัง" div นั้น และ "ก่อน" `<Footer />`)

- [ ] **Step 5.3:** ตรวจ: `npm run build` + dev → เปิดหน้าหลัก เลื่อนลงล่างถัดจาก "คู่มือประชาชน" เห็นการ์ด 4 ช่อง ตัวเลขนับขึ้นเมื่อเลื่อนถึง; refresh ไม่เพิ่ม visit ซ้ำ (session เดิม); เปิดอีกแท็บ → online เพิ่ม
- [ ] **Step 5.4:** Commit: `feat: แสดง SiteStatsBar บนหน้าหลัก (ใต้คู่มือประชาชน)`

---

### Task 6: เอกสารโมดูล + verification รวม

**Files:**
- Create: `docs/modules/site-stats.md`
- Modify: `docs/modules/README.md`

- [ ] **Step 6.1:** สร้าง `docs/modules/site-stats.md`:

```markdown
# สถิติการเข้าชมเว็บไซต์ (site-stats)

นับและแสดงสถิติการเข้าชมเว็บไซต์สาธารณะบนหน้าหลัก (ยอดรวม/วันนี้/เดือนนี้/ออนไลน์)

## หน้า
- แสดงผล: การ์ด `SiteStatsBar` บน `pages/index.tsx` (ส่วนล่าง ใต้ "คู่มือประชาชน")

## API (public, แตะ Mongo เท่านั้น)
- `POST /api/site-stats/visit` — นับการเข้าชม (กันซ้ำ 1/วัน/แท็บ ฝั่ง client ด้วย sessionStorage)
- `POST /api/site-stats/ping` — heartbeat ออนไลน์ (body `{clientId}`)
- `GET  /api/site-stats` — คืน `{ total, today, month, online }`

## Models (`models/site-stats/`)
- `SiteVisitDaily` (`site_visit_daily`) — `{date:"YYYY-MM-DD", count}` (เขต Asia/Bangkok)
- `SiteStatsTotal` (`site_stats_total`) — doc เดียว `_id:"total"` running total
- `SiteOnline` (`site_online`) — `{clientId, lastSeen}` + **TTL index 300 วิ**

## การนับ
- visit: นับทั้งเว็บผ่าน hook `useSiteTracking` ใน `_app.tsx` — ยกเว้น `/admin/*`, `/user/*`
- online: ping ทุก 60 วิ; TTL ลบ doc ที่เงียบเกิน 5 นาที → `countDocuments()` = ออนไลน์ตอนนี้

## Components (`components/site-stats/`)
- `useSiteTracking` (hook ใน _app), `useCountUp` (เลขนับขึ้น), `SiteStatsBar` (การ์ด 4 ช่อง)

## หมายเหตุ
- `clientId` เป็น UUID สุ่มใน localStorage — ไม่มี PII (PDPA-safe)
- `getBangkokYMD` ใน `lib/site-stats/date.js` ซ้ำกับ pm25/smart-papar — รวมเป็น util กลางเฟส 6/7
```

- [ ] **Step 6.2:** ใน `docs/modules/README.md` เพิ่มแถวในตารางโมดูล (ใต้แถว "แจ้งเตือน / Audit log"):

```markdown
| สถิติการเข้าชมเว็บไซต์ | [site-stats.md](site-stats.md) | `/` (การ์ดบนหน้าหลัก) |
```

- [ ] **Step 6.3:** Verification รวม:

```bash
npm run lint
npm run build
ls components/site-stats/ models/site-stats/ pages/api/site-stats/
grep -rn "SiteStatsBar" pages/index.tsx
grep -rn "useSiteTracking" pages/_app.tsx
```
Expected: lint ไม่มี error ใหม่, build ✓, ทุกไฟล์มีครบ, grep เจอการเรียกใช้ทั้ง 2 จุด

- [ ] **Step 6.4:** Commit: `docs: โมดูล site-stats + ลงทะเบียนในดัชนีโมดูล`

---

## Self-review notes (ทำแล้ว)

- ครอบ spec ครบ: models 3(T1), lib(T1), API 3(T2), tracking+ _app(T3), UI useCountUp+SiteStatsBar+frontend-design(T4), วางหน้าหลัก(T5), docs(T6)
- ชื่อ/ลายเซ็นสอดคล้อง: `getBangkokYMD`, `useSiteTracking(enabled)`, `useCountUp(target,durationMs,start)`, GET คืน `{total,today,month,online}` — ใช้ตรงกันทุก task
- ทุก commit build ผ่าน (models/API ก่อน แล้วค่อย import ใน hook/_app/หน้า)
- frontend-design ถูกระบุเป็น sub-skill ใน Task 4 (UI) ตามที่ผู้ใช้ขอ
- YAGNI: ไม่มีหน้า analytics admin, ไม่นับ unique/referrer/geo
