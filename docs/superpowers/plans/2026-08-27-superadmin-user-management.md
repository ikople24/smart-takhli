# Superadmin User Management Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** รื้อหน้า `/admin/superadmin` เป็นลิสต์เดียวที่ merge Clerk+Mongo พร้อมสถานะต่อคน, ซ่อม doc พังจากหน้าเว็บ, จัดกลุ่มสิทธิ์ตามหมวด + bulk grant แทน grant script

**Spec:** `docs/superpowers/specs/2026-08-27-superadmin-user-management-design.md` — อ่านก่อนเริ่ม

**Architecture:** logic ล้วน (merge/status/bulk-plan) อยู่ `lib/superadmin/` มีเทส vitest · API ใหม่ 3 ตัวใน `pages/api/permissions/` เป็นเปลือกบาง ๆ + helper `_auth.js` ใช้ร่วม · UI แตกเป็น components ใน `components/superadmin/` ตาม module convention · endpoint เดิม 2 ตัวที่ไม่มี auth ถูก harden ในงานนี้ด้วย

**Tech Stack:** Next.js 15 Pages Router · Mongoose (inline `strict:false` model ตาม pattern เดิม + อ่านด้วย `.lean()` เสมอ) · Clerk server SDK · Tailwind v4 + DaisyUI · vitest

**Branch:** ทำบน `superadmin-user-management` (แตกจาก main แล้ว มี spec commit อยู่) — **เช็ค `git branch --show-current` ก่อน commit ทุกครั้ง** (เจ้าของ repo สลับสาขาใน working copy เดียวกันเป็นบางครั้ง)

**ข้อควรรู้ก่อนเริ่ม:**
- `.env.local` เครื่อง dev ตั้ง `NEXT_PUBLIC_APP_ID=app_b` — สถานะ `active`/`other_app` ตอน dev จะกลับด้านกับ production (`smart-takhli`) เป็นเรื่องปกติ
- collection `users` แชร์กับแอปพี่น้อง — **ห้าม**แก้ schema, ห้าม migration, เขียนเฉพาะฟิลด์ที่ spec ระบุ
- ห้ามรัน `npm run build` ขณะ `npm run dev` ยังเปิดอยู่ (API จะตอบ 500 เงียบ ๆ — ปิด dev + `rm -rf .next` ก่อน build)

---

### Task 1: เพิ่ม audit action types ใหม่

**Files:**
- Modify: `models/AuditLog.js` (enum `action`)
- Modify: `lib/auditLogger.ts` (type `AuditAction`)

- [ ] **Step 1: เพิ่ม 3 action ใน enum ของ `models/AuditLog.js`**

ในบล็อก `enum: [...]` ของฟิลด์ `action` แก้ส่วน Permissions เป็น:

```js
      // Permissions
      'permissions_updated',
      'permissions_bulk_updated',
      'app_id_assigned',
      // User repair (หน้า superadmin)
      'user_repaired',
      'user_doc_deleted',
```

- [ ] **Step 2: เพิ่ม 3 action เดียวกันใน `lib/auditLogger.ts`**

ใน type `AuditAction` แก้บรรทัด `| 'permissions_updated'` เป็น:

```ts
  | 'permissions_updated'
  | 'permissions_bulk_updated'
  | 'user_repaired'
  | 'user_doc_deleted'
```

- [ ] **Step 3: ตรวจว่า TS ผ่าน**

Run: `npx tsc --noEmit 2>&1 | grep -i auditLogger || echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add models/AuditLog.js lib/auditLogger.ts
git commit -m "feat(audit): เพิ่ม action types สำหรับซ่อม user doc และ bulk grant"
```

---

### Task 2: `lib/superadmin/usersOverview.ts` — merge + status logic (TDD)

**Files:**
- Create: `lib/superadmin/usersOverview.ts`
- Test: `lib/superadmin/__tests__/usersOverview.test.js`

- [ ] **Step 1: เขียนเทสก่อน (ต้อง fail)**

สร้าง `lib/superadmin/__tests__/usersOverview.test.js`:

```js
import { describe, it, expect } from "vitest";
import {
  STATUS,
  isStubDoc,
  computeStatus,
  buildUsersOverview,
  toClerkLite,
} from "@/lib/superadmin/usersOverview";

const APP = "smart-takhli";

// fixture จากเคสจริง 2026-08-27: stub doc ที่แอปพี่น้องสร้างค้างไว้
const STUB_DOC = {
  _id: "6a73fd8e2b588a2d8ed3191a",
  role: "admin",
  allowedPages: [],
  clerkId: "user_34BXrf8OmiiODu8Edj35hMNKNCJ",
  __v: 0,
};

const FULL_DOC = {
  _id: "aaa000000000000000000001",
  clerkId: "user_full",
  name: "สมชาย ใจดี",
  position: "นักวิชาการ",
  department: "กองช่าง",
  role: "admin",
  appId: APP,
  allowedPages: ["/admin/dashboard"],
  createdAt: new Date("2026-01-01"),
};

const clerk = (id, name = "Clerk Name", email = "x@y.com") => ({
  clerkId: id,
  name,
  email,
  imageUrl: "",
  clerkRole: "admin",
  allowedApps: [APP],
  lastSignInAt: 1750000000000,
});

describe("isStubDoc", () => {
  it("stub จริง (ไม่มี name/appId/createdAt) → true", () => {
    expect(isStubDoc(STUB_DOC)).toBe(true);
  });
  it("doc ที่มี name → false", () => {
    expect(isStubDoc(FULL_DOC)).toBe(false);
  });
  it("doc ที่มีแค่ appId → false (ไม่ใช่ stub ห้ามลบ)", () => {
    expect(isStubDoc({ clerkId: "x", appId: "app_b" })).toBe(false);
  });
  it("string ว่างนับเป็น 'ไม่มี'", () => {
    expect(isStubDoc({ clerkId: "x", name: "", appId: "" })).toBe(true);
  });
});

describe("computeStatus", () => {
  it("ไม่มี doc → no_doc", () => {
    expect(computeStatus(null, true, APP)).toBe(STATUS.NO_DOC);
  });
  it("doc ไม่มี name → broken", () => {
    expect(computeStatus(STUB_DOC, true, APP)).toBe(STATUS.BROKEN);
  });
  it("doc มี name แต่ appId ว่าง → no_app", () => {
    expect(computeStatus({ ...FULL_DOC, appId: "" }, true, APP)).toBe(STATUS.NO_APP);
  });
  it("appId ตรงแอปปัจจุบัน → active", () => {
    expect(computeStatus(FULL_DOC, true, APP)).toBe(STATUS.ACTIVE);
  });
  it("appId เป็นของแอปอื่น → other_app", () => {
    expect(computeStatus({ ...FULL_DOC, appId: "app_b" }, true, APP)).toBe(STATUS.OTHER_APP);
  });
  it("clerkId หาใน Clerk ไม่เจอ → orphan (ชนะ broken)", () => {
    expect(computeStatus(STUB_DOC, false, APP)).toBe(STATUS.ORPHAN);
  });
  it("Clerk ล่ม (clerkAvailable=false) → ห้ามตัดสิน orphan", () => {
    expect(computeStatus(STUB_DOC, false, APP, false)).toBe(STATUS.BROKEN);
  });
  it("doc เก่าไม่มี clerkId เลย → ไม่ใช่ orphan ไล่ตามฟิลด์ปกติ", () => {
    expect(computeStatus({ _id: "x", name: "เก่า", appId: APP }, false, APP)).toBe(STATUS.ACTIVE);
  });
});

describe("buildUsersOverview", () => {
  it("merge doc กับข้อมูล Clerk ด้วย clerkId", () => {
    const rows = buildUsersOverview([clerk("user_full")], [FULL_DOC], APP);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      clerkId: "user_full",
      mongoId: "aaa000000000000000000001",
      name: "สมชาย ใจดี", // ชื่อ Mongo มาก่อน
      email: "x@y.com", // email มาจาก Clerk
      status: STATUS.ACTIVE,
    });
  });
  it("stub doc ใช้ชื่อจาก Clerk เป็น fallback + isStub=true", () => {
    const rows = buildUsersOverview(
      [clerk(STUB_DOC.clerkId, "กองสาธารณสุขฯ")],
      [STUB_DOC],
      APP
    );
    expect(rows[0].name).toBe("กองสาธารณสุขฯ");
    expect(rows[0].status).toBe(STATUS.BROKEN);
    expect(rows[0].isStub).toBe(true);
  });
  it("บัญชี Clerk ที่ไม่มี doc → แถว no_doc", () => {
    const rows = buildUsersOverview([clerk("user_new")], [], APP);
    expect(rows[0].status).toBe(STATUS.NO_DOC);
    expect(rows[0].mongoId).toBe("");
  });
  it("doc ที่ Clerk ไม่รู้จัก → orphan", () => {
    const rows = buildUsersOverview([], [FULL_DOC], APP);
    expect(rows[0].status).toBe(STATUS.ORPHAN);
  });
  it("Clerk ล่ม → ไม่มีแถว no_doc/orphan และตั้ง flag ในผลไม่เกี่ยว (endpoint จัดการ)", () => {
    const rows = buildUsersOverview([], [FULL_DOC], APP, { clerkAvailable: false });
    expect(rows[0].status).toBe(STATUS.ACTIVE);
  });
  it("เรียง: ต้องดำเนินการ (broken/orphan/no_doc/no_app) → active → other_app", () => {
    const rows = buildUsersOverview(
      [clerk("user_full"), clerk(STUB_DOC.clerkId), clerk("user_new")],
      [FULL_DOC, STUB_DOC, { ...FULL_DOC, _id: "bbb000000000000000000002", clerkId: "user_b", name: "แอปอื่น", appId: "app_b" }],
      APP
    );
    const statuses = rows.map((r) => r.status);
    expect(statuses).toEqual([STATUS.BROKEN, STATUS.NO_DOC, STATUS.ACTIVE, STATUS.OTHER_APP]);
  });
});

describe("toClerkLite", () => {
  it("แปลง Clerk SDK user เป็นรูปแบบภายใน", () => {
    const lite = toClerkLite({
      id: "user_x",
      firstName: "สมหญิง",
      lastName: "ดีงาม",
      imageUrl: "http://img",
      emailAddresses: [{ emailAddress: "a@b.c" }],
      publicMetadata: { role: "admin", allowedApps: ["*"] },
      lastSignInAt: 123,
    });
    expect(lite).toEqual({
      clerkId: "user_x",
      name: "สมหญิง ดีงาม",
      email: "a@b.c",
      imageUrl: "http://img",
      clerkRole: "admin",
      allowedApps: ["*"],
      lastSignInAt: 123,
    });
  });
  it("ฟิลด์หาย → ค่า default ปลอดภัย", () => {
    const lite = toClerkLite({ id: "user_y" });
    expect(lite.name).toBe("");
    expect(lite.email).toBe("");
    expect(lite.allowedApps).toEqual([]);
    expect(lite.lastSignInAt).toBeNull();
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่า fail**

Run: `npx vitest run lib/superadmin`
Expected: FAIL — `Cannot find module '@/lib/superadmin/usersOverview'` (หรือ resolve error)

- [ ] **Step 3: เขียน implementation**

สร้าง `lib/superadmin/usersOverview.ts`:

```ts
// lib/superadmin/usersOverview.ts
// Logic ล้วนของหน้า /admin/superadmin: merge ข้อมูล Clerk + Mongo แล้วคำนวณสถานะต่อคน
// — ไม่แตะ DB/Clerk เอง (endpoint เป็นคนป้อนข้อมูล) เพื่อให้เทสได้ตรง ๆ
//
// สถานะ 6 แบบ (ดู spec 2026-08-27-superadmin-user-management-design.md):
//   no_doc    มีบัญชี Clerk แต่ไม่มี Mongo doc → ยังลงทะเบียนไม่ได้
//   orphan    มี doc แต่บัญชี Clerk ถูกลบไปแล้ว
//   broken    doc ไม่มี name (stub — เช่นถูกสร้างข้ามแอปมาไม่สมบูรณ์)
//   no_app    doc ครบแต่ยังไม่กำหนด appId
//   active    appId = แอปปัจจุบัน
//   other_app appId เป็นของแอปพี่น้อง (อ่านอย่างเดียว)

export const STATUS = {
  NO_DOC: 'no_doc',
  ORPHAN: 'orphan',
  BROKEN: 'broken',
  NO_APP: 'no_app',
  ACTIVE: 'active',
  OTHER_APP: 'other_app',
} as const;

export type UserStatus = (typeof STATUS)[keyof typeof STATUS];

export interface ClerkLite {
  clerkId: string;
  name: string;
  email: string;
  imageUrl: string;
  clerkRole: string;
  allowedApps: string[];
  lastSignInAt: number | null;
}

export interface OverviewUser {
  clerkId: string;
  mongoId: string;
  name: string;
  email: string;
  imageUrl: string;
  position: string;
  department: string;
  role: string;
  clerkRole: string;
  allowedApps: string[];
  appId: string;
  allowedPages: string[];
  lastSignInAt: number | null;
  status: UserStatus;
  isStub: boolean;
}

// undefined / null / string ว่าง = "ไม่มี"
const has = (v: unknown): boolean => v !== undefined && v !== null && v !== '';

// stub = doc ที่ถูกสร้างข้ามแอปมาไม่สมบูรณ์ — guard เดียวกันนี้ใช้ตัดสินว่า "ลบได้"
// ใน repair-user (action delete_stub) ห้ามผ่อนเงื่อนไข
export function isStubDoc(doc: Record<string, unknown> | null | undefined): boolean {
  if (!doc) return false;
  return !has(doc.name) && !has(doc.appId) && !has(doc.createdAt);
}

export function computeStatus(
  doc: Record<string, unknown> | null | undefined,
  clerkFound: boolean,
  currentAppId: string,
  clerkAvailable = true
): UserStatus {
  if (!doc) return STATUS.NO_DOC;
  // orphan ตัดสินได้เฉพาะตอนข้อมูล Clerk เชื่อถือได้ และ doc มี clerkId ให้เช็ค
  if (clerkAvailable && has(doc.clerkId) && !clerkFound) return STATUS.ORPHAN;
  if (!has(doc.name)) return STATUS.BROKEN;
  if (!has(doc.appId)) return STATUS.NO_APP;
  if (doc.appId === currentAppId) return STATUS.ACTIVE;
  return STATUS.OTHER_APP;
}

// น้ำหนักการเรียง: ต้องดำเนินการก่อน → ใช้งานได้ → แอปอื่น
const SORT_WEIGHT: Record<UserStatus, number> = {
  [STATUS.BROKEN]: 0,
  [STATUS.ORPHAN]: 0,
  [STATUS.NO_DOC]: 1,
  [STATUS.NO_APP]: 1,
  [STATUS.ACTIVE]: 2,
  [STATUS.OTHER_APP]: 3,
};

export function buildUsersOverview(
  clerkUsers: ClerkLite[],
  mongoDocs: Array<Record<string, any>>,
  currentAppId: string,
  { clerkAvailable = true }: { clerkAvailable?: boolean } = {}
): OverviewUser[] {
  const byClerkId = new Map(clerkUsers.map((c) => [c.clerkId, c]));
  const seen = new Set<string>();

  const rows: OverviewUser[] = mongoDocs.map((doc) => {
    const c = has(doc.clerkId) ? byClerkId.get(doc.clerkId as string) : undefined;
    if (c) seen.add(c.clerkId);
    return {
      clerkId: (doc.clerkId as string) || '',
      mongoId: String(doc._id),
      name: (doc.name as string) || c?.name || c?.email || '',
      email: c?.email || '',
      imageUrl: (doc.profileUrl as string) || c?.imageUrl || '',
      position: (doc.position as string) || '',
      department: (doc.department as string) || '',
      role: (doc.role as string) || '',
      clerkRole: c?.clerkRole || '',
      allowedApps: c?.allowedApps || [],
      appId: (doc.appId as string) || '',
      allowedPages: Array.isArray(doc.allowedPages) ? (doc.allowedPages as string[]) : [],
      lastSignInAt: c?.lastSignInAt ?? null,
      status: computeStatus(doc, !!c, currentAppId, clerkAvailable),
      isStub: isStubDoc(doc),
    };
  });

  // บัญชี Clerk ที่ยังไม่มี doc — โผล่เป็นแถว no_doc (แทนกล่อง "พนักงานใหม่" เดิม)
  for (const c of clerkUsers) {
    if (seen.has(c.clerkId)) continue;
    rows.push({
      clerkId: c.clerkId,
      mongoId: '',
      name: c.name || c.email,
      email: c.email,
      imageUrl: c.imageUrl,
      position: '',
      department: '',
      role: '',
      clerkRole: c.clerkRole,
      allowedApps: c.allowedApps,
      appId: '',
      allowedPages: [],
      lastSignInAt: c.lastSignInAt,
      status: STATUS.NO_DOC,
      isStub: false,
    });
  }

  return rows.sort(
    (a, b) =>
      SORT_WEIGHT[a.status] - SORT_WEIGHT[b.status] ||
      a.name.localeCompare(b.name, 'th')
  );
}

// แปลง Clerk SDK user object → รูปแบบภายใน (เรียกจาก endpoint)
export function toClerkLite(u: any): ClerkLite {
  return {
    clerkId: u.id,
    name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
    email: u.emailAddresses?.[0]?.emailAddress || '',
    imageUrl: u.imageUrl || '',
    clerkRole: u.publicMetadata?.role || '',
    allowedApps: u.publicMetadata?.allowedApps || [],
    lastSignInAt: u.lastSignInAt ?? null,
  };
}
```

- [ ] **Step 4: รันเทสให้ผ่านหมด**

Run: `npx vitest run lib/superadmin`
Expected: PASS ทุกข้อ (21 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/superadmin/usersOverview.ts lib/superadmin/__tests__/usersOverview.test.js
git commit -m "feat(superadmin): logic merge Clerk+Mongo + คำนวณสถานะ user 6 แบบ (มีเทส)"
```

---

### Task 3: `lib/superadmin/bulkGrant.ts` — คัดกรอง bulk grant (TDD)

**Files:**
- Create: `lib/superadmin/bulkGrant.ts`
- Test: `lib/superadmin/__tests__/bulkGrant.test.js`

- [ ] **Step 1: เขียนเทสก่อน**

สร้าง `lib/superadmin/__tests__/bulkGrant.test.js`:

```js
import { describe, it, expect } from "vitest";
import { planBulkGrant } from "@/lib/superadmin/bulkGrant";

const APP = "smart-takhli";
const doc = (id, appId, pages) => ({ _id: id, appId, allowedPages: pages });

describe("planBulkGrant", () => {
  it("user แอปนี้ + allowedPages ไม่ว่าง → apply", () => {
    const { applyIds, skippedDefault, crossApp, notFound } = planBulkGrant(
      [doc("a", APP, ["/admin/dashboard"])],
      ["a"],
      APP
    );
    expect(applyIds).toEqual(["a"]);
    expect(skippedDefault).toEqual([]);
    expect(crossApp).toEqual([]);
    expect(notFound).toEqual([]);
  });

  it("allowedPages ว่าง → ข้าม (ใช้ default อยู่ — เติม 1 หน้าจะทำ default ทั้งชุดหาย)", () => {
    const plan = planBulkGrant([doc("a", APP, [])], ["a"], APP);
    expect(plan.applyIds).toEqual([]);
    expect(plan.skippedDefault).toEqual(["a"]);
  });

  it("allowedPages ไม่ใช่ array (doc เก่า) → นับเป็นข้าม ไม่พัง", () => {
    const plan = planBulkGrant([{ _id: "a", appId: APP }], ["a"], APP);
    expect(plan.skippedDefault).toEqual(["a"]);
  });

  it("user ต่างแอป → crossApp (endpoint จะตอบ 400)", () => {
    const plan = planBulkGrant([doc("a", "app_b", ["/x"])], ["a"], APP);
    expect(plan.crossApp).toEqual(["a"]);
  });

  it("appId ว่างก็นับเป็น crossApp (ยังไม่ได้รับอนุมัติเข้าแอป)", () => {
    const plan = planBulkGrant([doc("a", "", ["/x"])], ["a"], APP);
    expect(plan.crossApp).toEqual(["a"]);
  });

  it("id ที่หา doc ไม่เจอ → notFound", () => {
    const plan = planBulkGrant([], ["ghost"], APP);
    expect(plan.notFound).toEqual(["ghost"]);
  });

  it("เทียบ _id แบบ string (รองรับ ObjectId)", () => {
    const oid = { toString: () => "aaa" };
    const plan = planBulkGrant([doc(oid, APP, ["/x"])], ["aaa"], APP);
    expect(plan.applyIds).toEqual(["aaa"]);
  });
});
```

- [ ] **Step 2: รันให้ fail**

Run: `npx vitest run lib/superadmin/__tests__/bulkGrant.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: เขียน implementation**

สร้าง `lib/superadmin/bulkGrant.ts`:

```ts
// lib/superadmin/bulkGrant.ts
// คัดกรองรายชื่อก่อนทำ bulk grant/revoke สิทธิ์หน้า (เรียกจาก POST /api/permissions/bulk-grant)
//
// กติกาสำคัญ: user ที่ allowedPages "ว่าง" ใช้ DEFAULT_PERMISSIONS[role] อยู่ —
// การ $addToSet 1 หน้าเข้าลิสต์ว่างจะ override default ทั้งชุดหายเงียบ จึงต้อง "ข้าม" เสมอ

export interface BulkGrantPlan {
  applyIds: string[]; // แก้ได้
  skippedDefault: string[]; // ข้าม: ใช้ค่า default (ลิสต์ว่าง)
  crossApp: string[]; // ปฏิเสธ: ไม่ใช่ user ของแอปปัจจุบัน
  notFound: string[]; // ปฏิเสธ: หา doc ไม่เจอ
}

export function planBulkGrant(
  docs: Array<Record<string, any>>,
  userIds: string[],
  currentAppId: string
): BulkGrantPlan {
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  const plan: BulkGrantPlan = { applyIds: [], skippedDefault: [], crossApp: [], notFound: [] };

  for (const id of userIds) {
    const d = byId.get(String(id));
    if (!d) {
      plan.notFound.push(id);
    } else if ((d.appId || '') !== currentAppId) {
      plan.crossApp.push(id);
    } else if (!Array.isArray(d.allowedPages) || d.allowedPages.length === 0) {
      plan.skippedDefault.push(id);
    } else {
      plan.applyIds.push(id);
    }
  }
  return plan;
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `npx vitest run lib/superadmin`
Expected: PASS ทุกข้อ (ทั้ง 2 ไฟล์)

- [ ] **Step 5: Commit**

```bash
git add lib/superadmin/bulkGrant.ts lib/superadmin/__tests__/bulkGrant.test.js
git commit -m "feat(superadmin): logic คัดกรอง bulk grant — ข้าม user ที่ใช้ default (มีเทส)"
```

---

### Task 4: `pages/api/permissions/_auth.js` — superadmin guard ใช้ร่วม

**Files:**
- Create: `pages/api/permissions/_auth.js` (ไฟล์ขึ้นต้น `_` ใน pages/api ไม่เป็น route — pattern เดียวกับ `pages/api/pm25/_auth.js`)

- [ ] **Step 1: เขียน helper**

```js
// pages/api/permissions/_auth.js
// Guard ใช้ร่วมของ API จัดการ user/สิทธิ์: อนุญาตเฉพาะ superadmin (เช็คจาก Clerk publicMetadata)
// คืน { userId, client, caller, actorName } หรือ null (พร้อมตอบ 401/403 ให้แล้ว)

import { getAuth, clerkClient } from "@clerk/nextjs/server";

export async function requireSuperadmin(req, res) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
  const client = await clerkClient();
  const caller = await client.users.getUser(userId);
  if (caller.publicMetadata?.role !== "superadmin") {
    res.status(403).json({ success: false, message: "เฉพาะ superadmin เท่านั้น" });
    return null;
  }
  const actorName = `${caller.firstName || ""} ${caller.lastName || ""}`.trim();
  return { userId, client, caller, actorName };
}
```

- [ ] **Step 2: ตรวจว่าไม่กลายเป็น route**

Run: `npm run lint 2>&1 | tail -3`
Expected: ไม่มี error ใหม่ (ไฟล์ `_*.js` ถูก Next ข้ามเป็น route อยู่แล้ว)

- [ ] **Step 3: Commit**

```bash
git add pages/api/permissions/_auth.js
git commit -m "feat(permissions): helper requireSuperadmin ใช้ร่วมใน API จัดการ user"
```

---

### Task 5: `GET /api/permissions/users-overview`

**Files:**
- Create: `pages/api/permissions/users-overview.js`

- [ ] **Step 1: เขียน endpoint**

```js
// GET /api/permissions/users-overview
// ลิสต์ user "ทุกคน" สำหรับหน้า /admin/superadmin — merge บัญชี Clerk ทั้ง org
// เข้ากับ Mongo `users` แล้วคำนวณสถานะต่อคน (logic อยู่ lib/superadmin/usersOverview)
//
// แทนที่ GET /api/permissions/clerk-unregistered + GET /api/users/get-all-users-local
// สำหรับหน้านี้ — ถ้า Clerk ล่มยังคืนข้อมูลฝั่ง Mongo พร้อม clerkUnavailable: true

import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { requireSuperadmin } from "./_auth";
import { buildUsersOverview, toClerkLite } from "@/lib/superadmin/usersOverview";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "";

const User =
  mongoose.models.User ||
  mongoose.model("User", new mongoose.Schema({}, { collection: "users", strict: false }));

// ดึง Clerk users ให้ครบทุกคน (org ปัจจุบัน ~92 คน — ห้ามพึ่ง limit ครั้งเดียว)
async function fetchAllClerkUsers(client) {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, totalCount } = await client.users.getUserList({
      limit: 100,
      offset,
      orderBy: "-created_at",
    });
    out.push(...data);
    offset += data.length;
    if (data.length === 0 || out.length >= totalCount) break;
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }
  const auth = await requireSuperadmin(req, res);
  if (!auth) return;

  try {
    await dbConnect();
    // filter เดิมของ get-all-users-local: ไม่เอา user ที่ archive แล้ว
    const mongoDocs = await User.find({
      $or: [{ isArchived: false }, { isArchived: { $exists: false } }, { isArchived: null }],
    }).lean();

    let clerkUsers = [];
    let clerkAvailable = true;
    try {
      clerkUsers = (await fetchAllClerkUsers(auth.client)).map(toClerkLite);
    } catch (e) {
      console.error("users-overview: Clerk fetch failed:", e?.message);
      clerkAvailable = false;
    }

    const users = buildUsersOverview(clerkUsers, mongoDocs, CURRENT_APP_ID, { clerkAvailable });
    return res.status(200).json({
      success: true,
      users,
      clerkUnavailable: !clerkAvailable,
      appId: CURRENT_APP_ID,
    });
  } catch (error) {
    console.error("users-overview error:", error?.message);
    return res.status(500).json({ success: false, message: error?.message });
  }
}
```

- [ ] **Step 2: ทดสอบด้วยมือ**

เปิด dev (`npm run dev`) ล็อกอินเป็น superadmin แล้วเปิด `http://localhost:3000/api/permissions/users-overview` ในเบราว์เซอร์
Expected: JSON `{ success: true, users: [...], clerkUnavailable: false, appId: "app_b" }` — จำนวน users ≈ 92+ (Clerk ทั้ง org + doc orphan ถ้ามี) และมีแถว `status: "broken"` ของ stub (ถ้ายังไม่ได้ลบด้วย one-off script)

- [ ] **Step 3: Commit**

```bash
git add pages/api/permissions/users-overview.js
git commit -m "feat(permissions): GET users-overview — merge Clerk+Mongo พร้อมสถานะต่อคน"
```

---

### Task 6: `POST /api/permissions/repair-user`

**Files:**
- Create: `pages/api/permissions/repair-user.js`

- [ ] **Step 1: เขียน endpoint**

```js
// POST /api/permissions/repair-user  { clerkId, action }
// ซ่อม user doc ที่พังจากหน้า superadmin (แทน script backfill/one-off):
//   fill_name     เติมชื่อจาก Clerk (fallback email)
//   delete_stub   ลบ doc ที่เป็น stub จริงเท่านั้น (guard isStubDoc — ห้ามผ่อน)
//   delete_orphan ลบ doc ของบัญชีที่ถูกลบจาก Clerk แล้ว (server ยืนยัน 404 เอง)
// ใช้ได้กับ doc ทุกแอป (การซ่อมไม่จำกัดแอป) — ทุกการลบเก็บ doc เต็มลง audit log

import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { requireSuperadmin } from "./_auth";
import { isStubDoc } from "@/lib/superadmin/usersOverview";
import { logAuditEvent } from "@/lib/auditLogger";

const User =
  mongoose.models.User ||
  mongoose.model("User", new mongoose.Schema({}, { collection: "users", strict: false }));

const ACTIONS = ["fill_name", "delete_stub", "delete_orphan"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }
  const auth = await requireSuperadmin(req, res);
  if (!auth) return;

  const { clerkId, action } = req.body || {};
  if (!clerkId || !ACTIONS.includes(action)) {
    return res.status(400).json({ success: false, message: "ต้องระบุ clerkId และ action ที่ถูกต้อง" });
  }

  try {
    await dbConnect();
    const doc = await User.findOne({ clerkId }).lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: "ไม่พบ user doc ของ clerkId นี้" });
    }

    if (action === "fill_name") {
      let cu;
      try {
        cu = await auth.client.users.getUser(clerkId);
      } catch {
        return res.status(400).json({ success: false, message: "ไม่พบบัญชี Clerk นี้ — ถ้าบัญชีถูกลบแล้วให้ใช้ 'ลบ orphan' แทน" });
      }
      const name =
        `${cu.firstName || ""} ${cu.lastName || ""}`.trim() ||
        cu.emailAddresses?.[0]?.emailAddress || "";
      if (!name) {
        return res.status(400).json({ success: false, message: "บัญชี Clerk ไม่มีชื่อ/อีเมลให้เติม" });
      }
      await User.updateOne({ _id: doc._id }, { $set: { name } });
      await logAuditEvent({
        actorClerkId: auth.userId,
        actorName: auth.actorName,
        action: "user_repaired",
        resourceType: "user",
        resourceId: clerkId,
        before: { name: doc.name || "" },
        after: { name },
        description: `เติมชื่อ "${name}" จาก Clerk ให้ user doc`,
      });
      return res.status(200).json({ success: true, name });
    }

    if (action === "delete_stub") {
      if (!isStubDoc(doc)) {
        return res.status(400).json({ success: false, message: "doc นี้ไม่ใช่ stub (มี name/appId/timestamps) — ไม่ลบ" });
      }
    } else {
      // delete_orphan — ยืนยันกับ Clerk เองว่าบัญชีไม่มีจริง ไม่เชื่อสถานะจาก client
      try {
        await auth.client.users.getUser(clerkId);
        return res.status(400).json({ success: false, message: "บัญชี Clerk ยังอยู่ — ไม่ใช่ orphan" });
      } catch (e) {
        if (e?.status !== 404) {
          return res.status(502).json({ success: false, message: "ตรวจสอบกับ Clerk ไม่ได้ ลองใหม่ภายหลัง" });
        }
      }
    }

    await User.deleteOne({ _id: doc._id });
    await logAuditEvent({
      actorClerkId: auth.userId,
      actorName: auth.actorName,
      action: "user_doc_deleted",
      resourceType: "user",
      resourceId: clerkId,
      before: doc, // เก็บ doc เต็มไว้กู้คืน/ตรวจย้อนหลัง
      description:
        action === "delete_stub"
          ? `ลบ stub doc ของ ${clerkId}`
          : `ลบ orphan doc (บัญชี Clerk ถูกลบแล้ว) ของ ${clerkId}`,
      meta: { repairAction: action },
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("repair-user error:", error?.message);
    return res.status(500).json({ success: false, message: error?.message });
  }
}
```

- [ ] **Step 2: ทดสอบด้วยมือ (guard ต้องกันจริง)**

รันใน terminal (ต้องได้ 401 เพราะไม่มี session):

```bash
curl -s -X POST http://localhost:3000/api/permissions/repair-user \
  -H 'Content-Type: application/json' \
  -d '{"clerkId":"user_34BXrf8OmiiODu8Edj35hMNKNCJ","action":"delete_stub"}'
```

Expected: `{"success":false,"message":"Unauthorized"}` — การลบจริงจะทดสอบผ่าน UI ใน Task 10

- [ ] **Step 3: Commit**

```bash
git add pages/api/permissions/repair-user.js
git commit -m "feat(permissions): POST repair-user — เติมชื่อ/ลบ stub/ลบ orphan จากหน้าเว็บ"
```

---

### Task 7: `POST /api/permissions/bulk-grant`

**Files:**
- Create: `pages/api/permissions/bulk-grant.js`

- [ ] **Step 1: เขียน endpoint**

```js
// POST /api/permissions/bulk-grant  { pagePath, userIds, mode: "grant" | "revoke" }
// ให้/ถอนสิทธิ์ 1 หน้าแก่ user หลายคนพร้อมกัน — แทน script ตระกูล scripts/grant-*
//
// กติกา (ดู lib/superadmin/bulkGrant):
//   - pagePath ต้องอยู่ใน ALL_PAGES
//   - user ต่างแอป/หา doc ไม่เจอ → ปฏิเสธทั้ง request (400)
//   - user ที่ allowedPages ว่าง (ใช้ default) → ข้าม + รายงานกลับ

import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { requireSuperadmin } from "./_auth";
import { ALL_PAGES } from "@/lib/permissions";
import { planBulkGrant } from "@/lib/superadmin/bulkGrant";
import { logAuditEvent } from "@/lib/auditLogger";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "";

const User =
  mongoose.models.User ||
  mongoose.model("User", new mongoose.Schema({}, { collection: "users", strict: false }));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }
  const auth = await requireSuperadmin(req, res);
  if (!auth) return;

  const { pagePath, userIds, mode } = req.body || {};
  if (!["grant", "revoke"].includes(mode) || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ success: false, message: "ต้องระบุ mode (grant|revoke) และ userIds" });
  }
  if (!ALL_PAGES.some((p) => p.path === pagePath)) {
    return res.status(400).json({ success: false, message: "pagePath ไม่อยู่ในรายการหน้า (ALL_PAGES)" });
  }

  try {
    await dbConnect();
    const docs = await User.find({ _id: { $in: userIds } }).lean();
    const plan = planBulkGrant(docs, userIds, CURRENT_APP_ID);

    if (plan.notFound.length > 0 || plan.crossApp.length > 0) {
      return res.status(400).json({
        success: false,
        message: "มี user ที่ไม่ใช่ของแอปนี้หรือหาไม่เจอ — ไม่ทำรายการใด",
        crossApp: plan.crossApp,
        notFound: plan.notFound,
      });
    }

    const op =
      mode === "grant"
        ? { $addToSet: { allowedPages: pagePath } }
        : { $pull: { allowedPages: pagePath } };
    const result = await User.updateMany({ _id: { $in: plan.applyIds } }, op);

    await logAuditEvent({
      actorClerkId: auth.userId,
      actorName: auth.actorName,
      action: "permissions_bulk_updated",
      resourceType: "user",
      description: `${mode === "grant" ? "ให้" : "ถอน"}สิทธิ์ ${pagePath} แก่ ${plan.applyIds.length} คน (ข้าม ${plan.skippedDefault.length} คนที่ใช้ default)`,
      meta: { pagePath, mode, applied: plan.applyIds, skippedDefault: plan.skippedDefault },
    });

    return res.status(200).json({
      success: true,
      applied: plan.applyIds.length,
      modified: result.modifiedCount,
      skippedDefault: plan.skippedDefault,
    });
  } catch (error) {
    console.error("bulk-grant error:", error?.message);
    return res.status(500).json({ success: false, message: error?.message });
  }
}
```

- [ ] **Step 2: ทดสอบ guard**

```bash
curl -s -X POST http://localhost:3000/api/permissions/bulk-grant \
  -H 'Content-Type: application/json' -d '{"pagePath":"/admin/garbage","userIds":["x"],"mode":"grant"}'
```

Expected: `{"success":false,"message":"Unauthorized"}`

- [ ] **Step 3: Commit**

```bash
git add pages/api/permissions/bulk-grant.js
git commit -m "feat(permissions): POST bulk-grant — ให้สิทธิ์หน้าเป็นชุดแทน grant script"
```

---

### Task 8: Harden endpoint เดิม (ไม่มี auth!) + audit log

**Files:**
- Modify: `pages/api/users/update-allowed-pages.js`
- Modify: `pages/api/users/update-app-id.js`

ทั้งสองไฟล์**ไม่มีการเช็คสิทธิ์เลย** (ใครล็อกอินก็แก้ allowedPages/appId ของใครก็ได้) — ผู้เรียกมีที่เดียวคือหน้า superadmin (grep ยืนยันแล้ว 2026-08-27) จึงล็อกเป็น superadmin-only ได้ปลอดภัย

- [ ] **Step 1: เขียน `update-allowed-pages.js` ใหม่ทั้งไฟล์**

```js
// POST /api/users/update-allowed-pages  { userId, allowedPages }
// อัปเดตหน้าที่อนุญาตของ user (เรียกจากหน้า /admin/superadmin เท่านั้น)
// หมายเหตุ: allowedPages ว่าง = กลับไปใช้ DEFAULT_PERMISSIONS ตาม role

import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { requireSuperadmin } from "@/pages/api/permissions/_auth";
import { logAuditEvent } from "@/lib/auditLogger";

const User =
  mongoose.models.User ||
  mongoose.model("User", new mongoose.Schema({}, { collection: "users", strict: false }));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  const auth = await requireSuperadmin(req, res);
  if (!auth) return;

  try {
    const { userId, allowedPages } = req.body || {};
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    await dbConnect();
    const before = await User.findById(userId).select("name allowedPages").lean();
    if (!before) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const pages = Array.isArray(allowedPages) ? allowedPages : [];
    await User.updateOne({ _id: userId }, { $set: { allowedPages: pages } });

    await logAuditEvent({
      actorClerkId: auth.userId,
      actorName: auth.actorName,
      action: "permissions_updated",
      resourceType: "user",
      resourceId: String(userId),
      before: { allowedPages: before.allowedPages || [] },
      after: { allowedPages: pages },
      description: `อัปเดตหน้าที่อนุญาตของ ${before.name || userId} (${pages.length} หน้า)`,
    });

    return res.status(200).json({ success: true, message: "Allowed pages updated successfully" });
  } catch (e) {
    console.error("update-allowed-pages error:", e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
}
```

- [ ] **Step 2: เขียน `update-app-id.js` ใหม่ทั้งไฟล์**

```js
// POST /api/users/update-app-id  { userId, appId }
// กำหนด appId ให้ user = อนุมัติให้เข้าแอปนั้น (เรียกจากหน้า /admin/superadmin เท่านั้น)

import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { requireSuperadmin } from "@/pages/api/permissions/_auth";
import { logAuditEvent } from "@/lib/auditLogger";

const User =
  mongoose.models.User ||
  mongoose.model("User", new mongoose.Schema({}, { collection: "users", strict: false }));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  const auth = await requireSuperadmin(req, res);
  if (!auth) return;

  try {
    const { userId, appId } = req.body || {};
    if (!userId || !appId) {
      return res.status(400).json({ success: false, message: "userId และ appId is required" });
    }

    await dbConnect();
    const before = await User.findById(userId).select("name appId").lean();
    if (!before) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await User.updateOne({ _id: userId }, { $set: { appId } });

    await logAuditEvent({
      actorClerkId: auth.userId,
      actorName: auth.actorName,
      action: "app_id_assigned",
      resourceType: "user",
      resourceId: String(userId),
      before: { appId: before.appId || "" },
      after: { appId },
      description: `กำหนด App "${appId}" ให้ ${before.name || userId}`,
    });

    return res.status(200).json({ success: true, message: "App ID updated successfully" });
  } catch (e) {
    console.error("update-app-id error:", e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
}
```

- [ ] **Step 3: ทดสอบ guard**

```bash
curl -s -X POST http://localhost:3000/api/users/update-allowed-pages \
  -H 'Content-Type: application/json' -d '{"userId":"x","allowedPages":[]}'
curl -s -X POST http://localhost:3000/api/users/update-app-id \
  -H 'Content-Type: application/json' -d '{"userId":"x","appId":"y"}'
```

Expected: ทั้งคู่ `{"success":false,"message":"Unauthorized"}`

- [ ] **Step 4: Commit**

```bash
git add pages/api/users/update-allowed-pages.js pages/api/users/update-app-id.js
git commit -m "fix(security): ล็อก update-allowed-pages/update-app-id เป็น superadmin + audit log (เดิมไม่มี auth)"
```

---

### Task 9: Components UI — StatusBadge, UserRow, PermissionEditor, BulkGrantModal

**Files:**
- Create: `components/superadmin/StatusBadge.jsx`
- Create: `components/superadmin/UserRow.jsx`
- Create: `components/superadmin/PermissionEditor.jsx`
- Create: `components/superadmin/BulkGrantModal.jsx`

ทิศทาง visual (รีดีไซน์ใหม่ ไม่ยึดธีมม่วงเดิม): พื้นหลัง `bg-slate-100` การ์ดขาว `rounded-2xl border border-slate-200` ตัวหนังสือ slate เข้ม · สีสถานะ: แดง = พัง/orphan, ฟ้า = ยังไม่ลงทะเบียน, เหลืองอำพัน = รอกำหนด App, เขียวมรกต = ใช้งานได้, เทา = แอปอื่น

- [ ] **Step 1: `StatusBadge.jsx`**

```jsx
// components/superadmin/StatusBadge.jsx
// badge สถานะ user ในหน้า /admin/superadmin — mapping เดียวทั้งหน้า
import { STATUS } from "@/lib/superadmin/usersOverview";

const MAP = {
  [STATUS.BROKEN]: { label: "ข้อมูลพัง (stub)", cls: "bg-red-100 text-red-700" },
  [STATUS.ORPHAN]: { label: "บัญชี Clerk ถูกลบ", cls: "bg-red-100 text-red-700" },
  [STATUS.NO_DOC]: { label: "ยังไม่ลงทะเบียน", cls: "bg-sky-100 text-sky-700" },
  [STATUS.NO_APP]: { label: "รอกำหนด App", cls: "bg-amber-100 text-amber-800" },
  [STATUS.ACTIVE]: { label: null, cls: "bg-emerald-100 text-emerald-700" }, // โชว์ชื่อแอปแทน
  [STATUS.OTHER_APP]: { label: null, cls: "bg-slate-200 text-slate-600" }, // โชว์ชื่อแอปแทน
};

export default function StatusBadge({ status, appId }) {
  const m = MAP[status];
  if (!m) return null;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>
      {m.label || appId}
    </span>
  );
}
```

- [ ] **Step 2: `UserRow.jsx`**

```jsx
// components/superadmin/UserRow.jsx
// แถว user 1 คนในหน้า /admin/superadmin — ปุ่ม action เปลี่ยนตาม status
// props:
//   u              OverviewUser จาก users-overview
//   busy           boolean — action ของแถวนี้กำลังทำงาน
//   expanded       boolean — ตัวแก้สิทธิ์กางอยู่
//   clerkUnavailable  boolean — ปิดปุ่มที่ต้องพึ่งข้อมูล Clerk
//   onToggle()     กาง/หุบตัวแก้สิทธิ์ (เฉพาะ active)
//   onOnboard(u) onAssignApp(u) onRepair(u, action)  — ดู index.jsx
//   children       ตัวแก้สิทธิ์ (แสดงเมื่อ expanded)
import { ChevronDown, ChevronUp, UserPlus, Building2, Wrench, Trash2 } from "lucide-react";
import { STATUS } from "@/lib/superadmin/usersOverview";
import StatusBadge from "./StatusBadge";

function Avatar({ u }) {
  if (u.imageUrl) {
    return <img src={u.imageUrl} alt={u.name} className="w-11 h-11 rounded-full object-cover" />;
  }
  return (
    <div className="w-11 h-11 rounded-full bg-slate-300 flex items-center justify-center text-slate-700 font-bold">
      {(u.name || u.email || "?").charAt(0)}
    </div>
  );
}

function lastSeen(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

export default function UserRow({
  u, busy, expanded, clerkUnavailable,
  onToggle, onOnboard, onAssignApp, onRepair, children,
}) {
  const expandable = u.status === STATUS.ACTIVE;
  const spinner = <span className="loading loading-spinner loading-xs" />;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div
        className={`p-4 flex items-center justify-between gap-3 ${expandable ? "cursor-pointer hover:bg-slate-50" : ""}`}
        onClick={expandable ? onToggle : undefined}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Avatar u={u} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-800 truncate">
                {u.name || <span className="italic text-slate-400">(ไม่มีชื่อ)</span>}
              </span>
              <StatusBadge status={u.status} appId={u.appId} />
              {u.clerkRole === "superadmin" && (
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">superadmin</span>
              )}
            </div>
            <div className="text-sm text-slate-500 truncate">
              {[u.email, u.position, u.department].filter(Boolean).join(" · ") || u.clerkId}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {lastSeen(u.lastSignInAt) && (
            <span className="hidden md:inline text-xs text-slate-400">เข้าล่าสุด {lastSeen(u.lastSignInAt)}</span>
          )}

          {u.status === STATUS.NO_DOC && (
            <button onClick={() => onOnboard(u)} disabled={busy || clerkUnavailable}
              className="btn btn-sm bg-sky-600 hover:bg-sky-700 text-white border-0">
              {busy ? spinner : <><UserPlus className="w-4 h-4 mr-1" />เพิ่มเข้าระบบ</>}
            </button>
          )}
          {u.status === STATUS.BROKEN && (
            <>
              <button onClick={() => onRepair(u, "fill_name")} disabled={busy || clerkUnavailable}
                className="btn btn-sm bg-amber-600 hover:bg-amber-700 text-white border-0">
                {busy ? spinner : <><Wrench className="w-4 h-4 mr-1" />เติมชื่อจาก Clerk</>}
              </button>
              {u.isStub && (
                <button onClick={() => onRepair(u, "delete_stub")} disabled={busy || clerkUnavailable}
                  className="btn btn-sm btn-outline border-red-300 text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4 mr-1" />ลบ stub
                </button>
              )}
            </>
          )}
          {u.status === STATUS.ORPHAN && (
            <button onClick={() => onRepair(u, "delete_orphan")} disabled={busy || clerkUnavailable}
              className="btn btn-sm btn-outline border-red-300 text-red-600 hover:bg-red-50">
              {busy ? spinner : <><Trash2 className="w-4 h-4 mr-1" />ลบ (บัญชีถูกลบแล้ว)</>}
            </button>
          )}
          {u.status === STATUS.NO_APP && (
            <button onClick={() => onAssignApp(u)} disabled={busy}
              className="btn btn-sm bg-amber-600 hover:bg-amber-700 text-white border-0">
              {busy ? spinner : <><Building2 className="w-4 h-4 mr-1" />กำหนด App</>}
            </button>
          )}
          {expandable && (
            <span className="text-slate-400 cursor-pointer" onClick={onToggle}>
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </span>
          )}
        </div>
      </div>

      {expanded && children}
    </div>
  );
}
```

- [ ] **Step 3: `PermissionEditor.jsx`**

```jsx
// components/superadmin/PermissionEditor.jsx
// ตัวแก้ allowedPages ของ user 1 คน — จัดกลุ่มตาม category + preset
// props:
//   role     role ใน Mongo ของ user (ใช้โชว์/ใส่ค่า default)
//   value    string[] — allowedPages ที่กำลังแก้ (ว่าง = ใช้ default)
//   onChange(nextPages)  onSave()  saving
import { Briefcase, Check, X, Save, RotateCcw } from "lucide-react";
import {
  ALL_PAGES, DEFAULT_PERMISSIONS, CATEGORY_LABELS,
  groupPagesByCategory, getExecutivePagePaths,
} from "@/lib/permissions";

const CATEGORY_ORDER = ["management", "reports", "settings", "user"];

export default function PermissionEditor({ role, value, onChange, onSave, saving }) {
  const groups = groupPagesByCategory(ALL_PAGES);
  const defaults = DEFAULT_PERMISSIONS[role] || [];
  const usingDefault = value.length === 0;

  const toggle = (path) =>
    onChange(value.includes(path) ? value.filter((p) => p !== path) : [...value, path]);

  const toggleCategory = (pages) => {
    const paths = pages.map((p) => p.path);
    const allOn = paths.every((p) => value.includes(p));
    onChange(allOn ? value.filter((p) => !paths.includes(p)) : [...new Set([...value, ...paths])]);
  };

  return (
    <div className="border-t border-slate-200 p-4 bg-slate-50">
      {usingDefault && (
        <div className="mb-4 rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-800">
          ตอนนี้ใช้<strong>ค่า default ตาม role &quot;{role}&quot;</strong> ({defaults.length} หน้า) —
          ติ๊กหน้าใดก็ตามจะเปลี่ยนเป็นสิทธิ์กำหนดเอง และ default จะไม่มีผลอีก
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => onChange(getExecutivePagePaths())}
          title="เห็นทุกโมดูลยกเว้นการตั้งค่า"
          className="btn btn-xs bg-amber-500 hover:bg-amber-600 text-white border-0">
          <Briefcase className="w-3 h-3 mr-1" />ผู้บริหาร
        </button>
        <button onClick={() => onChange([...defaults])}
          title={`ใส่ชุด default ของ role ${role} เป็นสิทธิ์กำหนดเอง`}
          className="btn btn-xs bg-sky-600 hover:bg-sky-700 text-white border-0">
          <RotateCcw className="w-3 h-3 mr-1" />ค่า default ตาม role
        </button>
        <button onClick={() => onChange(ALL_PAGES.map((p) => p.path))}
          className="btn btn-xs bg-emerald-600 hover:bg-emerald-700 text-white border-0">
          <Check className="w-3 h-3 mr-1" />เลือกหมด
        </button>
        <button onClick={() => onChange([])}
          title="ล้างเป็นลิสต์ว่าง = กลับไปใช้ค่า default ตาม role"
          className="btn btn-xs btn-outline border-slate-300 text-slate-600">
          <X className="w-3 h-3 mr-1" />ล้าง (ใช้ default)
        </button>
      </div>

      <div className="space-y-4 mb-4">
        {CATEGORY_ORDER.filter((c) => groups[c]?.length).map((cat) => (
          <div key={cat}>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-semibold text-slate-600">{CATEGORY_LABELS[cat]}</h5>
              <button onClick={() => toggleCategory(groups[cat])}
                className="text-xs text-sky-600 hover:underline">
                ติ๊ก/เอาออกทั้งหมวด
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {groups[cat].map((page) => {
                const on = value.includes(page.path);
                return (
                  <button key={page.path} onClick={() => toggle(page.path)}
                    className={`p-2 rounded-lg text-left text-sm border transition-colors ${
                      on
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                    }`}>
                    <span className="mr-2">{page.icon}</span>
                    {page.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button onClick={onSave} disabled={saving}
        className="btn btn-sm bg-slate-800 hover:bg-slate-900 text-white border-0">
        {saving ? <span className="loading loading-spinner loading-sm" /> : <Save className="w-4 h-4 mr-1" />}
        บันทึกสิทธิ์
      </button>
    </div>
  );
}
```

- [ ] **Step 4: `BulkGrantModal.jsx`**

```jsx
// components/superadmin/BulkGrantModal.jsx
// ให้/ถอนสิทธิ์ 1 หน้าแก่ user หลายคนพร้อมกัน (แทน script ตระกูล scripts/grant-*)
// props:
//   users    OverviewUser[] เฉพาะ status=active (index.jsx กรองมาแล้ว)
//   onClose()  onDone() — เรียกหลังบันทึกสำเร็จ (ให้ parent refetch)
import { useState } from "react";
import Swal from "sweetalert2";
import { X } from "lucide-react";
import { ALL_PAGES } from "@/lib/permissions";

export default function BulkGrantModal({ users, onClose, onDone }) {
  const [pagePath, setPagePath] = useState("");
  const [mode, setMode] = useState("grant");
  const [checked, setChecked] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const eligible = users.filter((u) => u.allowedPages.length > 0);
  const usingDefault = users.filter((u) => u.allowedPages.length === 0);

  const toggle = (id) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const submit = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/permissions/bulk-grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagePath, mode, userIds: [...checked] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      await Swal.fire({
        icon: "success",
        title: mode === "grant" ? "ให้สิทธิ์แล้ว" : "ถอนสิทธิ์แล้ว",
        text: `สำเร็จ ${data.applied} คน`,
        timer: 2000,
        showConfirmButton: false,
      });
      onDone();
    } catch (e) {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">ให้สิทธิ์เป็นชุด</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="flex gap-2">
            <select value={pagePath} onChange={(e) => setPagePath(e.target.value)}
              className="select select-sm select-bordered flex-1">
              <option value="">— เลือกหน้า —</option>
              {ALL_PAGES.map((p) => (
                <option key={p.path} value={p.path}>{p.icon} {p.label}</option>
              ))}
            </select>
            <select value={mode} onChange={(e) => setMode(e.target.value)}
              className="select select-sm select-bordered">
              <option value="grant">ให้สิทธิ์</option>
              <option value="revoke">ถอนสิทธิ์</option>
            </select>
          </div>

          <div className="space-y-1">
            {eligible.map((u) => (
              <label key={u.mongoId} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" className="checkbox checkbox-sm"
                  checked={checked.has(u.mongoId)} onChange={() => toggle(u.mongoId)} />
                <span className="text-sm text-slate-700">{u.name}</span>
                <span className="text-xs text-slate-400">{u.allowedPages.length} หน้า</span>
              </label>
            ))}
          </div>

          {usingDefault.length > 0 && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs text-slate-500 mb-1">
                ใช้ค่า default อยู่ — เลือกไม่ได้ (การเติมหน้าเดียวจะทำให้ชุด default หายทั้งชุด
                ถ้าต้องการกำหนดให้กางแก้รายคนก่อน):
              </p>
              <p className="text-xs text-slate-400">{usingDefault.map((u) => u.name).join(", ")}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-sm btn-ghost">ยกเลิก</button>
          <button onClick={submit} disabled={saving || !pagePath || checked.size === 0}
            className="btn btn-sm bg-slate-800 hover:bg-slate-900 text-white border-0">
            {saving ? <span className="loading loading-spinner loading-sm" /> : `บันทึก (${checked.size} คน)`}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Lint แล้ว commit**

Run: `npm run lint 2>&1 | tail -5`
Expected: ไม่มี error ใหม่ใน `components/superadmin/`

```bash
git add components/superadmin/
git commit -m "feat(superadmin): components ใหม่ — StatusBadge, UserRow, PermissionEditor, BulkGrantModal"
```

---

### Task 10: เขียน `pages/admin/superadmin/index.jsx` ใหม่ทั้งไฟล์

**Files:**
- Modify: `pages/admin/superadmin/index.jsx` (แทนที่ทั้งไฟล์)

- [ ] **Step 1: เขียนหน้าใหม่**

```jsx
// pages/admin/superadmin/index.jsx
// หน้าจัดการ user + สิทธิ์ (superadmin เท่านั้น) — รีดีไซน์ 2026-08
// ลิสต์เดียว merge Clerk+Mongo (GET /api/permissions/users-overview) พร้อมสถานะต่อคน
// spec: docs/superpowers/specs/2026-08-27-superadmin-user-management-design.md
import { useState, useEffect, useCallback, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import { Crown, Users, Search, RefreshCw, AlertTriangle, Building2, ListChecks } from "lucide-react";
import { STATUS } from "@/lib/superadmin/usersOverview";
import UserRow from "@/components/superadmin/UserRow";
import PermissionEditor from "@/components/superadmin/PermissionEditor";
import BulkGrantModal from "@/components/superadmin/BulkGrantModal";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
const NEEDS_ACTION = [STATUS.BROKEN, STATUS.ORPHAN, STATUS.NO_DOC, STATUS.NO_APP];

const FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "needs_action", label: "ต้องดำเนินการ" },
  { key: "active", label: "ใช้งานได้" },
  { key: "other_app", label: "แอปอื่น" },
];

// key ประจำแถว: บางแถวไม่มี mongoId (no_doc) บางแถวอาจไม่มี clerkId (doc เก่า)
const rowKey = (u) => u.mongoId || u.clerkId;

export default function SuperAdminPage() {
  const { user } = useUser();
  const router = useRouter();

  const [rows, setRows] = useState([]);
  const [clerkUnavailable, setClerkUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedKey, setExpandedKey] = useState(null);
  const [editedPages, setEditedPages] = useState({}); // key = mongoId
  const [busy, setBusy] = useState({}); // key = rowKey
  const [bulkOpen, setBulkOpen] = useState(false);

  const isSuperAdmin = user?.publicMetadata?.role === "superadmin";

  useEffect(() => {
    if (user && !isSuperAdmin) {
      Swal.fire({
        icon: "error",
        title: "ไม่มีสิทธิ์เข้าถึง",
        text: "เฉพาะ Super Admin เท่านั้น",
        confirmButtonText: "กลับหน้าหลัก",
      }).then(() => router.replace("/"));
    }
  }, [user, isSuperAdmin, router]);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/permissions/users-overview");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "โหลดข้อมูลไม่สำเร็จ");
      setRows(data.users || []);
      setClerkUnavailable(!!data.clerkUnavailable);
      const pagesMap = {};
      for (const u of data.users || []) {
        if (u.mongoId) pagesMap[u.mongoId] = u.allowedPages;
      }
      setEditedPages(pagesMap);
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "โหลดข้อมูลไม่สำเร็จ", text: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) fetchOverview();
  }, [isSuperAdmin, fetchOverview]);

  const withBusy = async (key, fn) => {
    try {
      setBusy((prev) => ({ ...prev, [key]: true }));
      await fn();
      await fetchOverview();
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: e.message });
    } finally {
      setBusy((prev) => ({ ...prev, [key]: false }));
    }
  };

  const post = async (url, body) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed");
    return data;
  };

  const onboard = (u) =>
    withBusy(rowKey(u), async () => {
      await post("/api/users/create", {
        clerkId: u.clerkId,
        name: u.name || u.email,
        role: "admin",
        profileUrl: u.imageUrl,
      });
      Swal.fire({ icon: "success", title: "เพิ่มเข้าระบบแล้ว", text: `${u.name || u.email} ใช้งาน ${CURRENT_APP_ID} ได้แล้ว`, timer: 2000, showConfirmButton: false });
    });

  const assignApp = (u) =>
    withBusy(rowKey(u), async () => {
      await post("/api/users/update-app-id", { userId: u.mongoId, appId: CURRENT_APP_ID });
      Swal.fire({ icon: "success", title: "กำหนด App แล้ว", timer: 1500, showConfirmButton: false });
    });

  const repair = async (u, action) => {
    if (action !== "fill_name") {
      const confirm = await Swal.fire({
        icon: "warning",
        title: action === "delete_stub" ? "ลบ stub doc?" : "ลบ doc ของบัญชีที่ถูกลบ?",
        text: "ข้อมูลเดิมจะถูกเก็บสำเนาไว้ใน Audit Log",
        showCancelButton: true,
        confirmButtonText: "ลบ",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#dc2626",
      });
      if (!confirm.isConfirmed) return;
    }
    await withBusy(rowKey(u), async () => {
      // contract เปลี่ยนเป็น mongoId ตาม code review Task 6 (เจาะจง doc เดียว กัน clerkId ซ้ำ)
      await post("/api/permissions/repair-user", { mongoId: u.mongoId, action });
    });
  };

  const savePages = (u) =>
    withBusy(rowKey(u), async () => {
      await post("/api/users/update-allowed-pages", {
        userId: u.mongoId,
        allowedPages: editedPages[u.mongoId] || [],
      });
      Swal.fire({ icon: "success", title: "บันทึกสิทธิ์แล้ว", timer: 1500, showConfirmButton: false });
    });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((u) => {
      const matchSearch =
        q === "" ||
        [u.name, u.email, u.department, u.position, u.clerkId]
          .some((f) => (f || "").toLowerCase().includes(q));
      if (!matchSearch) return false;
      if (filter === "needs_action") return NEEDS_ACTION.includes(u.status);
      if (filter === "active") return u.status === STATUS.ACTIVE;
      if (filter === "other_app") return u.status === STATUS.OTHER_APP;
      return true;
    });
  }, [rows, search, filter]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((u) => u.status === STATUS.ACTIVE).length,
      needsAction: rows.filter((u) => NEEDS_ACTION.includes(u.status)).length,
      otherApp: rows.filter((u) => u.status === STATUS.OTHER_APP).length,
    }),
    [rows]
  );

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-800 rounded-xl">
              <Crown className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">จัดการผู้ใช้และสิทธิ์</h1>
              <p className="text-sm text-slate-500">แอปปัจจุบัน: {CURRENT_APP_ID}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <a href="/admin/superadmin/line-settings" className="btn btn-sm btn-outline border-slate-300 text-slate-600">💬 ตั้งค่า LINE</a>
            <a href="/admin/superadmin/audit-log" className="btn btn-sm btn-outline border-slate-300 text-slate-600">📜 Audit Log</a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Users, label: "ทั้งหมด", value: counts.total, cls: "text-slate-600" },
            { icon: Building2, label: `ใช้งานได้ (${CURRENT_APP_ID})`, value: counts.active, cls: "text-emerald-600" },
            { icon: AlertTriangle, label: "ต้องดำเนินการ", value: counts.needsAction, cls: "text-amber-600" },
            { icon: Users, label: "แอปอื่น", value: counts.otherApp, cls: "text-slate-400" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
              <s.icon className={`w-7 h-7 ${s.cls}`} />
              <div>
                <div className="text-xl font-bold text-slate-800">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Clerk unavailable banner */}
        {clerkUnavailable && (
          <div className="mb-4 rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-800">
            ⚠️ ติดต่อ Clerk ไม่ได้ชั่วคราว — แสดงเฉพาะข้อมูลในระบบ ปุ่มเพิ่ม/ซ่อมถูกปิดไว้จนกว่าจะเชื่อมต่อได้
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหา ชื่อ / email / กอง / clerkId..."
              className="input input-sm input-bordered w-full pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`btn btn-xs rounded-full ${filter === f.key ? "bg-slate-800 text-white border-0" : "btn-ghost text-slate-500"}`}>
                {f.label}
              </button>
            ))}
            <button onClick={() => setBulkOpen(true)} className="btn btn-xs btn-outline border-slate-300 text-slate-600">
              <ListChecks className="w-3.5 h-3.5 mr-1" />ให้สิทธิ์เป็นชุด
            </button>
            <button onClick={fetchOverview} className="btn btn-xs btn-ghost text-slate-500">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="loading loading-spinner loading-lg" />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((u) => {
              const key = rowKey(u);
              return (
                <UserRow
                  key={key}
                  u={u}
                  busy={!!busy[key]}
                  expanded={expandedKey === key}
                  clerkUnavailable={clerkUnavailable}
                  onToggle={() => setExpandedKey(expandedKey === key ? null : key)}
                  onOnboard={onboard}
                  onAssignApp={assignApp}
                  onRepair={repair}
                >
                  <PermissionEditor
                    role={u.role}
                    value={editedPages[u.mongoId] || []}
                    onChange={(next) => setEditedPages((prev) => ({ ...prev, [u.mongoId]: next }))}
                    onSave={() => savePages(u)}
                    saving={!!busy[key]}
                  />
                </UserRow>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <Users className="w-14 h-14 mx-auto mb-3 opacity-40" />
                <p>ไม่พบผู้ใช้ตามเงื่อนไข</p>
              </div>
            )}
          </div>
        )}
      </div>

      {bulkOpen && (
        <BulkGrantModal
          users={rows.filter((u) => u.status === STATUS.ACTIVE)}
          onClose={() => setBulkOpen(false)}
          onDone={() => { setBulkOpen(false); fetchOverview(); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: ลบ endpoint ที่ถูกแทนที่**

```bash
git rm pages/api/permissions/clerk-unregistered.js
grep -rn "clerk-unregistered" pages/ components/ lib/ || echo "no references"
```

Expected: `no references`

- [ ] **Step 3: ทดสอบด้วยมือบน dev ครบทุกสถานะ**

เปิด `http://localhost:3000/admin/superadmin` ด้วยบัญชี superadmin แล้วไล่เช็ค:

- [ ] แถว stub กองสาธารณสุขฯ (`user_34BXrf8OmiiODu8Edj35hMNKNCJ`) โชว์เป็น "ข้อมูลพัง (stub)" **พร้อมชื่อจาก Clerk** และค้นหาด้วย "กองสาธารณสุข" หรือ "health.takhlicity" เจอ *(ถ้า user ลบไปแล้วด้วย one-off script แถวนี้จะเป็น "ยังไม่ลงทะเบียน" แทน — ทดสอบปุ่มซ่อมกับ doc นี้ไม่ได้ ให้ตรวจ logic ผ่านเทส vitest แทน)*
- [ ] กด "เติมชื่อจาก Clerk" → refetch แล้วแถวเปลี่ยนเป็น "รอกำหนด App" (มีชื่อแล้ว แต่ appId ยังว่าง)
- [ ] แถว "ยังไม่ลงทะเบียน" มีปุ่ม "เพิ่มเข้าระบบ" ใช้ได้
- [ ] filter chip ทั้ง 4 ตัวกรองถูก · ช่องค้นหา match email ได้
- [ ] กางแถว active → เห็นสิทธิ์จัดกลุ่มตามหมวด, ปุ่ม preset ครบ 4, แก้แล้วบันทึกสำเร็จ (เช็คใน Audit Log ว่ามี entry `permissions_updated`)
- [ ] user ที่ allowedPages ว่างเห็นแบนเนอร์ "ใช้ค่า default ตาม role"
- [ ] เปิด "ให้สิทธิ์เป็นชุด" → เลือกหน้า + ติ๊ก user → บันทึก → Audit Log มี `permissions_bulk_updated`
- [ ] user แอปอื่น (ตอน dev คือ `smart-takhli`) เป็นแถวอ่านอย่างเดียว

- [ ] **Step 4: Commit**

```bash
git add pages/admin/superadmin/index.jsx
git commit -m "feat(superadmin): รื้อหน้าจัดการ user — ลิสต์เดียว merge Clerk+Mongo + ซ่อม doc + bulk grant"
```

---

### Task 11: Verification ก่อนเปิด PR

- [ ] **Step 1: เทสทั้งหมดผ่าน**

Run: `npm test`
Expected: PASS ทุกไฟล์ (รวม `lib/superadmin/` 2 ไฟล์ใหม่ + เทสเดิมทั้งหมดไม่พัง)

- [ ] **Step 2: Lint ผ่าน**

Run: `npm run lint`
Expected: ไม่มี error (warning เดิมที่มีอยู่แล้วไม่นับ)

- [ ] **Step 3: Build ผ่าน**

**ปิด `npm run dev` ก่อน** แล้ว:

```bash
rm -rf .next && npm run build
```

Expected: build สำเร็จ ไม่มี type error / ไม่มี route หาย (`/admin/superadmin` อยู่ในรายการ)

- [ ] **Step 4: เช็คว่าไม่มีไฟล์หลุด**

```bash
git status --short
```

Expected: ไม่มีไฟล์ `scripts/oneoff-*` หรือไฟล์อื่นค้างใน staged — `.agents/`, `AGENTS.md`, `lineRating_backup.js` เป็น untracked เดิมของ repo ปล่อยไว้

- [ ] **Step 5: Commit สุดท้าย (ถ้ามีแก้จาก build/lint) แล้วสรุปให้ user ตัดสินใจเปิด PR**

หมายเหตุ: merge เข้า `main` = ขึ้น production ทันที (Railway auto-deploy) — ให้ user เป็นคนกดยืนยันเปิด/merge PR เสมอ

---

## Self-Review Notes (ผ่านแล้ว)

- ทุก requirement ใน spec มี task รองรับ: merge+status (T2,T5) · repair 3 action (T6) · bulk grant + กติกาลิสต์ว่าง (T3,T7) · UI ลิสต์เดียว+filter+ค้นหา Clerk (T9,T10) · จัดกลุ่มสิทธิ์+preset (T9) · ลบ clerk-unregistered (T10) · audit log ทุก mutation (T1,T6,T7,T8) · Clerk-down fallback (T2,T5,T9,T10)
- เกินจาก spec 1 เรื่องโดยตั้งใจ: Task 8 harden endpoint เดิมที่ไม่มี auth (ช่องโหว่จริง ผู้เรียกมีที่เดียว)
- ชื่อ type/function สอดคล้องข้าม task แล้ว: `STATUS`, `isStubDoc`, `buildUsersOverview`, `toClerkLite`, `planBulkGrant`, `requireSuperadmin`
