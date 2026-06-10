# เรื่องร้องเรียน (complaints)

ประชาชนยื่นเรื่องร้องเรียน → เจ้าหน้าที่รับ/มอบหมาย/ติดตามสถานะ →
ปิดเรื่อง + ชวนประเมินความพึงพอใจ มีระบบ PDPA สำหรับ "เรื่องลับ"

## หน้า

- Public: `/complaint` (ยื่นเรื่อง), `/complaint/[id_card]`, `/status` (ติดตามสถานะ)
- Admin: `/admin/manage-complaints`, `/admin/my-tasks`, `/admin/dashboard`, `/admin/analytics`

## API

- `pages/api/complaints/*`, `pages/api/problems.js` (⚠️ อยู่ root ของ api/)
- `pages/api/assignments/*` — การมอบหมายงาน (⚠️ ควรย้ายใต้ complaints — เฟส 3)
- `pages/api/problem-options.js` + `pages/api/problemoptions/` (⚠️ ซ้ำซ้อน — เฟส 7)

## Models

`Complaint`, `Assignment`, `AdminOption`

## Components (⚠️ ยังกองที่ root ของ `components/` — รอเฟส 3)

`ComplaintFormModal`, `ComplaintDetailModal`, `ComplaintStats` + `ComplaintStatsNew`
(ซ้ำ — ต้องเลือกตัวเดียว), `ExportComplaints`, `CardAssignment`, `CardCompleted`,
`CardModalDetail`, `CardOfficail`, `OverdueComplaintsAlert` + `OverdueComplaintsAlertNew`
(ซ้ำ), `Reporter*`, `CommunitySelector`

## PDPA / เรื่องลับ

- ตรรกะอยู่ `lib/complaintPrivacy.js`
- เบลอภาพ: Cloudinary `e_blur` URL transform
- เซ็นเซอร์ข้อความ: เก็บ `pdpaDetailRedactions` (`{start,end}[]`) ที่แอดมินลากเลือกใน
  `ComplaintDetailModal`
- `lib/pdpaTextMask.js#maskSensitiveWords` ยังอยู่แต่**ไม่ใช้กับ flow สาธารณะแล้ว**

## Integration

ส่งแจ้งเตือน LINE OA (multicast หาเจ้าหน้าที่) + n8n webhook ตอนยื่นเรื่องใหม่ —
ดู `lib/lineMessaging.ts`, `pages/api/integrations/line-webhook.ts`
