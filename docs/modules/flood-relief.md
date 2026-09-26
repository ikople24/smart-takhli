# โมดูล flood-relief — ศูนย์ช่วยเหลือผู้ประสบภัยน้ำท่วม

ประชาชนขอความช่วยเหลือจากมือถือใน 3 ขั้น (เรื่อง → พิกัด GPS → เบอร์โทร) แล้วติดตามสถานะได้โดยไม่ต้องล็อกอิน · เจ้าหน้าที่รับเรื่องบนแดชบอร์ด (รายการ + แผนที่ + มอบหมายทีม) · ดีไซน์ต้นฉบับ `docs/design_handoff_flood_relief/README.md`

สถานะ (2026-09-26): ขั้น 1–5 เสร็จ (ขั้น 5 = โซนสีแบบ**เติมสีทั้งชุมชน** แทนการวาดตามดีไซน์เดิม) · ขั้น 6 (ทีม/ศูนย์พักพิง/ส่งออก Excel/ประกาศเตือนภัย) ยังไม่ทำ

## โครงสร้าง

| ชั้น | ไฟล์ |
|---|---|
| หน้าประชาชน | `pages/flood/index.tsx` (**ติดตามสถานการณ์สาธารณะ** — ลิงก์ให้หน่วยงานอื่น/ผู้สนใจ) · `pages/flood/request.tsx` (ฟอร์ม) · `pages/flood/status/index.tsx` (คำขอของเครื่องนี้) · `pages/flood/status/[ticket].tsx` · บล็อก `FloodReliefCard` บนหน้าแรก `pages/index.tsx` |
| components ประชาชน | `components/flood-relief/{FloodReliefCard,RequestForm,LocationPicker,MiniMap,StatusTimeline,FloodHeader,icons,types,useFloodSummary}.tsx` |
| หน้าแอดมิน | `pages/admin/flood-relief.tsx` (แดชบอร์ด, fullBleed) + `components/flood-relief/admin/*` + `stores/useFloodReliefStore.ts` |
| หน้า superadmin | `pages/admin/superadmin/flood-relief.tsx` — เปิด/ปิดศูนย์ฯ · เบอร์ · SLA โทรกลับ · ประกาศ · ระดับสถานการณ์ |
| API สาธารณะ | `pages/api/flood-relief/public/{summary,reverse-geocode,situation}.ts` · `public/requests/index.ts` (POST) · `public/requests/[ticket].ts` (GET) |
| API แอดมิน | `requests/index.ts` (list + KPI) · `requests/[id].ts` (GET/PATCH) · `teams/index.ts` (GET) · `communities.ts` · `settings.ts` (superadmin) — ผ่าน `pages/api/flood-relief/_auth.ts` |
| Logic (มีเทส vitest) | `lib/flood-relief/{status,zones,ticket,geo,derive,phone,validate,settings,rateLimit,notifyText,accessKey,localTickets,time,statusChange,kpi,adminView,zoneAssign}.ts` |
| Server-only | `lib/flood-relief/{locate,nextTicket,notify,loadSettings}.ts` |
| Models | `models/flood-relief/{FloodRequest,FloodZone,FloodTeam,FloodShelter,FloodSettings}.js` |
| สิทธิ์ | `/admin/flood-relief` ใน `ALL_PAGES` + `DEFAULT_PERMISSIONS.admin` + เมนูกลุ่ม "จัดการ" · `scripts/grant-flood-relief-permission.js` สำหรับ user ที่มี allowedPages แบบ custom |

## Collections

`flood_requests` · `flood_zones` · `flood_gauges` (จุดวัดระดับน้ำ) · `flood_teams` · `flood_shelters` · `flood_settings` (singleton `key: "default"`) · `flood_counters` (`_id: "flood-ticket"`) — prefix `flood_` จำเป็นเพราะฐานข้อมูลแชร์ข้ามแอปพี่น้อง

`geojsonfeatures` (22 polygon ชุมชน) เป็นของแอปพี่น้อง — **อ่านอย่างเดียวผ่าน native driver** (`lib/flood-relief/locate.ts`, `communities.ts`) ห้ามใช้ `models/GeoJSONFeature` เพราะ autoIndex อาจสร้าง index ลง collection ของแอปอื่น

## เรื่องที่ต้องรู้ก่อนแก้

- **ศูนย์ฯ ปิด (ค่าเริ่มต้น)** = บล็อกหน้าแรกซ่อน + `POST public/requests` ตอบ 403 ให้โทรแทน · เปิดที่ `/admin/superadmin/flood-relief`
- **เลขที่ `FL-0001` วิ่งต่อเนื่อง ไม่รีเซ็ตรายปี** (ticket unique) → เดาได้ จึงมี **กุญแจสุ่มต่อคำขอ** (`accessKey`, select:false) · หน้าสถานะที่ไม่มีกุญแจเห็นแค่ความคืบหน้า ไม่เห็นจุดสังเกต/ชุมชน/จำนวนคน · กุญแจอยู่ใน localStorage `flood:tickets` และลิงก์ "แชร์ให้ญาติ"
- **หน้า `/flood` + `GET public/situation` จงใจไม่มี auth** (เจ้าของขอ 2026-09-26 ให้หน่วยงานอื่น/ผู้สนใจติดตามได้) — แสดงระดับ + โซนสีรายชุมชน + **ตัวเลขรวมเท่านั้น** (`lib/flood-relief/publicStats.ts`) ห้ามเพิ่มหมุด/รายคำขอ/พิกัด/จุดสังเกต เพราะเท่ากับเปิดเผยบ้านผู้ป่วยติดเตียง · **ห้ามเปลี่ยน path `/flood`** หลังแชร์ออกไป
- **endpoint สาธารณะจงใจไม่มี auth** (ผู้ประสบภัยต้องส่งได้ทันที) · กันสแปมด้วย rate-limit 5 คำขอ/ชม. ต่อ IP และต่อเบอร์ (นับจาก `flood_requests` ตรง ๆ) · ไม่มี captcha
- **ชุมชนหาจากพิกัดด้วย `$geoIntersects` เท่านั้น** ห้ามเดาจากชื่อซอย · โซนซ้อนกันเอาระดับสูงสุด (`pickZone`)
- **สถานะเขียนผ่าน `PATCH requests/[id]` ที่เดียว** — เดินหน้าทีละขั้น · ย้อน/เปิดคำขอที่ยกเลิก = หัวหน้ากอง (`users.isDepartmentHead`) หรือ superadmin + เหตุผล · ถอยแล้วล้างเวลาของขั้นที่ถอยผ่าน (`planStatusChange`)
- **derived fields (`waitingMinutes`, `isOverdue`, `zoneLabel`, KPI, ระยะทีม) คำนวณฝั่ง server** client ห้ามคิดซ้ำ
- **แจ้ง LINE อยู่ที่ `lib/flood-relief/notify.ts` ที่เดียว**: คำขอใหม่ = การ์ด Flex เข้ากลุ่มเจ้าหน้าที่เดิม (`getAdminGroupId`) มีปุ่มโทรหาผู้แจ้ง (เบอร์อยู่ในปุ่มเท่านั้น ไม่อยู่ใน altText) · มอบหมาย = การ์ดเข้า `FloodTeam.lineGroupId` · ผู้แจ้งที่เชื่อม LINE ได้ข้อความตอน ออกเดินทาง/ถึงจุด/เสร็จสิ้น (ยังไม่มีทางเชื่อม — webhook ยังไม่รู้จักเลข `FL-`) · โควตา LINE OA นับผู้รับ × ครั้ง
- ลิงก์ "เปิดในแดชบอร์ด" ในการ์ดต้องตั้ง env `NEXT_PUBLIC_SITE_URL` (https) — ไม่เชื่อ Host header
- **โซนสี = เติมสีทั้งชุมชน** (เจ้าของสั่ง 2026-09-26 แทนการวาด/วงเอง — ถอด Geoman ออกแล้ว): superadmin เลือกสี → คลิกกรอบชุมชน → `POST /api/flood-relief/zones { communityName, level }` รูปคัดลอกจาก `geojsonfeatures` · ชุมชนเดียวมีได้โซนเดียว (`FloodZone.communityName`) คลิกซ้ำ = เปลี่ยนระดับ · "ล้างสี" = ลบโซนนั้น · **แก้/ลบโซนได้เฉพาะ superadmin** admin อื่นเห็นอย่างเดียว · ทุกการเปลี่ยนจัดโซนคำขอที่ยังเปิดใหม่ (`lib/flood-relief/reassignZones.ts`) + audit `flood_zone_changed` · โซนที่วาดเองก่อนเปลี่ยนวิธี (`communityName: null`) ยังแสดง/จัดการได้จาก "จัดการโซนทั้งหมด"
- **จุดวัดระดับน้ำ** (`models/flood-relief/FloodGauge.js`, API `pages/api/flood-relief/gauges/*`, UI `GaugePanel.tsx` + `gaugeIcon.ts`): ปักจุดสำคัญแล้วส่งรูปเป็นระยะ (+ระดับน้ำ ซม. ไม่บังคับ) · **admin ทุกคนปักจุด/ส่งรูปได้ ลบจุดได้เฉพาะ superadmin** · เก็บ 30 รูปล่าสุด + คัดลอก `last*` · รูปขึ้นหน้าสาธารณะ `/flood` ผ่าน `publicGauge()` ที่ **ไม่ส่งชื่อผู้อัปโหลด/ประวัติ** · รูปเก่าเกิน 6 ชม. ขึ้นเตือน "อาจไม่ใช่ปัจจุบัน" · รูปรับเฉพาะ Cloudinary
- ระดับสถานการณ์บนหน้าแรก = `situationOverride` ที่ superadmin ประกาศ หรือ `auto` = ระดับโซนสูงสุดที่เปิดใช้งาน
- บล็อกหน้าแรกเป็นโทนแดง + ขอบไฟไซเรน (`.flood-siren` ใน `styles/globals.css`) ตามที่เจ้าของสั่ง · หน้าอื่นใช้น้ำเงิน `tk-flood-*` · ไม่แตะ `--color-primary`
