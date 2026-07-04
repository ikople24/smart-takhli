# Smart School — Scholarship Consideration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ต่อยอดโมดูล smart-school ให้รองรับกระบวนการพิจารณา/จัดสรรทุน: เลิกใช้เลขบัตร (ค้นชื่อ), blocklist โรงเรียนไม่ผ่าน, เกณฑ์คุณสมบัติ (โรงเรียน+ทะเบียนบ้าน), แท็กครัวเรือนเดียวกันแบบระบุตัว, และโต๊ะจัดสรรทุนตามโควตาต่อระดับ (เจ้าหน้าที่เลือกเอง)

**Architecture:** ต่อจากโครง "บุคคล + ใบสมัครรายปี" เดิม เพิ่ม (1) ค่าคงที่โควตา/ระดับ, (2) collection `school_blocked_schools` (blocklist โรงเรียนไม่ผ่าน), (3) ฟิลด์เกณฑ์ใน SchoolApplication, (4) แก้ public API ให้ค้นชื่อ (ตัด citizenId), (5) household grouping จากที่อยู่, (6) โต๊ะจัดสรรใน `/admin/smart-school`. ทำตามลำดับ **C→A→B→D**

**Tech Stack:** Next.js 15 Pages Router, React 19, MongoDB/Mongoose, Clerk (admin), Zod, Tailwind+DaisyUI

**Spec:** `docs/superpowers/specs/2026-07-04-smart-school-scholarship-consideration-design.md`

**ข้อควรรู้:**
- Repo **ไม่มี test runner** — ตรวจ helper ล้วนด้วย `node -e` (indirect-eval shim `(0, eval)(...)`), ตรวจภาพรวมด้วย `npm run lint` + `npm run build`
- `.env.local` มี `MONGO_URI` ชี้ฐานจริง — สคริปต์อ่าน/dry-run รันได้; ขั้นเขียนจริงทำตอน cutover
- โมดูล smart-school ที่ ship ใน PR #89 ยังไม่ deploy — ปรับได้เต็มที่ (migration 2568 รันไปแล้ว 238 ราย บนฐานจริง)
- Commit ทุกจบ task; branch: ทำต่อบน `smart-school` (หรือ branch ใหม่ตามที่ coordinator กำหนด)

**Prerequisite:** ไม่ต้องวางไฟล์ CSV. blocklist โรงเรียนไม่ผ่านให้แอดมินเพิ่มเอง (หรือ seed จากชื่อที่ผู้ใช้ให้ใน `scripts/seed-blocked-schools.js`)

---

## File Structure

```
lib/smart-school/
  scholarshipLevels.js   — โควตา/เงิน/ระดับ + levelBucket() + normalizeSchool() + householdKeyOf()
models/smart-school/
  BlockedSchool.js       — collection school_blocked_schools (รร.ไม่ผ่าน เอกชน/นอกเขต)
  SchoolApplicant.js     — [แก้] ลบ citizenId
  SchoolApplication.js   — [แก้] +residencyOverOneYear/schoolEligibility/eligibilityChecklist/householdKey/scholarshipAmount
scripts/
  seed-blocked-schools.js            — [option] seed รร.เอกชนเริ่มต้น (idempotent)
pages/api/smart-school/
  blocked-schools/index.js  — GET list / PUT upsert / DELETE (admin)
  blocked-schools/public.js — GET (ไม่ auth) คืน name+reason ให้ฟอร์ม
  lookup.js   — [แก้] ค้นด้วยชื่อเท่านั้น, คืน level+community
  prefill.js  — [ใหม่] POST { ref } → ข้อมูลใบล่าสุด (แทน verify)
  verify.js   — [ลบ]
  submit.js   — [แก้] ตัด citizenId + รับ ref/residency/schoolName + คำนวณ eligibility/householdKey
  list.js     — [แก้] household grouping จาก householdKey + คืน members; ตัด rotation flags; +levelBucket/eligibility
  update.js   — [แก้] รับฟิลด์ใหม่ + backfill householdKey
  status.js   — [แก้] เซ็ต scholarshipAmount เมื่อเป็น "ได้รับทุน"
  award.js    — [ใหม่] (option) PUT ตั้ง/ถอนได้รับทุน (หรือรวมใน status.js)
components/smart-school/survey/
  IdentityStep.jsx  — [แก้] ตัดเลขบัตร, ค้นชื่อ primary
  InfoStep.jsx      — [แก้] +ช่องโรงเรียน (เตือนถ้าตรง blocklist) +คำถามทะเบียนบ้าน
  SchoolSurveyModal.jsx — [แก้] ตัด citizen จาก state/submit, prefill ผ่าน ref
components/smart-school/admin/
  SmartSchoolDashboard.jsx — [แก้] +แท็บ "จัดสรรทุน" + "สถานศึกษา"
  ApplicationTable.jsx     — [แก้] แท็บระดับ + แท็กครัวเรือนระบุตัว + คอลัมน์เกณฑ์
  ApplicationDetailModal.jsx — [แก้] บล็อกสมาชิกครัวเรือน + eligibility + checklist
  ApplicationEditModal.jsx   — [แก้] ตัด citizenId + ฟิลด์เกณฑ์
  BlockedSchoolsPanel.jsx    — [ใหม่] จัดการ blocklist โรงเรียนไม่ผ่าน
  AllocationBoard.jsx        — [ใหม่] โต๊ะจัดสรร (แท็บระดับ + โควตา + เลือกให้ทุน)
```

---

# เฟส C — Blocklist โรงเรียนไม่ผ่าน + ค่าคงที่โควตา

> **ไม่ import ไฟล์ CSV.** เฟส C ทำแค่ blocklist โรงเรียนที่ไม่ผ่าน (เอกชน/นอกเขต)
> ที่แอดมินเพิ่มเองได้ + ฟอร์มเตือนเมื่อชื่อตรง. โรงเรียนที่ไม่อยู่ในลิสต์ = ok

### Task C1: ค่าคงที่ระดับ/โควตา + helper (pure)

**Files:**
- Create: `lib/smart-school/scholarshipLevels.js`

- [ ] **Step C1.1: เขียนไฟล์**

```js
// lib/smart-school/scholarshipLevels.js
// ค่าคงที่ระดับทุน/โควตา/จำนวนเงิน (ปี 2569) + helper แม็ป/normalize
// แก้ปีถัดไปที่ไฟล์นี้ที่เดียว

// กลุ่มระดับทุน (bucket) เรียงจากเล็กไปใหญ่
export const SCHOLARSHIP_LEVELS = [
  { key: "อนุบาล",      label: "อนุบาล",         quota: 35, amount: 2000, levels: ["อนุบาล"] },
  { key: "ประถม",       label: "ประถม",          quota: 80, amount: 2000, levels: ["ประถม"] },
  { key: "ม.ต้น",       label: "ม.ต้น",          quota: 25, amount: 3000, levels: ["มัธยมต้น", "ม.ต้น"] },
  { key: "ม.ปลาย/ปวช.", label: "ม.ปลาย/ปวช.",    quota: 20, amount: 5000, levels: ["มัธยมปลาย", "ม.ปลาย", "ปวช", "ปวช."] },
  { key: "ป.ตรี/ปวส.",  label: "ป.ตรี/ปวส.",     quota: 10, amount: 8000, levels: ["ปริญญาตรี", "ป.ตรี", "ปวส", "ปวส."] },
];

// educationLevel (จากฟอร์ม) → key ของ bucket; ไม่รู้จัก = null
export function levelBucket(educationLevel) {
  const v = String(educationLevel || "").trim();
  const found = SCHOLARSHIP_LEVELS.find((b) => b.levels.includes(v));
  return found ? found.key : null;
}

export function bucketInfo(key) {
  return SCHOLARSHIP_LEVELS.find((b) => b.key === key) || null;
}

// normalize ชื่อสถานศึกษาเพื่อเทียบ blocklist (ตัดช่องว่างซ้ำ/หัวท้าย)
export function normalizeSchool(name) {
  return String(name || "").replace(/\s+/g, " ").trim();
}

// คีย์ครัวเรือนจากที่อยู่ (ตัดช่องว่าง/อักขระ, lowercase); ว่าง = null (ไม่จัดกลุ่ม)
export function householdKeyOf(address) {
  const k = String(address || "").replace(/\s+/g, "").toLowerCase();
  return k.length >= 6 ? k : null; // สั้นเกินไม่น่าเชื่อถือ
}
```

- [ ] **Step C1.2: ตรวจ logic**

Run:
```bash
node -e "
const fs=require('fs');
const load=(p)=>(0,eval)(fs.readFileSync(p,'utf8').replace(/export /g,''));
load('lib/smart-school/scholarshipLevels.js');
console.assert(levelBucket('มัธยมต้น')==='ม.ต้น','FAIL m.ton');
console.assert(levelBucket('ปวช.')==='ม.ปลาย/ปวช.','FAIL pwch');
console.assert(levelBucket('ปวส')==='ป.ตรี/ปวส.','FAIL pws');
console.assert(levelBucket('อนุบาล')==='อนุบาล','FAIL anuban');
console.assert(levelBucket('xxx')===null,'FAIL unknown');
console.assert(SCHOLARSHIP_LEVELS.reduce((s,b)=>s+b.quota,0)===170,'FAIL total quota');
console.assert(bucketInfo('ม.ต้น').amount===3000,'FAIL amount');
console.assert(normalizeSchool('  รร.  วัด   ')==='รร. วัด','FAIL normalize: '+normalizeSchool('  รร.  วัด   '));
console.assert(householdKeyOf('122 หมู่ 2')==='122หมู่2','FAIL hh: '+householdKeyOf('122 หมู่ 2'));
console.assert(householdKeyOf('  ')===null,'FAIL hh empty');
console.log('scholarshipLevels OK');
"
```
Expected: `scholarshipLevels OK` ไม่มี FAIL

- [ ] **Step C1.3: Commit**

```bash
git add lib/smart-school/scholarshipLevels.js
git commit -m "feat(smart-school): ค่าคงที่โควตา/ระดับทุน + helper levelBucket/normalizeSchool/householdKey"
```

---

### Task C2: BlockedSchool model + seed script

**Files:**
- Create: `models/smart-school/BlockedSchool.js`
- Create: `scripts/seed-blocked-schools.js`

- [ ] **Step C2.1: เขียน model**

```js
import mongoose from "mongoose";

// รายชื่อโรงเรียนที่ "ไม่ผ่านเกณฑ์" (เอกชน/นอกเขต) — แอดมินเพิ่ม/ลบเอง
// โรงเรียนที่ไม่อยู่ในลิสต์นี้ถือว่า ok โดยปริยาย (ไม่มี whitelist)
const BlockedSchoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // normalize แล้ว
    reason: { type: String, enum: ["private", "out-of-district", "other"], default: "private" },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.BlockedSchool ||
  mongoose.model("BlockedSchool", BlockedSchoolSchema, "school_blocked_schools");
```

- [ ] **Step C2.2: เขียน seed script** (idempotent — เติมชื่อ รร.เอกชนเริ่มต้น; แอดมินเพิ่มเพิ่มเองภายหลังได้)

```js
// scripts/seed-blocked-schools.js
// seed รายชื่อโรงเรียนไม่ผ่านเกณฑ์เริ่มต้น (เอกชน/นอกเขต) — idempotent (upsert)
//   node --env-file=.env.local scripts/seed-blocked-schools.js
const mongoose = require("mongoose");

// เติมชื่อจริงจากผู้ใช้ (ปล่อยว่างได้ — แอดมินเพิ่มผ่านหน้าเว็บภายหลัง)
const SEED = [
  // { name: "โรงเรียนเอกชน ก", reason: "private" },
];

const normalize = (s) => String(s || "").replace(/\s+/g, " ").trim();

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set");
  if (SEED.length === 0) { console.log("SEED ว่าง — ข้าม (เพิ่มชื่อในไฟล์ก่อน หรือใช้หน้าแอดมิน)"); return; }
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.db.collection("school_blocked_schools");
  let n = 0;
  for (const s of SEED) {
    const name = normalize(s.name);
    if (!name) continue;
    await col.updateOne(
      { name },
      { $set: { name, reason: s.reason || "private", note: s.note || "", updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    n++;
  }
  console.log(`seed blocked schools: ${n} รายการ`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step C2.3: Lint + Commit**

```bash
npm run lint
git add models/smart-school/BlockedSchool.js scripts/seed-blocked-schools.js
git commit -m "feat(smart-school): model BlockedSchool + seed script (รร.ไม่ผ่านเกณฑ์)"
```

---

### Task C3: Blocked-schools API (admin + public)

**Files:**
- Create: `pages/api/smart-school/blocked-schools/index.js`
- Create: `pages/api/smart-school/blocked-schools/public.js`

- [ ] **Step C3.1: เขียน admin API** `blocked-schools/index.js`

```js
import dbConnect from "@/lib/dbConnect";
import BlockedSchool from "@/models/smart-school/BlockedSchool";
import { normalizeSchool } from "@/lib/smart-school/scholarshipLevels";
import { requireSchoolAdmin } from "../_auth";

export default async function handler(req, res) {
  const auth = await requireSchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });
  try {
    await dbConnect();

    if (req.method === "GET") {
      const items = await BlockedSchool.find({}).sort({ name: 1 }).lean();
      return res.status(200).json({ items });
    }
    if (req.method === "PUT") {
      const { name, reason, note } = req.body || {};
      const clean = normalizeSchool(name);
      if (!clean) return res.status(400).json({ message: "ต้องระบุชื่อโรงเรียน" });
      const r = ["private", "out-of-district", "other"].includes(reason) ? reason : "private";
      const doc = await BlockedSchool.findOneAndUpdate(
        { name: clean },
        { name: clean, reason: r, note: note || "" },
        { new: true, upsert: true }
      );
      return res.status(200).json({ item: doc });
    }
    if (req.method === "DELETE") {
      const name = normalizeSchool(req.body?.name || req.query?.name);
      if (!name) return res.status(400).json({ message: "ต้องระบุชื่อ" });
      await BlockedSchool.deleteOne({ name });
      return res.status(200).json({ message: "ลบแล้ว" });
    }
    return res.status(405).json({ message: "Method Not Allowed" });
  } catch (err) {
    console.error("❌ smart-school blocked-schools error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
```

- [ ] **Step C3.2: เขียน public API** `blocked-schools/public.js`

```js
import dbConnect from "@/lib/dbConnect";
import BlockedSchool from "@/models/smart-school/BlockedSchool";

// public: รายชื่อโรงเรียนไม่ผ่านเกณฑ์ (name+reason) ให้ฟอร์มเตือน
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });
  try {
    await dbConnect();
    const items = await BlockedSchool.find({}).select("name reason -_id").lean();
    return res.status(200).json({ items });
  } catch (err) {
    console.error("❌ smart-school blocked-schools public error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
```

- [ ] **Step C3.3: Lint + Commit**

```bash
npm run lint
git add pages/api/smart-school/blocked-schools/
git commit -m "feat(smart-school): API blocked-schools (admin CRUD + public list)"
```

---

### Task C4: BlockedSchoolsPanel (หน้าแอดมิน)

**Files:**
- Create: `components/smart-school/admin/BlockedSchoolsPanel.jsx`
- Modify: `components/smart-school/admin/SmartSchoolDashboard.jsx` (เพิ่มปุ่ม/แท็บ "โรงเรียนไม่ผ่าน")

- [ ] **Step C4.1: เขียน `BlockedSchoolsPanel.jsx`** — ตารางค้น + ฟอร์มเพิ่ม/ลบ; fetch `/api/smart-school/blocked-schools`, PUT เพิ่ม, DELETE ลบ; Swal ยืนยันลบ. โครงเหมือน component แอดมินอื่น (bg-white rounded-2xl, DaisyUI). Header: ช่องค้น + count. แถว: ชื่อ | badge(reason: private/out-of-district/other) | หมายเหตุ | ปุ่มลบ. ใต้ตาราง: ฟอร์มเพิ่ม (input ชื่อ + select reason + input หมายเหตุ + ปุ่มเพิ่ม → PUT แล้ว refetch).

- [ ] **Step C4.2: เสียบเข้า `SmartSchoolDashboard.jsx`** — เพิ่ม `view` value ใหม่ `'blocked'` ในแถบ join ปุ่ม (ข้างปุ่ม ตาราง/แผนที่) ป้าย "โรงเรียนไม่ผ่าน"; เมื่อ `view==='blocked'` render `<BlockedSchoolsPanel />`. import ที่หัวไฟล์.

- [ ] **Step C4.3: Lint + Build + Commit**

```bash
npm run lint && npm run build
git add components/smart-school/admin/BlockedSchoolsPanel.jsx components/smart-school/admin/SmartSchoolDashboard.jsx
git commit -m "feat(smart-school): หน้าแอดมินจัดการ blocklist โรงเรียนไม่ผ่าน"
```

---

# เฟส A — ฟอร์มสาธารณะ: เลิกเลขบัตร + ค้นชื่อ + เกณฑ์

### Task A1: แก้ models (ลบ citizenId + เพิ่มฟิลด์เกณฑ์)

**Files:**
- Modify: `models/smart-school/SchoolApplicant.js`
- Modify: `models/smart-school/SchoolApplication.js`

- [ ] **Step A1.1: `SchoolApplicant.js`** — ลบบรรทัด `citizenId: { type: String, unique: true, sparse: true },` และคอมเมนต์เหนือมันออก (คงฟิลด์อื่น: prefix, name (required, index), phone, legacyApplicantId, legacyId)

- [ ] **Step A1.2: `SchoolApplication.js`** — เพิ่มฟิลด์ก่อน `status:` (หลัง `location`):

```js
    // --- เกณฑ์พิจารณาทุน (เฟส scholarship) ---
    residencyOverOneYear: { type: Boolean, default: null }, // มีชื่อในทะเบียนบ้านในเขต ≥1 ปี (จากฟอร์ม)
    schoolEligibility: { type: String, enum: ["ok", "block"], default: "ok" }, // block ถ้าตรง blocklist
    eligibilityChecklist: {
      residencyVerified: { type: Boolean, default: false },
      schoolVerified: { type: Boolean, default: false },
      documentsVerified: { type: Boolean, default: false },
    },
    householdKey: { type: String, default: null, index: true }, // จัดกลุ่มครัวเรือน
    scholarshipAmount: { type: Number, default: null }, // เงินทุนเมื่อ "ได้รับทุน"
```

- [ ] **Step A1.3: Lint + Commit**

```bash
npm run lint
git add models/smart-school/SchoolApplicant.js models/smart-school/SchoolApplication.js
git commit -m "feat(smart-school): ลบ citizenId + เพิ่มฟิลด์เกณฑ์ทุน (residency/schoolEligibility/checklist/householdKey/amount)"
```

---

### Task A2: แก้ public API — lookup (ชื่อ) + prefill (ใหม่) + ลบ verify

**Files:**
- Modify: `pages/api/smart-school/lookup.js`
- Create: `pages/api/smart-school/prefill.js`
- Delete: `pages/api/smart-school/verify.js`

- [ ] **Step A2.1: เขียนทับ `lookup.js`** — ค้นด้วยชื่อเท่านั้น คืนผลมาสก์ + level + community เพื่อช่วยแยกคนชื่อซ้ำ

```js
import dbConnect from "@/lib/dbConnect";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import { maskName } from "@/lib/smart-school/mask";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  try {
    await dbConnect();
    const { name } = req.body || {};
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ message: "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร" });
    }
    const applicants = await SchoolApplicant.find({
      name: { $regex: escapeRegex(String(name).trim()), $options: "i" },
    })
      .limit(10)
      .lean();

    const results = await Promise.all(
      applicants.map(async (a) => {
        const latest = await SchoolApplication.findOne({ applicantRef: a._id })
          .sort({ surveyYear: -1 })
          .select("surveyYear educationLevel address")
          .lean();
        return {
          ref: String(a._id),
          maskedName: maskName(a.name),
          level: latest?.educationLevel || "",
          lastYear: latest?.surveyYear || null,
        };
      })
    );
    return res.status(200).json({ found: results.length > 0, results });
  } catch (err) {
    console.error("❌ smart-school lookup error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
```

- [ ] **Step A2.2: เขียน `prefill.js`** — รับ `ref` คืนข้อมูลใบล่าสุด (แทน verify)

```js
import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  try {
    await dbConnect();
    const { ref } = req.body || {};
    if (!ref || !mongoose.Types.ObjectId.isValid(ref)) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }
    const applicant = await SchoolApplicant.findById(ref).lean();
    if (!applicant) return res.status(404).json({ message: "ไม่พบข้อมูล" });
    const application = await SchoolApplication.findOne({ applicantRef: applicant._id })
      .sort({ surveyYear: -1 })
      .lean();
    return res.status(200).json({
      applicant: {
        ref: String(applicant._id),
        prefix: applicant.prefix,
        name: applicant.name,
        phone: applicant.phone,
      },
      application,
    });
  } catch (err) {
    console.error("❌ smart-school prefill error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
```

- [ ] **Step A2.3: ลบ verify.js**

```bash
git rm pages/api/smart-school/verify.js
```

- [ ] **Step A2.4: Lint + Commit**

```bash
npm run lint
git add pages/api/smart-school/lookup.js pages/api/smart-school/prefill.js
git commit -m "feat(smart-school): lookup ค้นด้วยชื่อ + prefill ผ่าน ref (ลบ verify/เลขบัตร)"
```

---

### Task A3: แก้ submit.js — ตัด citizenId + รับ ref/residency/school + คำนวณ eligibility/householdKey

**Files:**
- Modify: `pages/api/smart-school/submit.js`

- [ ] **Step A3.1: เขียนทับทั้งไฟล์**

```js
import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import BlockedSchool from "@/models/smart-school/BlockedSchool";
import { getFiscalYearBE } from "@/lib/smart-school/fiscalYear";
import { nextApplicationId } from "@/lib/smart-school/applicationId";
import { notifySchoolEvent } from "@/lib/smart-school/notify";
import { normalizeSchool, householdKeyOf } from "@/lib/smart-school/scholarshipLevels";

// เทียบ schoolName กับ blocklist → 'block' ถ้าตรง ไม่งั้น 'ok'
async function evalSchool(schoolName) {
  const clean = normalizeSchool(schoolName);
  if (!clean) return "ok";
  const blocked = await BlockedSchool.findOne({ name: clean }).lean();
  return blocked ? "block" : "ok";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  try {
    await dbConnect();
    const {
      ref, prefix, fullName, phone, educationLevel, schoolName,
      address, note, housingStatus, householdMembers, annualIncome,
      residencyOverOneYear, image, location,
    } = req.body || {};

    if (!fullName || !Array.isArray(image) || image.length === 0 || !location?.lat) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["fullName", "image", "location.lat"],
      });
    }

    // หา/สร้างทะเบียนบุคคล — รายเก่าอ้างด้วย ref (จาก lookup), รายใหม่สร้างใหม่
    let applicant = null;
    if (ref && mongoose.Types.ObjectId.isValid(ref)) {
      applicant = await SchoolApplicant.findById(ref);
    }
    const isKnownApplicant = !!applicant;
    if (isKnownApplicant) {
      applicant.prefix = prefix || applicant.prefix;
      applicant.name = fullName;
      applicant.phone = phone || applicant.phone;
      await applicant.save();
    } else {
      applicant = await SchoolApplicant.create({
        prefix: prefix || "",
        name: fullName,
        phone: phone || "",
      });
    }

    const surveyYear = getFiscalYearBE();
    const isRenewal =
      isKnownApplicant &&
      !!(await SchoolApplication.exists({
        applicantRef: applicant._id,
        surveyYear: { $lt: surveyYear },
      }));

    const schoolEligibility = await evalSchool(schoolName);
    const fields = {
      educationLevel: educationLevel || "",
      schoolName: normalizeSchool(schoolName),
      address: address || "",
      note: note || "",
      housingStatus: housingStatus || "ไม่ระบุ",
      householdMembers: Math.max(1, parseInt(householdMembers) || 1),
      annualIncome: Math.max(0, parseInt(annualIncome) || 0),
      residencyOverOneYear:
        residencyOverOneYear === true || residencyOverOneYear === false ? residencyOverOneYear : null,
      schoolEligibility,
      householdKey: householdKeyOf(address),
      imageUrl: image.slice(0, 3),
      location: { lat: location.lat, lng: location.lng },
      status: "รับคำร้อง",
      statusUpdatedBy: "",
      statusUpdatedAt: null,
      scholarshipAmount: null,
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
      try {
        application = await SchoolApplication.create({
          applicantRef: applicant._id,
          surveyYear,
          applicationId: await nextApplicationId(surveyYear),
          ...fields,
        });
      } catch (err) {
        if (err.code === 11000) {
          application = await SchoolApplication.findOne({ applicantRef: applicant._id, surveyYear });
          Object.assign(application, fields);
          await application.save();
        } else {
          throw err;
        }
      }
    }

    await notifySchoolEvent(isRenewal ? "school.renewal_updated" : "school.submitted", {
      applicationId: application.applicationId,
      surveyYear,
      name: `${prefix || ""} ${fullName}`.trim(),
      educationLevel: educationLevel || "",
      phone: phone || "",
      address: address || "",
      note: note || "",
      image: image.slice(0, 3),
      location,
    });

    return res.status(200).json({
      message: "Success",
      id: application._id,
      applicationId: application.applicationId,
      isRenewal,
    });
  } catch (err) {
    console.error("❌ smart-school submit error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
```

- [ ] **Step A3.2: Lint + Commit**

```bash
npm run lint
git add pages/api/smart-school/submit.js
git commit -m "feat(smart-school): submit ตัด citizenId + รับ ref/residency/school + คำนวณ eligibility/householdKey"
```

---

### Task A4: แก้ wizard — IdentityStep (ค้นชื่อ) + InfoStep (โรงเรียน/ทะเบียนบ้าน) + orchestrator

**Files:**
- Modify: `components/smart-school/survey/IdentityStep.jsx` (เขียนทับ)
- Modify: `components/smart-school/survey/InfoStep.jsx`
- Modify: `components/smart-school/survey/SchoolSurveyModal.jsx`

- [ ] **Step A4.1: เขียนทับ `IdentityStep.jsx`** — ตัดเลขบัตรทั้งหมด, รายเก่า = ค้นชื่อ → เลือก → prefill

```jsx
import React, { useState } from 'react';

// ขั้นที่ 1: ระบุตัวตน — ค้นด้วยชื่อ (ไม่ใช้เลขบัตร; เจ้าหน้าที่ยืนยันเอกสารเอง)
export default function IdentityStep({ onDone, disabled }) {
  const [mode, setMode] = useState(null); // 'new' | 'renewal'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null | []
  const [selectedRef, setSelectedRef] = useState(null);

  const post = async (url, body) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch {
      return { ok: false, status: 0, data: { message: 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' } };
    }
  };

  const handleSearchName = async () => {
    setError('');
    setSelectedRef(null);
    setLoading(true);
    const { ok, data } = await post('/api/smart-school/lookup', { name: searchName });
    setLoading(false);
    if (!ok) return setError(data.message || 'เกิดข้อผิดพลาด');
    setSearchResults(data.results || []);
  };

  // เลือกรายการ → ดึงข้อมูลใบล่าสุดมา prefill
  const handlePickPrev = async () => {
    setError('');
    setLoading(true);
    const { ok, data } = await post('/api/smart-school/prefill', { ref: selectedRef });
    setLoading(false);
    if (!ok) return setError(data.message || 'ดึงข้อมูลไม่สำเร็จ');
    onDone({ ref: data.applicant.ref, applicant: data.applicant, prevApplication: data.application });
  };

  return (
    <div className="space-y-4">
      <div className="alert alert-info text-xs">
        กรอกข้อมูลตามจริง เจ้าหน้าที่จะตรวจสอบคุณสมบัติและเอกสารอีกครั้ง
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">ท่านเคยยื่นแบบสำรวจนี้มาก่อนหรือไม่</label>
        <div className="flex gap-2 justify-center">
          <button type="button" disabled={disabled || loading}
            className={`btn btn-sm rounded-full flex-1 ${mode === 'new' ? 'btn-info' : 'btn-outline'}`}
            onClick={() => { setMode('new'); setSearchResults(null); setSelectedRef(null); setError(''); }}>
            รายใหม่ (ครั้งแรก)
          </button>
          <button type="button" disabled={disabled || loading}
            className={`btn btn-sm rounded-full flex-1 ${mode === 'renewal' ? 'btn-info' : 'btn-outline'}`}
            onClick={() => { setMode('renewal'); setSearchResults(null); setSelectedRef(null); setError(''); }}>
            รายเก่า (เคยยื่นแล้ว)
          </button>
        </div>
      </div>

      {mode === 'new' && (
        <button type="button" className="btn btn-primary w-full" disabled={loading || disabled}
          onClick={() => onDone({ ref: null, applicant: null, prevApplication: null })}>
          ถัดไป
        </button>
      )}

      {mode === 'renewal' && (
        <div className="card bg-base-200 p-3 space-y-2">
          <label className="text-sm text-gray-600">ค้นด้วยชื่อ-นามสกุลที่เคยยื่น</label>
          <div className="flex gap-2">
            <input type="text" className="input input-bordered input-sm flex-1"
              placeholder="ชื่อ-นามสกุล" value={searchName} disabled={disabled}
              onChange={(e) => setSearchName(e.target.value)} />
            <button type="button" className="btn btn-sm btn-primary"
              disabled={searchName.trim().length < 2 || loading || disabled}
              onClick={handleSearchName}>
              {loading ? <span className="loading loading-spinner loading-xs" /> : 'ค้นหา'}
            </button>
          </div>

          {searchResults && searchResults.length > 0 && (
            <div className="space-y-1">
              {searchResults.map((r) => (
                <label key={r.ref} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" className="radio radio-sm" name="pick"
                    checked={selectedRef === r.ref} onChange={() => setSelectedRef(r.ref)} />
                  {r.maskedName}
                  {r.level ? ` · ${r.level}` : ''}
                  {r.lastYear ? ` · ปีงบ ${r.lastYear}` : ''}
                </label>
              ))}
              <button type="button" className="btn btn-success btn-sm w-full"
                disabled={!selectedRef || loading || disabled} onClick={handlePickPrev}>
                ใช่ ข้อมูลของฉัน — ดึงข้อมูลเดิมมาแก้ไข
              </button>
            </div>
          )}
          {searchResults && searchResults.length === 0 && (
            <p className="text-xs text-gray-500">ไม่พบรายการ</p>
          )}

          <button type="button" className="btn btn-outline btn-sm w-full" disabled={loading || disabled}
            onClick={() => onDone({ ref: null, applicant: null, prevApplication: null })}>
            หาไม่เจอ — ยื่นเป็นรายใหม่
          </button>
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
```

- [ ] **Step A4.2: แก้ `InfoStep.jsx`** — เพิ่ม 2 ส่วนต่อจากช่อง "รายได้ทั้งปี" (ก่อนปิด component):

(ก) เพิ่ม prop `blockedSchools` (array `{name,reason}` จาก orchestrator). ให้เก็บใน formData: เพิ่มคีย์ `schoolName` และ `residencyOverOneYear`.

(ข) เพิ่ม JSX ก่อน `</div>` ปิดนอกสุด:

```jsx
      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">9. สถานศึกษา</label>
        <input type="text" placeholder="ชื่อสถานศึกษา"
          value={formData.schoolName || ''} disabled={disabled}
          onChange={(e) => set({ schoolName: e.target.value })}
          className="input input-bordered w-full" />
        {(() => {
          const clean = (formData.schoolName || '').replace(/\s+/g, ' ').trim();
          const hit = (blockedSchools || []).find((s) => s.name === clean);
          if (hit) return <p className="text-xs text-error">⚠️ โรงเรียนนี้เคยไม่ผ่านเกณฑ์ (เอกชน/นอกเขต) — โปรดตรวจสอบกับเจ้าหน้าที่</p>;
          return null;
        })()}
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">10. ทะเบียนบ้าน</label>
        <p className="text-xs text-gray-500">ท่านมีชื่ออยู่ในทะเบียนบ้านในเขตเทศบาลเมืองตาคลีมาแล้วเกิน 1 ปีหรือไม่</p>
        <div className="flex gap-2">
          {[['ใช่', true], ['ไม่ใช่/ไม่แน่ใจ', false]].map(([label, val]) => (
            <button key={label} type="button" disabled={disabled}
              className={`btn btn-sm rounded-full flex-1 ${formData.residencyOverOneYear === val ? 'btn-info' : 'btn-outline'}`}
              onClick={() => set({ residencyOverOneYear: val })}>
              {label}
            </button>
          ))}
        </div>
      </div>
```

(หมายเหตุ: หมายเลขข้อ "9./10." ให้เลื่อนต่อจากข้อสุดท้ายของ InfoStep ปัจจุบัน — ปรับเลขให้ถูกลำดับจริง)

- [ ] **Step A4.3: แก้ `SchoolSurveyModal.jsx`**
  1. `EMPTY_FORM` เพิ่ม `schoolName: ''`, `residencyOverOneYear: null`
  2. ลบ `identity.citizenId` — เปลี่ยน state `identity` เป็น `{ ref, applicant, prevApplication }`; `handleIdentityDone` รับ `{ ref, applicant, prevApplication }`, prefill เพิ่ม `schoolName: prev.schoolName || ''`, `residencyOverOneYear: prev.residencyOverOneYear ?? null`
  3. โหลด blocklist ตอน modal เปิด: `const [blockedSchools, setBlockedSchools] = useState([])`; `useEffect(() => { if (isOpen) fetch('/api/smart-school/blocked-schools/public').then(r=>r.ok?r.json():{items:[]}).then(d=>setBlockedSchools(d.items||[])).catch(()=>{}); }, [isOpen])` (endpoint public จาก C3 — ไม่ auth)
  4. ส่ง `blockedSchools={blockedSchools}` ให้ `<InfoStep>`
  5. `handleSubmit` body: เปลี่ยน `citizenId: identity.citizenId` → `ref: identity.ref`; เพิ่ม `schoolName: formData.schoolName`, `residencyOverOneYear: formData.residencyOverOneYear`
  6. แก้ alert ขั้น 1 ที่ IdentityStep แล้ว; ลบคอมเมนต์ "เลข 13 หลัก" ที่หัวไฟล์

- [ ] **Step A4.4: ทดสอบ dev (compile + GET only)**

Run: `PORT=3100 npm run dev` (bg) → `curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/` = 200; `curl -s -X POST localhost:3100/api/smart-school/lookup -H 'Content-Type: application/json' -d '{"name":"ก"}'` = 200 (JSON `found/results`); `curl -s localhost:3100/api/smart-school/blocked-schools/public` = 200 (JSON `items`); kill server. **ห้าม submit จริง**

- [ ] **Step A4.5: Lint + Build + Commit**

```bash
npm run lint && npm run build
git add components/smart-school/survey/
git commit -m "feat(smart-school): wizard ค้นชื่อแทนเลขบัตร + ช่องโรงเรียน(เตือน blocklist) + คำถามทะเบียนบ้าน"
```

---

# เฟส B — แท็กครัวเรือนเดียวกัน (ระบุตัว + คลิกดู)

### Task B1: backfill householdKey ให้ record เดิม

**Files:**
- Create: `scripts/backfill-household-key.js`

- [ ] **Step B1.1: เขียนสคริปต์** (idempotent, --dry-run) — เติม `householdKey` จาก `address` ให้ใบสมัครที่ยังเป็น null

```js
// scripts/backfill-household-key.js
// เติม householdKey (จาก address) ให้ใบสมัครเดิมที่ยังไม่มี (record ปี 68 ที่ migrate มา)
//   node --env-file=.env.local scripts/backfill-household-key.js --dry-run
//   node --env-file=.env.local scripts/backfill-household-key.js
const mongoose = require("mongoose");

const householdKeyOf = (address) => {
  const k = String(address || "").replace(/\s+/g, "").toLowerCase();
  return k.length >= 6 ? k : null;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set");
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.db.collection("school_applications");
  const docs = await col.find({ $or: [{ householdKey: { $exists: false } }, { householdKey: null }] })
    .project({ address: 1 }).toArray();
  let updated = 0;
  for (const d of docs) {
    const key = householdKeyOf(d.address);
    if (!key) continue;
    if (!dryRun) await col.updateOne({ _id: d._id }, { $set: { householdKey: key } });
    updated++;
  }
  console.log(`จะเติม householdKey ${updated} / ${docs.length} รายการ${dryRun ? " (--dry-run)" : ""}`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step B1.2: dry-run + Commit**

Run: `node --env-file=.env.local scripts/backfill-household-key.js --dry-run` → พิมพ์จำนวนที่จะเติม
```bash
git add scripts/backfill-household-key.js
git commit -m "feat(smart-school): สคริปต์ backfill householdKey ให้ record เดิม"
```

---

### Task B2: แก้ list.js — household grouping จาก householdKey + คืน members (ตัด rotation)

**Files:**
- Modify: `pages/api/smart-school/list.js`

- [ ] **Step B2.1: เขียนทับส่วนประมวลผล** — แทน block ตั้งแต่ `const prevAwardedSet` ถึงจบ `applications = ...` ด้วย:

```js
    // จัดกลุ่มครัวเรือนจาก householdKey (fallback normalize address)
    const hkOf = (app) =>
      app.householdKey ||
      (String(app.address || "").replace(/\s+/g, "").toLowerCase().length >= 6
        ? String(app.address || "").replace(/\s+/g, "").toLowerCase()
        : null);

    const groups = {};
    for (const app of apps) {
      const k = hkOf(app);
      if (k) (groups[k] = groups[k] || []).push(app);
    }

    const applications = apps.map((app) => {
      const a = app.applicantRef || {};
      const k = hkOf(app);
      const members = (groups[k] || [])
        .filter((m) => String(m._id) !== String(app._id))
        .map((m) => ({
          ref: String(m._id),
          name: (m.applicantRef?.prefix || "") + (m.applicantRef?.name || ""),
          level: m.educationLevel || "",
          status: m.status,
        }));
      return {
        ...app,
        applicantRef: String(a._id || app.applicantRef || ""),
        prefix: a.prefix || "",
        name: a.name || "",
        phone: a.phone || "",
        household: { key: k, members },
      };
    });
```

(ลบ `prevAwarded` ออกจาก `Promise.all` และตัวแปรที่เกี่ยวข้อง; คง `apps` + `yearsRaw`)

- [ ] **Step B2.2: Lint + Commit**

```bash
npm run lint
git add pages/api/smart-school/list.js
git commit -m "feat(smart-school): list household grouping ระบุตัว (ตัด flag หมุนเวียน)"
```

---

### Task B3: แก้ ApplicationTable — แท็บระดับ + แท็กครัวเรือนระบุตัว + คอลัมน์เกณฑ์

**Files:**
- Modify: `components/smart-school/admin/ApplicationTable.jsx`

- [ ] **Step B3.1** เพิ่ม import: `import { SCHOLARSHIP_LEVELS, levelBucket } from '@/lib/smart-school/scholarshipLevels';`

- [ ] **Step B3.2** เพิ่ม state `levelTab` (default `'all'`) และแถบแท็บระดับเหนือตาราง:

```jsx
      <div className="flex flex-wrap gap-1">
        <button className={`btn btn-xs ${levelTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setLevelTab('all')}>ทั้งหมด</button>
        {SCHOLARSHIP_LEVELS.map((b) => {
          const n = rows.filter((r) => levelBucket(r.educationLevel) === b.key).length;
          return (
            <button key={b.key} className={`btn btn-xs ${levelTab === b.key ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setLevelTab(b.key)}>{b.label} ({n})</button>
          );
        })}
      </div>
```

- [ ] **Step B3.3** ใน `filtered` useMemo เพิ่มเงื่อนไข: `if (levelTab !== 'all' && levelBucket(r.educationLevel) !== levelTab) return false;` และเพิ่ม `levelTab` ใน deps

- [ ] **Step B3.4** เปลี่ยนคอลัมน์ "กติกาครัวเรือน" เดิม → แท็กครัวเรือนระบุตัว: แสดง badge เมื่อ `r.household?.members?.length` :

```jsx
                <td className="whitespace-nowrap">
                  {r.household?.members?.length > 0 && (
                    <span className="badge badge-warning badge-sm cursor-pointer"
                      title={`บ้านเดียวกับ: ${r.household.members.map((m) => m.name).join(', ')}`}
                      onClick={() => onDetail(r)}>
                      🏠 บ้านเดียวกัน ({r.household.members.length})
                    </span>
                  )}
                  {r.schoolEligibility === 'block' && <span className="badge badge-error badge-sm ml-1">เอกชน</span>}
                  {r.residencyOverOneYear === false && <span className="badge badge-ghost badge-sm ml-1">ทะเบียน&lt;1ปี?</span>}
                </td>
```

(หัวคอลัมน์เปลี่ยนจาก "กติกาครัวเรือน" → "ครัวเรือน/เกณฑ์"; ลบการอ้าง `r.flags.*` เดิมทั้งหมด)

- [ ] **Step B3.5: Lint + Build + Commit**

```bash
npm run lint && npm run build
git add components/smart-school/admin/ApplicationTable.jsx
git commit -m "feat(smart-school): ตารางแท็บระดับ + แท็กครัวเรือนระบุตัว + ธงเกณฑ์"
```

---

### Task B4: แก้ DetailModal + EditModal (สมาชิกครัวเรือน + eligibility + checklist, ตัด citizenId)

**Files:**
- Modify: `components/smart-school/admin/ApplicationDetailModal.jsx`
- Modify: `components/smart-school/admin/ApplicationEditModal.jsx`

- [ ] **Step B4.1: DetailModal** — (ก) ลบ Row/badge ที่อ้าง `citizenId` และ block `flags.prevYearAwarded/householdAwardedOther` เดิม; (ข) เพิ่มบล็อกสมาชิกครัวเรือน + eligibility:

```jsx
          {row.household?.members?.length > 0 && (
            <div className="alert alert-warning text-xs">
              🏠 สมาชิกครัวเรือนเดียวกัน:
              <ul className="list-disc ml-4">
                {row.household.members.map((m) => (
                  <li key={m.ref}>{m.name} · {m.level || '-'} · {m.status}</li>
                ))}
              </ul>
            </div>
          )}
          <Row label="สถานศึกษา (เกณฑ์)"
            value={`${row.schoolName || '-'} — ${row.schoolEligibility === 'block' ? 'ไม่ผ่าน (เอกชน/นอกเขต) ✗' : 'ok ✓'}`} />
          <Row label="ทะเบียนบ้าน ≥1 ปี"
            value={row.residencyOverOneYear === true ? 'ใช่' : row.residencyOverOneYear === false ? 'ไม่ใช่/ไม่แน่ใจ' : '-'} />
```

- [ ] **Step B4.2: EditModal** — (ก) ลบ field/รัฐ `citizenId` ทั้งหมด (input backfill เลขบัตร + การส่ง citizenId ใน body); (ข) เพิ่มช่องแก้เกณฑ์ + checklist:

```jsx
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">สถานศึกษา</label>
            <input type="text" className="input input-bordered input-sm w-full" value={form.schoolName}
              onChange={(e) => set({ schoolName: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">เกณฑ์โรงเรียน</label>
            <select className="select select-bordered select-sm w-full" value={form.schoolEligibility}
              onChange={(e) => set({ schoolEligibility: e.target.value })}>
              <option value="ok">ผ่าน (ok)</option>
              <option value="block">ไม่ผ่าน (เอกชน/นอกเขต)</option>
            </select>
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-3">
            {[['residencyVerified','ยืนยันทะเบียนบ้าน ≥1 ปี'],['schoolVerified','ยืนยันสถานศึกษา'],['documentsVerified','ยืนยันเอกสารครบ']].map(([k,label]) => (
              <label key={k} className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" className="checkbox checkbox-xs"
                  checked={form.eligibilityChecklist?.[k] || false}
                  onChange={(e) => set({ eligibilityChecklist: { ...form.eligibilityChecklist, [k]: e.target.checked } })} />
                {label}
              </label>
            ))}
          </div>
```
เพิ่มใน `useState` เริ่มต้น: `schoolName: row.schoolName||'', schoolEligibility: row.schoolEligibility||'ok', residencyOverOneYear: row.residencyOverOneYear ?? null, eligibilityChecklist: row.eligibilityChecklist||{residencyVerified:false,schoolVerified:false,documentsVerified:false}` และส่งใน PUT body (update.js รับเพิ่มใน Task B5)

- [ ] **Step B4.3: Build + Commit** (รวมกับ B5 update.js)

---

### Task B5: แก้ update.js รับฟิลด์เกณฑ์ + backfill householdKey เมื่อ address เปลี่ยน

**Files:**
- Modify: `pages/api/smart-school/update.js`

- [ ] **Step B5.1** เพิ่มการรับ/บันทึกฟิลด์: `schoolName`, `schoolEligibility` (validate enum ok/block), `residencyOverOneYear` (bool|null), `eligibilityChecklist` (object 3 bool). เมื่อ `address` เปลี่ยน ให้ set `application.householdKey = householdKeyOf(address)` (import `householdKeyOf` จาก scholarshipLevels). ลบการรับ/backfill `citizenId` ทั้งหมดออก (ไม่มีฟิลด์นี้แล้ว)

- [ ] **Step B5.2: Lint + Build + Commit** (B4+B5)

```bash
npm run lint && npm run build
git add components/smart-school/admin/ApplicationDetailModal.jsx components/smart-school/admin/ApplicationEditModal.jsx pages/api/smart-school/update.js
git commit -m "feat(smart-school): detail/edit แสดง+แก้ครัวเรือน/เกณฑ์/checklist (ตัด citizenId)"
```

---

# เฟส D — โต๊ะจัดสรรทุน (แท็บระดับ + โควตา + เลือกเอง)

### Task D1: status.js เซ็ต scholarshipAmount เมื่อ "ได้รับทุน"

**Files:**
- Modify: `pages/api/smart-school/status.js`

- [ ] **Step D1.1** — import `{ levelBucket, bucketInfo }` จาก scholarshipLevels. เมื่อ `status === "ได้รับทุน"` ให้เซ็ต `scholarshipAmount` = `bucketInfo(levelBucket(application.educationLevel))?.amount || 0`; สถานะอื่นเซ็ต `scholarshipAmount = null`. (ต้อง findById ก่อนเพื่ออ่าน educationLevel แล้ว save — เปลี่ยนจาก findByIdAndUpdate เป็น findById + set + save)

```js
import dbConnect from "@/lib/dbConnect";
import SchoolApplication, { APPLICATION_STATUSES } from "@/models/smart-school/SchoolApplication";
import { levelBucket, bucketInfo } from "@/lib/smart-school/scholarshipLevels";
import { requireSchoolAdmin } from "./_auth";

export default async function handler(req, res) {
  if (req.method !== "PUT") return res.status(405).json({ message: "Method Not Allowed" });
  const auth = await requireSchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });
  try {
    await dbConnect();
    const { _id, status } = req.body || {};
    const mongoose = (await import("mongoose")).default;
    if (!_id || !mongoose.Types.ObjectId.isValid(_id) || !APPLICATION_STATUSES.includes(status)) {
      return res.status(400).json({ message: "ต้องระบุ _id และ status ที่ถูกต้อง" });
    }
    const application = await SchoolApplication.findById(_id);
    if (!application) return res.status(404).json({ message: "Record not found" });
    application.status = status;
    application.statusUpdatedBy = auth.name || "แอดมิน";
    application.statusUpdatedAt = new Date();
    application.scholarshipAmount =
      status === "ได้รับทุน" ? bucketInfo(levelBucket(application.educationLevel))?.amount || 0 : null;
    await application.save();
    return res.status(200).json({ message: "Status updated", status: application.status, scholarshipAmount: application.scholarshipAmount });
  } catch (err) {
    console.error("❌ smart-school status error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
```

- [ ] **Step D1.2: Lint + Commit**

```bash
npm run lint
git add pages/api/smart-school/status.js
git commit -m "feat(smart-school): status เซ็ต scholarshipAmount ตามระดับเมื่อได้รับทุน"
```

---

### Task D2: AllocationBoard component

**Files:**
- Create: `components/smart-school/admin/AllocationBoard.jsx`

- [ ] **Step D2.1: เขียน component** — รับ prop `rows` (จาก list.js, ปีที่เลือก) + `onRefresh`. แท็บย่อยตามระดับ (SCHOLARSHIP_LEVELS) แต่ละแท็บ:
  - หัวแท็บโชว์ `เลือกแล้ว X / โควตา N` (X = จำนวน status "ได้รับทุน" ในระดับนั้น)
  - ตารางผู้สมัครในระดับนั้น (`levelBucket(r.educationLevel)===tab`) เรียงได้ (รายได้ asc/ชื่อ) — คอลัมน์: ชื่อ, โรงเรียน+เกณฑ์(ok/block badge), รายได้, ทะเบียนบ้าน(✓/✗), ครัวเรือน(แท็ก), สถานะ, ปุ่ม toggle "ให้ทุน"
  - ปุ่ม "ให้ทุน" → PUT `/api/smart-school/status` `{ _id, status: 'ได้รับทุน' }`; ถ้าถอน → `{ _id, status: 'ตรวจสอบแล้ว' }`; แล้ว `onRefresh()`
  - เตือน (Swal ก่อน PUT) เมื่อจะให้ทุนแต่ `schoolEligibility==='block'` หรือ `residencyOverOneYear===false` หรือ checklist ไม่ครบ — ข้อความ "ยังไม่ผ่านเกณฑ์: [เหตุ] ยืนยันให้ทุน?" (เตือน ไม่บล็อก)
  - ถ้าเลือกเกินโควตา → แค่ badge หัวแท็บเป็นสีแดง (ไม่บล็อก)
  - โน้ตครัวเรือน: ถ้าจะให้ทุนคนที่มีสมาชิกครัวเรือน level สูงกว่ายังไม่ได้ทุน → ข้อความเตือนใน Swal เพิ่ม "ในบ้านนี้มีระดับสูงกว่ายังไม่ได้เลือก ปกติพิจารณาก่อน"
  - ปุ่ม export CSV รายชื่อผู้ได้ทุนในระดับ (ชื่อ, โรงเรียน, จำนวนเงิน) — ใช้ Blob + a.download

โครงสร้างเหมือน component แอดมินอื่น (DaisyUI table, bg-white). ใช้ `SCHOLARSHIP_LEVELS`, `levelBucket`, `bucketInfo` จาก scholarshipLevels.

- [ ] **Step D2.2: Lint + Build + Commit**

```bash
npm run lint && npm run build
git add components/smart-school/admin/AllocationBoard.jsx
git commit -m "feat(smart-school): โต๊ะจัดสรรทุน แท็บระดับ+โควตา (เจ้าหน้าที่เลือก, เตือนเกณฑ์/ครัวเรือน)"
```

---

### Task D3: เสียบ AllocationBoard เข้า dashboard

**Files:**
- Modify: `components/smart-school/admin/SmartSchoolDashboard.jsx`

- [ ] **Step D3.1** เพิ่ม `view` value `'allocation'` ในแถบ join ปุ่ม ป้าย "จัดสรรทุน"; เมื่อ `view==='allocation'` render `<AllocationBoard rows={data?.applications || []} onRefresh={fetchData} />` (import ที่หัวไฟล์). AllocationBoard ใช้ข้อมูลปีที่ dashboard เลือกอยู่แล้ว (data.applications)

- [ ] **Step D3.2: Lint + Build + Commit**

```bash
npm run lint && npm run build
git add components/smart-school/admin/SmartSchoolDashboard.jsx
git commit -m "feat(smart-school): เสียบโต๊ะจัดสรรทุนเข้าแดชบอร์ด (แท็บจัดสรรทุน)"
```

---

### Task D4: Cutover เฟส (รันจริง) + ตรวจรับ

- [ ] **Step D4.1** seed blocklist (ถ้ามีชื่อ รร.เอกชนที่ผู้ใช้ให้ — ใส่ใน SEED array ก่อน) + backfill householdKey:
```bash
node --env-file=.env.local scripts/seed-blocked-schools.js
node --env-file=.env.local scripts/backfill-household-key.js --dry-run
node --env-file=.env.local scripts/backfill-household-key.js
```
- [ ] **Step D4.2** ตรวจ dev: หน้า `/admin/smart-school` — แท็บ โรงเรียนไม่ผ่าน (เพิ่ม/ลบ blocklist), ตาราง (แท็บระดับ+แท็กบ้าน), จัดสรรทุน (โควตาต่อระดับ, กดให้ทุน→เตือนเกณฑ์/ครัวเรือน, ตัวนับอัปเดต, export)
- [ ] **Step D4.3** ตรวจฟอร์มสาธารณะ: ค้นชื่อ→เลือก→prefill; รายใหม่; เลือกโรงเรียน block→เตือน; คำถามทะเบียนบ้าน — **ทดสอบ submit ด้วยชื่อ "ทดสอบ ระบบ" แล้วลบผ่านแอดมิน**
- [ ] **Step D4.4** `npm run lint && npm run build` ผ่าน → superpowers:finishing-a-development-branch

---

## เช็คลิสต์ความครอบคลุม spec (self-review)

| ข้อกำหนดใน spec | Task |
|---|---|
| โควตา/เงินต่อระดับ + levelBucket | C1 |
| model BlockedSchool + seed script | C2 |
| API blocked-schools (admin + public) | C3 |
| หน้าแอดมินจัดการ blocklist | C4 |
| ลบ citizenId + ฟิลด์เกณฑ์ใน model | A1 |
| lookup ค้นชื่อ + prefill + ลบ verify | A2 |
| submit ตัด citizenId + eligibility/householdKey | A3 |
| wizard ค้นชื่อ + โรงเรียน(เตือน blocklist) + ทะเบียนบ้าน | A4 |
| backfill householdKey | B1 |
| list household grouping ระบุตัว (ตัด rotation) | B2 |
| ตารางแท็บระดับ + แท็กครัวเรือน + ธงเกณฑ์ | B3 |
| detail/edit ครัวเรือน+เกณฑ์+checklist (ตัด citizenId) | B4 |
| update รับฟิลด์เกณฑ์ + householdKey | B5 |
| status เซ็ต scholarshipAmount | D1 |
| โต๊ะจัดสรร แท็บระดับ+โควตา+เลือกเอง+เตือน+export | D2 |
| เสียบเข้า dashboard | D3 |
| cutover import/backfill + ตรวจรับ | D4 |

**หมายเหตุ self-review:** ตัด rotation/prevYearAwarded ออกทุกจุด (list B2, table B3, detail B4) ให้ตรงกติกาใหม่; `householdKeyOf`/`levelBucket`/`normalizeSchool` ใช้ชื่อเดียวกันทุก task (นิยามที่ C1); ฟอร์ม public ใช้ `/api/smart-school/blocked-schools/public` (ไม่ auth) ไม่ใช่ `/blocked-schools` (auth); schoolEligibility มี 2 ค่า `ok`/`block` (default ok) ทุกที่




