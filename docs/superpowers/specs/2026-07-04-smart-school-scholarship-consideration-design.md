# Smart School — กระบวนการพิจารณา/จัดสรรทุน (ต่อยอดโมดูล)

> ต่อยอดจาก `2026-07-03-smart-school-redesign-design.md` (โมดูล smart-school ที่ ship ใน PR #89)
> วันที่: 2026-07-04

## ปัญหา/เป้าหมาย

โมดูล smart-school เดิมเก็บ "ทะเบียนบุคคล + ใบสมัครรายปี" ได้แล้ว แต่ยังขาด
**กระบวนการพิจารณาและจัดสรรทุนจริง** ตามระเบียบเทศบาล: โควตาต่อระดับ, เกณฑ์
คุณสมบัติ (โรงเรียนรัฐ + ทะเบียนบ้านในเขต >1 ปี), การดูครัวเรือนเดียวกัน, และ
เครื่องมือช่วยเจ้าหน้าที่คัดเลือกผู้รับทุน

## การตัดสินใจหลัก (จาก brainstorming)

| ประเด็น | ตัดสินใจ |
|---|---|
| การค้นในฟอร์มสาธารณะ | **เลิกใช้เลขบัตร 13 หลัก** — ค้นด้วยชื่อ-นามสกุล, ตัวตนภายในใช้ `_id`, เจ้าหน้าที่ยืนยันเอกสารเอง |
| การจัดสรรทุน | **decision-support** — ระบบแสดงโควตา/ผู้ผ่านเกณฑ์/กลุ่มครัวเรือน แล้ว**เจ้าหน้าที่จัดอันดับ+เลือกเอง** (ไม่มี auto-ranking) |
| เกณฑ์โรงเรียน | whitelist สถาบัน (โรงเรียนรัฐ) — สร้างจากไฟล์ผู้ได้ทุนปี 68 |
| เกณฑ์ทะเบียนบ้าน | ถาม yes/no ตอนสมัคร เก็บเป็นคอลัมน์ + เจ้าหน้าที่ checklist |
| ครัวเรือนเดียวกัน | จับกลุ่มจากที่อยู่ + แท็ก "บ้านเดียวกับ [ชื่อ]" คลิกดูได้ |
| กติกาบ้านเดียวกัน (แก้จากเดิม) | ระดับสูงสุดพิจารณาก่อน (คำแนะนำ); ถ้าโควตาเหลือ บ้านเดียวกันรับได้หลายคน; **เคยได้ทุนปีก่อนไม่บล็อก** |
| UI ตาราง | แท็บย่อยตามระดับทุน (ซ้อนใต้แท็บปีงบ) — กันยาว + โชว์ตัวนับโควตา |

## โควตาทุนต่อระดับ (ปี 2569)

| กลุ่มระดับ (levelBucket) | โควตา | บาท/ทุน | ครอบระดับในฟอร์ม |
|---|---|---|---|
| `อนุบาล` | 35 | 2,000 | อนุบาล |
| `ประถม` | 80 | 2,000 | ประถม |
| `ม.ต้น` | 25 | 3,000 | มัธยมต้น |
| `ม.ปลาย/ปวช.` | 20 | 5,000 | มัธยมปลาย, ปวช |
| `ป.ตรี/ปวส.` | 10 | 8,000 | ปริญญาตรี, ปวส |

รวม 170 ทุน. เก็บเป็นค่าคงที่ `lib/smart-school/scholarshipLevels.js`
(แก้ปีถัดไปได้ที่เดียว) พร้อม helper `levelBucket(educationLevel)` แม็ประดับ
ในฟอร์ม → กลุ่มระดับ (รองรับสะกดมี/ไม่มีจุด เช่น "ปวช"/"ปวช.")

## โครงข้อมูล (เปลี่ยนแปลง)

### models/smart-school/SchoolApplicant.js
- **ลบ** `citizenId` (unique-sparse) ออก — ไม่ใช้เป็น credential อีก
- คงเดิม: `prefix`, `name`, `phone`, `legacyApplicantId`, `legacyId`

### models/smart-school/SchoolApplication.js — เพิ่มฟิลด์
- `residencyOverOneYear: Boolean|null` (default null) — คำตอบ "มีชื่อในทะเบียนบ้าน
  ในเขตเทศบาล ≥1 ปี" จากฟอร์ม (null=ยังไม่ตอบ)
- `schoolEligibility: String` enum `['allow','block','unknown']` default `unknown`
  — ผลเทียบ `schoolName` กับ whitelist ตอน submit (คำนวณ + เก็บ; เจ้าหน้าที่แก้ได้)
- `eligibilityChecklist: { residencyVerified: Boolean, schoolVerified: Boolean,
  documentsVerified: Boolean }` (default false ทั้งหมด) — เจ้าหน้าที่ติ๊กยืนยัน
- `householdKey: String|null` — คีย์ครัวเรือน (normalize จากที่อยู่) เก็บตอน submit/update
  เพื่อ index + จับกลุ่มเร็ว
- `scholarshipAmount: Number|null` — จำนวนเงินทุนที่ได้ (เซ็ตตอนตั้ง "ได้รับทุน"
  = amount ของ levelBucket)
- คง `status` 4 ค่าเดิม; `ได้รับทุน` = ผ่านการจัดสรร

### models/smart-school/SchoolInstitution.js (ใหม่)
- collection `school_institutions`
- `name: String` (unique, normalize ช่องว่าง), `kind: String` enum
  `['public','private']`, `source: String` (`'import-2568'|'manual'`),
  `note: String`
- ใช้เป็น whitelist: `public`=allow, `private`=block

## เฟส C — Import ไฟล์ 68 → whitelist สถาบัน (ทำก่อน)

> **สำคัญ: ไม่ import "คน"/ใบสมัครจาก CSV เข้าระบบ** (ทั้งคนผ่านและไม่ผ่าน) —
> ปี 69 ทุกคนสมัครใหม่เข้าเงื่อนไขเดิม. ไฟล์ 68 ใช้แค่ 2 อย่าง: (1) ดึงรายชื่อ
> โรงเรียนไปทำ whitelist (2) เหตุผลที่ไม่ผ่าน (เอกชน/ต่อยอด, ทะเบียนบ้าน<1ปี)
> เป็นที่มาของ "ตัวเลือก/เกณฑ์" ในฟอร์ม (เฟส A) — CSV ไม่แตะ collection
> `school_applicants`/`school_applications`

**สคริปต์** `scripts/import-institutions-2568.js` (idempotent, --dry-run) —
เขียนเฉพาะ collection `school_institutions`:
- อ่าน CSV (UTF-8; ไฟล์ต้นฉบับเป็น mojibake — decode/re-save เป็น UTF-8 ก่อน วางที่
  `scripts/data/scholarship-2568.csv`)
- แถวที่**ผ่าน** (มีเงินทุน/ไม่มีหมายเหตุปฏิเสธ) → `สถานศึกษา` เข้า whitelist เป็น
  `public`
- แถวที่**ไม่ผ่านเพราะ "โรงเรียนต่อยอด/เอกชน"** (ตรวจจาก `หมายเหตุ`) → `สถานศึกษา`
  เป็น `private`
- normalize ชื่อ (ตัดช่องว่างซ้ำ, trim) แล้ว upsert; ถ้าโรงเรียนซ้ำทั้ง public/private
  ให้ `private` ชนะ (กันพลาด) + log ให้เจ้าหน้าที่ทวน

**API admin** `pages/api/smart-school/institutions/` — `list` (GET),
`upsert` (PUT: เพิ่ม/แก้ public↔private), `delete` — auth `requireSchoolAdmin`

**หน้าแอดมิน** เพิ่มแท็บ/ปุ่ม "สถานศึกษา (whitelist)" ใน `/admin/smart-school`
(หรือหน้าย่อย) ให้เจ้าหน้าที่ดู/แก้รายการโรงเรียน

## เฟส A — ฟอร์มสาธารณะ: เลิกเลขบัตร + ค้นชื่อ + ฟิลด์เกณฑ์

**API public** ปรับ:
- `lookup.js` — รับเฉพาะ `name` (ตัด path citizenId), คืนผลมาสก์ ≤10 รายการ
  พร้อม `{ ref, maskedName, level, community, lastYear }` (เพิ่ม community+level
  ช่วยแยกคนชื่อซ้ำ), ไม่กรอง citizenId แล้ว (ไม่มีฟิลด์นี้)
- `verify.js` — **ลบทิ้ง** (ไม่มีการยืนยันเลขบัตรอีก) — เส้นทางรายเก่าใช้ `lookup`
  เลือก ref → เรียก endpoint ใหม่ `prefill` (POST `{ ref }`) คืนข้อมูลใบล่าสุดของ ref
  นั้น (ข้อมูลสาธารณะ: ระดับ/ที่อยู่/รายได้/หมายเหตุ — ไม่มีข้อมูลลับกว่านี้อยู่แล้ว)
- `submit.js` — ตัด `citizenId`; รับ `residencyOverOneYear` (bool) + `schoolName`;
  คำนวณ `schoolEligibility` เทียบ whitelist; คำนวณ `householdKey`; `isRenewal`
  ตัดสินจาก `ref` ที่ส่งมา (มี ref = รายเก่า) แทนการเทียบเลขบัตร

**Wizard** `components/smart-school/survey/`:
- `IdentityStep.jsx` — ตัด input เลขบัตร; รายเก่า→ค้นชื่อ→radio picker (ชื่อมาสก์ +
  ระดับ + ชุมชน + ปีล่าสุด) → เลือก → `prefill`; รายใหม่→ถัดไปเลย
- `InfoStep.jsx` — เพิ่ม (1) เลือกสถานศึกษา (autocomplete จาก whitelist + พิมพ์เองได้;
  ถ้าตรง `private` เตือน "โรงเรียนเอกชน อาจไม่ผ่านเกณฑ์"), (2) คำถาม yes/no
  "มีชื่อในทะเบียนบ้านในเขตเทศบาลตาคลี ≥1 ปี หรือไม่"
- n8n: payload เพิ่ม schoolName/residency ได้ (ไม่บังคับ)

## เฟส B — แท็กครัวเรือนเดียวกัน (แอดมิน)

**householdKey** = normalize(`บ้านเลขที่|ซอย|ถนน|ชุมชน` หรือจาก `address` ถ้าไม่มี
แยกช่อง) — ตัดช่องว่าง/อักขระ, lowercase; ว่าง=ไม่จัดกลุ่ม

**list.js** (admin) — แทน flags เดิม (`prevYearAwarded/householdKey/
householdAwardedOther`) ด้วย:
- `household: { key, members: [{ ref, name, level, status }] }` — สมาชิกร่วมบ้าน
  (ไม่รวมตัวเอง) พร้อมชื่อ/ระดับ/สถานะ เพื่อทำแท็กคลิกได้
- ตัด logic "หมุนเวียน/เคยได้ปีก่อน" ออก

**ApplicationTable / DetailModal** — แท็ก **"🏠 บ้านเดียวกับ: ชื่อ A, ชื่อ B (คลิก)"**
คลิก→เปิด detail ของสมาชิกนั้นเทียบที่อยู่; ใน detail แสดงบล็อก "สมาชิกครัวเรือน
เดียวกัน" ครบ

## เฟส D — โต๊ะจัดสรรทุน (แอดมิน, เลือกเอง)

**หน้า/แท็บใหม่ "จัดสรรทุน"** ใน `/admin/smart-school` (ต่อจากตาราง):
- **แท็บย่อยตามระดับทุน** (5 กลุ่ม) — แต่ละแท็บโชว์ `เลือกแล้ว X / โควตา N` +
  ยอดเงินรวม
- ในแต่ละระดับ: รายชื่อผู้สมัคร**ที่ผ่านเกณฑ์** (schoolEligibility=allow +
  residency + documents ครบ — หรือแสดงทั้งหมดแต่ไฮไลต์ที่ยังไม่ครบ) เรียงตามที่
  เจ้าหน้าที่เลือก (คลิกหัวคอลัมน์เรียง รายได้/เกรด/ชื่อ), มีคอลัมน์ครัวเรือน
  (แท็กบ้านเดียวกัน) + เช็คบ็อกซ์ "ให้ทุน"
- กด "ให้ทุน" → ตั้ง `status='ได้รับทุน'` + `scholarshipAmount` = amount ของระดับ;
  ตัวนับโควตาอัปเดต; **เตือน (ไม่บล็อก)** ถ้าเกินโควตา
- คำแนะนำครัวเรือน: ถ้าเลือกคนในบ้านที่มีสมาชิกระดับสูงกว่ายังไม่ได้เลือก →
  โน้ต "ในบ้านนี้มี [ชื่อ] ระดับสูงกว่า ปกติพิจารณาก่อน" (เตือนเฉย ๆ)
- ปุ่ม export รายชื่อผู้ได้ทุนต่อระดับ (ใช้ตอนประกาศ)

**API** `pages/api/smart-school/award.js` (PUT) — ตั้ง/ถอนสถานะได้รับทุน + amount
(auth admin); หรือใช้ `status.js` เดิมขยายให้เซ็ต amount เมื่อเป็น "ได้รับทุน"

## สิ่งที่เปลี่ยนจาก PR #89 (ต้อง rework)

1. ตัด `citizenId` ทั้ง model/lookup/verify(ลบ)/submit/update/wizard
2. household flags: จาก "หมุนเวียน" → "จัดกลุ่ม+ระบุตัว" (list.js + table + detail)
3. เพิ่ม residency/schoolEligibility/checklist/scholarshipAmount ใน model + edit modal
4. ข้อมูลที่ migrate มาแล้ว (238 ราย ปี 2568) ไม่มี citizenId อยู่แล้ว → สอดคล้อง;
   householdKey/schoolEligibility ของ record เก่าเป็น null/unknown จนแตะแก้ (ยอมรับได้)

## ขอบเขตที่ยังไม่ทำ (YAGNI)
- **ไม่ import คน/ใบสมัครจาก CSV 68** — ทุกคนสมัครใหม่ปี 69 (ไฟล์ใช้แค่ทำ whitelist
  โรงเรียน + เป็นที่มาของเกณฑ์)
- auto-ranking/auto-allocation (เจ้าหน้าที่เลือกเอง)
- cross-check รายชื่อผู้ไม่ผ่านปีก่อนอัตโนมัติ
- ผูกเลขบัตร/OTP/ยืนยันตัวตนออนไลน์

## Prerequisite ก่อน implement
- ต้องมีไฟล์ CSV ปี 68 decode เป็น UTF-8 วางที่ `scripts/data/scholarship-2568.csv`
  (ผู้ใช้ส่งไฟล์ต้นฉบับมาแล้ว — จะ decode/normalize ตอนเริ่มเฟส C)
