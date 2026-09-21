# แผน implement เฟส 2: Wizard แจ้งทุกข์-แจ้งเหตุ (`/preview/report`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** wizard 3 ขั้น + จอสำเร็จ แทน modal ฟอร์มยาวบน `/preview` — กติกาข้อมูล/endpoint เดิมทุกไบต์ ฟอร์มเดิมบนหน้าเก่าไม่ถูกแตะ

**Architecture:** หน้าเดียว `pages/preview/report.tsx` ถือ state ทั้ง flow + สลับ step component · logic ล้วน (schema รายขั้น, payload builder) แยก `lib/citizen/report/` มีเทสต์ · reuse `CommunitySelector`/`ImageUploads`/`LocationConfirm`/stores เดิมทั้งดุ้น

**Tech Stack:** Next.js Pages Router · zod (dependency เดิม) · vitest · Tailwind arbitrary values โทนม่วงชุดเดียวกับเฟส 1

**Spec:** `docs/superpowers/specs/2026-08-18-citizen-report-wizard-design.md` · **ภาพอ้างอิง:** แคนวาส F1–F4 (`Smart Takhli Redesign.dc.html:415-578`)

**ข้อควรระวัง:** dev พอร์ต 3100 · ห้าม build ซ้อน dev · เช็ค branch = `feat/app-redesign-canvas` ก่อน commit · **ห้ามยิง submit/อัปโหลดจริง** (Mongo+Cloudinary+LINE กลุ่มเจ้าหน้าที่เป็นของจริง) — e2e ใช้ playwright route interception เท่านั้น

---

### Task 1: `lib/citizen/report/schema.js` — zod รายขั้น เกณฑ์/ข้อความเดิมเป๊ะ (TDD)

อ้างอิง `ComplaintFormModal.js:15-27` — ห้ามเปลี่ยนข้อความ error แม้แต่ตัวเดียว · validate ใช้ค่า trim (ตามเดิม) แต่ payload ส่งค่าดิบ (ตามเดิม)

**Files:** Create `lib/citizen/report/schema.js` · Test `lib/citizen/__tests__/reportSchema.test.js`

- [ ] เขียนเทสต์: แต่ละ schema ผ่าน/ไม่ผ่านตามขอบเขต (community ว่าง, fullName 1 ตัวอักษร, phone 9/11 หลัก, imageUrls ว่าง, location null, selectedProblems ว่าง) + ข้อความ error ตรงของเดิม + `validateStep` คืน `{field: message}` field ละหนึ่งข้อความแรก
- [ ] รันให้ fail → เขียนโค้ด:

```js
// lib/citizen/report/schema.js
// เกณฑ์ validate ของ wizard — ต้องตรง ComplaintFormModal.js:15-27 (ฟอร์มเดิม) ทุกข้อความ
import { z } from "zod";

export const stepCategorySchema = z.object({
  category: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
});

export const stepDetailsSchema = z.object({
  community: z.string().min(1, "กรุณาระบุ 1 ชุมชน"),
  selectedProblems: z.array(z.string()).min(1, "กรุณาเลือกรายการปัญหาอย่างน้อย 1 รายการ"),
  imageUrls: z.array(z.string()).min(1, "กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป"),
});

export const stepReporterSchema = z.object({
  prefix: z.string().min(1, "กรุณาเลือกคำนำหน้า"),
  fullName: z.string().min(2, "ชื่อ-นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร"),
  phone: z.string().length(10, "เบอร์โทรศัพท์ต้องมี 10 หลัก"),
  detail: z.string().min(1, "กรุณากรอกรายละเอียด"),
  location: z
    .object({ lat: z.number(), lng: z.number() })
    .nullable()
    .refine((val) => val !== null, "กรุณาเลือกตำแหน่งที่ตั้ง"),
});

export const fullReportSchema = stepCategorySchema.merge(stepDetailsSchema).merge(stepReporterSchema);

// คืน error ต่อฟิลด์ (ข้อความแรกของฟิลด์นั้น) — ว่าง = ผ่าน
export function validateStep(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return {};
  const errors = {};
  for (const err of result.error.errors) {
    const key = err.path[0];
    if (key && !errors[key]) errors[key] = err.message;
  }
  return errors;
}
```

- [ ] เทสต์ผ่าน → commit `feat(citizen): schema รายขั้นของ wizard แจ้งเรื่อง — เกณฑ์เดิม`

### Task 2: `lib/citizen/report/payload.js` — payload builder (TDD)

อ้างอิง `ComplaintFormModal.js:119-135` — shape เดิมทุก field รวม `status`/`officer`/`updatedAt` และ `problems` map id→label

**Files:** Create `lib/citizen/report/payload.js` · Test `lib/citizen/__tests__/reportPayload.test.js`

- [ ] เทสต์: field ครบ 12 ตัว · problems map id→label (id ที่หาไม่เจอคง id) · ค่าดิบไม่ trim · status = "อยู่ระหว่างดำเนินการ" · officer = "" · updatedAt เป็น Date
- [ ] รันให้ fail → เขียนโค้ด:

```js
// lib/citizen/report/payload.js
// payload สำหรับ POST /api/submittedreports/submit-report — shape ต้องตรง
// ComplaintFormModal.js:119-135 (ฟอร์มเดิม) ทุก field ห้ามแก้ฝั่งเดียว
export function buildComplaintPayload(state, problemOptions) {
  return {
    prefix: state.prefix,
    fullName: state.fullName,
    phone: state.phone,
    community: state.community,
    problems: state.selectedProblems.map((id) => {
      const match = problemOptions.find((opt) => opt._id === id);
      return match ? match.label : id;
    }),
    category: state.category,
    images: state.imageUrls,
    detail: state.detail,
    location: state.location,
    status: "อยู่ระหว่างดำเนินการ",
    officer: "",
    updatedAt: new Date(),
  };
}
```

- [ ] เทสต์ผ่าน → commit `feat(citizen): payload builder ของ wizard — shape ตรงฟอร์มเดิม`

### Task 3: โครง wizard — Layout ยกเว้น `/preview/*` + `hideNav` + Header/Footer + หน้า skeleton

**Files:** Modify `components/Layout.js` (เงื่อนไข → `router.pathname === "/preview" || router.pathname.startsWith("/preview/")`) · Modify `components/citizen/CitizenShell.tsx` (prop `hideNav?: boolean` — ไม่ render BottomNav เมื่อ true) · Create `components/citizen/report/WizardHeader.tsx`, `WizardFooter.tsx` · Create `pages/preview/report.tsx` (state + query category + สลับ step placeholder)

- [ ] WizardHeader ตามแคนวาส F1 header (`:417-426`): ปุ่มย้อน (วงมน ขาว เงา) · ชื่อขั้น + "ขั้นที่ N จาก 3 · <คำโปรย>" · progress 3 ท่อน (`#7C3AED` ≤N, `#E4DEF2` ที่เหลือ) — props `{ step, title, hint, onBack }`
- [ ] WizardFooter ตามแคนวาส (`:497-500`): ปุ่มย้อนกลับ (กว้าง 108px พื้น `#F1ECFE` ม่วง, แสดงเมื่อมี onBack) + ปุ่มหลัก gradient เต็มแถว — props `{ onBack?, onNext, nextLabel, disabled?, loading? }` · แถบ sticky ล่าง พื้นขาว border-top
- [ ] `pages/preview/report.tsx`: state ทั้ง flow (category, community, selectedProblems, imageUrls, prefix="นาย", fullName, phone, detail, location, useCurrentLocation) + `step` + `errors` + `complaintId` · `useEffect` บน `router.isReady`: ถ้า `query.category` ตรงกับเมนูหมวดร้องเรียน → set + ข้ามไป step 2 · ย้อนจาก step 1 = `router.back()` · แต่ละ step แสดง placeholder ข้อความไว้ก่อน
- [ ] ตรวจตา: `/preview/report` มี header+progress+footer ไม่มี Nav ล่าง ไม่มี layout เก่าซ้อน · `/preview/report?category=ไฟส่องสว่าง` เริ่มขั้น 2
- [ ] commit `feat(citizen): โครง wizard แจ้งเรื่อง — header/progress/footer + route /preview/report`

### Task 4: `StepCategory` — จอเลือกหมวด (แคนวาส F1 `:427-454`)

**Files:** Create `components/citizen/report/StepCategory.tsx` · Modify `pages/preview/report.tsx`

- [ ] การ์ดแถวต่อหมวด (เฉพาะหมวดร้องเรียน — import `SERVICE_LABELS` แยก export จาก ServiceGrid): รูป `Prob_pic` วงมน 44px · ชื่อหมวด · บรรทัดรอง = ชื่อปัญหา 3 ตัวแรกของหมวดจาก problemOptions join " · " (line-clamp-1; ไม่มีก็เว้น) · เลือกแล้ว: `border-2 #7C3AED` + วงติ๊กม่วงขวา · ยังไม่เลือก: chevron เทา
- [ ] เลือกหมวดใหม่ล้าง selectedProblems (ปัญหาเป็นของหมวดเดิม)
- [ ] ตรวจตา + commit `feat(citizen): จอเลือกหมวดของ wizard`

### Task 5: `StepDetails` — ชุมชน + ปัญหา + รูป (แคนวาส F2 `:472-496`)

**Files:** Create `components/citizen/report/StepDetails.tsx` · Modify `pages/preview/report.tsx`

- [ ] `CommunitySelector` เดิม (ครอบ label "ชุมชน *" สไตล์ใหม่) · chips ปัญหา filter `option.category === category`: เลือกแล้วพื้น `#7C3AED` ขาว + ติ๊ก, ยังไม่เลือกขาวขอบ `#E4DEF2` (กดสลับได้ ใช้ `_id` เป็นค่า) · `ImageUploads` เดิม (label "แนบรูปภาพ (ไม่เกิน 3 รูป)") ส่ง `onUploadingChange` ขึ้นไปกันส่ง
- [ ] error ใต้ฟิลด์จาก `validateStep(stepDetailsSchema, ...)` — แสดงเมื่อกดถัดไปแล้วไม่ผ่าน (ข้อความแดง text-[11px])
- [ ] ตรวจตา (เลือกหมวดจริง เห็น chips จริงจาก DB) + commit `feat(citizen): จอรายละเอียดปัญหาของ wizard`

### Task 6: `StepReporter` — ผู้แจ้ง + ตำแหน่ง (แคนวาส F3 `:518-539`)

**Files:** Create `components/citizen/report/StepReporter.tsx` · Modify `pages/preview/report.tsx`

- [ ] segmented คำนำหน้า (นาย/นาง/นางสาว — พื้น `#EFEBF7` ก้อนเลือกขาวม่วงเงา) · input ชื่อ-นามสกุล / เบอร์ (`inputMode="tel"` `maxLength=10` กรองเฉพาะตัวเลข) / textarea รายละเอียด — การ์ดขาว rounded-[13px] เงาอ่อน focus ขอบม่วง · `LocationConfirm` เดิม (label "ตำแหน่งที่เกิดเหตุ")
- [ ] ปุ่มหลัก = "ส่งเรื่อง" · error ใต้ฟิลด์จาก `stepReporterSchema` (validate ด้วยค่า trim ตามเดิม)
- [ ] ตรวจตา + commit `feat(citizen): จอข้อมูลผู้แจ้ง+ตำแหน่งของ wizard`

### Task 7: `StepSuccess` + submit จริง (แคนวาส F4 `:552-576` + logic เดิม `ComplaintFormModal.js:137-190`)

**Files:** Create `components/citizen/report/StepSuccess.tsx` · Modify `pages/preview/report.tsx`

- [ ] submit ใน report.tsx: กัน `isSubmitting || isUploading` (ตามเดิม) → `fullReportSchema` ตรวจรวม (ค่า trim) → `buildComplaintPayload` → `POST /api/submittedreports/submit-report` header `Content-Type` + `x-app-id` (`NEXT_PUBLIC_APP_ID || "app_b"` ตามเดิม) → `data.complaintId` → step "success" · ล้มเหลว: กล่อง error แดงเหนือ footer + ปุ่มส่งกดซ้ำได้
- [ ] StepSuccess: วงติ๊กเขียว 108px สองชั้น · "ส่งเรื่องสำเร็จ" + "เจ้าหน้าที่จะดำเนินการภายใน 3 วันทำการ" · การ์ดเลขเรื่อง (monospace ม่วง `tracking-wider` — ฟอนต์ `font-mono` พอ ไม่ต้องโหลด IBM Plex) + ชิป "อยู่ระหว่างดำเนินการ" เหลือง · การ์ด LINE: oaMessage deep link logic เดิม (`/@[\w.-]+/` จาก `NEXT_PUBLIC_LINE_OA_URL`, ข้อความ `สถานะ <id>`, fallback ลิงก์เพิ่มเพื่อน; ไม่มี env = ซ่อนการ์ด) · ปุ่ม "ติดตามสถานะเรื่อง" → `/status` · "กลับหน้าแรก" → `/preview` · จอนี้ไม่มี WizardHeader/Footer (พื้น gradient `#F3EEFE→#F6F5FA`)
- [ ] ตรวจตาจอสำเร็จผ่าน e2e interception (Task 8) — ยังไม่ commit แยกก็ได้ถ้าจะรวมกับ Task 8
- [ ] commit `feat(citizen): จอส่งสำเร็จ + เดินสาย submit ของ wizard`

### Task 8: เดินสายหน้าแรก + e2e ทั้ง flow (intercept — ห้ามยิงจริง)

**Files:** Modify `components/citizen/home/ServiceGrid.tsx` (export `SERVICE_LABELS`; การ์ดหมวดร้องเรียนเป็น `Link` ไป `/preview/report?category=<Prob_name>` — หมวดบริการยังเรียก `onSelect` เปิด modal เดิม) · Modify `components/citizen/home/ComplaintCTA.tsx` + `pages/preview.tsx` (CTA → `router.push("/preview/report")`; ลบ `ComplaintFormModal` import + `selectedLabel` state — modal บริการสองตัวคงไว้; ลบ `scrollToCategories`)

- [ ] e2e (playwright script ใน scratchpad): `page.route` intercept `**/api.cloudinary.com/**` → mock `{secure_url:"https://res.cloudinary.com/demo/fake.jpg"}` และ `**/api/submittedreports/submit-report` → mock `{complaintId:"TKL-2569-TEST"}` · เดิน flow: หน้าแรก → กดการ์ดหมวด → ขั้น 2 (เลือกชุมชน+ปัญหา+ไฟล์รูป dummy) → ขั้น 3 (กรอกครบ + ตำแหน่ง — geolocation mock ผ่าน context permission/`setGeolocation`) → ส่ง → จอสำเร็จ TKL-2569-TEST + ลิงก์ LINE ถูกต้อง · screenshot ทุกจอ
- [ ] `npm test` + `npm run lint` ผ่าน · หน้า `/` เดิม modal ยังทำงาน (เปิดหน้าเก่ากดหมวดดู)
- [ ] commit `feat(citizen): เชื่อมหน้าแรกเข้า wizard + ปิดเฟส 2`
