# Spec: โมดูลเสาไฟสาธารณะ (smart-light) — กองช่าง

- **วันที่:** 2026-07-10
- **สถานะ:** ดีไซน์ผ่านการรีวิวรายส่วนแล้ว (3 ส่วน) — รอเขียน implementation plan
- **ขอบเขตรอบแรก:** ทะเบียนเสาไฟ + บันทึกสภาพจากการสำรวจหน้างาน (ยังไม่มีระบบใบสั่งซ่อม)

## 1. เป้าหมาย

กองช่างเทศบาลเมืองตาคลีมีข้อมูลตำแหน่งเสาไฟสาธารณะ LED เก็บเป็นไฟล์ KML/KMZ
(`public/point_of_ligth/`) ต้องการระบบบนพอร์ทัล admin ที่:

- แสดงเสาไฟทั้งหมดบนแผนที่ จัดกลุ่ม/กรองตามชุมชน
- เจ้าหน้าที่กองช่างเพิ่ม แก้ไข ลบข้อมูลเสาได้
- บันทึกสภาพเสา (ปกติ/ชำรุด/ดับ) พร้อมรูปถ่ายจากมือถือหน้างาน และเก็บประวัติการสำรวจ

## 2. ข้อมูลตั้งต้น

| แหล่ง | จุด | หมายเหตุ |
|---|---|---|
| `export_2025_03_27-00_14_07.kmz` (แอป MapMarker) | **1,067 จุด / 21 กลุ่ม** | **ใช้เป็นแหล่งเดียวในการ seed** |
| KML 4 ไฟล์ (Google Earth): โพนทอง 208, ตีคลี 47, เอื้ออารีย์ 29, เขโบท 6 | 290 จุด | ซ้ำกับ KMZ 80–96% (รัศมี 15 ม.) — **ไม่ import**; จุดที่ไม่ซ้ำ ~22 จุดให้เจ้าหน้าที่เพิ่มเองภายหลัง |

กลุ่มใน KMZ คือชื่อชุมชน/ถนน/ซอย 21 ชื่อ (เช่น ทวีชัย 190, ถ ตาคลี 159, ตักศิลา 86, วัดโพนทอง 82,
ชุมชนสารภี1_2 81) — บางชื่อสะกดผิดจากไฟล์เดิม (เช่น "ตลีคลี", "เอื่ออารี") จึงต้องมีเครื่องมือเปลี่ยนชื่อกลุ่ม
ทุกจุดมีเฉพาะพิกัด + เลขลำดับ ไม่มีคุณสมบัติเสา → เริ่มต้นทุกเสาเป็นสถานะ "ยังไม่สำรวจ"

ไฟล์ใน `public/point_of_ligth/` เก็บไว้เป็น backup ห้ามลบ (แนวเดียวกับ `educationregisters`)

## 3. โครงสร้างโมดูล (ตาม convention ของ repo)

ชื่อโมดูล: **`smart-light`** — เมนูภาษาไทย **"เสาไฟสาธารณะ"** (งานกองช่าง)

```
pages/admin/smart-light.jsx            — หน้าแผนที่หลัก (หน้าเดียว)
pages/api/smart-light/                 — API ทั้งหมด (+ _auth.js)
components/smart-light/                — map, bottom-sheet, ฟอร์ม, modal กลุ่ม
lib/smart-light/constants.js           — enum สถานะ/ชนิดโคม + label/สีภาษาไทย
models/smart-light/StreetLightPole.js  — Mongoose model
scripts/import-street-light-kmz.js     — seed ครั้งเดียวจาก KMZ (idempotent)
scripts/grant-smart-light-permission.js — เพิ่มสิทธิ์ให้ user เดิม
docs/modules/smart-light.md            — เอกสารโมดูล (+ เพิ่มดัชนีใน docs/modules/README.md)
```

การสร้างหน้า/โมดูลให้ทำตาม skill `adding-admin-page` และ `adding-feature-module` ของ repo

## 4. Data model

**Collection `street_light_poles`** — 1 เอกสาร = 1 เสา (model `StreetLightPole`)

| ฟิลด์ | ชนิด | รายละเอียด |
|---|---|---|
| `code` | String, **unique index** | รหัสเสารันอัตโนมัติ `SL-0001`, `SL-0002`, … (gen จากเลขสูงสุด + retry เมื่อชน duplicate key) |
| `name` | String | ชื่อ/เลขเดิมจากไฟล์ (เช่น "Marker 12") — optional สำหรับเสาที่เพิ่มเอง |
| `group` | String, **index** | ชุมชน/กลุ่ม — แก้ย้ายกลุ่มได้ผ่านฟอร์มแก้ไข |
| `lat`, `lng` | Number, required | พิกัด (validate ช่วงพิกัดไทยคร่าว ๆ: lat 5–21, lng 97–106) |
| `lampType` | String enum | `led` \| `other` \| `unknown` (default `unknown`) |
| `status` | String enum | `normal` \| `damaged` \| `off` \| `unknown` (default `unknown`) — สภาพปัจจุบัน |
| `photoUrl` | String | รูปล่าสุด (Cloudinary) |
| `note` | String | หมายเหตุ |
| `lastSurveyedAt` | Date | วันที่สำรวจล่าสุด |
| `lastSurveyedBy` | String | ชื่อผู้สำรวจล่าสุด (จาก Clerk) |
| `surveys[]` | Array (embedded) | ประวัติสำรวจ: `{ status, photoUrl, note, surveyedAt, surveyedBy, surveyedByClerkId }` |
| `source` | String enum | `kmz-import` \| `manual` |
| timestamps | | `createdAt`, `updatedAt` |

Label ภาษาไทยของ enum (อยู่ที่ `lib/smart-light/constants.js` ใช้ร่วมทั้ง UI/สีหมุด):
`normal`=ปกติ (เขียว), `damaged`=ชำรุด (เหลือง), `off`=ดับ (แดง), `unknown`=ยังไม่สำรวจ (เทา);
`led`=LED, `other`=หลอดอื่น, `unknown`=ไม่ระบุ

เหตุที่ embed `surveys[]` ใน pole doc: จำนวนสำรวจต่อเสาต่ำ (ปีละไม่กี่ครั้ง) ไม่คุ้มแยก collection;
ถ้าอนาคตทำระบบใบสั่งซ่อมค่อยแยกได้

## 5. API (`pages/api/smart-light/`)

ทุก endpoint ตรวจสิทธิ์ผ่าน helper `_auth.js` ตามแบบ `pages/api/pm25/_auth.js#requirePm25Admin`:
`getAuth(req)` → lookup Mongo user → เช็ค `appId` ตรง `NEXT_PUBLIC_APP_ID` → เช็ค `allowedPages`
มี `/admin/smart-light` (ผ่าน `pathMatchesPermission`) → superadmin ข้ามทุกเงื่อนไข

| Method + Path | หน้าที่ |
|---|---|
| `GET /api/smart-light/poles` | รายการเสาทั้งหมด กรอง `?group=&status=` ได้ — **ไม่ส่ง `surveys[]`** (projection ออก) เพื่อให้ payload เบา |
| `POST /api/smart-light/poles` | เพิ่มเสาใหม่ (gen `code`, `source: manual`) |
| `GET /api/smart-light/poles/[id]` | ข้อมูลเสาเต็ม รวมประวัติสำรวจ |
| `PUT /api/smart-light/poles/[id]` | แก้ไข group / lampType / lat,lng / note / name |
| `DELETE /api/smart-light/poles/[id]` | ลบเสา (hard delete — UI ยืนยัน 2 ชั้น) |
| `POST /api/smart-light/poles/[id]/survey` | บันทึกสภาพ: push เข้า `surveys[]` + อัปเดต `status`, `photoUrl`, `lastSurveyedAt/By` |
| `GET /api/smart-light/groups` | aggregate รายชื่อกลุ่ม + จำนวนเสารวม + จำนวนแยกตามสถานะ |
| `PUT /api/smart-light/groups/rename` | เปลี่ยนชื่อกลุ่มทั้งกลุ่ม: `{ from, to }` → `updateMany` |

Validation ฝั่ง server ทุกจุด: enum ต้องถูกต้อง, พิกัดต้องอยู่ในช่วง, `group`/`code` ไม่ว่าง —
error message เป็นภาษาไทย รูปแบบ `{ success: false, message }`

## 6. UI — หน้า `/admin/smart-light` (mobile-first ใช้หน้างาน)

- **แผนที่ Leaflet เต็มหน้า** — dynamic import `ssr: false` ตามแบบ component แผนที่เดิมใน repo;
  ใช้ `preferCanvas: true` + **CircleMarker สีตามสถานะ** รองรับ 1,067 จุดโดยไม่ต้องเพิ่ม dependency ใหม่
- **แถบกรอง**: dropdown กลุ่ม (พร้อมจำนวน), ปุ่มกรองสถานะ, chips สรุปจำนวน รวม/ปกติ/ชำรุด/ดับ/ยังไม่สำรวจ
  (อัปเดตตาม filter) — ข้อมูลจาก `GET /groups` + list ในหน่วยความจำ
- **แตะหมุด → bottom-sheet** (DaisyUI modal ล่าง): รหัส กลุ่ม สถานะ ชนิดโคม รูป หมายเหตุ
  ประวัติสำรวจ (เรียกเต็มจาก `GET /poles/[id]`) + ปุ่ม 2 ปุ่ม:
  - **"บันทึกสภาพ"** — modal เดียวจบ: เลือกสถานะ (ปุ่มใหญ่ 3 สถานะ) + ถ่าย/อัปโหลดรูป (Cloudinary
    ตาม flow อัปโหลดที่มีอยู่ใน repo) + หมายเหตุ → `POST /survey` — ออกแบบให้กดเร็วหน้างาน
  - **"แก้ไขข้อมูล"** — ฟอร์มแก้ group (dropdown + พิมพ์ใหม่ได้), lampType, พิกัด (ลากหมุดบนแผนที่ย่อย),
    name, note + ปุ่มลบเสา (confirm 2 ชั้น)
- **"+ เพิ่มเสา"**: เลือกจุดโดยแตะแผนที่ หรือปุ่ม "ใช้ตำแหน่งปัจจุบัน" (geolocation มือถือ) → ฟอร์มสั้น
  (group, lampType, รูป, หมายเหตุ)
- **จัดการกลุ่ม**: ปุ่มเปิด modal รายชื่อกลุ่ม → เปลี่ยนชื่อกลุ่ม (`PUT /groups/rename`);
  การย้ายเสาเข้ากลุ่มอื่นทำรายเสาผ่านฟอร์มแก้ไข

## 7. Seed จาก KMZ — `scripts/import-street-light-kmz.js`

- รันด้วย `node --env-file=.env.local scripts/import-street-light-kmz.js`
- ขั้นตอน: แตก zip KMZ → parse `doc.kml` → วนทั้ง 21 `<Folder>` → ต่อ placemark สร้างเอกสาร
  `{ code: SL-xxxx (รันต่อเนื่องทั้งชุด), name, group: ชื่อ folder, lat, lng, status: unknown, lampType: unknown, source: kmz-import }`
- **Idempotent**: `updateOne` upsert ด้วยคีย์ `{ source: 'kmz-import', group, name }` — รันซ้ำไม่สร้างซ้ำ
  และไม่ทับข้อมูลที่เจ้าหน้าที่แก้ไปแล้ว (upsert เซ็ตเฉพาะ `$setOnInsert`)
- สรุปผลท้ายรัน: จำนวน insert / skip

## 8. สิทธิ์การเข้าถึง — ครบ 4 จุดตาม checklist repo

1. ลงทะเบียน `/admin/smart-light` ใน `ALL_PAGES` (`lib/permissions.ts`) — label "เสาไฟสาธารณะ", category `management` (หมวดเดียวกับโมดูลฟีเจอร์อื่น — category เป็น union ตายตัว 4 ค่าใน type)
2. เพิ่มใน `DEFAULT_PERMISSIONS` ของ role `admin`
3. เพิ่มเมนูใน `components/LayoutAdmin.tsx` (`navigationItems` — hardcode แยกจาก ALL_PAGES)
4. `scripts/grant-smart-light-permission.js` เพิ่ม `/admin/smart-light` ให้ user เดิมที่มี custom
   `allowedPages` ใน Mongo (แบบเดียวกับ `grant-elderly-school-permission.js`) —
   preset ผู้บริหาร (`getExecutivePagePaths`) จะเห็นหน้าใหม่อัตโนมัติเมื่ออยู่ใน `ALL_PAGES`
   แต่ user ที่ถูก grant ไปแล้วเป็น snapshot ต้องรัน script นี้ซ้ำ

หน้านี้**ไม่มีส่วน public** — เข้าได้เฉพาะเจ้าหน้าที่ที่ได้รับสิทธิ์

## 9. Error handling

- ข้อความ error ภาษาไทยทุก endpoint (`{ success: false, message }`)
- อัปโหลดรูปล้มเหลว → บันทึกสภาพต่อได้โดยไม่มีรูป (แจ้งเตือนแต่ไม่บล็อก) — งานหน้างานต้องไม่สะดุด
- geolocation ถูกปฏิเสธ/ไม่พร้อม → fallback ให้แตะเลือกจุดบนแผนที่
- ลบเสา: confirm 2 ชั้น — เปิด modal แสดงรหัสเสา/กลุ่ม แล้วต้องกดปุ่มยืนยันสีแดงอีกครั้งจึงลบจริง
- seed script: ถ้า parse ไฟล์ไม่ได้/ENV ขาด ให้ fail พร้อมข้อความชัดเจน ไม่เขียนข้อมูลครึ่ง ๆ กลาง ๆ

## 10. การทดสอบ (repo ไม่มี test runner)

- `npm run lint` + `npm run build` ต้องผ่าน
- Manual checklist (ใส่ไว้ใน `docs/modules/smart-light.md`):
  1. รัน seed → เห็น 1,067 จุด / 21 กลุ่มบนแผนที่; รันซ้ำ → จำนวนไม่เพิ่ม
  2. กรองตามกลุ่ม/สถานะ + chips สรุปถูกต้อง
  3. บันทึกสภาพ (มี/ไม่มีรูป) → สีหมุดเปลี่ยน, ประวัติเพิ่ม
  4. เพิ่มเสา (แตะแผนที่ + GPS), แก้ไข, ลากย้ายพิกัด, ลบ
  5. เปลี่ยนชื่อกลุ่ม → ทุกเสาในกลุ่มอัปเดต
  6. user ไม่มีสิทธิ์ `/admin/smart-light` → ถูกปฏิเสธทั้งหน้าและ API; superadmin เข้าได้
  7. ทดสอบบนมือถือ (bottom-sheet, ถ่ายรูป, geolocation)

## 11. นอกขอบเขตรอบนี้

- ระบบใบสั่งซ่อม / สถานะงานซ่อม (เฟสถัดไป — `surveys[]` ออกแบบให้ต่อยอดได้)
- หน้าแผนที่ public สำหรับประชาชน
- หน้าอัปโหลด KML/KMZ เพิ่มผ่านเว็บ
- นำเข้าจุดที่เหลือ ~22 จุดจาก KML 4 ไฟล์ (เจ้าหน้าที่เพิ่มเองจากหน้างาน)
- ฟิลด์ละเอียดงานช่าง (วัตต์, ความสูงเสา, มิเตอร์) — schema เพิ่มภายหลังได้โดยไม่ต้อง migrate
