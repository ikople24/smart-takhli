# Spec: รีดีไซน์โมดูล Smart School (ระบบสำรวจการศึกษา / ทุนการศึกษา)

วันที่: 2026-07-03 · สถานะ: อนุมัติดีไซน์แล้ว รอเขียนแผน implementation

## เป้าหมาย

ยกระดับระบบสำรวจการศึกษา (เดิมคือโมดูล `education`) เป็นโมดูล `smart-school`
ตาม module convention ของโปรเจกต์ โดย:

1. ฟอร์มสาธารณะรองรับ "รายเก่า" — ค้นจากเลขบัตรประชาชน 13 หลัก แล้วดึงข้อมูล
   ปีที่แล้วมาแก้ไข/อัปเดตได้ พร้อมแจ้งเตือน n8n หัวข้อ "รายเก่า update ข้อมูล"
2. แก้บั๊ก n8n format (string interpolation ใน jsonBody พังเมื่อข้อความมี
   newline/quote) และแจ้ง n8n เมื่อมีการเปลี่ยนรูปภาพ
3. โครงข้อมูลใหม่แบบ "บุคคล + ใบสมัครรายปี" — อัปเดตปีใหม่ได้โดยข้อมูลปีเก่า
   อยู่ครบทุกปี

## ข้อเท็จจริงตั้งต้น (สำรวจเมื่อ 2026-07-03)

- ข้อมูลเดิมใน collection `educationregisters` มี **238 รายการ**
  (สร้าง ก.ค.–ส.ค. 2025 = ปีงบประมาณ 2568) — **ไม่มีเลขบัตร 13 หลักเลย**
  ทั้ง schema และในช่อง `note`
- `applicantId` เดิมออกเลขด้วย `countDocuments()+1` — ชนกันได้ (race) จนต้องมี
  endpoint `reset-applicant-id` ไว้ซ่อม
- ฟอร์มเดิม `components/education/EducationFormModal.js` เปิดจากหน้าแรก
  (`pages/index.tsx`) แบบ public ไม่ล็อกอิน → ยิง
  `POST /api/education/education-survey` → n8n webhook URL **hardcode** ในโค้ด
- `PUT /api/education/update` **ไม่รับฟิลด์ `imageUrl`** — แอดมินแก้รูปใน
  `EducationEditModal` แล้วค่าถูกทิ้งเงียบ ๆ (บั๊กแฝง) และ update ไม่แจ้ง n8n เลย
- ฟอร์มส่ง `status: "รับคำร้อง"` มาแต่ API/model ไม่มีฟิลด์ status — ค่าถูกทิ้ง
- n8n workflow "Api All" (id `WmudE1P882vIgxhv`) node `hook sm-school-takhli`
  (path `sm-school`) → `Edit Fields5` → `HTTP Request6` (Telegram sendMessage)
  — `jsonBody` เป็น raw JSON string + `{{ }}` interpolation:
  - `note`/`address` ที่มี newline หรือ `"` ทำให้ JSON พัง ส่งไม่ออก
    (บั๊กแบบเดียวกับที่เคยแก้ใน Telegram node ฝั่งเรื่องร้องเรียน)
  - `image[1]`, `image[2]` ขึ้นตัวอักษร "undefined" เมื่อรูปไม่ครบ 3
- หน้าแอดมินเดิม `/admin/education-map` ไฟล์เดียว 1,578 บรรทัด

## การตัดสินใจหลัก (ยืนยันกับผู้ใช้แล้ว)

| ประเด็น | ตัดสินใจ |
|---|---|
| จับคู่รายเก่า (ข้อมูลเก่าไม่มีเลข 13 หลัก) | เลข 13 หลักก่อน → ไม่เจอให้ค้นชื่อเป็น fallback → กรอกเลข 13 หลักของตัวเองเพื่อยืนยัน+ผูกให้ record เก่าทันที |
| ตัวยืนยันตัวตน | **เลข 13 หลักเป็น credential หลัก** — ไม่ใช้เบอร์โทร เพราะเด็กหลายคนในบ้านเดียวกันใช้เบอร์ร่วมกัน (เบอร์แยกตัวบุคคลไม่ได้ เลขบัตรแยกได้) |
| ผู้ใช้ฟอร์ม | ผสม (เจ้าหน้าที่ลงพื้นที่ + ประชาชนกรอกเอง) → ออกแบบยึด public เป็นหลัก: มาสก์ข้อมูลจนกว่าจะยืนยันด้วยเลข 13 หลัก |
| โครงข้อมูล | แยก 2 ชั้น: ทะเบียนบุคคล + ใบสมัครรายปีงบประมาณ (ข้อมูลทุกปีอยู่ครบ) |
| สถานะงาน | เบา ๆ 4 ค่า: `รับคำร้อง → ตรวจสอบแล้ว → ได้รับทุน \| ไม่ผ่านเกณฑ์` |
| กติกาครัวเรือน | ทุน 1 คน/ครัวเรือน/ปี และปีถัดไปหมุนเวียนเปลี่ยนคน — ระบบ**ติดป้ายเตือนฝั่งแอดมิน** (ไม่บล็อกการยื่น เพราะการตรวจจับครัวเรือนจากที่อยู่/เบอร์ไม่แม่น 100% เจ้าหน้าที่ตัดสินเอง) |
| ขอบเขตโค้ด | โมดูลใหม่เต็มรูปแบบตาม convention + migrate ข้อมูล (collection เดิมเก็บเป็น backup ไม่แตะ) |

## 1) โครงสร้างโมดูล

```
pages/admin/smart-school.jsx          — แดชบอร์ดแอดมิน (แตก component ย่อย)
pages/api/smart-school/               — lookup, verify, submit, list, update, status, _auth
components/smart-school/              — ฟอร์ม wizard + ตาราง/แผนที่/modal ฝั่งแอดมิน
lib/smart-school/                     — notify (n8n), fiscalYear, mask helpers
models/smart-school/                  — SchoolApplicant, SchoolApplication, counter
scripts/migrate-education-to-smart-school.js
docs/modules/smart-school.md          — แทน education.md (อัปเดตดัชนี README.md)
```

## 2) Data model

### `SchoolApplicant` → collection `school_applicants` (ทะเบียนบุคคล)

- `citizenId: String` — unique **sparse** index (รายเก่าที่ migrate มายังไม่มี
  จนกว่าจะยืนยันตัวตนครั้งแรกหรือแอดมิน backfill), validate checksum mod-11
- `prefix`, `name`, `phone` — ค่าล่าสุดของบุคคล (phone เป็นข้อมูลติดต่อ
  และสัญญาณจัดกลุ่มครัวเรือน — ไม่ใช่ตัวยืนยันตัวตน)
- `legacyApplicantId: String` — `TKC-xxx` เดิม (ตามรอยกลับ collection เก่า)
- `legacyId: ObjectId` — `_id` เดิมใน `educationregisters` (กัน migrate ซ้ำ)
- timestamps

### `SchoolApplication` → collection `school_applications` (ใบสมัครรายปี)

- `applicantRef: ObjectId → SchoolApplicant` (index)
- `surveyYear: Number` — ปีงบประมาณ พ.ศ. (2568, 2569, …);
  **unique compound (`applicantRef`, `surveyYear`)** = 1 คน 1 ใบ/ปี
- `applicationId: String` — รูปแบบ `TKC69-001` (เลขรันต่อปี) ออกเลขผ่าน
  counter collection ด้วย `findOneAndUpdate` + `$inc` + upsert (atomic, ไม่ race)
- ฟิลด์ข้อมูลเดิมครบ: `educationLevel`, `schoolName`, `gradeLevel`, `gpa`,
  `address`, `actualAddress`, `housingStatus`, `householdMembers`,
  `annualIncome`, `incomeSource`, `familyStatus`, `receivedScholarship`,
  `takhliScholarshipHistory`, `note`, `imageUrl: [String]` (≤3),
  `location: {lat, lng}`
- `status: String` enum `['รับคำร้อง', 'ตรวจสอบแล้ว', 'ได้รับทุน', 'ไม่ผ่านเกณฑ์']`
  default `รับคำร้อง` + `statusUpdatedBy: String`, `statusUpdatedAt: Date`
  — `ได้รับทุน` คือผลการพิจารณาของปีนั้น ใช้เป็นฐานกติกาหมุนเวียนครัวเรือนปีถัดไป
  (แยกจาก `receivedScholarship`/`takhliScholarshipHistory` ซึ่งเป็นข้อมูล
  self-report จากฟอร์ม)
- `isRenewal: Boolean` — รายเก่า (true) / รายใหม่ (false)
- timestamps

### `lib/smart-school/fiscalYear.js`

ปีงบประมาณไทย: ต.ค.–ก.ย. → เดือน ≥ ต.ค. นับเป็นปีถัดไป, คืนค่า พ.ศ.
(วันนี้ 2026-07-03 → **2569**)

## 3) โฟลว์ฟอร์มสาธารณะ (wizard 3 ขั้น — component ใหม่ใน `components/smart-school/`)

แทนที่ `EducationFormModal` เดิมบนหน้าแรก (`pages/index.tsx`)

**ขั้นที่ 1 — ระบุตัวตน** (เลข 13 หลักคือ credential — ไม่ใช้เบอร์โทรยืนยัน
เพราะหลายคนในบ้านใช้เบอร์ร่วมกัน แยกตัวบุคคลไม่ได้)

- เลือก **รายใหม่** / **รายเก่า (เคยยื่นแล้ว)**
- รายเก่า: กรอกเลข 13 หลัก (validate checksum ฝั่ง client ก่อนยิง) →
  `POST /api/smart-school/lookup`
  - **เจอ** applicant ที่ `citizenId` ตรง → แสดงชื่อแบบมาสก์
    (เช่น "พงศกรณ์ ผ่xxx") ให้กดยืนยันว่า "ใช่ฉัน" → ได้ข้อมูลใบสมัคร
    ปีล่าสุดมา prefill (การรู้เลขเต็ม 13 หลักที่ตรง = ผ่านการยืนยัน)
  - **ไม่เจอ** → ค้นด้วยชื่อ-นามสกุล → รายการ match แบบมาสก์ (≤5 รายการ:
    ชื่อมาสก์ + ปีที่เคยยื่น เท่านั้น; **เฉพาะ record ที่ยังไม่มี `citizenId`**
    — record ที่ผูกเลขแล้วเข้าถึงได้ทางเลขบัตรตรงเท่านั้น) → เลือกของตัวเอง →
    กรอกเลข 13 หลักของตัวเอง → ระบบ**ผูก `citizenId` ให้ applicant นั้นทันที**
    + prefill
  - หาไม่เจอทั้งสองทาง → เสนอยื่นเป็นรายใหม่ (เจ้าหน้าที่เห็นรายการซ้ำ
    จากหน้าแอดมิน แล้วใช้ backfill เลขบัตร + ลบใบซ้ำจัดการได้)
- รายใหม่: กรอกเลข 13 หลัก (เก็บเข้าทะเบียนบุคคล — ปีถัดไปจะเจอเป็นรายเก่า
  ทันที) → ฟอร์มเปล่า
- ถ้าเลข 13 หลักของรายใหม่ **ซ้ำกับที่มีอยู่** → บอกว่าเคยยื่นแล้ว
  พาเข้าเส้นทางรายเก่า
- ข้อความแจ้งในขั้นนี้ (informational ไม่บล็อก): "ทุนพิจารณา 1 คนต่อครัวเรือน
  ต่อปี และหมุนเวียนผู้รับในปีถัดไป"

**ขั้นที่ 2 — ข้อมูล:** ฟิลด์ชุดเดิมทั้งหมด (รวมปุ่ม ×12 แปลงรายได้เดือน→ปี);
รายเก่าเห็นค่า prefill พร้อมป้ายกำกับ "ข้อมูลเดิมปี XXXX" เทียบข้างช่องที่แก้

**ขั้นที่ 3 — รูปภาพ (≤3) + พิกัด (LocationConfirm เดิม) + ส่ง**

กติกา PDPA: ก่อนยืนยันด้วยเลข 13 หลักสำเร็จ ห้ามคืน รายได้ / ที่อยู่ /
เบอร์โทร / พิกัด / รูป ใด ๆ ออกจาก API — คืนได้เฉพาะชื่อมาสก์ + ปีที่เคยยื่น
(แนวป้องกันเสริม: ทุกการ update รายเก่าแจ้ง n8n ให้เจ้าหน้าที่เห็น และสถานะ
กลับเป็น "รับคำร้อง" ให้ตรวจใหม่ทุกปีอยู่แล้ว)

## 4) API — `pages/api/smart-school/`

| Endpoint | Auth | หน้าที่ |
|---|---|---|
| `POST lookup` | public | ค้นด้วย `citizenId` หรือ `name` → ผลมาสก์เท่านั้น ≤5 รายการ (ค้นชื่อคืนเฉพาะ record ที่ยังไม่มี citizenId) |
| `POST verify` | public | `citizenId` ตรงเป๊ะ → คืนข้อมูลเต็มปีล่าสุด; เส้นทางค้นชื่อส่ง `applicantRef` + เลข 13 หลักของตน → ผูก citizenId ให้ record แล้วคืนข้อมูลเต็ม |
| `POST submit` | public | สร้างใบสมัครปีปัจจุบัน; รายเก่าที่มีใบปีนี้แล้ว = update ใบเดิม; แจ้ง n8n |
| `GET list` | admin | ใบสมัคร filter ตามปี/สถานะ/รายเก่า-ใหม่ + join ข้อมูลบุคคล |
| `PUT update` | admin | แก้ทุกฟิลด์ **รวม `imageUrl`** + backfill `citizenId`; รูปเปลี่ยน → แจ้ง n8n |
| `PUT status` | admin | เปลี่ยนสถานะ + บันทึกผู้เปลี่ยน/เวลา |
| `DELETE delete` | admin | ลบใบสมัคร (ใช้จัดการรายการซ้ำ กรณียืนยันตัวตนไม่ผ่านแล้วยื่นเป็นรายใหม่ซ้ำ); ถ้าบุคคลไม่เหลือใบสมัครเลยให้ลบทะเบียนบุคคลด้วย |

- Auth helper `_auth.js` ตาม pattern `pages/api/pm25/_auth.js`
  (getAuth → Mongo user → appId → allowedPages → superadmin ลัด)
- ของเดิม `pages/api/education/*` คงไว้ชั่วคราวแบบ read-only ระหว่างเปลี่ยนผ่าน
  แล้วลบใน commit สุดท้าย (`fix-duplicates`, `reset-applicant-id`,
  `bulk-update-prefix` เป็นสคริปต์ครั้งเดียว ไม่ย้ายไปโมดูลใหม่)

## 5) n8n integration

### ฝั่งแอป — `lib/smart-school/notify.js`

- Events 3 ตัว: `school.submitted` (หัว "📚 รายใหม่"),
  `school.renewal_updated` (หัว **"🔄 รายเก่า update ข้อมูล"**),
  `school.images_changed` (หัว "🖼️ เปลี่ยนรูปภาพ")
- Payload: `{ event, header, data: { applicationId, name, surveyYear,
  educationLevel, phone, address, note, images[], location } }`
- URL จาก env `N8N_SCHOOL_WEBHOOK_URL` (default = URL railway เดิม เพื่อไม่ต้อง
  ตั้ง env เพิ่มทันที) — fire-and-forget + timeout 5s ตามแนว `lib/n8nWebhook.ts`

### ฝั่ง n8n — workflow "Api All" (`WmudE1P882vIgxhv`)

- แก้ `HTTP Request6`: เลิกประกอบ JSON ด้วย string interpolation → ใช้ expression
  ที่ `JSON.stringify` ทั้ง body (กัน newline/quote) แบบเดียวกับที่เคยแก้
  Telegram node ฝั่งร้องเรียน
- ข้อความ: ใช้ `header` จาก payload เป็นหัว, รูปภาพ join เท่าที่มีจริง
  (ไม่ขึ้น "undefined")
- รองรับ **ทั้ง payload เก่าและใหม่**: ถ้าไม่มีฟิลด์ `header` ให้ใช้หัวข้อความ
  เดิม ("📚 แจ้งสำรวจข้อมูลทางการศึกษา") — ตัดปัญหาลำดับ deploy
  (แก้ n8n ก่อนได้เลยโดยระบบเดิมไม่พัง)
- แก้แล้วต้อง **publish workflow** (บทเรียนจากรอบก่อน — แก้อย่างเดียวไม่มีผล)

## 6) Migration — `scripts/migrate-education-to-smart-school.js`

- รันด้วย `node --env-file=.env.local scripts/migrate-education-to-smart-school.js [--dry-run]`
- อ่าน `educationregisters` ทั้ง 238 รายการ → สร้าง `SchoolApplicant`
  (ไม่มี citizenId) + `SchoolApplication` `surveyYear: 2568`,
  `status: 'ตรวจสอบแล้ว'` (ข้อมูลปีที่แล้วถือว่าผ่านกระบวนการแล้ว),
  `isRenewal: false`
- Idempotent: upsert โดยยึด `legacyId` — รันซ้ำไม่เกิดข้อมูลซ้ำ
- `--dry-run` แสดงสรุปจำนวน/ตัวอย่างโดยไม่เขียน
- **ห้ามแตะ collection เดิม** — เก็บเป็น backup ถาวร

## 7) หน้าแอดมิน `/admin/smart-school`

- แท็บตามปีงบประมาณ; ในแต่ละปี: summary cards, ตาราง (ค้นหา/filter
  สถานะ + รายเก่า-ใหม่), แผนที่ Leaflet, detail/edit modal
  (ความสามารถเทียบเท่า education-map เดิม แต่แตกไฟล์ตาม component)
- **ป้ายเตือนกติกาครัวเรือน** (เตือนอย่างเดียว ไม่บล็อก — เจ้าหน้าที่ตัดสิน):
  - ผู้ยื่นปีนี้ที่มีใบสมัครปีที่แล้วสถานะ `ได้รับทุน` → ป้าย
    "🔁 ได้ทุนปีที่แล้ว — ตามกติกาต้องหมุนเวียนเปลี่ยนคน"
  - ใบสมัครปีเดียวกันที่ **เบอร์โทรตรงกัน หรือที่อยู่ตรงกันทั้งข้อความ** →
    จัดกลุ่ม "น่าจะครัวเรือนเดียวกัน" ให้เห็นด้วยกัน
  - ตอนจะตั้งสถานะ `ได้รับทุน`: ถ้ากลุ่มครัวเรือนเดียวกันมีผู้ได้ทุนปีนี้แล้ว
    หรือคนนี้ได้ทุนปีที่แล้ว → dialog เตือนก่อนยืนยัน
- Edit modal: แก้ได้ทุกฟิลด์รวมรูป (บันทึกจริง + แจ้ง n8n เมื่อรูปเปลี่ยน) +
  ช่อง backfill เลข 13 หลักรายคน
- ลงทะเบียนหน้า **ครบ 4 จุด** ตาม `.claude/skills/adding-admin-page/`:
  `ALL_PAGES`, `DEFAULT_PERMISSIONS`, เมนู `LayoutAdmin.tsx`,
  สคริปต์เพิ่มสิทธิ์ user เดิมที่มี custom `allowedPages`
- `/admin/education-map` → เปลี่ยนเป็น redirect ไป `/admin/smart-school`
  (สิทธิ์เดิมของ user ที่มี `/admin/education-map` ให้สคริปต์สิทธิ์เพิ่ม
  `/admin/smart-school` ให้ด้วย)

## Error handling & ความปลอดภัย

- lookup/verify เป็น public: จำกัดผลลัพธ์, ไม่คืนข้อมูลอ่อนไหวก่อนยืนยัน
  เลข 13 หลัก, ค้นชื่อคืนเฉพาะ record ที่ยังไม่ถูกผูกเลขบัตร
  (record ที่ผูกแล้วต้องรู้เลขเต็มเท่านั้นจึงเข้าถึงได้)
- n8n ล้มเหลว/timeout → ไม่ block การบันทึก (fire-and-forget, log อย่างเดียว)
- เลข 13 หลัก: validate checksum ทั้ง client และ server
- ออกเลข `applicationId` ผ่าน counter atomic — ไม่มี race แบบเดิม

## การทดสอบ/ตรวจรับ (repo ไม่มี test runner)

1. `npm run lint` + `npm run build` ผ่าน
2. Migration `--dry-run` แล้วรันจริงกับฐาน dev → นับยอด 238/238 + spot-check
3. เดินฟอร์มครบ 4 เส้นทาง: รายใหม่ / รายเก่าเจอด้วยเลขบัตร / รายเก่าค้นชื่อ+ผูกเลข /
   หาไม่เจอ→ยื่นรายใหม่
4. ทดสอบ n8n ด้วย payload ที่มี newline + `"` ใน note และรูป 1 รูป
   (ผ่าน test แล้วค่อย publish)
5. แอดมิน: แก้รูปแล้วบันทึกจริง + ได้แจ้งเตือน, เปลี่ยนสถานะ, backfill เลขบัตร
6. ป้ายครัวเรือน: สร้าง 2 ใบสมัครเบอร์เดียวกัน → เห็นกลุ่ม; ตั้ง `ได้รับทุน`
   คนที่สองในกลุ่ม/คนที่ได้ปีที่แล้ว → มี dialog เตือน

## นอกขอบเขต (YAGNI)

- OTP/SMS ยืนยันตัวตน (ใช้เลข 13 หลักพอ), การอนุมัติทุนหลายขั้น/คณะกรรมการ,
  การบล็อกยื่นอัตโนมัติตามกติกาครัวเรือน (ทำแค่ป้ายเตือน), RPA/LTAX,
  การรวม StudentFeedback เข้าโมดูลนี้ (คงแยกตาม roadmap activities),
  export รูปแบบใหม่ ๆ นอกเหนือที่หน้าเดิมมี
