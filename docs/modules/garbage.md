# โมดูล garbage — ตารางเดินรถเก็บขยะ

ระบบตารางเดินรถเก็บขยะของเทศบาลเมืองตาคลี · ประชาชนค้นหาถนน/ชุมชนของตัวเองเพื่อดูว่ารถมาวันไหนเวลาไหน เจ้าหน้าที่กองสาธารณสุขเปิดดูและ**แก้ตารางเองได้จากหน้าแอดมิน** (ตั้งแต่ M6)

## โครงสร้าง

| ชั้น | ไฟล์ |
|---|---|
| หน้าประชาชน | `pages/garbage.tsx` + `components/garbage/{GarbageSearchPanel,TodayTruckPanel,CoverageNote,GarbageHomeCard}.tsx` |
| หน้าแอดมิน | `pages/admin/garbage.jsx` + `components/garbage/admin/{WeekScheduleView,ContactSettingsCard,AssignmentFormModal,StopTimesEditor,RouteManagerModal}.jsx` |
| API สาธารณะ | `pages/api/garbage/{schedule,week,search,live}.ts` + `settings.ts` (GET) |
| API ต้องล็อกอิน | `settings.ts` (PUT) · `assignments/index.ts` (POST) · `assignments/[id].ts` (PUT/DELETE) · `routes/index.ts` (GET) · `routes/[code].ts` (PUT) — ทุกเส้นผ่าน `pages/api/garbage/_auth.ts` |
| Logic | `lib/garbage/{time,resolve,live,validators,labels,db,constants,overlap,stopEditing}.ts` |
| Types | `types/garbage.ts` |
| ข้อมูลตั้งต้น | `data/garbage/schedule-2569.json` + `scripts/import-garbage-schedule.mjs` (ดูหัวข้อ "ข้อมูลตั้งต้น") |
| ถนน (GIS) | `public/road_takhli.geojson` + `scripts/import-roads.mjs` → collection `roads` |

## Collections

`garbage_trucks` (8 — รถ 1–7 และรถ 13) · `garbage_routes` (8 — R1–R7 และ R13) · `garbage_communities` (21) · `garbage_assignments` (56 — ครบ 7 วัน หนึ่งรถหนึ่งวันหนึ่งงาน) · `garbage_settings` (singleton `key: "default"`) · `roads` (532 เส้น ใช้ร่วมกับโมดูลอื่นในอนาคต)

**ต้องใส่ prefix `garbage_`** เพราะชื่อเปล่า `assignments` และ `communities` เป็นของโมดูลร้องเรียนอยู่แล้ว และฐานข้อมูลแชร์ข้ามแอปพี่น้อง

## เรื่องที่ต้องรู้ก่อนแก้

- **API คืน `{ error }`** ไม่ใช่ `{ success, message }` แบบโมดูลอื่น
- **ห้ามฟอร์แมตเวลาเอง** ใช้ `formatThaiTime` / `formatRange` จาก `lib/garbage/time.ts` (prototype เดิมมีบั๊กเที่ยงวันกลายเป็นเที่ยงคืน)
- **`effectiveTo` เป็นวันสุดท้ายที่ยังใช้ (inclusive)** เก็บที่เที่ยงคืนเวลาไทย — ฝั่งเขียนในอนาคตห้ามใช้แบบ exclusive
- **ข้อมูลครบ 7 วันแล้ว** (นำเข้าจากตารางฉบับจริง 2026-08-13) — เวลาของ**รถ 13 ยังว่างทั้งหมด** รอกองสาธารณสุขกรอกผ่าน `/admin/garbage` จึงขึ้นว่า "ยังไม่ระบุเวลา" · `communityNames` / `communityWindows` ว่างทั้งหมดเพราะตารางจริงไม่มีคอลัมน์ชุมชน — ค้นด้วยชื่อชุมชนจึงยังไม่เจอ ต้องขอ mapping จุด→ชุมชนเพิ่ม
- **`seq` คือเลขแถวในรายชื่อสถานที่ ไม่ใช่ลำดับที่รถวิ่ง** — รถวิ่งคนละเส้นทางในแต่ละวัน จุดที่ 11 จึงถูกเก็บก่อนจุดที่ 7 ได้ (มีจริงในตารางกองสาธารณสุข) ลำดับการวิ่งกำหนดด้วย `atMin` เท่านั้น (`lib/garbage/live.ts` เรียงด้วย `atMin`) · M7 ถอดกฎ "เวลาต้องไม่ย้อนกลับตาม seq" ออกจาก `assignmentSchema` เพราะตั้งไว้ผิดตั้งแต่แรก **อย่าเพิ่มกลับ**
- **หนึ่งรถ หนึ่งวัน = หนึ่งงาน** รถออกทริปเดียวแล้วเก็บจุดของสายตัวเอง *สลับกับ* จุดของสายที่ไปเก็บแทน จึงเก็บเป็นงานเดียวที่มี `coverForRouteCode` พ่วงไว้ ไม่แยกสองงาน (แยกแล้วช่วง min–max ของสองกลุ่มจะคาบเกี่ยวกันเองแล้วไปชนกฎห้ามเวลาทับ) · `kind` เป็น `substitute` เฉพาะวันที่ไม่มีจุดของตัวเองเลย
- **สาย R5–R7 มี `needsVerification: true`** (ถอดจากโปสเตอร์) หน้าแอดมินแสดงป้าย "รอตรวจสอบ" — ปลดป้ายได้ที่ "จัดการสายและจุดเก็บ"
- **UI คือ source of truth ตั้งแต่ M6** ไม่ใช่ seed (ดูหัวข้อ "การแก้ข้อมูล" ข้างล่าง)
- โมดูลนี้ใช้ **native mongodb driver** (`lib/garbage/db.ts`) ไม่ใช่ mongoose ยกเว้น `_auth.ts` ที่ยืม pattern ตรวจสิทธิ์ของรีโป

## การแก้ข้อมูล (ตั้งแต่ M6)

**UI คือแหล่งความจริง** — แก้ตารางที่ `/admin/garbage` ไม่ใช่แก้ JSON

- `data/garbage/schedule-seed.json` + `scripts/seed-garbage.mjs` เป็น **bootstrap ตอน DB ว่างเท่านั้น** และเป็น insert-only (รันซ้ำไม่ทับค่าที่แก้จาก UI) ไฟล์ JSON จะ drift จาก DB เป็นเรื่องปกติ
- งานมอบหมายทุกตัวใช้ `effectiveFrom` = `BASELINE_EFFECTIVE_FROM` (`lib/garbage/constants.ts`) และ `effectiveTo = null` เพราะรอบนี้ไม่ทำ versioning — แก้แล้วทับเลย ร่องรอยอยู่ใน audit log
- คีย์ธรรมชาติ `(weekday, truckNumber, shiftNo)` เป็น unique index ชื่อ `natural_key` — เพิ่มซ้ำได้ 409
- กฎข้ามเอกสารที่บังคับฝั่งเซิร์ฟเวอร์: รถคันเดียวกันในวันเดียวกันเวลาห้ามทับ (`lib/garbage/overlap.ts`) และ `stopTimes[].seq` ต้องมีอยู่จริงในสาย
- **การแก้รายการจุดเก็บ**: เขียน `stopTimes` ของงานก่อน แล้วจึงเขียน `route.stops` — ถ้าขั้นสองล้ม งานจะอ้าง seq ที่ยังไม่มี → แสดง "—" (ไม่มีเวลา) ซึ่งปลอดภัยกว่าแสดงเวลาผิด **ห้ามสลับลำดับการเขียน**
- **optimistic lock มีทั้งสองฝั่ง — ทั้ง `PUT /routes/[code]` และ `PUT /assignments/[id]` ต้องส่ง `updatedAt` ที่โหลดมากลับไปด้วย** (สายได้จาก `GET /api/garbage/routes`, งานได้จาก `ResolvedAssignment.updatedAt` ที่มากับ `/week`) ไม่ตรง = **409** ให้ปิดฟอร์มแล้วเปิดใหม่ · **POST ไม่ต้องส่ง** เพราะยังไม่มีเอกสารให้ชน (จึงมี `assignmentUpdateSchema` แยกจาก `assignmentInputSchema`)
  - เคสที่ lock นี้กันอยู่ และด่านอื่นจับไม่ได้เลย: อีกคน**สลับลำดับจุดล้วน**สำเร็จระหว่างที่ฟอร์มค้างอยู่ — เซตของ `seq` ไม่เปลี่ยน การตรวจว่า seq มีอยู่จริงในสายจึงผ่านหมด แล้วเวลาไปติดผิดจุดทุกจุดแบบไม่มีร่องรอย
  - `assignmentUpdateSchema` ประกอบด้วย transform + pipe (แยกคีย์ `updatedAt` ออกก่อนแล้วส่งที่เหลือให้ `assignmentSchema`) — **ห้ามเปลี่ยนเป็น `.and()`** เพราะ intersection จะทำให้ฝั่ง `.strict()` ตีว่า `updatedAt` เป็นคีย์แปลกปลอมแล้ว 400 ทุกครั้ง
- `PUT /api/garbage/routes/[code]` ยังตอบ `warnings[]` อยู่ แต่ตั้งแต่ M7 **เป็นอาเรย์ว่างเสมอ** — คำเตือน "เวลาเรียงย้อนหลังการสลับจุด" ถูกถอดออกพร้อมกับกฎที่มันอ้างถึง (ถ้าคงไว้จะเตือนแทบทุกครั้งกับตารางจริงจนหมดความหมาย) · คงคีย์ไว้เพราะ `RouteManagerModal` อ่านค่านี้อยู่ และเผื่อคำเตือนอื่นในอนาคต
- audit log ต้องลงทะเบียน **4 จุด** (`lib/auditLogger.ts` union, `models/AuditLog.js` enum ทั้ง action และ resourceType, `ACTION_LABELS` และ `ACTION_COLORS` ใน `pages/admin/superadmin/audit-log.tsx`) — ลืม enum แล้วเขียน log ไม่ลงแบบเงียบ เพราะ `logAuditEvent` กลืน error
- lock จับได้แค่ "ข้อมูลเปลี่ยนไปแล้ว" ไม่ได้ merge ให้ — สองคนแก้คนละฟิลด์ของงานเดียวกัน คนที่บันทึกทีหลังต้องเปิดฟอร์มใหม่แล้วพิมพ์ซ้ำ (ยอมรับได้ที่ขนาดทีมนี้)
- `/api/garbage/{schedule,week,search}` ตั้ง `s-maxage=300` — หลังแก้ตาราง หน้าประชาชนอาจเห็นของเก่าได้ถึง 5 นาที **ถ้าวันไหนเอา CDN มาวางหน้า Railway ต้องเพิ่มการ purge หรือลด s-maxage**
- ทะเบียนรถ (`garbage_trucks` — รวม `plate` / `driverName` / `truckType`) ยังแก้ผ่านสคริปต์นำเข้าเท่านั้น ยังไม่มี UI — dropdown เบอร์รถในฟอร์มดึงจากเบอร์ที่มีในตารางสัปดาห์นั้น

## สถานะของจุดเก็บในแต่ละวัน (ตั้งแต่ M7)

`stopTimes` คือ **รายการจุดที่เก็บในวันนั้น** โดยเวลาเป็นค่าว่างได้:

| สถานะ | ข้อมูล | หน้าประชาชนเห็น |
|---|---|---|
| เก็บ รู้เวลา | อยู่ใน `stopTimes` + `atMin` มีค่า | เวลา เช่น "4.00 น." |
| เก็บ ยังไม่ระบุเวลา | อยู่ใน `stopTimes` + `atMin` เป็น null | "ยังไม่ระบุเวลา" |
| วันนี้ไม่เก็บ | ไม่อยู่ใน `stopTimes` | "ไม่เก็บวันนี้" (จาง) |

`ResolvedAssignment.stops[]` จึงมีทั้ง `served` และ `atMin` — **อย่าใช้ `atMin == null` ตัดสินว่าเก็บหรือไม่เก็บ**
(บั๊กเดิมของ `AssignmentFormModal`: กรองด้วย `atMin != null` ตอนเปิดฟอร์ม ทำให้จุดที่เก็บแต่ยังไม่ระบุเวลาหายเงียบ ๆ)

หน้าประชาชนใช้ `lib/garbage/nextPickup.ts#findNextPickup` บอก "รอบเก็บถัดไป" ของจุดที่ค้นเจอ
และขึ้นป้ายเตือนเมื่อรถหยุด **ตั้งแต่ 3 คันขึ้นไป** (นับเป็นคัน ไม่ใช่รอบ — รถคันเดียววิ่งได้หลายรอบต่อวัน)
เกณฑ์ 3 มาจากรูปแบบจริง: อังคารรถ 1–4 หยุด · ศุกร์รถ 5–7 หยุด

## ข้อมูลตั้งต้น

- `data/garbage/schedule-2569.json` — ตารางฉบับจริงจากกองสาธารณสุข (8 คัน 7 วัน) นำเข้าด้วย `scripts/import-garbage-schedule.mjs` → **สาย 8 · งาน 56 · รถ 8** (งาน = 7 คัน × 7 วัน + รถ 13 อีก 7 วัน · หนึ่งรถหนึ่งวันหนึ่งงานเสมอ)
  - สคริปต์เป็น **re-baseline** (ลบ `garbage_assignments` ทิ้งแล้วเขียนใหม่) ต้องสั่ง `--yes` ชัดเจน
  - `--json` พ่นเอกสารที่จะเขียน (ไม่รวม trucks เพราะมี `driverName`) เอาไปตรวจกับ `assignmentSchema` + `findOverlap` ก่อนเขียนจริงได้
  - **guard ก่อนเขียน:** ยกเลิกจนกว่าจะใส่ `--force` เมื่อเจอ**ร่องรอยการแก้จากหน้าแอดมินจริง** สองทาง — (1) มี audit log ที่ `action` ขึ้นต้นด้วย `garbage_assignment_` มากกว่า 0 รายการ (2) `updatedAt` ใน `garbage_assignments` มีมากกว่า 1 ชุด (แก้ทีละงานทำให้เวลาต่างกัน) · ข้อความตอนบล็อกบอกตัวเลขทั้งสองทางเพื่อให้ตัดสินใจได้เอง
    - เกณฑ์เดิมคือ "`updatedAt` ห่างจาก `createdAt` เกิน 1 วินาที" ซึ่ง **หลอกได้** — การเขียน bulk ครั้งเดียวก็ทำให้ช่องว่างนั้นเกิด เคยบล็อกชุด seed ทั้ง 17 รายการมาแล้วทั้งที่ไม่มีใครแตะจากหน้าจอเลย **อย่าเอากลับมา**
- `data/garbage/trucks.local.json` — ทะเบียนรถ/ชื่อคนขับ **gitignore ไว้เพราะ repo นี้ public** · ไม่มีไฟล์นี้สคริปต์ยังรันได้ แค่ข้ามข้อมูลส่วนนั้น
- `data/garbage/schedule-seed.json` + `scripts/seed-garbage.mjs` — ชุดเก่าจาก M1 (จันทร์+อังคาร) เก็บไว้เป็นประวัติ **อย่ารันทับข้อมูลจริง**
- **`driverName` ห้ามส่งออก API สาธารณะ** — แสดงได้เฉพาะหน้าแอดมิน · ตอนนี้ไม่มี API เส้นไหน serialize เอกสาร `Truck` ทั้งก้อนเลย (`lib/garbage/resolve.ts` เป็นผู้อ่าน `garbage_trucks` รายเดียว และหยิบไปแค่ `color`) — ถ้าจะเพิ่มเส้นที่ส่ง `Truck` ออก ต้องเลือกฟิลด์เองทีละตัว

## สิ่งที่ยังไม่ทำ

แผนที่เส้นทาง (ต้องผูก `RouteStop.roadId` กับ `roads` ก่อน) · export โปสเตอร์ · แจ้งเตือน LINE ก่อนรถถึง · จัดการทะเบียนรถ/ชุมชนจาก UI
