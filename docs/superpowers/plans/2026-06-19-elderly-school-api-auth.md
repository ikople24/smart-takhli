# เพิ่ม auth ให้ API elderly-school Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปิดช่องโหว่ — กั้น API admin ของ elderly-school (8 endpoint) ด้วย auth มาตรฐาน โดยคง public self-checkin ไว้

**Architecture:** helper `requireElderlySchoolAdmin` (pattern เดียวกับ pm25/activities `_auth.js`, ใช้ `hasPermission` กลาง, REQUIRED_PAGE=`/admin/elderly-school`) แล้วใส่ guard บรรทัดแรกในแต่ละ handler. `checkin.js` ไม่แตะ

**Tech Stack:** Next.js Pages Router API routes, Clerk `getAuth`/`clerkClient`, Mongoose, `lib/permissions#hasPermission`

**Spec:** `docs/superpowers/specs/2026-06-19-elderly-school-api-auth-design.md`

**หมายเหตุการทดสอบ:** ไม่มี test runner — ตรวจด้วย `npm run build` + `npm run lint` + curl

---

### Task 1: สร้าง helper + กั้น 8 endpoint

**Files:**
- Create: `pages/api/elderly-school/_auth.js`
- Modify: `pages/api/elderly-school/{cards,dashboard,import,people,schedule,visits,assessments,sheet-dashboard}.js`

- [ ] **Step 1.1:** สร้าง `pages/api/elderly-school/_auth.js`:

```js
import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import { hasPermission } from "@/lib/permissions";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
const REQUIRED_PAGE = "/admin/elderly-school";

// ⚠️ inline User schema (จำเป็นตาม pattern ปัจจุบัน — เฟส 6 จะรวมเป็นที่เดียว)
// ถ้าเพิ่มฟิลด์ใน models/CreateUser.js ต้องตามมาแก้ที่นี่ด้วย
export async function requireElderlySchoolAdmin(req) {
  const { userId } = getAuth(req);
  if (!userId) return { ok: false, status: 401, message: "Unauthorized" };

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const role = clerkUser.publicMetadata?.role || "admin";
  if (role === "superadmin") {
    return { ok: true, userId, role, isSuperAdmin: true };
  }

  await dbConnect();
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
  const mongoUser = await User.findOne({ clerkId: userId }).lean();

  if (!mongoUser) return { ok: false, status: 403, message: "User not registered" };
  if (!mongoUser.appId || mongoUser.appId !== CURRENT_APP_ID) {
    return { ok: false, status: 403, message: "No app access" };
  }
  if (!hasPermission(mongoUser.role || role, mongoUser.allowedPages, REQUIRED_PAGE)) {
    return { ok: false, status: 403, message: "No page access" };
  }

  return { ok: true, userId, role: mongoUser.role || role, isSuperAdmin: false };
}
```

- [ ] **Step 1.2:** สำหรับ **แต่ละไฟล์ทั้ง 8** (`cards.js`, `dashboard.js`, `import.js`, `people.js`, `schedule.js`, `visits.js`, `assessments.js`, `sheet-dashboard.js`) ทำ 2 จุด:

  **(ก)** เพิ่ม import นี้ต่อท้ายบรรทัด `import ... from ...` ที่มีอยู่ (บนหัวไฟล์):

  ```js
  import { requireElderlySchoolAdmin } from "./_auth";
  ```

  **(ข)** หา `export default async function handler(req, res) {` แล้วแทรก guard นี้เป็น **2 บรรทัดแรกภายใน handler** (ก่อน `if (req.method...)` / `await dbConnect()` / โค้ดอื่นใด):

  ```js
    const auth = await requireElderlySchoolAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ success: false, message: auth.message });
  ```

  > ⚠️ บางไฟล์ (`dashboard.js`, `import.js`, `schedule.js`, `assessments.js`) มี helper function อยู่ก่อน `export default async function handler` — ต้องแทรกใน **ตัว handler** เท่านั้น ห้ามแทรกในฟังก์ชันอื่นหรือบนสุดของไฟล์
  > ⚠️ **ห้ามแตะ** `pages/api/elderly-school/checkin.js` (public)

- [ ] **Step 1.3:** ตรวจครบ 8 ไฟล์:

```bash
grep -L "requireElderlySchoolAdmin" pages/api/elderly-school/cards.js pages/api/elderly-school/dashboard.js pages/api/elderly-school/import.js pages/api/elderly-school/people.js pages/api/elderly-school/schedule.js pages/api/elderly-school/visits.js pages/api/elderly-school/assessments.js pages/api/elderly-school/sheet-dashboard.js
```
Expected: ไม่มี output (ทุกไฟล์มี import+guard แล้ว). และยืนยัน `checkin.js` ไม่มี:
```bash
grep -c "requireElderlySchoolAdmin" pages/api/elderly-school/checkin.js
```
Expected: `0`

---

### Task 2: Build + lint + curl verify + commit

- [ ] **Step 2.1:** `npm run build` → `✓ Compiled successfully`, ไม่มี Module not found. แก้แล้ว re-run ถ้าพัง
- [ ] **Step 2.2:** `npm run lint` → ไม่มี error ใหม่
- [ ] **Step 2.3:** dev server (`npm run dev`, port 3000 หรือที่ขึ้น) แล้ว curl ไม่แนบ token:

```bash
for ep in cards dashboard import people schedule visits assessments sheet-dashboard; do
  printf "%s -> " "$ep"
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/elderly-school/$ep"
done
```
Expected: ทุก endpoint คืน `401` (เดิมคืน 200/400). ปิด dev server เมื่อเสร็จ
> หมายเหตุ: ถ้า env/DB ในเครื่องไม่พร้อม curl อาจไม่ครบ — ถ้า build ผ่านและโค้ด guard อยู่ครบตาม Step 1.3 ให้ commit ได้ พร้อมระบุว่า curl verify ไม่สมบูรณ์เพราะ env

- [ ] **Step 2.4:** Commit:

```bash
git add pages/api/elderly-school/_auth.js pages/api/elderly-school/cards.js pages/api/elderly-school/dashboard.js pages/api/elderly-school/import.js pages/api/elderly-school/people.js pages/api/elderly-school/schedule.js pages/api/elderly-school/visits.js pages/api/elderly-school/assessments.js pages/api/elderly-school/sheet-dashboard.js
git commit -m "fix: เพิ่ม auth ให้ API elderly-school ฝั่ง admin (8 endpoint, เดิมเปิดโล่ง)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: เอกสาร + roadmap

**Files:**
- Modify: `docs/modules/elderly-school.md`
- Modify: `docs/modules/README.md`

- [ ] **Step 3.1:** ใน `docs/modules/elderly-school.md` เพิ่มหมายเหตุในส่วน API ว่า: admin endpoints (`cards/dashboard/import/people/schedule/visits/assessments/sheet-dashboard`) กั้นด้วย `requireElderlySchoolAdmin` (`pages/api/elderly-school/_auth.js`, page `/admin/elderly-school`); `checkin` ยัง public. ถ้าไม่มีหัวข้อ API ให้เพิ่มย่อหน้าใหม่ท้ายไฟล์:

```markdown
## Auth ของ API (2026-06-19)

- Admin endpoints (`cards`, `dashboard`, `import`, `people`, `schedule`, `visits`,
  `assessments`, `sheet-dashboard`) กั้นด้วย `requireElderlySchoolAdmin`
  (`pages/api/elderly-school/_auth.js`) — ต้องมีสิทธิ์หน้า `/admin/elderly-school`
  (superadmin ลัดผ่าน)
- `checkin` ยังเป็น **public** (หน้า `/elderly/checkin` — QR พิมพ์แจกแล้ว)
```

- [ ] **Step 3.2:** ใน `docs/modules/README.md` แก้บรรทัดเฟส 7 — ตัดส่วน "เพิ่ม auth ให้ API elderly-school" ออกจากรายการที่ค้าง และเพิ่มหมายเหตุว่าทำแล้ว. หา:

```markdown
  ลบ shim `/api/smart-health/elderly/checkin`, เพิ่ม auth ให้ API elderly-school
  ฝั่ง admin (ตอนนี้ไม่มี auth — ย้ายมาแบบ verbatim)
```
แก้เป็น:
```markdown
  ลบ shim `/api/smart-health/elderly/checkin`
  (✅ เพิ่ม auth ให้ API elderly-school ฝั่ง admin แล้ว 2026-06-19)
```

- [ ] **Step 3.3:** Commit:

```bash
git add docs/modules/elderly-school.md docs/modules/README.md
git commit -m "docs: เพิ่ม auth API elderly-school เสร็จ — อัปเดต elderly-school.md + roadmap

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review notes (ทำแล้ว)

- ครอบ spec ครบ: helper(T1.1), กั้น 8 endpoint ทุก method(T1.2), checkin คงเดิม(ห้ามแตะ ระบุใน T1.2), verify 401(T2.3), docs+roadmap(T3)
- `hasPermission(role, allowedPages, pagePath)` ตรง signature จริง (`lib/permissions.ts:218`)
- ทุก commit build ผ่าน: helper + gating รวม commit เดียว (T2.4)
- ไม่มี placeholder; guard/import เป็นข้อความเดียวกันทั้ง 8 ไฟล์ (ระบุครบ)
- YAGNI: ไม่ทำ rate-limit checkin, ไม่รวม inline schema (เฟส 6)
