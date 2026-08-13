# โมดูล garbage — ตารางเดินรถเก็บขยะ

ระบบตารางเดินรถเก็บขยะของเทศบาลเมืองตาคลี · ประชาชนค้นหาถนน/ชุมชนของตัวเองเพื่อดูว่ารถมาวันไหนเวลาไหน เจ้าหน้าที่กองสาธารณสุขเปิดดูตารางรายสัปดาห์

## โครงสร้าง

| ชั้น | ไฟล์ |
|---|---|
| หน้าประชาชน | `pages/garbage.tsx` + `components/garbage/{GarbageSearchPanel,TodayTruckPanel,CoverageNote,GarbageHomeCard}.tsx` |
| หน้าแอดมิน | `pages/admin/garbage.jsx` + `components/garbage/admin/{WeekScheduleView,ContactSettingsCard}.jsx` |
| API สาธารณะ | `pages/api/garbage/{schedule,week,search,live}.ts` + `settings.ts` (GET) |
| API ต้องล็อกอิน | `pages/api/garbage/settings.ts` (PUT) ผ่าน `pages/api/garbage/_auth.ts` |
| Logic | `lib/garbage/{time,resolve,live,validators,labels,db}.ts` |
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
- **สาย R5–R7 มี `needsVerification: true`** (ถอดจากโปสเตอร์) หน้าแอดมินแสดงป้าย "รอตรวจสอบ"
- **seed คือ source of truth** รัน `scripts/seed-garbage.mjs` ซ้ำจะทับค่าที่แก้มือใน DB
- โมดูลนี้ใช้ **native mongodb driver** (`lib/garbage/db.ts`) ไม่ใช่ mongoose ยกเว้น `_auth.ts` ที่ยืม pattern ตรวจสิทธิ์ของรีโป

## สิ่งที่ยังไม่ทำ

แก้ตารางจาก UI · แผนที่เส้นทาง (ต้องผูก `RouteStop.roadId` กับ `roads` ก่อน) · export โปสเตอร์ · แจ้งเตือน LINE ก่อนรถถึง
