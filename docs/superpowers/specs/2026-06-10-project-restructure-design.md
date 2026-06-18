# Design: ปรับโครงสร้างโปรเจกต์เป็นกลุ่มงาน (feature modules)

วันที่: 2026-06-10 · สถานะ: เฟส 1 ทำเสร็จแล้ว, เฟสถัดไปดู roadmap

## ปัญหา

โปรเจกต์เติบโตโดยขาดการแยกโครงสร้างกลุ่มงาน:

- โค้ดโรงเรียนผู้สูงอายุฝังใน smart-health (แท็บใน UI, API ใต้ `/api/smart-health/elderly/*`, lib ถูก employee-health ยืมใช้)
- Components ของ complaints / satisfaction / activities ฯลฯ ~20 ไฟล์กองที่ root ของ `components/`
- API กำพร้าที่ root ของ `pages/api/` และมีไฟล์ซ้ำซ้อน (`*New`)
- User schema ถูก redefine inline หลายที่
- ไม่มีเอกสารโครงสร้างรายโมดูล ทำให้เพิ่มฟีเจอร์ใหม่แล้ววางผิดที่ซ้ำ ๆ

## แนวทางที่เลือก (แนวทาง A)

**จัดกลุ่มตาม feature ภายในโฟลเดอร์มาตรฐานของ Next.js Pages Router** — คง
`pages/`, `components/`, `models/`, `lib/` แต่บังคับโฟลเดอร์ย่อยรายโมดูล
(ตามแบบ `models/smart-papar/` ที่มีอยู่เดิม) ไม่ใช้โฟลเดอร์ `features/` กลาง
เพราะ churn ใหญ่และขัด convention ที่ Pages Router บังคับอยู่แล้ว

ตัวอย่าง (โมดูลโรงเรียนผู้สูงอายุหลังเฟส 1):

```
pages/admin/elderly-school.jsx        ← หน้า + เมนูของตัวเอง
pages/api/elderly-school/*            ← API ของโมดูล
components/elderly-school/            ← UI components
lib/elderly-school/                   ← business logic
lib/health/metrics.js                 ← ของกลางที่หลายโมดูลใช้ (BMI/BP)
models/elderly-school/                ← Mongoose models (collection เดิม)
```

## ข้อจำกัดตายตัว

- ห้ามเปลี่ยน path หน้า `/elderly/checkin` — QR ที่พิมพ์แจกไปแล้วชี้มาที่นี่
- ห้ามเปลี่ยนชื่อ Mongo collection — ข้อมูลจริงอยู่ใน production
- ห้ามย้าย `/api/cron/*` — scheduler ภายนอกเรียกด้วย `CRON_SECRET`
- เพิ่ม/ย้ายหน้า admin ต้องคิดเรื่อง `allowedPages` ใน Mongo เสมอ
  (user ที่มี custom allowedPages จะไม่เห็นหน้าใหม่จนกว่าจะ migrate/ได้รับสิทธิ์)

## สิ่งที่ทำในเฟส 1 (เสร็จแล้ว)

1. สกัด `computeBMI` / `bmiCategoryThai` / `bpCategory` / `coerceMeasurementNumber`
   → `lib/health/metrics.js` (single source — employee-health ใช้ร่วม)
2. ย้าย lib / models / API / components ของโรงเรียนผู้สูงอายุเข้าโฟลเดอร์
   `elderly-school/` ของแต่ละชั้น (ใช้ `git mv` รักษา history)
3. หน้าใหม่ `/admin/elderly-school` + เมนู sidebar + ลงทะเบียน `ALL_PAGES`
   (พร้อมแก้ bug แฝง: `/admin/elderly-schedule` ไม่เคยอยู่ใน registry)
4. shim ชั่วคราว `/api/smart-health/elderly/checkin` → endpoint ใหม่ (ลบเฟสถัดไป)
5. Migration script `scripts/grant-elderly-school-permission.js`
   — **ต้องรันกับ production คู่กับการ deploy เฟสนี้**

## Roadmap เฟสถัดไป

ดู `docs/modules/README.md` (เฟส 2: ฟีดกิจกรรม → เฟส 3: complaints →
เฟส 4: education → เฟส 5: models/lib ที่เหลือ → เฟส 6: User schema กลาง →
เฟส 7: เก็บกวาด API กำพร้า/dead code)
