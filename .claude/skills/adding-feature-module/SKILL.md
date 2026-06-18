---
name: adding-feature-module
description: Use when creating a new feature module (กลุ่มงานใหม่) in this repo, adding models/APIs/components for a feature, or deciding where new files belong — pages/api/components/lib/models placement
---

# เพิ่มโมดูลฟีเจอร์ใหม่ (กลุ่มงาน)

หนึ่งโมดูล = โฟลเดอร์ย่อย**ชื่อเดียวกัน**ในแต่ละชั้น ห้ามวางไฟล์ใหม่ที่ root
ของ `components/` หรือ `models/` (โค้ดเก่าที่ยังกองอยู่ root กำลังทยอยย้ายตาม
roadmap ใน `docs/modules/README.md` — อย่าเพิ่มภาระใหม่)

```
pages/admin/<module>.jsx      หน้า admin (ดู skill: adding-admin-page)
pages/api/<module>/           API routes
components/<module>/          React components
lib/<module>/                 business logic
models/<module>/              Mongoose models
docs/modules/<module>.md      เอกสารโมดูล (บังคับ)
```

ตัวอย่างที่ทำครบ: `elderly-school`, `smart-papar`

## กติกาสำคัญ

1. **Models**: export แบบ
   `mongoose.models.X || mongoose.model("X", schema, "collection_name")`
   — ระบุชื่อ collection เป็น argument ที่สามเสมอ จะย้ายไฟล์ภายหลังได้โดย
   ข้อมูลไม่กระทบ และห้ามเปลี่ยนชื่อ collection ที่มีข้อมูล production
2. **อย่าแตะ User schema มักง่าย**: User ถูก redefine inline หลายไฟล์
   (`pages/api/auth/verify-app-access.js`, `lib/pm25CronAuth.js`, …) —
   เพิ่มฟิลด์ต้องแก้ **ทั้ง** `models/CreateUser.js` **และ** inline schema ทุกที่
   ไม่งั้นฟิลด์หายเงียบจากผลคิวรี (`grep -rn 'mongoose.model("User"' pages lib`)
3. **Auth ของ API**:
   - ฝั่ง admin → pattern `pages/api/pm25/_auth.js#requirePm25Admin`
     (getAuth → Mongo lookup → appId → allowedPages → superadmin)
   - cron → `requireCronSecret` (`lib/pm25CronAuth.js`) + วางใต้ `pages/api/cron/<module>/` —
     **ห้ามใส่ Clerk ให้ cron endpoint** และห้ามย้าย path cron ที่ deploy แล้ว
   - public endpoint (เช่น checkin ผ่าน QR) → จงใจไม่มี auth ได้ แต่ต้องเขียน
     เหตุผลไว้ใน docs/modules/ ของโมดูล
4. **ของกลางข้ามโมดูล** (เช่น `lib/health/metrics.js`) อยู่นอกโฟลเดอร์โมดูล —
   ถ้าโมดูลอื่นเริ่ม import ของในโมดูลเรา ให้สกัดส่วนแชร์ออกเป็นไฟล์กลาง
   อย่าปล่อยให้โมดูลพันกัน (บทเรียนจริง: employee-health เคย import
   ฟังก์ชัน BMI จาก lib ของโรงเรียนผู้สูงอายุอยู่นาน)
5. **URL ที่หลุดออกนอกระบบ** (QR ที่พิมพ์แจก, ลิงก์ใน LINE OA) — path
   เปลี่ยนไม่ได้อีกแล้ว ระวังตั้งแต่ตอนตั้งชื่อ; ถ้าจำเป็นต้องย้าย ให้ทำ shim
   `export { default } from "<new-path>"` ค้างไว้อย่างน้อยหนึ่ง release
6. **ย้าย/รีเนมไฟล์** ใช้ `git mv` เสมอ และ build ให้ผ่านเป็น step ย่อย ๆ
7. จบงาน: เขียน `docs/modules/<module>.md` + เพิ่มแถวในตาราง
   `docs/modules/README.md` + อัปเดต CLAUDE.md ถ้าโครงสร้างหลักเปลี่ยน

## Common mistakes

| พลาด | ผลที่เกิด |
|---|---|
| วาง component ใหม่ที่ root ของ components/ | โมดูลพันกันเพิ่ม, หาไฟล์ไม่เจอ |
| ตั้ง API ใต้ prefix ของโมดูลอื่น "ชั่วคราว" | ติดถาวร — เคสจริง: elderly อยู่ใต้ smart-health 1+ ปี |
| เปลี่ยนชื่อ collection ตอนย้ายไฟล์ model | ข้อมูล production หาย/มองไม่เห็น |
| copy ฟังก์ชันข้ามโมดูลแทนสกัดเป็นไฟล์กลาง | logic แตกแถว แก้ที่เดียวไม่ครบ |
