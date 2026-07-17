# Smart School — แก้ปัญหาการใช้งานจริง (เจ้าหน้าที่เป็นผู้กรอก) — Design Spec

**วันที่:** 2026-07-16
**สถานะ:** อนุมัติแนวทางแล้ว (3 ข้อ) รอรีวิว spec

## บริบทที่เปลี่ยนสมมติฐาน
**ผู้กรอกฟอร์มส่วนใหญ่คือเจ้าหน้าที่ ไม่ใช่ประชาชน** — ของเดิมออกแบบโดยคิดว่าประชาชนกรอกเอง
(gate 4 ตัวท้าย · ฟอร์มสั้น · บังคับอัปรูป) จึงกลายเป็นอุปสรรคกับผู้ใช้จริง และเป็นต้นเหตุรูปขยะโดยตรง

---

## ปัญหา 1 — รูปขยะ + รูปเดิมถูกทับ (ร้ายแรงสุด)

**สาเหตุ (ตรวจจากโค้ดจริง — 3 บั๊กซ้อนกัน):**
1. `pages/api/smart-school/prefill.js:29` — `.select(...)` **ไม่มี `imageUrl`** → ฟอร์มรายเก่าเริ่มด้วยรูปว่างเสมอ
2. ฟอร์ม (`SchoolSurveyModal` zod `image.min(1)`) + server (`submit.js:45` reject ถ้า `image.length === 0`) **บังคับ ≥1 รูป** → เจ้าหน้าที่อัปอะไรก็ได้
3. `submit.js:92` `imageUrl: image.slice(0, 3)` → **ทับรูปที่อัปไว้รอบก่อน**

**ขอบเขตความเสียหาย (ตรวจแล้ว):** รูปปี 2568 **ปลอดภัย** (แยกคนละ document ต่อปี — `findOne({applicantRef, surveyYear})`)
ที่หายคือรูปที่อัปไว้**รอบก่อนในปีเดียวกัน** → กลายเป็นไฟล์ลอยใน Cloudinary

**ทางแก้ (เลือกแล้ว: โชว์รูปเดิม + ไม่บังคับอัปซ้ำ):**
- `prefill.js` — เพิ่ม `imageUrl` ใน `.select(...)`
- `SchoolSurveyModal.handleIdentityDone` — prefill `image: prev.imageUrl || []` เข้า formData
- **ไม่ต้องแก้ zod** — `min(1)` ผ่านเองเมื่อมีรูปเดิม; รายใหม่ยังต้องอัป ≥1 ตามเดิม (คงข้อกำหนดไว้)
- `submit.js` — **กันรูปหาย (defense in depth):** ถ้า `image` ว่างและใบเดิมมีรูปอยู่ → **คงรูปเดิม** ไม่ทับ/ไม่ reject
  (แทนที่ `imageUrl: image.slice(0,3)` แบบไม่มีเงื่อนไข)
- `MediaStep`/`PhotoSlots` — **ไม่ต้องแก้** (ตรวจแล้ว): `MediaStep` ส่ง `value={formData.image}` และ
  `PhotoSlots.jsx:15` map URL ที่มีอยู่ลงช่องให้เอง → พอ prefill รูปเข้า `formData.image` รูปเดิมจะโชว์ทันที

**ผลข้างเคียงที่ยอมรับแล้ว:** URL รูปถูกส่งถึงผู้ที่ผ่าน gate 4 ตัวท้าย (ระดับเดียวกับที่อยู่/รายได้/พิกัดที่ส่งอยู่แล้ว)

**นอกขอบเขต:** ล้างรูปขยะที่ค้างใน Cloudinary — งานแยก (ต้องเทียบ asset กับ `imageUrl` ในฐาน; Cloudinary MCP ยังไม่ได้ authorize)

---

## ปัญหา 2 — เลขบัตร: "แสดงคนที่มีเลขบัตรแล้วไม่ได้"

**สาเหตุ (หลังบ้านไม่ได้พัง):**
- ฟอร์ม public **ไม่มีช่องเลขบัตรเลย** (ตัดออกตอนเปลี่ยนไปค้นชื่อ) → "กรอกแล้วไม่บันทึก" เพราะไม่มีช่องให้กรอก
- หลังบ้านครบและทำงาน: `models/smart-school/SchoolApplicant.js:11` มี `citizenId` (unique sparse) ·
  `pages/api/smart-school/citizen-id.js` · `update.js` · **`list.js:52-61` ส่ง `hasCitizenId` + `citizenIdMasked` มาแล้ว**
- **`ApplicationTable` ไม่เคย render/กรองเลขบัตร** → ข้อมูลมาถึงหน้าจอแล้วแต่ไม่ได้แสดง

**ทางแก้ (เลือกแล้ว: เพิ่มคอลัมน์+ตัวกรองในตาราง admin — เลขบัตรกรอกเฉพาะหลังบ้านต่อไป):**
- `ApplicationTable` — เพิ่มคอลัมน์ "เลขบัตร": โชว์ `citizenIdMasked` ถ้ามี, badge "ยังไม่มี" ถ้าไม่มี
- เพิ่มตัวกรอง (select): `ทุกสถานะเลขบัตร | มีแล้ว | ยังไม่มี` ใช้ `hasCitizenId`
- **ไม่แตะ API/model** — ข้อมูลมาครบแล้ว
- **ไม่เพิ่มช่องเลขบัตรในฟอร์ม public** (ฟอร์มเปิดสาธารณะ = ใครก็ส่งเลขบัตรคนอื่นได้ → เสี่ยง PDPA)

---

## ปัญหา 3 — ฟอร์ม public มีฟิลด์ไม่ครบเท่าหลังบ้าน

**ช่องว่างจริง = 8 ฟิลด์** (public ขาด): `gradeLevel · gpa · actualAddress · familyStatus ·
incomeSource · receivedScholarship · takhliScholarshipHistory · citizenId`

**ทางแก้ (เลือกแล้ว: ติ๊ก "โหมดเต็ม" ในฟอร์ม public):**
- เพิ่ม **7 ฟิลด์** หลังติ๊ก — **ไม่รวม `citizenId`** (ตามข้อ 2: เลขบัตรกรอกเฉพาะหลังบ้าน)
- `InfoStep` — toggle "กรอกแบบเต็ม (ทวนข้อมูล)" → เผยฟิลด์เพิ่ม:
  | ฟิลด์ | ชนิด |
  |---|---|
  | `gradeLevel` | text (เช่น ป.5, ม.2) |
  | `gpa` | number (0–4) |
  | `actualAddress` | textarea |
  | `familyStatus` | chip เลือกหลายค่า (ค่าตาม `FAMILY_STATUS_OPTIONS` ใน EditModal) |
  | `incomeSource` | text คั่นด้วย , → array |
  | `receivedScholarship` | text คั่นด้วย , → array |
  | `takhliScholarshipHistory` | text คั่นด้วย , → array |
- `SchoolSurveyModal` — `EMPTY_FORM` += 7 ฟิลด์; prefill จาก `prevApplication`; ส่งใน payload
- `prefill.js` — `.select(...)` += 7 ฟิลด์ (รายเก่าจะได้เห็นค่าเดิม)
- `submit.js` — รับ + บันทึก 7 ฟิลด์
- **zod: ฟิลด์เพิ่มทั้งหมดเป็น optional** — ไม่ทำให้ flow สั้นเดิมพัง
- `schoolEligibility` / `eligibilityChecklist` **ไม่อยู่ในโหมดเต็ม** (เป็นดุลพินิจเจ้าหน้าที่ ทำหลังบ้านเท่านั้น)

---

## ไฟล์ที่แตะ
| ไฟล์ | ปัญหา |
|---|---|
| `pages/api/smart-school/prefill.js` | 1 (+imageUrl), 3 (+7 ฟิลด์ใน select) |
| `pages/api/smart-school/submit.js` | 1 (คงรูปเดิม), 3 (รับ 7 ฟิลด์) |
| `components/smart-school/survey/SchoolSurveyModal.jsx` | 1 (prefill รูป), 3 (EMPTY_FORM/prefill/payload/zod) |
| `components/smart-school/survey/InfoStep.jsx` | 3 (toggle + 7 ฟิลด์) |
| `components/smart-school/admin/ApplicationTable.jsx` | 2 (คอลัมน์ + ตัวกรอง) |

**ไม่แตะ:** models, permissions, หน้า admin อื่น, `citizen-id.js`, `update.js`,
**`MediaStep.jsx`/`PhotoSlots.jsx`** (ตรวจแล้วรองรับรูปเดิมอยู่แล้ว)

## Non-goals
- ไม่เพิ่มช่องเลขบัตรในฟอร์ม public
- ไม่ทำ "เพิ่มใบสมัคร" ฝั่ง admin (ทางเลือกที่ไม่ได้เลือกรอบนี้)
- ไม่ล้างรูปขยะเดิมใน Cloudinary (งานแยก)
- ไม่แตะ gate 4 ตัวท้าย

## Verification (ไม่มี test runner)
- `npm run lint` + `npm run build` เขียว
- เดิน dev server: รายเก่า → prefill ต้อง**เห็นรูปเดิม** และ**ส่งได้โดยไม่ต้องอัปใหม่**; ติ๊กโหมดเต็ม → เห็น 7 ฟิลด์พร้อมค่าเดิม
- ตาราง admin: คอลัมน์เลขบัตร + กรอง "มีแล้ว/ยังไม่มี" ตรงกับข้อมูล
- ตรวจว่ายื่นซ้ำแล้ว **รูปเดิมไม่ถูกทับ**
