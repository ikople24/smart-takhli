# Smart Waste — ขยะรีไซเคิลและขยะเปียก (กองสาธารณสุข)

บันทึกน้ำหนักขยะที่คัดแยกได้ **รายวัน วันละ 1 ชุดรวมทั้งเทศบาล หน่วยเป็นกิโลกรัม**
แทนไฟล์ Excel รายปีงบเดิม · สเปกเต็ม: `docs/superpowers/specs/2026-08-11-smart-waste-design.md`

## โครงสร้าง

| ชั้น | ไฟล์ |
|---|---|
| หน้า | `pages/admin/smart-waste.jsx` — หน้าเดียว 3 แท็บ (บันทึก · ข้อมูล · สรุป) + modal จัดการประเภท |
| API | `pages/api/smart-waste/` — `_auth.js` (requireWasteAdmin/Superadmin) · `types/` · `daily/` · `summary` · `export` · `import` |
| Components | `components/smart-waste/` — `wasteTheme.jsx` · `entry/` (DailyEntryForm, TypePickerSheet, TotalBar) · `admin/` (MonthTable, SummaryDashboard, TypeManagerModal) |
| Logic | `lib/smart-waste/` — wasteGroups (8 กลุ่ม fixed) · wasteTypesSeed (24 ประเภท) · fiscalYear · aggregate (computeTotals ที่เดียว) · importWorkbook · exportWorkbook · uiDate · เทสต์ vitest ใน `__tests__/` |
| Models | `models/smart-waste/WasteType.js` (`smart_waste_types`) · `WasteDaily.js` (`smart_waste_daily` — 1 doc = 1 วัน, unique `recordDate` แบบ 'YYYY-MM-DD') |

## กติกาสำคัญ

- **ปีงบประมาณ** ต.ค.–ก.ย. นับเป็น พ.ศ. (`fiscalYearOf('2025-10-01') === 2569`) — logic อยู่
  `lib/smart-waste/fiscalYear.js` ที่เดียว
- ยอดรวม (`groupTotals`/`totalKg`) denormalize ตอนบันทึก คำนวณด้วย `computeTotals()`
  ที่เดียว 3 จุดใช้ร่วม (API daily / import / export) — **ห้ามเชื่อ totals จาก client**
- 8 กลุ่มใหญ่ fixed ในโค้ด (หัวข้อรายงานส่งหน่วยงานภายนอก) · 24 ประเภทย่อยเป็น master data
  แอดมินแก้ได้ผ่าน modal ในหน้า (ไม่มีหน้าแยก — ไม่มี permission entry ที่ 2)
- ประเภทลบได้เฉพาะเมื่อไม่มีข้อมูลอ้างถึง (API ตอบ 409) — ปิดใช้งาน (`active: false`) แทน
- ธง `isHighlighted` (เริ่มต้น = ถุงอ่อน): StatCard ของตัวเอง + แถว `เฉพาะ<label>` ใน Excel export
- **นำเข้าไฟล์เก่า** ผ่าน `POST /api/smart-waste/import` (superadmin + dry-run ก่อนเสมอ)
  — ยอดอ้างอิง: ปีงบ 2568 = 245,509 กก. · ปีงบ 2569 (ถึง ธ.ค.68) = 42,196 กก.
- แก้ไขย้อนหลัง/ล้างวัน/นำเข้า เขียน `AuditLog` (`action: waste_daily_updated`) ฝั่ง server แล้ว

## ธีมและกราฟ

- Token ยืมจาก smart-school ผ่าน `components/smart-waste/wasteTheme.jsx` — **ห้าม import
  จาก `components/smart-school/` ตรง ๆ ในไฟล์อื่นของโมดูลนี้** · ถ้ามีโมดูลที่ 3 มายืมอีก
  ให้สกัดเป็น `components/ui/adminTheme` (กติกาข้อ 4 ของ skill adding-feature-module)
- สีกราฟ 8 กลุ่มใน `WASTE_GROUP_COLORS` ผ่าน dataviz validator แล้ว (ลำดับคงที่ตาม
  `WASTE_GROUPS`) — เปลี่ยนสีต้องรัน validator ใหม่ และแท็บสรุปต้องคงตารางรายเดือน
  (relief ของ 3 สีที่ contrast < 3:1)

## สิทธิ์

`/admin/smart-waste` อยู่ใน `ALL_PAGES` + `DEFAULT_PERMISSIONS.admin` (ชุดพื้นฐาน) +
เมนู sidebar · user เดิมที่มี custom `allowedPages`: รัน
`node --env-file=.env.local scripts/grant-smart-waste-permission.js` (dry-run ก่อน, `--yes` เขียนจริง)
หรือให้ superadmin ติ๊กรายคน · API ตรวจซ้ำฝั่ง server ทุกเส้นด้วย `requireWasteAdmin`
