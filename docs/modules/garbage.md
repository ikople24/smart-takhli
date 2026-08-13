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
| ข้อมูลตั้งต้น | `data/garbage/schedule-seed.json` + `scripts/seed-garbage.mjs` |
| ถนน (GIS) | `public/road_takhli.geojson` + `scripts/import-roads.mjs` → collection `roads` |

## Collections

`garbage_trucks` (7) · `garbage_routes` (7) · `garbage_communities` (21) · `garbage_assignments` (17 — เฉพาะวันจันทร์กับอังคาร) · `garbage_settings` (singleton `key: "default"`) · `roads` (532 เส้น ใช้ร่วมกับโมดูลอื่นในอนาคต)

**ต้องใส่ prefix `garbage_`** เพราะชื่อเปล่า `assignments` และ `communities` เป็นของโมดูลร้องเรียนอยู่แล้ว และฐานข้อมูลแชร์ข้ามแอปพี่น้อง

## เรื่องที่ต้องรู้ก่อนแก้

- **API คืน `{ error }`** ไม่ใช่ `{ success, message }` แบบโมดูลอื่น
- **ห้ามฟอร์แมตเวลาเอง** ใช้ `formatThaiTime` / `formatRange` จาก `lib/garbage/time.ts` (prototype เดิมมีบั๊กเที่ยงวันกลายเป็นเที่ยงคืน)
- **`effectiveTo` เป็นวันสุดท้ายที่ยังใช้ (inclusive)** เก็บที่เที่ยงคืนเวลาไทย — ฝั่งเขียนในอนาคตห้ามใช้แบบ exclusive
- **ข้อมูลมีแค่จันทร์กับอังคาร** พุธ–อาทิตย์รอกองสาธารณสุข ทั้งสองหน้าต้องบอกตรง ๆ ว่ารอข้อมูล
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
- `PUT /api/garbage/routes/[code]` ตอบกลับมี `warnings[]` ของงานที่เวลาเรียงย้อนหลังการสลับจุด หน้าแอดมินต้องแสดงแบบไม่หายเอง — งานเหล่านั้นจะบันทึกไม่ผ่านจนกว่าเจ้าหน้าที่จะไล่เวลาใหม่ (กฎ "เวลาใน stopTimes ต้องไม่ย้อนกลับ" ของ `assignmentSchema`)
- audit log ต้องลงทะเบียน **4 จุด** (`lib/auditLogger.ts` union, `models/AuditLog.js` enum ทั้ง action และ resourceType, `ACTION_LABELS` และ `ACTION_COLORS` ใน `pages/admin/superadmin/audit-log.tsx`) — ลืม enum แล้วเขียน log ไม่ลงแบบเงียบ เพราะ `logAuditEvent` กลืน error
- lock จับได้แค่ "ข้อมูลเปลี่ยนไปแล้ว" ไม่ได้ merge ให้ — สองคนแก้คนละฟิลด์ของงานเดียวกัน คนที่บันทึกทีหลังต้องเปิดฟอร์มใหม่แล้วพิมพ์ซ้ำ (ยอมรับได้ที่ขนาดทีมนี้)
- `/api/garbage/{schedule,week,search}` ตั้ง `s-maxage=300` — หลังแก้ตาราง หน้าประชาชนอาจเห็นของเก่าได้ถึง 5 นาที **ถ้าวันไหนเอา CDN มาวางหน้า Railway ต้องเพิ่มการ purge หรือลด s-maxage**
- ทะเบียนรถ (`garbage_trucks`) ยังแก้ผ่าน seed เท่านั้น — dropdown เบอร์รถในฟอร์มดึงจากเบอร์ที่มีในตารางสัปดาห์นั้น

## สิ่งที่ยังไม่ทำ

แผนที่เส้นทาง (ต้องผูก `RouteStop.roadId` กับ `roads` ก่อน) · export โปสเตอร์ · แจ้งเตือน LINE ก่อนรถถึง · จัดการทะเบียนรถ/ชุมชนจาก UI
