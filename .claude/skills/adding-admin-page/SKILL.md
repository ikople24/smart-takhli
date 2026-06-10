---
name: adding-admin-page
description: Use when adding, renaming, or moving any /admin/* page in this repo — including pages hidden from the menu — or when a new admin page does not appear in the sidebar or users get access-denied after deploy
---

# เพิ่มหน้า /admin/* ใหม่

หน้า admin หนึ่งหน้า = ต้องลงทะเบียน **4 จุด** ไม่ครบ = เมนูไม่ขึ้น หรือ user เดิมโดน access-denied

ความผิดพลาดที่เคยเกิดจริง: `/admin/elderly-schedule` ถูกสร้างโดยไม่ลงทะเบียนใน
`ALL_PAGES` → user ที่มี custom `allowedPages` ไม่มีทางได้สิทธิ์หน้านี้ผ่าน
superadmin UI เลย (bug แฝงอยู่นานจนเจอตอน refactor)

## Checklist

1. **สร้างหน้า** ใน `pages/admin/<name>.jsx` ครอบเนื้อหาด้วย
   `<PermissionGuard>` (ไม่ใส่ `requiredPath` = ใช้ pathname ตัวเอง;
   ใส่ `requiredPath` เฉพาะหน้าลูกที่ยืมสิทธิ์หน้าแม่)
2. **`lib/permissions.ts` → `ALL_PAGES`**: เพิ่ม entry (path, label ไทย, icon,
   description, category: `settings|management|reports|user`)
   - หน้าที่เข้าผ่าน internal link เท่านั้น → ใส่ `hideFromMenu: true`
     (ยังต้องลงทะเบียน! ไม่งั้นกำหนดสิทธิ์ให้ไม่ได้)
3. **`lib/permissions.ts` → `DEFAULT_PERMISSIONS`**: เพิ่ม path ใน role ที่ควรเห็น
   (ปกติคือ `admin`; `superadmin` derive จาก ALL_PAGES อัตโนมัติ)
4. **`components/LayoutAdmin.tsx` → `navigationItems`**: เพิ่มรายการเมนู
   (label, href, icon, group: `ภาพรวม|จัดการ|รายงาน|ตั้งค่า`)
   — ⚠️ เมนูนี้ **hardcode แยกจาก ALL_PAGES** ลืมแล้วเมนูไม่ขึ้นแม้สิทธิ์ถูก
   (ข้ามได้เฉพาะหน้า hideFromMenu)
5. **Migration สิทธิ์ user เดิม**: user ที่ `allowedPages` ใน Mongo **ไม่ว่าง**
   จะไม่เห็นหน้าใหม่จน superadmin ให้สิทธิ์ หรือรัน script `$addToSet` —
   ดูต้นแบบ `scripts/grant-elderly-school-permission.js`
   (รัน `node --env-file=.env.local scripts/<file>.js --dry-run` ก่อนเสมอ)
6. **API ของหน้า**: ฝั่ง admin ใช้ pattern `pages/api/pm25/_auth.js#requirePm25Admin`
   (getAuth → Mongo lookup → appId → allowedPages → superadmin ลัด)
7. **ทดสอบ**: `npm run build` ผ่าน, เมนูขึ้น, เปิดหน้าได้ทั้ง superadmin และ
   user ที่มี custom allowedPages, หน้า superadmin permission UI แสดงหน้าใหม่
8. **เอกสาร**: อัปเดต `docs/modules/<module>.md` ของโมดูลที่หน้านี้สังกัด

## Common mistakes

| พลาด | ผลที่เกิด |
|---|---|
| ลงทะเบียน ALL_PAGES แต่ลืม navigationItems | สิทธิ์ถูกแต่เมนูไม่ขึ้น |
| เพิ่ม navigationItems แต่ลืม ALL_PAGES | เมนูขึ้นแต่ superadmin กำหนดสิทธิ์หน้านี้ไม่ได้ |
| ลืม migration script | user ที่มี custom allowedPages โดน access-denied ทั้งที่เคยใช้ได้ |
| หน้า hideFromMenu เลยไม่ลงทะเบียนเลย | ให้สิทธิ์ผ่าน UI ไม่ได้ (เคสจริง: elderly-schedule) |
| ตั้งชื่อ path เป็น prefix ของหน้าอื่น | `hasPermission` ใช้ startsWith — สิทธิ์รั่วข้ามหน้า |
