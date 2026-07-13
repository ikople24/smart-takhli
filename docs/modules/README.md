# โมดูลของระบบ smart-takhli

เอกสารโครงสร้างรายกลุ่มงาน — หนึ่งไฟล์ต่อหนึ่งโมดูล อัปเดตทุกครั้งที่โครงสร้างโมดูลเปลี่ยน

| โมดูล | เอกสาร | หน้าหลัก |
|---|---|---|
| เรื่องร้องเรียน | [complaints.md](complaints.md) | `/complaint`, `/admin/manage-complaints` |
| โรงเรียนผู้สูงอายุ | [elderly-school.md](elderly-school.md) | `/admin/elderly-school` |
| Smart Health (ยืม-คืนอุปกรณ์, สุขภาพพนักงาน) | [smart-health.md](smart-health.md) | `/admin/smart-health` |
| การศึกษา (Smart School) | [smart-school.md](smart-school.md) | `/admin/smart-school` |
| เสาไฟสาธารณะ (Smart Light) | [smart-light.md](smart-light.md) | `/admin/smart-light` |
| กิจกรรม | [activities.md](activities.md) | `/activities`, `/admin/manage-activities` |
| ประเมินความพึงพอใจ | [satisfaction.md](satisfaction.md) | `/user/satisfaction` |
| PM2.5 (DustBoy) | [pm25.md](pm25.md) | `/admin/pm25-settings` |
| Smart Papar (คุณภาพน้ำประปา) | [smart-papar.md](smart-papar.md) | `/admin/smart-papar/water-quality` |
| Superadmin / สิทธิ์ | [superadmin-permissions.md](superadmin-permissions.md) | `/admin/superadmin` |
| แจ้งเตือน / Audit log | [notifications-audit.md](notifications-audit.md) | `/admin/notifications` |
| สถิติการเข้าชมเว็บไซต์ | [site-stats.md](site-stats.md) | `/` (การ์ดบนหน้าหลัก) |

## Convention โครงสร้างโมดูล

โมดูลหนึ่งตัว = โฟลเดอร์ย่อยชื่อเดียวกันในแต่ละชั้น:

```
pages/admin/<module>.jsx (หรือโฟลเดอร์)   ← หน้า admin
pages/api/<module>/                       ← API routes
components/<module>/                      ← React components
lib/<module>/                             ← business logic
models/<module>/                          ← Mongoose models
```

ของกลางที่หลายโมดูลใช้ อยู่นอกโฟลเดอร์โมดูล เช่น `lib/health/metrics.js`,
`lib/permissions.ts`, `lib/dbConnect.js`

ขั้นตอนเพิ่มหน้า/โมดูลใหม่: ดู `.claude/skills/adding-admin-page/SKILL.md`
และ `.claude/skills/adding-feature-module/SKILL.md`

## Roadmap การจัดระเบียบ (อัปเดต 2026-06-18)

- ✅ **เฟส 1 (เสร็จ)**: แยกโรงเรียนผู้สูงอายุออกจาก smart-health
- ✅ **เฟส 2 (เสร็จ): ฟีดกิจกรรม** — ยกระดับโมดูล activities:
  แอดมินโพสต์กิจกรรมพร้อมรูป (Cloudinary) + วันที่ดำเนินการ + แสดงผลประเมิน
  ความพึงพอใจรายกิจกรรม และแสดงฟีดที่หน้าหลัก (`pages/index.tsx`)
  — รายละเอียดใน [activities.md](activities.md)
- ✅ **เฟส 3 (เสร็จ)**: complaints — ย้าย root components → `components/complaints/`
  + dedup `*New` + ลบ dead code (2026-06-18); ย้าย `/api/assignments` →
  `/api/complaints/assignments` + อัปเดต caller (2026-06-19)
- ✅ **เฟส 4 (เสร็จ)**: education ถูกรีดีไซน์เป็นโมดูล `smart-school` เต็มรูปแบบ
  (models/API/components/lib ตาม convention) แทนที่จะย้าย component เดิม —
  โมดูลเก่าปลดระวางแล้ว 2026-07 (ดู [smart-school.md](smart-school.md));
  ความสัมพันธ์กับ activities ยังคงผ่าน `StudentFeedback.activityId`
- **เฟส 5**: satisfaction / pm25 components เข้าโฟลเดอร์, models ที่เหลือเข้า
  subfolder, lib รายฟีเจอร์เข้า `lib/<module>/`
- **เฟส 6**: เลิก inline User schema ซ้ำซ้อน — ใช้ schema กลางที่เดียว
- **เฟส 7**: เก็บกวาด — API กำพร้า (`/api/menu.js`, `/api/upload.js`,
  `/api/problems.js`, `problem-options` vs `problemoptions`, `geojson-features` ซ้ำ),
  ลบ `components/sm-health/ElderlyDataTable.js` (dead code),
  ลบ shim `/api/smart-health/elderly/checkin`
  (✅ เพิ่ม auth ให้ API elderly-school ฝั่ง admin แล้ว 2026-06-19)
