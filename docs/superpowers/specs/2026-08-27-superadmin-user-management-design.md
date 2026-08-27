# รีดีไซน์หน้าจัดการ User (/admin/superadmin) — Design Spec

- **วันที่:** 2026-08-27
- **สถานะ:** อนุมัติแบบแล้ว รอทำ implementation plan
- **ที่มา:** เคสจริง — บัญชี Clerk `user_34BXrf8OmiiODu8Edj35hMNKNCJ` (กองสาธารณสุขฯ) หาไม่เจอในหน้าจัดการ เพราะมี stub doc ใน Mongo (มีแค่ `clerkId`+`role` ไม่มี `name`/`appId`) ทำให้ไม่โผล่ทั้งกล่อง "พนักงานใหม่" (กรองเฉพาะคนไม่มี doc) และค้นหาไม่เจอ (search match เฉพาะฟิลด์ Mongo)

## ปัญหาที่แก้ (ยืนยันกับ superadmin แล้ว)

1. **ค้นหาไม่เจอ / ข้อมูลไม่ครบ** — รายการหลักโชว์เฉพาะข้อมูล Mongo; doc ที่ไม่มีชื่อ/email ค้นไม่เจอ
2. **โฟลว์เพิ่มพนักงานใหม่สับสน** — แยก 2 กล่อง (Clerk-only vs Mongo) เคสก้ำกึ่งอย่าง stub doc ตกหล่นทั้งสองกล่อง
3. **จัดการสิทธิ์หน้ายาก** — กริดแบน 25 ช่องไม่จัดกลุ่ม ไม่มี preset ครบ และหน้าใหม่ต้องรัน grant script รายคน
4. **ซ่อม doc พัง/ข้ามแอปต้องใช้ script** — ควรทำจากหน้าเว็บได้

## ขอบเขต

- **ทำ:** รื้อหน้า `/admin/superadmin` (path เดิม) ใหม่ทั้งหน้า รอบเดียว + API ใหม่ 3 ตัว
- **ไม่ทำ:** ไม่เปลี่ยนวิธีเก็บ/ตีความสิทธิ์ (`allowedPages`, `DEFAULT_PERMISSIONS`, `pathMatchesPermission`) · ไม่แตะ `verify-app-access` · ไม่แก้ schema `users` (collection แชร์กับแอปพี่น้อง)
- **นโยบายข้ามแอป:** มองเห็น user ทุกแอปในลิสต์เดียว (badge บอกสังกัด) แต่แก้สิทธิ์/กำหนดหน้าได้เฉพาะ user ของแอปปัจจุบัน — ยกเว้นการ "ซ่อม" (เติมชื่อ/ลบ stub) ทำได้ทุกตัว
- **Visual:** ออกแบบโฉมใหม่ได้อิสระ ไม่ต้องยึดธีมม่วง gradient เดิม (ใช้ frontend-design skill ตอน implement)

## สถาปัตยกรรม

### API ใหม่ (ทั้งหมดอยู่ `pages/api/permissions/` · เช็ค superadmin ด้วย `getAuth` + `clerkClient` ตามแบบ `clerk-unregistered.js` · ทุก mutation เขียน `logAuditEvent` จาก `lib/auditLogger.ts`)

#### 1. `GET /api/permissions/users-overview`

- ดึง Clerk users **ทุกคน** (paginate ด้วย offset/limit วนจนครบ `total_count` — org ปัจจุบัน ~92 คน; เลิกพึ่ง `limit: 200` ครั้งเดียว)
- ดึง Mongo `users` ทุก doc (คง filter เดิม: ไม่เอา `isArchived: true`)
- merge ด้วย `clerkId` ฝั่ง server แล้วคำนวณ `status` ต่อคน:

| status | เงื่อนไข |
|---|---|
| `no_doc` | มีบัญชี Clerk แต่ไม่มี Mongo doc |
| `broken` | มี doc แต่ไม่มี `name` (stub — เช่นถูกสร้างข้ามแอปมาไม่สมบูรณ์) |
| `no_app` | doc มี name แต่ `appId` ว่าง |
| `other_app` | `appId` เป็นของแอปอื่น |
| `active` | `appId` = `NEXT_PUBLIC_APP_ID` ปัจจุบัน |
| `orphan` | มี doc แต่ `clerkId` หาใน Clerk ไม่เจอ (บัญชีถูกลบ) |

- response ต่อคน: `clerkId`, `mongoId`, `name` (Mongo → fallback ชื่อ Clerk), `email`, `imageUrl`, `position`, `department`, `appId`, `role` (Mongo) , `clerkRole` (`publicMetadata.role`), `allowedApps`, `allowedPages`, `lastSignInAt`, `status`, `isStub`, `clerkBlocksApp`
- **`clerkBlocksApp`** *(เพิ่มตาม code review 2026-08-27)*: โค้ดจริงของ `verify-app-access` ให้ Clerk `allowedApps` (ถ้าไม่ว่าง) **ตัดสิน app access ขาด** — Mongo `appId` เป็นแค่ fallback ตอน allowedApps ว่าง ดังนั้น user อาจโชว์ `active` แต่ล็อกอินแอปนี้ไม่ได้ · field นี้ = true เมื่อ allowedApps ไม่ว่างและไม่มีแอปปัจจุบัน/`*` (superadmin ยกเว้น) → UI แสดง badge เตือน · ด้านกลับ (`other_app` แต่ allowedApps อนุญาตแอปนี้ = เข้า shell ได้แต่ใช้โมดูลไม่ได้) คงตาม status เดิม — UI ห้ามตีความ `other_app` ว่า "เข้าไม่ได้เลย"
- **logic merge + คำนวณ status เป็น pure function** ใน `lib/superadmin/usersOverview.ts` (รับ array Clerk + array Mongo คืน array ที่ merge แล้ว) — endpoint เป็นแค่เปลือกบาง ๆ

#### 2. `POST /api/permissions/repair-user` — body `{ mongoId, action }`

*(เปลี่ยนจาก `clerkId` เป็น `mongoId` ตาม code review 2026-08-27 — เจาะจง doc เดียวเสมอ กัน clerkId ซ้ำ/injection · เขียนสำเนาลง audit log ด้วย `AuditLog.create` ตรง ๆ "ก่อน" ลบ ไม่ใช่ fire-and-forget · เช็ค `deletedCount` กัน race)*

- `action: "fill_name"` — ดึงชื่อ (fallback email) จาก Clerk มา `$set: { name }` (ตามแบบ `scripts/backfill-user-name-appid.js`) — **เฉพาะ doc ที่ยังไม่มีชื่อเท่านั้น** (มีชื่อแล้ว → 400 กันเผลอทับชื่อไทยที่พิมพ์มือ)
- `action: "delete_stub"` — ลบ doc ได้**เฉพาะเมื่อเป็น stub จริง**: ไม่มี `name`, ไม่มี `appId`, ไม่มี `createdAt`/`updatedAt` และ `allowedPages` ว่าง *(เข้มขึ้นจากร่างแรกตาม code review 2026-08-27 — กัน doc ที่เคยถูกแก้สิทธิ์แล้วหลุดเข้า guard)* — ไม่ผ่าน guard คืน 400 · ก่อนลบเก็บ doc เต็มลง audit log เสมอ (แทน backup file)
- `action: "delete_orphan"` — ลบ doc ของบัญชีที่ถูกลบจาก Clerk ไปแล้ว · guard: server เรียก Clerk ยืนยันเองว่า `clerkId` นั้นไม่มีจริง (404) ก่อนลบ — ไม่เชื่อสถานะที่ client ส่งมา · เก็บ doc เต็มลง audit log ก่อนลบเช่นกัน
- ใช้ได้กับ doc ทุกแอป (การซ่อมไม่จำกัดแอป)

#### 3. `POST /api/permissions/bulk-grant` — body `{ pagePath, userIds, mode: "grant" | "revoke" }`

- validate: `pagePath` ต้องอยู่ใน `ALL_PAGES` · `userIds` ต้องเป็น user ของแอปปัจจุบันเท่านั้น (dedupe + ตรวจเป็น ObjectId จริงก่อนใช้)
- `grant` = `$addToSet` / `revoke` = `$pull` บน `allowedPages` — write filter บังคับซ้ำที่ชั้นเขียน: `appId` ตรง + `allowedPages` ไม่ว่าง + ไม่ archived (กัน race ระหว่างอ่าน-เขียน)
- **กติกาสำคัญ:** แตะเฉพาะ user ที่ `allowedPages` **ไม่ว่าง** — ลิสต์ว่าง = ใช้ `DEFAULT_PERMISSIONS[role]`; การเติม 1 หน้าเข้าลิสต์ว่างจะ override default ทั้งชุดหายเงียบ · user ลิสต์ว่างที่ถูกส่งมาให้ **ข้าม** และรายงานกลับใน response (`skippedDefault: [...]`)
- **กติกาฝั่ง revoke** *(เพิ่มตาม code review 2026-08-27)*: ห้าม revoke จนลิสต์**ว่าง** — ลิสต์ว่างทำให้ user เด้งกลับไปใช้ default ของ role ซึ่งอาจ**ได้สิทธิ์เพิ่ม** (revoke กลายเป็น escalation) · เคสนี้ **ข้าม** และรายงานกลับ (`skippedWouldEmpty: [...]`) — ให้แก้รายคนผ่านตัวแก้สิทธิ์แทน
- แทนที่ grant script ตระกูล `scripts/grant-*` สำหรับงานประจำ (script เดิมเก็บไว้เป็นประวัติ)

### ของเดิมที่คงไว้ / เลิกใช้

- **ใช้ต่อ:** `POST /api/users/create` (เพิ่มเข้าระบบ), `POST /api/users/update-allowed-pages`, `POST /api/users/update-app-id`
- **ลบใน PR เดียวกัน:** `GET /api/permissions/clerk-unregistered` (ถูก users-overview แทนสมบูรณ์ — ผู้เรียกมีที่เดียวคือหน้า superadmin)

## UI (เขียนใหม่ทั้งไฟล์ `pages/admin/superadmin/index.jsx`)

path เดิม อยู่ใน `SUPERADMIN_ONLY_PAGES` แล้ว — ไม่ต้องทำ checklist เพิ่มหน้าใหม่

```
┌─ Header: Super Admin · ปุ่ม [ตั้งค่า LINE] [Audit Log] (คงเดิม)
├─ การ์ดสถิติ 4 ใบ: ทั้งหมด | ใช้งานได้ (แอปนี้) | ⚠ ต้องดำเนินการ | แอปอื่น
├─ แถบเครื่องมือ: [ค้นหา] [chip กรองสถานะ] [ให้สิทธิ์เป็นชุด] [รีเฟรช]
└─ ลิสต์เดียว เรียง: ต้องดำเนินการ → ใช้งานได้ → แอปอื่น
```

- **ค้นหา** match: ชื่อ (ทั้ง Mongo และ Clerk), email, กอง/ตำแหน่ง, clerkId
- **แถวต่อคน:** avatar · ชื่อ · email · badge (สถานะ + แอป + role) · เข้าระบบล่าสุด · ปุ่ม action ตามสถานะ:
  - `no_doc` → [เพิ่มเข้าระบบ]
  - `broken` → [ซ่อม: เติมชื่อจาก Clerk] + [ลบ stub] (confirm + แจ้งว่าเก็บสำเนาใน audit log)
  - `no_app` → [กำหนด App]
  - `active` → กางแถวเป็นตัวแก้สิทธิ์
  - `other_app` → อ่านอย่างเดียว (ซ่อมได้ถ้า broken)
  - `orphan` → badge เตือน + [ลบ] (confirm)
- **ตัวแก้สิทธิ์ (กางแถว):**
  - checkbox จัดกลุ่มตาม `category` ของ `ALL_PAGES` + ติ๊กยกหมวด
  - preset: [ผู้บริหาร] (`getExecutivePagePaths`) · [ค่า default ตาม role] · [เลือกหมด] · [ล้าง]
  - สถานะ "ลิสต์ว่าง = ใช้ค่า default ของ role" แสดงเป็นข้อความชัดเจน ไม่ใช่ตัวเลข 0/25
- **โหมดให้สิทธิ์เป็นชุด:** เลือกหน้า 1 หน้า → รายชื่อ user แอปนี้พร้อม checkbox → บันทึกทีเดียว · คนที่ใช้ default แยกกลุ่ม + disable พร้อมคำอธิบาย

## Error handling

- **Clerk ล่ม/ช้า:** users-overview คืนข้อมูล Mongo ต่อได้พร้อม `clerkUnavailable: true` → UI แสดงแบนเนอร์เตือน และ disable ปุ่มที่ต้องพึ่งข้อมูล Clerk (เพิ่มเข้าระบบ / ซ่อม / ตัดสิน orphan)
- **Guard ฝั่ง server:** ลบ stub ที่ไม่ใช่ stub → 400 · bulk-grant user ลิสต์ว่าง → ข้าม + รายงาน · userIds ต่างแอป → 400
- ทุก mutation เขียน audit log (action, ผู้ทำ, target, รายละเอียด)

## Testing

- vitest: `lib/superadmin/__tests__/usersOverview.test.js` — คำนวณ status ครบทุกกิ่ง (fixture รวม stub doc จริงจากเคสวันนี้), fallback ชื่อ, เรียงลำดับ
- vitest: logic คัดกรอง bulk-grant (ข้ามลิสต์ว่าง, validate pagePath)
- ฝั่ง React/API ไม่มี automated test (ตาม convention repo) — ตรวจมือ: `npm run build` ผ่าน + เปิด dev ไล่ครบทุกสถานะกับ DB จริง
- ทำบน branch แยก → PR เข้า `main` (merge = ขึ้น production ทันที)

## หมายเหตุประกอบ

- เคสตั้งต้น (stub ของกองสาธารณสุขฯ) มี one-off script `scripts/oneoff-drop-stub-user-health-takhlicity.js` ไว้ลบด้วยมือแล้ว — หน้าใหม่จะทำเคสแบบนี้ได้เองผ่านปุ่ม [ลบ stub] · script one-off ไม่ commit
- `.env.local` เครื่อง dev ตั้ง `NEXT_PUBLIC_APP_ID=app_b` — ตอนทดสอบ dev สถานะ `active`/`other_app` จะกลับด้านกับ production (`smart-takhli`)
