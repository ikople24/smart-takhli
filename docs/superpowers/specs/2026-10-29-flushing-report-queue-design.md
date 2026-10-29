# รายงานผู้บริหาร + คิวงานโบตะกอนประจำ — design

วันที่ 2026-10-29 · โมดูล smart-papar · หน้า `/admin/smart-papar/water-quality/flushing`

## เป้าหมาย

1. ผู้บริหารเห็นสรุปงานโบตะกอน รายวัน / รายเดือน แยกตามทีม (กองการประปา, ทีมงานป้องกัน): โบกี่ครั้ง ระบายกี่หัว ใสแล้วกี่หัว
2. ระบบจัดคิวงานประจำอัตโนมัติ: ผลล่าสุด **ยังขุ่น → อีก 5 วัน**, **ใสแล้ว → อีก 15 วัน** นับจากวันโบครั้งล่าสุด จ่ายให้ **ทีมที่โบหัวนั้นครั้งล่าสุด**
3. เจ้าหน้าที่ภาคสนามเห็นคิวของทีมตัวเองที่ `/papar/flushing`

## ทีม

- collection ใหม่ `smart_papar_flushing_teams` (model `models/smart-papar/FlushingTeam.js`): `{ key, label, members: [String], order }` — 2 ทีมตั้งต้น `water` = "กองการประปา", `prevention` = "ทีมงานป้องกัน" (สร้างอัตโนมัติถ้ายังไม่มี)
- `members` = ชื่อคนบันทึก (`FlushingLog.createdByName`) ตรงตัวอักษรหลัง trim — ชื่อหนึ่งอยู่ได้ทีมเดียว (บันทึกทีมใหม่ = ถอดชื่อออกจากทีมอื่น)
- ทีมของบันทึกหาตอนอ่าน (`teamOfName`) ไม่ประทับลง log → แก้ทีมแล้วรายงาน/คิวย้อนหลังเปลี่ยนตามทันที; ชื่อที่ไม่อยู่ทีมไหน = "ยังไม่จัดทีม" (`key: ""`)
- ตั้งค่าในแท็บรายงาน (modal): แสดงทุกชื่อคนบันทึกที่พบ (distinct `createdByName`) พร้อมจำนวนบันทึก ให้เลือกทีม

## logic ล้วน — `lib/smart-papar/flushingSchedule.js` (+ vitest)

- `CYCLE_DAYS = { clear: 15, still_turbid: 5 }`
- `teamResolver(teams)` → `(name) => teamKey | ""`
- `buildQueue({ points, logs, teams, today })` — `points` = หัว active, `logs` = log ที่ผูกหัว (ล่าสุดต่อหัวด้วย `latestByPoint` เดิม) · คืนรายการต่อหัว `{ point, lastLog, teamKey, dueYmd, daysLeft, bucket }`
  - `bucket`: `overdue` (dueYmd < today) · `today` · `upcoming` (≤ 7 วัน) · `later` · `blocked` (ยังขุ่นด้วย obstacle/damaged — `isNoFlush` เดิม — ไม่เข้ารอบประจำ) · `never` (ยังไม่เคยโบ)
  - วันเป็นวันไทย (`bangkokYmd`) นับวันปฏิทินรวมเสาร์อาทิตย์
  - เรียง dueYmd จากน้อยไปมาก แล้วรหัสหัว
- `summarizeByTeam({ logs, teams })` — ต่อทีม (+ "ยังไม่จัดทีม"): `flushCount` (ครั้ง, รวม log ไม่ผูกหัว), `points` (หัวไม่ซ้ำ), `clearPoints` / `turbidPoints` (ตามผลล่าสุดของหัวนั้นภายในช่วง) · ทีมของหัวในช่วง = ทีมของ log ล่าสุดในช่วงนั้น (นับหัวในทีมเดียว) · แถวรวมทั้งหมด
- `dailyBreakdown({ logs, teams, month })` — รายวันในเดือน: ต่อวัน ต่อทีม `flushCount` + `points`

## API (Clerk ผ่าน `requireSmartPaparAdmin`)

- `GET /api/smart-papar/flushing/report?period=day&date=YYYY-MM-DD` หรือ `period=month&month=YYYY-MM` → `{ teams, summary, daily? }`
- `GET /api/smart-papar/flushing/queue` → `{ teams, items, counts }` (items ไม่มีรูป/ข้อมูลคนอื่นเกินจำเป็น)
- `GET/PUT /api/smart-papar/flushing/teams` → รายการทีม + ชื่อคนบันทึกที่พบ / บันทึก members (validate ชื่อเป็น string ≤ 80, ไม่ซ้ำข้ามทีม)
- ภาคสนาม `GET /api/smart-papar/field/queue` (cookie PIN) → คิวทีมของ `session.name` เฉพาะ bucket `overdue|today|upcoming` คืนแค่ `code, name, roadName, coordinates, dueYmd, lastResult` · ชื่อไม่อยู่ทีม → `{ team: null, items: [] }`
- ระวัง: `pages/api/smart-papar/flushing/` มี `[id].js` — route static `report.js`/`queue.js`/`teams.js` ชนะ dynamic ใน Next ได้ตามปกติ (ไม่ใช่ slug ชนกัน)

## UI

- แท็บที่ 3 `?tab=report` "รายงานและคิวงาน" (component `FlushingReport.js` โหลดด้วย dynamic) — ไม่เพิ่มหน้า/สิทธิ์ใหม่
  - สลับ รายวัน/รายเดือน + ตัวเลือกวัน/เดือน · การ์ดตัวเลขรวม 4 ตัว · ตารางทีม × ตัวเลข · รายเดือนมีตารางรายวัน
  - คิวงาน: ตัวกรองทีม, กลุ่ม เลยกำหนด / วันนี้ / 7 วันข้างหน้า (เปิดดู "ภายหลัง" ได้), กลุ่มแยก "รอแก้ไขก่อน" / "ยังไม่เคยโบ" / "ยังไม่มีทีมรับผิดชอบ"
  - ปุ่ม "ตั้งค่าทีม" → modal
- `/papar/flushing`: กล่อง "คิวทีมของฉัน" เหนือฟอร์ม — กดรายการ = เลือกหัวนั้นในฟอร์ม · ไม่มีทีม → "ยังไม่ได้จัดทีม แจ้งแอดมิน"
- คำในหน้าเจ้าหน้าที่ใช้ "โบตะกอน"

## นอกขอบเขต

- ไม่แจ้ง LINE อัตโนมัติ · ไม่มีวันหยุดราชการ · ไม่กำหนดทีมประจำหัว · ไม่แก้ข้อมูล log เดิม
