# ระบบบันทึกโบตะกอน (smart-papar) — Design

วันที่: 2026-10-06 · โมดูล: `smart-papar` (คุณภาพน้ำประปา)

## ที่มา

ช่วงนี้มีเรื่องแจ้ง "น้ำขุ่น" เข้ามาจำนวนมาก กองการประปาต้องออกโบตะกอน (เปิดวาล์ว/หัวดับเพลิงระบายตะกอนในท่อ)
ต้องการให้เจ้าหน้าที่หน้างาน**บันทึกข้อมูล + ถ่ายรูปส่งงาน**เข้าระบบได้จากมือถือ เน้นใช้ง่าย

**คำศัพท์:** ใช้คำว่า **"โบตะกอน"** ทุกที่ใน UI/เอกสาร (เป็นคำที่เจ้าหน้าที่ใช้จริง — ไม่ใช้ "เป่าตะกอน")

## ขอบเขต

ทำ:
- หน้าลูก `/admin/smart-papar/water-quality/flushing` — ฟอร์มบันทึก (มือถือก่อน) + รายการ + แผนที่จุด
- model / API / logic ตรวจข้อมูลพร้อมเทสต์

ไม่ทำรอบนี้:
- ผูกกับเรื่องร้องเรียน (บันทึกแยกอิสระ — เรื่องร้องเรียนปิดผ่านโมดูล tasks ตามเดิม)
- ผูกกับทะเบียนท่อ `smart-water` (ไม่แตะ `water_pipes`/`water_nodes`)
- export Excel, แจ้งเตือน LINE

## 1. Data model

`models/smart-papar/FlushingLog.js` → collection `smart_papar_flushing_logs` (Mongoose ตามโมดูลเดิม)

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `flushedAt` | Date, required | ค่าเริ่มต้นในฟอร์ม = ตอนเปิดฟอร์ม แก้ได้ |
| `location` | GeoJSON Point `{type, coordinates:[lng,lat]}`, required | index `2dsphere` |
| `locationName` | String, required, trim, ≤ 200 | ชื่อจุด/ถนน |
| `durationMin` | Number, required | จำนวนเต็ม 1–600 |
| `turbidityBeforeNtu` | Number \| null | ไม่บังคับ, 0–1000 |
| `turbidityAfterNtu` | Number \| null | ไม่บังคับ, 0–1000 |
| `result` | String, required | `clear` (ใสแล้ว) \| `still_turbid` (ยังขุ่น) |
| `photosBefore` | [String] | URL Cloudinary, 0–3 รูป |
| `photosAfter` | [String] | URL Cloudinary, 0–3 รูป |
| `note` | String | ≤ 1000 |
| `createdByClerkId`, `createdByName` | String | จาก `requireSmartPaparAdmin` |
| `updatedByClerkId`, `updatedByName` | String | |
| `deletedAt` | Date \| null | soft delete |
| timestamps | | `createdAt`/`updatedAt` |

Index: `{ deletedAt: 1, flushedAt: -1 }` สำหรับรายการ, `{ location: "2dsphere" }`

**รูป:** บังคับอย่างน้อย 1 รูป (ก่อนหรือหลังรวมกัน) เพราะเป็นหลักฐานส่งงาน · URL ต้องขึ้นต้นด้วย
`https://res.cloudinary.com/` เท่านั้น

## 2. Logic ล้วน — `lib/smart-papar/flushing.js`

- `validateFlushingInput(body)` → `{ ok, value, errors }` — ตรวจ/แปลงตามตารางด้านบน
  (พิกัดต้องเป็นตัวเลข lat −90..90, lng −180..180; ตัดช่องว่าง; แปลง string ตัวเลขเป็น Number;
  ค่าว่างของ NTU → null)
- `canModifyFlushingLog(log, actor, now)` — superadmin ได้เสมอ; เจ้าของ (`createdByClerkId === actor.userId`)
  ได้ภายใน 7 วันนับจากวันที่**บันทึก** (`createdAt`) ตามปฏิทินไทย — ไม่ใช้ `flushedAt` เพราะเจ้าของแก้ช่องนั้นเองได้ (ยืดเวลาแก้ไขเองได้)
- `summarizeFlushing(logs)` → `{ total, clear, stillTurbid }`
- `FLUSHING_RESULT_LABELS` = `{ clear: "ใสแล้ว", still_turbid: "ยังขุ่น" }`
- เทสต์ vitest: `lib/smart-papar/__tests__/flushing.test.js`

## 3. API — `pages/api/smart-papar/flushing/`

ทุก route ผ่าน `requireSmartPaparAdmin` (สิทธิ์เดียวกับหน้าคุณภาพน้ำ) · ตอบรูปแบบ `{ success, data | message }` ตามโมดูลเดิม

- `GET index.js?from=YYYY-MM-DD&to=YYYY-MM-DD` — รายการ `deletedAt: null` ในช่วงวัน (ตีความเป็นวันไทย)
  เรียง `flushedAt` ใหม่สุดก่อน, จำกัด 500 รายการ + `summary`
- `POST index.js` — validate ฝั่ง server → create พร้อมข้อมูลผู้บันทึก
- `PATCH [id].js` — merge เอกสารเดิมกับ payload แล้ว validate ทั้งก้อน → เช็ค `canModifyFlushingLog` → save
- `DELETE [id].js` — เช็ค `canModifyFlushingLog` → ตั้ง `deletedAt`

ก่อนสร้าง `[id].js` ตรวจว่าไม่มี dynamic slug ชื่ออื่นในโฟลเดอร์เดียวกัน

## 4. หน้าจอ — `pages/admin/smart-papar/water-quality/flushing.jsx`

อยู่**ใต้ path หน้าแม่** เพราะ `_app.tsx` ตรวจสิทธิ์ด้วย `router.pathname` จริง — prefix `/admin/smart-papar/water-quality/`
ทำให้ guard ใน `_app`, `PermissionGuard` และการกรองเมนูใช้สิทธิ์หน้าแม่ได้เอง ไม่ต้องลงทะเบียน `ALL_PAGES` แยก
และ**ไม่ต้องรันสคริปต์ grant** (ถ้าวางไว้ที่ `/admin/smart-papar/flushing` จะโดน `_app` บล็อก)

Components ใน `components/smart-papar/`:
- `FlushingForm.js` — modal/sheet เต็มจอบนมือถือ เรียงตามลำดับงานหน้างาน:
  1. 📍 ปุ่ม "ใช้ตำแหน่งปัจจุบัน" (Geolocation, แสดงพิกัด + ความแม่นยำ) + ช่องชื่อจุด/ถนน
  2. 📷 รูปก่อนโบ (`<input type="file" accept="image/*" capture="environment">`, ≤ 3)
  3. ระยะเวลาโบ (นาที) + NTU ก่อน/หลัง (ไม่บังคับ, ช่องเล็ก)
  4. 📷 รูปหลังโบ (≤ 3)
  5. ปุ่มใหญ่ 2 ปุ่ม ✅ ใสแล้ว / ⚠️ ยังขุ่น
  6. หมายเหตุ (พับไว้) → ปุ่มบันทึก
  - รูปย่อฝั่ง client (ด้านยาว ≤ 1600px, JPEG) ก่อนอัปโหลดผ่าน `uploadImage` (pattern เดียวกับ smart-light/flood-relief)
    อัปโหลดทันทีที่เลือกรูป แสดงสถานะต่อรูป · อัปโหลดล้มเหลว → แจ้ง + ปุ่มลองใหม่ ข้อมูลที่กรอกไม่หาย
  - ปุ่มบันทึกปิดไว้ระหว่างรูปยังอัปโหลดไม่เสร็จ
- `FlushingMap.js` — Leaflet (โหลดด้วย `dynamic(..., { ssr:false })`) หมุด 🟢 ใสแล้ว / 🟠 ยังขุ่น · ข้อความใน popup ต้อง escape HTML
- `FlushingList.js` — การ์ดรายการ: เวลา, ชื่อจุด, ผล, ผู้บันทึก, รูปย่อ · กดเพื่อดูรายละเอียด/รูปเต็ม/แก้ไข/ลบ (ตามสิทธิ์)

โครงหน้า: หัวข้อ "โบตะกอน" + ปุ่มใหญ่ "+ บันทึกโบตะกอน" → ตัวกรอง (วันนี้ / 7 วัน / 30 วัน) →
ตัวเลขสรุป (ทั้งหมด / ใสแล้ว / ยังขุ่น) → แผนที่ → รายการ · UI ภาษาไทยทั้งหมด

## 5. เชื่อมเข้าระบบเดิม

- เมนู "โบตะกอน" ใน `components/LayoutAdmin.tsx` กลุ่ม "จัดการ" ถัดจาก "คุณภาพน้ำ (ประปา)" —
  ตรวจว่าเมนูซ่อน/แสดงตามสิทธิ์ของ `/admin/smart-papar/water-quality` ได้ถูกต้อง
- ปุ่มลิงก์ "โบตะกอน" บนหน้า `water-quality.jsx` (แตะแค่เพิ่มลิงก์)
- อัปเดต `docs/modules/smart-papar.md`

## 6. Error handling

- GPS ไม่อนุญาต/หาไม่เจอ → ข้อความบอกวิธีเปิดสิทธิ์ตำแหน่ง, บันทึกไม่ได้จนกว่าจะมีพิกัด
- API validate fail → 400 พร้อมข้อความภาษาไทยรายช่อง แสดงใต้ช่องที่ผิด
- 403 แก้/ลบเกิน 7 วัน → "แก้ไขได้ภายใน 7 วันหลังบันทึก"

## 7. Testing

- vitest: `validateFlushingInput` (ช่องบังคับ, ช่วงค่า, NTU ว่าง → null, รูปเกิน 3, URL ไม่ใช่ Cloudinary, ไม่มีรูปเลย),
  `canModifyFlushingLog` (เจ้าของ/ไม่ใช่เจ้าของ/superadmin/ขอบ 7 วัน รันด้วย `TZ=UTC`), `summarizeFlushing`
- `npm run lint`, `npx tsc --noEmit`, `next build` (ปิด dev server ก่อน)
- ทดสอบมือบนมือถือจริง: GPS, ถ่ายรูปจากกล้อง, เน็ตหลุดระหว่างอัปโหลด, แผนที่แสดงหมุดถูกสี
