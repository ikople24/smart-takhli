# เรื่องร้องเรียน (complaints)

ประชาชนยื่นเรื่องร้องเรียน → เจ้าหน้าที่รับ/มอบหมาย/ติดตามสถานะ →
ปิดเรื่อง + ชวนประเมินความพึงพอใจ มีระบบ PDPA สำหรับ "เรื่องลับ"

## หน้า

- Public: `/complaint` (ยื่นเรื่อง), `/complaint/[id_card]`, `/status` (ติดตามสถานะ)
- Admin: `/admin/manage-complaints`, `/admin/my-tasks`, `/admin/dashboard`, `/admin/analytics`

## API

- `pages/api/complaints/*`, `pages/api/problems.js` (⚠️ อยู่ root ของ api/)
- `pages/api/complaints/assignments/*` — การมอบหมายงาน (ย้ายเข้าใต้ complaints แล้ว เฟส 3, 2026-06-19)
- `pages/api/complaints/consent-log.ts` — บันทึกหลักฐานยอมรับข้อตกลงก่อนแจ้งเรื่อง (ดูหัวข้อ
  "ข้อตกลงก่อนแจ้งเรื่อง") **ทางเดียวใน `pages/api/complaints/` ที่เป็น public write ไม่ผ่าน Clerk**
- `pages/api/problem-options.js` + `pages/api/problemoptions/` (⚠️ ซ้ำซ้อน — เฟส 7)

## Models

`Complaint`, `Assignment`, `AdminOption`, `ReportConsentLog` (`models/complaints/ReportConsentLog.js`
— collection `report_consent_logs`)

> `Assignment` ถูกขยาย (role / stage / dueDate / SLA pause / coordination / blocked / timeline) และ
> `Complaint.organizationId` เพิ่มใน **ทั้ง** `models/Complaint.js` และ `models/SubmittedReport.js`
> โดยโมดูลงานเจ้าหน้าที่ — ดู [tasks.md](tasks.md)

## Components (`components/complaints/`)

`ComplaintFormModal`, `ComplaintDetailModal`, `ComplaintStats`, `OverdueComplaintsAlert`,
`ExportComplaints`, `CardAssignment`, `CardModalDetail`, `CardOfficail`,
`ReporterInfoMap`, `ReporterInput`, `CommunitySelector`

> `UpdateAssignmentModal` + `PUT /api/complaints/assignments/update` ปลดระวางแล้ว (2026-09-02) —
> ปุ่ม "อัพเดท" ในหน้าจัดการเรื่องร้องเรียนพาไปหน้างานเจ้าหน้าที่ `/admin/my-tasks/[assignmentId]` (ทางเขียนเดียว)
> · ปิดเรื่องจากหน้าทะเบียนจะตั้ง `assignment.completedAt/stage` ให้ด้วย · `assignments/{create,update-status}` บังคับล็อกอินแล้ว

> ย้ายเข้าโฟลเดอร์โมดูลแล้ว (เฟส 3, 2026-06-18). คู่ซ้ำ `*New` รวมเป็นชื่อหลักแล้ว;
> dead code (`CardCompleted`, `ReporterInfoCard`, `*เก่า`) ถูกลบ
> `TaskCard.tsx` ยังอยู่ root (cross-cutting: complaint|feedback)

## PDPA / เรื่องลับ

- ตรรกะอยู่ `lib/complaintPrivacy.js`
- เบลอภาพ: Cloudinary `e_blur` URL transform
- เซ็นเซอร์ข้อความ: เก็บ `pdpaDetailRedactions` (`{start,end}[]`) ที่แอดมินลากเลือกใน
  `ComplaintDetailModal`
- `lib/pdpaTextMask.js#maskSensitiveWords` ยังอยู่แต่**ไม่ใช้กับ flow สาธารณะแล้ว**

## ข้อตกลงก่อนแจ้งเรื่อง (consent)

- จอข้อตกลงเป็น **ขั้นที่ 0 ของ `/report`** (`step: "consent"` ใน `pages/report.tsx` ไม่ใช่ route
  แยก) — ทุกทางเข้ารวมถึง `?category=` จากการ์ดหน้าแรกต้องผ่านด่านนี้ก่อนเสมอ (ตั้งหมวดล่วงหน้าได้
  แต่ข้ามด่านไม่ได้) กั้นไว้**ก่อนขั้นแนบรูป** เพราะ `PhotoUploader` เรียก `uploadToCloudinary`
  ทันทีที่เลือกไฟล์ และ cloud นั้นใช้ร่วมกับแอปพี่น้อง (ลบไฟล์กำพร้าไม่ได้)
- ข้อความ + เลขฉบับอยู่ `lib/citizen/report/consentContent.js` **ที่เดียว** — ขยับ `CONSENT_VERSION`
  = คนที่เคยยอมรับฉบับเก่าเห็นจอข้อตกลงอีกครั้ง (`shouldShowConsent()` เทียบเลขฉบับกับที่เก็บใน
  `localStorage`) **ห้ามลบ**เลขฉบับเก่าออกจาก `KNOWN_CONSENT_VERSIONS` เพราะ `validateConsentLog()`
  ใช้ตรวจ body ของ log API
- หลักฐาน 3 ชั้น: `localStorage` คีย์ `tk.report.consent` (อ่าน/เขียนผ่าน `consentStorage.js`) ·
  ฟิลด์ `consent` บนเอกสารเรื่องร้องเรียนเอง (**ต้องมีทั้ง** `models/Complaint.js` และ
  `models/SubmittedReport.js`) · collection **`report_consent_logs`**
  (`models/complaints/ReportConsentLog.js`) เขียนผ่าน `POST /api/complaints/consent-log` —
  **ทางเขียนสาธารณะ ไม่มี GET ให้อ่านกลับ**, upsert ด้วย `{deviceId, version}`, ไม่เก็บ
  IP/user-agent/ชื่อ-เบอร์
- แต่ละแถวใน `report_consent_logs` มีเวลา 2 ฟิลด์คนละความหมาย: `acceptedAt` คือเวลาที่**เครื่อง
  ผู้ใช้อ้าง** (มากับ body) ส่วน `createdAt` (timestamps) คือเวลาที่**เซิร์ฟเวอร์รับจริง** — ยึด
  `createdAt` เป็นหลักฐานหลักเมื่อสองค่าขัดกัน (นาฬิกาเครื่องผู้ใช้เพี้ยนได้)
- `consent-log.ts` เป็น endpoint สาธารณะไม่ผ่าน Clerk (ผู้แจ้งไม่มีบัญชี) จึงตรวจ body เข้มด้วย
  `validateConsentLog()` — เลขฉบับต้องอยู่ใน `KNOWN_CONSENT_VERSIONS`, `deviceId` ต้องผ่าน
  `DEVICE_ID_PATTERN`; ส่วน `acceptedAt` ที่พาร์สไม่ออกหรือเพี้ยนเกิน 2 วันจาก server ไม่ทำให้
  request ล้ม แค่ถูกแทนด้วยเวลาเซิร์ฟเวอร์แทน
- ตอนบันทึกเรื่องร้องเรียน (`pages/api/submittedreports/submit-report.js`) มี guard เดียวกันอีก
  ชั้นที่**เซิร์ฟเวอร์ ไม่ใช่แค่ฝั่งเบราว์เซอร์**: `consentForPayload()` ทิ้งข้อมูล consent ที่
  รูปแบบผิดก่อนส่งเข้า `SubmittedReport.create()` เสมอ เพราะ `acceptedAt` ที่พาร์สเป็น `Date`
  ไม่ออกจะทำให้ Mongoose throw `CastError` และ**เซฟทั้งเรื่องร้องเรียนไม่ผ่าน** ไม่ใช่แค่ส่วน
  consent หลุดหาย (หลักฐานการยอมรับจริงยังอยู่ที่ log ฝั่งเซิร์ฟเวอร์ตามข้อข้างบนอยู่แล้ว การไม่
  แนบใน payload นี้จึงไม่ใช่การเสียหลักฐาน)
- ข้อ 3 ของข้อตกลงอ้างสถานะ **"ตรวจสอบแล้วไม่พบเหตุ ณ เวลาปฏิบัติการ"** /
  **"บันทึกข้อมูลเพื่อเฝ้าระวัง"** ซึ่ง**ยังไม่มีใน `lib/tasks/status.js`** (มีแค่
  `IN_PROGRESS`/`COORDINATING`/`DONE`) — เจ้าของโปรเจกต์รับทราบแล้ว ยังไม่ตัดสินใจว่าจะตัด/ย่อ
  ข้อความ หรือเพิ่มสถานะจริงในรอบของโมดูล tasks
- สเปค: `docs/superpowers/specs/2026-09-16-report-consent-design.md` · แบบ:
  `docs/design_handoff_report_consent/`

## Integration (LINE)

- **แจ้งกลุ่มเจ้าหน้าที่ (2026-08)**: เรื่องใหม่ + ปิดงาน → push เข้า **LINE Group**
  (`lib/lineMessaging.ts#lineNotifyAdminGroup`) — groupId อ่านจาก Mongo `line_settings`
  (ตั้งผ่านหน้า `/admin/superadmin/line-settings`) fallback ไป env `LINE_ADMIN_GROUP_ID`;
  ไม่ตั้ง = skip เงียบ ๆ. **เลิกใช้** n8n/Telegram (`submit-tk`, `close-tk`,
  `complaintStatusChanged`, `complaintAssigned`, `assignmentCompleted`) และเลิกใช้
  multicast รายคน (`LINE_ADMIN_USER_IDS`)
- **webhook ขาเข้า** `pages/api/integrations/line-webhook.ts`: คำสั่ง `สถานะ <รหัส>` หรือ
  วางเลขเรื่องเปล่า ๆ (`TKC-690001` — เฉพาะแชท 1:1) → บันทึก `lineUserId` ผูกกับเรื่อง
  → รับ push เมื่อสถานะเปลี่ยน; `groupid` (ตอบ groupId ของกลุ่ม), event `join`
  (บอทเข้ากลุ่ม → ตอบ groupId), event `follow` (เพิ่มเพื่อน → ทักทาย+สอนวิธีติดตาม);
  ในกลุ่มบอทตอบ**เฉพาะคำสั่ง** ไม่ตอบข้อความทั่วไป
- **ฝั่งประชาชน**: dialog หลังส่งสำเร็จมีปุ่ม "ติดตามเรื่องนี้ผ่าน LINE" เป็น **oaMessage
  deep link** (`https://line.me/R/oaMessage/<basicId>/?สถานะ <เลขเรื่อง>` — parse basicId
  จาก `NEXT_PUBLIC_LINE_OA_URL`) เปิดแชทพร้อมข้อความเตรียมไว้ กดส่งทีเดียวผูกเรื่องเสร็จ
- LIFF ถอดออกจากโปรเจกต์แล้ว (2026-08-11): ลบ `lib/liff.ts`, dependency `@line/liff`,
  และ env `NEXT_PUBLIC_LIFF_ID` — flow ปัจจุบันใช้ oaMessage deep link + webhook แทน
  ถ้าจะทำ LINE login รอบใหม่ค่อยเพิ่ม LIFF กลับ
