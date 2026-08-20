# ดีไซน์เฟส 2: Wizard แจ้งทุกข์-แจ้งเหตุ (`/preview/report`)

วันที่: 2026-08-18 · สถานะ: อนุมัติแล้ว · เฟสก่อนหน้า: `2026-08-18-citizen-home-redesign-design.md`
· อ้างอิงภาพ: แคนวาส section 2 (F1–F4, บรรทัด ~415–578 ใน `Smart Takhli Redesign.dc.html`)

## สรุป

เปลี่ยนการแจ้งเรื่องบน `/preview` จาก modal ฟอร์มยาวหน้าเดียว (`ComplaintFormModal`)
เป็น wizard 3 ขั้น + จอสำเร็จ ตามแคนวาส — **ฟอร์มเดิมบนหน้าแรกเก่าไม่ถูกแตะ**

## การตัดสินใจ (ตอบโดยเจ้าของโปรเจกต์)

- **ทางเข้า:** กดการ์ดหมวดร้องเรียนบนหน้าแรก → `/preview/report?category=<Prob_name>`
  **เริ่มขั้น 2 ทันที** (หมวดตั้งให้แล้ว ย้อนขั้น 1 เพื่อเปลี่ยนได้) · ปุ่ม "เริ่มแจ้งเรื่อง"
  → `/preview/report` เริ่มขั้น 1 · หมวดบริการ (กายอุปกรณ์/สำรวจการศึกษา) ไม่เกี่ยว
  กับ wizard — เปิด modal เดิมบน `/preview` ตามเดิม
- **โครงหน้า:** หน้าเดียวคุม step ภายใน ไม่แยก route ราย step · ใช้ CitizenShell แบบ
  ซ่อน Nav ล่าง (จอ wizard มีแถบปุ่มของตัวเอง: ย้อนกลับ/ถัดไป/ส่งเรื่อง) · ยกเว้น
  `/preview/*` จาก layout เดิมใน `components/Layout.js`

## ขั้นตอน (ตามแคนวาส F1–F4)

1. **เลือกหมวดหมู่** — การ์ดแถว: ไอคอนจาก `Prob_pic` + ชื่อหมวด + บรรทัดรองเป็น
   ตัวอย่างรายการปัญหาของหมวด (join จาก problemOptions ตัดพอดีบรรทัด) · เลือกแล้ว
   ขอบม่วง+เครื่องหมายถูก · ปุ่ม "ถัดไป"
2. **รายละเอียดปัญหา** — ชุมชน (`CommunitySelector` เดิม) · chips รายการปัญหา
   (multi, filter ตามหมวด, สไตล์แคนวาส) · แนบรูป ≤3 (`ImageUploads` เดิม) ·
   "ย้อนกลับ / ถัดไป"
3. **ข้อมูลผู้แจ้ง + ตำแหน่ง** — segmented คำนำหน้า (นาย/นาง/นางสาว) · ชื่อ-นามสกุล ·
   เบอร์โทร · รายละเอียดเพิ่มเติม · แผนที่+toggle ตำแหน่งปัจจุบัน (`LocationConfirm`
   เดิม) · "ย้อนกลับ / ส่งเรื่อง"
4. **ส่งสำเร็จ** — ติ๊กเขียวใหญ่ · การ์ดเลขที่เรื่อง (monospace ม่วง) + ชิป
   "อยู่ระหว่างดำเนินการ" · การ์ด LINE OA (oaMessage deep link "สถานะ <เลขเรื่อง>"
   ตาม logic เดิมใน ComplaintFormModal:152-167) · ปุ่ม "ติดตามสถานะเรื่อง" →
   `/status` · "กลับหน้าแรก" → `/preview`

## กติกาข้อมูล — เหมือนฟอร์มเดิมทุกไบต์

- เกณฑ์ validate = zod schema เดิม (`ComplaintFormModal.js:15-27`) แยกตรวจราย
  ขั้น: ขั้น 1 category · ขั้น 2 community + selectedProblems≥1 + imageUrls 1–3 ·
  ขั้น 3 prefix + fullName≥2 + phone 10 หลัก + detail + location — ก่อนส่งจริง
  ตรวจรวมทั้งก้อนซ้ำ · error แสดงใต้ฟิลด์ (ไม่ใช้ Swal รวม)
- payload + endpoint เดิมเป๊ะ: `POST /api/submittedreports/submit-report` + header
  `x-app-id` · `problems` map id→label · `status: "อยู่ระหว่างดำเนินการ"` ·
  `officer: ""` — **payload builder เป็นฟังก์ชันล้วนใน `lib/citizen/report/` มีเทสต์
  เทียบ shape กับของเดิม**
- กันกดส่งซ้ำ + กันส่งระหว่างรูปกำลังอัปโหลด เหมือนเดิม

## โครงไฟล์

```
pages/preview/report.tsx            — state machine ของ wizard + submit
components/citizen/report/
  WizardHeader.tsx                  — ปุ่มย้อน + ชื่อขั้น + "ขั้นที่ N จาก 3" + progress 3 ท่อน
  WizardFooter.tsx                  — แถบปุ่มล่าง (ย้อนกลับ / ถัดไป / ส่งเรื่อง)
  StepCategory.tsx · StepDetails.tsx · StepReporter.tsx · StepSuccess.tsx
lib/citizen/report/
  schema.js                         — zod รายขั้น + รวม (เกณฑ์เดิม) + เทสต์
  payload.js                        — buildComplaintPayload(state) + เทสต์
components/citizen/CitizenShell.tsx — เพิ่ม prop hideNav
components/Layout.js                — ยกเว้น /preview/* จาก layout เดิม
components/citizen/home/ServiceGrid + pages/preview.tsx — หมวดร้องเรียนชี้ไป wizard
```

Reuse ตรง ๆ: `CommunitySelector`, `ImageUploads`, `LocationConfirm`,
`useMenuStore`, `useProblemOptionStore` · แตะของเก่าเพิ่ม: เฉพาะเงื่อนไข route ใน
`Layout.js` เท่านั้น

## การทดสอบ

- vitest: schema รายขั้น (ขอบเขต/ข้อความ error เดิม) + payload builder (shape
  ตรงของเดิมรวม status/officer/problems-mapping)
- UI: ภาพแคปเทียบแคนวาสทีละจอ (มือถือ+จอคอม) บน dev พอร์ต 3100
- **ไม่ยิง submit จริงจาก Claude** — local ต่อ Mongo จริง การส่งจะสร้างเรื่องจริง
  + แจ้งเตือนเข้า LINE กลุ่มเจ้าหน้าที่ · การทดสอบส่งจริงเป็นของเจ้าของโปรเจกต์
  ตัดสินใจ (แนะนำหมวดทดสอบ/ลบทิ้งหลังเทส)

## นอกขอบเขต

หน้า status/activities โฉมใหม่ (เฟส 3-4) · โปรไฟล์ (เฟส 5) · แตะ
`ComplaintFormModal` เดิม · เปลี่ยน API ใด ๆ
