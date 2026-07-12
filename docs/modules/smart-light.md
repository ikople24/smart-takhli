# smart-light — เสาไฟสาธารณะ (กองช่าง)

ทะเบียนเสาไฟสาธารณะ LED บนแผนที่ + บันทึกสภาพจากการสำรวจหน้างาน
Spec: `docs/superpowers/specs/2026-07-10-smart-light-design.md`

## โครงสร้าง

| ชั้น | ไฟล์ |
|---|---|
| หน้า admin | `pages/admin/smart-light.jsx` |
| API | `pages/api/smart-light/` (`poles/`, `groups/`, `_auth.js`) |
| Components | `components/smart-light/` (SmartLightMap, PoleBottomSheet, SurveyModal, EditPoleModal, AddPoleModal, GroupRenameModal, SearchPanel, RightRail, HealthSummaryCard, StatusCards, OverdueCard, GroupHeatmapCard, MapStatusChips, DataTableModal, NearbyCard, MapLayers, MapLayerToggle, modalUi) |
| Lib | `lib/smart-light/` (constants, geo, poleCode, uploadImage, theme, metrics) |
| Model | `models/smart-light/StreetLightPole.js` → collection `street_light_poles` |
| Scripts | `scripts/import-street-light-kmz.js`, `scripts/grant-smart-light-permission.js` |
| ข้อมูลดิบ | `public/point_of_ligth/` (KMZ 1,067 จุด/21 กลุ่ม + KML 4 ไฟล์ — backup ห้ามลบ) |

> ดีไซน์ใหม่ (2026-07): ธีมม่วง เดสก์ท็อป (แผนที่ + แถบขวาวิเคราะห์) / มือถือ responsive (bottom-sheet + การ์ดเสาใกล้ตัว)
> โทเคนสีที่ `lib/smart-light/theme.js` · ตัวเลขสรุป (pure, มีเทสต์) ที่ `lib/smart-light/metrics.js`
> panel วิเคราะห์ทั้งหมด (โดนัทสุขภาพ/สถานะ/ค้างสำรวจ/heatmap/ตาราง) คำนวณฝั่ง client จาก `/groups` + `/poles` เดิม — ไม่มี API/model เปลี่ยน

## รหัสเสา

`TK-LED-ปปดด#####` เช่น `TK-LED-690700001` = ลงทะเบียนปี พ.ศ. 69 เดือน 07 ต้นที่ 00001
เลขต้น 5 หลักวิ่งต่อเนื่องทั้งระบบ **ไม่รีเซ็ตตามเดือน** — gen ที่ `lib/smart-light/poleCode.js`
ชุด seed ปัจจุบัน: `TK-LED-690700001` … `TK-LED-690701067` (1,067 ต้น / 21 กลุ่ม)

## API (ทุกตัวผ่าน `requireSmartLightAdmin` — Clerk + appId + allowedPages `/admin/smart-light`)

- `GET/POST /api/smart-light/poles` — list (ไม่มี surveys) / เพิ่มเสา
- `GET/PUT/DELETE /api/smart-light/poles/:id` — เต็ม (รวมประวัติ) / แก้ / ลบ
- `POST /api/smart-light/poles/:id/survey` — บันทึกสภาพ (push surveys + อัปเดตสถานะปัจจุบัน)
- `GET /api/smart-light/groups` — สรุปรายกลุ่ม + centroid
- `PUT /api/smart-light/groups/rename` — เปลี่ยนชื่อกลุ่มทั้งกลุ่ม; ถ้าชื่อใหม่ชนกลุ่มที่มีอยู่จะตอบ
  409 `{needsConfirm:true}` ต้องส่งซ้ำพร้อม `confirmMerge: true` (กันรวมกลุ่มโดยไม่ตั้งใจ)

## Seed จาก KMZ

`node --env-file=.env.local scripts/import-street-light-kmz.js` (`--dry-run` ได้)
Idempotent ด้วยคีย์ `(source, group, name, lat, lng)` — ต้องมีพิกัดในคีย์เพราะไฟล์ต้นทาง
มีชื่อ marker ซ้ำในกลุ่มเดียวกัน 2 คู่ที่เป็นเสาคนละต้นจริง

## แผนที่เรนเดอร์ 2 ระดับ

zoom < 15 → bubble รายกลุ่ม (centroid จาก API groups) · zoom ≥ 15 → หมุดรายต้นเฉพาะในกรอบจอ+ขอบเผื่อ 20%
threshold ปรับที่ `POLE_ZOOM_THRESHOLD` ใน `lib/smart-light/constants.js`
พื้นหลังแสดงขอบเขตชุมชน (GeoJSON polygons) จาก `GET /api/geojson-features` — จัดการข้อมูลที่ `/admin/settings/geojson-map`
สลับ base layer แผนที่ถนน (OSM) ↔ ภาพถ่ายดาวเทียม (Esri World Imagery + ป้ายถนน/สถานที่) ด้วย `MapLayerToggle` (ปุ่มไอคอนเลเยอร์เล็ก แตะสลับ, มุมขวาบน) — เริ่มที่แผนที่ถนน; ใช้ทั้งแผนที่หลักและแผนที่ย่อยในฟอร์มแก้ไข. ใช้ Esri เพราะ Google `/vt/` มักถูกบล็อกในบางเครือข่าย. ไม่มีปุ่ม zoom +/- (`zoomControl={false}`) — ซูมด้วย scroll (เดสก์ท็อป) / จีบ (มือถือ) กันทับแถบ chip สถานะ

## สิทธิ์

ลงทะเบียนครบ 4 จุด: `ALL_PAGES` + `DEFAULT_PERMISSIONS.admin` + `LayoutAdmin.navigationItems` +
`scripts/grant-smart-light-permission.js` (dry-run โดย default, เพิ่มจริงด้วย `--yes` —
สำหรับ user เดิมที่มี custom allowedPages)

## Manual test checklist

1. seed: `node --env-file=.env.local scripts/import-street-light-kmz.js` → 1,067 จุด/21 กลุ่ม รหัสรูปแบบ `TK-LED-ปปดด#####` ต่อเนื่อง; รันซ้ำไม่เพิ่ม
2. กรองกลุ่ม/สถานะ + chips สรุปถูกต้อง
3. เรนเดอร์ตามสเกล: ซูมไกลเห็น bubble รายกลุ่ม, ซูมใกล้เห็นหมุดรายต้น, เลื่อน/ซูมลื่น
4. บันทึกสภาพ (มี/ไม่มีรูป) → สีหมุดเปลี่ยน, ประวัติเพิ่ม
5. เพิ่มเสา (แตะแผนที่ + GPS) → ได้รหัสต่อจากเลขสูงสุด; แก้ไข; ลากย้ายพิกัด; ลบ (confirm 2 ชั้น)
6. ค้นหา: วางพิกัด `lat,lng` → 10 เสาใกล้สุด+ระยะ; พิมพ์รหัส/กลุ่ม → เจอ; ปุ่ม "นำทาง" เปิด Google Maps
7. เปลี่ยนชื่อกลุ่ม → เสาทุกต้นในกลุ่มอัปเดต; เปลี่ยนเป็นชื่อกลุ่มที่มีอยู่ → มีกล่องยืนยันรวมกลุ่มก่อน
8. user ไม่มีสิทธิ์ `/admin/smart-light` → ถูกปฏิเสธทั้งหน้าและ API; superadmin เข้าได้
9. ทดสอบบนมือถือ (bottom-sheet, ถ่ายรูป, geolocation)
10. ดีไซน์ใหม่ (ธีมม่วง): header ม่วง + แถบขวา 4 การ์ด (โดนัทสุขภาพ/สถานะ/ค้างสำรวจ/heatmap) แสดงเลขตรงกับ chip
11. คลิก StatusCard / heatmap tile / overdue row → กรอง + โฟกัสถูกต้อง
12. ตารางข้อมูล (DataTableModal): เรียงคอลัมน์, ค้นหารหัส/กลุ่ม, คลิกแถวโฟกัสบนแผนที่
13. responsive: ย่อจอ <1024px → แถบขวาหาย, chip เลื่อนแนวนอน, การ์ด "เสาไฟใกล้คุณ" โผล่ (หรือข้อความขอสิทธิ์ GPS)
14. เทสต์ metrics: `node lib/smart-light/__tests__/metrics.test.mjs` → ผ่าน

## นอกขอบเขต (เฟสถัดไป)

ใบสั่งซ่อม · หน้า public · อัปโหลด KML/KMZ ผ่านเว็บ · จุดไม่ซ้ำ ~22 จุดจาก KML 4 ไฟล์ · ฟิลด์งานช่างละเอียด (วัตต์/ความสูง/มิเตอร์)
