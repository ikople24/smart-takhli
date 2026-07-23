# Design: Export รายงานรายเดือน PM2.5 (CSV) บนหน้า admin

- วันที่: 2026-07-23
- สถานะ: อนุมัติแล้ว (brainstorming เสร็จ รอเขียนแผน implementation)
- โมดูล: PM2.5 (DustBoy)

## เป้าหมาย

เจ้าหน้าที่ต้องการปุ่ม Export รายงานค่าฝุ่น PM2.5 **รายเดือน** ที่หน้า admin
เพื่อนำไปใช้ทำรายงานประจำเดือนใน Excel โดยใช้ข้อมูลที่ระบบเก็บไว้ใน MongoDB
อยู่แล้ว (collection `pm25_monthly` ที่ cron sync จาก DustBoy) — ไม่ต้องเรียก
API ภายนอกเพิ่ม

## ขอบเขต (สิ่งที่ทำ)

1. **API ใหม่** — `pages/api/pm25/monthly-report.js`
   - รับเฉพาะ `GET` เท่านั้น (method อื่นตอบ 405)
   - ป้องกันด้วย `requirePm25Admin` จาก `pages/api/pm25/_auth.js`
     (มาตรฐานเดียวกับ `/api/pm25/settings`)
   - คิวรี `Pm25Monthly.find().sort({ year: 1, month: 1 }).lean()` —
     **ทุกเดือนที่สะสมไว้** ใน collection เรียงเก่า → ใหม่
   - ตอบ `{ success: true, months: [{ monthKey, month, year, name, fullName, avg, count, syncedAt }] }`

2. **Component ใหม่** — `components/pm25/ExportPm25Monthly.jsx`
   - เริ่มโฟลเดอร์ `components/pm25/` ตาม module convention ของ repo
   - ปุ่ม "Export CSV รายเดือน" — กดแล้ว fetch `GET /api/pm25/monthly-report`
     พร้อม header `Authorization: Bearer <Clerk token>` (แบบเดียวกับ request
     อื่นในหน้า pm25-settings)
   - สร้าง CSV ฝั่ง client ตาม pattern
     `components/smart-school/admin/ExportApplicants.jsx`:
     **UTF-8 + BOM** เพื่อให้เปิดใน Excel แล้วภาษาไทยไม่เพี้ยน
     แล้ว trigger download ผ่าน Blob + `<a download>`

3. **วางปุ่มในหน้าเดิม** — `pages/admin/pm25-settings.jsx`
   - เพิ่ม section "รายงานรายเดือน" ใกล้ส่วนสถานะ cache (ที่แสดง
     `monthsCount` อยู่แล้ว) ไม่สร้างหน้า admin ใหม่ →
     **ไม่ต้อง**ลงทะเบียน `ALL_PAGES` / แก้เมนู / รัน migration สิทธิ์

## รูปแบบ CSV

| คอลัมน์ | ที่มา | ตัวอย่าง |
| --- | --- | --- |
| เดือน | `name` + ปี พ.ศ. (`year + 543`) | `ม.ค. 2569` |
| ปี (พ.ศ.) | `year + 543` | `2569` |
| ค่าเฉลี่ย PM2.5 (µg/m³) | `avg` | `38` |
| จำนวนข้อมูล (ชม.) | `count` | `698` |
| อัปเดตล่าสุด | `syncedAt` แปลงเวลาไทย | `15/07/2569 03:05` |

- เรียงแถวเก่า → ใหม่ (ตามที่ API ส่งมา)
- ชื่อไฟล์: `pm25-monthly-report-<YYYY-MM-DD วันที่กด export>.csv`

## Error handling

- Collection ว่าง (`months.length === 0`) → Swal แจ้ง
  "ยังไม่มีข้อมูลรายเดือน กรุณากด Sync monthly ก่อน"
  (ปุ่ม sync monthly มีอยู่แล้วในหน้า pm25-settings)
- fetch ล้มเหลว / API ตอบ `success: false` → Swal error ตาม pattern
  เดิมของหน้า (`Swal.fire("ผิดพลาด", message, "error")`)

## สิ่งที่ไม่ทำรอบนี้ (YAGNI)

- ไม่มีหน้า report แยก / ไม่มีเมนูใหม่
- ไม่มี PDF, ไม่มีรายงานรายวัน
- ไม่แตะ cron / logic sync เดิม (`lib/pm25Sync.js`)
- ไม่มี filter ช่วงเดือน — export ทุกเดือนที่มี (ไฟล์เล็ก ตัดใน Excel ได้)

## การทดสอบ

Repo ไม่มี test runner — ตรวจด้วย:

1. `npm run lint` ผ่าน
2. รัน `npm run dev` เปิด `/admin/pm25-settings` กด Export
   แล้วเทียบจำนวนแถว + ค่า avg กับข้อมูลจริงใน collection `pm25_monthly`
3. เปิดไฟล์ CSV ใน Excel ยืนยันภาษาไทยไม่เพี้ยน (BOM ทำงาน)

## ภาคผนวก: แก้เพิ่มระหว่างตรวจรับ (2026-07-23)

ตรวจรับกับข้อมูลจริงพบ มิ.ย. 2569 หายจากไฟล์ export — root cause อยู่ที่
`syncPm25Monthly` เดิม sync เฉพาะเดือนปัจจุบันและข้ามเมื่อ doc มีแล้ว
ทำให้เดือนที่ cron ไม่ได้รัน (มิ.ย. 2569) เป็นรูถาวร และเดือนปัจจุบัน
แช่แข็งที่ค่า sync แรกของเดือน จึงแก้เพิ่ม 2 จุด:

1. `syncPm25Monthly` เป็น self-healing: upsert ทุกเดือนจาก `data1year`
   ทุกรอบ พร้อม count guard กันเดือนขอบหน้าต่าง 1 ปี (ข้อมูลไม่เต็มเดือน)
   ทับของเดิมที่สมบูรณ์กว่า — เลิกใช้ param `force`
2. `monthsTotal` (จำนวนเดือนบนการ์ด export) ย้ายเป็น field บนสุดของ
   settings response — ไม่หายเมื่อ cache รายชั่วโมงยังว่าง
