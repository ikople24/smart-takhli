# Smart School — Citizen ID Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เจ้าหน้าที่กรอกเลขบัตรประชาชน 13 หลักของผู้สมัคร smart-school ผ่านหน้าแอดมิน (แท็บ worklist + ฟอร์มแก้ไข) เพื่อ backfill ฐานข้อมูลปีนี้ เตรียมยืนยันตัวตนด้วยเลขบัตรปีหน้า

**Architecture:** เพิ่ม `citizenId` (unique sparse) ในทะเบียนบุคคล `SchoolApplicant`; helper ตรวจ checksum/mask เป็น pure function ใช้ร่วม client-server; logic ผูก/ล้าง/เช็คซ้ำรวมศูนย์ที่ `pages/api/smart-school/_citizenId.js` ใช้ทั้ง endpoint ใหม่ `citizen-id` และ `update` เดิม; **เลขเต็มไม่ออกจากเซิร์ฟเวอร์** — ทุก API ตอบเฉพาะเลขมาสก์

**Tech Stack:** Next.js 15 Pages Router, Mongoose, Clerk (ผ่าน `requireSchoolAdmin` เดิม), Tailwind/DaisyUI ตามโทเคน `adminTheme.jsx`

**Spec:** `docs/superpowers/specs/2026-07-15-smart-school-citizen-id-backfill-design.md`

**ข้อจำกัดโปรเจกต์:** ไม่มี test runner (ตาม CLAUDE.md) — helper ตรวจด้วย node dynamic-import assertion, ส่วน API/UI ใช้ `npm run lint` + manual checklist ท้ายแผน

**หมายเลขบัตรสำหรับทดสอบ (checksum ผ่านจริง):**
- `1234567890121` — valid
- `3100902288664` — valid (ใช้เป็น "เลขของอีกคน" ตอนทดสอบเลขซ้ำ)
- `1234567890122` — invalid (checksum ผิด)

---

### Task 1: Pure helper `lib/smart-school/citizenId.js`

**Files:**
- Create: `lib/smart-school/citizenId.js`

- [ ] **Step 1.1: เขียนไฟล์ helper**

```js
// lib/smart-school/citizenId.js
// helper กลางเลขบัตรประชาชน 13 หลัก — pure function ใช้ได้ทั้ง server และ client
// (ห้าม import mongoose/model ในไฟล์นี้ — client component ใช้ตรวจ checksum ด้วย)

// ตัดขีด/ช่องว่าง เหลือ digits-only
export function normalizeCitizenId(input = "") {
  return String(input || "").replace(/\D/g, "");
}

// 13 หลัก + checksum mod-11: หลักที่ 13 = (11 - (Σ หลักที่ i × (13-i)) mod 11) mod 10
export function isValidThaiCitizenId(input = "") {
  const d = normalizeCitizenId(input);
  if (!/^\d{13}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(d[12]);
}

// มาสก์ตามฟอร์แมตบัตร 1-2345-67890-12-3 → เห็นหลัก 1–5 กับหลักสุดท้าย: "1-2345-xxxxx-xx-3"
export function maskCitizenId(input = "") {
  const d = normalizeCitizenId(input);
  if (d.length !== 13) return "";
  return `${d[0]}-${d.slice(1, 5)}-xxxxx-xx-${d[12]}`;
}
```

- [ ] **Step 1.2: Verify ด้วย node (dynamic import — ใช้ได้แม้ repo เป็น CJS)**

Run:
```bash
node -e "import('./lib/smart-school/citizenId.js').then(m => { console.log([m.isValidThaiCitizenId('1234567890121'), m.isValidThaiCitizenId('3100902288664'), m.isValidThaiCitizenId('1234567890122'), m.isValidThaiCitizenId('123456789012'), m.isValidThaiCitizenId(''), m.maskCitizenId('1-2345-67890-12-1'), m.normalizeCitizenId(' 1-2345-67890-12-1 ')].join(' | ')); })"
```
Expected output:
```
true | true | false | false | false | 1-2345-xxxxx-xx-1 | 1234567890121
```

- [ ] **Step 1.3: Commit**

```bash
git add lib/smart-school/citizenId.js
git commit -m "feat(smart-school): helper เลขบัตร 13 หลัก (normalize/checksum/mask)"
```

---

### Task 2: Model `SchoolApplicant` + index sync script

**Files:**
- Modify: `models/smart-school/SchoolApplicant.js` (ทั้งไฟล์ 17 บรรทัด)
- Create: `scripts/sync-school-citizenid-index.js`

- [ ] **Step 2.1: แก้ model — แทนที่ทั้งไฟล์ด้วย**

```js
import mongoose from "mongoose";

// ทะเบียนบุคคล (ผู้ขอทุน) — 1 คน = 1 เอกสาร ข้ามปี
const SchoolApplicantSchema = new mongoose.Schema(
  {
    prefix: { type: String, default: "" },
    name: { type: String, required: true, index: true },
    phone: { type: String, default: "" }, // ข้อมูลติดต่อ + สัญญาณจัดกลุ่มครัวเรือน (ไม่ใช่ตัวยืนยันตัวตน)
    // เลขบัตรประชาชน 13 หลัก digits-only — เจ้าหน้าที่ backfill ฝั่งแอดมิน (spec 2026-07-15)
    // คนยังไม่มีเลข = ไม่มีฟิลด์ (undefined) ห้ามเซ็ต ""/null ไม่งั้น unique sparse ชนกันเอง
    citizenId: { type: String },
    legacyApplicantId: { type: String, default: null }, // TKC-xxx เดิม
    legacyId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true }, // _id ใน educationregisters
  },
  { timestamps: true }
);

SchoolApplicantSchema.index({ citizenId: 1 }, { unique: true, sparse: true });

export default mongoose.models.SchoolApplicant ||
  mongoose.model("SchoolApplicant", SchoolApplicantSchema, "school_applicants");
```

**ห้าม** ใส่ `default: null`/`default: ""` ที่ `citizenId` — จะทำให้ทุกเอกสารมีค่าและ unique index ชนกันทันที

- [ ] **Step 2.2: สร้างสคริปต์ sync index สำหรับโปรดักชัน (สไตล์เดียวกับ `scripts/grant-elderly-school-permission.js` — CommonJS + `--env-file`)**

```js
// One-time: สร้าง unique sparse index ของ citizenId ใน school_applicants (โปรดักชัน)
// dev ไม่ต้องรัน — mongoose autoIndex สร้างให้เมื่อ dev server โหลด model ใหม่
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/sync-school-citizenid-index.js
//
// รันซ้ำได้ — createIndex เป็น no-op ถ้า index มีอยู่แล้ว

const mongoose = require("mongoose");

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local");
  }
  await mongoose.connect(process.env.MONGO_URI);
  const name = await mongoose.connection
    .collection("school_applicants")
    .createIndex({ citizenId: 1 }, { unique: true, sparse: true });
  console.log("✅ index:", name);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
```

- [ ] **Step 2.3: Verify — รันสคริปต์กับ DB dev (ใช้ `.env.local` ที่มีอยู่)**

Run: `node --env-file=.env.local scripts/sync-school-citizenid-index.js`
Expected: `✅ index: citizenId_1` (exit 0; รันซ้ำได้ผลเหมือนเดิม)

- [ ] **Step 2.4: Commit**

```bash
git add models/smart-school/SchoolApplicant.js scripts/sync-school-citizenid-index.js
git commit -m "feat(smart-school): เพิ่ม citizenId (unique sparse) ใน SchoolApplicant + สคริปต์ sync index"
```

---

### Task 3: Server helper `_citizenId.js` (resolve/apply — ศูนย์กลาง logic ผูกเลข)

**Files:**
- Create: `pages/api/smart-school/_citizenId.js`

ไฟล์ขึ้นต้น `_` ใต้ `pages/` ไม่ถูก map เป็น route (แบบเดียวกับ `_auth.js` ที่อยู่โฟลเดอร์เดียวกัน)

- [ ] **Step 3.1: เขียนไฟล์**

```js
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import { normalizeCitizenId, isValidThaiCitizenId } from "@/lib/smart-school/citizenId";

// ตรวจคำขอเปลี่ยนเลขบัตร (ยังไม่เขียน DB) — คืน action ให้ผู้เรียก apply ทีหลัง
// raw === undefined → ไม่แตะ | null/"" → ล้าง | อื่น ๆ → validate checksum + เช็คซ้ำ
export async function resolveCitizenIdChange(applicantId, raw) {
  if (raw === undefined) return { ok: true, action: "none" };
  if (raw === null || String(raw).trim() === "") return { ok: true, action: "clear" };

  const citizenId = normalizeCitizenId(raw);
  if (!isValidThaiCitizenId(citizenId)) {
    return {
      ok: false,
      status: 400,
      message: "เลขบัตรประชาชนไม่ถูกต้อง (ต้องครบ 13 หลักและ checksum ผ่าน)",
    };
  }

  const dup = await SchoolApplicant.findOne({
    citizenId,
    _id: { $ne: applicantId },
  }).lean();
  if (dup) {
    const latestApp = await SchoolApplication.findOne({ applicantRef: dup._id })
      .sort({ surveyYear: -1 })
      .select("surveyYear")
      .lean();
    const dupName = `${dup.prefix || ""}${dup.name || ""}`;
    return {
      ok: false,
      status: 409,
      message: `เลขนี้ถูกผูกกับ ${dupName}${latestApp ? ` (ปีงบ ${latestApp.surveyYear})` : ""} แล้ว`,
      duplicateOf: { name: dupName, latestYear: latestApp?.surveyYear ?? null },
    };
  }
  return { ok: true, action: "set", citizenId };
}

// เขียนผลจาก resolveCitizenIdChange ลง DB — ล้างต้อง $unset (ห้ามเซ็ต ""/null เพราะ unique sparse)
// race ระหว่าง resolve→apply มี unique index กันชั้นสุดท้าย: ผู้เรียกต้อง catch err.code === 11000 → 409
export async function applyCitizenIdChange(applicantId, resolved) {
  if (resolved.action === "clear") {
    await SchoolApplicant.updateOne({ _id: applicantId }, { $unset: { citizenId: 1 } });
  } else if (resolved.action === "set") {
    await SchoolApplicant.updateOne({ _id: applicantId }, { $set: { citizenId: resolved.citizenId } });
  }
}
```

- [ ] **Step 3.2: Lint**

Run: `npm run lint`
Expected: ผ่าน (no errors; warning เดิมของโปรเจกต์ถ้ามีไม่นับ)

- [ ] **Step 3.3: Commit**

```bash
git add pages/api/smart-school/_citizenId.js
git commit -m "feat(smart-school): server helper resolve/apply เลขบัตร (validate + dup-check รวมศูนย์)"
```

---

### Task 4: Endpoint ใหม่ `PUT /api/smart-school/citizen-id`

**Files:**
- Create: `pages/api/smart-school/citizen-id.js`

- [ ] **Step 4.1: เขียนไฟล์**

```js
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import { maskCitizenId } from "@/lib/smart-school/citizenId";
import { resolveCitizenIdChange, applyCitizenIdChange } from "./_citizenId";
import { requireSchoolAdmin } from "./_auth";

// PUT { applicantRef, citizenId } — citizenId: เลข 13 หลัก = ผูก, null = ล้าง
// ตอบกลับเฉพาะเลขมาสก์ — เลขเต็มไม่ออกจากเซิร์ฟเวอร์ (PDPA, ดู spec 2026-07-15)
export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  const auth = await requireSchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  try {
    await dbConnect();
    const { applicantRef, citizenId } = req.body || {};
    if (!applicantRef || !mongoose.Types.ObjectId.isValid(applicantRef)) {
      return res.status(400).json({ message: "applicantRef ไม่ถูกต้อง" });
    }
    if (citizenId === undefined) {
      // กันเคสลืมส่งฟิลด์แล้วกลายเป็นล้างเลขโดยไม่ตั้งใจ — ต้องส่ง null ชัด ๆ ถึงจะล้าง
      return res.status(400).json({ message: "ต้องส่ง citizenId (ส่ง null เพื่อล้างเลข)" });
    }
    const applicant = await SchoolApplicant.findById(applicantRef).lean();
    if (!applicant) return res.status(404).json({ message: "Applicant not found" });

    const resolved = await resolveCitizenIdChange(applicant._id, citizenId);
    if (!resolved.ok) {
      return res
        .status(resolved.status)
        .json({ message: resolved.message, duplicateOf: resolved.duplicateOf });
    }
    await applyCitizenIdChange(applicant._id, resolved);

    return res.status(200).json({
      citizenIdMasked: resolved.action === "set" ? maskCitizenId(resolved.citizenId) : null,
    });
  } catch (err) {
    if (err?.code === 11000) {
      // race กับ request อื่น — unique index กันไว้ชั้นสุดท้าย
      return res.status(409).json({ message: "เลขนี้ถูกใช้กับผู้สมัครคนอื่นแล้ว" });
    }
    console.error("❌ smart-school citizen-id error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
```

- [ ] **Step 4.2: Verify — ยิงโดยไม่ล็อกอิน ต้องโดน 401**

Run (dev server ต้องรันอยู่: `npm run dev`):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PUT http://localhost:3000/api/smart-school/citizen-id -H "Content-Type: application/json" -d '{"applicantRef":"000000000000000000000000","citizenId":"1234567890121"}'
```
Expected: `401`

- [ ] **Step 4.3: Lint + Commit**

Run: `npm run lint` → ผ่าน
```bash
git add pages/api/smart-school/citizen-id.js
git commit -m "feat(smart-school): API PUT citizen-id — ผูก/ล้างเลขบัตร ตอบเฉพาะเลขมาสก์"
```

---

### Task 5: `update.js` รับ `citizenId` (ให้ Edit Modal บันทึกรวมครั้งเดียว)

**Files:**
- Modify: `pages/api/smart-school/update.js`

- [ ] **Step 5.1: เพิ่ม import (ใต้ `import { requireSchoolAdmin } from "./_auth";` บรรทัด 7)**

```js
import { resolveCitizenIdChange, applyCitizenIdChange } from "./_citizenId";
```

- [ ] **Step 5.2: เพิ่ม `citizenId` ใน destructuring (บรรทัด 18–25 เดิม)**

แก้บรรทัด `schoolEligibility, residencyOverOneYear, eligibilityChecklist,` เป็น:

```js
      schoolEligibility, residencyOverOneYear, eligibilityChecklist,
      citizenId,
```

- [ ] **Step 5.3: resolve ก่อนบันทึกฟิลด์อื่น — วางต่อจากบรรทัด `if (!applicant) return res.status(404)...` (บรรทัด 35 เดิม)**

```js
    // เลขบัตร: ตรวจ checksum + เช็คซ้ำก่อนแตะฟิลด์อื่น — พังแล้วพังทั้งก้อน ไม่บันทึกครึ่งเดียว
    // (undefined = client ไม่ได้ส่งมา = ไม่แตะเลขเดิม)
    const citizenResolved = await resolveCitizenIdChange(applicant._id, citizenId);
    if (!citizenResolved.ok) {
      return res.status(citizenResolved.status).json({
        message: citizenResolved.message,
        duplicateOf: citizenResolved.duplicateOf,
      });
    }
```

- [ ] **Step 5.4: apply หลัง validate ก่อน save — แก้บล็อกบรรทัด 80–83 เดิม**

จากเดิม:
```js
    // validate ใบสมัครก่อนค่อยบันทึกทั้งคู่ — กันเคสบันทึกบุคคลไปแล้วแต่ใบสมัคร validate ไม่ผ่าน
    await application.validate();
    await applicant.save();
    await application.save();
```

เป็น:
```js
    // validate ใบสมัครก่อนค่อยบันทึกทั้งคู่ — กันเคสบันทึกบุคคลไปแล้วแต่ใบสมัคร validate ไม่ผ่าน
    await application.validate();
    // เลขบัตร apply ก่อน save อื่น — ถ้าแพ้ race (E11000) จะยังไม่มีอะไรถูกบันทึก
    await applyCitizenIdChange(applicant._id, citizenResolved);
    await applicant.save();
    await application.save();
```

- [ ] **Step 5.5: เพิ่ม 409 ใน catch — แก้บล็อก catch (บรรทัด 101–107 เดิม)**

จากเดิม:
```js
  } catch (err) {
    console.error("❌ smart-school update error:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: "ข้อมูลไม่ผ่านการตรวจสอบของระบบ" });
    }
    return res.status(500).json({ message: "Server error" });
  }
```

เป็น:
```js
  } catch (err) {
    if (err?.code === 11000) {
      // แพ้ race ผูกเลขบัตร — unique index กันไว้ชั้นสุดท้าย
      return res.status(409).json({ message: "เลขบัตรนี้ถูกใช้กับผู้สมัครคนอื่นแล้ว" });
    }
    console.error("❌ smart-school update error:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: "ข้อมูลไม่ผ่านการตรวจสอบของระบบ" });
    }
    return res.status(500).json({ message: "Server error" });
  }
```

**ระวัง:** `applicant.save()` หลัง `applyCitizenIdChange` จะไม่ทับ `citizenId` เพราะ document `applicant` ที่โหลดไว้ไม่เคยแตะฟิลด์นี้ (mongoose save เขียนเฉพาะ path ที่ modified)

- [ ] **Step 5.6: Lint + Commit**

Run: `npm run lint` → ผ่าน
```bash
git add pages/api/smart-school/update.js
git commit -m "feat(smart-school): update.js รับ citizenId (validate+dup-check ก่อนบันทึกทั้งก้อน)"
```

---

### Task 6: `list.js` แนบ `hasCitizenId` + `citizenIdMasked`

**Files:**
- Modify: `pages/api/smart-school/list.js`

- [ ] **Step 6.1: เพิ่ม import (ใต้บรรทัด 4)**

```js
import { maskCitizenId } from "@/lib/smart-school/citizenId";
```

- [ ] **Step 6.2: เพิ่ม 2 ฟิลด์ในผลลัพธ์ — แก้ return ใน `apps.map` (บรรทัด 50–57 เดิม)**

จากเดิม:
```js
      return {
        ...app,
        applicantRef: String(a._id || app.applicantRef || ""),
        prefix: a.prefix || "",
        name: a.name || "",
        phone: a.phone || "",
        household: { key: k, members },
      };
```

เป็น:
```js
      return {
        ...app,
        applicantRef: String(a._id || app.applicantRef || ""),
        prefix: a.prefix || "",
        name: a.name || "",
        phone: a.phone || "",
        // เลขเต็มอยู่ใน a.citizenId (populate) — mask ฝั่ง server เท่านั้น ห้ามส่งเลขเต็มออก
        hasCitizenId: !!a.citizenId,
        citizenIdMasked: a.citizenId ? maskCitizenId(a.citizenId) : null,
        household: { key: k, members },
      };
```

หมายเหตุ: `...app` ไม่ spread ฟิลด์ของ applicant (มันอยู่ใน `app.applicantRef` ซึ่งถูกแทนด้วย string แล้ว) — เลขเต็มจึงไม่รั่วออกไป

- [ ] **Step 6.3: Verify — ยิง list ผ่าน browser ที่ล็อกอินแล้ว**

เปิด `/admin/smart-school` → DevTools Network → ดู response ของ `/api/smart-school/list`
Expected: ทุกแถวมี `hasCitizenId: false, citizenIdMasked: null` (ยังไม่มีใครมีเลข) และ**ไม่มี key `citizenId`** ใน response

- [ ] **Step 6.4: Lint + Commit**

Run: `npm run lint` → ผ่าน
```bash
git add pages/api/smart-school/list.js
git commit -m "feat(smart-school): list แนบ hasCitizenId + citizenIdMasked (ไม่ส่งเลขเต็ม)"
```

---

### Task 7: แท็บ worklist "เลขบัตร" — `CitizenIdPanel.jsx` + ต่อเข้า dashboard

**Files:**
- Create: `components/smart-school/admin/CitizenIdPanel.jsx`
- Modify: `components/smart-school/admin/SmartSchoolDashboard.jsx`

- [ ] **Step 7.1: เขียน `CitizenIdPanel.jsx`**

```jsx
import React, { useMemo, useRef, useState } from 'react';
import { cardCls, inputCls, tableHeadCls, successBtnCls } from '@/components/smart-school/adminTheme';
import { normalizeCitizenId, isValidThaiCitizenId } from '@/lib/smart-school/citizenId';

// แท็บ "เลขบัตร" — worklist ให้เจ้าหน้าที่ไล่กรอกเลขบัตร 13 หลักของผู้สมัครปีงบที่เลือก
// Enter = บันทึกแล้วเด้ง focus ไปแถวถัดไป; บันทึกสำเร็จเก็บ masked ใน savedMap
// (ไม่ refetch ทั้งลิสต์ กัน focus หลุด — dashboard refetch เองตอนเปลี่ยนปี/แก้ไขผ่าน modal)
export default function CitizenIdPanel({ rows }) {
  const [savedMap, setSavedMap] = useState({}); // applicantRef -> masked (บันทึกรอบนี้)
  const [errorMap, setErrorMap] = useState({}); // applicantRef -> ข้อความ error
  const [inputMap, setInputMap] = useState({}); // applicantRef -> ค่าที่พิมพ์
  const [savingRef, setSavingRef] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState('');
  const inputRefs = useRef({});

  // 1 คน = 1 แถวต่อปีงบ (unique applicantRef+surveyYear การันตีจาก model)
  const withStatus = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        done: !!savedMap[r.applicantRef] || r.hasCitizenId,
        masked: savedMap[r.applicantRef] || r.citizenIdMasked,
      })),
    [rows, savedMap]
  );
  const doneCount = withStatus.filter((r) => r.done).length;
  const visible = withStatus.filter(
    (r) => (showAll || !r.done) && (!q.trim() || `${r.prefix}${r.name}`.includes(q.trim()))
  );

  const setRowError = (ref, msg) => setErrorMap((m) => ({ ...m, [ref]: msg }));

  const save = async (row) => {
    const id = normalizeCitizenId(inputMap[row.applicantRef] || '');
    if (!isValidThaiCitizenId(id)) {
      setRowError(row.applicantRef, 'เลขไม่ถูกต้อง (ต้องครบ 13 หลักและ checksum ผ่าน)');
      return false;
    }
    setSavingRef(row.applicantRef);
    try {
      const res = await fetch('/api/smart-school/citizen-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicantRef: row.applicantRef, citizenId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRowError(row.applicantRef, data.message || 'บันทึกไม่สำเร็จ');
        return false;
      }
      setSavedMap((m) => ({ ...m, [row.applicantRef]: data.citizenIdMasked }));
      setRowError(row.applicantRef, null);
      return true;
    } catch {
      setRowError(row.applicantRef, 'เครือข่ายมีปัญหา ลองใหม่อีกครั้ง');
      return false;
    } finally {
      setSavingRef(null);
    }
  };

  // Enter → บันทึก สำเร็จแล้ว focus ช่องของแถวถัดไปที่ยังไม่มีเลข
  const handleKeyDown = async (e, row, idx) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const ok = await save(row);
    if (!ok) return;
    const next = visible.slice(idx + 1).find((r) => !r.done && r.applicantRef !== row.applicantRef);
    if (next) inputRefs.current[next.applicantRef]?.focus();
  };

  return (
    <div className={cardCls + ' p-5 space-y-4'}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-[15px] font-bold text-[#211B2E]">🪪 กรอกเลขบัตรประชาชน</div>
        <span className="text-[12.5px] font-semibold text-[#7C3AED] bg-[#EDE7FD] px-2.5 py-1 rounded-full">
          มีเลขแล้ว {doneCount} / {withStatus.length} ราย
        </span>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            className={inputCls + ' !w-48'}
            placeholder="ค้นชื่อ..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className="flex items-center gap-1.5 text-[12.5px] text-[#57506A] cursor-pointer">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-[#E7E2F2] accent-[#7C3AED]"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            แสดงคนที่มีเลขแล้วด้วย
          </label>
        </div>
      </div>

      <div className="text-[12px] text-[#8A8398]">
        กรอกครบ 13 หลักแล้วกด Enter เพื่อบันทึกและไปแถวถัดไป — เลขที่บันทึกแล้วระบบแสดงแบบมาสก์
        (แก้เลขต้องพิมพ์ใหม่ทั้ง 13 หลักผ่านฟอร์มแก้ไข)
      </div>

      {visible.length === 0 ? (
        <div className="text-center text-[13px] text-[#8A8398] py-10">
          {withStatus.length > 0 && doneCount === withStatus.length
            ? '🎉 กรอกเลขบัตรครบทุกรายแล้ว'
            : 'ไม่พบรายการ'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className={tableHeadCls}>
                <th className="text-left px-3 py-2 rounded-l-[10px]">ชื่อ-นามสกุล</th>
                <th className="text-left px-3 py-2">โรงเรียน</th>
                <th className="text-left px-3 py-2">ระดับ</th>
                <th className="text-left px-3 py-2 rounded-r-[10px] w-72">เลขบัตรประชาชน</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, idx) => (
                <tr key={row.applicantRef} className="border-b border-[#F1ECFB] hover:bg-white/60">
                  <td className="px-3 py-2 font-medium text-[#211B2E]">{row.prefix}{row.name}</td>
                  <td className="px-3 py-2 text-[#57506A]">{row.schoolName || '-'}</td>
                  <td className="px-3 py-2 text-[#57506A]">{row.educationLevel || '-'}</td>
                  <td className="px-3 py-2">
                    {row.done ? (
                      <span className="text-[#15803D] font-semibold">✓ {row.masked}</span>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            ref={(el) => { inputRefs.current[row.applicantRef] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={17}
                            className={inputCls + ' !w-44'}
                            placeholder="13 หลัก"
                            value={inputMap[row.applicantRef] || ''}
                            onChange={(e) =>
                              setInputMap((m) => ({ ...m, [row.applicantRef]: e.target.value }))
                            }
                            onKeyDown={(e) => handleKeyDown(e, row, idx)}
                            disabled={savingRef === row.applicantRef}
                          />
                          <button
                            type="button"
                            className={successBtnCls + ' !px-3 !py-1.5 text-[12px]'}
                            onClick={() => save(row)}
                            disabled={savingRef === row.applicantRef}
                          >
                            {savingRef === row.applicantRef ? (
                              <span className="loading loading-spinner loading-xs" />
                            ) : (
                              'บันทึก'
                            )}
                          </button>
                        </div>
                        {errorMap[row.applicantRef] && (
                          <div className="text-[11.5px] text-[#DC2626]">{errorMap[row.applicantRef]}</div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7.2: ต่อเข้า `SmartSchoolDashboard.jsx`**

เพิ่ม import (ใต้ `import AllocationBoard from './AllocationBoard';` บรรทัด 8):
```jsx
import CitizenIdPanel from './CitizenIdPanel';
```

เพิ่มแท็บใน `PillTabs` (บรรทัด 94–99 เดิม) — แก้ array `tabs` เป็น:
```jsx
            tabs={[
              { key: 'table', label: '📋 ตาราง' },
              { key: 'map', label: '🗺️ แผนที่' },
              { key: 'blocked', label: '🚫 โรงเรียนไม่ผ่าน' },
              { key: 'allocation', label: '🎯 จัดสรรทุน' },
              { key: 'citizenid', label: '🪪 เลขบัตร' },
            ]}
```

เพิ่ม branch ใน render (แทรกก่อน `: view === 'map' ?` บรรทัด 125 เดิม):
```jsx
      ) : view === 'citizenid' ? (
        <CitizenIdPanel rows={data?.applications || []} />
```

(comment บรรทัด 17 `// 'table' | 'map' | 'blocked'` อัปเดตเป็น `// 'table' | 'map' | 'blocked' | 'allocation' | 'citizenid'`)

- [ ] **Step 7.3: Verify ใน browser**

`npm run dev` → `/admin/smart-school` → แท็บ "🪪 เลขบัตร"
- เห็นรายชื่อผู้สมัครปีงบปัจจุบัน + ตัวนับ "มีเลขแล้ว 0 / N ราย"
- กรอก `1234567890122` → กด Enter → เห็น error checksum ใต้ช่อง (ไม่ยิง network)
- กรอก `1234567890121` → Enter → แถวเปลี่ยนเป็น `✓ 1-2345-xxxxx-xx-1`, ตัวนับเป็น 1/N, focus เด้งไปช่องแถวถัดไป
- แถวอื่นกรอก `1234567890121` ซ้ำ → เห็น "เลขนี้ถูกผูกกับ [ชื่อ] (ปีงบ 25xx) แล้ว"

- [ ] **Step 7.4: Lint + Commit**

Run: `npm run lint` → ผ่าน
```bash
git add components/smart-school/admin/CitizenIdPanel.jsx components/smart-school/admin/SmartSchoolDashboard.jsx
git commit -m "feat(smart-school): แท็บ worklist กรอกเลขบัตร (Enter ไปแถวถัดไป + progress)"
```

---

### Task 8: Edit Modal + Detail Modal

**Files:**
- Modify: `components/smart-school/admin/ApplicationEditModal.jsx`
- Modify: `components/smart-school/admin/ApplicationDetailModal.jsx`

- [ ] **Step 8.1: `ApplicationEditModal.jsx` — เพิ่ม import (ใต้บรรทัด 4)**

```jsx
import { normalizeCitizenId, isValidThaiCitizenId } from '@/lib/smart-school/citizenId';
```

- [ ] **Step 8.2: เพิ่ม state (ใต้ `const [scholarshipText, ...]` บรรทัด 41 เดิม)**

```jsx
  // เลขบัตร: server ไม่เคยส่งเลขเต็มมา — แก้ = พิมพ์ใหม่ทั้ง 13 หลัก, ล้าง = ติ๊ก checkbox
  const [citizenIdInput, setCitizenIdInput] = useState('');
  const [clearCitizenId, setClearCitizenId] = useState(false);
```

- [ ] **Step 8.3: validate + แนบใน body — แก้ `handleSave` (บรรทัด 45–59 เดิม)**

แทรกหลัง `const parseList = ...` และเพิ่ม `citizenId` ใน `JSON.stringify`:

```jsx
  const handleSave = async () => {
    setSaving(true);
    try {
      const parseList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
      const citizenDigits = normalizeCitizenId(citizenIdInput);
      if (!clearCitizenId && citizenDigits && !isValidThaiCitizenId(citizenDigits)) {
        throw new Error('เลขบัตรประชาชนไม่ถูกต้อง (ต้องครบ 13 หลักและ checksum ผ่าน)');
      }
      const res = await fetch('/api/smart-school/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _id: row._id,
          ...form,
          gpa: form.gpa === '' ? null : form.gpa,
          incomeSource: parseList(incomeSourceText),
          receivedScholarship: parseList(scholarshipText),
          // null = ล้างเลข, undefined (JSON ตัดทิ้ง) = ไม่แตะเลขเดิม
          citizenId: clearCitizenId ? null : citizenDigits || undefined,
        }),
      });
```

(ส่วนที่เหลือของ `handleSave` คงเดิม)

- [ ] **Step 8.4: เพิ่มช่องกรอกใน UI — แทรกหลังบล็อก "เบอร์โทร" (บรรทัด 110–115 เดิม)**

```jsx
          <div className="space-y-1">
            <label className={labelCls}>
              เลขบัตรประชาชน {row.citizenIdMasked ? `(ปัจจุบัน ${row.citizenIdMasked})` : '(ยังไม่มี)'}
            </label>
            <input type="text" inputMode="numeric" maxLength={17} className={inputCls}
              placeholder={row.citizenIdMasked ? 'พิมพ์เลขใหม่ 13 หลักเพื่อเปลี่ยน' : 'กรอกเลข 13 หลัก'}
              value={citizenIdInput}
              disabled={clearCitizenId}
              onChange={(e) => setCitizenIdInput(e.target.value)} />
            {row.citizenIdMasked && (
              <label className={CHECKBOX_LABEL_CLS}>
                <input type="checkbox" className={CHECKBOX_CLS} checked={clearCitizenId}
                  onChange={(e) => { setClearCitizenId(e.target.checked); if (e.target.checked) setCitizenIdInput(''); }} />
                ล้างเลขบัตร (กรณีผูกผิดคน)
              </label>
            )}
          </div>
```

- [ ] **Step 8.5: `ApplicationDetailModal.jsx` — เพิ่ม Row ใน Section "ข้อมูลติดต่อ & ที่อยู่" (หลัง `<Row label="เบอร์โทร" ...>` บรรทัด 78 เดิม)**

```jsx
            <Row label="เลขบัตรประชาชน" value={row.citizenIdMasked || 'ยังไม่มี'} />
```

- [ ] **Step 8.6: Verify ใน browser**

- เปิดใบสมัครที่กรอกเลขไว้แล้ว (จาก Task 7) → detail modal เห็น "เลขบัตรประชาชน 1-2345-xxxxx-xx-1"
- กดแก้ไข → เห็น "(ปัจจุบัน 1-2345-xxxxx-xx-1)" + placeholder "พิมพ์เลขใหม่..." ช่องว่าง
- พิมพ์ `3100902288664` → บันทึก → detail แสดง `3-1009-xxxxx-xx-4`
- ติ๊ก "ล้างเลขบัตร" → บันทึก → detail แสดง "ยังไม่มี" และแถวนั้นกลับมาโผล่ในแท็บเลขบัตร (หลัง refetch จากการบันทึก modal)
- พิมพ์เลข checksum ผิด → เห็น Swal error ก่อนยิง network

- [ ] **Step 8.7: Lint + Commit**

Run: `npm run lint` → ผ่าน
```bash
git add components/smart-school/admin/ApplicationEditModal.jsx components/smart-school/admin/ApplicationDetailModal.jsx
git commit -m "feat(smart-school): เลขบัตรใน edit/detail modal (masked + ล้างเลขได้)"
```

---

### Task 9: อัปเดตเอกสารโมดูล + final verification

**Files:**
- Modify: `docs/modules/smart-school.md`

- [ ] **Step 9.1: อัปเดต `docs/modules/smart-school.md`**

(1) หัวข้อ **หน้า** — เพิ่มท้าย bullet `/admin/smart-school`: `มุมมองเลขบัตร (worklist backfill)` → แก้บรรทัดเป็น:

```markdown
- `/admin/smart-school` — แดชบอร์ด (แท็บปีงบ, มุมมองตาราง/แผนที่/โรงเรียนไม่ผ่าน/
  จัดสรรทุน/เลขบัตร, สถานะ 4 ค่า, แท็กครัวเรือนเดียวกันคลิกดูสมาชิกได้)
```

(2) หัวข้อ **API** — เพิ่ม bullet ใต้รายการ admin:

```markdown
- `citizen-id` (PUT, admin) — ผูก/ล้างเลขบัตร 13 หลักให้ applicant (checksum
  mod-11 + unique sparse กันซ้ำ, ซ้ำ = 409 พร้อมชื่อผู้ถือเลข); `update` รับ
  `citizenId` ด้วย; ทุก endpoint ตอบเฉพาะเลขมาสก์ — **เลขเต็มไม่ออกจากเซิร์ฟเวอร์**
  (logic รวมที่ `_citizenId.js`, helper pure ที่ `lib/smart-school/citizenId.js`)
```

(3) หัวข้อ **Models** — แก้ bullet `SchoolApplicant`:

```markdown
- `SchoolApplicant` → `school_applicants` (บุคคล; `citizenId` unique sparse —
  เจ้าหน้าที่ backfill ฝั่งแอดมิน เตรียมยืนยันตัวตนปีหน้า (spec 2026-07-15);
  **ไม่ใช่ credential ฝั่ง public ปีนี้** — ฟอร์มสาธารณะยังใช้ค้นชื่อ + เบอร์ 4 ตัวท้าย;
  โปรดักชันรัน `node --env-file=.env.local scripts/sync-school-citizenid-index.js` ครั้งเดียว)
```

(4) หัวข้อ **lib/smart-school/** — เพิ่ม:

```markdown
- `citizenId.js` — normalize/checksum mod-11/mask เลขบัตร (pure — client ใช้ด้วย)
```

- [ ] **Step 9.2: Final verify ทั้งชุด**

```bash
npm run lint && npm run build
```
Expected: lint ผ่าน + build สำเร็จ (exit 0)

Manual checklist สุดท้าย (ตาม spec):
1. ✅ checksum: เลขจริงผ่าน / สลับหลักไม่ผ่าน / 12 หลักไม่ผ่าน (Task 1, 7)
2. ✅ worklist: กรอก → masked + progress ขยับ (Task 7)
3. ✅ เลขซ้ำ → เห็นชื่อผู้ถือเลข (Task 7)
4. ✅ แก้/ล้างผ่าน Edit Modal → detail อัปเดต (Task 8)
5. ⬜ DevTools Network ทุก flow: ไม่มี response ไหนมีเลขเต็ม 13 หลัก — ตรวจซ้ำรอบสุดท้าย
6. ⬜ user ไม่มีสิทธิ์ smart-school → 401/403 (Task 4 ตรวจ 401 แล้ว; ถ้ามี user ทดสอบสิทธิ์ให้ลอง 403)

- [ ] **Step 9.3: Commit**

```bash
git add docs/modules/smart-school.md
git commit -m "docs(smart-school): อัปเดตเอกสารโมดูล — เลขบัตรฝั่งแอดมิน (backfill)"
```

---

## Deploy notes

1. merge แล้วรัน `node --env-file=.env.local scripts/sync-school-citizenid-index.js` กับ DB โปรดักชันครั้งเดียว (สร้าง unique sparse index)
2. ไม่มี ENV ใหม่ / ไม่มี migration ข้อมูล (ฟิลด์เริ่มจากว่างทั้งหมด)
3. ฟอร์มสาธารณะไม่เปลี่ยน — ไม่กระทบผู้ใช้ภายนอก
