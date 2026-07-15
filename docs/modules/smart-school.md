# Smart School (สำรวจการศึกษา / ทุนการศึกษา)

ทะเบียนผู้ขอทุนแบบ "บุคคล + ใบสมัครรายปีงบประมาณ" — รายเก่าค้นด้วยชื่อ-นามสกุล
แล้วยืนยันตัวเบา ๆ ด้วยเลข 4 ตัวท้ายเบอร์โทรก่อนดึงข้อมูลปีที่แล้วมาแก้ไข
(กันคนเดาชื่อคนอื่นแล้ว harvest ที่อยู่/รายได้/GPS/เบอร์โทร — เบอร์ใช้ร่วมกันใน
บ้านเดียวกันยืนยันผ่านได้ เพราะเป็นแค่ soft confirm ไม่ใช่ตัวชี้ตัวเฉพาะคน)
ข้อมูลทุกปีเก็บครบ
(spec: `docs/superpowers/specs/2026-07-03-smart-school-redesign-design.md`,
ต่อยอดกระบวนการพิจารณา/จัดสรรทุน:
`docs/superpowers/specs/2026-07-04-smart-school-scholarship-consideration-design.md`)

## หน้า

- `/admin/smart-school` — แดชบอร์ด (แท็บปีงบ, มุมมองตาราง/แผนที่/โรงเรียนไม่ผ่าน/
  จัดสรรทุน/เลขบัตร, สถานะ 4 ค่า, แท็กครัวเรือนเดียวกันคลิกดูสมาชิกได้)
- `/admin/education-map` — path เดิม redirect มาหน้านี้
- ฟอร์มสาธารณะ: wizard ใน `components/smart-school/survey/` เปิดจากหน้าแรก

## API — `pages/api/smart-school/`

- public: `lookup` (ค้นด้วยชื่อ คืนผลมาสก์ ≤10 รายการ), `prefill` (POST
  `{ ref, phoneLast4 }` — ต้องส่งเลข 4 ตัวท้ายเบอร์โทรตรงกับที่มีในระบบก่อนคืน
  ข้อมูลใบสมัครล่าสุดของ `ref` นั้น; ไม่ตรง = 403), `submit` (ใบสมัครปีปัจจุบัน +
  n8n), `blocked-schools/public` (GET รายชื่อโรงเรียนไม่ผ่านเกณฑ์ ไม่ต้อง auth
  ให้ฟอร์มเตือน)
- admin (`_auth.js` pattern เดียวกับ pm25): `list` (จัดกลุ่มครัวเรือนจาก
  `householdKey` แนบ `household.members` ต่อแถว), `update` (รวมรูป), `status`,
  `delete`, `blocked-schools/index` (GET/PUT/DELETE จัดการ blocklist)
- `citizen-id` (PUT, admin) — ผูก/ล้างเลขบัตร 13 หลักให้ applicant (checksum
  mod-11 + unique sparse กันซ้ำ, ซ้ำ = 409 พร้อมชื่อผู้ถือเลข); `update` รับ
  `citizenId` ด้วย; ทุก endpoint ตอบเฉพาะเลขมาสก์ — **เลขเต็มไม่ออกจากเซิร์ฟเวอร์**
  (logic รวมที่ `_citizenId.js`, helper pure ที่ `lib/smart-school/citizenId.js`)
- `verify.js` (ยืนยันเลขบัตร 13 หลัก) **ถูกลบแล้ว** — เส้นทางรายเก่าเปลี่ยนเป็น
  `lookup` → เลือก ref → `prefill` (ยืนยันด้วยเลข 4 ตัวท้ายเบอร์โทรแทน)

## Models — `models/smart-school/`

- `SchoolApplicant` → `school_applicants` (บุคคล; `citizenId` unique sparse —
  เจ้าหน้าที่ backfill ฝั่งแอดมิน เตรียมยืนยันตัวตนปีหน้า (spec 2026-07-15);
  **ไม่ใช่ credential ฝั่ง public ปีนี้** — ฟอร์มสาธารณะยังใช้ค้นชื่อ + เบอร์ 4 ตัวท้าย;
  โปรดักชันรัน `node --env-file=.env.local scripts/sync-school-citizenid-index.js` ครั้งเดียว)
- `SchoolApplication` → `school_applications` (ใบสมัคร/ปี; unique
  `applicantRef+surveyYear`; เลขใบสมัคร `TKC69-001` ออกผ่าน `school_counters`;
  ฟิลด์เกณฑ์/จัดสรรทุน: `residencyOverOneYear` (bool|null),
  `schoolEligibility` (`ok`/`block`), `eligibilityChecklist`
  (`residencyVerified`/`schoolVerified`/`documentsVerified`), `householdKey`
  (คีย์ครัวเรือน normalize จากที่อยู่), `scholarshipAmount`)
- `BlockedSchool` → `school_blocked_schools` (ชื่อโรงเรียนที่ไม่ผ่านเกณฑ์ —
  เอกชน/นอกเขต; แอดมินเพิ่ม/ลบเองผ่านหน้าแอดมิน ไม่มี whitelist — โรงเรียนที่ไม่
  อยู่ในลิสต์ถือว่า `ok` โดยปริยาย)
- collection เดิม `educationregisters` **ไม่ถูกแตะ** — backup ถาวร
  (migrate ด้วย `scripts/migrate-education-to-smart-school.js`)

## lib/smart-school/

- `scholarshipLevels.js` — ค่าคงที่โควตา + จำนวนเงินทุนต่อระดับ (`levelBucket`)
  ปี 2569 (แก้ปีถัดไปที่ไฟล์นี้ที่เดียว) พร้อม helper `levelBucket()` (แม็ป
  educationLevel → กลุ่มระดับ), `bucketInfo()`, `normalizeSchool()`,
  `householdKeyOf()`
- `citizenId.js` — normalize/checksum mod-11/mask เลขบัตร (pure — client ใช้ด้วย)
- `mask.js`, `fiscalYear.js`, `notify.js` — เดิม

## ครัวเรือนเดียวกัน + จัดสรรทุน (แอดมิน)

- `householdKey` คำนวณจากที่อยู่ (normalize ตัดช่องว่าง/lowercase) เก็บตอน
  submit/update — `list.js` จับกลุ่มด้วยคีย์นี้แล้วแนบ `household.members`
  (ไม่รวมตัวเอง) ต่อแถว; ตาราง/`ApplicationDetailModal` แสดงแท็ก "🏠 บ้านเดียว
  กับ" คลิกดูรายละเอียดสมาชิกได้
- `AllocationBoard` (แท็บ "จัดสรรทุน" ใน dashboard) — โต๊ะช่วยเจ้าหน้าที่คัดเลือก
  ผู้รับทุนตามโควตาแต่ละระดับจาก `scholarshipLevels.js`; **decision-support
  เท่านั้น ไม่มี auto-ranking** — เจ้าหน้าที่เลือกเอง กด "ให้ทุน" แล้วตั้ง
  `status='ได้รับทุน'` + `scholarshipAmount`; `ApplicationDetailModal` โชว์
  "จำนวนเงินทุน" เมื่อมีค่า
- `BlockedSchoolsPanel` (แท็บ "โรงเรียนไม่ผ่าน") — ดู/เพิ่ม/ลบ blocklist ผ่าน
  `blocked-schools/index`

## n8n

`lib/smart-school/notify.js` ยิง webhook `sm-school` (workflow "Api All") 3 events:
`school.submitted` / `school.renewal_updated` ("รายเก่า update ข้อมูล") /
`school.images_changed` — ENV override: `N8N_SCHOOL_WEBHOOK_URL`

## หมายเหตุ

- `pages/api/student-feedback/*` + `StudentFeedback` ยังแยกอยู่กับโมดูล
  activities (ดู activities.md)
- โมดูล education เดิมถูกปลดระวาง 2026-07 — โค้ดเก่าดูได้จาก git history
