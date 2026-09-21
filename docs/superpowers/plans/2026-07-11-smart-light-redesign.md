# Smart Light UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin `/admin/smart-light` to the purple design (desktop layout 1a + mobile flow 2a), adding client-computed analysis panels, without touching any API/model.

**Architecture:** Keep the Leaflet map engine and all API wiring intact. Add a shared theme token file + a pure-function metrics module (TDD). Build 8 new presentational components (right-rail cards, data-table modal, map chips, mobile nearby card). Rewrite the page shell layout and restyle the 7 existing components. All new panels are derived state from the two endpoints already fetched — no new fetches.

**Tech Stack:** Next.js 15 Pages Router, React 19, Tailwind v4 + DaisyUI, react-leaflet, Google Fonts (Anuphan / IBM Plex Sans Thai). No test runner in repo → pure-function tests run via `node` (ESM detection).

**Reference:** spec `docs/superpowers/specs/2026-07-11-smart-light-redesign-design.md`; mockup `Smart Light.dc.html`.

**Design tokens (used verbatim throughout):** primary `#7C3AED`, primary-dark `#6D28D9`, soft `#EDE7FD`/`#F1ECFB`, ink `#211B2E`, ink-2 `#57506A`, muted `#8A8398`, surface `#FAF8FF`, line `#E7E2F2`. Status colors come from existing `POLE_STATUS` (`normal #16A34A`, `damaged #F59E0B`, `off #DC2626`, `unknown #9CA3AF`).

---

## File Structure

**New:**
- `lib/smart-light/theme.js` — color/font tokens
- `lib/smart-light/metrics.js` — pure derivations (healthSummary, overduePoles, groupHeat, daysSince)
- `lib/smart-light/__tests__/metrics.test.mjs` — node assert tests
- `components/smart-light/HealthSummaryCard.js`
- `components/smart-light/StatusCards.js`
- `components/smart-light/OverdueCard.js`
- `components/smart-light/GroupHeatmapCard.js`
- `components/smart-light/RightRail.js`
- `components/smart-light/MapStatusChips.js`
- `components/smart-light/DataTableModal.js`
- `components/smart-light/NearbyCard.js`

**Modified (reskin, logic preserved):**
- `pages/admin/smart-light.jsx`
- `components/smart-light/{SmartLightMap,PoleBottomSheet,SurveyModal,AddPoleModal,EditPoleModal,GroupRenameModal,SearchPanel}.js`
- `docs/modules/smart-light.md`

**Untouched:** everything under `pages/api/smart-light/`, `models/smart-light/`, and `lib/smart-light/{constants,geo,poleCode,uploadImage}.js`.

---

## Task 1: Theme tokens

**Files:**
- Create: `lib/smart-light/theme.js`

- [ ] **Step 1: Create the theme file**

```js
// โทเคนสี/ฟอนต์ธีมม่วง ใช้ร่วมกันทุก component ของ smart-light (ดีไซน์ใหม่ 2026-07)
export const SL = {
  primary: "#7C3AED",
  primaryDark: "#6D28D9",
  soft: "#EDE7FD",
  soft2: "#F1ECFB",
  ink: "#211B2E",
  ink2: "#57506A",
  muted: "#8A8398",
  surface: "#FAF8FF",
  line: "#E7E2F2",
  white: "#ffffff",
};

export const SL_FONT_HEAD = "'Anuphan', sans-serif";
export const SL_FONT_BODY = "'IBM Plex Sans Thai', sans-serif";
export const SL_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700;800&family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&display=swap";
```

- [ ] **Step 2: Commit**

```bash
git add lib/smart-light/theme.js
git commit -m "feat(smart-light): เพิ่มโทเคนธีมม่วง (theme.js)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Metrics module (TDD)

**Files:**
- Create: `lib/smart-light/metrics.js`
- Test: `lib/smart-light/__tests__/metrics.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `lib/smart-light/__tests__/metrics.test.mjs`:

```js
import assert from "node:assert/strict";
import { daysSince, healthSummary, overduePoles, groupHeat } from "../metrics.js";

const NOW = new Date("2026-07-11T00:00:00Z").getTime();
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString();

// daysSince
assert.equal(daysSince(null, NOW), null, "null date → null");
assert.equal(daysSince("not-a-date", NOW), null, "bad date → null");
assert.equal(daysSince(daysAgo(5), NOW), 5, "5 days ago → 5");
assert.equal(daysSince(new Date(NOW + 86400000).toISOString(), NOW), 0, "future → 0");

// healthSummary
const groups = [
  { group: "A", total: 10, byStatus: { normal: 6, damaged: 2, off: 1, unknown: 1 }, centroid: { lat: 1, lng: 1 } },
  { group: "B", total: 5, byStatus: { normal: 5, damaged: 0, off: 0, unknown: 0 }, centroid: { lat: 2, lng: 2 } },
];
let hs = healthSummary(groups);
assert.equal(hs.total, 15);
assert.equal(hs.normal, 11);
assert.equal(hs.problem, 3, "problem = damaged+off");
assert.equal(hs.unknown, 1);
assert.equal(hs.pct, 73, "round(11/15*100)");
assert.deepEqual(healthSummary([]), { total: 0, normal: 0, problem: 0, unknown: 0, pct: 0 }, "empty → zeros, pct 0");

// overduePoles: never-surveyed first, then oldest first
const poles = [
  { _id: "1", code: "c1", lastSurveyedAt: daysAgo(3) },
  { _id: "2", code: "c2", lastSurveyedAt: null },
  { _id: "3", code: "c3", lastSurveyedAt: daysAgo(30) },
];
const od = overduePoles(poles, 2, NOW);
assert.equal(od.length, 2, "top 2");
assert.equal(od[0]._id, "2", "never-surveyed on top");
assert.equal(od[0].daysLabel, "ยังไม่เคยสำรวจ");
assert.equal(od[1]._id, "3", "then oldest");
assert.equal(od[1].daysLabel, "30 วันก่อน");

// groupHeat: sorted by problem ratio desc
const gh = groupHeat(groups);
assert.equal(gh[0].name, "A", "A has higher problem ratio");
assert.equal(gh[0].problem, 3);
assert.ok(Math.abs(gh[0].ratio - 0.3) < 1e-9);
assert.equal(gh[1].ratio, 0);

console.log("metrics.test.mjs: all assertions passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node lib/smart-light/__tests__/metrics.test.mjs`
Expected: FAIL — cannot find module `../metrics.js` (not created yet).

- [ ] **Step 3: Write the implementation**

Create `lib/smart-light/metrics.js`:

```js
// ฟังก์ชันคำนวณตัวเลขสรุปสำหรับ panel ดีไซน์ใหม่ — pure ไม่มี side effect ทดสอบได้
// รับข้อมูลที่ fetch มาแล้วจาก /api/smart-light/{groups,poles}

// จำนวนวันเต็มจาก lastSurveyedAt ถึงตอนนี้; null ถ้าไม่มี/ไม่ถูกต้อง
export function daysSince(dateLike, now = Date.now()) {
  if (!dateLike) return null;
  const t = new Date(dateLike).getTime();
  if (Number.isNaN(t)) return null;
  const diff = now - t;
  return diff < 0 ? 0 : Math.floor(diff / 86400000);
}

// สรุปภาพรวมจาก groups (byStatus): total/normal/problem/unknown/pct
export function healthSummary(groups) {
  const acc = { total: 0, normal: 0, damaged: 0, off: 0, unknown: 0 };
  for (const g of groups || []) {
    const bs = g.byStatus || {};
    acc.total += g.total || 0;
    acc.normal += bs.normal || 0;
    acc.damaged += bs.damaged || 0;
    acc.off += bs.off || 0;
    acc.unknown += bs.unknown || 0;
  }
  const problem = acc.damaged + acc.off;
  const pct = acc.total ? Math.round((acc.normal / acc.total) * 100) : 0;
  return { total: acc.total, normal: acc.normal, problem, unknown: acc.unknown, pct };
}

// เสาค้างสำรวจนานสุด n ต้น: ยังไม่เคยสำรวจมาก่อน แล้วเรียงวันมาก→น้อย
export function overduePoles(poles, n, now = Date.now()) {
  const withDays = (poles || []).map((p) => ({ ...p, days: daysSince(p.lastSurveyedAt, now) }));
  withDays.sort((a, b) => {
    if (a.days === null && b.days === null) return 0;
    if (a.days === null) return -1;
    if (b.days === null) return 1;
    return b.days - a.days;
  });
  return withDays.slice(0, n).map((p) => ({
    ...p,
    daysLabel: p.days === null ? "ยังไม่เคยสำรวจ" : `${p.days} วันก่อน`,
  }));
}

// ความหนาแน่นปัญหารายกลุ่ม เรียง ratio มาก→น้อย (problem = damaged+off)
export function groupHeat(groups) {
  return (groups || [])
    .map((g) => {
      const bs = g.byStatus || {};
      const problem = (bs.damaged || 0) + (bs.off || 0);
      const total = g.total || 0;
      return { name: g.group, total, problem, ratio: total ? problem / total : 0, centroid: g.centroid || null };
    })
    .sort((a, b) => b.ratio - a.ratio);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node lib/smart-light/__tests__/metrics.test.mjs`
Expected: PASS — prints `metrics.test.mjs: all assertions passed`.
(If Node < 22 errors on ESM in `.js`, rerun with `node --experimental-detect-module lib/smart-light/__tests__/metrics.test.mjs`.)

- [ ] **Step 5: Commit**

```bash
git add lib/smart-light/metrics.js lib/smart-light/__tests__/metrics.test.mjs
git commit -m "feat(smart-light): metrics.js คำนวณสรุป/ค้างสำรวจ/heatmap + เทสต์

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: HealthSummaryCard

**Files:**
- Create: `components/smart-light/HealthSummaryCard.js`

- [ ] **Step 1: Create the component**

```jsx
import { SL } from "@/lib/smart-light/theme";

// การ์ดโดนัทสุขภาพเสาไฟรวม (% ปกติ) + legend — รับผล healthSummary(groups)
export default function HealthSummaryCard({ health }) {
  const { total, normal, problem, unknown, pct } = health;
  const deg = Math.round(pct * 3.6);
  const ring = `conic-gradient(#ffffff ${deg}deg, rgba(255,255,255,.22) 0)`;
  const rows = [
    { c: "#4ADE80", label: "ใช้งานได้", val: normal },
    { c: "#FCD34D", label: "ต้องซ่อม", val: problem },
    { c: "rgba(255,255,255,.55)", label: "ยังไม่สำรวจ", val: unknown },
  ];
  return (
    <div style={{ background: SL.primary, borderRadius: 22, padding: 20, color: "#fff", boxShadow: "0 22px 46px -26px rgba(124,58,237,.85)" }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,.85)" }}>สถานะเสาไฟรวม</div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 14 }}>
        <div style={{ position: "relative", width: 106, height: 106, borderRadius: "50%", background: ring, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
          <div style={{ width: 78, height: 78, borderRadius: "50%", background: SL.primary, display: "grid", placeItems: "center" }}>
            <div style={{ font: "800 27px 'Anuphan'", lineHeight: 1 }}>{pct}%</div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11 }}>
          {rows.map((r) => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: r.c }} />
              <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.85)", flex: 1 }}>{r.label}</span>
              <span style={{ font: "700 15px 'Anuphan'" }}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,.7)" }}>ทั้งหมด {total} ต้น</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/smart-light/HealthSummaryCard.js
git commit -m "feat(smart-light): HealthSummaryCard โดนัทสุขภาพรวม

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: StatusCards

**Files:**
- Create: `components/smart-light/StatusCards.js`

Props: `summary` = `{ total, normal, damaged, off, unknown }` (the page's existing summary object), `filterStatus`, `onFilter(value)`.

- [ ] **Step 1: Create the component**

```jsx
import { POLE_STATUS } from "@/lib/smart-light/constants";
import { SL } from "@/lib/smart-light/theme";

// การ์ดสถานะ 2×2 คลิกเพื่อ toggle กรองสถานะ — รับ summary (นับตาม filter กลุ่มปัจจุบัน)
export default function StatusCards({ summary, filterStatus, onFilter }) {
  const items = ["normal", "damaged", "off", "unknown"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {items.map((value) => {
        const s = POLE_STATUS[value];
        const active = filterStatus === value;
        return (
          <button
            key={value}
            onClick={() => onFilter(active ? "all" : value)}
            style={{ textAlign: "left", border: active ? `2px solid ${SL.primary}` : `1px solid ${SL.line}`, cursor: "pointer", background: "#fff", borderRadius: 16, padding: "13px 14px", display: "flex", flexDirection: "column", gap: 7 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color }} />
              <span style={{ font: "600 12px 'IBM Plex Sans Thai'", color: SL.ink2 }}>{s.label}</span>
            </div>
            <div style={{ font: "800 23px 'Anuphan'", color: SL.ink, lineHeight: 1 }}>{summary[value]}</div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/smart-light/StatusCards.js
git commit -m "feat(smart-light): StatusCards การ์ดสถานะ 2x2 กรองได้

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: OverdueCard

**Files:**
- Create: `components/smart-light/OverdueCard.js`

Props: `poles` (full list), `onSelect(pole)`.

- [ ] **Step 1: Create the component**

```jsx
import { POLE_STATUS } from "@/lib/smart-light/constants";
import { overduePoles } from "@/lib/smart-light/metrics";
import { SL } from "@/lib/smart-light/theme";

// เสาค้างสำรวจนานสุด (top 6) — คลิกเพื่อโฟกัสบนแผนที่
export default function OverdueCard({ poles, onSelect }) {
  const rows = overduePoles(poles, 6);
  return (
    <div style={{ background: "#fff", border: `1px solid ${SL.line}`, borderRadius: 22, padding: 18, boxShadow: "0 20px 50px -34px rgba(33,27,46,.4)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ font: "700 14px 'Anuphan'", color: SL.ink }}>⏱ ค้างสำรวจนานสุด</div>
        <span style={{ fontSize: 11, color: SL.muted }}>เรียงตามวันที่</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
        {rows.length === 0 && <div style={{ fontSize: 12.5, color: SL.muted, padding: "8px 0" }}>ยังไม่มีข้อมูล</div>}
        {rows.map((o) => (
          <div key={o._id} onClick={() => onSelect(o)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderTop: `1px solid ${SL.soft2}`, cursor: "pointer" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: (POLE_STATUS[o.status] || POLE_STATUS.unknown).color, flex: "0 0 auto" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "600 12.5px 'IBM Plex Sans Thai'", color: SL.ink }}>{o.code}</div>
              <div style={{ fontSize: 11, color: SL.muted }}>{o.group}</div>
            </div>
            <span style={{ font: "600 11.5px 'IBM Plex Sans Thai'", color: "#DC2626", whiteSpace: "nowrap" }}>{o.daysLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/smart-light/OverdueCard.js
git commit -m "feat(smart-light): OverdueCard เสาค้างสำรวจนานสุด

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: GroupHeatmapCard

**Files:**
- Create: `components/smart-light/GroupHeatmapCard.js`

Props: `groups`, `filterGroup`, `onSelectGroup(name, centroid)`.

- [ ] **Step 1: Create the component**

```jsx
import { groupHeat } from "@/lib/smart-light/metrics";
import { SL } from "@/lib/smart-light/theme";

// ความหนาแน่นปัญหารายกลุ่ม (รายกลุ่ม) — คลิกกรอง+บินไป centroid
export default function GroupHeatmapCard({ groups, filterGroup, onSelectGroup }) {
  const rows = groupHeat(groups);
  return (
    <div style={{ background: "#fff", border: `1px solid ${SL.line}`, borderRadius: 22, padding: 18, boxShadow: "0 20px 50px -34px rgba(33,27,46,.4)" }}>
      <div style={{ font: "700 14px 'Anuphan'", color: SL.ink }}>🔥 ความหนาแน่นปัญหา · รายกลุ่ม</div>
      <div style={{ fontSize: 11, color: SL.muted, marginTop: 2 }}>แตะกลุ่มเพื่อกรองแผนที่</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 13 }}>
        {rows.map((g) => {
          const alpha = (0.06 + g.ratio * 0.86).toFixed(3);
          const strong = g.ratio > 0.42;
          const active = filterGroup === g.name;
          return (
            <button
              key={g.name}
              onClick={() => onSelectGroup(active ? "all" : g.name, g.centroid)}
              style={{ textAlign: "left", cursor: "pointer", border: active ? `2px solid ${SL.primary}` : `1px solid ${SL.line}`, background: `rgba(124,58,237,${alpha})`, color: strong ? "#fff" : "#4A4360", borderRadius: 14, padding: "11px 12px" }}
            >
              <div style={{ font: "600 12px 'IBM Plex Sans Thai'", lineHeight: 1.25 }}>{g.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 6 }}>
                <span style={{ font: "800 20px 'Anuphan'", lineHeight: 1 }}>{g.problem}</span>
                <span style={{ fontSize: 10.5, color: strong ? "rgba(255,255,255,.78)" : SL.muted }}>/ {g.total} ต้น</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/smart-light/GroupHeatmapCard.js
git commit -m "feat(smart-light): GroupHeatmapCard heatmap รายกลุ่ม

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: RightRail (composes the four cards)

**Files:**
- Create: `components/smart-light/RightRail.js`

- [ ] **Step 1: Create the component**

```jsx
import { healthSummary } from "@/lib/smart-light/metrics";
import { SL } from "@/lib/smart-light/theme";
import HealthSummaryCard from "./HealthSummaryCard";
import StatusCards from "./StatusCards";
import OverdueCard from "./OverdueCard";
import GroupHeatmapCard from "./GroupHeatmapCard";

// แถบขวา (เดสก์ท็อป) — รวมการ์ดวิเคราะห์ทั้งหมด ซ่อนบนจอเล็กด้วย className จากหน้าเพจ
export default function RightRail({ summary, poles, groups, filterStatus, filterGroup, onFilterStatus, onSelectPole, onSelectGroup }) {
  const health = healthSummary(groups);
  return (
    <div style={{ width: 388, flex: "0 0 auto", borderLeft: `1px solid ${SL.line}`, background: SL.surface, padding: 18, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <HealthSummaryCard health={health} />
      <StatusCards summary={summary} filterStatus={filterStatus} onFilter={onFilterStatus} />
      <OverdueCard poles={poles} onSelect={onSelectPole} />
      <GroupHeatmapCard groups={groups} filterGroup={filterGroup} onSelectGroup={onSelectGroup} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/smart-light/RightRail.js
git commit -m "feat(smart-light): RightRail รวมการ์ดแถบขวา

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: MapStatusChips (floating over map)

**Files:**
- Create: `components/smart-light/MapStatusChips.js`

Props: `summary`, `filterStatus`, `onFilter(value)`.

- [ ] **Step 1: Create the component**

```jsx
import { POLE_STATUS } from "@/lib/smart-light/constants";
import { SL } from "@/lib/smart-light/theme";

// pill กรองสถานะลอยเหนือแผนที่ (บนสุดกลางจอ) — เลื่อนแนวนอนได้บนมือถือ
export default function MapStatusChips({ summary, filterStatus, onFilter }) {
  const chip = (value, label, count, color) => {
    const active = filterStatus === value;
    return (
      <button
        key={value}
        onClick={() => onFilter(value === "all" ? "all" : active ? "all" : value)}
        style={{ display: "flex", alignItems: "center", gap: 6, border: 0, cursor: "pointer", font: "600 12px 'IBM Plex Sans Thai'", padding: "6px 11px", borderRadius: 11, whiteSpace: "nowrap", background: active ? SL.soft : "transparent", color: active ? SL.primaryDark : SL.ink2 }}
      >
        {color && <span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />}
        {label} {count}
      </button>
    );
  };
  return (
    <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,.92)", backdropFilter: "blur(6px)", padding: 6, borderRadius: 16, boxShadow: "0 12px 34px -18px rgba(33,27,46,.5)", overflowX: "auto", maxWidth: "92vw" }}>
      {chip("all", "ทั้งหมด", summary.total, null)}
      {Object.entries(POLE_STATUS).map(([value, s]) => chip(value, s.label, summary[value], s.color))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/smart-light/MapStatusChips.js
git commit -m "feat(smart-light): MapStatusChips ชิปกรองสถานะลอยบนแผนที่

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: DataTableModal

**Files:**
- Create: `components/smart-light/DataTableModal.js`

Props: `poles`, `onSelectRow(pole)`, `onClose`. Sortable columns + text filter; row click focuses map and closes.

- [ ] **Step 1: Create the component**

```jsx
import { useMemo, useState } from "react";
import { POLE_STATUS } from "@/lib/smart-light/constants";
import { daysSince } from "@/lib/smart-light/metrics";
import { SL } from "@/lib/smart-light/theme";

// ตารางเสาทั้งหมด — ค้นหา (รหัส/กลุ่ม) + เรียงคอลัมน์; คลิกแถวโฟกัสบนแผนที่แล้วปิด
export default function DataTableModal({ poles, onSelectRow, onClose }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "code", dir: 1 });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const days = (p) => { const d = daysSince(p.lastSurveyedAt); return d === null ? Infinity : d; };
    const val = (p, key) => (key === "days" ? days(p) : String(p[key] ?? "").toLowerCase());
    return poles
      .filter((p) => !term || p.code.toLowerCase().includes(term) || (p.group || "").toLowerCase().includes(term))
      .sort((a, b) => {
        const av = val(a, sort.key), bv = val(b, sort.key);
        if (av < bv) return -1 * sort.dir;
        if (av > bv) return 1 * sort.dir;
        return 0;
      });
  }, [poles, q, sort]);

  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));
  const th = (key, label, align) => (
    <button onClick={() => toggleSort(key)} style={{ textAlign: align || "left", border: 0, background: "transparent", cursor: "pointer", font: "700 12px 'IBM Plex Sans Thai'", color: SL.ink2, padding: 0 }}>
      {label}{sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </button>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(33,27,46,.42)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 940, height: "100%", maxHeight: 800, background: SL.surface, borderRadius: 26, boxShadow: "0 40px 90px -40px rgba(33,27,46,.7)", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "'IBM Plex Sans Thai'" }}>
        <div style={{ padding: "18px 24px", display: "flex", alignItems: "center", gap: 14, borderBottom: `1px solid ${SL.line}`, background: "#fff" }}>
          <div>
            <div style={{ font: "700 19px 'Anuphan'", color: SL.ink }}>📋 ตารางทะเบียนเสาไฟ</div>
            <div style={{ fontSize: 12, color: SL.muted, marginTop: 2 }}>ทั้งหมด {poles.length} ต้น · แตะแถวเพื่อดูบนแผนที่</div>
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 ค้นหารหัส / กลุ่ม" style={{ marginLeft: "auto", background: "#F6F3FD", border: `1px solid ${SL.line}`, borderRadius: 12, padding: "9px 13px", width: 240, font: "500 12.5px 'IBM Plex Sans Thai'", color: SL.ink, outline: "none" }} />
          <button onClick={onClose} style={{ cursor: "pointer", width: 34, height: 34, borderRadius: "50%", background: SL.soft2, color: SL.primary, border: 0, fontSize: 15 }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.9fr 1fr", gap: 8, padding: "13px 24px", background: "#F6F3FD", borderBottom: `1px solid ${SL.line}` }}>
          {th("code", "รหัสเสา")}{th("group", "กลุ่ม / ชุมชน")}{th("status", "สถานะ")}{th("days", "สำรวจล่าสุด", "right")}
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {rows.map((p) => {
            const s = POLE_STATUS[p.status] || POLE_STATUS.unknown;
            const d = daysSince(p.lastSurveyedAt);
            return (
              <div key={p._id} onClick={() => onSelectRow(p)} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.9fr 1fr", gap: 8, padding: "12px 24px", alignItems: "center", borderBottom: `1px solid #F4F1FB`, cursor: "pointer", fontSize: 12.5, color: SL.ink }}>
                <div style={{ fontWeight: 600 }}>{p.code}</div>
                <div style={{ color: SL.ink2 }}>{p.group}</div>
                <div><span style={{ font: "600 11px 'IBM Plex Sans Thai'", color: "#fff", background: s.color, padding: "2px 10px", borderRadius: 20 }}>{s.label}</span></div>
                <div style={{ textAlign: "right", color: SL.muted }}>{d === null ? "—" : `${d} วัน`}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/smart-light/DataTableModal.js
git commit -m "feat(smart-light): DataTableModal ตารางข้อมูลเสาเรียง/ค้นหาได้

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: NearbyCard (mobile)

**Files:**
- Create: `components/smart-light/NearbyCard.js`

Props: `poles`, `onSelect(pole)`. Reads GPS once, shows nearest 3 within radius; handles no-GPS gracefully.

- [ ] **Step 1: Create the component**

```jsx
import { useEffect, useState } from "react";
import { POLE_STATUS } from "@/lib/smart-light/constants";
import { haversineMeters } from "@/lib/smart-light/geo";
import { SL } from "@/lib/smart-light/theme";

// การ์ด "เสาไฟใกล้คุณ" (มือถือ) — ใช้ GPS + haversine หา 3 ต้นใกล้สุด
export default function NearbyCard({ poles, onSelect }) {
  const [pos, setPos] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) { setErr("อุปกรณ์นี้ไม่รองรับ GPS"); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setErr("เปิดสิทธิ์ตำแหน่งเพื่อดูเสาใกล้คุณ")
    );
  }, []);

  const near = pos
    ? poles
        .map((p) => ({ ...p, dist: haversineMeters(pos.lat, pos.lng, p.lat, p.lng) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3)
    : [];

  return (
    <div style={{ background: "#fff", border: `1px solid ${SL.line}`, borderRadius: 22, boxShadow: "0 22px 44px -22px rgba(33,27,46,.45)", padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ font: "700 13px 'Anuphan'", color: SL.ink }}>📍 เสาไฟใกล้คุณ</div>
        <div style={{ fontSize: 11, color: SL.muted }}>ใกล้สุด 3 ต้น</div>
      </div>
      {err && <div style={{ fontSize: 11.5, color: SL.muted, marginTop: 8 }}>{err}</div>}
      {near.map((o) => (
        <div key={o._id} onClick={() => onSelect(o)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${SL.soft2}`, cursor: "pointer" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: (POLE_STATUS[o.status] || POLE_STATUS.unknown).color, flex: "0 0 auto" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "600 12.5px 'IBM Plex Sans Thai'", color: SL.ink }}>{o.code}</div>
            <div style={{ fontSize: 10.5, color: SL.muted }}>{o.group} · ห่าง {Math.round(o.dist)} ม.</div>
          </div>
          <span style={{ font: "600 11px 'IBM Plex Sans Thai'", color: SL.primary }}>นำทาง</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/smart-light/NearbyCard.js
git commit -m "feat(smart-light): NearbyCard เสาไฟใกล้ตัว (มือถือ)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Rewrite the page shell layout + wiring

**Files:**
- Modify: `pages/admin/smart-light.jsx` (replace imports block + the entire `return (...)`; keep ALL state/hooks/handlers exactly as-is)

Preserve every existing hook and handler: `poles, groups, boundaries, loading, loadError, filterGroup, filterStatus, selectedPole, sheetLoading, surveyPole, editPole, renameOpen, addMode, pickedLatLng, addFormOpen, focusTarget`, plus `loadAll, groupNames, filteredPoles, summary, openPole, focusPole, refreshAndClose, pickCurrentLocation`. Add one new state and one new handler; add fonts; replace the JSX shell.

- [ ] **Step 1: Update the imports block (top of file)**

Replace lines 1–23 (the imports + both `dynamic(...)` calls) with:

```jsx
// หน้าเสาไฟสาธารณะ (กองช่าง) — ดีไซน์ใหม่ธีมม่วง: แผนที่ + แถบขวาวิเคราะห์ + มือถือ responsive
import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import PermissionGuard from "@/components/PermissionGuard";
import { SL, SL_FONT_HEAD, SL_FONT_BODY, SL_FONTS_HREF } from "@/lib/smart-light/theme";
import PoleBottomSheet from "@/components/smart-light/PoleBottomSheet";
import SurveyModal from "@/components/smart-light/SurveyModal";
import AddPoleModal from "@/components/smart-light/AddPoleModal";
import GroupRenameModal from "@/components/smart-light/GroupRenameModal";
import SearchPanel from "@/components/smart-light/SearchPanel";
import RightRail from "@/components/smart-light/RightRail";
import MapStatusChips from "@/components/smart-light/MapStatusChips";
import DataTableModal from "@/components/smart-light/DataTableModal";
import NearbyCard from "@/components/smart-light/NearbyCard";

// มี leaflet ข้างใน — โหลดเฉพาะฝั่ง client
const SmartLightMap = dynamic(() => import("@/components/smart-light/SmartLightMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full" style={{ color: SL.muted }}>
      กำลังโหลดแผนที่…
    </div>
  ),
});
const EditPoleModal = dynamic(() => import("@/components/smart-light/EditPoleModal"), {
  ssr: false,
});
```

- [ ] **Step 2: Add `tableOpen` state + `selectGroup` handler**

Immediately after the `const [focusTarget, setFocusTarget] = useState(null);` line, add:

```jsx
  const [tableOpen, setTableOpen] = useState(false);
```

Immediately after the `focusPole` useCallback block, add:

```jsx
  // เลือกกลุ่มจาก heatmap: toggle filter + บินไป centroid ของกลุ่ม
  const selectGroup = useCallback((name, centroid) => {
    setFilterGroup(name);
    if (name !== "all" && centroid) {
      setFocusTarget({ lat: centroid.lat, lng: centroid.lng, zoom: 15, key: Date.now() });
    }
  }, []);
```

- [ ] **Step 3: Replace the entire `return (...)` block**

Replace from `return (` through the final `);` (the closing of the component's return) with:

```jsx
  return (
    <PermissionGuard>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={SL_FONTS_HREF} />
      </Head>
      <main className="sl-root h-full flex flex-col" style={{ fontFamily: SL_FONT_BODY, background: SL.surface }}>
        {/* Header ม่วง */}
        <div style={{ background: SL.primary, color: "#fff", flex: "0 0 auto" }} className="flex items-center gap-3 px-4 py-3 flex-wrap">
          <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(255,255,255,.16)", display: "grid", placeItems: "center", fontSize: 22 }}>💡</div>
          <div className="min-w-0">
            <div style={{ font: `700 18px ${SL_FONT_HEAD}` }}>เสาไฟสาธารณะ · กองช่าง</div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.82)" }}>
              ทะเบียนเสาไฟ LED · {poles.length} ต้น · {filterGroup === "all" ? "ทุกกลุ่ม" : filterGroup}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <div className="hidden md:block" style={{ width: 200 }}>
              <SearchPanel poles={poles} onFocusPole={focusPole} />
            </div>
            <button onClick={() => setTableOpen(true)} style={{ border: 0, cursor: "pointer", background: "rgba(255,255,255,.16)", color: "#fff", font: "600 13px 'IBM Plex Sans Thai'", padding: "10px 14px", borderRadius: 12 }}>📋 ตารางข้อมูล</button>
            <button onClick={() => setRenameOpen(true)} style={{ border: 0, cursor: "pointer", background: "rgba(255,255,255,.16)", color: "#fff", font: "600 13px 'IBM Plex Sans Thai'", padding: "10px 14px", borderRadius: 12 }}>🏘️ กลุ่ม</button>
            {addMode ? (
              <button onClick={() => { setAddMode(false); setPickedLatLng(null); }} style={{ border: 0, cursor: "pointer", background: "#DC2626", color: "#fff", font: "700 13px 'IBM Plex Sans Thai'", padding: "10px 16px", borderRadius: 12 }}>✕ ยกเลิก</button>
            ) : (
              <button onClick={() => { setAddMode(true); setSelectedPole(null); }} style={{ border: 0, cursor: "pointer", background: "#fff", color: SL.primaryDark, font: "700 13px 'IBM Plex Sans Thai'", padding: "10px 16px", borderRadius: 12 }}>➕ เพิ่มเสา</button>
            )}
          </div>
        </div>

        {/* add-mode banner */}
        {addMode && (
          <div className="flex items-center gap-2 flex-wrap px-4 py-2 text-sm" style={{ background: SL.soft, color: SL.primaryDark, flex: "0 0 auto" }}>
            <span>แตะจุดบนแผนที่เพื่อวางเสาใหม่ หรือ</span>
            <button className="btn btn-xs" onClick={pickCurrentLocation}>📍 ใช้ตำแหน่งปัจจุบัน</button>
            {pickedLatLng && <button className="btn btn-xs btn-primary" onClick={() => setAddFormOpen(true)}>✓ ยืนยันตำแหน่งนี้</button>}
          </div>
        )}

        {loadError && (
          <div className="alert alert-error py-2 text-sm mx-4 my-2" style={{ flex: "0 0 auto" }}>
            {loadError}
            <button className="btn btn-xs" onClick={loadAll}>ลองใหม่</button>
          </div>
        )}

        {/* body: map + right rail */}
        <div className="flex-1 flex min-h-0">
          <div className="relative flex-1 min-w-0">
            {loading ? (
              <div className="flex items-center justify-center h-full" style={{ color: SL.muted }}>กำลังโหลดข้อมูลเสาไฟ…</div>
            ) : (
              <SmartLightMap
                poles={filteredPoles}
                boundaries={boundaries}
                groups={groups.filter((g) => filterGroup === "all" || g.group === filterGroup)}
                focusTarget={focusTarget}
                selectedPoleId={selectedPole?._id || null}
                addMode={addMode}
                pickedLatLng={pickedLatLng}
                onPickLocation={setPickedLatLng}
                onSelectPole={openPole}
              />
            )}

            {/* chips ลอยบนแผนที่ */}
            <div className="absolute z-[8]" style={{ top: 14, left: "50%", transform: "translateX(-50%)" }}>
              <MapStatusChips summary={summary} filterStatus={filterStatus} onFilter={setFilterStatus} />
            </div>

            {/* การ์ดเสาใกล้ตัว (มือถือเท่านั้น) */}
            {!loading && !selectedPole && (
              <div className="lg:hidden absolute z-[9]" style={{ left: 14, right: 14, bottom: 16 }}>
                <NearbyCard poles={poles} onSelect={focusPole} />
              </div>
            )}
          </div>

          {/* แถบขวา (เดสก์ท็อป) */}
          {!loading && (
            <div className="hidden lg:flex">
              <RightRail
                summary={summary}
                poles={poles}
                groups={groups}
                filterStatus={filterStatus}
                filterGroup={filterGroup}
                onFilterStatus={setFilterStatus}
                onSelectPole={focusPole}
                onSelectGroup={selectGroup}
              />
            </div>
          )}
        </div>

        {/* modals */}
        {selectedPole && !surveyPole && !editPole && (
          <PoleBottomSheet
            pole={selectedPole}
            loading={sheetLoading}
            onClose={() => setSelectedPole(null)}
            onSurvey={(p) => setSurveyPole(p)}
            onEdit={(p) => setEditPole(p)}
          />
        )}
        {surveyPole && <SurveyModal pole={surveyPole} onClose={() => setSurveyPole(null)} onSaved={refreshAndClose} />}
        {editPole && (
          <EditPoleModal key={editPole._id} pole={editPole} groupNames={groupNames} onClose={() => setEditPole(null)} onSaved={refreshAndClose} onDeleted={refreshAndClose} />
        )}
        {addFormOpen && pickedLatLng && (
          <AddPoleModal latLng={pickedLatLng} groupNames={groupNames} onClose={() => setAddFormOpen(false)} onSaved={refreshAndClose} />
        )}
        {renameOpen && <GroupRenameModal groups={groups} onClose={() => setRenameOpen(false)} onRenamed={refreshAndClose} />}
        {tableOpen && (
          <DataTableModal
            poles={poles}
            onClose={() => setTableOpen(false)}
            onSelectRow={(p) => { setTableOpen(false); focusPole(p); }}
          />
        )}
      </main>
    </PermissionGuard>
  );
```

- [ ] **Step 4: Verify it builds**

Run: `npm run lint`
Expected: no errors in `pages/admin/smart-light.jsx` (warnings pre-existing elsewhere are fine). If lint passes, the imports/JSX are consistent.

- [ ] **Step 5: Commit**

```bash
git add pages/admin/smart-light.jsx
git commit -m "feat(smart-light): เปลี่ยน layout หน้าเป็นธีมม่วง + แถบขวา + responsive

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: SmartLightMap marker styling

**Files:**
- Modify: `components/smart-light/SmartLightMap.js`

Goal: pole dots get a white border + a selection ring, matching the mockup. **Do not change** map logic, zoom thresholds, GeoJSON boundary handling, `bringToBack`, viewport filtering, or prop names.

- [ ] **Step 1: Read the file and locate the pole `CircleMarker`**

Run: `grep -n "CircleMarker\|pathOptions\|fillColor\|weight\|radius" components/smart-light/SmartLightMap.js`
Identify the pole marker's style options (currently: radius 7 normal / 11 selected, `fillColor` from `POLE_STATUS`).

- [ ] **Step 2: Update the pole marker path options**

On the pole `CircleMarker`, set the `pathOptions` so selected poles read as the mockup dot (white stroke always; thicker ring when selected). Change the existing style object to:

```jsx
pathOptions={{
  color: "#ffffff",
  weight: isSelected ? 4 : 2,
  fillColor: POLE_STATUS[pole.status]?.color || POLE_STATUS.unknown.color,
  fillOpacity: 1,
}}
```

(Use the existing variable that marks the selected pole — it compares `pole._id === selectedPoleId`. Keep the existing `radius` logic: selected larger.)

- [ ] **Step 3: Verify visually**

Run: `npm run dev`, open `/admin/smart-light`, zoom in past level 15. Expected: pole dots have crisp white borders; the selected pole shows a thicker white ring and larger radius. Group bubbles and community boundaries unchanged.

- [ ] **Step 4: Commit**

```bash
git add components/smart-light/SmartLightMap.js
git commit -m "style(smart-light): หมุดขอบขาว + วงแหวนตอนเลือก (คงตรรกะแผนที่)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 13: PoleBottomSheet reskin (responsive detail card)

**Files:**
- Modify: `components/smart-light/PoleBottomSheet.js`

Goal: purple styling; on desktop (`lg:`) render as a compact floating card anchored bottom-left over the map; on mobile a full-width bottom sheet. **Preserve** props (`pole, loading, onClose, onSurvey, onEdit`), the survey-history rendering, photo, status badge, and the นำทาง (Google Maps) link built from `pole.lat/lng`.

- [ ] **Step 1: Read the file**

Run: `sed -n '1,200p' components/smart-light/PoleBottomSheet.js` — note the outer container classes, the header (code + status badge), photo block, notes, survey history list, and action buttons.

- [ ] **Step 2: Restyle the outer container to be responsive**

Change the root wrapper so it is a bottom sheet on mobile and a floating card on desktop. Replace the outer container `className`/style with:

```jsx
className="fixed z-[1000] inset-x-0 bottom-0 lg:inset-auto lg:left-4 lg:bottom-4 lg:w-80"
style={{ background: "#fff", border: `1px solid ${SL.line}`, borderRadius: 22, boxShadow: "0 26px 54px -26px rgba(33,27,46,.55)", padding: 16, maxHeight: "70vh", overflowY: "auto" }}
```

Add at the top of the file: `import { SL, SL_FONT_HEAD } from "@/lib/smart-light/theme";`

- [ ] **Step 3: Apply purple accents**

- Pole code heading → `style={{ font: \`800 16px ${SL_FONT_HEAD}\`, color: SL.ink }}`.
- Group badge → `style={{ background: SL.soft2, color: SL.primaryDark }}` (keep the 🏘️ prefix).
- Status badge → keep `background: POLE_STATUS[pole.status].color`, white text.
- Primary "🔦 บันทึกสภาพ" button → `style={{ background: SL.primary, color: "#fff" }}`.
- "🧭 นำทาง" and "แก้ไข" buttons → outline: `style={{ border: \`1px solid ${SL.line}\`, background: "#fff", color: SL.ink2 }}`.

Keep every `onClick` (`onSurvey(pole)`, `onEdit(pole)`, `onClose`, and the Google Maps link) exactly as-is.

- [ ] **Step 4: Verify**

Run `/admin/smart-light`, click a pole. Desktop: floating card bottom-left with purple buttons + survey history. Resize < 1024px: becomes a full-width bottom sheet. บันทึกสภาพ opens SurveyModal; นำทาง opens Google Maps.

- [ ] **Step 5: Commit**

```bash
git add components/smart-light/PoleBottomSheet.js
git commit -m "style(smart-light): PoleBottomSheet ธีมม่วง + responsive card/sheet

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 14: SurveyModal reskin

**Files:**
- Modify: `components/smart-light/SurveyModal.js`

Goal: purple header, three big status buttons, dashed photo dropzone — matching mockup phone-3. **Preserve** props (`pole, onClose, onSaved`), the `SURVEY_STATUS_VALUES` buttons, photo upload + graceful-failure logic, textarea, and the POST to `/api/smart-light/poles/:id/survey`.

- [ ] **Step 1: Read the file**

Run: `sed -n '1,200p' components/smart-light/SurveyModal.js` — note status-button rendering, file input, textarea, submit handler.

- [ ] **Step 2: Add theme import + restyle the header**

Add `import { SL, SL_FONT_HEAD } from "@/lib/smart-light/theme";`. Give the modal header `style={{ background: SL.primary, color: "#fff" }}` with title `style={{ font: \`700 20px ${SL_FONT_HEAD}\` }}` reading "🔦 บันทึกสภาพเสา" and a subtitle line `{pole.code} · 🏘️ {pole.group}`.

- [ ] **Step 3: Restyle the three status buttons**

For each `SURVEY_STATUS_VALUES` button, when selected use `background: POLE_STATUS[value].color; color: #fff`; when not selected `background: SL.soft2; color: SL.muted`. Make them tall (`height: 66px`), `borderRadius: 16`, `font: 700 15px 'Anuphan'`. Keep the click handler that sets the chosen status.

- [ ] **Step 4: Restyle photo dropzone + submit**

- Photo area: dashed border `1.5px dashed #DDD2FB`, `background:#fff`, rounded 14, centered "📷 แตะเพื่อถ่ายรูป หรือเลือกไฟล์". Keep the `<input type="file" capture>` wiring.
- Submit button → `background: "#16A34A"` (green ✓ บันทึกสภาพ), cancel → `background: SL.soft2; color: SL.primary`.

Keep the entire submit/upload flow untouched.

- [ ] **Step 5: Verify**

Open a pole → บันทึกสภาพ. Save with and without a photo → marker color updates, history grows (existing behavior). Purple header + big buttons render.

- [ ] **Step 6: Commit**

```bash
git add components/smart-light/SurveyModal.js
git commit -m "style(smart-light): SurveyModal ธีมม่วง ปุ่มสถานะใหญ่

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 15: AddPoleModal reskin

**Files:**
- Modify: `components/smart-light/AddPoleModal.js`

Goal: purple form styling matching mockup "เพิ่มเสาใหม่". **Preserve** props (`latLng, groupNames, onClose, onSaved`), the group datalist, lamp-type select, photo, notes, and POST to `/api/smart-light/poles`.

- [ ] **Step 1: Read the file**

Run: `sed -n '1,220p' components/smart-light/AddPoleModal.js`.

- [ ] **Step 2: Restyle**

Add `import { SL, SL_FONT_HEAD } from "@/lib/smart-light/theme";`. Apply:
- Header `background: SL.primary`, title `font: \`700 20px ${SL_FONT_HEAD}\`` "➕ เพิ่มเสาใหม่".
- Inputs/selects: `background:#fff; border:1.5px solid ${SL.line}; borderRadius:14; padding:11px 13px`.
- Field labels: `font: 700 12px 'IBM Plex Sans Thai'; color: ${SL.ink2}`.
- Auto-generated code preview chip (if shown) → `background: SL.soft2; border:1.5px dashed #DDD2FB; color: SL.primaryDark`.
- Save button → `background:#16A34A; color:#fff`; cancel → `background: SL.soft2; color: SL.primary`.

Keep all field bindings, the group datalist, and the submit handler untouched.

- [ ] **Step 3: Verify**

Enter add-mode → pick a point → เพิ่มเสา form opens purple; submit creates a pole (existing behavior) and refreshes.

- [ ] **Step 4: Commit**

```bash
git add components/smart-light/AddPoleModal.js
git commit -m "style(smart-light): AddPoleModal ฟอร์มธีมม่วง

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 16: EditPoleModal + GroupRenameModal light reskin

**Files:**
- Modify: `components/smart-light/EditPoleModal.js`
- Modify: `components/smart-light/GroupRenameModal.js`

Goal: light purple restyle only (header + primary buttons); **preserve all logic** — EditPole's inline drag-map, 2-stage delete confirm, PUT/DELETE; GroupRename's 409 merge-confirm flow.

- [ ] **Step 1: EditPoleModal — restyle header + buttons**

Add `import { SL, SL_FONT_HEAD } from "@/lib/smart-light/theme";`. Set the modal header `background: SL.primary; color:#fff`, title `font: \`700 18px ${SL_FONT_HEAD}\``. Primary "บันทึก" button → `background: SL.primary; color:#fff`. Leave the danger "ลบ" button red. Leave the inline Leaflet drag map and confirm logic untouched.

- [ ] **Step 2: GroupRenameModal — restyle header + buttons**

Same import. Header `background: SL.primary`. Primary action button → `background: SL.primary; color:#fff`. Keep the from/to inputs and the `confirmMerge` 409 flow untouched.

- [ ] **Step 3: Verify**

Edit a pole (drag to move, save, delete with 2-step confirm) and rename a group (including a name collision → merge-confirm prompt) — all still work; headers are purple.

- [ ] **Step 4: Commit**

```bash
git add components/smart-light/EditPoleModal.js components/smart-light/GroupRenameModal.js
git commit -m "style(smart-light): EditPole/GroupRename ปรับหัวโมดัลธีมม่วง

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 17: SearchPanel reskin (header pill)

**Files:**
- Modify: `components/smart-light/SearchPanel.js`

Goal: make the search input a compact white pill that fits inside the purple header. **Preserve** props (`poles, onFocusPole`) and the dual-mode detection (`lat,lng` → haversine top-10; text → fuzzy on code/group) plus the results dropdown.

- [ ] **Step 1: Read the file**

Run: `sed -n '1,160p' components/smart-light/SearchPanel.js`.

- [ ] **Step 2: Restyle the input + results**

Add `import { SL } from "@/lib/smart-light/theme";`. Give the input container: `background:#fff; borderRadius:12; padding:9px 13px` with a 🔍 prefix and placeholder "รหัส / กลุ่ม". Style the results dropdown as a white rounded card (`border:1px solid ${SL.line}; borderRadius:14; boxShadow:0 22px 44px -22px rgba(33,27,46,.45)`) positioned below the input (`absolute`, high z-index so it overlays the map). Keep `onFocusPole` on result click.

- [ ] **Step 3: Verify**

In the header search: type a code/group → results dropdown appears over the map; click → map flies + bottom sheet opens. Paste `15.259,100.349` → nearest-10 list. (On mobile the header hides this input via `hidden md:block` from Task 11 — that is expected; mobile uses NearbyCard.)

- [ ] **Step 4: Commit**

```bash
git add components/smart-light/SearchPanel.js
git commit -m "style(smart-light): SearchPanel เป็น pill ในหัวธีมม่วง

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 18: Docs + full manual verification

**Files:**
- Modify: `docs/modules/smart-light.md`

- [ ] **Step 1: Run the metrics test once more**

Run: `node lib/smart-light/__tests__/metrics.test.mjs`
Expected: `metrics.test.mjs: all assertions passed`.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no new errors in any `components/smart-light/*` or `pages/admin/smart-light.jsx` (pre-existing warnings elsewhere are acceptable).

- [ ] **Step 3: Manual walkthrough (dev server)**

Run `npm run dev`, open `/admin/smart-light`, and confirm each:
- Desktop ≥1024px: purple header, map, right rail with 4 cards; health % + status cards match the chip counts.
- Click a StatusCard → poles filter; click again → clears. Click a heatmap tile → filters group + map flies to centroid. Click an overdue row → map focuses that pole + bottom sheet opens.
- ตารางข้อมูล modal: sort each column (▲/▼), search a code/group, click a row → modal closes + map focuses.
- Resize < 1024px: right rail disappears; status chips scroll horizontally; NearbyCard appears bottom (or shows the "เปิดสิทธิ์ตำแหน่ง" message if GPS denied).
- Mobile: tap pole → bottom sheet → บันทึกสภาพ → save. Fonts Anuphan/IBM Plex load (headings look like the mockup).
- Map regression: zoom < 15 shows group bubbles; ≥ 15 shows dots; community boundaries stay behind dots; add/edit/delete/navigate all work.

- [ ] **Step 4: Update the module doc checklist**

In `docs/modules/smart-light.md`, under "Manual test checklist", append these items:

```markdown
10. ดีไซน์ใหม่ (ธีมม่วง): header ม่วง + แถบขวา 4 การ์ด (โดนัทสุขภาพ/สถานะ/ค้างสำรวจ/heatmap) แสดงเลขตรงกับ chip
11. คลิก StatusCard/heatmap tile/overdue row → กรอง+โฟกัสถูกต้อง
12. ตารางข้อมูล (DataTableModal): เรียงคอลัมน์, ค้นหารหัส/กลุ่ม, คลิกแถวโฟกัสบนแผนที่
13. responsive: ย่อจอ <1024px → แถบขวาหาย, chip เลื่อนแนวนอน, การ์ด "เสาไฟใกล้คุณ" โผล่ (หรือข้อความขอสิทธิ์ GPS)
14. เทสต์ metrics: `node lib/smart-light/__tests__/metrics.test.mjs` → ผ่าน
```

Also update the Components row in the "โครงสร้าง" table to add the new components:

```markdown
| Components | `components/smart-light/` (SmartLightMap, PoleBottomSheet, SurveyModal, EditPoleModal, AddPoleModal, GroupRenameModal, SearchPanel, RightRail, HealthSummaryCard, StatusCards, OverdueCard, GroupHeatmapCard, MapStatusChips, DataTableModal, NearbyCard) |
```

And add a "ดีไซน์ใหม่" note under the "โครงสร้าง" table:

```markdown
> ดีไซน์ใหม่ (2026-07): ธีมม่วง เดสก์ท็อป (แผนที่+แถบขวาวิเคราะห์) / มือถือ responsive
> โทเคนสีที่ `lib/smart-light/theme.js` · ตัวเลขสรุป (pure) ที่ `lib/smart-light/metrics.js`
> panel วิเคราะห์ทั้งหมดคำนวณฝั่ง client จาก /groups + /poles เดิม — ไม่มี API/model เปลี่ยน
```

- [ ] **Step 5: Commit**

```bash
git add docs/modules/smart-light.md
git commit -m "docs(smart-light): อัปเดต checklist + โครงสร้าง ดีไซน์ใหม่ธีมม่วง

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes for the executor

- **Never edit** files under `pages/api/smart-light/`, `models/smart-light/`, or `lib/smart-light/{constants,geo,poleCode,uploadImage}.js`. If a task seems to need an API/model change, stop — the design forbids it and the data is already sufficient.
- All new panels are pure derivations; if a panel shows wrong numbers, fix `metrics.js` (and its test), not the API.
- Keep every existing prop name and `onClick` handler when reskinning — these wire the proven map/form logic.
- Tailwind breakpoint `lg` (1024px) is the desktop/mobile divide throughout.
