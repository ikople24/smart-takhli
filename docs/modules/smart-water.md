# smart-water — ทะเบียนท่อประปา (กองการประปา)

ทะเบียนแนวท่อประปาและอุปกรณ์ของเทศบาลเมืองตาคลี — เก็บแนวท่อเป็น GeoJSON `LineString` และอุปกรณ์
(หัวดับเพลิง/วาล์ว ฯลฯ) เป็น `Point` แสดงบนแผนที่ + รายงานความยาว

**เฟส 1 เป็น read-only** — ดูแผนที่และรายงานเท่านั้น ยังไม่มี UI เพิ่ม/แก้ข้อมูลบนหน้าเว็บ
(แก้ข้อมูลต้องยิง API ตรงหรือแก้ผ่านสคริปต์ seed)

## โครงสร้าง

| ชั้น | ไฟล์ |
|---|---|
| หน้า admin | `pages/admin/smart-water/index.jsx` (แผนที่), `pages/admin/smart-water/report.jsx` (รายงานความยาว — หน้าลูก ใช้ `requiredPath="/admin/smart-water"` ยืมสิทธิ์หน้าแม่ ไม่ได้ลงทะเบียนสิทธิ์แยก) |
| API | `pages/api/smart-water/` — `pipes/index.ts`, `pipes/[id].ts`, `nodes/index.ts`, `nodes/[id].ts`, `reports/length.ts` ทุกตัวผ่าน `_auth.ts#requireSmartWaterAdmin` |
| Lib | `lib/smart-water/` — `constants.ts`, `pipe-code.ts`, `geo.ts`, `schemas.ts`, `db.ts`, `service.ts`, `reports.ts`, `labels.ts`, `api-helpers.ts` (เทสต์ colocate `*.test.ts` ข้างไฟล์จริง รวม 63 เทสต์) |
| Components | `components/smart-water/WaterMap.js` (react-leaflet v5 — ต้องโหลดผ่าน `dynamic(..., { ssr: false })`), `PipeLegend.js` |
| Scripts | `scripts/seed-water.ts`, `scripts/grant-smart-water-permission.js` |

## Collections

ใช้ **native MongoDB driver** ผ่าน `lib/mongoNative.ts` (client กลาง แชร์กับโมดูล garbage)
**ไม่ใช่ Mongoose** — ต่างจากโมดูลอื่นส่วนใหญ่ในรีโปนี้ ดังนั้นจึงไม่มี `models/smart-water/`

- **`water_pipes`** — geometry `LineString` + ฟิลด์กรอกเอง `material`, `diameter {value, unit}`, `status`,
  `roadName`, `zone`, `installedYear`, `ownership`, `lengthSource`, `sourceDoc`, `note`
  และฟิลด์ **derive อัตโนมัติ**: `code`, `diameterMm`, `lengthM`, `bbox` · soft delete ด้วย `deletedAt`
- **`water_nodes`** — geometry `Point` + `type`, `hydrantNo` (unique partial index), `size`, `condition`,
  `onPipeId`, `accessNote`, `note`
- index: `ensureWaterIndexes()` ใน `lib/smart-water/db.ts` (idempotent, seed script เรียกให้อัตโนมัติ) —
  `by_status`/`by_type` ขึ้นต้นด้วย `deletedAt` เพราะทุก query กรอง `deletedAt: null` (คิวรี "เอาทั้งหมดที่ยังไม่ลบ"
  จึงใช้ index ได้) ส่วน `by_material`/`by_road`/`by_code` ไม่ต้องมี `deletedAt` นำ — สัดส่วนเอกสารที่ถูกลบน้อย
  กรองทีหลังถูกกว่า

## กติกาสำคัญ (ห้ามพลาด)

1. **ทุกการเขียนต้องผ่าน `lib/smart-water/service.ts`** (`savePipe` / `saveNode`) — ห้าม API หรือ script
   เขียน collection ตรง ไม่งั้นฟิลด์ derive (`code`/`diameterMm`/`lengthM`/`bbox`) จะไม่อัปเดต
2. **สีบนแผนที่ผูกกับ "รหัสท่อ" (ชนิด+ขนาด) ไม่ใช่ชนิดวัสดุ** — `CODE_COLORS` ใน `constants.ts` อ่านจาก
   แบบร่างปี 2568 ให้ตรงกับที่กองการประปาใช้จริง · รหัสที่ไม่อยู่ในแบบใช้ `FALLBACK_COLOR` (เทา) ·
   มีสีแดงซ้ำกัน 3 รหัส (P1.5 / P6 / A4) แยกกันด้วยความหนาเส้นตาม `diameterMm` แทน ·
   **ห้ามเปลี่ยนไประบายตาม `material`**
3. **รหัสท่อ** = ตัวอักษรชนิด (A/G/H/P/S/R) + ตัวเลขขนาด — หน่วยของตัวเลขต่างกันตามชนิด (นิ้ว/มม./ซม.)
   `derivePipeFields` สร้าง code จาก `diameter.value` ตรง ๆ โดยไม่แปลงหน่วย ผู้เรียกจึงต้องส่ง
   `diameter.unit` ให้ตรงกับชนิดท่อเอง
4. **`lengthM` คือระยะราบบนพิกัด UTM zone 47N (คำนวณด้วย `proj4`) ไม่ใช่ความยาวท่อจริง** — ท่อจริงมักยาว
   กว่าตัวเลขนี้ 2–5% (ความลาดชัน/การวางโค้ง)
5. **Soft delete ของ node จะ tombstone `hydrantNo`** เป็น `HD-001~deleted~<ms>` ในการอัปเดตเดียวกัน
   (aggregation-pipeline update, ต้องการ MongoDB 4.2+) เพราะ unique partial index ครอบเอกสารที่ถูกลบด้วย —
   ถ้าจะ restore ต้องตัด suffix `~deleted~<ms>` ออกจาก `hydrantNo` เองก่อน
6. **PATCH ต้อง merge เอกสารเดิม + payload ให้ครบก่อน parse ทั้งก้อน** — ฟิลด์ที่มี `.default()` ใน zod
   schema จะถูกรีเซ็ตกลับเป็นค่า default ถ้า parse จากข้อมูลบางส่วน (partial) เท่านั้น
   ป้องกันไว้แล้วในทุก route ปัจจุบัน แต่**ห้ามเขียน flow ใหม่ที่ parse partial โดยไม่ merge ก่อน**
7. ข้อความจาก DB ที่เขียนลง popup ของ Leaflet **ต้อง escape ด้วย `escapeHtml`** จาก
   `lib/smart-water/labels.ts` เสมอ (popup เป็น raw HTML string) และแสดง enum เป็นภาษาไทยด้วย
   `pipeStatusLabel` / `nodeTypeLabel` / `nodeConditionLabel`
8. **`<GeoJSON>` ของ react-leaflet v5 ไม่รีเรนเดอร์เมื่อ prop `data` เปลี่ยน** — หน้าเพจปัจจุบันจึง mount
   แผนที่หลังโหลดข้อมูลครบเท่านั้น ถ้าในอนาคตเพิ่มปุ่มรีเฟรช/ตัวกรอง ต้องใส่ `key=` บังคับ remount ด้วย

## สิทธิ์

- `/admin/smart-water` ลงทะเบียนใน `ALL_PAGES` (`lib/permissions.ts`) + เมนูใน `components/LayoutAdmin.tsx`
- **ไม่อยู่ใน `DEFAULT_PERMISSIONS`** ของ role ไหนเลย — superadmin ต้องติ๊กสิทธิ์ให้ทีละคนที่
  `/admin/superadmin`
- แต่ **preset "ผู้บริหาร" รวมหน้านี้ให้อัตโนมัติ** เพราะจัดอยู่ใน `category: 'management'` —
  `getExecutivePagePaths()` ดึงทุกหน้าที่ไม่ใช่ settings มาให้ preset นี้เสมอ
- `scripts/grant-smart-water-permission.js` — **dry-run เป็นค่า default** ต้องใส่ `--yes` ถึงจะเขียนจริง
  (สคริปต์ grant รุ่นเก่าบางตัวในโฟลเดอร์นี้พฤติกรรมกลับกัน คือเขียนจริงเป็นค่า default — ตรวจให้ดีก่อนรัน
  สคริปต์ตัวไหนของโมดูลอื่น) ใช้ `$addToSet` รันซ้ำได้อย่างปลอดภัย เป้าหมายคือ user ที่มี custom
  `allowedPages` ไม่ว่างอยู่แล้ว (คนที่ `allowedPages` ว่างใช้ `DEFAULT_PERMISSIONS` อยู่แล้วไม่ต้อง grant)
- ฝั่ง API re-verify สิทธิ์บนเซิร์ฟเวอร์เสมอด้วย `requireSmartWaterAdmin`
  (Clerk → lookup Mongo user → เช็ค `isActive`/`isArchived` → เช็ค `appId` → `hasPermission`) —
  role `superadmin` ที่ตั้งใน Mongo document เพียงอย่างเดียว **ยกระดับสิทธิ์ตัวเองไม่ได้**
  มีแต่ Clerk `publicMetadata.role === "superadmin"` เท่านั้นที่ข้ามทุกการตรวจสอบได้

## การรันสคริปต์

- **seed**: `node --env-file=.env.local --import tsx scripts/seed-water.ts` — idempotent
  (ลบเฉพาะเอกสารที่แท็ก `SEED-DATA` แล้วเขียนใหม่ ข้อมูลจริงที่มีอยู่ไม่ถูกแตะ) และเรียก
  `ensureWaterIndexes()` ให้ด้วยในตัว

  > **ลำดับสำคัญตอนขึ้นข้อมูลจริง:** ต้องสร้าง index ให้เสร็จ (รัน seed script หนึ่งครั้ง) **ก่อน** import ข้อมูลจริง
  > — ถ้า import ข้อมูลที่มี `hydrantNo` ซ้ำเข้าไปก่อน จะสร้าง unique index `uniq_hydrant_no` ไม่ผ่าน
- **⚠️ ข้อมูล seed เป็นพิกัดสมมติรอบตาคลี ไม่ใช่แนวท่อจริง — ห้ามเอาตัวเลขไปใช้อ้างอิงในรายงานจริง**
  ตอนขึ้นข้อมูลจริงต้องลบข้อมูล seed ทิ้งเอง (ยังไม่มี flag `--purge` ในสคริปต์):
  ```js
  db.water_pipes.deleteMany({ "sourceDoc.pdfName": "SEED-DATA" })
  db.water_nodes.deleteMany({ note: "SEED-DATA" })
  ```
- **grant สิทธิ์ (dry-run)**: `node --env-file=.env.local scripts/grant-smart-water-permission.js`
  (เพิ่ม `--yes` เมื่อพร้อมเขียนจริง)
- **⚠️ คำสั่งตรวจข้อมูลแบบ one-liner ต้องใช้ `-r tsx/cjs` ไม่ใช่ `--import tsx`**:
  ```bash
  node --env-file=.env.local -r tsx/cjs -e "const m = require('./lib/smart-water/db'); ..."
  ```
  ถ้าใช้ `--import tsx` แล้ว `import()` แบบ dynamic จะได้ error `m.pipes is not a function` เพราะ
  named export ของ CJS ที่ tsx คอมไพล์ออกมาไม่ถูก Node detect ผ่านทางนั้น

## ข้อจำกัด / ที่ยังไม่ทำ (เฟสถัดไป)

- ยังไม่มี UI เพิ่ม/แก้ท่อหรืออุปกรณ์บนแผนที่ — ต้องยิง API ตรงหรือแก้ผ่าน seed script เท่านั้น
- ยังไม่มี import จากไฟล์ PDF/CAD จริงของกองการประปา
- รายงานคอลัมน์ "กม." ปัดเลขทีละแถว จึงอาจต่างจากยอดรวมในระดับ 1 มม. (คอลัมน์ "เมตร" ตรงกับยอดรวมเสมอ —
  ใช้เมตรเป็นเลขอ้างอิงเวลาต้องเช็คยอด)
- **เฟส 2**: บันทึกการเป่าตะกอน/ล้างท่อ + หน้ามือถือสำหรับเจ้าหน้าที่หน้างาน
- **เฟส 3+**: งานซ่อม, topology graph ของโครงข่ายท่อ, editor ลากเส้นบนแผนที่ (leaflet-geoman)
