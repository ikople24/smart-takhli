# พระสังข์หอบทอง — รับฝากขยะรีไซเคิล

โครงการรับฝากขยะรีไซเคิลจากสมาชิก บันทึกเป็น **น้ำหนัก (กก.) ตามประเภท** อย่างเดียว
(ไม่คิดเงิน/แต้ม) โดยเจ้าหน้าที่จุดรับล็อกอินด้วย Clerk แล้วสแกน QR บนบัตรสมาชิก
ด้วยกล้องมือถือ → เปิดหน้ากรอกน้ำหนักของสมาชิกคนนั้นทันที
(ต้นแบบ flow จากโรงเรียนผู้สูงอายุ `elderly-cards` → `elderly/checkin`)

## หน้า

| path | หน้าที่ |
|---|---|
| `/admin/recycle` | หน้าหลัก แท็บ `?tab=deposit\|members\|cards\|summary` (รับฝาก / สมาชิก / บัตร QR / สรุป) |
| `/admin/recycle/deposit?code=PS-0001` | กรอกน้ำหนักการฝาก (เปิดจาก QR) — รองรับ `?memberId=` ด้วย |
| `/admin/recycle/members/new` | เพิ่มสมาชิก (ออกรหัส PS-xxxx อัตโนมัติ) |
| `/admin/recycle/members/[id]` | แก้ไขสมาชิก / ปิดการใช้งาน / ดูประวัติการฝาก |

> ⚠️ **`/admin/recycle/deposit?code=` ถูกฝังใน QR ที่พิมพ์แจก — ห้ามเปลี่ยน path/ชื่อ query**
> (ถ้าจำเป็นต้องย้าย ให้ทำ shim ค้างไว้)

สิทธิ์: ลงทะเบียน `ALL_PAGES` แค่ `/admin/recycle` ตัวเดียว — หน้าลูกทั้งหมด match แบบ
prefix (`pathMatchesPermission`) และใช้ `<PermissionGuard requiredPath="/admin/recycle">`
ไม่ได้อยู่ใน `DEFAULT_PERMISSIONS` — superadmin ต้องติ๊กสิทธิ์ให้เจ้าหน้าที่รายคน
(หน้าใหม่ ไม่มี user เดิมใช้งาน จึงไม่ต้องมี migration script)

## API (`pages/api/recycle/`) — ทุกตัวผ่าน `_auth.js#requireRecycleStaff` (Clerk)

| method | path | หมายเหตุ |
|---|---|---|
| GET | `/members?q=&community=&active=&code=` | `code` = ค้นตรงรหัส (ใช้ตอนสแกน) |
| POST | `/members` | กันเบอร์โทรซ้ำของสมาชิกที่ยังใช้งาน (409 + member เดิม) |
| GET/PUT/DELETE | `/members/:id` | DELETE = ปิดการใช้งาน (soft) |
| GET | `/deposits?date=` หรือ `?from=&to=` `&memberId=` | ไม่รวมรายการที่ยกเลิก |
| POST | `/deposits` | `{ memberId, items: {type: kg} \| [{type, kg}], note?, depositDate? }` |
| GET/PUT/DELETE | `/deposits/:id` | PUT แก้น้ำหนัก (ยอดสะสมปรับตามส่วนต่าง), DELETE = void ต้องมี `reason` |
| GET | `/summary?from=&to=` | รวมตามประเภท / ชุมชน / รายวัน |

`_auth.js` ต่างจาก pm25: เช็คสิทธิ์ด้วย `hasPermission()` — allowedPages ว่าง = ชุดพื้นฐาน
(ไม่ใช่เปิดทุกหน้า) ตรงกับ `_app.tsx`

## Models (`models/recycle/`)

- `RecycleMember` → `recycle_members` — `code` (unique), ชื่อ, เบอร์, ชุมชน, กลุ่ม,
  ยอดสะสม `totalKg` / `depositCount` / `lastDepositAt` (อัปเดตด้วย `$inc` ตอนฝาก/แก้/ยกเลิก)
- `RecycleDeposit` → `recycle_deposits` — snapshot ชื่อ/รหัส/ชุมชน, `depositDate`
  (YYYY-MM-DD เวลาไทย), `items[{type, kg}]`, `totalKg`, `recordedBy`, `voided*`
- รหัสสมาชิก: collection `counters` `_id: "recycle_member_code"` (`lib/recycle/memberCode.js`)

## Lib (`lib/recycle/`)

- `wasteTypes.js` — ประเภทขยะ 7 ชนิด / 4 หมวด (**ห้ามเปลี่ยน `id` ที่ใช้แล้ว** — เลิกรับให้ตั้ง `active: false`)
- `validate.js` — `normalizeDepositItems`, `normalizeMemberInput` (pure, ใช้ทั้ง API และหน้าเว็บ)
- `dates.js` — วันที่เวลาไทย, `client.js` — `recycleFetch`, `makeDepositUrl`

## Components (`components/recycle/`)

`DepositTodayPanel`, `MembersPanel`, `MemberCardsPanel`, `SummaryPanel`, `MemberForm`

## ยังไม่ได้ทำ / ไอเดียต่อ

- สแกน QR ในแอป (ตอนนี้ใช้กล้องมือถือเปิดลิงก์)
- ส่งออก Excel รายงานสรุป
- ประเภทขยะแก้ไขได้จากหน้าเว็บ (ตอนนี้เป็นค่าคงที่ในโค้ด)
