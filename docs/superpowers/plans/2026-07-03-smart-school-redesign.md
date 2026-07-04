# Smart School Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** รีดีไซน์ระบบสำรวจการศึกษาเป็นโมดูล `smart-school` — ทะเบียนบุคคล + ใบสมัครรายปีงบประมาณ, ฟอร์มรายเก่า/รายใหม่ยืนยันด้วยเลขบัตร 13 หลัก, แจ้งเตือน n8n 3 events, migrate ข้อมูลเดิม 238 รายการโดยไม่แตะ collection เก่า

**Architecture:** โมดูลใหม่ตาม convention (`pages/api/smart-school/`, `components/smart-school/`, `lib/smart-school/`, `models/smart-school/`) แยกข้อมูลเป็น 2 collections: `school_applicants` (บุคคล, citizenId unique-sparse) + `school_applications` (ใบสมัครต่อปี, unique คู่ applicantRef+surveyYear) ออกเลขใบสมัครผ่าน counter collection แบบ atomic ฟอร์มสาธารณะเป็น wizard 3 ขั้น หน้าแอดมินใหม่ `/admin/smart-school` แทน `/admin/education-map` (path เดิม redirect)

**Tech Stack:** Next.js 15 Pages Router, React 19, MongoDB/Mongoose, Clerk (admin API only), Zod, Tailwind v4 + DaisyUI, react-leaflet, n8n (MCP `claude.ai n8n`)

**Spec:** `docs/superpowers/specs/2026-07-03-smart-school-redesign-design.md`

**ข้อควรรู้ก่อนเริ่ม:**
- Repo นี้**ไม่มี test runner** — ตรวจ helper ล้วน ๆ ด้วย `node -e` (แปลง `export` → CJS ชั่วคราวด้วย eval-shim ตามตัวอย่างในแต่ละ task), ตรวจภาพรวมด้วย `npm run lint` + `npm run build`
- `.env.local` มี `MONGO_URI` ชี้ฐานจริง — สคริปต์ที่อ่านอย่างเดียว/dry-run รันได้เลย ส่วนขั้น "รันจริง" ของ migration ให้ทำตอน cutover (Task 18)
- ห้ามแตะ collection `educationregisters` เดิม (backup ถาวร)
- Commit ทุกจบ task ด้วย `git add <ไฟล์ที่ระบุ> && git commit`

---

## File Structure

```
lib/smart-school/
  citizenId.js        — validate เลขบัตร 13 หลัก (checksum mod 11)
  fiscalYear.js       — ปีงบประมาณ พ.ศ. (Asia/Bangkok)
  mask.js             — maskName สำหรับผลค้นหาสาธารณะ
  applicationId.js    — ออกเลข TKC69-001 ผ่าน school_counters (atomic)
  notify.js           — n8n webhook 3 events (fire-and-forget)
models/smart-school/
  SchoolApplicant.js   — collection school_applicants
  SchoolApplication.js — collection school_applications
pages/api/smart-school/
  lookup.js   — POST public: ค้นเลขบัตร/ชื่อ → ผลมาสก์
  verify.js   — POST public: ยืนยันเลขบัตร → ข้อมูลเต็มปีล่าสุด (+ผูกเลขให้ record เก่า)
  submit.js   — POST public: สร้าง/อัปเดตใบสมัครปีปัจจุบัน + n8n
  _auth.js    — requireSchoolAdmin (pattern เดียวกับ pages/api/pm25/_auth.js)
  list.js     — GET admin: ใบสมัครตามปี + flags ครัวเรือน
  update.js   — PUT admin: แก้ทุกฟิลด์รวมรูป + backfill เลขบัตร + n8n เมื่อรูปเปลี่ยน
  status.js   — PUT admin: เปลี่ยนสถานะ
  delete.js   — DELETE admin: ลบใบสมัคร (+ ลบบุคคลถ้าไม่เหลือใบ)
components/smart-school/
  survey/SchoolSurveyModal.jsx — orchestrator wizard 3 ขั้น (แทน EducationFormModal)
  survey/IdentityStep.jsx      — ขั้น 1: รายใหม่/รายเก่า + lookup/verify
  survey/InfoStep.jsx          — ขั้น 2: ฟิลด์ข้อมูล + hint ค่าเดิมปีที่แล้ว
  survey/MediaStep.jsx         — ขั้น 3: รูป + พิกัด + ส่ง
  admin/SmartSchoolDashboard.jsx — แท็บปี + fetch + สรุป + สลับตาราง/แผนที่
  admin/ApplicationTable.jsx     — ตาราง + badge กติกาครัวเรือน
  admin/ApplicationDetailModal.jsx — รายละเอียด + เปลี่ยนสถานะ (มี dialog เตือน)
  admin/ApplicationEditModal.jsx   — แก้ไขทุกฟิลด์ + รูป + backfill เลขบัตร
  admin/MapPoints.js             — คัดลอกจาก components/education/MapEducationPoints.js
pages/admin/smart-school.jsx     — PermissionGuard + SmartSchoolDashboard
pages/admin/education-map.js     — เขียนทับเป็น redirect
scripts/migrate-education-to-smart-school.js — migration (idempotent, --dry-run)
scripts/grant-smart-school-permission.js     — เพิ่มสิทธิ์ user เดิม
docs/modules/smart-school.md     — แทน education.md
```

แก้ไฟล์เดิม: `lib/permissions.ts` (สลับ entry), `components/LayoutAdmin.tsx` (href เมนู), `pages/index.tsx` (สลับ modal), `docs/modules/README.md`, `CLAUDE.md` (bullet โมดูล)
ลบท้ายสุด (Task 17): `pages/api/education/*` (6 ไฟล์), `components/education/*` (6 ไฟล์), `models/EducationRegisterModel.js`, `docs/modules/education.md`

**รูปแบบ payload แถวข้อมูลฝั่งแอดมิน (ใช้ตรงกันทุก task):** `list.js` คืน application ที่ flatten ข้อมูลบุคคลขึ้น top-level: `{ _id, applicationId, surveyYear, status, isRenewal, applicantRef (string id), prefix, name, phone, citizenId, educationLevel, schoolName, gradeLevel, gpa, address, actualAddress, housingStatus, householdMembers, annualIncome, incomeSource, familyStatus, receivedScholarship, takhliScholarshipHistory, note, imageUrl[], location, statusUpdatedBy, statusUpdatedAt, createdAt, flags: { prevYearAwarded, householdKey, householdAwardedOther } }` — โครงนี้ทำให้ `MapPoints` (ที่อ่าน `item.name`, `item.educationLevel`, `item.location`, `item.imageUrl`) ใช้ได้ทันที

---

### Task 1: Pure helpers — citizenId / fiscalYear / mask

**Files:**
- Create: `lib/smart-school/citizenId.js`
- Create: `lib/smart-school/fiscalYear.js`
- Create: `lib/smart-school/mask.js`

- [ ] **Step 1.1: เขียน `lib/smart-school/citizenId.js`**

```js
// lib/smart-school/citizenId.js
// ตรวจเลขบัตรประชาชนไทย 13 หลักด้วย checksum mod 11
// หลัก 1-12 คูณน้ำหนัก 13..2 รวมกัน → check digit = (11 - sum % 11) % 10 ต้องเท่าหลักที่ 13

export function isValidCitizenId(id) {
  if (typeof id !== "string" || !/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}
```

- [ ] **Step 1.2: เขียน `lib/smart-school/fiscalYear.js`**

```js
// lib/smart-school/fiscalYear.js
// ปีงบประมาณไทย (พ.ศ.): ต.ค.–ก.ย. — ตั้งแต่ 1 ต.ค. นับเป็นปีงบถัดไป
// คำนวณตามเวลา Asia/Bangkok เสมอ (server production รัน UTC)

export function getFiscalYearBE(date = new Date()) {
  const bkk = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
  );
  const beYear = bkk.getFullYear() + 543;
  return bkk.getMonth() >= 9 ? beYear + 1 : beYear; // getMonth() === 9 คือตุลาคม
}
```

- [ ] **Step 1.3: เขียน `lib/smart-school/mask.js`**

```js
// lib/smart-school/mask.js
// มาสก์ชื่อสำหรับผลค้นหาสาธารณะ (PDPA): คงชื่อแรก นามสกุลเหลือ 2 ตัวแรก + xxx
// เช่น "พงศกรณ์ ผ่องใส" → "พงศกรณ์ ผ่xxx"

export function maskName(fullName = "") {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 3) + "xxx";
  const [first, ...rest] = parts;
  return `${first} ${rest.map((p) => p.slice(0, 2) + "xxx").join(" ")}`;
}
```

- [ ] **Step 1.4: ตรวจ logic ด้วย node (eval-shim แปลง export → CJS)**

Run:
```bash
node -e "
const fs = require('fs');
const load = (p) => (0, eval)(fs.readFileSync(p, 'utf8').replace(/export /g, '')); // indirect eval — ให้ function ประกาศลง global scope
load('lib/smart-school/citizenId.js');
load('lib/smart-school/mask.js');
load('lib/smart-school/fiscalYear.js');

// สร้างเลขบัตรที่ checksum ถูกจริงจากเลข 12 หลักใด ๆ
const base = '111203456356';
let sum = 0; for (let i = 0; i < 12; i++) sum += Number(base[i]) * (13 - i);
const valid = base + String((11 - (sum % 11)) % 10);
console.assert(isValidCitizenId(valid) === true, 'FAIL: เลขถูกต้องกลับไม่ผ่าน');
console.assert(isValidCitizenId(base + String((Number(valid[12]) + 1) % 10)) === false, 'FAIL: check digit ผิดกลับผ่าน');
console.assert(isValidCitizenId('12345') === false && isValidCitizenId(null) === false, 'FAIL: input เพี้ยนต้องไม่ผ่าน');

console.assert(maskName('พงศกรณ์ ผ่องใส') === 'พงศกรณ์ ผ่xxx', 'FAIL mask 2 ท่อน: ' + maskName('พงศกรณ์ ผ่องใส'));
console.assert(maskName('สมชาย') === 'สมชxxx', 'FAIL mask 1 ท่อน');
console.assert(maskName('') === '', 'FAIL mask ว่าง');

console.assert(getFiscalYearBE(new Date('2026-07-03T12:00:00+07:00')) === 2569, 'FAIL FY ก.ค. 2026');
console.assert(getFiscalYearBE(new Date('2026-10-01T12:00:00+07:00')) === 2570, 'FAIL FY ต.ค. 2026');
console.assert(getFiscalYearBE(new Date('2025-08-13T12:00:00+07:00')) === 2568, 'FAIL FY ข้อมูลเก่า');
console.log('helpers OK — ตัวอย่างเลขบัตร valid:', valid);
"
```
Expected: พิมพ์ `helpers OK — ตัวอย่างเลขบัตร valid: 111203456356X` โดยไม่มีบรรทัด `FAIL` (console.assert เงียบเมื่อผ่าน) — จดเลขบัตร valid ตัวนี้ไว้ใช้ทดสอบ task ถัด ๆ ไป

- [ ] **Step 1.5: Commit**

```bash
git add lib/smart-school/citizenId.js lib/smart-school/fiscalYear.js lib/smart-school/mask.js
git commit -m "feat(smart-school): pure helpers — citizenId checksum, fiscalYear BE, maskName"
```

---

### Task 2: Models + ตัวออกเลขใบสมัคร

**Files:**
- Create: `models/smart-school/SchoolApplicant.js`
- Create: `models/smart-school/SchoolApplication.js`
- Create: `lib/smart-school/applicationId.js`

- [ ] **Step 2.1: เขียน `models/smart-school/SchoolApplicant.js`**

สำคัญ: `citizenId` **ห้ามใส่ default** — index `unique+sparse` จะไม่นับเอกสารที่"ไม่มีฟิลด์" แต่ถ้า default เป็น `null`/`""` ทุกเอกสารจะมีฟิลด์แล้วชนกันเอง

```js
import mongoose from "mongoose";

// ทะเบียนบุคคล (ผู้ขอทุน) — 1 คน = 1 เอกสาร ข้ามปี
const SchoolApplicantSchema = new mongoose.Schema(
  {
    // เลขบัตร 13 หลัก — รายเก่าที่ migrate มาจะยังไม่มีฟิลด์นี้
    // จนกว่าจะยืนยันตัวตนครั้งแรกหรือแอดมิน backfill (ห้ามใส่ default)
    citizenId: { type: String, unique: true, sparse: true },
    prefix: { type: String, default: "" },
    name: { type: String, required: true, index: true },
    phone: { type: String, default: "" }, // ข้อมูลติดต่อ + สัญญาณจัดกลุ่มครัวเรือน (ไม่ใช่ตัวยืนยันตัวตน)
    legacyApplicantId: { type: String, default: null }, // TKC-xxx เดิม
    legacyId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true }, // _id ใน educationregisters
  },
  { timestamps: true }
);

export default mongoose.models.SchoolApplicant ||
  mongoose.model("SchoolApplicant", SchoolApplicantSchema, "school_applicants");
```

- [ ] **Step 2.2: เขียน `models/smart-school/SchoolApplication.js`**

```js
import mongoose from "mongoose";

export const APPLICATION_STATUSES = [
  "รับคำร้อง",
  "ตรวจสอบแล้ว",
  "ได้รับทุน",
  "ไม่ผ่านเกณฑ์",
];

// ใบสมัคร/แบบสำรวจ 1 ใบต่อคนต่อปีงบประมาณ
const SchoolApplicationSchema = new mongoose.Schema(
  {
    applicantRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SchoolApplicant",
      required: true,
      index: true,
    },
    surveyYear: { type: Number, required: true, index: true }, // ปีงบประมาณ พ.ศ. เช่น 2569
    applicationId: { type: String, required: true, unique: true }, // TKC69-001

    educationLevel: { type: String, default: "" },
    schoolName: { type: String, default: "" },
    gradeLevel: { type: String, default: "" },
    gpa: { type: Number, min: 0, max: 4, default: null },
    address: { type: String, default: "" },
    actualAddress: { type: String, default: "" },
    housingStatus: {
      type: String,
      enum: ["ผู้อาศัย", "เจ้าของ", "บ้านเช่า", "อื่นๆ", "ไม่ระบุ", ""],
      default: "ไม่ระบุ",
    },
    householdMembers: { type: Number, default: 1, min: 1 },
    annualIncome: { type: Number, default: 0 },
    incomeSource: { type: [String], default: [] },
    familyStatus: {
      type: [String],
      enum: ["บิดา-มารดาแยกกันอยู่", "แยกกันอยู่ชั่วคราว", "หย่าร้าง", "บิดาส่งเสีย", "มารดาส่งเสีย", "บิดา/มารดาไม่ได้ส่งเสีย"],
      default: [],
    },
    receivedScholarship: { type: [String], default: [] },
    // ประวัติทุนเทศบาลแบบ self-report จากฟอร์ม (ไม่ใส่ enum — ปีใหม่เพิ่มได้เรื่อย ๆ)
    // ผลพิจารณาจริงของระบบใช้ status "ได้รับทุน" รายปีแทน
    takhliScholarshipHistory: { type: [String], default: [] },
    note: { type: String, default: "" },
    imageUrl: {
      type: [String],
      default: [],
      validate: [(a) => Array.isArray(a) && a.length <= 3, "Maximum of 3 images allowed"],
    },
    location: { lat: Number, lng: Number },

    status: { type: String, enum: APPLICATION_STATUSES, default: "รับคำร้อง" },
    statusUpdatedBy: { type: String, default: "" },
    statusUpdatedAt: { type: Date, default: null },
    isRenewal: { type: Boolean, default: false }, // รายเก่า (เคยมีใบปีก่อนหน้า)
  },
  { timestamps: true }
);

// 1 คน 1 ใบต่อปี
SchoolApplicationSchema.index({ applicantRef: 1, surveyYear: 1 }, { unique: true });

export default mongoose.models.SchoolApplication ||
  mongoose.model("SchoolApplication", SchoolApplicationSchema, "school_applications");
```

- [ ] **Step 2.3: เขียน `lib/smart-school/applicationId.js`**

```js
// lib/smart-school/applicationId.js
import mongoose from "mongoose";

// ออกเลขใบสมัครแบบ atomic ผ่าน collection school_counters
// (แก้ปัญหาเดิมที่ใช้ countDocuments()+1 แล้วเลขชนจนต้องมี endpoint reset)
// รูปแบบ: TKC<ปีงบ 2 หลักท้าย>-<เลขรัน 3 หลัก> เช่น TKC69-001
export async function nextApplicationId(surveyYearBE) {
  const res = await mongoose.connection.db
    .collection("school_counters")
    .findOneAndUpdate(
      { _id: `app-${surveyYearBE}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
  // mongo driver v4-5 คืน { value: doc }, v6 คืน doc ตรง ๆ — รองรับทั้งคู่
  const doc = res && res.value !== undefined ? res.value : res;
  return `TKC${String(surveyYearBE).slice(-2)}-${String(doc.seq).padStart(3, "0")}`;
}
```

- [ ] **Step 2.4: ตรวจว่า import กันได้ + lint ผ่าน**

Run: `npm run lint`
Expected: ไม่มี error ใหม่จากไฟล์ที่เพิ่ม (warning เดิมของ repo ไม่นับ)

- [ ] **Step 2.5: Commit**

```bash
git add models/smart-school/SchoolApplicant.js models/smart-school/SchoolApplication.js lib/smart-school/applicationId.js
git commit -m "feat(smart-school): models บุคคล+ใบสมัครรายปี และตัวออกเลขใบสมัคร atomic"
```

---

### Task 3: n8n notifier

**Files:**
- Create: `lib/smart-school/notify.js`

- [ ] **Step 3.1: เขียน `lib/smart-school/notify.js`**

หมายเหตุ: field ของ `data` ถูก spread ขึ้น top-level ของ payload เพื่อให้ n8n เข้าถึงแบบ `$json.body.name` ตรงกับ expression ใน workflow เดิม

```js
// lib/smart-school/notify.js
// แจ้งเตือน n8n webhook (→ Telegram) — fire-and-forget ไม่ block API response
// ENV: N8N_SCHOOL_WEBHOOK_URL (ไม่ตั้ง = ใช้ URL webhook sm-school เดิมของ workflow "Api All")

const WEBHOOK_URL =
  process.env.N8N_SCHOOL_WEBHOOK_URL ||
  "https://primary-production-a1769.up.railway.app/webhook/sm-school";

const HEADERS = {
  "school.submitted": "📚 รายใหม่ — สำรวจข้อมูลการศึกษา TAKHLI-SCHOOL",
  "school.renewal_updated": "🔄 รายเก่า update ข้อมูล — TAKHLI-SCHOOL",
  "school.images_changed": "🖼️ เปลี่ยนรูปภาพ — TAKHLI-SCHOOL",
};

/**
 * @param {"school.submitted"|"school.renewal_updated"|"school.images_changed"} event
 * @param {{applicationId?: string, surveyYear?: number, name?: string, educationLevel?: string,
 *          phone?: string, address?: string, note?: string, image?: string[],
 *          location?: {lat:number,lng:number}}} data
 */
export async function notifySchoolEvent(event, data) {
  if (!WEBHOOK_URL) return false;
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        header: HEADERS[event] || HEADERS["school.submitted"],
        appId: process.env.NEXT_PUBLIC_APP_ID || "smart-takhli",
        timestamp: new Date().toISOString(),
        ...data,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[n8n school] webhook failed: ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[n8n school] webhook error for "${event}":`, err?.message || err);
    return false;
  }
}
```

- [ ] **Step 3.2: Lint + Commit**

```bash
npm run lint
git add lib/smart-school/notify.js
git commit -m "feat(smart-school): n8n notifier 3 events (submitted/renewal_updated/images_changed)"
```

---

### Task 4: Migration script (idempotent + dry-run)

**Files:**
- Create: `scripts/migrate-education-to-smart-school.js`

ใช้ raw collection ทั้งหมด (ไม่ import model — สคริปต์ต้องรันได้แม้ model เก่าถูกลบใน Task 17) เขียนแบบ CJS ตาม pattern `scripts/grant-elderly-school-permission.js`

- [ ] **Step 4.1: เขียนสคริปต์**

```js
// One-time migration: educationregisters (238 รายการ ปีงบ 2568)
//   → school_applicants + school_applications
//
// - ไม่แตะ collection เดิม (เก็บเป็น backup ถาวร)
// - idempotent: ยึด legacyId — รันซ้ำจะข้ามรายการที่ย้ายแล้ว
// - applicationId ใช้ TKC-xxx เดิม (เจ้าหน้าที่คุ้นเลขนี้) ถ้าซ้ำกันเองต่อท้าย -dupN
//
// วิธีรัน:
//   node --env-file=.env.local scripts/migrate-education-to-smart-school.js --dry-run
//   node --env-file=.env.local scripts/migrate-education-to-smart-school.js

const mongoose = require("mongoose");

const LEGACY_YEAR = 2568; // ข้อมูลเดิมสร้าง ก.ค.–ส.ค. 2025 = ปีงบ 2568

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local");
  }
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const oldDocs = await db
    .collection("educationregisters")
    .find({})
    .sort({ createdAt: 1 })
    .toArray();
  console.log(`พบข้อมูลเดิม ${oldDocs.length} รายการ`);

  const usedAppIds = new Set(
    (await db.collection("school_applications").find({}, { projection: { applicationId: 1 } }).toArray()).map(
      (d) => d.applicationId
    )
  );

  let created = 0;
  let skipped = 0;
  const samples = [];

  for (const doc of oldDocs) {
    const already = await db.collection("school_applicants").findOne({ legacyId: doc._id });
    if (already) {
      skipped++;
      continue;
    }

    const baseAppId = doc.applicantId || `TKC68-${String(created + 1).padStart(3, "0")}`;
    let applicationId = baseAppId;
    let n = 2;
    while (usedAppIds.has(applicationId)) applicationId = `${baseAppId}-dup${n++}`;
    usedAppIds.add(applicationId);

    const now = new Date();
    const applicant = {
      // จงใจไม่ใส่ฟิลด์ citizenId เลย — unique sparse index จะได้ไม่ชนกัน
      prefix: doc.prefix || "",
      name: doc.name || "(ไม่มีชื่อ)",
      phone: doc.phone || "",
      legacyApplicantId: doc.applicantId || null,
      legacyId: doc._id,
      createdAt: doc.createdAt || now,
      updatedAt: now,
    };
    const application = {
      surveyYear: LEGACY_YEAR,
      applicationId,
      educationLevel: doc.educationLevel || "",
      schoolName: doc.schoolName || "",
      gradeLevel: doc.gradeLevel || "",
      gpa: typeof doc.gpa === "number" ? doc.gpa : null,
      address: doc.address || "",
      actualAddress: doc.actualAddress || "",
      housingStatus: doc.housingStatus || "ไม่ระบุ",
      householdMembers: doc.householdMembers || 1,
      annualIncome: doc.annualIncome || 0,
      incomeSource: doc.incomeSource || [],
      familyStatus: doc.familyStatus || [],
      receivedScholarship: doc.receivedScholarship || [],
      takhliScholarshipHistory: doc.takhliScholarshipHistory || [],
      note: doc.note || "",
      imageUrl: Array.isArray(doc.imageUrl) ? doc.imageUrl.slice(0, 3) : [],
      location: doc.location || null,
      status: "ตรวจสอบแล้ว", // ข้อมูลปีเก่าถือว่าผ่านกระบวนการแล้ว
      statusUpdatedBy: "migration",
      statusUpdatedAt: now,
      isRenewal: false,
      createdAt: doc.createdAt || now,
      updatedAt: now,
    };

    if (samples.length < 3) samples.push({ applicant, application });

    if (!dryRun) {
      const { insertedId } = await db.collection("school_applicants").insertOne(applicant);
      await db.collection("school_applications").insertOne({ ...application, applicantRef: insertedId });
    }
    created++;
  }

  console.log(`สร้างใหม่ ${created} / ข้ามที่ย้ายแล้ว ${skipped}${dryRun ? " (--dry-run ยังไม่เขียนจริง)" : ""}`);
  console.log("ตัวอย่าง 3 รายการแรก:", JSON.stringify(samples, null, 2).slice(0, 2000));

  if (!dryRun) {
    const a = await db.collection("school_applicants").countDocuments();
    const b = await db.collection("school_applications").countDocuments({ surveyYear: LEGACY_YEAR });
    console.log(`ยอดหลัง migrate: applicants=${a}, applications(${LEGACY_YEAR})=${b} (ต้อง ≥ ${oldDocs.length})`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4.2: รัน dry-run กับฐานจริง (อ่านอย่างเดียว)**

Run: `node --env-file=.env.local scripts/migrate-education-to-smart-school.js --dry-run`
Expected: `พบข้อมูลเดิม 238 รายการ` และ `สร้างใหม่ 238 / ข้ามที่ย้ายแล้ว 0 (--dry-run ยังไม่เขียนจริง)` + ตัวอย่าง 3 รายการ mapping ถูกช่อง (**ห้ามรันแบบไม่มี --dry-run ใน task นี้** — รันจริงตอน cutover Task 18)

- [ ] **Step 4.3: Commit**

```bash
git add scripts/migrate-education-to-smart-school.js
git commit -m "feat(smart-school): migration script educationregisters → บุคคล+ใบสมัคร (idempotent, dry-run)"
```

---

### Task 5: API public — lookup

**Files:**
- Create: `pages/api/smart-school/lookup.js`

- [ ] **Step 5.1: เขียน handler**

กติกา PDPA: endpoint นี้คืนได้เฉพาะ `ref` + ชื่อมาสก์ + ปีล่าสุดที่ยื่น — ห้ามคืนฟิลด์อื่น และการค้นด้วยชื่อคืนเฉพาะ record ที่**ยังไม่ผูกเลขบัตร**

```js
import dbConnect from "@/lib/dbConnect";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import { isValidCitizenId } from "@/lib/smart-school/citizenId";
import { maskName } from "@/lib/smart-school/mask";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function toMasked(applicant) {
  const latest = await SchoolApplication.findOne({ applicantRef: applicant._id })
    .sort({ surveyYear: -1 })
    .select("surveyYear")
    .lean();
  return {
    ref: String(applicant._id),
    maskedName: maskName(applicant.name),
    lastYear: latest?.surveyYear || null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  await dbConnect();
  const { citizenId, name } = req.body || {};

  // โหมด 1: ค้นด้วยเลขบัตรตรง ๆ
  if (citizenId) {
    if (!isValidCitizenId(citizenId)) {
      return res.status(400).json({ message: "เลขบัตรประชาชนไม่ถูกต้อง" });
    }
    const applicant = await SchoolApplicant.findOne({ citizenId }).lean();
    if (!applicant) return res.status(200).json({ found: false });
    return res.status(200).json({ found: true, result: await toMasked(applicant) });
  }

  // โหมด 2: ค้นด้วยชื่อ — เฉพาะ record ที่ยังไม่ถูกผูกเลขบัตร
  // (record ที่ผูกเลขแล้วต้องเข้าถึงด้วยเลขตรงเท่านั้น — ปิดช่อง claim ของคนอื่น)
  if (name && String(name).trim().length >= 2) {
    const applicants = await SchoolApplicant.find({
      $or: [{ citizenId: { $exists: false } }, { citizenId: null }],
      name: { $regex: escapeRegex(String(name).trim()), $options: "i" },
    })
      .limit(5)
      .lean();
    const results = await Promise.all(applicants.map(toMasked));
    return res.status(200).json({ found: results.length > 0, results });
  }

  return res.status(400).json({ message: "ต้องระบุ citizenId หรือ name (≥2 ตัวอักษร)" });
}
```

- [ ] **Step 5.2: Lint + Commit**

```bash
npm run lint
git add pages/api/smart-school/lookup.js
git commit -m "feat(smart-school): API lookup — ค้นเลขบัตร/ชื่อ คืนผลมาสก์ (public)"
```

---

### Task 6: API public — verify (+ ผูกเลขบัตรให้ record เก่า)

**Files:**
- Create: `pages/api/smart-school/verify.js`

- [ ] **Step 6.1: เขียน handler**

สองเส้นทาง: (A) `{ citizenId }` — เลขตรงกับ record ที่ผูกแล้ว → คืนข้อมูลเต็ม; (B) `{ applicantRef, citizenId }` — จากการค้นชื่อ → ผูกเลขให้ record ที่ยังไม่มี แล้วคืนข้อมูลเต็ม

```js
import dbConnect from "@/lib/dbConnect";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import { isValidCitizenId } from "@/lib/smart-school/citizenId";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  await dbConnect();
  const { citizenId, applicantRef } = req.body || {};

  if (!isValidCitizenId(citizenId || "")) {
    return res.status(400).json({ message: "เลขบัตรประชาชนไม่ถูกต้อง" });
  }

  let applicant;
  if (applicantRef) {
    // เส้นทาง B: มาจากการค้นชื่อ — ผูกเลขบัตรให้ record เก่า
    applicant = await SchoolApplicant.findById(applicantRef);
    if (!applicant) return res.status(404).json({ message: "ไม่พบข้อมูล" });
    if (applicant.citizenId && applicant.citizenId !== citizenId) {
      return res.status(403).json({
        message: "รายการนี้ถูกผูกเลขบัตรแล้ว กรุณาค้นด้วยเลขบัตรของท่านโดยตรง",
      });
    }
    const dup = await SchoolApplicant.findOne({
      citizenId,
      _id: { $ne: applicant._id },
    }).lean();
    if (dup) {
      return res.status(409).json({
        message: "เลขบัตรนี้ถูกใช้กับรายการอื่นแล้ว หากข้อมูลไม่ถูกต้องกรุณาติดต่อเจ้าหน้าที่",
      });
    }
    if (!applicant.citizenId) {
      applicant.citizenId = citizenId;
      await applicant.save();
    }
  } else {
    // เส้นทาง A: เลขบัตรตรงกับ record ที่ผูกแล้ว (การรู้เลขเต็ม = ผ่านการยืนยัน)
    applicant = await SchoolApplicant.findOne({ citizenId });
    if (!applicant) return res.status(404).json({ message: "ไม่พบข้อมูล" });
  }

  const latest = await SchoolApplication.findOne({ applicantRef: applicant._id })
    .sort({ surveyYear: -1 })
    .lean();

  return res.status(200).json({
    applicant: {
      ref: String(applicant._id),
      prefix: applicant.prefix,
      name: applicant.name,
      phone: applicant.phone,
      citizenId: applicant.citizenId,
    },
    application: latest, // ข้อมูลเต็มปีล่าสุดสำหรับ prefill (ผ่านการยืนยันแล้ว)
  });
}
```

- [ ] **Step 6.2: Lint + Commit**

```bash
npm run lint
git add pages/api/smart-school/verify.js
git commit -m "feat(smart-school): API verify — ยืนยันเลข 13 หลัก + ผูกเลขให้ record เก่า"
```

---

### Task 7: API public — submit (+ n8n รายใหม่/รายเก่า)

**Files:**
- Create: `pages/api/smart-school/submit.js`

- [ ] **Step 7.1: เขียน handler**

`isRenewal` ตัดสินฝั่ง server (มีใบสมัครปีก่อนหน้า) — ไม่เชื่อ client; ยื่นซ้ำปีเดียวกัน = update ใบเดิม + สถานะกลับเป็น "รับคำร้อง"

```js
import dbConnect from "@/lib/dbConnect";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import { isValidCitizenId } from "@/lib/smart-school/citizenId";
import { getFiscalYearBE } from "@/lib/smart-school/fiscalYear";
import { nextApplicationId } from "@/lib/smart-school/applicationId";
import { notifySchoolEvent } from "@/lib/smart-school/notify";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    await dbConnect();
    const {
      citizenId, prefix, fullName, phone, educationLevel,
      address, note, housingStatus, householdMembers, annualIncome,
      image, location,
    } = req.body || {};

    if (!isValidCitizenId(citizenId || "")) {
      return res.status(400).json({ message: "เลขบัตรประชาชนไม่ถูกต้อง" });
    }
    if (!fullName || !Array.isArray(image) || image.length === 0 || !location?.lat) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["fullName", "image", "location.lat"],
      });
    }

    // หา/สร้างทะเบียนบุคคล + อัปเดตข้อมูลติดต่อล่าสุด
    let applicant = await SchoolApplicant.findOne({ citizenId });
    const isNewApplicant = !applicant;
    if (isNewApplicant) {
      applicant = await SchoolApplicant.create({
        citizenId,
        prefix: prefix || "",
        name: fullName,
        phone: phone || "",
      });
    } else {
      applicant.prefix = prefix || applicant.prefix;
      applicant.name = fullName;
      applicant.phone = phone || applicant.phone;
      await applicant.save();
    }

    const surveyYear = getFiscalYearBE();
    const isRenewal =
      !isNewApplicant &&
      !!(await SchoolApplication.exists({
        applicantRef: applicant._id,
        surveyYear: { $lt: surveyYear },
      }));

    const fields = {
      educationLevel: educationLevel || "",
      address: address || "",
      note: note || "",
      housingStatus: housingStatus || "ไม่ระบุ",
      householdMembers: parseInt(householdMembers) || 1,
      annualIncome: parseInt(annualIncome) || 0,
      imageUrl: image.slice(0, 3),
      location: { lat: location.lat, lng: location.lng },
      status: "รับคำร้อง",
      statusUpdatedBy: "",
      statusUpdatedAt: null,
      isRenewal,
    };

    let application = await SchoolApplication.findOne({
      applicantRef: applicant._id,
      surveyYear,
    });
    if (application) {
      Object.assign(application, fields);
      await application.save();
    } else {
      application = await SchoolApplication.create({
        applicantRef: applicant._id,
        surveyYear,
        applicationId: await nextApplicationId(surveyYear),
        ...fields,
      });
    }

    await notifySchoolEvent(
      isRenewal ? "school.renewal_updated" : "school.submitted",
      {
        applicationId: application.applicationId,
        surveyYear,
        name: `${prefix || ""} ${fullName}`.trim(),
        educationLevel: educationLevel || "",
        phone: phone || "",
        address: address || "",
        note: note || "",
        image: image.slice(0, 3),
        location,
      }
    );

    return res.status(200).json({
      message: "Success",
      id: application._id,
      applicationId: application.applicationId,
      isRenewal,
    });
  } catch (err) {
    console.error("❌ smart-school submit error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
}
```

- [ ] **Step 7.2: Lint + Commit**

```bash
npm run lint
git add pages/api/smart-school/submit.js
git commit -m "feat(smart-school): API submit — ใบสมัครปีปัจจุบัน + n8n รายใหม่/รายเก่า"
```

---

### Task 8: API admin — _auth + list (พร้อม flags ครัวเรือน)

**Files:**
- Create: `pages/api/smart-school/_auth.js`
- Create: `pages/api/smart-school/list.js`

- [ ] **Step 8.1: เขียน `_auth.js`** (pattern เดียวกับ `pages/api/pm25/_auth.js` เปลี่ยนเฉพาะ REQUIRED_PAGE + ชื่อฟังก์ชัน)

```js
import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";
const REQUIRED_PAGE = "/admin/smart-school";

export async function requireSchoolAdmin(req) {
  const { userId } = getAuth(req);
  if (!userId) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const role = clerkUser.publicMetadata?.role || "admin";
  const isSuperAdmin = role === "superadmin";

  if (isSuperAdmin) {
    return {
      ok: true,
      userId,
      role,
      isSuperAdmin: true,
      name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim(),
    };
  }

  await dbConnect();
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
  const mongoUser = await User.findOne({ clerkId: userId }).lean();

  if (!mongoUser) {
    return { ok: false, status: 403, message: "User not registered" };
  }
  if (!mongoUser.appId || mongoUser.appId !== CURRENT_APP_ID) {
    return { ok: false, status: 403, message: "No app access" };
  }

  const allowed = Array.isArray(mongoUser.allowedPages) ? mongoUser.allowedPages : [];
  const hasPageAccess = allowed.length === 0 || allowed.includes(REQUIRED_PAGE);
  if (!hasPageAccess) {
    return { ok: false, status: 403, message: "No page access" };
  }

  return {
    ok: true,
    userId,
    role: mongoUser.role || role,
    isSuperAdmin: false,
    name: mongoUser.name || `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim(),
  };
}
```

- [ ] **Step 8.2: เขียน `list.js`**

Flags: `prevYearAwarded` (คนนี้ได้ทุนปีที่แล้ว), `householdKey` (จัดกลุ่มด้วยเบอร์ตรงกันหรือที่อยู่ตรงกันทั้งข้อความ), `householdAwardedOther` (คนอื่นในกลุ่มได้ทุนปีนี้แล้ว)

```js
import dbConnect from "@/lib/dbConnect";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import "@/models/smart-school/SchoolApplicant"; // ให้ mongoose รู้จัก model ก่อน populate
import { getFiscalYearBE } from "@/lib/smart-school/fiscalYear";
import { requireSchoolAdmin } from "./_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  const auth = await requireSchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  await dbConnect();
  const year = parseInt(req.query.year) || getFiscalYearBE();

  const [apps, yearsRaw, prevAwarded] = await Promise.all([
    SchoolApplication.find({ surveyYear: year })
      .populate("applicantRef")
      .sort({ createdAt: -1 })
      .lean(),
    SchoolApplication.distinct("surveyYear"),
    SchoolApplication.find({ surveyYear: year - 1, status: "ได้รับทุน" })
      .select("applicantRef")
      .lean(),
  ]);

  const prevAwardedSet = new Set(prevAwarded.map((a) => String(a.applicantRef)));

  // จัดกลุ่มครัวเรือน: key = เบอร์โทร (p:) หรือที่อยู่ตรงกันทั้งข้อความ (a:)
  const keysOf = (app) => {
    const phone = (app.applicantRef?.phone || "").trim();
    const addr = (app.address || "").trim();
    return [phone && `p:${phone}`, addr && `a:${addr}`].filter(Boolean);
  };
  const groups = {};
  for (const app of apps) {
    for (const key of keysOf(app)) (groups[key] = groups[key] || []).push(app);
  }

  const applications = apps.map((app) => {
    const keys = keysOf(app);
    const mates = new Map();
    for (const k of keys) {
      for (const m of groups[k] || []) {
        if (String(m._id) !== String(app._id)) mates.set(String(m._id), m);
      }
    }
    const a = app.applicantRef || {};
    return {
      ...app,
      applicantRef: String(a._id || app.applicantRef),
      prefix: a.prefix || "",
      name: a.name || "",
      phone: a.phone || "",
      citizenId: a.citizenId || null,
      flags: {
        prevYearAwarded: prevAwardedSet.has(String(a._id)),
        householdKey: keys.find((k) => (groups[k] || []).length >= 2) || null,
        householdAwardedOther: [...mates.values()].some((m) => m.status === "ได้รับทุน"),
      },
    };
  });

  const stats = {
    total: applications.length,
    renewals: applications.filter((r) => r.isRenewal).length,
    byStatus: applications.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {}),
  };

  return res.status(200).json({
    year,
    years: yearsRaw.sort((x, y) => y - x),
    applications,
    stats,
  });
}
```

- [ ] **Step 8.3: Lint + Commit**

```bash
npm run lint
git add pages/api/smart-school/_auth.js pages/api/smart-school/list.js
git commit -m "feat(smart-school): API admin list + auth helper (flags กติกาครัวเรือน)"
```

---

### Task 9: API admin — update / status / delete

**Files:**
- Create: `pages/api/smart-school/update.js`
- Create: `pages/api/smart-school/status.js`
- Create: `pages/api/smart-school/delete.js`

- [ ] **Step 9.1: เขียน `update.js`** (แก้บั๊กเดิม: รับ `imageUrl` แล้วบันทึกจริง + แจ้ง n8n เมื่อรูปเปลี่ยน; backfill เลขบัตรผ่าน endpoint นี้)

```js
import dbConnect from "@/lib/dbConnect";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import { isValidCitizenId } from "@/lib/smart-school/citizenId";
import { notifySchoolEvent } from "@/lib/smart-school/notify";
import { requireSchoolAdmin } from "./_auth";

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  const auth = await requireSchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  try {
    await dbConnect();
    const {
      _id, citizenId, prefix, name, phone,
      educationLevel, schoolName, gradeLevel, gpa,
      address, actualAddress, housingStatus, householdMembers, annualIncome,
      incomeSource, familyStatus, receivedScholarship, takhliScholarshipHistory,
      note, imageUrl, location,
    } = req.body || {};

    if (!_id) return res.status(400).json({ message: "Missing _id" });

    const application = await SchoolApplication.findById(_id);
    if (!application) return res.status(404).json({ message: "Record not found" });
    const applicant = await SchoolApplicant.findById(application.applicantRef);
    if (!applicant) return res.status(404).json({ message: "Applicant not found" });

    // --- ข้อมูลบุคคล (รวม backfill เลขบัตรให้รายเก่า) ---
    if (citizenId !== undefined && citizenId !== null && citizenId !== "" &&
        citizenId !== applicant.citizenId) {
      if (!isValidCitizenId(citizenId)) {
        return res.status(400).json({ message: "เลขบัตรประชาชนไม่ถูกต้อง" });
      }
      const dup = await SchoolApplicant.findOne({ citizenId, _id: { $ne: applicant._id } }).lean();
      if (dup) {
        return res.status(409).json({ message: "เลขบัตรนี้ถูกใช้กับบุคคลอื่นแล้ว" });
      }
      applicant.citizenId = citizenId;
    }
    if (prefix !== undefined) applicant.prefix = prefix;
    if (name) applicant.name = name;
    if (phone !== undefined) applicant.phone = phone;
    await applicant.save();

    // --- ข้อมูลใบสมัคร ---
    const before = JSON.stringify(application.imageUrl || []);
    const assign = {
      educationLevel, schoolName, gradeLevel,
      address, actualAddress, housingStatus, note,
    };
    for (const [k, v] of Object.entries(assign)) {
      if (v !== undefined) application[k] = v;
    }
    if (gpa !== undefined) application.gpa = gpa === null || gpa === "" ? null : parseFloat(gpa);
    if (householdMembers !== undefined) application.householdMembers = parseInt(householdMembers) || 1;
    if (annualIncome !== undefined) application.annualIncome = parseInt(annualIncome) || 0;
    if (Array.isArray(incomeSource)) application.incomeSource = incomeSource;
    if (Array.isArray(familyStatus)) application.familyStatus = familyStatus;
    if (Array.isArray(receivedScholarship)) application.receivedScholarship = receivedScholarship;
    if (Array.isArray(takhliScholarshipHistory)) application.takhliScholarshipHistory = takhliScholarshipHistory;
    if (Array.isArray(imageUrl)) application.imageUrl = imageUrl.slice(0, 3);
    if (location?.lat) application.location = { lat: location.lat, lng: location.lng };
    await application.save();

    const imagesChanged = JSON.stringify(application.imageUrl || []) !== before;
    if (imagesChanged) {
      await notifySchoolEvent("school.images_changed", {
        applicationId: application.applicationId,
        surveyYear: application.surveyYear,
        name: `${applicant.prefix || ""} ${applicant.name}`.trim(),
        educationLevel: application.educationLevel,
        phone: applicant.phone,
        address: application.address,
        note: `แก้ไขรูปโดย ${auth.name || "แอดมิน"}`,
        image: application.imageUrl,
        location: application.location,
      });
    }

    return res.status(200).json({ message: "Updated successfully", imagesChanged });
  } catch (err) {
    console.error("❌ smart-school update error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
}
```

- [ ] **Step 9.2: เขียน `status.js`**

```js
import dbConnect from "@/lib/dbConnect";
import SchoolApplication, { APPLICATION_STATUSES } from "@/models/smart-school/SchoolApplication";
import { requireSchoolAdmin } from "./_auth";

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  const auth = await requireSchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  await dbConnect();
  const { _id, status } = req.body || {};
  if (!_id || !APPLICATION_STATUSES.includes(status)) {
    return res.status(400).json({ message: "ต้องระบุ _id และ status ที่ถูกต้อง" });
  }

  const application = await SchoolApplication.findByIdAndUpdate(
    _id,
    { status, statusUpdatedBy: auth.name || "แอดมิน", statusUpdatedAt: new Date() },
    { new: true }
  );
  if (!application) return res.status(404).json({ message: "Record not found" });

  return res.status(200).json({ message: "Status updated", status: application.status });
}
```

- [ ] **Step 9.3: เขียน `delete.js`** (ลบใบสมัคร — ใช้เก็บกวาดรายการซ้ำ; ถ้าบุคคลไม่เหลือใบสมัครให้ลบทะเบียนบุคคลด้วย)

```js
import dbConnect from "@/lib/dbConnect";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import { requireSchoolAdmin } from "./_auth";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  const auth = await requireSchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  await dbConnect();
  const _id = req.body?._id || req.query?._id;
  if (!_id) return res.status(400).json({ message: "Missing _id" });

  const application = await SchoolApplication.findByIdAndDelete(_id);
  if (!application) return res.status(404).json({ message: "Record not found" });

  const remaining = await SchoolApplication.countDocuments({
    applicantRef: application.applicantRef,
  });
  let applicantDeleted = false;
  if (remaining === 0) {
    await SchoolApplicant.findByIdAndDelete(application.applicantRef);
    applicantDeleted = true;
  }

  return res.status(200).json({ message: "Deleted", applicantDeleted });
}
```

- [ ] **Step 9.4: Lint + Commit**

```bash
npm run lint
git add pages/api/smart-school/update.js pages/api/smart-school/status.js pages/api/smart-school/delete.js
git commit -m "feat(smart-school): API admin update/status/delete (รูปบันทึกจริง + n8n images_changed)"
```

---

### Task 10: ฟอร์ม wizard — IdentityStep (ขั้น 1)

**Files:**
- Create: `components/smart-school/survey/IdentityStep.jsx`

- [ ] **Step 10.1: เขียน component**

Props: `onDone({ citizenId, applicant, prevApplication })` — เรียกเมื่อระบุตัวตนเสร็จ (รายใหม่: applicant/prevApplication เป็น null), `disabled`

```jsx
import React, { useState } from 'react';
import { isValidCitizenId } from '@/lib/smart-school/citizenId';

// ขั้นที่ 1: ระบุตัวตน — เลข 13 หลักคือ credential (ไม่ใช้เบอร์โทร
// เพราะหลายคนในบ้านใช้เบอร์ร่วมกัน แยกตัวบุคคลไม่ได้)
export default function IdentityStep({ onDone, disabled }) {
  const [mode, setMode] = useState(null); // 'new' | 'renewal'
  const [citizenId, setCitizenId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookupState, setLookupState] = useState(null); // null | 'notfound' | { result }
  const [searchName, setSearchName] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null | []
  const [selectedRef, setSelectedRef] = useState(null);

  const idValid = isValidCitizenId(citizenId);

  const post = async (url, body) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  };

  // รายเก่า: ค้นด้วยเลขบัตร
  const handleLookupById = async () => {
    setError('');
    setLoading(true);
    const { ok, data } = await post('/api/smart-school/lookup', { citizenId });
    setLoading(false);
    if (!ok) return setError(data.message || 'เกิดข้อผิดพลาด');
    setLookupState(data.found ? { result: data.result } : 'notfound');
  };

  // เจอด้วยเลขบัตร → ผู้ใช้กดยืนยัน "ใช่ฉัน" → ดึงข้อมูลเต็ม
  const handleConfirmSelf = async () => {
    setError('');
    setLoading(true);
    const { ok, data } = await post('/api/smart-school/verify', { citizenId });
    setLoading(false);
    if (!ok) return setError(data.message || 'ยืนยันไม่สำเร็จ');
    onDone({ citizenId, applicant: data.applicant, prevApplication: data.application });
  };

  // ไม่เจอ → ค้นชื่อ (เฉพาะ record ที่ยังไม่ผูกเลขบัตร)
  const handleSearchName = async () => {
    setError('');
    setLoading(true);
    const { ok, data } = await post('/api/smart-school/lookup', { name: searchName });
    setLoading(false);
    if (!ok) return setError(data.message || 'เกิดข้อผิดพลาด');
    setSearchResults(data.results || []);
  };

  // เลือกรายการจากการค้นชื่อ → ผูกเลขบัตรของตนให้ record นั้น
  const handleClaim = async () => {
    setError('');
    setLoading(true);
    const { ok, data } = await post('/api/smart-school/verify', {
      citizenId,
      applicantRef: selectedRef,
    });
    setLoading(false);
    if (!ok) return setError(data.message || 'ยืนยันไม่สำเร็จ');
    onDone({ citizenId, applicant: data.applicant, prevApplication: data.application });
  };

  const handleNewApplicant = async () => {
    setError('');
    // กันเลขซ้ำ: ถ้าเลขนี้มีในระบบแล้ว พาเข้าเส้นทางรายเก่า
    setLoading(true);
    const { ok, data } = await post('/api/smart-school/lookup', { citizenId });
    setLoading(false);
    if (ok && data.found) {
      setMode('renewal');
      setLookupState({ result: data.result });
      setError('เลขบัตรนี้เคยยื่นแล้ว — ระบบพาเข้าเส้นทางรายเก่าให้');
      return;
    }
    onDone({ citizenId, applicant: null, prevApplication: null });
  };

  return (
    <div className="space-y-4">
      <div className="alert alert-info text-xs">
        ทุนพิจารณา 1 คนต่อครัวเรือนต่อปี และหมุนเวียนผู้รับในปีถัดไป
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">ท่านเคยยื่นแบบสำรวจนี้มาก่อนหรือไม่</label>
        <div className="flex gap-2 justify-center">
          <button type="button" disabled={disabled}
            className={`btn btn-sm rounded-full flex-1 ${mode === 'new' ? 'btn-info' : 'btn-outline'}`}
            onClick={() => { setMode('new'); setLookupState(null); setError(''); }}>
            รายใหม่ (ครั้งแรก)
          </button>
          <button type="button" disabled={disabled}
            className={`btn btn-sm rounded-full flex-1 ${mode === 'renewal' ? 'btn-info' : 'btn-outline'}`}
            onClick={() => { setMode('renewal'); setLookupState(null); setError(''); }}>
            รายเก่า (เคยยื่นแล้ว)
          </button>
        </div>
      </div>

      {mode && (
        <div className="space-y-2">
          <label className="font-extrabold text-sm text-gray-600">เลขบัตรประชาชน 13 หลัก</label>
          <input type="tel" className="input input-bordered w-full" maxLength={13}
            placeholder="กรอกเลขบัตรประชาชน 13 หลัก" value={citizenId} disabled={disabled}
            onChange={(e) => {
              setCitizenId(e.target.value.replace(/\D/g, ''));
              setLookupState(null);
              setError('');
            }} />
          {citizenId.length === 13 && !idValid && (
            <p className="text-xs text-error">เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบ</p>
          )}
        </div>
      )}

      {mode === 'new' && (
        <button type="button" className="btn btn-primary w-full" disabled={!idValid || loading || disabled}
          onClick={handleNewApplicant}>
          {loading ? <span className="loading loading-spinner loading-sm" /> : 'ถัดไป'}
        </button>
      )}

      {mode === 'renewal' && !lookupState && (
        <button type="button" className="btn btn-primary w-full" disabled={!idValid || loading || disabled}
          onClick={handleLookupById}>
          {loading ? <span className="loading loading-spinner loading-sm" /> : 'ค้นหาข้อมูลเดิม'}
        </button>
      )}

      {mode === 'renewal' && lookupState && lookupState !== 'notfound' && (
        <div className="card bg-base-200 p-3 space-y-2">
          <p className="text-sm">
            พบข้อมูลของ <span className="font-bold">{lookupState.result.maskedName}</span>
            {lookupState.result.lastYear ? ` (ยื่นล่าสุดปีงบ ${lookupState.result.lastYear})` : ''}
          </p>
          <button type="button" className="btn btn-success btn-sm w-full" disabled={loading || disabled}
            onClick={handleConfirmSelf}>
            ใช่ ข้อมูลของฉัน — ดึงข้อมูลเดิมมาแก้ไข
          </button>
        </div>
      )}

      {mode === 'renewal' && lookupState === 'notfound' && (
        <div className="card bg-base-200 p-3 space-y-2">
          <p className="text-sm">ไม่พบเลขบัตรนี้ในระบบ — ข้อมูลปีก่อนอาจยังไม่ถูกผูกเลขบัตร ลองค้นด้วยชื่อ-นามสกุล</p>
          <div className="flex gap-2">
            <input type="text" className="input input-bordered input-sm flex-1"
              placeholder="ชื่อ-นามสกุลที่เคยยื่น" value={searchName} disabled={disabled}
              onChange={(e) => setSearchName(e.target.value)} />
            <button type="button" className="btn btn-sm btn-primary"
              disabled={searchName.trim().length < 2 || loading || disabled}
              onClick={handleSearchName}>ค้นหา</button>
          </div>

          {searchResults && searchResults.length > 0 && (
            <div className="space-y-1">
              {searchResults.map((r) => (
                <label key={r.ref} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" className="radio radio-sm" name="claim"
                    checked={selectedRef === r.ref} onChange={() => setSelectedRef(r.ref)} />
                  {r.maskedName}{r.lastYear ? ` (ปีงบ ${r.lastYear})` : ''}
                </label>
              ))}
              <button type="button" className="btn btn-success btn-sm w-full"
                disabled={!selectedRef || loading || disabled} onClick={handleClaim}>
                ใช่ ข้อมูลของฉัน — ผูกเลขบัตรและดึงข้อมูลเดิม
              </button>
            </div>
          )}
          {searchResults && searchResults.length === 0 && (
            <p className="text-xs text-gray-500">ไม่พบรายการ</p>
          )}

          <button type="button" className="btn btn-outline btn-sm w-full" disabled={!idValid || loading || disabled}
            onClick={handleNewApplicant}>
            หาไม่เจอ — ยื่นเป็นรายใหม่
          </button>
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 10.2: Lint + Commit**

```bash
npm run lint
git add components/smart-school/survey/IdentityStep.jsx
git commit -m "feat(smart-school): IdentityStep — รายใหม่/รายเก่า lookup+verify ด้วยเลข 13 หลัก"
```

---

### Task 11: ฟอร์ม wizard — InfoStep + MediaStep (ขั้น 2-3)

**Files:**
- Create: `components/smart-school/survey/InfoStep.jsx`
- Create: `components/smart-school/survey/MediaStep.jsx`

- [ ] **Step 11.1: เขียน `InfoStep.jsx`** (ฟิลด์ชุดเดียวกับฟอร์มสาธารณะเดิม + hint ค่าเดิมปีที่แล้วเมื่อเป็นรายเก่า)

```jsx
import React from 'react';

// hint แสดงค่าเดิมของปีที่แล้ว (เฉพาะรายเก่า)
function PrevHint({ year, value }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <p className="text-xs text-amber-600">ข้อมูลเดิมปี {year}: {String(value)}</p>
  );
}

// ขั้นที่ 2: ข้อมูลผู้ขอ — formData/setFormData ถือ state ที่ orchestrator
export default function InfoStep({ formData, setFormData, prevApplication, prevYear, disabled }) {
  const set = (patch) => setFormData({ ...formData, ...patch });
  const prev = prevApplication || {};

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">ระดับการศึกษา</label>
        <div className="flex flex-wrap gap-2 justify-center">
          {['อนุบาล', 'ประถม', 'มัธยมต้น', 'มัธยมปลาย', 'ปวช', 'ปวส', 'ปริญญาตรี'].map((level) => (
            <button key={level} type="button" disabled={disabled}
              className={`btn btn-sm rounded-full ${formData.educationLevel === level ? 'btn-info' : 'btn-outline'}`}
              onClick={() => set({ educationLevel: level })}>
              {level}
            </button>
          ))}
        </div>
        <PrevHint year={prevYear} value={prev.educationLevel} />
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">1. คำนำหน้า</label>
        <div className="flex flex-wrap gap-2 justify-center">
          {['ด.ช.', 'ด.ญ.', 'นาย', 'นางสาว'].map((prefix) => (
            <button key={prefix} type="button" disabled={disabled}
              className={`btn btn-sm rounded-full ${formData.prefix === prefix ? 'btn-info' : 'btn-outline'}`}
              onClick={() => set({ prefix })}>
              {prefix}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">2. ชื่อ-นามสกุล</label>
        <input type="text" placeholder="ชื่อ-นามสกุล" value={formData.fullName} disabled={disabled}
          onChange={(e) => set({ fullName: e.target.value })}
          className="input input-bordered w-full" />
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">3. ที่อยู่</label>
        <textarea placeholder="ที่อยู่" value={formData.address} disabled={disabled}
          onChange={(e) => set({ address: e.target.value })}
          className="textarea textarea-bordered w-full" />
        <PrevHint year={prevYear} value={prev.address} />
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">4. เบอร์โทร</label>
        <input type="tel" placeholder="เบอร์โทร 10 หลัก" value={formData.phone} maxLength={10} disabled={disabled}
          onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '') })}
          className="input input-bordered w-full" />
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">5. หมายเหตุ</label>
        <textarea placeholder="หมายเหตุ (ถ้ามี)" value={formData.note} disabled={disabled}
          onChange={(e) => set({ note: e.target.value })}
          className="textarea textarea-bordered w-full" />
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">6. สถานภาพที่อยู่</label>
        <select value={formData.housingStatus} disabled={disabled}
          onChange={(e) => set({ housingStatus: e.target.value })}
          className="select select-bordered w-full">
          <option value="ไม่ระบุ">ไม่ระบุ</option>
          <option value="ผู้อาศัย">ผู้อาศัย</option>
          <option value="เจ้าของ">เจ้าของ</option>
          <option value="บ้านเช่า">บ้านเช่า</option>
          <option value="อื่นๆ">อื่นๆ</option>
        </select>
        <PrevHint year={prevYear} value={prev.housingStatus} />
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">7. จำนวนสมาชิกในบ้าน</label>
        <input type="number" placeholder="จำนวนสมาชิก" value={formData.householdMembers} min="1" disabled={disabled}
          onChange={(e) => set({ householdMembers: parseInt(e.target.value) || 1 })}
          className="input input-bordered w-full" />
        <PrevHint year={prevYear} value={prev.householdMembers} />
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">8. รายได้ทั้งปี (บาท)</label>
        <div className="relative">
          <input type="number" placeholder="รายได้ทั้งปี" value={formData.annualIncome} min="0" disabled={disabled}
            onChange={(e) => set({ annualIncome: e.target.value })}
            className="input input-bordered w-full pr-16" />
          <button type="button" disabled={disabled || !formData.annualIncome}
            onClick={() => {
              const v = parseInt(formData.annualIncome) || 0;
              if (v > 0) set({ annualIncome: String(v * 12) });
            }}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 btn btn-xs btn-outline btn-primary"
            title="คูณ 12 (แปลงจากรายได้ต่อเดือนเป็นรายได้ต่อปี)">
            ×12
          </button>
        </div>
        {formData.annualIncome && (
          <div className="text-xs text-gray-500 mt-1">
            💡 หมายเหตุ: หากกรอกรายได้ต่อเดือน ให้กดปุ่ม &quot;×12&quot; เพื่อแปลงเป็นรายได้ต่อปี
          </div>
        )}
        <PrevHint year={prevYear} value={prev.annualIncome} />
      </div>
    </div>
  );
}
```

- [ ] **Step 11.2: เขียน `MediaStep.jsx`** (รูปไม่ prefill — สภาพบ้าน/เอกสารต้องถ่ายใหม่ทุกปี ส่วนพิกัด prefill จากปีที่แล้วได้)

```jsx
import React from 'react';
import ImageUploads from '@/components/ImageUploads';
import LocationConfirm from '@/components/LocationConfirm';

// ขั้นที่ 3: รูปภาพ + พิกัด + ปุ่มส่ง
export default function MediaStep({
  formData, setFormData,
  useCurrent, setUseCurrent,
  location, setLocation,
  isSubmitting, onSubmit, onBack,
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">9. อัพโหลดรูปภาพ (ถ่ายใหม่ปีนี้)</label>
        <ImageUploads onChange={(urls) => setFormData({ ...formData, image: urls })} />
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">10. ตำแหน่งที่ตั้ง</label>
        <LocationConfirm
          useCurrent={useCurrent}
          onToggle={setUseCurrent}
          location={location}
          setLocation={setLocation}
          formSubmitted={false}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button className="btn btn-secondary flex-1" onClick={onBack} disabled={isSubmitting}>
          ย้อนกลับ
        </button>
        <button className="btn btn-primary flex-1" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              กำลังส่ง...
            </>
          ) : ('ส่งข้อมูล')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 11.3: Lint + Commit**

```bash
npm run lint
git add components/smart-school/survey/InfoStep.jsx components/smart-school/survey/MediaStep.jsx
git commit -m "feat(smart-school): InfoStep (hint ค่าเดิมรายปี) + MediaStep"
```

---

### Task 12: ฟอร์ม wizard — orchestrator + เสียบหน้าแรก

**Files:**
- Create: `components/smart-school/survey/SchoolSurveyModal.jsx`
- Modify: `pages/index.tsx` (บรรทัด import `EducationFormModal` และ JSX ~บรรทัด 191)

- [ ] **Step 12.1: เขียน `SchoolSurveyModal.jsx`**

```jsx
import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { z } from 'zod';
import IdentityStep from './IdentityStep';
import InfoStep from './InfoStep';
import MediaStep from './MediaStep';

const EMPTY_FORM = {
  educationLevel: '',
  prefix: '',
  fullName: '',
  address: '',
  phone: '',
  note: '',
  image: [],
  housingStatus: 'ไม่ระบุ',
  householdMembers: 1,
  annualIncome: '',
};

const surveySchema = z.object({
  educationLevel: z.string().min(1, 'กรุณาเลือกระดับการศึกษา'),
  prefix: z.string().min(1, 'กรุณาเลือกคำนำหน้า'),
  fullName: z.string().min(2, 'ชื่อ-นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร'),
  address: z.string().min(10, 'ที่อยู่ต้องมีอย่างน้อย 10 ตัวอักษร'),
  phone: z.string().length(10, 'เบอร์โทรศัพท์ต้องมี 10 หลัก'),
  image: z.array(z.string()).min(1, 'กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป'),
  location: z.object({ lat: z.number(), lng: z.number() })
    .nullable()
    .refine((val) => val !== null, 'กรุณาเลือกตำแหน่งที่ตั้ง'),
  annualIncome: z.string().refine((val) => {
    const num = parseInt(val);
    return !isNaN(num) && num >= 0;
  }, 'รายได้ต้องเป็นตัวเลขและไม่ติดลบ'),
});

// แบบฟอร์มสำรวจการศึกษา wizard 3 ขั้น (แทน EducationFormModal เดิม)
// ขั้น 1 ระบุตัวตนด้วยเลข 13 หลัก → ขั้น 2 ข้อมูล (prefill ถ้ารายเก่า) → ขั้น 3 รูป+พิกัด
export default function SchoolSurveyModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1);
  const [identity, setIdentity] = useState(null); // { citizenId, applicant, prevApplication }
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [useCurrent, setUseCurrent] = useState(false);
  const [location, setLocation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setStep(1);
    setIdentity(null);
    setFormData(EMPTY_FORM);
    setUseCurrent(false);
    setLocation(null);
  };

  const handleIdentityDone = ({ citizenId, applicant, prevApplication }) => {
    setIdentity({ citizenId, applicant, prevApplication });
    if (applicant) {
      // รายเก่า: prefill จากปีล่าสุด (รูปไม่ prefill — ถ่ายใหม่ทุกปี)
      const prev = prevApplication || {};
      setFormData({
        ...EMPTY_FORM,
        educationLevel: prev.educationLevel || '',
        prefix: applicant.prefix || '',
        fullName: applicant.name || '',
        address: prev.address || '',
        phone: applicant.phone || '',
        note: prev.note || '',
        housingStatus: prev.housingStatus || 'ไม่ระบุ',
        householdMembers: prev.householdMembers || 1,
        annualIncome: prev.annualIncome != null ? String(prev.annualIncome) : '',
      });
      if (prev.location?.lat) setLocation({ lat: prev.location.lat, lng: prev.location.lng });
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const result = surveySchema.safeParse({ ...formData, location });
    if (!result.success) {
      const messages = result.error.errors
        .map((err, i) => `${i + 1}. ${err.message}`)
        .join('\n');
      Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบถ้วน', text: messages, confirmButtonText: 'ตกลง' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/smart-school/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          citizenId: identity.citizenId,
          annualIncome: parseInt(formData.annualIncome) || 0,
          location,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        Swal.fire({
          icon: 'success',
          title: 'ส่งข้อมูลเรียบร้อยแล้ว',
          text: `รหัสใบสมัคร: ${data.applicationId}${data.isRenewal ? ' (อัปเดตข้อมูลรายเก่า)' : ''}`,
        });
        onClose();
        reset();
      } else {
        const errData = await res.json();
        Swal.fire({ icon: 'error', title: 'ไม่สามารถส่งข้อมูลได้', text: errData.message });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาดขณะส่งข้อมูล' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const prevYear = identity?.prevApplication?.surveyYear;

  return (
    <div className="fixed inset-0 bg-white/10 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4 relative">
        <button className="absolute top-2 right-2 text-gray-500"
          onClick={() => { onClose(); reset(); }}>✕</button>
        <h2 className="text-lg font-semibold text-center text-blue-600">แบบฟอร์มสำรวจการศึกษา</h2>

        <ul className="steps steps-horizontal w-full text-xs">
          <li className={`step ${step >= 1 ? 'step-primary' : ''}`}>ระบุตัวตน</li>
          <li className={`step ${step >= 2 ? 'step-primary' : ''}`}>ข้อมูล</li>
          <li className={`step ${step >= 3 ? 'step-primary' : ''}`}>รูป/พิกัด</li>
        </ul>

        {step === 1 && <IdentityStep onDone={handleIdentityDone} disabled={isSubmitting} />}

        {step === 2 && (
          <>
            {identity?.applicant && (
              <div className="alert alert-success text-xs">
                รายเก่า: ดึงข้อมูลปีงบ {prevYear || '-'} มาให้แล้ว แก้ไขเฉพาะที่เปลี่ยน
              </div>
            )}
            <InfoStep
              formData={formData}
              setFormData={setFormData}
              prevApplication={identity?.prevApplication}
              prevYear={prevYear}
              disabled={isSubmitting}
            />
            <div className="flex gap-2 pt-2">
              <button className="btn btn-secondary flex-1" disabled={isSubmitting}
                onClick={() => setStep(1)}>ย้อนกลับ</button>
              <button className="btn btn-primary flex-1" disabled={isSubmitting}
                onClick={() => setStep(3)}>ถัดไป</button>
            </div>
          </>
        )}

        {step === 3 && (
          <MediaStep
            formData={formData}
            setFormData={setFormData}
            useCurrent={useCurrent}
            setUseCurrent={setUseCurrent}
            location={location}
            setLocation={setLocation}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 12.2: เสียบเข้า `pages/index.tsx`**

แก้ 2 จุด:
1. บรรทัด 19: `import EducationFormModal from "@/components/education/EducationFormModal";` → `import SchoolSurveyModal from "@/components/smart-school/survey/SchoolSurveyModal";`
2. บรรทัด ~191: `<EducationFormModal` → `<SchoolSurveyModal` (props `isOpen`/`onClose` เดิมใช้ได้เลย ไม่ต้องแก้)

- [ ] **Step 12.3: ทดสอบ flow ในเบราว์เซอร์ (dev)**

Run: `npm run dev` แล้วเปิด http://localhost:3000 → กดเมนูที่เปิดฟอร์มสำรวจการศึกษา
ตรวจ: (1) เปิด wizard เห็นขั้นระบุตัวตน (2) กรอกเลขมั่ว 13 หลัก → ขึ้น "เลขบัตรประชาชนไม่ถูกต้อง" (3) รายเก่า + เลข valid ที่ไม่มีในระบบ → เข้าเส้นทางค้นชื่อ (ยังไม่มีข้อมูลใน collection ใหม่จนกว่าจะ migrate — ค้นแล้วว่างเป็นเรื่องปกติของขั้นนี้)
**อย่ากดส่งจริง** (จะเขียนฐานจริง + ยิง n8n) — ทดสอบ submit จบ ๆ ใน Task 18 ตอน cutover

- [ ] **Step 12.4: Lint + Commit**

```bash
npm run lint
git add components/smart-school/survey/SchoolSurveyModal.jsx pages/index.tsx
git commit -m "feat(smart-school): wizard 3 ขั้นแทน EducationFormModal บนหน้าแรก"
```

---

### Task 13: หน้าแอดมิน — page + dashboard + ตาราง + แผนที่

**Files:**
- Create: `pages/admin/smart-school.jsx`
- Create: `components/smart-school/admin/SmartSchoolDashboard.jsx`
- Create: `components/smart-school/admin/ApplicationTable.jsx`
- Create: `components/smart-school/admin/MapPoints.js` (คัดลอกจากไฟล์เดิม)

- [ ] **Step 13.1: คัดลอกแผนที่**

```bash
cp components/education/MapEducationPoints.js components/smart-school/admin/MapPoints.js
```
แล้วแก้ในไฟล์ใหม่ 2 จุด: (1) บรรทัดแรก comment เป็น `// components/smart-school/admin/MapPoints.js` (2) `export default function MapEducationPoints({ data })` → `export default function MapPoints({ data })` — เนื้อในเหลือเดิมทั้งหมด (อ่าน `item.name/prefix/educationLevel/location/imageUrl` ซึ่งแถวจาก `list.js` flatten ให้แล้ว)

- [ ] **Step 13.2: เขียน `pages/admin/smart-school.jsx`** (pattern เดียวกับ `pages/admin/elderly-school.jsx`)

```jsx
import PermissionGuard from "@/components/PermissionGuard";
import SmartSchoolDashboard from "@/components/smart-school/admin/SmartSchoolDashboard";

// Smart School — ระบบสำรวจการศึกษา/ทุนการศึกษา (แทน /admin/education-map เดิม)
export default function SmartSchoolPage() {
  return (
    <PermissionGuard>
      <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
            <p className="text-lg font-semibold text-gray-900">Smart School — สำรวจการศึกษา</p>
            <p className="text-xs text-gray-500 mt-1">
              ทะเบียนผู้ขอทุนรายบุคคล + ใบสมัครรายปีงบประมาณ พร้อมกติกาหมุนเวียนทุนต่อครัวเรือน
            </p>
          </div>
          <SmartSchoolDashboard />
        </div>
      </main>
    </PermissionGuard>
  );
}
```

- [ ] **Step 13.3: เขียน `SmartSchoolDashboard.jsx`**

```jsx
import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Swal from 'sweetalert2';
import ApplicationTable from './ApplicationTable';
import ApplicationDetailModal from './ApplicationDetailModal';
import ApplicationEditModal from './ApplicationEditModal';

const MapPoints = dynamic(() => import('./MapPoints'), { ssr: false });

export default function SmartSchoolDashboard() {
  const [year, setYear] = useState(null); // null = ปีปัจจุบัน (server ตัดสิน)
  const [data, setData] = useState(null); // { year, years, applications, stats }
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table'); // 'table' | 'map'
  const [detailRow, setDetailRow] = useState(null);
  const [editRow, setEditRow] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const q = year ? `?year=${year}` : '';
      const res = await fetch(`/api/smart-school/list${q}`);
      if (!res.ok) throw new Error((await res.json()).message || 'โหลดข้อมูลไม่สำเร็จ');
      setData(await res.json());
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: e.message });
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // เปลี่ยนสถานะ — เตือนก่อนตั้ง "ได้รับทุน" ถ้าขัดกติกาครัวเรือน (เตือนอย่างเดียว ไม่บล็อก)
  const handleSetStatus = async (row, status) => {
    if (status === 'ได้รับทุน' && (row.flags?.prevYearAwarded || row.flags?.householdAwardedOther)) {
      const reasons = [
        row.flags.prevYearAwarded && '• คนนี้ได้รับทุนปีที่แล้ว — ตามกติกาต้องหมุนเวียนเปลี่ยนคน',
        row.flags.householdAwardedOther && '• ครัวเรือนเดียวกัน (เบอร์/ที่อยู่ตรงกัน) มีผู้ได้รับทุนปีนี้แล้ว',
      ].filter(Boolean).join('\n');
      const c = await Swal.fire({
        icon: 'warning',
        title: 'ขัดกติกาทุน 1 คน/ครัวเรือน/ปี',
        text: reasons,
        showCancelButton: true,
        confirmButtonText: 'ยืนยันให้ทุน (เจ้าหน้าที่ตัดสิน)',
        cancelButtonText: 'ยกเลิก',
      });
      if (!c.isConfirmed) return;
    }
    const res = await fetch('/api/smart-school/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id: row._id, status }),
    });
    if (res.ok) {
      await fetchData();
    } else {
      Swal.fire({ icon: 'error', title: 'เปลี่ยนสถานะไม่สำเร็จ', text: (await res.json()).message });
    }
  };

  const handleDelete = async (row) => {
    const c = await Swal.fire({
      icon: 'warning',
      title: `ลบใบสมัคร ${row.applicationId}?`,
      text: 'ใช้สำหรับเก็บกวาดรายการซ้ำ — ลบแล้วกู้คืนไม่ได้',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
    });
    if (!c.isConfirmed) return;
    const res = await fetch('/api/smart-school/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id: row._id }),
    });
    if (res.ok) {
      setDetailRow(null);
      await fetchData();
    } else {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: (await res.json()).message });
    }
  };

  const stats = data?.stats;

  return (
    <div className="space-y-4">
      {/* แท็บปีงบประมาณ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-600">ปีงบประมาณ:</span>
        {(data?.years || []).map((y) => (
          <button key={y}
            className={`btn btn-sm rounded-full ${y === data?.year ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setYear(y)}>
            {y}
          </button>
        ))}
        <div className="ml-auto join">
          <button className={`btn btn-sm join-item ${view === 'table' ? 'btn-active' : ''}`}
            onClick={() => setView('table')}>ตาราง</button>
          <button className={`btn btn-sm join-item ${view === 'map' ? 'btn-active' : ''}`}
            onClick={() => setView('map')}>แผนที่</button>
        </div>
      </div>

      {/* สรุป */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            ['ทั้งหมด', stats.total],
            ['รายเก่า', stats.renewals],
            ['รับคำร้อง', stats.byStatus?.['รับคำร้อง'] || 0],
            ['ตรวจสอบแล้ว', stats.byStatus?.['ตรวจสอบแล้ว'] || 0],
            ['ได้รับทุน', stats.byStatus?.['ได้รับทุน'] || 0],
            ['ไม่ผ่านเกณฑ์', stats.byStatus?.['ไม่ผ่านเกณฑ์'] || 0],
          ].map(([label, value]) => (
            <div key={label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-60">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : view === 'map' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <MapPoints data={data?.applications || []} />
        </div>
      ) : (
        <ApplicationTable
          rows={data?.applications || []}
          onDetail={setDetailRow}
          onEdit={setEditRow}
        />
      )}

      {detailRow && (
        <ApplicationDetailModal
          row={detailRow}
          onClose={() => setDetailRow(null)}
          onSetStatus={handleSetStatus}
          onEdit={() => { setEditRow(detailRow); setDetailRow(null); }}
          onDelete={handleDelete}
        />
      )}
      {editRow && (
        <ApplicationEditModal
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={async () => { setEditRow(null); await fetchData(); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 13.4: เขียน `ApplicationTable.jsx`**

```jsx
import React, { useMemo, useState } from 'react';

const STATUS_BADGE = {
  'รับคำร้อง': 'badge-info',
  'ตรวจสอบแล้ว': 'badge-primary',
  'ได้รับทุน': 'badge-success',
  'ไม่ผ่านเกณฑ์': 'badge-ghost',
};

export default function ApplicationTable({ rows, onDetail, onEdit }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [renewalFilter, setRenewalFilter] = useState('all'); // all | renewal | new

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (renewalFilter === 'renewal' && !r.isRenewal) return false;
      if (renewalFilter === 'new' && r.isRenewal) return false;
      if (!q) return true;
      return [r.name, r.applicationId, r.phone, r.address, r.citizenId]
        .some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter, renewalFilter]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <input type="text" placeholder="ค้นหา ชื่อ/รหัส/เบอร์/ที่อยู่/เลขบัตร"
          className="input input-bordered input-sm flex-1 min-w-48"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select select-bordered select-sm" value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">ทุกสถานะ</option>
          <option value="รับคำร้อง">รับคำร้อง</option>
          <option value="ตรวจสอบแล้ว">ตรวจสอบแล้ว</option>
          <option value="ได้รับทุน">ได้รับทุน</option>
          <option value="ไม่ผ่านเกณฑ์">ไม่ผ่านเกณฑ์</option>
        </select>
        <select className="select select-bordered select-sm" value={renewalFilter}
          onChange={(e) => setRenewalFilter(e.target.value)}>
          <option value="all">รายเก่า+ใหม่</option>
          <option value="renewal">เฉพาะรายเก่า</option>
          <option value="new">เฉพาะรายใหม่</option>
        </select>
        <span className="text-xs text-gray-500 self-center">{filtered.length} รายการ</span>
      </div>

      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>รหัส</th>
              <th>ชื่อ-นามสกุล</th>
              <th>ระดับ</th>
              <th>เบอร์โทร</th>
              <th>รายได้/ปี</th>
              <th>สถานะ</th>
              <th>กติกาครัวเรือน</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r._id} className="hover">
                <td className="whitespace-nowrap">
                  {r.applicationId}
                  {r.isRenewal && <span className="badge badge-warning badge-xs ml-1">รายเก่า</span>}
                </td>
                <td>
                  {r.prefix}{r.name}
                  {!r.citizenId && (
                    <span className="badge badge-outline badge-xs ml-1" title="ยังไม่ผูกเลขบัตร 13 หลัก">
                      ไม่มีเลขบัตร
                    </span>
                  )}
                </td>
                <td>{r.educationLevel || '-'}</td>
                <td>{r.phone || '-'}</td>
                <td>{(r.annualIncome || 0).toLocaleString()}</td>
                <td>
                  <span className={`badge badge-sm ${STATUS_BADGE[r.status] || 'badge-ghost'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="space-x-1 whitespace-nowrap">
                  {r.flags?.prevYearAwarded && (
                    <span className="badge badge-error badge-sm" title="ได้ทุนปีที่แล้ว — ตามกติกาต้องหมุนเวียนเปลี่ยนคน">
                      🔁 ได้ทุนปีที่แล้ว
                    </span>
                  )}
                  {r.flags?.householdKey && (
                    <span className="badge badge-warning badge-sm"
                      title={`น่าจะครัวเรือนเดียวกัน (${r.flags.householdKey.startsWith('p:') ? 'เบอร์โทรตรงกัน' : 'ที่อยู่ตรงกัน'})${r.flags.householdAwardedOther ? ' — มีคนในบ้านได้ทุนปีนี้แล้ว' : ''}`}>
                      🏠 บ้านเดียวกัน{r.flags.householdAwardedOther ? ' ⚠️' : ''}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap">
                  <button className="btn btn-xs btn-outline" onClick={() => onDetail(r)}>ดู</button>
                  <button className="btn btn-xs btn-outline btn-primary ml-1" onClick={() => onEdit(r)}>แก้ไข</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center text-gray-400 py-6">ไม่มีข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 13.5: สร้าง modal ชั่วคราวให้ build ผ่าน** (เนื้อจริงใน Task 14)

ยังไม่สร้างไฟล์ modal — **Task นี้ commit ไม่ได้จนกว่า Task 14 เสร็จ** เพราะ Dashboard import สองไฟล์นั้น → ทำ Task 14 ต่อทันทีแล้ว commit รวมกันตาม Step 14.4

---

### Task 14: หน้าแอดมิน — DetailModal + EditModal

**Files:**
- Create: `components/smart-school/admin/ApplicationDetailModal.jsx`
- Create: `components/smart-school/admin/ApplicationEditModal.jsx`

- [ ] **Step 14.1: เขียน `ApplicationDetailModal.jsx`**

```jsx
import React from 'react';
import Image from 'next/image';

// ประกาศซ้ำจาก models/smart-school/SchoolApplication.js โดยเจตนา —
// ห้าม import จาก model ใน client component (จะลาก mongoose เข้า browser bundle)
const APPLICATION_STATUSES = ['รับคำร้อง', 'ตรวจสอบแล้ว', 'ได้รับทุน', 'ไม่ผ่านเกณฑ์'];

function Row({ label, value }) {
  return (
    <div className="flex text-sm gap-2">
      <span className="w-36 shrink-0 text-gray-500">{label}</span>
      <span className="text-gray-800 break-words">{value ?? '-'}</span>
    </div>
  );
}

export default function ApplicationDetailModal({ row, onClose, onSetStatus, onEdit, onDelete }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-800">
            {row.applicationId} — {row.prefix}{row.name}
          </h2>
          <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>✕</button>
        </div>

        <div className="p-4 space-y-4">
          {(row.flags?.prevYearAwarded || row.flags?.householdAwardedOther) && (
            <div className="alert alert-warning text-xs whitespace-pre-line">
              {[
                row.flags.prevYearAwarded && '🔁 ได้ทุนปีที่แล้ว — ตามกติกาต้องหมุนเวียนเปลี่ยนคน',
                row.flags.householdAwardedOther && '🏠 ครัวเรือนเดียวกันมีผู้ได้รับทุนปีนี้แล้ว',
              ].filter(Boolean).join('\n')}
            </div>
          )}

          <div className="space-y-1">
            <Row label="เลขบัตรประชาชน" value={row.citizenId || 'ยังไม่ผูก (backfill ได้ในหน้าแก้ไข)'} />
            <Row label="ปีงบประมาณ" value={row.surveyYear} />
            <Row label="ประเภท" value={row.isRenewal ? 'รายเก่า (อัปเดตข้อมูล)' : 'รายใหม่'} />
            <Row label="ระดับการศึกษา" value={row.educationLevel} />
            <Row label="โรงเรียน / ชั้น / GPA"
              value={`${row.schoolName || '-'} / ${row.gradeLevel || '-'} / ${row.gpa ?? '-'}`} />
            <Row label="เบอร์โทร" value={row.phone} />
            <Row label="ที่อยู่" value={row.address} />
            <Row label="ที่อยู่จริง" value={row.actualAddress} />
            <Row label="สถานภาพที่อยู่" value={row.housingStatus} />
            <Row label="สมาชิกในบ้าน" value={row.householdMembers} />
            <Row label="รายได้/ปี" value={(row.annualIncome || 0).toLocaleString() + ' บาท'} />
            <Row label="สถานะครอบครัว" value={(row.familyStatus || []).join(', ')} />
            <Row label="ทุนที่เคยได้ (self-report)" value={(row.takhliScholarshipHistory || []).join(', ')} />
            <Row label="หมายเหตุ" value={row.note} />
            <Row label="สถานะ"
              value={`${row.status}${row.statusUpdatedBy ? ` (โดย ${row.statusUpdatedBy})` : ''}`} />
          </div>

          {(row.imageUrl || []).length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {row.imageUrl.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer"
                  className="relative aspect-square rounded overflow-hidden border">
                  <Image src={url} alt={`รูปที่ ${i + 1}`} fill className="object-cover" />
                </a>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center border-t pt-3">
            <select className="select select-bordered select-sm" value={row.status}
              onChange={(e) => onSetStatus(row, e.target.value)}>
              {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn btn-sm btn-primary" onClick={onEdit}>แก้ไขข้อมูล</button>
            <button className="btn btn-sm btn-error btn-outline ml-auto" onClick={() => onDelete(row)}>
              ลบใบสมัคร
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 14.2: เขียน `ApplicationEditModal.jsx`**

```jsx
import React, { useState } from 'react';
import Swal from 'sweetalert2';
import ImageUploads from '@/components/ImageUploads';

const FAMILY_STATUS_OPTIONS = [
  'บิดา-มารดาแยกกันอยู่', 'แยกกันอยู่ชั่วคราว', 'หย่าร้าง',
  'บิดาส่งเสีย', 'มารดาส่งเสีย', 'บิดา/มารดาไม่ได้ส่งเสีย',
];

export default function ApplicationEditModal({ row, onClose, onSaved }) {
  const [form, setForm] = useState({
    citizenId: row.citizenId || '',
    prefix: row.prefix || '',
    name: row.name || '',
    phone: row.phone || '',
    educationLevel: row.educationLevel || '',
    schoolName: row.schoolName || '',
    gradeLevel: row.gradeLevel || '',
    gpa: row.gpa ?? '',
    address: row.address || '',
    actualAddress: row.actualAddress || '',
    housingStatus: row.housingStatus || 'ไม่ระบุ',
    householdMembers: row.householdMembers || 1,
    annualIncome: row.annualIncome ?? 0,
    familyStatus: row.familyStatus || [],
    incomeSource: row.incomeSource || [],
    receivedScholarship: row.receivedScholarship || [],
    takhliScholarshipHistory: row.takhliScholarshipHistory || [],
    note: row.note || '',
    imageUrl: row.imageUrl || [],
  });
  const [saving, setSaving] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/smart-school/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _id: row._id, ...form, gpa: form.gpa === '' ? null : form.gpa }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'บันทึกไม่สำเร็จ');
      Swal.fire({
        icon: 'success',
        title: 'บันทึกแล้ว',
        text: data.imagesChanged ? 'รูปภาพเปลี่ยน — แจ้งเตือน n8n แล้ว' : undefined,
        timer: 1600,
        showConfirmButton: false,
      });
      onSaved();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const input = (label, key, type = 'text', extra = {}) => (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input type={type} className="input input-bordered input-sm w-full" value={form[key]}
        onChange={(e) => set({ [key]: type === 'number' ? e.target.value : e.target.value })}
        {...extra} />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-800">แก้ไข {row.applicationId}</h2>
          <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>✕</button>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-gray-700">
              เลขบัตรประชาชน 13 หลัก {!row.citizenId && <span className="text-amber-600">(ยังไม่ผูก — backfill ที่นี่)</span>}
            </label>
            <input type="text" maxLength={13} className="input input-bordered input-sm w-full"
              value={form.citizenId}
              onChange={(e) => set({ citizenId: e.target.value.replace(/\D/g, '') })} />
          </div>
          {input('คำนำหน้า', 'prefix')}
          {input('ชื่อ-นามสกุล', 'name')}
          {input('เบอร์โทร', 'phone', 'tel', { maxLength: 10 })}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">ระดับการศึกษา</label>
            <select className="select select-bordered select-sm w-full" value={form.educationLevel}
              onChange={(e) => set({ educationLevel: e.target.value })}>
              <option value="">เลือกระดับการศึกษา</option>
              {['อนุบาล', 'ประถม', 'มัธยมต้น', 'มัธยมปลาย', 'ปวช', 'ปวส', 'ปริญญาตรี'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          {input('โรงเรียน', 'schoolName')}
          {input('ระดับชั้น', 'gradeLevel')}
          {input('GPA', 'gpa', 'number', { step: '0.01', min: 0, max: 4 })}
          <div className="md:col-span-2 space-y-1">
            <label className="text-sm font-medium text-gray-700">ที่อยู่</label>
            <textarea className="textarea textarea-bordered textarea-sm w-full" value={form.address}
              onChange={(e) => set({ address: e.target.value })} />
          </div>
          {input('ที่อยู่จริง', 'actualAddress')}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">สถานภาพที่อยู่</label>
            <select className="select select-bordered select-sm w-full" value={form.housingStatus}
              onChange={(e) => set({ housingStatus: e.target.value })}>
              {['ไม่ระบุ', 'ผู้อาศัย', 'เจ้าของ', 'บ้านเช่า', 'อื่นๆ'].map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          {input('จำนวนสมาชิกในบ้าน', 'householdMembers', 'number', { min: 1 })}
          {input('รายได้/ปี (บาท)', 'annualIncome', 'number', { min: 0 })}
          <div className="md:col-span-2 space-y-1">
            <label className="text-sm font-medium text-gray-700">สถานะครอบครัว</label>
            <div className="flex flex-wrap gap-2">
              {FAMILY_STATUS_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" className="checkbox checkbox-xs"
                    checked={form.familyStatus.includes(opt)}
                    onChange={(e) => set({
                      familyStatus: e.target.checked
                        ? [...form.familyStatus, opt]
                        : form.familyStatus.filter((x) => x !== opt),
                    })} />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-sm font-medium text-gray-700">ทุนเทศบาลที่เคยได้ (self-report)</label>
            <div className="flex flex-wrap gap-2">
              {['เคยได้รับทุนการศึกษา ปีงบประมาณ 2565', 'เคยได้รับทุนการศึกษา ปีงบประมาณ 2566',
                'เคยได้รับทุนการศึกษา ปีงบประมาณ 2567', 'เคยได้รับทุนการศึกษา ปีงบประมาณ 2568',
                'ไม่เคยได้รับทุนการศึกษา'].map((opt) => (
                <label key={opt} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" className="checkbox checkbox-xs"
                    checked={form.takhliScholarshipHistory.includes(opt)}
                    onChange={(e) => set({
                      takhliScholarshipHistory: e.target.checked
                        ? [...form.takhliScholarshipHistory, opt]
                        : form.takhliScholarshipHistory.filter((x) => x !== opt),
                    })} />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">แหล่งรายได้ (คั่นด้วย ,)</label>
            <input type="text" className="input input-bordered input-sm w-full"
              value={form.incomeSource.join(', ')}
              onChange={(e) => set({
                incomeSource: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              })} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">ทุนอื่นที่ได้รับ (คั่นด้วย ,)</label>
            <input type="text" className="input input-bordered input-sm w-full"
              value={form.receivedScholarship.join(', ')}
              onChange={(e) => set({
                receivedScholarship: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              })} />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-sm font-medium text-gray-700">หมายเหตุ</label>
            <textarea className="textarea textarea-bordered textarea-sm w-full" value={form.note}
              onChange={(e) => set({ note: e.target.value })} />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-sm font-medium text-gray-700">
              รูปภาพ (บันทึกจริง + แจ้ง n8n เมื่อเปลี่ยน)
            </label>
            <ImageUploads
              initialImages={form.imageUrl}
              onChange={(urls) => set({ imageUrl: urls })}
            />
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t sticky bottom-0 bg-white">
          <button className="btn btn-secondary flex-1" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button className="btn btn-primary flex-1" onClick={handleSave} disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-sm" /> : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 14.3: ตรวจหน้าแอดมินใน dev**

Run: `npm run dev` → login แอดมิน → เปิด http://localhost:3000/admin/smart-school (เข้า path ตรง ๆ — เมนูยังชี้หน้าเก่าจนกว่า Task 15)
ตรวจ: หน้าโหลดได้ แท็บปีว่าง/ตารางว่าง (ยังไม่ migrate — ปกติ), สลับตาราง/แผนที่ไม่ crash

- [ ] **Step 14.4: Lint + Commit (รวม Task 13+14)**

```bash
npm run lint
git add pages/admin/smart-school.jsx components/smart-school/admin/
git commit -m "feat(smart-school): หน้าแอดมิน — dashboard/ตาราง/แผนที่/detail/edit + ป้ายกติกาครัวเรือน"
```

---

### Task 15: Permissions + เมนู + redirect + สคริปต์สิทธิ์ (checklist 4 จุดของ CLAUDE.md)

**Files:**
- Modify: `lib/permissions.ts:68-74` (entry `/admin/education-map`)
- Modify: `components/LayoutAdmin.tsx:30` (เมนู)
- Modify: `pages/admin/education-map.js` (เขียนทับทั้งไฟล์เป็น redirect)
- Create: `scripts/grant-smart-school-permission.js`

- [ ] **Step 15.1: แก้ `lib/permissions.ts`** — แทน entry เดิม (บรรทัด 68-74) ด้วย:

```ts
  {
    path: '/admin/smart-school',
    label: 'smart-school',
    icon: '🏫',
    description: 'ระบบสำรวจการศึกษา/ทุนการศึกษา (ทะเบียนบุคคล + ใบสมัครรายปี)',
    category: 'management'
  },
```

จุดที่ 2 ของ checklist (DEFAULT_PERMISSIONS): `/admin/education-map` เดิม**ไม่เคยอยู่**ใน `DEFAULT_PERMISSIONS` ของ role ใด (แอดมินได้สิทธิ์รายคนผ่าน allowedPages) → คงพฤติกรรมเดิม **ไม่เพิ่ม** `/admin/smart-school` เข้า DEFAULT_PERMISSIONS

- [ ] **Step 15.2: แก้ `components/LayoutAdmin.tsx` บรรทัด 30**

จาก: `{ label: 'Smart School',       href: '/admin/education-map',            icon: '🏫', group: 'จัดการ' },`
เป็น: `{ label: 'Smart School',       href: '/admin/smart-school',             icon: '🏫', group: 'จัดการ' },`

- [ ] **Step 15.3: เขียนทับ `pages/admin/education-map.js` ทั้งไฟล์เป็น redirect**

```js
// pages/admin/education-map.js — path เดิม redirect ไปโมดูลใหม่
// (คงไว้เผื่อบุ๊กมาร์ก/ลิงก์เก่าของเจ้าหน้าที่ — โค้ดหน้าเดิมดูได้จาก git history)
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function EducationMapRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/smart-school");
  }, [router]);
  return null;
}
```

- [ ] **Step 15.4: เขียน `scripts/grant-smart-school-permission.js`** (pattern เดียวกับ `scripts/grant-elderly-school-permission.js`)

```js
// One-time migration: ให้สิทธิ์ /admin/smart-school กับ user เดิมที่มี custom allowedPages
//
// ทำไมต้องรัน: หน้า /admin/education-map ถูกแทนด้วย /admin/smart-school
// user ที่มี custom allowedPages (ไม่ว่าง) จะมองไม่เห็นหน้าใหม่จนกว่าจะเพิ่มสิทธิ์
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/grant-smart-school-permission.js --dry-run
//   node --env-file=.env.local scripts/grant-smart-school-permission.js
//
// รันซ้ำได้ (idempotent) — ใช้ $addToSet

const mongoose = require("mongoose");

const NEW_PAGES = ["/admin/smart-school"];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
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

  // คัดเฉพาะ user ที่เคยเข้าถึงหน้า education-map เดิม
  const filter = { allowedPages: "/admin/education-map" };
  const targets = await User.find(filter)
    .select("name clerkId role allowedPages")
    .lean();

  console.log(`พบ user ที่ต้องเพิ่มสิทธิ์ ${targets.length} ราย`);
  console.table(
    targets.map((u) => ({
      name: u.name,
      role: u.role,
      pages: (u.allowedPages || []).length,
      hasSmartSchool: (u.allowedPages || []).includes("/admin/smart-school"),
    }))
  );

  if (dryRun) {
    console.log("--dry-run: ยังไม่แก้ไขข้อมูล");
  } else {
    const res = await User.updateMany(filter, {
      $addToSet: { allowedPages: { $each: NEW_PAGES } },
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

- [ ] **Step 15.5: รัน dry-run สคริปต์สิทธิ์ + ตรวจเมนูใน dev**

Run: `node --env-file=.env.local scripts/grant-smart-school-permission.js --dry-run`
Expected: แสดงตาราง user ที่จะได้สิทธิ์ (จำนวน ≥ 0) ไม่ error
Run: `npm run dev` → เมนูแอดมิน "Smart School" ชี้ `/admin/smart-school`, เปิด `/admin/education-map` แล้วเด้งไปหน้าใหม่

- [ ] **Step 15.6: Commit**

```bash
git add lib/permissions.ts components/LayoutAdmin.tsx pages/admin/education-map.js scripts/grant-smart-school-permission.js
git commit -m "feat(smart-school): ลงทะเบียนหน้าแอดมิน 4 จุด + redirect education-map + สคริปต์เพิ่มสิทธิ์"
```

---

### Task 16: แก้ n8n workflow "Api All" (MCP `claude.ai n8n`)

**Target:** workflow id `WmudE1P882vIgxhv` โหนด `Edit Fields5` (Set) และ `HTTP Request6` (Telegram sendMessage) ในสาย `hook sm-school-takhli` (path `sm-school`)

**บั๊กที่แก้:** `jsonBody` ปัจจุบันเป็น raw JSON string + `{{ }}` interpolation — `note`/`address` ที่มี newline หรือ `"` ทำให้ JSON พัง Telegram ส่งไม่ออก และ `image[1]`/`image[2]` ขึ้นตัวหนังสือ "undefined" เมื่อรูปไม่ครบ 3

- [ ] **Step 16.1: อ่าน SDK + เตรียมอัปเดต** — เรียก `get_sdk_reference` ตามคำแนะนำ MCP server แล้วดึง workflow ปัจจุบันด้วย `get_workflow_details` (id ข้างบน) — แก้ **เฉพาะ 2 โหนดนี้** ห้ามแตะโหนด/สายอื่น (มี webhook อื่นอีก ~12 เส้นใน workflow เดียวกัน)

- [ ] **Step 16.2: อัปเดตโหนด `Edit Fields5`** — เพิ่ม assignments 4 ตัว (คงของเดิม 8 ตัวไว้):

| name | type | value |
|---|---|---|
| `body.header` | string | `={{ $json.body.header }}` |
| `body.event` | string | `={{ $json.body.event }}` |
| `body.applicationId` | string | `={{ $json.body.applicationId }}` |
| `body.surveyYear` | string | `={{ $json.body.surveyYear }}` |

- [ ] **Step 16.3: อัปเดตโหนด `HTTP Request6`** — เปลี่ยน parameter `jsonBody` เป็น expression เดียว (JSON.stringify ทั้งก้อน — กัน newline/quote, กัน "undefined", รองรับ payload เก่าที่ไม่มี `header`):

```
={{ JSON.stringify({
  chat_id: "-4801705372",
  text: [
    $json.body.header || "📚 แจ้งสำรวจข้อมูลทางการศึกษา TAKHLI-SCHOOL",
    $json.body.applicationId ? "🆔 รหัสใบสมัคร: " + $json.body.applicationId + " (ปีงบ " + ($json.body.surveyYear || "-") + ")" : null,
    "🎓 ระดับการศึกษา: " + ($json.body.educationLevel || "-"),
    "👤 ชื่อนักเรียน: " + ($json.body.name || "-"),
    "📞 เบอร์โทร: " + ($json.body.phone || "-"),
    "📍 ที่อยู่: " + ($json.body.address || "-"),
    "📝 หมายเหตุ: " + ($json.body.note || "-"),
    "🖼️ รูปภาพ:",
    ...(Array.isArray($json.body.image) ? $json.body.image : [])
  ].filter(function (v) { return v !== null; }).join("\n")
}) }}
```

(URL/method/`specifyBody: "json"` คงเดิม)

- [ ] **Step 16.4: ทดสอบด้วย `test_workflow`** — pin ข้อมูลทดสอบที่โหนด `hook sm-school-takhli` 2 กรณี (ข้อความจะถูกส่งเข้ากลุ่ม Telegram จริง — เป็น test message ปกติ แจ้งทีมได้):
  1. **payload ใหม่ + ตัวอักษรอันตราย:** `{ "body": { "event": "school.renewal_updated", "header": "🔄 รายเก่า update ข้อมูล — TAKHLI-SCHOOL", "applicationId": "TKC69-001", "surveyYear": 2569, "name": "ทดสอบ ระบบ", "educationLevel": "ประถม", "phone": "0812345678", "address": "บ้านเลขที่ 1\nหมู่ 2 \"ตาคลี\"", "note": "มี newline\nและ \"อัญประกาศ\"", "image": ["https://example.com/a.jpg"] } }` → คาดหวัง: Telegram ส่งสำเร็จ หัวข้อความเป็น "🔄 รายเก่า update ข้อมูล" ไม่มีคำว่า undefined
  2. **payload เก่า (ไม่มี header):** `{ "body": { "name": "ทดสอบ เก่า", "educationLevel": "มัธยมต้น", "phone": "0800000000", "address": "ที่อยู่เดิม", "note": "-", "image": ["https://example.com/a.jpg", "https://example.com/b.jpg"] } }` → คาดหวัง: หัวข้อความ fallback "📚 แจ้งสำรวจข้อมูลทางการศึกษา TAKHLI-SCHOOL"

- [ ] **Step 16.5: `publish_workflow`** — **ห้ามข้าม** (บทเรียนรอบก่อน: update อย่างเดียวไม่มีผลกับ webhook จริง) แล้วบันทึกผลไว้ในข้อความ commit ถัดไปหรือรายงานผู้ใช้

---

### Task 17: ปลดระวางโมดูลเก่า + เอกสาร

**Files:**
- Delete: `pages/api/education/` ทั้งโฟลเดอร์ (all, update, education-survey, fix-duplicates, reset-applicant-id, bulk-update-prefix)
- Delete: `components/education/` ทั้งโฟลเดอร์ (6 ไฟล์)
- Delete: `models/EducationRegisterModel.js`
- Delete: `docs/modules/education.md`
- Create: `docs/modules/smart-school.md`
- Modify: `docs/modules/README.md` (ดัชนี), `CLAUDE.md` (bullet โมดูล Education)

- [ ] **Step 17.1: ตรวจว่าไม่มีใครอ้างไฟล์เก่าแล้วค่อยลบ**

Run: `grep -rn "components/education\|EducationRegisterModel\|api/education" pages components lib --include="*.js*" --include="*.ts*" | grep -v "pages/api/education\|components/education/"`
Expected: ไม่มีผลลัพธ์ (ถ้ามี — ไฟล์นั้นยังอ้างของเก่า ต้องแก้ก่อนลบ)
จากนั้น: `git rm -r pages/api/education components/education models/EducationRegisterModel.js`

- [ ] **Step 17.2: เขียน `docs/modules/smart-school.md`**

```markdown
# Smart School (สำรวจการศึกษา / ทุนการศึกษา)

ทะเบียนผู้ขอทุนแบบ "บุคคล + ใบสมัครรายปีงบประมาณ" — รายเก่ายืนยันตัวด้วย
เลขบัตร 13 หลักแล้วดึงข้อมูลปีที่แล้วมาแก้ไขได้ ข้อมูลทุกปีเก็บครบ
(spec: `docs/superpowers/specs/2026-07-03-smart-school-redesign-design.md`)

## หน้า

- `/admin/smart-school` — แดชบอร์ด (แท็บปีงบ, ตาราง+แผนที่, สถานะ 4 ค่า,
  ป้ายกติกาทุน 1 คน/ครัวเรือน/ปี + หมุนเวียนผู้รับ)
- `/admin/education-map` — path เดิม redirect มาหน้านี้
- ฟอร์มสาธารณะ: wizard ใน `components/smart-school/survey/` เปิดจากหน้าแรก

## API — `pages/api/smart-school/`

- public: `lookup` (ค้นมาสก์), `verify` (ยืนยันเลข 13 หลัก + ผูกเลขให้รายเก่า),
  `submit` (ใบสมัครปีปัจจุบัน + n8n)
- admin (`_auth.js` pattern เดียวกับ pm25): `list` (+flags ครัวเรือน),
  `update` (รวมรูป + backfill เลขบัตร), `status`, `delete`

## Models — `models/smart-school/`

- `SchoolApplicant` → `school_applicants` (บุคคล; `citizenId` unique sparse)
- `SchoolApplication` → `school_applications` (ใบสมัคร/ปี; unique
  `applicantRef+surveyYear`; เลขใบสมัคร `TKC69-001` ออกผ่าน `school_counters`)
- collection เดิม `educationregisters` **ไม่ถูกแตะ** — backup ถาวร
  (migrate ด้วย `scripts/migrate-education-to-smart-school.js`)

## n8n

`lib/smart-school/notify.js` ยิง webhook `sm-school` (workflow "Api All") 3 events:
`school.submitted` / `school.renewal_updated` ("รายเก่า update ข้อมูล") /
`school.images_changed` — ENV override: `N8N_SCHOOL_WEBHOOK_URL`

## หมายเหตุ

- `pages/api/student-feedback/*` + `StudentFeedback` ยังแยกอยู่กับโมดูล
  activities (ดู activities.md)
- โมดูล education เดิมถูกปลดระวาง 2026-07 — โค้ดเก่าดูได้จาก git history
```

- [ ] **Step 17.3: อัปเดตดัชนี `docs/modules/README.md`** — เปลี่ยนบรรทัดที่ชี้ `education.md` เป็น `smart-school.md` (คงรูปแบบรายการเดิมของไฟล์)

- [ ] **Step 17.4: อัปเดต `CLAUDE.md`** — แทน bullet "**Education / โรงเรียน + ความเห็นนักเรียน**" ในหัวข้อ Feature modules ด้วย:

```markdown
- **Smart School / สำรวจการศึกษา-ทุนการศึกษา** — โมดูล `smart-school` เต็มรูปแบบ: models `models/smart-school/` (บุคคล `school_applicants` + ใบสมัครรายปี `school_applications`), API `pages/api/smart-school/*` (public: lookup/verify/submit ยืนยันด้วยเลขบัตร 13 หลัก; admin: list/update/status/delete), หน้า `/admin/smart-school` (path เดิม `/admin/education-map` redirect), ฟอร์มสาธารณะ wizard ใน `components/smart-school/survey/`. Collection เดิม `educationregisters` เป็น backup ห้ามแตะ. ความเห็นนักเรียน `pages/api/student-feedback/*` + `StudentFeedback` ยังผูกกับโมดูล activities (`StudentFeedback.activityId` required)
```

- [ ] **Step 17.5: Lint + Build + Commit**

```bash
npm run lint && npm run build
git add -A
git commit -m "refactor(smart-school): ปลดระวางโมดูล education เดิม + เอกสารโมดูลใหม่"
```
Expected: build ผ่าน — ถ้า fail เพราะไฟล์ที่ลบยังถูก import ที่ไหนสักแห่ง ให้กลับไปแก้ตาม error ก่อน commit

---

### Task 18: Cutover + ตรวจรับปลายทาง

- [ ] **Step 18.1: รัน migration จริง**

```bash
node --env-file=.env.local scripts/migrate-education-to-smart-school.js --dry-run
node --env-file=.env.local scripts/migrate-education-to-smart-school.js
```
Expected: `สร้างใหม่ 238 / ข้ามที่ย้ายแล้ว 0` แล้วบรรทัดยอด `applicants=238, applications(2568)=238` — รันซ้ำอีกรอบต้องได้ `สร้างใหม่ 0 / ข้าม 238` (พิสูจน์ idempotent)

- [ ] **Step 18.2: รันสคริปต์สิทธิ์จริง**

```bash
node --env-file=.env.local scripts/grant-smart-school-permission.js
```

- [ ] **Step 18.3: เดินฟอร์มครบ 4 เส้นทางบน dev (ฐานจริง — ใช้ชื่อ "ทดสอบ ระบบ" แล้วลบทิ้งผ่านหน้าแอดมิน)**

1. **รายใหม่:** เลข valid ใหม่ → กรอก → ส่ง → Swal แสดง `TKC69-001` และ Telegram ขึ้น "📚 รายใหม่"
2. **รายเก่าเจอด้วยเลขบัตร:** ใช้เลขเดิมจากข้อ 1 เลือกรายเก่า → เห็นชื่อมาสก์ → ยืนยัน → ฟอร์ม prefill → แก้รายได้ → ส่ง → Telegram ขึ้น "🔄 รายเก่า update ข้อมูล" (ใบเดิมปีเดียวกันถูก update ไม่สร้างซ้ำ)
3. **รายเก่าค้นชื่อ+ผูกเลข:** ค้นชื่อจากข้อมูล migrate (เช่น "ณรงค์ฤทธิ์") ด้วยเลข valid อีกตัว → ผูกเลขสำเร็จ + prefill ข้อมูลปี 2568 → **ไม่ต้องกดส่ง** → ตรวจในแอดมินว่า applicant นั้นมี citizenId แล้ว และค้นชื่อเดิมซ้ำต้อง**ไม่เจอ**แล้ว (ผูกเลขแล้วหายจากค้นชื่อ)
4. **หาไม่เจอ→รายใหม่:** ค้นชื่อมั่ว → ไม่เจอ → ปุ่ม "ยื่นเป็นรายใหม่" ใช้ได้

- [ ] **Step 18.4: ตรวจฝั่งแอดมิน**

- แท็บปี 2568 เห็นข้อมูล migrate ครบ, แท็บ 2569 เห็นรายการทดสอบ
- แก้รูปในรายการทดสอบ → บันทึกแล้วรูปเปลี่ยนจริง + Telegram ขึ้น "🖼️ เปลี่ยนรูปภาพ"
- สร้างใบสมัครทดสอบ 2 ใบเบอร์เดียวกัน → เห็นป้าย "🏠 บ้านเดียวกัน"; ตั้ง "ได้รับทุน" ใบแรกแล้วลองตั้งใบที่สอง → มี dialog เตือน
- ลบรายการทดสอบทั้งหมดออก (ปุ่มลบในหน้า detail) — ตรวจว่า applicant ที่ไม่เหลือใบถูกลบตาม
- แก้ไข: ผูกเลขบัตรที่ผูกไว้ในข้อ 18.3(3) เป็นของจริงหรือปล่อยไว้ (ข้อมูลจริงของเทศบาล — ปรึกษาเจ้าหน้าที่)

- [ ] **Step 18.5: ตรวจรับสุดท้าย**

```bash
npm run lint && npm run build
```
Expected: ผ่านทั้งคู่ จากนั้นใช้ superpowers:finishing-a-development-branch เพื่อตัดสินใจ merge/PR (branch `smart-school` → PR เข้า `main` ตามธรรมเนียม repo)

---

## เช็คลิสต์ความครอบคลุม spec (self-review แล้ว)

| ข้อกำหนดใน spec | Task |
|---|---|
| helpers เลขบัตร/ปีงบ/มาสก์ | 1 |
| โมเดล 2 ชั้น + citizenId unique sparse + เลขใบสมัคร atomic | 2 |
| n8n 3 events + header "รายเก่า update ข้อมูล" + ENV override | 3, 16 |
| migration idempotent + dry-run + ไม่แตะ collection เดิม | 4, 18 |
| lookup มาสก์ + ค้นชื่อเฉพาะที่ยังไม่ผูกเลข | 5 |
| verify ผูกเลขให้รายเก่า + กันเลขซ้ำ | 6 |
| submit upsert รายปี + isRenewal ฝั่ง server + n8n | 7 |
| admin auth pattern pm25 + list + flags ครัวเรือน | 8 |
| update รับ imageUrl (แก้บั๊กรูปหาย) + n8n images_changed + backfill เลขบัตร | 9 |
| delete ใบซ้ำ (+ลบบุคคลเมื่อไม่เหลือใบ) | 9 |
| wizard 3 ขั้น + กติกาแจ้งในฟอร์ม + prefill + hint ค่าเดิม | 10-12 |
| หน้าแอดมิน แท็บปี/ตาราง/แผนที่/สถานะ 4 ค่า/ป้ายเตือน/dialog ก่อนให้ทุน | 13-14 |
| checklist 4 จุดหน้าแอดมิน + redirect + สคริปต์สิทธิ์ | 15 |
| แก้ n8n jsonBody + รองรับ payload เก่า + publish | 16 |
| ปลดระวางโมดูลเก่า + docs/modules + CLAUDE.md | 17 |
| ตรวจรับ 4 เส้นทาง + household flags + images_changed | 18 |




