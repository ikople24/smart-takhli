# เฟส 3: จัดระเบียบ components ร้องเรียน — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ย้าย components ร้องเรียนจาก root ของ `components/` เข้า `components/complaints/` พร้อม dedup คู่ซ้ำ (`*New`→ชื่อหลัก) และลบ dead code — ไม่เปลี่ยนพฤติกรรม UI

**Architecture:** Refactor ย้ายไฟล์ล้วน ใช้ `git mv` รักษา history; import ที่ต้องแตะใช้ alias `@/`; commit ถูกจัดให้ทุกก้อน build ผ่าน (move + import fix + caller update รวมเป็น commit เดียว)

**Tech Stack:** Next.js 15 Pages Router, alias `@/*` → repo root

**Spec:** `docs/superpowers/specs/2026-06-18-complaints-components-reorg-design.md`

**หมายเหตุการทดสอบ:** โปรเจกต์ไม่มี test runner (CLAUDE.md) — ตรวจด้วย `npm run build` + `npm run lint` + grep แทน unit test

---

### Task 1: ย้าย + เปลี่ยนชื่อไฟล์ด้วย `git mv`

**Files:** ย้าย 12 ไฟล์จาก `components/` → `components/complaints/`

- [ ] **Step 1.1:** สร้างโฟลเดอร์และย้าย 10 ไฟล์ (ชื่อคงเดิม):

```bash
cd /Users/thanawatsodsri/Fullstack/smart-takhli
mkdir -p components/complaints
git mv components/ComplaintFormModal.js     components/complaints/ComplaintFormModal.js
git mv components/ComplaintDetailModal.js   components/complaints/ComplaintDetailModal.js
git mv components/ExportComplaints.js        components/complaints/ExportComplaints.js
git mv components/CardAssignment.js          components/complaints/CardAssignment.js
git mv components/CardModalDetail.js         components/complaints/CardModalDetail.js
git mv components/CardOfficail.js            components/complaints/CardOfficail.js
git mv components/ReporterInfoMap.js         components/complaints/ReporterInfoMap.js
git mv components/ReporterInput.js           components/complaints/ReporterInput.js
git mv components/CommunitySelector.js       components/complaints/CommunitySelector.js
git mv components/UpdateAssignmentModal.js   components/complaints/UpdateAssignmentModal.js
```

- [ ] **Step 1.2:** ย้าย + เปลี่ยนชื่อคู่ dedup (2 ไฟล์):

```bash
git mv components/ComplaintStatsNew.js          components/complaints/ComplaintStats.js
git mv components/OverdueComplaintsAlertNew.js  components/complaints/OverdueComplaintsAlert.js
```

- [ ] **Step 1.3:** ยืนยันผล: `ls components/complaints/` ต้องมี 12 ไฟล์, และ `ls components/ | grep -E "ComplaintFormModal|CardModalDetail|ComplaintStatsNew"` ต้องว่าง

> ยังไม่ commit — build จะพังจนกว่าจะแก้ import (Task 2-3) เสร็จ

---

### Task 2: แก้ import ภายในไฟล์ที่ย้าย (relative → `@/`)

**Files:**
- Modify: `components/complaints/ComplaintFormModal.js`
- Modify: `components/complaints/CardModalDetail.js`
- Modify: `components/complaints/CardOfficail.js`
- Modify: `components/complaints/UpdateAssignmentModal.js`

- [ ] **Step 2.1:** ใน `components/complaints/ComplaintFormModal.js` — แก้บรรทัด import `ImageUploads`:

เปลี่ยน
```js
import ImageUploads from './ImageUploads';
```
เป็น
```js
import ImageUploads from '@/components/ImageUploads';
```

(บรรทัด `./CommunitySelector` และ `./ReporterInput` **คงเดิม** — ย้ายมาด้วยกัน)

- [ ] **Step 2.2:** ใน `components/complaints/CardModalDetail.js` — แก้บรรทัด import `SatisfactionChart`:

เปลี่ยน
```js
import SatisfactionChart from "./SatisfactionChart";
```
เป็น
```js
import SatisfactionChart from "@/components/SatisfactionChart";
```

(บรรทัด `./CardOfficail` และ `./CardAssignment` **คงเดิม**)

- [ ] **Step 2.3:** ใน `components/complaints/CardOfficail.js` — แก้บรรทัด import `SatisfactionForm`:

เปลี่ยน
```js
import SatisfactionForm from "./SatisfactionForm";
```
เป็น
```js
import SatisfactionForm from "@/components/SatisfactionForm";
```

- [ ] **Step 2.4:** ใน `components/complaints/UpdateAssignmentModal.js` — แก้ 2 บรรทัด:

เปลี่ยน
```js
import ImageUploads from "./ImageUploads";
```
เป็น
```js
import ImageUploads from "@/components/ImageUploads";
```

และเปลี่ยน
```js
import { useAdminOptionsStore } from "../stores/useAdminOptionsStore";
```
เป็น
```js
import { useAdminOptionsStore } from "@/stores/useAdminOptionsStore";
```

- [ ] **Step 2.5:** ยืนยัน: `grep -rn "from ['\"]\./ImageUploads\|from ['\"]\./SatisfactionChart\|from ['\"]\./SatisfactionForm\|stores/useAdminOptionsStore" components/complaints/` → ต้องเหลือเฉพาะบรรทัด `@/...` (ไม่มี `./ImageUploads`, `./SatisfactionChart`, `./SatisfactionForm`, `../stores`)

---

### Task 3: อัปเดตผู้เรียกภายนอก (9 ไฟล์)

**Files:**
- Modify: `pages/index.tsx`
- Modify: `pages/admin/manage-complaints.jsx`
- Modify: `pages/admin/dashboard.jsx`
- Modify: `pages/status/index.jsx`
- Modify: `pages/complaint/[id_card].jsx`
- Modify: `pages/complaint/index.jsx`
- Modify: `pages/api/complaints/[id_card].js`
- Modify: `components/SatisfactionCommentsPanel.js`
- Modify: `components/AdminDashboardMap.js`

- [ ] **Step 3.1:** `pages/index.tsx` — เปลี่ยน
```tsx
import ComplaintFormModal from "@/components/ComplaintFormModal";
```
เป็น
```tsx
import ComplaintFormModal from "@/components/complaints/ComplaintFormModal";
```

- [ ] **Step 3.2:** `pages/admin/manage-complaints.jsx` — เปลี่ยน import 5 บรรทัด (รวม rename `*New`→ชื่อหลัก):

```jsx
import UpdateAssignmentModal from "@/components/UpdateAssignmentModal";
import ComplaintStatsNew from "@/components/ComplaintStatsNew";
import OverdueComplaintsAlertNew from "@/components/OverdueComplaintsAlertNew";
import ComplaintDetailModal from "@/components/ComplaintDetailModal";
import ExportComplaints from "@/components/ExportComplaints";
```
เป็น
```jsx
import UpdateAssignmentModal from "@/components/complaints/UpdateAssignmentModal";
import ComplaintStats from "@/components/complaints/ComplaintStats";
import OverdueComplaintsAlert from "@/components/complaints/OverdueComplaintsAlert";
import ComplaintDetailModal from "@/components/complaints/ComplaintDetailModal";
import ExportComplaints from "@/components/complaints/ExportComplaints";
```

- [ ] **Step 3.3:** `pages/admin/manage-complaints.jsx` — แก้ JSX ที่ใช้ชื่อเก่า (บรรทัด ~562, ~571):

เปลี่ยน `<ComplaintStatsNew` → `<ComplaintStats` และ `<OverdueComplaintsAlertNew` → `<OverdueComplaintsAlert`
(ใช้ replace-all บนไฟล์นี้: `ComplaintStatsNew` → `ComplaintStats`, `OverdueComplaintsAlertNew` → `OverdueComplaintsAlert` — ครอบทั้ง import และ JSX)

- [ ] **Step 3.4:** `pages/admin/dashboard.jsx` — เปลี่ยน
```jsx
import ComplaintDetailModal from "@/components/ComplaintDetailModal";
import ExportComplaints from "@/components/ExportComplaints";
```
เป็น
```jsx
import ComplaintDetailModal from "@/components/complaints/ComplaintDetailModal";
import ExportComplaints from "@/components/complaints/ExportComplaints";
```

- [ ] **Step 3.5:** `pages/status/index.jsx` — เปลี่ยน
```jsx
import CardModalDetail from "@/components/CardModalDetail";
```
เป็น
```jsx
import CardModalDetail from "@/components/complaints/CardModalDetail";
```

- [ ] **Step 3.6:** `pages/complaint/[id_card].jsx` — เปลี่ยน (เหมือน Step 3.5: `@/components/CardModalDetail` → `@/components/complaints/CardModalDetail`)

- [ ] **Step 3.7:** `pages/complaint/index.jsx` — เปลี่ยน (เหมือน Step 3.5)

- [ ] **Step 3.8:** `pages/api/complaints/[id_card].js` — เปลี่ยน (เหมือน Step 3.5) — แตะเฉพาะบรรทัด import เท่านั้น ไม่แก้ตรรกะอื่น

- [ ] **Step 3.9:** `components/SatisfactionCommentsPanel.js` — เปลี่ยน
```js
import CardModalDetail from '@/components/CardModalDetail';
```
เป็น
```js
import CardModalDetail from '@/components/complaints/CardModalDetail';
```

- [ ] **Step 3.10:** `components/AdminDashboardMap.js` — เปลี่ยน (import เป็น relative)
```js
import CardModalDetail from './CardModalDetail';
```
เป็น
```js
import CardModalDetail from '@/components/complaints/CardModalDetail';
```

---

### Task 4: Verify build + commit #1

- [ ] **Step 4.1:** ตรวจว่าไม่เหลือ path เก่าชี้ไป root:

```bash
grep -rn "@/components/ComplaintFormModal\|@/components/ComplaintDetailModal\|@/components/ExportComplaints\|@/components/CardModalDetail\|@/components/UpdateAssignmentModal\|@/components/ComplaintStatsNew\|@/components/OverdueComplaintsAlertNew\|'./CardModalDetail'\|\"./CardModalDetail\"" pages components
```
Expected: ว่าง (ไม่มี output)

- [ ] **Step 4.2:** `npm run build`
Expected: `✓ Compiled successfully` (ไม่มี "Module not found")

- [ ] **Step 4.3:** Commit #1:

```bash
git add -A
git commit -m "refactor: ย้าย components ร้องเรียน → components/complaints/ + dedup *New→ชื่อหลัก

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: ลบ dead code + commit #2

**Files:** ลบ 4 ไฟล์ใน `components/`

- [ ] **Step 5.1:** ยืนยันอีกครั้งว่าไม่มีใคร import (กันพลาด):

```bash
grep -rn "ComplaintStats'\|ComplaintStats\"\|OverdueComplaintsAlert'\|OverdueComplaintsAlert\"\|CardCompleted\|ReporterInfoCard" pages components | grep -vE "components/complaints/(ComplaintStats|OverdueComplaintsAlert)\.js"
```
Expected: ไม่มีบรรทัดที่ชี้ไป `@/components/ComplaintStats`, `@/components/OverdueComplaintsAlert` (root), `CardCompleted`, หรือ `ReporterInfoCard`
(บรรทัดที่อ้าง `@/components/complaints/ComplaintStats` หรือ `OverdueComplaintsAlert` ใหม่ ถือว่าโอเค)

- [ ] **Step 5.2:** ลบไฟล์:

```bash
git rm components/ComplaintStats.js components/OverdueComplaintsAlert.js components/CardCompleted.js components/ReporterInfoCard.js
```

- [ ] **Step 5.3:** `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 5.4:** Commit #2:

```bash
git commit -m "chore: ลบ dead components ร้องเรียน (CardCompleted, ReporterInfoCard, *เก่า)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: อัปเดตเอกสาร + verification รวม + commit #3

**Files:**
- Modify: `docs/modules/complaints.md`

- [ ] **Step 6.1:** ใน `docs/modules/complaints.md` แทนที่ section "Components" เดิม (ที่ขึ้นต้น `## Components (⚠️ ยังกองที่ root ...)`) ด้วย:

```markdown
## Components (`components/complaints/`)

`ComplaintFormModal`, `ComplaintDetailModal`, `ComplaintStats`, `OverdueComplaintsAlert`,
`ExportComplaints`, `CardAssignment`, `CardModalDetail`, `CardOfficail`,
`ReporterInfoMap`, `ReporterInput`, `CommunitySelector`, `UpdateAssignmentModal`

> ย้ายเข้าโฟลเดอร์โมดูลแล้ว (เฟส 3, 2026-06-18). คู่ซ้ำ `*New` รวมเป็นชื่อหลักแล้ว;
> dead code (`CardCompleted`, `ReporterInfoCard`, `*เก่า`) ถูกลบ
> `TaskCard.tsx` ยังอยู่ root (cross-cutting: complaint|feedback)
```

- [ ] **Step 6.2:** แก้บรรทัด API ใน `docs/modules/complaints.md` — `pages/api/assignments/*` ยังคงหมายเหตุ "ควรย้ายใต้ complaints" ไว้ (เลื่อนออกไป — ไม่ทำเฟสนี้) ไม่ต้องแก้

- [ ] **Step 6.3:** Verification รวม:

```bash
npm run lint
npm run build
ls components/complaints/    # ต้องมี 12 ไฟล์
grep -rn "ComplaintStatsNew\|OverdueComplaintsAlertNew\|CardCompleted\|ReporterInfoCard" pages components   # ต้องว่าง
```
Expected: lint ไม่มี error ใหม่, build ✓, ls มี 12 ไฟล์, grep ว่าง

- [ ] **Step 6.4:** Commit #3:

```bash
git add docs/modules/complaints.md
git commit -m "docs: อัปเดต complaints.md — components ย้ายเข้าโฟลเดอร์โมดูลแล้ว

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review notes (ทำแล้ว)

- ครอบ spec ครบ: ย้าย 12 ไฟล์(T1), แก้ internal import(T2), caller 9 จุด(T3), build+commit(T4), ลบ dead 4(T5), docs+verify(T6)
- ทุก commit build ผ่าน: move+import+caller รวม commit เดียว (T4) — ไม่มี state ที่ build พัง
- ชื่อสอดคล้อง: `ComplaintStatsNew`→`ComplaintStats`, `OverdueComplaintsAlertNew`→`OverdueComplaintsAlert` แก้ทั้ง import + JSX (T3.2/T3.3)
- AdminDashboardMap ใช้ relative `./CardModalDetail` — แยก step (T3.10) ไม่ปนกับ caller ที่ใช้ `@/`
- ไม่มี placeholder; ทุก step มี old→new string จริง
