# Superadmin / ระบบสิทธิ์

สิทธิ์สองชั้น: (1) App access ข้ามดีพลอย (`NEXT_PUBLIC_APP_ID` +
Clerk `allowedApps` / Mongo `users.appId`) → (2) Page access รายหน้า
(`lib/permissions.ts` + `users.allowedPages`)

## หน้า

- `/admin/superadmin` — จัดการ user/สิทธิ์รายหน้า (superadmin เท่านั้น)
- `/admin/superadmin/setup` — ตั้ง superadmin ครั้งแรก (`SUPERADMIN_SECRET`)
- `/admin/superadmin/audit-log`
- `/admin/register-user` — ลงทะเบียน/แก้ไขผู้ใช้

## จุดตรวจหลัก

- `pages/api/auth/verify-app-access.js` — ตรวจ app access; `pages/_app.tsx`
  เรียกทุกครั้งที่เปลี่ยน route ใน `/admin/*`, `/user/*`
- `lib/permissions.ts` — `ALL_PAGES` registry, `DEFAULT_PERMISSIONS[role]`,
  `SUPERADMIN_ONLY_PAGES`, `hasPermission()`
- `components/PermissionGuard.tsx` — guard ฝั่ง client
  (`requiredPath` หรือ default = `router.pathname`)
- `components/LayoutAdmin.tsx` — เมนู sidebar **hardcode `navigationItems`
  แยกจาก ALL_PAGES** — เพิ่มหน้าต้องแก้สองที่เสมอ

## API

`pages/api/permissions/*`, `pages/api/users/*`

## กฎสำคัญ

1. user ที่ `allowedPages` **ไม่ว่าง** = override DEFAULT_PERMISSIONS ทั้งชุด —
   เพิ่มหน้าใหม่แล้ว user กลุ่มนี้จะมองไม่เห็นจนกว่าจะได้รับสิทธิ์
   (ดูตัวอย่าง migration: `scripts/grant-elderly-school-permission.js`)
2. superadmin ข้ามทุกการตรวจ
3. ⚠️ User schema ถูก redefine inline หลายไฟล์ (`verify-app-access.js`,
   `pm25CronAuth.js`, …) — เพิ่มฟิลด์ใน `models/CreateUser.js` ต้องไล่แก้ inline
   schema ทุกที่ ไม่งั้นฟิลด์หายเงียบ (roadmap เฟส 6 จะรวมเป็นที่เดียว)

เอกสารเดิม: `PERMISSION_SYSTEM.md` ที่ root
