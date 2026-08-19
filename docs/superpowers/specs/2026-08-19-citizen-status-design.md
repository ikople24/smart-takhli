# ดีไซน์เฟส 3: ติดตามสถานะโฉมใหม่ (`/preview/status`)

วันที่: 2026-08-19 · สถานะ: อนุมัติแล้ว · เฟสก่อน: home (`2026-08-18-citizen-home-redesign-design.md`), wizard (`2026-08-18-citizen-report-wizard-design.md`) · ภาพอ้างอิง: แคนวาสจอ "ติดตามสถานะ" (`:152-227`) + "รายละเอียดสถานะ" (`:229-336`)

## สรุป

รวมสองหน้าเดิม (`/complaint` = อยู่ระหว่างดำเนินการ, `/status` = เสร็จสิ้น) เป็น
ลิสต์เดียว `/preview/status` + chips กรองสถานะ และจอรายละเอียดรายเรื่อง
`/preview/status/[id]` — **หน้าเก่าทั้งสองไม่แตะ**

## หน้า 1: ลิสต์ `/preview/status`

- chips: ทั้งหมด (จำนวน) · กำลังดำเนินการ · เสร็จสิ้น — query `?filter=active|done`
  ตั้งค่าเริ่มจาก Nav ล่าง (ซ้าย=active ขวา=done ไม่มี=ทั้งหมด)
- การ์ดตามแคนวาส: ไอคอนหมวด (Prob_pic จาก useMenuStore) · ชื่อเรื่อง (problems
  ตัวแรก + category fallback) · เลขเรื่อง mono · ชิปสถานะ (เหลือง=ดำเนินการ,
  เขียว=เสร็จ) · **progress 4 ท่อน** · อัปเดตล่าสุด (ขั้นล่าสุด + วันที่ไทย)
- ข้อมูล: `GET /api/complaints?status=..&withCount=true&page=&limit=20` (PDPA/
  เรื่องลับกรองฝั่ง server แล้ว — ห้าม fetch แบบ staff) + `POST
  /api/complaints/assignments/by-complaints` (ของหน้า /status เดิม) · โหลดเพิ่มแบบ
  ปุ่ม "ดูเพิ่มเติม"
- กดการ์ด → `/preview/status/[id]`

## Progress 4 ขั้น (logic ล้วน + เทสต์ — `lib/citizen/status/progress.js`)

| ขั้น | เงื่อนไข | timestamp |
|---|---|---|
| 1 รับเรื่องร้องเรียน | เสมอ | `createdAt` |
| 2 มอบหมายเจ้าหน้าที่ | มี assignment | `assignedAt` (+ ชื่อ/กอง จาก user ที่ populate) |
| 3 ดำเนินการแก้ไข | มี assignment (กำลังทำ) | — (สถานะ active เมื่อยังไม่จบ) |
| 4 ดำเนินการเสร็จสิ้น | `status === "ดำเนินการเสร็จสิ้น"` | `completedAt` ?? `updatedAt` |

`statusProgress(complaint, assignment)` → `{ step: 1-4, label, at }` — ใช้ทั้ง
progress bar ในลิสต์และ timeline ในจอรายละเอียด · วันที่ format ไทยฝั่ง client
เท่านั้น (เซิร์ฟเวอร์ UTC)

## หน้า 2: รายละเอียด `/preview/status/[id]`

- หัว: ชื่อเรื่อง + เลขเรื่อง + ชิปสถานะ + ชุมชน + วันที่แจ้ง
- **timeline 4 ขั้น** จาก mapping ข้างบน (จุดม่วงขั้นที่ถึงแล้ว เทาขั้นที่ยังไม่ถึง)
- ปัญหาที่พบ (chips) + รายละเอียด (ข้อความ sanitize จาก API เดิม — เคารพ
  `pdpaDetailRedactions` ที่ server จัดการแล้ว)
- รูป: ก่อน = `complaint.images` · หลัง = `assignment.solutionImages` — ถ้ามีทั้งคู่
  ใช้ `ReactCompareImage` (dependency เดิมของ /status) ไม่งั้นแสดงแกลเลอรีธรรมดา
- การ์ดเจ้าหน้าที่ผู้รับผิดชอบ (ชื่อ/ตำแหน่ง/กอง จาก assignment ที่ populate แล้ว —
  แสดงตามที่ API สาธารณะเดิมให้มา ไม่เพิ่มฟิลด์)
- **ให้คะแนนความพึงพอใจ** เมื่อเสร็จสิ้น: reuse `SatisfactionForm` เดิม + เพดาน
  4 ครั้ง/เรื่อง จาก `GET /api/satisfaction/count?complaintId=..&source=public`
  (พฤติกรรมเดียวกับ CardOfficail เดิม)
- ปุ่มล่าง: **ติดต่อ จนท.** = `tel:` เบอร์กลางเทศบาล · **แชร์เรื่องนี้** = Web Share
  API (fallback คัดลอกลิงก์)
- ข้อมูล: `GET /api/complaints?complaintId=<id>` + assignments เดิม (ทางเดียวกับ
  CardOfficail) — เรื่องลับ/ไม่พบ → จอ "ไม่พบเรื่องนี้" + ปุ่มกลับ

## เดินสาย

- `BottomNav`: ซ้าย → `/preview/status?filter=active` · ขวา →
  `/preview/status?filter=done` (เลิกชี้หน้าเก่า)
- จอสำเร็จ wizard: "ติดตามสถานะเรื่อง" → `/preview/status`
- `components/Layout.js` ครอบ `/preview/*` อยู่แล้ว — ไม่ต้องแก้เพิ่ม

## การทดสอบ

vitest: `statusProgress` ทุกเงื่อนไข + ขอบ (ไม่มี assignment, เสร็จโดยไม่มี
completedAt) · UI: ภาพแคปเทียบแคนวาสทั้งสองจอ + กดจากการ์ด → detail → กลับ ·
ข้อมูลจริงจาก DB (อ่านอย่างเดียว) — **ห้ามยิงเขียนใด ๆ รวมถึงให้คะแนนจริง**

## นอกขอบเขต

แตะหน้า/คอมโพเนนต์เดิม (`/complaint`, `/status`, CardOfficail, CardModalDetail)
· ข่าว & กิจกรรมโฉมใหม่ (เฟส 4) · โปรไฟล์ (เฟส 5) · แก้ API ใด ๆ
